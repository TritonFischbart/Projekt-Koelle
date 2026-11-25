# CLAUDE.md – Projekt Kölle

Notizen für zukünftige Claude-Sitzungen. Hier steht alles Wichtige, was in
früheren Gesprächen besprochen und entschieden wurde.

> ⚠️ Dieses Repository ist **öffentlich**. Hier niemals E-Mail-Adressen,
> Kalender-IDs, API-Schlüssel oder andere private Daten eintragen.

---

## Wer und was

- WG-Website für die Dreier-WG in **Köln**: **Jana, Jul und Lukas**.
- Auftraggeber ist **Lukas** (GitHub-Konto `TritonFischbart`). „Triton“ war ein
  früherer Platzhalter-Name – in der App heißt er **Lukas**.
- **Jul** heißt intern weiterhin `julian` (die ID bleibt, damit alte Daten passen).
- **Es wird keine neuen Mitbewohner geben** – eine Funktion zum Wechseln von Personen
  ist ausdrücklich nicht gewünscht.
- Live: **https://tritonfischbart.github.io/Projekt-Koelle/**
- GitHub-Projekt heißt **`Projekt-Koelle`** (GitHub erlaubt keine Umlaute; vorher stand dort
  automatisch `Projekt-K-lle`). Umbenannt am 1. Nov. 2026. Dadurch hat sich die
  Website-Adresse geändert – falls jemand noch die alte Adresse nutzt: App-Symbol löschen
  und neu anlegen. GitHub leitet den alten Projektnamen für Git und API weiter.
- Demo mit Beispieldaten (ohne Login, speichert nichts): an die Adresse `?demo` anhängen.

## Wie mit Lukas arbeiten

- **Immer auf Deutsch**, einfach und ohne Fachchinesisch erklären. Lukas ist
  Anfänger und kann nicht programmieren.
- Fachbegriffe kurz erklären (z. B. „Pull Request = Anfrage, die Änderungen zu übernehmen“).
- **Nach jeder fertigen und getesteten Änderung eine Pull Request nach `main`
  erstellen und sie selbst mergen** (Lukas hat das ausdrücklich so gewünscht).
  Danach den Link schicken und kurz sagen, dass es in ein paar Minuten online ist.
- Vor dem Weiterarbeiten prüfen, ob die letzte Pull Request schon gemergt ist.
  Wenn ja: Arbeitszweig neu von `main` starten. Wenn sie noch offen ist:
  weitere Commits auf denselben Zweig (die PR aktualisiert sich).
- Nach dem Merge dauert es ein paar Minuten, bis die Seite aktualisiert ist
  (GitHub-Pages-Cache). Tipp für Lukas: kurz warten oder privaten Tab nutzen.
- Lukas soll Dateien **nicht direkt auf GitHub bearbeiten**, während Claude
  arbeitet (gab schon mal einen README-Konflikt).
- Lukas schickt gern Screenshots, wenn er bei Google/Firebase-Einstellungen hängt.
  Die Oberflächen dort sind teils Englisch, teils Deutsch → beide Begriffe nennen.

## Technik

- **Reine statische Website**: HTML, CSS, JavaScript (ES-Module), **kein Build-Schritt**,
  keine Frameworks, kein npm. Ausnahme: der Versand-Dienst für Push-Nachrichten in `functions/`
  (Node 22, Firebase Cloud Functions v2, npm nur dort; Node 20 wird von Google abgeschaltet).
- **Hosting:** GitHub Pages aus `main`, Ordner `/ (root)`. Datei `.nojekyll` vorhanden.
- **Datenbank & Login:** Firebase, Projekt-ID `projekt-koelle`. Tarif **„Blaze“** (seit Nov. 2026,
  für Push-Nachrichten; Kreditkarte hinterlegt, Budget-Warnung 1 €, Kosten praktisch 0 €).
  - Firestore, Standort `europe-west3` (Frankfurt), Produktionsmodus.
  - Anmeldung: Google (Popup, bei Bedarf Redirect). Autorisierte Domain:
    `tritonfischbart.github.io`.
  - **Sicherheitsregeln:** Nur die drei WG-E-Mail-Adressen dürfen lesen/schreiben.
    Die echten Adressen stehen **nur in der Firebase-Konsole**; `firestore.rules`
    im Repo ist eine Vorlage mit Platzhaltern. Lukas' Google-Konto nutzt eine
    AOL-Adresse (funktioniert).
  - Firebase-SDK per CDN: `https://www.gstatic.com/firebasejs/10.12.2/…`
  - Die Firebase-Konfiguration in `js/firebase-config.js` ist nicht geheim.
- **Google Kalender:** gemeinsamer Kalender „WG Kölle“ (öffentlich freigegeben,
  mit Jana und Jul geteilt). Termine werden per Google Calendar API (API-Schlüssel,
  beschränkt auf `https://tritonfischbart.github.io/*` und die Calendar API) abgeholt.
  **Kalender-ID und API-Schlüssel stehen nur in Firestore** (`settings/kalender`),
  eingetragen über die App („Kalender verbinden“).

### Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst, Tabs, Dialoge (Ausgabe, Putz-Bereiche, Kalender, Einkaufs-Kategorie) |
| `css/style.css` | Design (rot-weiß, hell/dunkel, Handy & iPad) |
| `js/app.js` | Hauptprogramm: Anmeldung, Anzeige, Bedienung aller Bereiche |
| `js/config.js` | Personen (Reihenfolge/Farben), Ausgaben-Kategorien, Standard-Putzbereiche |
| `js/money.js` | Geld in Cent, Aufteilen, Kontostände, Ausgleichs-Vorschlag |
| `js/chores.js` | Putzplan: Wochen (ISO-KW, ab Montag), Häufigkeit, gerechte Verteilung, Symbole |
| `js/calendar.js` | Google-Termine abholen und nach Tagen gruppieren |
| `js/shopcats.js` | Einkaufs-Kategorien (Supermarkt-Reihenfolge) + automatische Zuordnung |
| `js/recurring.js` | Daueraufträge: welche Monate fällig sind |
| `js/stats.js` | Monatsübersicht der Ausgaben |
| `js/export.js` | Datensicherung (JSON) und Ausgaben-Tabelle (CSV für Excel) |
| `js/absences.js` | Urlaubs-Modus: wer wann weg ist |
| `js/images.js` | Bilder fürs Schwarze Brett auf dem Handy verkleinern |
| `js/invites.js` | „Wer hat Bock?“: Vorlagen, wann eine Aktion abläuft, Zeitangabe, Symbol raten |
| `js/notetext.js` | Schwarzes Brett: Aufzählungen erkennen/anzeigen, Liste beim Tippen fortsetzen |
| `js/tipps.js`, `data/wochentipps.json` | Wochentipps „Diese Woche in Ehrenfeld“ (Startseite) |
| `js/koelsch.js` | Geheimnis: Kölsche Weisheit des Tages (Tipp auf „Projekt Kölle“) |
| `js/firebase.js` | Firebase-Anbindung (Backend), inkl. Push ein/aus |
| `firebase-messaging-sw.js` | Service Worker: zeigt Push-Nachrichten, wenn die App zu ist (Firebase-Werte doppelt eingetragen) |
| `functions/index.js` | Versand-Dienst: Auslöser (neue Aktion/Abstimmung/Ausgabe, Test) + stündlicher Lauf |
| `functions/logic.js` | Wer bekommt welche Nachricht, Texte (testbar: `node functions/test-logic.mjs`) |
| `functions/shared/` | Wird beim Bereitstellen aus `js/` kopiert (chores, absences, money, calendar, config) – nicht einchecken |
| `.github/workflows/deploy-functions.yml` | Stellt `functions/` bei Firebase bereit (braucht Secret `FIREBASE_SERVICE_ACCOUNT`) |
| `firebase.json`, `.firebaserc` | Firebase-Projekt-Einstellungen für die Bereitstellung |
| `js/demo.js` | Demo-Backend mit Beispieldaten (`?demo`) |
| `manifest.webmanifest`, `icons/` | App-Symbol (Ehrenfelder Wappen in Rot-Weiß) für den Home-Bildschirm |
| `ANLEITUNG.md` | Einrichtungs-Anleitung für Lukas (Firebase, Pages, Kalender) |

### Wichtige Regeln im Code

- **Versionsnummer `?v=N`**: Bei jeder Änderung an CSS/JS die Nummer überall
  erhöhen (in `index.html`, allen Imports in `js/app.js` und `js/demo.js`),
  sonst laden Handys alte Dateien. Aktuell: siehe `index.html`.
  Die Nummer wird unten unter „Infos“ angezeigt („Version N“) – so kann Lukas prüfen,
  ob sein Handy schon die neue Version hat.
- Beide Backends (`firebase.js`, `demo.js`) haben dieselben Funktionen:
  `onUser, login, logout, watch, add, update, remove, set, settleAll, now`
  (Demo zusätzlich `demoEvents`). Neue Funktionen in beiden ergänzen.
- Text-Knöpfe (`.link-btn`, z. B. „＋ Neu“, „Bearbeiten“) haben ein unsichtbares Polster (Padding + gleich
  großer negativer Rand), damit die Tippfläche ~41 px hoch ist, ohne dass sich das Aussehen ändert. Eigene
  `margin`-Regeln für einzelne Text-Knöpfe deshalb um 11 px (oben/unten) bzw. 8 px (seitlich) verringern
  (Operator, 16. Nov. 2026).
- Kleine runde Symbol-Knöpfe (`.icon-btn.small`, z. B. ✕ und Kategorie-Symbol im Einkauf, ✕ bei „Wer ist weg?“)
  sind sichtbar 30 px groß, haben aber per `::after` eine unsichtbar größere Tippfläche (ca. 36 × 42 px).
  Dafür braucht der Knopf `position: relative` (Operator, 21. Nov. 2026).
- Termine auf der Startseite (`.start-event`) haben dasselbe unsichtbare Polster (9 px innen, −6 px Rand).
  Einklappbare Überschriften in Karten sind `display: inline`, damit der Pfeil bei Umbruch direkt hinter dem Wort steht.
- Texte aus der Datenbank immer mit `esc()` ausgeben (Schutz vor HTML-Einschleusung).
- Formulare liegen als `<dialog>` statisch in `index.html` – nicht in Bereiche
  rendern, die bei jeder Datenänderung neu gezeichnet werden (sonst gehen Eingaben verloren).

### Firestore-Sammlungen

| Sammlung | Inhalt |
|---|---|
| `members/{jana,julian,lukas}` | Wer welcher Person zugeordnet ist (`uid`, `email`) – beim ersten Login „Wer bist du?“ |
| `expenses` | Ausgaben: `description, amountCents, paidBy, splitAmong[], category, date, settlementId`, optional `shares {person: cent}` und `items [{name, cents, for[]}]` |
| `payments` | Abgehakte Überweisungen: `from, to, amountCents, date, settlementId` |
| `settlements` | Abrechnungen („Alles ausgeglichen“): `expenseCount, totalCents, createdAt` |
| `chores/{KW}_{bereich}` | Putzplan-Status pro Woche: `assignee, doneBy, doneAt` |
| `settings/putzplan` | In der App bearbeitete Putzbereiche (`areas[]`: `id, name, icon, details, every`) |
| `settings/kalender` | `calendarId`, `apiKey` |
| `shopping` | Einkaufsliste: `name, category, addedBy, doneBy, doneAt` |
| `favorites/{name}` | Wie oft etwas gekauft wurde + gemerkte Kategorie (Schnellauswahl) |
| `recurring` | Daueraufträge: `description, amountCents, paidBy, splitAmong, category, dayOfMonth (1–28), lastBooked ("2026-11")` |
| `notes` | Schwarzes Brett: `title, text, pinned, order, createdBy, updatedBy` (ID wird in der App erzeugt) |
| `noteImages` | Bilder zu Notizen: `noteId, data` (JPEG als Data-URL, max. ~0,9 MB), `width, height` |
| `settings/backup` | Wann zuletzt gesichert wurde (`at`, `by`) |
| `settings/einkauf` | Eigene Reihenfolge der Einkaufs-Kategorien (`order[]`) |
| `absences` | Abwesenheiten: `person, from, to ("2026-11-10"), note, createdBy, updatedBy` |
| `invites` | „Wer hat Bock?“: `emoji, title, note, at (ISO oder null = jetzt), kind (food/other), responses {person: yes/no}` |
| `shoppingTrips/{person}` | „Ich geh jetzt einkaufen“: `person, at` (ISO-Zeit); gilt 2 Std., „Bin zurück“ löscht |
| `pushTokens/{token}` | Ein Gerät, das Nachrichten bekommt: `person, device` (ungültige räumt der Dienst auf) |
| `pushSettings/{person}` | Welche Nachrichtenarten eine Person will: `types {invites, polls, expenses, notes, absences, chores, calendar, trips, shopping}` |
| `pushTests` | „Test-Nachricht senden“ – der Dienst schickt sie und löscht den Eintrag |
| `polls` | Abstimmungen: `question, options[], until?, votes {person: index}, closed, closedAt, closedBy` (Stimme per `votes.{person}` speichern) |

