// Kleines Geheimnis: Tipp auf „Projekt Kölle“ oben zeigt die Kölsche Weisheit des Tages.
// Zuerst die 11 Artikel des „Kölschen Grundgesetzes“, danach weitere Sprüche.

export const WEISHEITEN = [
  { koelsch: 'Et es wie et es.', deutsch: 'Es ist, wie es ist. Sieh den Tatsachen ins Auge.', quelle: 'Kölsches Grundgesetz, § 1' },
  { koelsch: 'Et kütt wie et kütt.', deutsch: 'Es kommt, wie es kommt. Hab keine Angst vor der Zukunft.', quelle: 'Kölsches Grundgesetz, § 2' },
  { koelsch: 'Et hätt noch immer jot jejange.', deutsch: 'Es ist bisher noch immer gut gegangen.', quelle: 'Kölsches Grundgesetz, § 3' },
  { koelsch: 'Wat fott es, es fott.', deutsch: 'Was weg ist, ist weg. Jammer den Dingen nicht nach.', quelle: 'Kölsches Grundgesetz, § 4' },
  { koelsch: 'Et bliev nix wie et wor.', deutsch: 'Nichts bleibt, wie es war. Sei offen für Neues.', quelle: 'Kölsches Grundgesetz, § 5' },
  { koelsch: 'Kenne mer nit, bruche mer nit, fott domet.', deutsch: 'Kennen wir nicht, brauchen wir nicht, weg damit.', quelle: 'Kölsches Grundgesetz, § 6' },
  { koelsch: 'Wat wellste maache?', deutsch: 'Was willst du machen? Füge dich in dein Schicksal.', quelle: 'Kölsches Grundgesetz, § 7' },
  { koelsch: 'Maach et jot, ävver nit ze off.', deutsch: 'Mach es gut, aber nicht zu oft. Qualität vor Quantität.', quelle: 'Kölsches Grundgesetz, § 8' },
  { koelsch: 'Wat soll dä Quatsch?', deutsch: 'Was soll der Unsinn? Stell immer die Universalfrage.', quelle: 'Kölsches Grundgesetz, § 9' },
  { koelsch: 'Drinks de ejne met?', deutsch: 'Trinkst du einen mit? Komm dem Gebot der Gastfreundschaft nach.', quelle: 'Kölsches Grundgesetz, § 10' },
  { koelsch: 'Do laachs de dich kapott.', deutsch: 'Da lachst du dich kaputt. Bewahre dir eine gesunde Einstellung zum Humor.', quelle: 'Kölsches Grundgesetz, § 11' },
  { koelsch: 'Jeder Jeck es anders.', deutsch: 'Jeder Narr ist anders – jeder darf so sein, wie er ist.', quelle: 'Kölsche Weisheit' },
  { koelsch: 'Levve un levve losse.', deutsch: 'Leben und leben lassen.', quelle: 'Kölsche Weisheit' },
  { koelsch: 'Mer muss och jönne künne.', deutsch: 'Man muss auch gönnen können.', quelle: 'Kölsche Weisheit' },
  { koelsch: 'Wat der Buur nit kennt, dat frisst hä nit.', deutsch: 'Was der Bauer nicht kennt, das isst er nicht.', quelle: 'Kölsche Weisheit' },
  { koelsch: 'Mer losse d’r Dom en Kölle.', deutsch: 'Wir lassen den Dom in Köln – alles bleibt, wo es hingehört.', quelle: 'Kölsches Lied (Bläck Fööss)' },
  { koelsch: 'Drink doch eine met.', deutsch: 'Trink doch einen mit – keiner bleibt allein an der Theke.', quelle: 'Kölsches Lied (Bläck Fööss)' },
  { koelsch: 'Mer stonn zo dir, FC Kölle.', deutsch: 'Wir stehen zu dir, FC Köln.', quelle: 'Vereinshymne des 1. FC Köln' },
  { koelsch: 'En unserem Veedel.', deutsch: 'In unserem Viertel – da hält man zusammen.', quelle: 'Kölsches Lied (Bläck Fööss)' },
  { koelsch: 'Kölle es e Jeföhl.', deutsch: 'Köln ist ein Gefühl.', quelle: 'Kölsche Weisheit' },
  { koelsch: 'Et jitt kei Wood, dat sare künnt, wat ich föhl.', deutsch: 'Es gibt kein Wort, das sagen könnte, was ich fühle.', quelle: 'Kölsches Lied (Cat Ballou)' },
];

// Jeden Tag eine andere – für alle in der WG dieselbe.
export function weisheitDesTages(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
  return WEISHEITEN[(day + date.getFullYear()) % WEISHEITEN.length];
}
