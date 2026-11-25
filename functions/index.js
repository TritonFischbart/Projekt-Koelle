// Versand-Dienst für Push-Nachrichten (läuft bei Firebase, Tarif "Blaze").
// Wird automatisch über GitHub bereitgestellt (.github/workflows/deploy-functions.yml).

process.env.TZ = 'Europe/Berlin'; // Uhrzeiten wie in Köln

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { eventsUrl, normalizeEvent, groupByDay } from './shared/calendar.js';
import {
  wants, inviteMessages, pollMessages, expenseMessages, choreWeekStartMessages,
  expenseChangeMessages, noteMessages, inviteAnswerMessages, pollClosedMessages, absenceMessages,
  choreReminderMessages, calendarMessages, shoppingMessages, tripMessages, quickNoteMessages, dueJobs,
} from './logic.js';

setGlobalOptions({ region: 'europe-west3', maxInstances: 2 });
initializeApp();
const db = getFirestore();

const APP_URL = 'https://tritonfischbart.github.io/Projekt-Koelle/';
const docs = async (name) => (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

// Nachrichten verschicken: nur an Personen, die diese Art eingeschaltet haben.
async function send(messages, { ignoreSettings = false } = {}) {
  if (!messages.length) return;
  const [tokens, settingsList] = await Promise.all([docs('pushTokens'), docs('pushSettings')]);
  const settings = Object.fromEntries(settingsList.map((s) => [s.id, s]));
  for (const msg of messages) {
    if (!ignoreSettings && !wants(settings, msg.person, msg.type)) {
      console.log(`PUSH ${msg.type} an ${msg.person}: in den Einstellungen ausgeschaltet`);
      continue;
    }
    const mine = tokens.filter((t) => t.person === msg.person).map((t) => t.id);
    if (!mine.length) {
      console.log(`PUSH ${msg.type} an ${msg.person}: kein Gerät eingeschaltet`);
      continue;
    }
    const result = await getMessaging().sendEachForMulticast({
      tokens: mine,
      notification: { title: msg.title, body: msg.body },
      webpush: {
        notification: { icon: `${APP_URL}icons/icon-192.png`, badge: `${APP_URL}icons/icon-192.png` },
        fcmOptions: { link: APP_URL },
      },
    });
    const codes = [...new Set(result.responses.map((r) => r.error?.code).filter(Boolean))];
    console.log(`PUSH ${msg.type} an ${msg.person}: ${mine.length} Gerät(e), ${result.successCount} angekommen, ${result.failureCount} Fehler${codes.length ? ` (${codes.join(', ')})` : ''}`);
    // Ungültige Handys (App gelöscht, Nachrichten ausgeschaltet) aufräumen
    await Promise.all(result.responses.map((r, i) => {
      const code = r.error?.code ?? '';
      return code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')
        ? db.collection('pushTokens').doc(mine[i]).delete()
        : null;
    }));
  }
}

export const pushInvite = onDocumentCreated('invites/{id}', (e) => send(inviteMessages(e.data.data())));
export const pushPoll = onDocumentCreated('polls/{id}', (e) => send(pollMessages(e.data.data())));
export const pushExpense = onDocumentCreated('expenses/{id}', (e) => send(expenseMessages(e.data.data())));

// Änderungen: bearbeitete Ausgaben, Notizen, Antworten, Abstimmungs-Ergebnis, Abwesenheiten
const beforeAfter = (e) => [e.data.before.exists ? e.data.before.data() : null, e.data.after.exists ? e.data.after.data() : null];
export const pushExpenseChange = onDocumentUpdated('expenses/{id}', (e) => send(expenseChangeMessages(...beforeAfter(e))));
export const pushNote = onDocumentWritten('notes/{id}', (e) => send(noteMessages(...beforeAfter(e))));
export const pushInviteAnswer = onDocumentUpdated('invites/{id}', (e) => send(inviteAnswerMessages(...beforeAfter(e))));
export const pushPollClosed = onDocumentUpdated('polls/{id}', (e) => send(pollClosedMessages(...beforeAfter(e))));
export const pushQuickNote = onDocumentCreated('quickNotes/{id}', (e) => send(quickNoteMessages(e.data.data())));
export const pushTrip = onDocumentWritten('shoppingTrips/{id}', (e) => send(tripMessages(...beforeAfter(e))));
export const pushAbsence = onDocumentCreated('absences/{id}', (e) => send(absenceMessages(e.data.data())));
export const pushAbsenceChange = onDocumentUpdated('absences/{id}', (e) => {
  const [before, after] = beforeAfter(e);
  return send(absenceMessages(after, before));
});

// "Test-Nachricht senden" aus der App
export const pushTest = onDocumentCreated('pushTests/{id}', async (e) => {
  const { person } = e.data.data();
  await send([{ person, type: 'test', title: '✅ Projekt Kölle', body: 'Benachrichtigungen funktionieren auf diesem Handy!' }], { ignoreSettings: true });
  await e.data.ref.delete();
});

// Ein stündlicher Lauf für alle Erinnerungen (ein Zeitplan-Job ist im Gratis-Kontingent)
export const pushHourly = onSchedule({ schedule: '0 * * * *', timeZone: 'Europe/Berlin' }, async () => {
  const now = new Date();
  for (const job of dueJobs(now)) {
    if (job === 'choreWeekStart' || job === 'choreReminder') {
      const [plan, absences, chores] = await Promise.all([
        db.collection('settings').doc('putzplan').get(), docs('absences'), docs('chores'),
      ]);
      const data = {
        areas: plan.data()?.areas,
        absences,
        chores: Object.fromEntries(chores.map((c) => [c.id, c])),
      };
      await send(job === 'choreWeekStart' ? choreWeekStartMessages(data, now) : choreReminderMessages(data, now));
    }
    if (job === 'calendar') {
      const cfg = (await db.collection('settings').doc('kalender').get()).data();
      if (!cfg?.calendarId || !cfg?.apiKey) {
        console.log('PUSH calendar: kein Kalender verbunden');
        continue;
      }
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
      // Der API-Schlüssel ist auf die Website beschränkt -> als Website ausweisen
      const res = await fetch(eventsUrl(cfg.calendarId, cfg.apiKey, from, to), { headers: { Referer: APP_URL } });
      if (!res.ok) {
        console.log(`PUSH calendar: Google antwortet mit Fehler ${res.status}`);
        continue;
      }
      const items = ((await res.json()).items ?? []).filter((i) => i.status !== 'cancelled').map(normalizeEvent);
      const today = groupByDay(items, now).find((g) => g.day.toDateString() === now.toDateString());
      console.log(`PUSH calendar: ${today?.events.length ?? 0} Termin(e) heute`);
      await send(calendarMessages(today?.events ?? []));
    }
    if (job === 'shopping') {
      const open = (await docs('shopping')).filter((i) => !i.doneBy);
      await send(shoppingMessages(open));
    }
  }
});
