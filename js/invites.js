// "Wer hat Bock?": spontane Aktionen (Kochen, Film, Bouldern …).
// Eine Aktion verschwindet von selbst, wenn sie vorbei ist.

export const INVITE_TEMPLATES = [
  { emoji: '🍳', title: 'Ich koche – wer isst mit?', kind: 'food' },
  { emoji: '🎬', title: 'Film schauen', kind: 'other' },
  { emoji: '🧗', title: 'Bouldern', kind: 'other' },
  { emoji: '🍻', title: 'Kneipe / Bier', kind: 'other' },
  { emoji: '🏃', title: 'Sport', kind: 'other' },
  { emoji: '🎲', title: 'Spieleabend', kind: 'other' },
];

// Passendes Symbol zum Text raten ("Pizza backen" -> 🍕). Das Stichwort, das im Text
// am weitesten vorne steht, gewinnt (bei Gleichstand das längere).
const INVITE_ICONS = [
  ['pizza', '🍕'], ['burger', '🍔'], ['döner', '🥙'], ['sushi', '🍣'], ['pasta', '🍝'], ['nudel', '🍝'],
  ['suppe', '🍲'], ['curry', '🍛'], ['taco', '🌮'], ['raclette', '🧀'], ['fondue', '🧀'],
  ['grill', '🍖'], ['frühstück', '🥐'], ['brunch', '🥞'], ['waffel', '🧇'], ['pfannkuchen', '🥞'],
  ['kuchen', '🍰'], ['backen', '🧁'], ['plätzchen', '🍪'], ['kekse', '🍪'],
  ['koch', '🍳'], ['essen', '🍽️'], ['abendbrot', '🍽️'], ['eis essen', '🍦'], ['eisdiele', '🍦'],
  ['kaffee', '☕'], ['tee', '🍵'],
  ['glühwein', '🍷'], ['wein', '🍷'], ['cocktail', '🍹'], ['kölsch', '🍻'], ['bier', '🍻'],
  ['kneipe', '🍻'], ['brauhaus', '🍻'], ['bar', '🍸'], ['party', '🎉'], ['feiern', '🎉'],
  ['geburtstag', '🎂'], ['karneval', '🎭'], ['kostüm', '🎭'], ['club', '💃'], ['tanzen', '💃'],
  ['film', '🎬'], ['kino', '🎬'], ['serie', '📺'], ['netflix', '📺'], ['tatort', '📺'],
  ['zocken', '🎮'], ['playstation', '🎮'], ['switch', '🎮'], ['konsole', '🎮'],
  ['spieleabend', '🎲'], ['brettspiel', '🎲'], ['spiel', '🎲'], ['karten', '🃏'], ['quiz', '🧠'],
  ['puzzle', '🧩'], ['kicker', '⚽'], ['billard', '🎱'], ['bowling', '🎳'], ['dart', '🎯'],
  ['boulder', '🧗'], ['klettern', '🧗'], ['sport', '🏃'], ['joggen', '🏃'], ['laufen', '🏃'],
  ['fitness', '💪'], ['gym', '💪'], ['yoga', '🧘'], ['schwimm', '🏊'], ['sauna', '🧖'],
  ['fahrrad', '🚲'], ['radtour', '🚲'], ['fußball', '⚽'], ['fussball', '⚽'], ['stadion', '⚽'],
  ['fc köln', '⚽'], ['tennis', '🎾'], ['volleyball', '🏐'], ['basketball', '🏀'],
  ['spazier', '🚶'], ['wandern', '🥾'], ['picknick', '🧺'], ['rhein', '🌊'], ['see', '🌊'],
  ['konzert', '🎵'], ['musik', '🎵'], ['museum', '🖼️'], ['zoo', '🦁'], ['flohmarkt', '🛍️'],
  ['shoppen', '🛍️'], ['einkauf', '🛒'], ['putzen', '🧹'], ['aufräumen', '🧹'], ['lernen', '📚'],
  ['weihnacht', '🎄'], ['silvester', '🎆'], ['ostern', '🐣'],
];

export function guessInviteEmoji(title) {
  const text = String(title ?? '').toLowerCase();
  let best = null;
  for (const [word, icon] of INVITE_ICONS) {
    // Stichwort muss am Wortanfang stehen ("see" nicht in "Kaffeesee…", "bar" nicht in "wunderbar")
    const re = new RegExp(`(^|[^a-zäöüß])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    const m = re.exec(text);
    if (!m) continue;
    const at = m.index + m[1].length;
    if (!best || at < best.at || (at === best.at && word.length > best.length)) best = { at, length: word.length, icon };
  }
  return best?.icon ?? null;
}

const HOUR = 3600000;

// Bis wann wird die Aktion angezeigt?
// Mit Uhrzeit: 4 Stunden danach. "Jetzt": 6 Stunden nach dem Erstellen.
// Nie über Mitternacht des Tages hinaus, an dem sie stattfindet (+ 3 Std. für lange Abende).
export function inviteEndsAt(invite, createdMillis) {
  if (invite.at) {
    const at = Date.parse(invite.at);
    return at + 4 * HOUR;
  }
  const created = createdMillis || Date.now();
  const midnight = new Date(created);
  midnight.setHours(24, 0, 0, 0);
  return Math.min(created + 6 * HOUR, midnight.getTime() + 3 * HOUR);
}

export const isInviteActive = (invite, createdMillis, now = Date.now()) => now < inviteEndsAt(invite, createdMillis);

// "jetzt", "heute 19:30", "morgen 18:00", "Sa., 19:30"
export function inviteWhen(invite, now = new Date()) {
  if (!invite.at) return 'jetzt';
  const at = new Date(invite.at);
  const time = at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return `heute ${time}`;
  if (diff === 1) return `morgen ${time}`;
  return `${at.toLocaleDateString('de-DE', { weekday: 'short' })} ${time}`;
}
