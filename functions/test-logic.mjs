// Nur zum Testen (wird nicht bereitgestellt): node functions/test-logic.mjs
process.env.TZ = 'Europe/Berlin';
import assert from 'node:assert';
import { wants, inviteMessages, pollMessages, expenseMessages, expenseChangeMessages, noteMessages, inviteAnswerMessages, pollClosedMessages, absenceMessages, tripMessages, choreWeekStartMessages, choreReminderMessages, calendarMessages, shoppingMessages, dueJobs, weekChores } from './logic.js';
import { mondayOf, weekKey } from './shared/chores.js';

// Einstellungen: Standard + eigene Wahl
assert.equal(wants({}, 'jana', 'invites'), true);
assert.equal(wants({}, 'jana', 'shopping'), false);
assert.equal(wants({ jana: { types: { invites: false } } }, 'jana', 'invites'), false);

// Wer hat Bock: alle außer Ersteller
const inv = inviteMessages({ createdBy: 'jana', emoji: '🍳', title: 'Ich koche – wer isst mit?', note: 'Bolo', at: null });
assert.deepEqual(inv.map(m => m.person), ['julian', 'lukas']);
assert.equal(inv[0].title, '🍳 Jana: Ich koche – wer isst mit?');
assert.equal(inv[0].body, 'jetzt · Bolo – bist du dabei?');

// Abstimmung
assert.deepEqual(pollMessages({ createdBy: 'lukas', question: 'Pizza?', options: ['Ja', 'Nein'] }).map(m => m.person), ['jana', 'julian']);

// Ausgabe: nur Betroffene, nicht der Eintragende; ungleich aufgeteilt; Daueraufträge still
const ex = expenseMessages({ createdBy: 'julian', paidBy: 'julian', description: 'Pizza', amountCents: 3000, splitAmong: ['jana', 'julian', 'lukas'], shares: { jana: 600, julian: 1200, lukas: 1200 } });
assert.deepEqual(ex.map(m => [m.person, m.body.replace(/\u00a0/g, ' ')]), [['jana', '30,00 € – dein Anteil 6,00 €'], ['lukas', '30,00 € – dein Anteil 12,00 €']]);
assert.equal(expenseMessages({ createdBy: 'lukas', paidBy: 'lukas', description: 'X', amountCents: 1000, splitAmong: ['lukas'] }).length, 0);
assert.equal(expenseMessages({ createdBy: 'auto', paidBy: 'lukas', description: 'Internet', amountCents: 3999, splitAmong: ['jana', 'julian', 'lukas'] }).length, 0);

// Änderungen an Ausgaben
const e0 = { createdBy: 'julian', paidBy: 'julian', description: 'Pizza', amountCents: 3000, splitAmong: ['jana', 'julian', 'lukas'], settlementId: null };
const e1 = { ...e0, amountCents: 3600, updatedBy: 'julian' };
const ch = expenseChangeMessages(e0, e1).map(m => [m.person, m.body.replace(/\u00a0/g, ' ')]);
assert.deepEqual(ch, [['jana', '36,00 € – dein Anteil jetzt 12,00 € (vorher 10,00 €)'], ['lukas', '36,00 € – dein Anteil jetzt 12,00 € (vorher 10,00 €)']]);
assert.equal(expenseChangeMessages(e0, { ...e0, settlementId: 's1' }).length, 0); // Abrechnung
assert.equal(expenseChangeMessages(e0, { ...e0, updatedBy: 'julian' }).length, 0); // nichts Wichtiges geändert
const out = expenseChangeMessages(e0, { ...e0, splitAmong: ['julian', 'lukas'], updatedBy: 'lukas' });
assert.deepEqual(out.map(m => m.person), ['jana', 'julian']); // Jul zahlt jetzt mehr
assert.ok(out[0].body.startsWith('Du bist nicht mehr dabei'));
// Notizen
assert.equal(noteMessages(null, { title: 'WLAN', text: 'Netz: X\nPW: Y', createdBy: 'jana' })[0].body, 'Jana: Netz: X · PW: Y');
assert.equal(noteMessages({ title: 'WLAN', text: 'a' }, { title: 'WLAN', text: 'a', order: 2, updatedBy: 'jana' }).length, 0);
assert.deepEqual(noteMessages({ title: 'WLAN', text: 'a' }, { title: 'WLAN', text: 'b', updatedBy: 'lukas' }).map(m => m.person), ['jana', 'julian']);
// Antworten bei Wer hat Bock?
const ia = inviteAnswerMessages({ createdBy: 'jana', title: 'Kochen', emoji: '🍳', responses: {} }, { createdBy: 'jana', title: 'Kochen', emoji: '🍳', responses: { lukas: 'yes', julian: null } });
assert.deepEqual(ia.map(m => [m.person, m.title]), [['jana', '🍳 Lukas ist dabei 👍']]);
// Abstimmung beendet
const pc = pollClosedMessages({ closed: false }, { closed: true, closedBy: 'lukas', createdBy: 'jana', question: 'Pizza?', options: ['Ja', 'Nein'], votes: { jana: 0, lukas: 0, julian: 1 } });
assert.deepEqual(pc.map(m => [m.person, m.body]), [['jana', 'Gewonnen: Ja · Ja 2, Nein 1'], ['julian', 'Gewonnen: Ja · Ja 2, Nein 1']]);
// Abwesenheit
const ab = absenceMessages({ person: 'jana', from: '2026-11-10', to: '2026-11-14', note: 'Hamburg', createdBy: 'jana' });
assert.deepEqual(ab.map(m => [m.person, m.title, m.body]), [['julian', '🌴 Jana ist vom 10.11. bis 14.11. weg', 'Hamburg'], ['lukas', '🌴 Jana ist vom 10.11. bis 14.11. weg', 'Hamburg']]);

