// „Diese Woche in Ehrenfeld“: Tipps für Events, Veranstaltungen und Märkte.
// Die Datei data/wochentipps.json wird jede Woche von einer automatischen Claude-Runde
// neu recherchiert (siehe CLAUDE.md, Abschnitt „Wochentipps“).

export async function loadTips() {
  const response = await fetch(`data/wochentipps.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Tipps nicht gefunden (${response.status})`);
  return response.json();
}

// Nur Tipps ab heute, nach Datum sortiert
export function upcomingTips(data, todayIso) {
  return (data?.tips ?? [])
    .filter((t) => (t.dateTo ?? t.date) >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// "Mi, 11.11." (+ " – Do, 12.11.")
export function tipDay(tip, todayIso) {
  const fmt = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${date.toLocaleDateString('de-DE', { weekday: 'short' })}, ${d}.${m}.`;
  };
  const start = tip.date === todayIso ? 'Heute' : fmt(tip.date);
  return tip.dateTo && tip.dateTo !== tip.date ? `${start} – ${fmt(tip.dateTo)}` : start;
}

// ---------- Suche ----------
// Wörter, die zusammengehören: Wer „Band“ sucht, findet auch Konzerte usw.
const SYNONYMS = [
  ['flohmarkt', 'flohmärkte', 'trödel', 'second hand', 'secondhand', 'basar'],
  ['konzert', 'band', 'live', 'musik', 'auftritt', 'gig', 'singalong', 'chor'],
  ['party', 'feiern', 'tanzen', 'dj', 'disco', 'karneval', '11.11', 'sessionsauftakt'],
  ['theater', 'bühne', 'kabarett', 'comedy', 'show', 'lesung', 'stück', 'improtheater'],
  ['markt', 'wochenmarkt', 'markthalle', 'gemüse', 'obst'],
  ['kinder', 'familie', 'familien', 'kids', 'baby'],
  ['kostenlos', 'eintritt frei', 'gratis', 'umsonst', 'freier eintritt'],
  ['ausstellung', 'kunst', 'galerie', 'museum', 'street art'],
  ['fest', 'veedel', 'viertel', 'straßenfest', 'nachbarschaft', 'feier'],
];

export const TIP_FILTERS = [
  { label: '🧺 Flohmarkt', q: 'flohmarkt' },
  { label: '🎸 Konzert', q: 'konzert' },
  { label: '🎉 Party', q: 'party' },
  { label: '🎭 Theater', q: 'theater' },
  { label: '🥕 Markt', q: 'markt' },
  { label: '🧸 Familie', q: 'kinder' },
  { label: '🆓 Kostenlos', q: 'kostenlos' },
];

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFC');

// Jedes Suchwort muss passen (direkt oder über ein verwandtes Wort).
export function searchTips(tips, query) {
  const words = norm(query).split(/[\s,]+/).filter(Boolean);
  if (!words.length) return tips;
  return tips.filter((t) => {
    const hay = norm([t.title, t.text, t.place, t.time, ...(t.tags ?? [])].join(' '));
    return words.every((w) => {
      if (hay.includes(w)) return true;
      if (w.length < 3) return false;
      const group = SYNONYMS.find((g) => g.some((s) => s.startsWith(w) || w.startsWith(s)));
      return Boolean(group?.some((s) => hay.includes(s)));
    });
  });
}
