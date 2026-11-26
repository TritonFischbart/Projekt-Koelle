// Verbindung zu Firebase: Anmeldung mit Google und die gemeinsame Datenbank.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  reauthenticateWithPopup,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  where,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported as isMessagingSupported,
  onMessage,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';
import { CALENDAR_SCOPE, eventWriteUrl } from './calendar.js?v=53';

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // Lokaler Zwischenspeicher: Die Seite lädt schneller und funktioniert kurz auch offline.
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }

  getRedirectResult(auth).catch((err) => console.error(err));

  // Erlaubnis, in den Google-Kalender zu schreiben: Google fragt beim ersten Mal nach
  // („Darf Projekt Kölle deinen Kalender bearbeiten?“). Der Zugang gilt etwa 1 Stunde,
  // danach öffnet sich kurz das Google-Fenster und schließt sich meist von selbst.
  const CAL_TOKEN_KEY = 'koelle.calToken';
  let calToken = null;
  try { calToken = JSON.parse(sessionStorage.getItem(CAL_TOKEN_KEY) ?? 'null'); } catch { /* privater Modus */ }
  const forgetCalendarToken = () => {
    calToken = null;
    try { sessionStorage.removeItem(CAL_TOKEN_KEY); } catch { /* egal */ }
  };
  async function calendarAccessToken() {
    if (calToken && calToken.until > Date.now() && calToken.uid === auth.currentUser?.uid) return calToken.token;
    const calProvider = new GoogleAuthProvider();
    calProvider.addScope(CALENDAR_SCOPE);
    calProvider.setCustomParameters({ login_hint: auth.currentUser?.email ?? '' });
    const result = await reauthenticateWithPopup(auth.currentUser, calProvider);
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw Object.assign(new Error('Kein Kalender-Zugang erhalten'), { status: 401 });
    calToken = { token, until: Date.now() + 50 * 60000, uid: auth.currentUser.uid };
    try { sessionStorage.setItem(CAL_TOKEN_KEY, JSON.stringify(calToken)); } catch { /* egal */ }
    return token;
  }

  return {
    isDemo: false,

    onUser: (callback) => onAuthStateChanged(auth, callback),

    async login() {
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(err.code)) {
          return signInWithRedirect(auth, provider);
        }
        if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) return;
        throw err;
      }
    },

    logout: () => signOut(auth),

    watch(name, onData, onError) {
      return onSnapshot(
        collection(db, name),
        (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))),
        onError,
      );
    },

    add: (name, data) => addDoc(collection(db, name), data),
    update: (name, id, data) => updateDoc(doc(db, name, id), data),
    remove: (name, id) => deleteDoc(doc(db, name, id)),
    set: (name, id, data) => setDoc(doc(db, name, id), data),
    // Einträge einmalig holen, bei denen ein Feld einen Wert hat (z. B. Kassenbons einer Ausgabe)
    async getWhere(name, field, value) {
      const snap = await getDocs(query(collection(db, name), where(field, '==', value)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    },

    // Legt eine Abrechnung an und ordnet ihr alle offenen Einträge zu.
    async settleAll(settlement, expenseIds, paymentIds) {
      const ref = doc(collection(db, 'settlements'));
      const updates = [
        ...expenseIds.map((id) => doc(db, 'expenses', id)),
        ...paymentIds.map((id) => doc(db, 'payments', id)),
      ];
      let batch = writeBatch(db);
      batch.set(ref, settlement);
      let count = 1;
      for (const docRef of updates) {
        batch.update(docRef, { settlementId: ref.id });
        count += 1;
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    },

    now: () => serverTimestamp(),

    // Termin im Google-Kalender anlegen (POST), ändern (PATCH) oder löschen (DELETE).
    // Wichtig: Das Google-Fenster muss direkt nach dem Antippen aufgehen – deshalb
    // vorher nichts abwarten.
    async calendarWrite(method, calendarId, eventId, body) {
      const token = await calendarAccessToken();
      const response = await fetch(eventWriteUrl(calendarId, eventId), {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) forgetCalendarToken();
        let detail = '';
        try { detail = (await response.json()).error?.message ?? ''; } catch { /* kein JSON */ }
        throw Object.assign(new Error(`Kalender ${response.status}: ${detail}`), { status: response.status, detail });
      }
      return method === 'DELETE' ? null : response.json();
    },

    // ---------- Push-Nachrichten ----------
    pushReady: Boolean(config.vapidKey),

    async pushSupported() {
      return 'Notification' in window && 'serviceWorker' in navigator && (await isMessagingSupported());
    },

    // Fragt nach Erlaubnis und liefert die "Adresse" dieses Handys für Nachrichten.
    async enablePush() {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw Object.assign(new Error('Nicht erlaubt'), { code: 'denied' });
      const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
      return getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    },

    // Aktuelle "Adresse" ohne Nachfrage (Erlaubnis ist schon da). Google tauscht sie ab und zu aus.
    async currentPushToken() {
      const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
      return getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    },

    async disablePush() {
      await deleteToken(getMessaging(app)).catch(() => {});
    },

    // Nachricht kommt an, während die App offen ist
    async onPushMessage(callback) {
      if (await this.pushSupported()) onMessage(getMessaging(app), (payload) => callback(payload.notification ?? {}));
    },
  };
}
