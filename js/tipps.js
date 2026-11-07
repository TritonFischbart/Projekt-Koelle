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