const abc = absenceMessages({ person: 'jana', from: '2026-11-11', to: '2026-11-14', note: '', updatedBy: 'jana', createdBy: 'jana' }, { person: 'jana', from: '2026-11-10', to: '2026-11-14', note: '' });
assert.deepEqual(abc.map(m => [m.person, m.title]), [['julian', '🌴 Geändert: Jana ist vom 11.11. bis 14.11. weg'], ['lukas', '🌴 Geändert: Jana ist vom 11.11. bis 14.11. weg']]);
assert.equal(absenceMessages({ person: 'jana', from: 'a', to: 'b', note: '' }, { person: 'jana', from: 'a', to: 'b', note: '' }).length, 0);

// Putzplan: Montag 2.11.2026
const monday = new Date(2026, 10, 2, 9);
const start = choreWeekStartMessages({}, monday);
assert.equal(start.length, 3);
const week = weekChores({}, mondayOf(monday));
assert.ok(start.every(m => m.body.startsWith('Diese Woche bist du dran mit: ')));
// Sonntag: Erledigtes fällt raus, Tausch zählt
const key = weekKey(mondayOf(monday));
const done = week[0];
const swapped = week[1];
const chores = { [`${key}_${done.area.id}`]: { assignee: done.assignee, doneBy: done.assignee }, [`${key}_${swapped.area.id}`]: { assignee: 'lukas', doneBy: null } };
const sunday = new Date(2026, 10, 8, 18);
const rem = choreReminderMessages({ chores }, sunday);
assert.ok(!rem.some(m => m.body.includes(done.area.name) && m.person === done.assignee));
assert.ok(rem.some(m => m.person === 'lukas' && m.body.includes(swapped.area.name)));
// Abwesenheit: Jana die ganze Woche weg -> bekommt keine Aufgabe
const away = choreWeekStartMessages({ absences: [{ person: 'jana', from: '2026-11-02', to: '2026-11-08' }] }, monday);
assert.ok(!away.some(m => m.person === 'jana'));

// Kalender & Einkauf
assert.equal(calendarMessages([]).length, 0);
const cal = calendarMessages([{ title: 'WG-Abend', allDay: false, start: new Date(2026, 10, 2, 20) }, { title: 'Sperrmüll', allDay: true, start: new Date(2026, 10, 2) }]);
assert.equal(cal[0].body, 'WG-Abend (20:00), Sperrmüll');
assert.equal(shoppingMessages([{ name: 'Milch', amount: '2×' }, { name: 'Brot' }])[0].body, '2× Milch, Brot');

// Zeitplan
assert.deepEqual(dueJobs(new Date(2026, 10, 2, 9)), ['choreWeekStart']);
assert.deepEqual(dueJobs(new Date(2026, 10, 8, 18)), ['choreReminder']);
assert.deepEqual(dueJobs(new Date(2026, 10, 3, 8)), ['calendar']);
assert.deepEqual(dueJobs(new Date(2026, 10, 3, 19)), ['shopping']);
assert.deepEqual(dueJobs(new Date(2026, 10, 3, 12)), []);
// „Ich geh jetzt einkaufen“: an die anderen, nicht bei „Bin zurück“ oder gleichem Start
const trip = { person: 'lukas', at: '2026-11-25T14:00:00.000Z' };
const tm = tripMessages(null, trip);
assert.deepEqual(tm.map((m) => m.person), ['jana', 'julian']);
assert.equal(tm[0].type, 'trips');
assert.equal(tm[0].title, '🏃 Lukas geht jetzt einkaufen');
assert.equal(tripMessages(trip, null).length, 0);
assert.equal(tripMessages(trip, { ...trip }).length, 0);
assert.equal(tripMessages(trip, { ...trip, at: '2026-11-26T10:00:00.000Z' }).length, 2);
assert.equal(wants({}, 'jana', 'trips'), true);

console.log('OK', start.map(m => `${m.person}: ${m.body}`));
