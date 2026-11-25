// Demo-Modus (Adresse mit ?demo am Ende): Beispieldaten nur im Browser,
// damit man die Seite ohne Firebase ausprobieren kann. Nichts wird gespeichert.

import { weekKey } from './chores.js?v=52';
import { normalizeEvent } from './calendar.js?v=52';

// Gezeichneter Beispiel-Kassenbon
function demoReceipt() {
  const lines = [['Milch 1,5%', '1,19'], ['Bananen', '1,79'], ['Hafermilch', '2,29'], ['Spaghetti', '0,99'], ['Tomaten passiert', '1,49'], ['Kölsch 6er', '6,99'], ['Klopapier 8 Rollen', '3,95'], ['…', ''], ['SUMME EUR', '64,20']];
  const rows = lines.map(([n, p], i) => `<text x="30" y="${170 + i * 44}">${n}</text><text x="370" y="${170 + i * 44}" text-anchor="end">${p}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640"><rect width="400" height="640" fill="#fbfaf6"/>
    <g font-family="monospace" font-size="22" fill="#222"><text x="200" y="60" text-anchor="middle" font-size="30" font-weight="bold">REWE</text>
    <text x="200" y="95" text-anchor="middle" font-size="16">Venloer Str. · Köln-Ehrenfeld</text>${rows}
    <text x="200" y="600" text-anchor="middle" font-size="16">Vielen Dank für Ihren Einkauf!</text></g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Einfacher gezeichneter Grundriss als Beispielbild
function demoFloorPlan() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="#fff"/>
    <g fill="none" stroke="#222" stroke-width="8"><rect x="20" y="20" width="760" height="480"/>
    <path d="M300 20v200M300 300v200M300 300h200M500 20v280M500 380v120M20 260h280"/></g>
    <g font-family="sans-serif" font-size="28" fill="#555"><text x="80" y="140">Jana</text><text x="80" y="390">Jul</text>
    <text x="360" y="420">Bad</text><text x="330" y="150">Küche</text><text x="590" y="200">Lukas</text><text x="560" y="450">Flur</text></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createDemoBackend() {
  const user = { uid: 'demo-lukas', email: 'lukas@beispiel.de', displayName: 'Lukas' };
  const all = ['jana', 'julian', 'lukas'];
  const dayIso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const created = (n) => new Date(Date.now() - n * 86400000);

  const store = {
    members: [
      { id: 'lukas', uid: 'demo-lukas' },
      { id: 'julian', uid: 'demo-julian' },
      { id: 'jana', uid: 'demo-jana' },
    ],
    expenses: [
      { id: 'e1', description: 'Wocheneinkauf Rewe', amountCents: 6420, paidBy: 'lukas', splitAmong: all, category: 'lebensmittel', date: daysAgo(1), createdAt: created(1), settlementId: null, receipts: 1 },
      { id: 'e2', description: 'Klopapier & Spülmittel', amountCents: 1290, paidBy: 'jana', splitAmong: all, category: 'haushalt', date: daysAgo(3), createdAt: created(3), settlementId: null },
      { id: 'e3', description: 'Internet Oktober', amountCents: 3999, paidBy: 'lukas', splitAmong: all, category: 'nebenkosten', date: daysAgo(5), createdAt: created(5), settlementId: null },
      { id: 'e4', description: 'Kinotickets', amountCents: 2400, paidBy: 'julian', splitAmong: ['julian', 'jana'], category: 'freizeit', date: daysAgo(6), createdAt: created(6), settlementId: null },
      { id: 'e5', description: 'Pizza-Abend', amountCents: 3600, paidBy: 'jana', splitAmong: all, category: 'lebensmittel', date: daysAgo(30), createdAt: created(30), settlementId: 's1' },
      { id: 'e6', description: 'Putzmittel dm', amountCents: 1850, paidBy: 'julian', splitAmong: all, category: 'haushalt', date: daysAgo(34), createdAt: created(34), settlementId: 's1' },
    ],
    payments: [],
    settlements: [
      { id: 's1', createdAt: created(28), createdBy: 'jana', expenseCount: 2, totalCents: 5450 },
    ],
    chores: [],
    recurring: [
      // lastBooked im Vormonat -> wird beim Öffnen der Demo automatisch für diesen Monat eingetragen
      { id: 'r1', description: 'Internet', amountCents: 3999, paidBy: 'lukas', splitAmong: all, category: 'nebenkosten', dayOfMonth: 1, lastBooked: lastMonth() },
      { id: 'r2', description: 'Netflix', amountCents: 1799, paidBy: 'jana', splitAmong: all, category: 'freizeit', dayOfMonth: 28, lastBooked: thisMonth() },
    ],
    noteImages: [
      { id: 'img1', noteId: 'n3', data: demoFloorPlan(), width: 800, height: 520, createdBy: 'lukas', createdAt: created(10) },
    ],
    // Jul ist gerade einkaufen (zeigt den Hinweis „Jul geht gerade einkaufen“)
    shoppingTrips: [
      { id: 'julian', person: 'julian', at: new Date(Date.now() - 20 * 60000).toISOString() },
    ],
    absences: [
      { id: 'a1', person: 'jana', from: daysAgo(-1), to: daysAgo(-4), note: 'Hamburg' },
      { id: 'a2', person: 'julian', from: daysAgo(-20), to: daysAgo(-27), note: 'Urlaub' },
    ],
    invites: [
      { id: 'inv1', emoji: '🍳', title: 'Ich koche – wer isst mit?', note: 'Spaghetti Bolo', kind: 'food',
        at: (() => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString(); })(),
        responses: { julian: 'yes' }, createdBy: 'jana', createdAt: created(0) },
    ],
    polls: [
      { id: 'p1', question: 'Pizza oder Sushi am Freitag?', options: ['Pizza 🍕', 'Sushi 🍣', 'Selber kochen'], until: dayIso((5 - new Date().getDay() + 7) % 7), votes: { jana: 1, julian: 0 }, closed: false, createdBy: 'jana', createdAt: created(1) },
      { id: 'p0', question: 'Grillen gestern?', options: ['Ja', 'Nein'], until: dayIso(-1), votes: {}, closed: false, createdBy: 'julian', createdAt: created(3) },
    ],
    notes: [
      { id: 'n1', title: '📶 WLAN', text: 'Netzwerk: Koelle-WG\nPasswort: DomBlick2026!', createdBy: 'lukas', createdAt: created(20), updatedBy: 'lukas', updatedAt: created(20) },
      { id: 'n3', title: '📐 Grundriss', text: 'Aus dem Exposé, 3 Zimmer, 78 m²', createdBy: 'lukas', createdAt: created(25), updatedBy: 'lukas', updatedAt: created(10) },
      { id: 'n2', title: '🏠 Vermieter & Hausverwaltung', text: 'Herr Beispiel\nTelefon: 0221 123456', createdBy: 'jana', createdAt: created(15), updatedBy: 'jana', updatedAt: created(4) },
      { id: 'n4', title: '🧳 Vor dem Urlaub', text: 'Bitte dran denken:\n- Pflanzen gießen\n- Fenster zu\n- Kühlschrank leer machen\n\nReihenfolge Müll:\n1. Bio\n2. Gelber Sack\n3. Restmüll', createdBy: 'jana', createdAt: created(5), updatedBy: 'jana', updatedAt: created(5) },
    ],
    pushSettings: [],
    pushTokens: [],
    pushTests: [],
    settings: [
      { id: 'putzplan', areas: [
        { id: 'bad', name: 'Bad', icon: '🛁', details: 'Toilette, Waschbecken, Dusche, Spiegel', every: 1 },
        { id: 'kueche', name: 'Küche', icon: '🍳', details: 'Arbeitsflächen, Herd, Spüle', every: 1 },
        { id: 'boeden', name: 'Böden', icon: '🧹', details: 'Saugen & Wischen', every: 1 },
        { id: 'muell', name: 'Müll', icon: '🗑️', details: 'Restmüll, Bio, Gelber Sack', every: 1 },
        { id: 'altglas', name: 'Altglas', icon: '🍾', details: 'Zum Container bringen', every: 2 },
      ] },
      { id: 'kalender', calendarId: 'demo@group.calendar.google.com', apiKey: 'AIzaDemoDemoDemoDemoDemoDemo' },
    ],
    favorites: [
      { id: 'milch', name: 'Milch', count: 6, lastUsed: created(2) },
      { id: 'klopapier', name: 'Klopapier', count: 4, lastUsed: created(3) },
      { id: 'eier', name: 'Eier', count: 3, lastUsed: created(5) },
      { id: 'brot', name: 'Brot', count: 3, lastUsed: created(6) },
      { id: 'sp%C3%BClmittel', name: 'Spülmittel', count: 2, lastUsed: created(9) },
      { id: 'kaffee', name: 'Kaffee', count: 2, lastUsed: created(12) },
    ],
    shopping: [
      { id: 'i1', name: 'Milch', addedBy: 'jana', createdAt: created(2), doneBy: null, doneAt: null },
      { id: 'i4', name: 'Bananen', addedBy: 'jana', createdAt: created(2), doneBy: null, doneAt: null },
      { id: 'i5', name: 'Hafermilch', addedBy: 'lukas', createdAt: created(1), doneBy: null, doneAt: null },
      { id: 'i6', name: 'Brötchen', addedBy: 'julian', createdAt: created(1), doneBy: null, doneAt: null },
      { id: 'i2', name: 'Spülmaschinentabs', addedBy: 'julian', createdAt: created(1), doneBy: null, doneAt: null },
      { id: 'i3', name: 'Klopapier', addedBy: 'lukas', createdAt: created(3), doneBy: 'jana', doneAt: created(1) },
    ],
  };

  // Kassenbon zur Ausgabe e1, „Kurz notiert“ und WG-Abende zum Bewerten
  store.receiptImages = [{ id: 'rc1', expenseId: 'e1', data: demoReceipt(), width: 400, height: 640, createdBy: 'lukas', createdAt: created(1) }];
  store.quickNotes = [
    { id: 'q1', text: 'Paket für Jul liegt im Flur 📦', createdBy: 'jana', createdAt: new Date(Date.now() - 40 * 60000) },
    { id: 'q2', text: 'Bin bis Sonntag bei meinen Eltern – Pflanzen bitte gießen 🌱', createdBy: 'julian', createdAt: created(2) },
  ];
  const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
  store.invites.push(
    { id: 'inv0', emoji: '🎲', title: 'Spieleabend', note: 'Siedler', kind: 'other', at: hoursAgo(20).toISOString(),
      responses: { jana: 'yes', lukas: 'yes' }, ratings: { jana: 5 }, createdBy: 'julian', createdAt: hoursAgo(26) },
    { id: 'inv-1', emoji: '🍕', title: 'Pizza selber machen', note: '', kind: 'food', at: hoursAgo(24 * 9).toISOString(),
      responses: { jana: 'yes', julian: 'yes' }, ratings: { jana: 5, julian: 5, lukas: 4 }, createdBy: 'lukas', createdAt: hoursAgo(24 * 9 + 5) },
    { id: 'inv-2', emoji: '🎬', title: 'Filmabend: Der Schuh des Manitu', note: '', kind: 'other', at: hoursAgo(24 * 16).toISOString(),
      responses: { jana: 'yes', lukas: 'yes' }, ratings: { jana: 3, lukas: 4, julian: 4 }, createdBy: 'julian', createdAt: hoursAgo(24 * 16 + 3) },
  );

  // Putzplan-Beispiel: In dieser Woche hat schon jemand eine Aufgabe erledigt.
  const key = weekKey(new Date());
  store.chores.push({ id: `${key}_kueche`, week: key, chore: 'kueche', assignee: 'jana', doneBy: 'jana', doneAt: new Date() });

  const listeners = {};
  let userCallbacks = [];
  let currentUser = user;
  let nextId = 1;
  let demoCalendar = null;

  const snapshot = (name) => store[name].map((item) => ({ ...item }));
  const notify = (name) => (listeners[name] ?? []).forEach((cb) => cb(snapshot(name)));
  const find = (name, id) => store[name].find((item) => item.id === id);

  return {
    isDemo: true,

    onUser(callback) {
      userCallbacks.push(callback);
      setTimeout(() => callback(currentUser), 0);
      return () => { userCallbacks = userCallbacks.filter((cb) => cb !== callback); };
    },
    async login() {
      currentUser = user;
      userCallbacks.forEach((cb) => cb(currentUser));
    },
    async logout() {
      currentUser = null;
      userCallbacks.forEach((cb) => cb(currentUser));
    },

    watch(name, onData) {
      (listeners[name] ??= []).push(onData);
      setTimeout(() => onData(snapshot(name)), 0);
      return () => { listeners[name] = listeners[name].filter((cb) => cb !== onData); };
    },

    async add(name, data) {
      store[name].push({ id: `demo${nextId++}`, ...data });
      notify(name);
    },
    async update(name, id, data) {
      const item = find(name, id);
      // "votes.lukas" wie bei Firestore: verschachteltes Feld setzen
      for (const [key, value] of Object.entries(data)) {
        const [field, sub] = key.split('.');
        if (sub) item[field] = { ...(item[field] ?? {}), [sub]: value };
        else item[key] = value;
      }
      notify(name);
    },
    async remove(name, id) {
      store[name] = store[name].filter((item) => item.id !== id);
      notify(name);
    },
    async getWhere(name, field, value) {
      return (store[name] ?? []).filter((item) => item[field] === value).map((item) => ({ ...item }));
    },
    async set(name, id, data) {
      store[name] = store[name].filter((item) => item.id !== id);
      store[name].push({ id, ...data });
      notify(name);
    },
    async settleAll(settlement, expenseIds, paymentIds) {
      const id = `demo${nextId++}`;
      store.settlements.push({ id, ...settlement });
      expenseIds.forEach((eid) => { find('expenses', eid).settlementId = id; });
      paymentIds.forEach((pid) => { find('payments', pid).settlementId = id; });
      ['settlements', 'expenses', 'payments'].forEach(notify);
    },

    now: () => new Date(),

    // Push im Demo-Modus nur zum Ausprobieren der Oberfläche
    pushReady: true,
    async pushSupported() { return true; },
    async enablePush() { return 'demo-token'; },
    async currentPushToken() { return 'demo-token'; },
    async disablePush() {},
    async onPushMessage() {},

    // Beispieltermine statt echter Google-Termine
    demoEvents() {
      demoCalendar ??= (() => {
        const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; };
        const day = (days) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days); return d; };
        return [
          { id: 'k1', title: 'WG-Abend: Pizza & Film', location: 'Wohnzimmer', description: 'Jeder bringt ein Getränk mit 🍕\nFilm-Vorschläge hier sammeln: https://www.example.com/filme', allDay: false, start: at(0, 20), end: at(0, 23), link: '' },
          { id: 'k2', title: 'Jana in Hamburg', location: '', allDay: true, start: day(1), end: day(4), link: '' },
          { id: 'k3', title: 'Vermieter kommt (Heizung)', location: '', description: 'Herr Schmitz schaut sich die Heizung im Bad an. Bitte jemand zu Hause sein.', allDay: false, start: at(2, 9, 30), end: at(2, 10, 30), link: '' },
          { id: 'k4', title: 'Sperrmüll', location: 'vor dem Haus', allDay: true, start: day(6), end: day(7), link: '' },
          { id: 'k5', title: 'Geburtstag Jul 🎂', location: '', allDay: true, start: day(12), end: day(13), link: '' },
          { id: 'k6', title: 'Weiberfastnacht 🎭', location: 'Heumarkt', allDay: true, start: day(102), end: day(103), link: '' },
          { id: 'k7', title: 'Rosenmontagszug', location: 'Innenstadt', allDay: false, start: at(106, 10), end: at(106, 18), link: '' },
        ];
      })();
      return [...demoCalendar];
    },

    // Wie Google: Termin anlegen, ändern oder löschen – hier nur im Browser.
    async calendarWrite(method, calendarId, eventId, body) {
      await new Promise((r) => setTimeout(r, 300));
      this.demoEvents();
      if (method === 'DELETE') {
        demoCalendar = demoCalendar.filter((e) => e.id !== eventId);
        return null;
      }
      const id = eventId || `demoK${nextId++}`;
      const event = normalizeEvent({ id, ...body });
      demoCalendar = [...demoCalendar.filter((e) => e.id !== id), event];
      return { id };
    },
  };
}
