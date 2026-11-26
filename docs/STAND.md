# 📋 Stand & Aufgaben – Projekt Kölle

Stand: **26. Nov. 2026** (Version 53). Diese Datei sammelt alles Offene an einem Ort.
Künftige Sitzungen: hier nachsehen, erledigte Punkte abhaken, Neues ergänzen.
Ausführliche Details zu jeder Funktion stehen in `CLAUDE.md`.

## ✅ Erledigt (zuletzt)

| Wann | Was |
|---|---|
| 26.11. | 🗳️ **Abstimmungen aufräumen:** Datum lässt sich jetzt auch nachträglich setzen (📅 neben der Frage). Alte Abstimmungen ohne Datum bekommen so ein Datum und verschwinden danach von selbst. |
| 26.11. | 📻 **Radio stabiler:** verbindet bei Aussetzern (z. B. WLAN → Mobilfunk) bis zu 3× still neu, wartet ohne Netz und startet von selbst, Fehler beim Senderwechsel behoben, „Nochmal versuchen“-Knopf, 🌙 Schlaf-Timer (15/30/60 Min.), „Zuletzt“ gehörter Sender markiert. |
| 25.11. | 📻 WG-Radio, 🧾 Kassenbon-Fotos, 📝 Kurz notiert, ⭐ „Wie war's?“, 🏃 „Ich geh jetzt einkaufen“, 📅 Termine in der App eintragen (PR #66–#70) |
| 23.11. | 🎪 Wochentipps-Runde lädt wieder selbst hoch (PR #64, Tipps bis 6.12.) |
| 16.11. | 🤖 Wartungs-Operator lädt selbst hoch, Berichte in Issue #55 |

## 🧪 Offen – braucht Lukas (bzw. Jana/Jul)

1. **Auf dem Handy ausprobieren** (gebaut, aber noch nicht im echten Betrieb getestet):
   Radio (inkl. Schlaf-Timer, Sperrbildschirm), Kassenbon-Fotos (#13), Kurz notiert / Ich geh einkaufen /
   Wie war's? (#15). Wenn alles klappt → Bescheid sagen, dann werden die Issues geschlossen.
2. **Termine eintragen (#11)**: Jana und Jul sollen einmal einen Termin in der App anlegen und löschen.
3. **Alte Abstimmung(en)** auf der Startseite: einmal auf „📅 Wann?“ tippen und ein vergangenes Datum
   wählen (oder „Löschen“) – dann ist der Bereich leer.
4. **Jul**: Push-Nachrichten einschalten (⚙️ → „Auf diesem Handy einschalten“) – laut Protokoll noch kein Gerät.
5. **Pull Request #65 „ChatGPT-Gegenprüfung“** ist seit 25.11. offen: übernehmen oder schließen?
   (Braucht einen OpenAI-Schlüssel als Secret in der Claude-Code-Umgebung.)
6. **Müllabfuhr-Termine (#14)**: Straße/Hausnummer nennen, dann können die AWB-Termine in den
   Kalender „WG Kölle“ übernommen werden (oder selbst über awbkoeln.de → Abfuhrkalender → „in Kalender übernehmen“).
7. **Montag, 30.11.**: Kommt die neue Wochentipps-Runde an? Die aktuelle Datei reicht bis 6.12.
   Falls nicht: auf claude.ai/code/routines prüfen, ob die Routine noch das Repo `TritonFischbart/Projekt-Koelle` eingetragen hat.
8. Das alte Repository `Projekt-K-lle` gibt es nicht mehr separat – GitHub leitet nur weiter. Nichts zu tun.

## 🔧 Offen – kann Claude machen

- Issues #13, #15, #24 schließen, sobald Lukas' Test-Rückmeldung da ist.
- Rückmeldungen zu Push-Nachrichten (Uhrzeiten, Menge) umsetzen, sobald welche kommen.
- „Termine heute (8 Uhr)“ meldet laut Protokoll oft „0 Termine“ – prüfen, falls im Kalender doch welche standen.

## 🚀 Vorschläge für die nächsten Schritte (nach Wichtigkeit)

1. **Echttest-Woche**: Erst mal alles Neue eine Woche im Alltag nutzen und Rückmeldungen sammeln,
   statt sofort Neues zu bauen. Die App hat gerade viele frische Funktionen.
2. **Müllabfuhr im Kalender** (#14) – kleiner Aufwand, jede Woche nützlich (+ ggf. Push am Vorabend
   über die vorhandene 📅-Nachricht).
3. **Startseite entschlacken**: Sie ist inzwischen lang (Termine, Konto, Einkauf, Aufgabe, Kurz notiert,
   Bock, Abstimmungen, Wer ist weg, Wochentipps). Idee: selbst wählen, welche Karten man sieht.
4. **Gemeinsamer Vorrat / „Haben wir noch…?“** – Einkaufsliste merkt sich, was oft gekauft wird; man könnte
   daraus Erinnerungen machen („Klopapier wurde vor 3 Wochen gekauft“). Nur als Idee.
5. **Jahresrückblick** im Dezember (Ausgaben, beste WG-Abende, meistgekaufte Sachen) – passt zu Silvester.

## ⛔ Ausdrücklich nicht gewünscht

Putz-Statistik, Erinnerung an offene Schulden, mehrere Einkaufslisten, Frist/automatisches Ende bei
Abstimmungen ohne Datum, Grün im Design, Wechsel von Mitbewohnern.