Ausgaben aus Daueraufträgen haben die feste ID `rec_{auftrag}_{monat}` und das Feld
`recurringId` – so wird auch bei zwei gleichzeitig geöffneten Handys nichts doppelt gebucht.
Einkäufe, die schon als Ausgabe eingetragen wurden, haben `expensed: true`.

## Funktionen und Entscheidungen

### Allgemein
- Name **„Projekt Kölle“**, Logo (seit 4. Nov. 2026, Wunsch von Lukas nach einem Foto des Mosaiks in
  Ehrenfeld): **Ehrenfelder Wappen** – Schild mit Dreiturm-Krone und Zahnrad, oben rot, unten weiß,
  vor rot-weißem Strahlenkranz (weiße Streifen, roter Rahmen – wie das Mosaik; `icons/icon.svg`; PNGs daraus gerendert, `apple-touch-icon.png` ohne
  runde Ecken, weil iOS selbst rundet). Vorher: Kölner Dom.
- Design konsequent in den **Kölner Stadtfarben Rot und Weiß** (`--brand: #ed1c24`, kräftiges Rot wie beim 1. FC Köln,
  rote Kopfzeile, weißer Hintergrund, rotes Logo). Anfangs war es grün – Lukas wollte
  ausdrücklich **kein Grün mehr im Design**. Wer Geld bekommt/schuldet, zeigen Text und
  Vorzeichen (+ / −), nicht die Farbe. (Lukas' Personenfarbe ist weiterhin grün.)
- **Hell/Dunkel wechselt automatisch** mit der Einstellung des Handys – das ist ausdrücklich
  gewünscht (kurz war es „immer hell“, Lukas wollte den automatischen Wechsel zurück).
- Lukas wollte **keine Putz-Statistik** („wer wie oft geputzt hat“) – klingt blöd. Nicht wieder einbauen.
- Personen-Reihenfolge: **Jana, Jul, Lukas**. Farben: Jana hellbraun `#a97b50`,
  Jul blau `#2b6cb0`, Lukas grün `#2f7d4f`.
- **Wischen** nach links/rechts wechselt zwischen den Bereichen in Leisten-Reihenfolge
  (Kalender zählt als „Start“). Nur deutliches, schnelles, waagerechtes Wischen; nicht in
  Eingabefeldern, nicht bei offenem Fenster. **Vom Rand** wischen ist in der Home-Bildschirm-App
  erlaubt (Lukas wischt gewohnt vom Rand); nur im Browser bleiben 16 px Rand für Safaris
  „Zurück“-Geste frei.
  Wichtig (war ein echter Fehler auf dem Handy): `touch-action: pan-y pinch-zoom` auf `main`,
  damit der Browser seitliche Bewegungen nicht selbst übernimmt; zusätzlich am berührten
  Element mithören, weil die App bei neuen Daten neu zeichnet und das Element sonst aus
  der Seite fällt (Ende des Wischens käme nicht an); `touchcancel` zählt wie `touchend`.
  Elemente mit Klasse `no-swipe` sind ausgenommen.
- **Nach unten ziehen = aktualisieren** (Wunsch von Lukas, Nov. 2026): ganz oben auf der Seite
  nach unten ziehen → Zahnrad erscheint (grau, dreht mit; rot = loslassen; dreht beim Laden –
  Lukas wollte ein Zahnrad statt Text) → ganze App lädt neu (`location.reload()`,
  holt auch Termine und neue Version). Nur in der Home-Bildschirm-App – im Browser hat das
  Handy das schon selbst. Ohne Netz kein Neuladen (sonst leere Seite), nur Hinweis.
  Läuft über dieselben Touch-Funktionen wie das Wischen (`swipe.pull`).
- **Geheimnis (Idee von Lukas):** Tipp auf „Projekt Kölle“ oben links öffnet die **Kölsche Weisheit des
  Tages** (jeden Tag eine andere, für alle gleich): die 11 Artikel des Kölschen Grundgesetzes + weitere
  Sprüche/Liedzeilen, jeweils mit Übersetzung (`js/koelsch.js`, Liste `WEISHEITEN` – einfach ergänzbar).
- **⚙️ Einstellungen** (Knopf oben rechts, auch Tipp auf den eigenen Kreis): Benachrichtigungen,
  Kalender verbinden, Datensicherung, Konto/Abmelden, Versionsnummer. Gehört nicht zur
  Wisch-Reihenfolge. (Lukas wollte Technisches gesammelt statt unter „Infos“.)
- Untere Leiste: **Start · Ausgaben · Einkauf · Putzplan · Infos**. Der **Kalender**
  hat keinen eigenen Knopf mehr – er hängt an der Startseite („Ganzer Kalender ›“,
  „‹ Zur Übersicht“), damit die Leiste auf dem Handy nicht zu voll wird.
- **Start (Übersicht)**: Begrüßung auf Kölsch (Wunsch von Lukas: „Morje“ bis 11 Uhr, „Tach“ bis 18,
  „N’Ovend“ bis 23, sonst „Jode Naach“, am 11.11. „Kölle Alaaf“ – `koelscheBegruessung`), nächste Termine, Kontostand, Einkaufsliste, eigene
  Putzaufgabe (mit „Erledigt“), „Wer hat Bock?“, Abstimmungen, „Wer ist weg?“, Wochentipps (Bock vor
  Abstimmungen – Wunsch von Lukas, Nov. 2026).
- **Aufgeräumt (Wunsch von Lukas, 16. Nov. 2026):** Karten lassen sich per Tipp auf die Überschrift
  **einklappen** (Pfeil ⌄/›, `foldCard`/`foldButton` in `app.js`); jedes Handy merkt sich das
  (`localStorage` `koelle.folded`). Zugeklappt steht eine kurze Zusammenfassung da (z. B. „deine Stimme
  fehlt“ in Rot). Einklappbar: alle Karten der Startseite, „Die nächsten Wochen“ im Putzplan (standardmäßig
  zu) und „Was möchtest du bekommen?“ in ⚙️ (standardmäßig zu). Selten Gebrauchtes öffnet sich als
  **Fenster von unten** (`#panel-dialog`, `openPanel`/`PANELS`; Inhalt wird bei neuen Daten mit
  aktualisiert): Monatsübersicht, Daueraufträge, Frühere Abrechnungen (bei Ausgaben ganz unten als drei
  Zeilen), „＋ Notiz“ (Leere Notiz oder Vorlage) und Notizen sortieren. Wochentipps-Suche erst nach
  „🔍 Suchen“.
- **Rückgängig**: Gelöschte Ausgaben, Daueraufträge, Überweisungen, Einkäufe, Notizen,
  Abstimmungen und Abwesenheiten lassen sich 6 Sekunden lang über die Meldung zurückholen.
- **Offline-Hinweis** oben, wenn das Handy kein Netz hat (Firestore speichert später).
- Kann als App auf den Home-Bildschirm gelegt werden (Manifest + Icons).

### 💶 Ausgaben
- Beträge in **Cent**. Aufteilung normalerweise **gleichmäßig** auf die ausgewählten Personen.
- **Wie aufteilen?** „Gleich aufteilen“ oder **„🧾 Nach Posten“** (ersetzt seit Nov. 2026 das
  alte „Ungleich aufteilen“ – Lukas fand es beim Einkaufen zu kompliziert, weil man selbst
  rechnen musste): Posten mit Preis eingeben und pro Posten antippen, für wen (Jana/Jul/Lukas).
  Summe und Anteile rechnet die App (`itemShares` in `money.js`, Rundung erst am Ende, Summe
  geht immer genau auf). Gespeichert: `items [{name, cents, for[]}]` + berechnete `shares`,
  `amountCents`, `splitAmong`. Ganz leere Zeilen werden ignoriert, Zeilen mit Name ohne Preis
  nach Rückfrage weggelassen. Alte Einträge mit nur `shares` öffnen als ein Posten pro Person.
  „Als Ausgabe eintragen“ (Einkauf) füllt die besorgten Sachen als Posten vor. Nicht bei
  Daueraufträgen. Liste zeigt „(nach Posten)“. `expenseShares` rechnet weiter mit `shares`.
- Kategorien: Lebensmittel, Haushalt, Internet & Strom, Freizeit, Sonstiges.
- Einträge bearbeiten und löschen erlaubt.
- Ausgleichs-Vorschlag mit möglichst wenigen Überweisungen.
- **Suche** („🔍 Suchen“ bei den Einträgen): Beschreibung, Kategorie, Person, Betrag –
  auch in früheren Abrechnungen.
- „Ausgeglichen“: beides gewünscht – einzelne Überweisungen abhaken **und**
  „Alles ausgeglichen – neu starten“ (alles auf 0, alte Einträge unter
  „Frühere Abrechnungen“).
- **Monatsübersicht**: Summe pro Monat, Balken der letzten 6 Monate, nach Kategorie
  und nach Person (zählt alle Ausgaben, auch abgerechnete).
- **Daueraufträge** (z. B. Internet, Netflix): werden am gewählten Tag (1.–28.)
  automatisch eingetragen, sobald jemand die App öffnet. Markiert mit 🔁.

### 🛒 Einkauf
- Jeder trägt ein, was fehlt (mehrere mit Komma). Antippen = besorgt
  (durchgestrichen, mit Name). „Liste aufräumen“ entfernt Besorgtes.
- **Schnellauswahl**: ab 2× eingetragen erscheint ein Knopf; „Bearbeiten“ zum Entfernen.
- **Mengen**: „2x Milch“, „Milch 2x“, „500 g Hack“, „3 Dosen Tomaten“ → Menge wird
  als kleines Schild angezeigt (Feld `amount`), Name bleibt für Kategorie/Schnellauswahl.
- **Als Ausgabe eintragen**: eigene besorgte Sachen werden mit einem Tipp als Ausgabe
  vorausgefüllt – jede Sache als Posten (nur noch Preise eintippen, ggf. Personen abwählen).
- **Kategorien in Supermarkt-Reihenfolge** (orientiert am Weg durch einen
  typischen Laden): Obst & Gemüse → Brot → Kühlregal → Fleisch & Fisch → Tiefkühl
  → Vorrat → Frühstück → Süßes → Getränke → Drogerie → Haushalt → Sonstiges.
  Automatische Zuordnung per Stichwort (bei zusammengesetzten Wörtern zählt das
  Ende: „Orangensaft“ → Getränke). Kategorie lässt sich pro Eintrag ändern; die
  App merkt sich das in `favorites`.
- **„🏃 Ich geh jetzt einkaufen“** (aus der Ideen-Sammlung #15, umgesetzt 25. Nov. 2026): Knopf über „Fehlt noch“.
  Die anderen sehen 2 Std. lang „Jul geht gerade einkaufen – trag schnell noch ein, was fehlt!“ (auch auf der
  Start-Kachel „🏃 Jul kauft ein“) und bekommen eine Push-Nachricht (Art `trips`, Standard an, `pushTrip`/`tripMessages`).
  Wer unterwegs ist, sieht „Bin zurück“ (löscht den Eintrag; dabei keine Nachricht).
- **Eigene Reihenfolge** der Kategorien („↕️ Reihenfolge“ mit ▲▼, passend zum
  Stamm-Supermarkt), gespeichert in `settings/einkauf` (`order[]`), gilt für alle.

### 🧹 Putzplan
- Standard-Bereiche: Bad, Küche, Böden & Müll – **in der App bearbeitbar**.
- **Symbole der Bereiche**: werden beim Tippen des Namens automatisch passend gewählt
  (Müll 🗑️, Altglas 🍾, Papier 📦 …, siehe `guessAreaIcon` in `chores.js`) und lassen sich
  per Antippen aus einer Auswahl ändern. Bereiche mit dem alten Standard-Symbol 🧽 bekommen
  beim Öffnen von „Bereiche bearbeiten“ automatisch ein passendes. Löschen-Knopf ist ✕
  (nicht 🗑, sonst Verwechslung mit Müll).
- **Häufigkeit pro Bereich** (`every`: 1 = jede Woche, 2 = alle 2 Wochen, 4 = alle 4 Wochen),
  einstellbar unter „Bereiche bearbeiten“. Nicht fällige Bereiche erscheinen als
  „Diese Woche nicht dran: … (wieder in KW …)“ und in der Vorschau als „–“.
- **Gerechte Verteilung** (`planWeek` in `chores.js`): Jede Woche werden nur die fälligen
  Bereiche der Reihe nach verteilt (Montag ist Wochenwechsel) – niemand hat mehr als eine
  Aufgabe mehr als die anderen, wer die Extra-Aufgabe bekommt, wechselt. Bei drei
  wöchentlichen Bereichen ist das genau die alte Rotation (alte Daten passen).
- „Erledigt ✓“, „Ich übernehme“ (spontan tauschen), „Zurückgeben“.
- Erinnerungen vorerst nur als Hinweis in der App (roter Punkt, Startseite).
- **„Wer ist weg?“** (Startseite): Eintrag antippen = bearbeiten (Person, Von/Bis, Notiz, Löschen-Knopf;
  Wunsch von Lukas, Nov. 2026), ✕ = löschen mit Rückgängig. Änderungen lösen eine Push-Nachricht aus.
- **Urlaubs-Modus**: Wer in einer Woche mindestens 4 Tage weg ist, bekommt keine
  Putzaufgabe; seine Bereiche gehen an die Anwesenden („statt Jana – nicht da“).

### 🗳️ Abstimmungen
- Auf der Startseite: Frage + 2–6 Antworten (oder „Ja / Nein“). Antippen = abstimmen,
  nochmal tippen = Stimme zurücknehmen. „Beenden“ zeigt das Ergebnis (bleibt 7 Tage sichtbar).
  Roter Punkt an „Start“, solange man selbst noch nicht abgestimmt hat.
- **Keine Frist / kein automatisches Ende** fürs Abstimmen – ausdrücklich nicht gewünscht.
- **Aber (Wunsch von Lukas, 15. Nov. 2026):** optional „Wann ist das?“ (Feld `until`, z. B. „Pizza am Freitag?“).
  Wird aus der Frage erkannt (heute/morgen/übermorgen/Wochentag/Wochenende/„20.11.“, `js/polls.js`), lässt sich
  ändern oder leeren. **Nach diesem Tag verschwindet die Abstimmung** (auch aus rotem Punkt), damit Platz für
  Neues ist. Ohne Datum bleibt alles wie bisher. In der Liste steht ein kleines „📅 Fr, 20.11.“.

### 🙋 Wer hat Bock? (Idee von Lukas/Jana)
- Auf der Startseite über den Abstimmungen: spontane Aktionen („Ich koche – wer isst mit?“,
  Film, Bouldern, Kneipe, Sport, Spieleabend oder eigener Text) mit „Jetzt“ oder Uhrzeit
  heute/morgen und optionaler Notiz. Andere tippen „Bin dabei 👍“ / „Diesmal nicht“
  (nochmal tippen = zurücknehmen). **Symbol passt sich beim Tippen an** (`guessInviteEmoji` in
  `invites.js`, Stichwort am Wortanfang, z. B. Pizza 🍕, Kino 🎬, Kölsch 🍻; sonst 🙋) – trägt man
  selbst eins ein, bleibt es (Wunsch von Lukas: freie Wahl erhalten); Feld leeren = wieder automatisch.
  Beim Essen werden „Portionen“ gezählt (auch erkannt an
  Wörtern wie koch/essen/grill/back). Ersteller kann „Absagen“ (mit Rückgängig).
- Verschwindet von selbst: mit Uhrzeit 4 Std. danach, „Jetzt“ nach 6 Std. (spätestens
  3 Uhr nachts) – Regeln in `js/invites.js`. Roter Punkt an „Start“, solange man auf eine
  Aktion der anderen noch nicht geantwortet hat.

### 🔔 Push-Nachrichten
- Jede Person schaltet sie unter ⚙️ **pro Gerät** ein („Auf diesem Handy einschalten“) und
  wählt **pro Person** (gilt für alle Geräte), welche Arten sie will. Liste der Arten:
  `PUSH_TYPES` in `js/config.js` (von App und Dienst gemeinsam genutzt). Standard: alles an
  außer Einkaufsliste. Nie Nachrichten über eigene Einträge.
- Arten: 🙋 neue „Wer hat Bock?“-Aktion + an den Ersteller, wer zu-/absagt · 🗳️ neue Abstimmung +
  Ergebnis beim Beenden (`closedBy`) · 💶 neue **oder geänderte** Ausgabe, die mich betrifft (mit Anteil
  „jetzt … (vorher …)“; Daueraufträge still; Abrechnen zählt nicht) · 📌 Schwarzes Brett: neue oder
  geänderte Notiz (nur Titel/Text, Verschieben/Anheften nicht) · 🌴 neue Abwesenheit · 🧹 Putzplan
  (Mo 9 Uhr: deine Aufgabe; So 18 Uhr: falls noch offen) · 📅 Termine heute (8 Uhr) · 🛒 Einkaufsliste (19 Uhr).
  Änderungen kamen am 5. Nov. 2026 dazu (Wunsch von Lukas: „wenn jemand etwas ändert“). Gelöschtes
  wird nicht gemeldet (wegen „Rückgängig“). 🏃 „Ich geh jetzt einkaufen“ · Funktionen: `pushTrip`, `pushExpenseChange`, `pushNote`,
  `pushInviteAnswer`, `pushPollClosed`, `pushAbsence`, `pushAbsenceChange`.
- Zeitgesteuertes läuft über **einen** stündlichen Job (`pushHourly`, im Gratis-Kontingent).
  Region `europe-west3`, Zeitzone Europe/Berlin.
- iPhone/iPad: nur in der Home-Bildschirm-App (iOS 16.4+). Ist die App offen, erscheint die
  Nachricht als Meldung unten.
- Bereitstellung: GitHub Action bei Änderungen an `functions/**` oder den geteilten
  `js/`-Dateien, oder per Hand („Run workflow“). Lukas wollte, dass man das Verhalten nach dem
  Ausprobieren anpasst („wie das Handling wird“) – Rückmeldungen einplanen.
- **Adresse erneuern:** Bei jedem App-Start holt die App die aktuelle Push-Adresse (`refreshPushToken`,
  `currentPushToken` in beiden Backends) und speichert sie neu – Google tauscht sie ab und zu aus.
- **Fehlersuche:** GitHub-Action „Push-Nachrichten prüfen“ (`.github/workflows/push-check.yml`, nur per
  Hand) zeigt Geräte pro Person, Einstellungen, liegengebliebene Tests und das Protokoll der letzten
  3 Tage. Der Dienst schreibt pro Nachricht eine Zeile „PUSH typ an person: … angekommen, … Fehler“.
  Repo ist öffentlich → nichts Geheimes ausgeben (lange Kennungen werden unkenntlich gemacht).
- VAPID-Schlüssel (öffentlich) steht in `js/firebase-config.js` → `vapidKey` (eingetragen 1. Nov. 2026).
- Google-Cloud-Rechnungskonto: seit 25. Nov. 2026 bestätigt **„Paid account“** (vollständiges Konto, keine
  Testphase mehr). Kosten Nov. 2026: 0,30 €, komplett durch Guthaben gedeckt → 0,00 €.

### 📌 Infos
- **Schwarzes Brett**: Notizen mit Vorlagen (WLAN, Vermieter, Zählerstände, Schlüssel,
  Notfall). „Text kopieren“ z. B. fürs WLAN-Passwort.
- **Anheften** („Anheften“/„Lösen“, Feld `pinned`): angeheftete Notizen stehen oben, rot markiert.
- **Verschieben** (Wunsch von Lukas): lange auf eine Notiz drücken (0,45 s), dann ziehen. Nach oben zu den
  angehefteten = anheften, darunter = lösen (rote Linie „📌 Angeheftet“ zeigt es an). Reihenfolge im Feld
  `order` (neue Notizen ans Ende). Am Rand scrollt die Seite mit. Nur Touch (Handy/iPad).
- **Sortieren** (Wunsch von Lukas): Umschalter „Eigene Reihenfolge / Neueste zuerst / Älteste zuerst“
  (Datum = letzte Änderung), merkt sich jedes Handy selbst (`localStorage` `koelle.noteSort`).
  Angeheftete bleiben immer oben. Verschieben im Datumsmodus schaltet auf „Eigene Reihenfolge“ um.
- **Aufzählungen** im Notiztext: Zeilen mit „- “, „• “, „* “, „– “ werden zu Punkten, „1. “/„1) “ zu
  Nummern (`js/notetext.js`). Beim Tippen setzt Enter den nächsten Punkt/die nächste Nummer, Enter
  in einer leeren Listenzeile beendet die Liste. Gespeichert wird weiter reiner Text.
- **Bilder** an Notizen (z. B. Grundriss aus dem Exposé): werden auf dem Handy auf
  max. 1600 px / < 0,9 MB verkleinert und **in Firestore** gespeichert (kostenlos, kein
  Firebase Storage/„Blaze“ nötig). Vorschaubilder, Tippen = groß, nochmal = Zoom.
  PDFs gehen nicht direkt → Screenshot der Seite.
- **Datensicherung** (jetzt unter ⚙️ Einstellungen): „Alle Daten sichern“ (JSON, ohne API-Schlüssel) und „Ausgaben
  als Tabelle (Excel)“. Auf dem Handy über „Teilen“ speichern. Hinweis, wenn die letzte
  Sicherung über 30 Tage her ist.
- **Sicherung zurückspielen**: JSON-Datei auswählen → Einträge aus der Sicherung werden
  wiederhergestellt/auf deren Stand gesetzt, neuere Einträge bleiben erhalten.

### 📅 Kalender
- Variante „eigenes Design“ (nicht eingebettet): **nächste 12 Monate** (früher 60 Tage –
  Lukas wollte z. B. Karneval im Februar sehen), gruppiert nach Tagen, mit
  Monats-Überschriften ab dem nächsten Monat. Bis zu 4 × 250 Termine (mehrere Abrufe).
  Aktualisierung alle 5 Minuten.
- **Termine direkt in der App eintragen, bearbeiten, löschen** (#11, gebaut 25. Nov. 2026): „＋ Termin eintragen“
  (Kalender-Seite und Startseite unter „Nächste Termine“) öffnet `#newevent-dialog` (Was, Ganztägig, Datum/Bis-Datum
  bzw. Von/Bis-Uhrzeit – endet Bis vor Von, geht es bis zum nächsten Tag –, Ort, Notiz). Im Termin-Fenster
  „Bearbeiten“/„Löschen“ (nicht bei Terminen ohne sichtbaren Titel). Schreiben läuft über die **bestehende
  Firebase-Google-Anmeldung** mit zusätzlichem Bereich `calendar.events` (`reauthenticateWithPopup`, Token ~50 Min. in
  `sessionStorage`, `calendarWrite(method, calendarId, eventId, body)` in beiden Backends; kein eigener OAuth-Client nötig).
  Lesen weiter per API-Schlüssel. Formular → Google: `eventResource`/`eventFormValues` in `calendar.js`. Das Google-Fenster
  muss direkt nach dem Tippen aufgehen (vorher nichts abwarten, sonst blockiert Safari). Einrichtung bei Google:
  ANLEITUNG.md Teil F (Bereich `calendar.events` unter „Datenzugriff“ eintragen, ggf. Testnutzer; Jana/Jul brauchen
  „Änderungen an Terminen vornehmen“). Erwartet: Warnung „App nicht überprüft“ → „Erweitert“ → weiter. Kleiner Link
  „Google Kalender öffnen“ bleibt als Ausweg. **25. Nov. 2026: Lukas hat die Google-Einstellungen gemacht und den Test auf seinem Gerät abgehakt
  (Termin eintragen + löschen); Jana und Jul sind informiert.** Abhakliste für Lukas: Artifact „Kölle Kalender-Einrichtung“.
  Startseite zeigt nur die nächsten 3 Tage mit Terminen.
- **Termin antippen** (Kalender und Startseite) öffnet ein Fenster in der App mit Zeit, Ort
  (Link zu Google Maps), Beschreibung (HTML von Google → Text, Links antippbar) und
  „In Google Kalender öffnen“.
- **Widgets** für den Home-Bildschirm gehen mit einer Web-App nicht (bräuchte eine echte
  iPhone-/Android-App). Lukas gefragt am 1. Nov. 2026 – Alternative: Widget der Google-Kalender-App.

## 🎪 Wochentipps „Diese Woche in Ehrenfeld“ (seit 7. Nov. 2026, Wunsch von Lukas)

- Karte ganz unten auf der Startseite: Events, Konzerte, Partys, Märkte, Flohmärkte in Ehrenfeld
  (Umgebung ok, z. B. Neuehrenfeld/Bickendorf). Je Tipp: Emoji, Titel, Tag + Uhrzeit, Ort, kurzer Text,
  Link (Antippen öffnet die Quelle). Vergangene Tipps verschwinden von selbst; 4 sichtbar, „Alle … anzeigen“.
  Reihenfolge nach Datum; schon laufende Dauer-Veranstaltungen (Weihnachtsmarkt, Ausstellung) werden einsortiert,
  als begännen sie in 7 Tagen – sonst verdrängen sie die Termine dieser Woche (`upcomingTips`, 25. Nov. 2026).
  Die Karte ist **immer** sichtbar (Lukas' Wunsch); ohne aktuelle Tipps steht dort „neue kommen jeden Montag“.
- **Suche** (Wunsch von Lukas): Suchfeld + Schnell-Knöpfe (Flohmarkt, Konzert, Party, Theater, Markt,
  Familie, Kostenlos). Durchsucht Titel, Text, Ort, Uhrzeit und `tags`; verwandte Wörter zählen mit
  („Band“ findet Konzerte, „Trödel“ Flohmärkte – Liste `SYNONYMS` in `js/tipps.js`). Beim Tippen wird nur
  die Liste neu gezeichnet; beim Neuzeichnen der Startseite bleiben Fokus und Text im Suchfeld erhalten.
- ⚠️ Am 14.11.2026 konnte die automatische Runde **nicht hochladen** (Fehler 403, kein Schreibzugriff –
  per `create_trigger` angelegte Aufgaben haben das Repo nicht als Quelle). Lösung: Aufgabe auf claude.ai
  unter „Routinen“ mit ausgewähltem Repository anlegen. Prüfen, ob die Montags-Runde wirklich mergt.
- Daten in **`data/wochentipps.json`** (`updated, from, to, tips[{emoji, title, date, dateTo?, time,
  place, text, url, tags[]}]`), geladen von `js/tipps.js` (ohne Cache). Leer/fehlend = Karte unsichtbar.
  `tags` (klein geschrieben) z. B. flohmarkt, konzert, band, party, karneval, theater, markt, kinder,
  kostenlos, ausstellung, fest.
- Eine **geplante Aufgabe** („Projekt Kölle – Wochentipps Ehrenfeld“, **montags 7:41 Uhr**) recherchiert
  jede Woche neu (Montag–Sonntag + nächstes Wochenende), ersetzt die Datei, PR + selbst mergen.
  Regeln: **nur echte Termine mit Quelle** (Veranstalter-, Stadt- oder Ticketseite), nichts erfinden,
  unsichere Angaben weglassen statt raten, 10–20 Tipps (wegen der Suche gern mehr), jeder mit `tags`,
  bunte Mischung, keine Werbung für Zweifelhaftes.

## 🤖 Wartungs-Operator (seit 7. Nov. 2026, Wunsch von Lukas)

Lukas möchte, dass die App regelmäßig von selbst geprüft und verbessert wird. Er hat erlaubt,
**Verbesserungen ohne Rückfrage** zu machen, will aber **immer informiert** werden.
Eine geplante Aufgabe („Projekt Kölle – wöchentlicher Wartungs-Operator“, **samstags 10:23 Uhr**,
Push-Mitteilung an Lukas am Ende; Berichte im Issue #55) startet dafür jede Woche eine neue
Claude-Sitzung (Operator), die so arbeitet:

1. **Prüfen** (gern mit Unter-Agenten als Helfer, z. B. ein „Tester“ und ein „Bedienbarkeits-Prüfer“):
   - Demo-Modus mit Playwright auf iPhone- und iPad-Größe, hell und dunkel: jeden Bereich öffnen,
     jedes Formular ausprobieren, auf Fehler in der Konsole und zu breite Seiten achten.
   - Bedienbarkeit: Lässt sich alles, was man einträgt, auch **bearbeiten und löschen**? Sind Knöpfe groß
     genug (mind. ~40 px)? Sind Texte einfach und auf Deutsch? Passt alles ins Rot-Weiß-Design?
   - `node functions/test-logic.mjs` (vorher `js`-Dateien nach `functions/shared/` kopieren).
   - GitHub-Action „Push-Nachrichten prüfen“ starten und das Protokoll lesen (Fehler? Zeitplan da?).
2. **Verbessern – ohne Rückfrage erlaubt:** Fehler beheben; Layout, Grafik, Bedienbarkeit,
   Nutzerfreundlichkeit, Barrierefreiheit; fehlende Bearbeiten-/Löschen-Möglichkeiten; kleine
   Textverbesserungen. Höchstens ~3 Änderungen pro Runde, jede im Demo-Modus getestet,
   Versionsnummer erhöhen, Pull Request erstellen und selbst mergen, CLAUDE.md nachführen.
3. **Nicht ohne Lukas:** neue große Funktionen, Funktionen entfernen, alte Daten unbrauchbar machen,
   alles unter „Ausdrücklich nicht gewünscht“, Firebase-/Google-Einstellungen, Sicherheitsregeln,
   Kosten, Geheimnisse, mehr/andere Push-Nachrichten. Solche Ideen nur **vorschlagen**.
4. **Berichten:** Im GitHub-Issue „🤖 Wartungsberichte“ einen Kommentar auf Deutsch, einfach erklärt:
   was geprüft wurde, was geändert wurde (mit PR-Links), was gefunden aber nicht geändert wurde
   (Vorschläge für Lukas). Auch wenn nichts zu tun war („Alles in Ordnung“).

## 🔁 Übergabe an die nächste Sitzung (Stand 16. Nov. 2026)

- **Offen: Automatische Runden dürfen nicht hochladen.** „Projekt Kölle – Wochentipps Ehrenfeld“
  (Mo 7:41) und „Projekt Kölle – wöchentlicher Wartungs-Operator“ (Sa 10:23) recherchieren/prüfen, aber
  `git push` scheitert mit 403 „TritonFischbart/Projekt-Koelle is not in this session's authorized repository
  set … add the repository to the session's sources“; `add_repo` ist in diesen Sitzungen nicht verfügbar.
  Ursache: per `create_trigger` angelegte Routinen haben keine Repo-Quelle. Lukas hat GitHub-App-Zugriff
  auf alle Repos erteilt (nötig, reicht aber nicht). **Lösung:** Lukas trägt auf claude.ai/code/routines bei
  beiden Routinen unter „Repository“ (evtl. „Advanced settings“) `TritonFischbart/Projekt-Koelle` ein –
  mit Screenshot begleiten – danach Wochentipps-Runde per „Run now“/fire_trigger testen und prüfen, ob sie
  selbst mergt. Notfalls Routinen auf claude.ai neu anlegen (Prompts: siehe list_triggers) und alte löschen.
  Gleiches Problem vermutlich bei seinen **Kreidezeit-Routinen** (Boulder-App).
- Wochentipps in `data/wochentipps.json` reichen bis **28.11.2026**. Zwei gescheiterte Runden hatten neue
  Tipps (16.–29.11.); bei Bedarf neu recherchieren und selbst einstellen.
- GitHub-Konto war 7.–12. Nov. von GitHubs Missbrauchs-Erkennung gesperrt (Support-Ticket 4968104,
  aufgehoben). Danach musste Claude neu mit GitHub verbunden werden.

## Merkliste / To-do für später (noch nicht gebaut)

> Die Aufgaben stehen auch als **GitHub-Issues** im Projekt (Reiter „Issues“):
> #11 Termine direkt eintragen (bei Lukas getestet, Jana/Jul ausstehend) ·
> #13 Kassenbon-Fotos · #14 Müllabfuhr-Termine · #15 Ideen-Sammlung · #24 WG-Radio.
> Wenn etwas davon erledigt ist, das Issue schließen und hier austragen.

- **Termine direkt in der App eintragen** (#11): gebaut am 25. Nov. 2026 (siehe Kalender). Issue erst schließen,
  wenn Lukas, Jana und Jul es auf dem Handy erfolgreich ausprobiert haben.

- ~~**Push-Nachrichten** (#12)~~ – erledigt am 1. Nov. 2026: bereitgestellt, Test-Nachricht auf
  Lukas' Handy kam an. Rückmeldungen zum Verhalten (Uhrzeiten, Menge) noch einplanen. Das Dienstkonto `github-deploy` braucht die Rollen
  Editor, Project IAM Admin, Cloud Functions Admin und **Cloud Run Admin** (sonst scheitert „set invoker“
  beim stündlichen Job und der Zeitplan wird nie angelegt – war am 2. Nov. 2026 der Grund, warum keine
  Erinnerungen kamen); die Cloud Billing API muss an sein. Die Bereitstellung prüft am Ende, ob der
  Zeitplan existiert. Jede Bereitstellung schreibt `functions/deploy-stamp.txt` (nicht eingecheckt), damit
  firebase-tools nichts als „unverändert“ überspringt (`FUNCTIONS_DEPLOY_UNCHANGED` hat nicht gewirkt).
  Beim allerersten Bereitstellen kam „Eventarc Service Agent“ – das löst sich nach ein paar Minuten von selbst.
- **Kassenbon-Fotos** bei Ausgaben – bräuchte Firebase Storage (ebenfalls „Blaze“).
- **WG-Radio** (#24): Radio in der App, gespeist über einen Anbieter. Möglichkeiten:
  Kölner Sender per Stream einbinden, eigener kostenloser WG-Sender (z. B. laut.fm) oder
  gemeinsame Spotify-Playlist einbetten. Vorher mit Lukas klären, welche Variante.
- **Müllabfuhr-Termine** der AWB Köln in den Google-Kalender übernehmen (ohne Code).
- ~~Test mit Jana und Jul (#10)~~ – erledigt am 1. Nov. 2026: Anmeldung bei allen dreien klappt.
- **Ideen-Sammlung** (#15): ~~„Ich geh jetzt einkaufen“~~ (erledigt 25. Nov. 2026),
  Schnell-Notizen auf der Startseite, Bewertung für den WG-Abend.
- **Ausdrücklich nicht gewünscht** (nicht bauen): Erinnerung an offene Schulden,
  mehrere Einkaufslisten, Frist bei Abstimmungen.

## Testen

- Diese Cloud-Umgebung erreicht **Firebase, Google-APIs und github.io nicht** →
  echte Verbindung kann nur Lukas testen. Immer im **Demo-Modus** testen:
  `python3 -m http.server 8123` im Projektordner, dann mit Playwright
  `http://localhost:8123/?demo` auf iPhone- und iPad-Größe öffnen.
- Reine Logik (`money.js`, `chores.js`, `calendar.js`, `shopcats.js`) lässt sich
  direkt mit Node testen. Push-Logik: `js`-Dateien nach `functions/shared/` kopieren, dann
  `node functions/test-logic.mjs`. Den Versand selbst kann nur Lukas auf dem Handy testen.
- Prüfen, dass die Seite auf Handy-Breite nicht breiter als der Bildschirm wird.
