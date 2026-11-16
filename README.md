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
