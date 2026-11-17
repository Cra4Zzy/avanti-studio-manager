# Avanti Studio Manager v0.1.0

Lokaler Pilot von Kaiser Webdesign. **Keine echten Kundendaten.** Repository aktuell öffentlich.

## Start
Node 22+, Python 3: `npm test`, `npm start`, localhost:8080. Keine npm-Abhängigkeiten.

- `#booking`: Leistung, Tag, qualifiziertes verfügbares Team, Uhrzeit, Testtermin.
- `#studio`: Tages-/Wochenkalender, manuell eintragen, verschieben, stornieren.
- `#team`: drei Testprofile, lokale Testbilder, Zeiten, Pausen, Qualifikationen, Abwesenheiten und Preise bearbeiten.
- LocalStorage und Storage-Events innerhalb desselben Browserprofils. Kein Login, kein E-Mail-Versand, keine geräteübergreifende Synchronisierung und kein serverseitiger Doppelbuchungsschutz. Keine produktive Verwendung.
- 08–18 Uhr, 90 Tage Buchungshorizont, gesamte Leistung blockiert Mitarbeiterin. Preise, Profile und Zeiten unbestätigte Beispiele. Bestehende Webseite unverändert.

Nächste Phase: getrenntes Backend in EU-Region, Auth/RLS, Mandantentrennung, transaktionale Konfliktprüfung, öffentliche Verfügbarkeits-API ohne Kundendaten, Realtime, E-Mail, Backups und Datenschutz. Keine KI-API oder bezahlte Infrastruktur angelegt.

## v0.2 — Salon Workspace
- Kalenderzeiten direkt antippen: Mitarbeiter, Datum und Uhrzeit automatisch übernommen. Schnellbuchung mit Name und 15–120 Minuten; optional Behandlung und individuelle Dauer. Bestehende Einträge bearbeiten, Zeiten sperren und freigeben. Storno/Sperren-Aufhebung mit kurzer lokaler Rückgängig-Option. Desktop Drag & Drop mit Bestätigung und Konfliktprüfung; mobile Tagesansicht pro Mitarbeiter.
- Kontrastreiches Petrol/Creme/Kupfer-Design, getrennte Statusfarben, Tablet- und Smartphone-Ansichten. Vorläufiges CI, noch keine Kundenfreigabe.
- Ausschließlich lokaler Pilot. Dienstübergreifende Backend-API muss insbesondere manuelle Termine ohne Leistung, Zeitblöcke und individuelle Dauer unterstützen; aktuelle DB-Migration erfordert noch Anpassungen vor Freigabe. Keine produktiven Daten verwenden.

## v0.3 — Avanti-inspired CI
Warme Champagner-, Braun-, Elfenbein- und Anthrazitwerte; typografische Wortmarke (kein kopiertes Originallogo), inspirierte Gestaltung statt exakter Übernahme der Original-CSS-Werte. Referenz: https://haarstudio-avanti.de/ und bisherige Avanti-Werbemittel. Funktionale Statusfarben bleiben eigenständig. Die Buchungslogik und der lokale Datenstand bleiben unverändert.

## v0.4 — Fünf Mitarbeiterinnen / einfache Tagesübersicht
Fiktive Testprofile Daniela, Sofia, Melina, Vanessa, Jennifer mit fünf KI-generierten Platzhalterporträts (kompakter lokaler WebP-Bildstreifen für Avatare). Vorhandene Browserdaten werden ohne Löschen der Termine aktualisiert; persönliche Profiländerungen bleiben erhalten. Standardkalender: Mitarbeiterinnen filtern, freie Startzeiten antippen, Einträge bearbeiten, Zeit sperren. Woche und Zeitraster optional. Keine echte Personalinformation oder produktive Verbindung.

## v0.5 — getrennte Oberflächen
`index.html`: öffentliche Buchungsdemo im Avanti-Stil, keine Verwaltungsnavigation; Leistung (Dauer), Wunschstylistin, Monatskalender mit tatsächlich verfügbaren Tagen und freien Uhrzeiten. `studio.html`: interner Kalender im Fresha-inspirierten Spaltenlayout mit Arbeitszeiten, manuellen Terminen und Zeitsperren. Alte #studio/#team-Links leiten um. Smartphone zeigt eine Mitarbeiterin zur Zeit. Beide Ansichten teilen ausschließlich lokale Browserdaten; **keine Authentifizierung, keine geräteübergreifende Synchronisation, keine echte Online-Buchung**. Monatskalender und Buchungen verwenden dieselbe Verfügbarkeitsfunktion. Keine Änderungen an Supabase oder der bestehenden Salonwebsite.

## v0.6 — Wochenübersicht (Entwicklungszweig)
Tag/Woche umschalten, Wochenkennzahlen zum gewählten Teamfilter, direkte Bearbeitung von Terminen und Sperren, Datum antippen für die Tagesansicht. Mobile Wochenübersicht mit zwei bzw. einer Spalte. Ausschließlich lokale Testdaten; kein produktiver Betrieb, keine Installation oder Backend-Verbindung hinzugefügt.

## v0.7 — Abwesenheiten und Sperren
Eigenständiger Dialog mit Mitarbeiterwahl, Stundenintervall oder ganztägigem Datumsbereich, Grund und sofortiger Konfliktprüfung; mehrtägige Sperren werden vollständig oder gar nicht gespeichert. Einzelne Tage separat bearbeitbar. Eigene Verwaltungsansicht für kommende Sperren. 90-Tage-Horizont wie im bisherigen Pilot. Profile und Leistungen unverändert. Kein produktiver Backend-Betrieb.
