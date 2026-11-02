// Prüft den Stand der Push-Nachrichten (läuft über GitHub: "Push-Nachrichten prüfen").
// Gibt KEINE geheimen Daten aus: keine Geräte-Adressen, keine E-Mails, keine Inhalte.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'projekt-koelle' });
const db = getFirestore();

const deviceType = (ua = '') => (/iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android'
  : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'anderes Gerät');
const when = (ts) => (ts?.toDate ? ts.toDate().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : '?');

const [tokens, settings, tests] = await Promise.all([
  db.collection('pushTokens').get(), db.collection('pushSettings').get(), db.collection('pushTests').get(),
]);

console.log('=== Eingeschaltete Geräte ===');
for (const person of ['jana', 'julian', 'lukas']) {
  const mine = tokens.docs.filter((d) => d.data().person === person);
  console.log(`${person}: ${mine.length} Gerät(e)${mine.length ? ' – ' : ''}${mine.map((d) => `${deviceType(d.data().device)} (seit ${when(d.data().createdAt)})`).join(', ')}`);
}
const unknown = tokens.docs.filter((d) => !['jana', 'julian', 'lukas'].includes(d.data().person)).length;
if (unknown) console.log(`ohne Person: ${unknown}`);

console.log('\n=== Gewählte Nachrichtenarten (nur geänderte) ===');
for (const d of settings.docs) console.log(`${d.id}: ${JSON.stringify(d.data().types ?? {})}`);

console.log(`\n=== Liegengebliebene Test-Nachrichten: ${tests.size} (sollte 0 sein) ===`);
for (const d of tests.docs) console.log(`${d.data().person} – ${when(d.data().createdAt)}`);
process.exit(0);
