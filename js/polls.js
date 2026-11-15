// Abstimmungen mit Datum („Pizza oder Sushi am Freitag?“): Nach dem Tag verschwinden sie von selbst.
// Das Datum ist freiwillig – Abstimmungen ohne Datum bleiben wie bisher, bis jemand sie beendet.

const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Datum aus dem Text raten: heute, morgen, übermorgen, Wochentag (nächster), 20.11. / 20.11.2026
export function guessDateFromText(text, now = new Date()) {
  const t = String(text ?? '').toLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/.exec(t);
  if (m) {
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear();
    let d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (!m[3] && d < today) d = new Date(year + 1, Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime()) && d.getDate() === Number(m[1])) return iso(d);
  }
  if (/\bübermorgen\b/.test(t)) return iso(addDays(today, 2));
  if (/\bmorgen\b/.test(t)) return iso(addDays(today, 1));
  if (/\bheute\b/.test(t)) return iso(today);
  for (let i = 0; i < 7; i += 1) {
    if (new RegExp(`\\b${WEEKDAYS[i]}`).test(t)) {
      const diff = (i - today.getDay() + 7) % 7;
      return iso(addDays(today, diff));
    }
  }
  if (/\bwochenende\b/.test(t)) return iso(addDays(today, (7 - today.getDay()) % 7)); // bis Sonntag
  return null;
}

// Ist der Tag vorbei? (Am Tag selbst bleibt die Abstimmung noch sichtbar.)
export const pollExpired = (poll, todayIso) => Boolean(poll.until) && poll.until < todayIso;

// "Fr, 20.11."
export function pollDay(isoDate) {
  const [y, mo, d] = isoDate.split('-').map(Number);
  return `${new Date(y, mo - 1, d).toLocaleDateString('de-DE', { weekday: 'short' })}, ${d}.${mo}.`;
}
