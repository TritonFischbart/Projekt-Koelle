// Die WG-Mitglieder und die Kategorien für Ausgaben.
// Hier kannst du Namen, Farben oder Kategorien ändern.

export const PEOPLE = [
  { id: 'jana', name: 'Jana', color: '#a97b50' },
  { id: 'julian', name: 'Jul', color: '#2b6cb0' },
  { id: 'lukas', name: 'Lukas', color: '#2f7d4f' },
];

export const CATEGORIES = [
  { id: 'lebensmittel', name: 'Lebensmittel', icon: '🛒' },
  { id: 'haushalt', name: 'Haushalt', icon: '🧽' },
  { id: 'nebenkosten', name: 'Internet & Strom', icon: '💡' },
  { id: 'freizeit', name: 'Freizeit', icon: '🎉' },
  { id: 'sonstiges', name: 'Sonstiges', icon: '📦' },
];

// Die Bereiche im Putzplan. Jede Woche rücken sie eine Person weiter.
export const CHORES = [
  { id: 'bad', name: 'Bad', icon: '🛁', details: 'Toilette, Waschbecken, Dusche, Spiegel' },
  { id: 'kueche', name: 'Küche', icon: '🍳', details: 'Arbeitsflächen, Herd, Spüle, Kühlschrank checken' },
  { id: 'boeden', name: 'Böden & Müll', icon: '🧹', details: 'Saugen & Wischen in Flur und Gemeinschaftsräumen, Müll & Altglas raus' },
];

// Arten von Push-Nachrichten. Jede Person kann jede einzeln ein- und ausschalten.
// Wird auch vom Versand-Dienst (functions/) benutzt – Kennungen (id) nicht ändern.
export const PUSH_TYPES = [
  { id: 'invites', icon: '🙋', label: 'Wer hat Bock?', hint: 'Wenn jemand etwas vorhat – und wer bei deiner Aktion dabei ist', default: true },
  { id: 'polls', icon: '🗳️', label: 'Abstimmungen', hint: 'Neue Frage und das Ergebnis', default: true },
  { id: 'expenses', icon: '💶', label: 'Ausgaben', hint: 'Neu oder geändert – nur wenn sie dich betrifft, mit deinem Anteil', default: true },
  { id: 'notes', icon: '📌', label: 'Schwarzes Brett', hint: 'Neue oder geänderte Notizen und neue Zettel bei „Kurz notiert“', default: true },
  { id: 'absences', icon: '🌴', label: 'Wer ist weg?', hint: 'Wenn jemand Urlaub oder Abwesenheit einträgt', default: true },
  { id: 'chores', icon: '🧹', label: 'Putzplan', hint: 'Montags deine Aufgabe, sonntags 18 Uhr falls noch offen', default: true },
  { id: 'calendar', icon: '📅', label: 'Termine heute', hint: 'Morgens um 8 Uhr, wenn etwas ansteht', default: true },
  { id: 'trips', icon: '🏃', label: 'Ich geh einkaufen', hint: 'Wenn jemand gleich einkaufen geht – dann kannst du schnell noch was auf die Liste setzen', default: true },
  { id: 'shopping', icon: '🛒', label: 'Einkaufsliste', hint: 'Abends um 19 Uhr, was noch fehlt', default: false },
];
