# 📋 Stand & Aufgaben – Projekt Kölle

Stand: **26. Nov. 2026** (Version 53). Diese Datei sammelt alles Offene an einem Ort.
Künftige Sitzungen: hier nachsehen, erledigte Punkte abhaken, Neues ergänzen.
Ausführliche Details zu jeder Funktion stehen in `CLAUDE.md`.

## ✅ Erledigt (zuletzt)

| Wann | Was |
|---|---|
| 26.11. | 🗑️ **Müllabfuhr 2027 (#14)**: 26 × 🔵 Papiertonne und 26 × 🟡 Gelbe Tonne als ganztägige Termine im Google-Kalender „Projekt Kölle“ (aus dem AWB-Abfuhrkalender). Erscheinen in der App und morgens als Push. |
| 26.11. | 📅 **Termine eintragen (#11)**: Jana und Jul haben es erfolgreich getestet → Issue geschlossen. |
| 26.11. | 🤖 **ChatGPT-Gegenprüfung** (PR #65) übernommen (braucht OpenAI-Schlüssel als Network Secret in der Claude-Code-Umgebung). |
| 26.11. | 🗳️ **Abstimmungen aufräumen:** Datum lässt sich jetzt auch nachträglich setzen (📅 neben der Frage). Alte Abstimmungen ohne Datum bekommen so ein Datum und verschwinden danach von selbst. |
| 26.11. | 📻 **Radio stabiler:** verbindet bei Aussetzern (z. B. WLAN → Mobilfunk) bis zu 3× still neu, wartet ohne Netz und startet von selbst, Fehler beim Senderwechsel behoben, „Nochmal versuchen“-Knopf, 🌙 Schlaf-Timer (15/30/60 Min.), „Zuletzt“ gehörter Sender markiert. |
| 25.11. | 📻 WG-Radio, 🧾 Kassenbon-Fotos, 📝 Kurz notiert, ⭐ „Wie war's?“, 🏃 „Ich geh jetzt einkaufen“, 📅 Termine in der App eintragen (PR #66–#70) |
| 23.11. | 🎪 Wochentipps-Runde lädt wieder selbst hoch (PR #64, Tipps bis 6.12.) |
| 16.11. | 🤖 Wartungs-Operator lädt selbst hoch, Berichte in Issue #55 |

## 🧪 Offen – braucht Lukas (bzw. Jana/Jul)

1. **Auf dem Handy ausprobieren** (gebaut, aber noch nicht im echten Betrieb getestet):
   Radio (inkl. Schlaf-Timer, Sperrbildschirm), Kassenbon-Fotos (#13), Kurz notiert / Ich geh einkaufen /
   Wie war's? (#15). Wenn alles klappt → Bescheid sagen, dann werden die Issues geschlossen.
2. **Alte Abstimmung(en)** auf der Startseite: einmal auf „📅 Wann?“ tippen und ein vergangenes Datum
   wählen (oder „Löschen“) – dann ist der Bereich leer.
3. **Jul**: Push-Nachrichten einschalten (⚙️ → „Auf diesem Handy einschalten“) – laut Protokoll noch kein Gerät.
4. **Restmüll und Biotonne**: Die AWB liefert für eure Adresse nur Papier und Gelbe Tonne. Kurz klären, wer die
   graue/braune Tonne abholt (evtl. über die Hausverwaltung) – dann trägt Claude die Termine nach.
5. **Montag, 30.11.**: Kommt die neue Wochentipps-Runde an? Die aktuelle Datei reicht bis 6.12.
   Falls nicht: auf claude.ai/code/routines prüfen, ob die Routine noch das Repo `TritonFischbart/Projekt-Koelle` eingetragen hat.
6. Das alte Repository `Projekt-K-lle` gibt es nicht mehr separat – GitHub leitet nur weiter. Nichts zu tun.

## 🔧 Offen – kann Claude machen

- Issues #13, #15, #24 schließen, sobald Lukas' Test-Rückmeldung da ist.
- Rückmeldungen zu Push-Nachrichten (Uhrzeiten, Menge) umsetzen, sobald welche kommen.
- Ende 2027: Müllabfuhr-Termine für 2028 eintragen (AWB-Kalender kommt meist im Dezember).
- „Termine heute (8 Uhr)“ meldet laut Protokoll oft „0 Termine“ – prüfen, falls im Kalender doch welche standen.

## 🚀 Vorschläge für die nächsten Schritte (nach Wichtigkeit)

1. **Echttest-Woche**: Erst mal alles Neue eine Woche im Alltag nutzen und Rückmeldungen sammeln,
   statt sofort Neues zu bauen. Die App hat gerade viele frische Funktionen.
2. **Müllabfuhr am Vorabend melden** (#14): Push „Morgen kommt die Biotonne“ um 19 Uhr –
   wäre eine neue Push-Art, braucht Lukas' Okay.
3. **Startseite entschlacken**: Sie ist inzwischen lang (Termine, Konto, Einkauf, Aufgabe, Kurz notiert,
   Bock, Abstimmungen, Wer ist weg, Wochentipps). Idee: selbst wählen, welche Karten man sieht.
4. **Gemeinsamer Vorrat / „Haben wir noch…?“** – Einkaufsliste merkt sich, was oft gekauft wird; man könnte
   daraus Erinnerungen machen („Klopapier wurde vor 3 Wochen gekauft“). Nur als Idee.
5. **Jahresrückblick** im Dezember (Ausgaben, beste WG-Abende, meistgekaufte Sachen) – passt zu Silvester.

## ⛔ Ausdrücklich nicht gewünscht

Putz-Statistik, Erinnerung an offene Schulden, mehrere Einkaufslisten, Frist/automatisches Ende bei
Abstimmungen ohne Datum, Grün im Design, Wechsel von Mitbewohnern.
