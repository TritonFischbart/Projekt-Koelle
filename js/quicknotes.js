// „Kurz notiert“ auf der Startseite: kurze Zettel wie am Kühlschrank.
// Sie verschwinden nach 7 Tagen von selbst aus der Anzeige.

export const QUICK_NOTE_DAYS = 7;
export const QUICK_NOTE_MAX = 200;

export function visibleQuickNotes(notes, toMillis, now = Date.now()) {
  return notes
    .filter((n) => now - toMillis(n.createdAt) < QUICK_NOTE_DAYS * 86400000)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

// "gerade eben", "vor 5 Min.", "vor 3 Std.", "gestern", "Mo"
export function agoText(millis, now = Date.now()) {
  const min = Math.floor((now - millis) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const d = new Date(millis);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (d >= today) return `vor ${Math.floor(min / 60)} Std.`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d >= yesterday) return 'gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
}
