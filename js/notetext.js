// Schwarzes Brett: Aufzählungen im Notiztext erkennen und hübsch anzeigen.
// "- Milch", "• Milch", "* Milch", "– Milch" -> Punkte; "1. Milch" oder "1) Milch" -> Nummern.

const BULLET = /^\s*([-•*–])\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})([.)])\s+(.*)$/;

// Liefert HTML. `esc` schützt vor HTML-Einschleusung (Text kommt aus der Datenbank).
export function noteTextHtml(text, esc) {
  const out = [];
  let list = null; // { tag: 'ul' | 'ol', start, items: [] }
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(esc).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const start = list.tag === 'ol' && list.start !== 1 ? ` start="${list.start}"` : '';
      out.push(`<${list.tag}${start}>${list.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${list.tag}>`);
    }
    list = null;
  };
  for (const line of String(text ?? '').split('\n')) {
    const b = BULLET.exec(line);
    const n = b ? null : NUMBER.exec(line);
    if (b || n) {
      flushPara();
      const tag = b ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, start: n ? Number(n[1]) : 1, items: [] }; }
      list.items.push(b ? b[2] : n[3]);
    } else if (!line.trim()) {
      flushList(); flushPara();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushList(); flushPara();
  return out.join('');
}

// Beim Tippen: Enter in einer Listenzeile setzt den nächsten Punkt / die nächste Nummer.
// Enter in einer leeren Listenzeile beendet die Liste. Gibt den Ersatz zurück oder null.
export function continueList(value, cursor) {
  const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
  const line = value.slice(lineStart, cursor);
  const b = /^(\s*)([-•*–])(?:\s+(.*))?$/.exec(line);
  const n = b ? null : /^(\s*)(\d{1,3})([.)])(?:\s+(.*))?$/.exec(line);
  if (!b && !n) return null;
  const content = b ? b[3] : n[4];
  if (content === undefined) return null; // nur "-" ohne Leerzeichen: normale neue Zeile
  if (!content.trim()) {
    // Leerer Punkt -> Liste beenden: Markierung entfernen
    return { from: lineStart, to: cursor, insert: '' };
  }
  const next = b ? `${b[1]}${b[2]} ` : `${n[1]}${Number(n[2]) + 1}${n[3]} `;
  return { from: cursor, to: cursor, insert: `\n${next}` };
}
