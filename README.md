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

## v0.8 — Persönlicher Wochenplan
Mitarbeiterin wählen, Wochentag wählen, freie 15-Minuten-Slots mit einem Klick sperren und erneut freigeben. Solche Sperren nutzen die gleiche lokale Verfügbarkeitslogik wie die öffentliche Buchungsdemo. Online-Termine und reguläre Abwesenheiten sind getrennt und können nicht per Schnellschalter gelöscht werden. Profile und Leistungen unverändert. Kein Login/Backend; nur innerhalb desselben Browserprofils synchron.

## v0.9 — Kalender und Team & Leistungen
Separate Abwesenheitsansicht aus Navigation entfernt; vorhandene Zeitsperren bleiben gespeichert und im Kalender sichtbar. Ganztagsschalter blockiert alle neuen Buchungen der gewählten Mitarbeiterin, ohne vorhandene Termine oder Einzelzeitsperren zu löschen; erneutes Anklicken hebt nur diese Tagessperre auf. Start am nächsten Arbeitstag nach Feierabend, vergangene Slots beschriftet. Lokaler Pilot.


## v0.10 — Teamprofile und zentrale Leistungen
- Navigation: Kalender und Team. Team bearbeitet nur Name, Schwerpunkt und Profilbild. Arbeits-/Pausenzeiten bleiben intern erhalten. Kein Preis-, Leistungs- oder Arbeitszeitformular im Mitarbeiterbereich.
- Jede Mitarbeiterin bietet alle zentral hinterlegten Leistungen an; auch bisherige lokale Profile werden entsprechend aktualisiert. Termine, Sperren und Fotos bleiben erhalten.
- Vereinbarter Buchungsablauf: Leistung auf Website wählen, nur durchgehend freie Startzeiten anzeigen, vollständige Dauer in 15-Minuten-Schritten reservieren. Beispiel Ansatzfarbe 90 Minuten: 14:00 bis 15:30 (6 Slots).
- Vorläufige Katalogplanung zur Salonfreigabe: Herren- und Kinderhaarschnitt je 30 Min., Damen-Trockenhaarschnitt 30 Min., Waschen/Schneiden/Föhnen 60 Min., Ansatzfarbe 90 Min., Komplettfarbe 120 Min., Strähnen 150 Min., Balayage 180 Min. Bestehender Demo-Katalog bleibt bis zur Abstimmung unverändert. Keine Preisfestlegung. Gemeinsames produktives Backend steht aus.


## v0.11 — Team hinzufügen und archivieren
- Teamprofile mit Name, optionalem Schwerpunkt und Foto anlegen. Neue Profile erhalten vorläufig den Demo-Dienstplan Mo–Sa 9–18 Uhr (Pause 13–13:45) und alle zentralen Leistungen. Dienstplan vor Produktion mit Avanti abstimmen.
- Entfernen archiviert ein Profil und blendet es in Kalender und Buchungsdemo aus; Reaktivierung ist möglich. Historische Daten bleiben erhalten. Offene Kundentermine und Telefon-/Salonslots müssen zuerst geklärt werden. Nur lokaler Pilot; Rollen und Live-Synchronisierung fehlen.


## v0.13 — Telefontermine
- Kalender: Standardmodus Zeit sperren (ein Klick = 15 Minuten) unverändert. Modus Telefontermin: freie Startzeit wählen, Dauer aus durchgehend verfügbaren 15-Minuten-Schritten auswählen, optional Testname und Testtelefonnummer speichern. Nach dem Speichern zurück zum Sperrmodus. Terminfarbe unterscheidet Telefontermine von Zeitsperren und Online-Buchungen; Name sichtbar, Telefonnummer nur im internen Bearbeitungsdialog. Alle Buchungswege teilen die Kapazitätsprüfung. Keine echten personenbezogenen Daten im Pilot.
- KI-Telefonassistent ausdrücklich aus dem Projektumfang gestrichen. Gemeinsames Backend, Authentifizierung und produktive Datensicherheit bleiben offen.


## v0.14 — Gesamtkalender und Arbeitszeiten
- Alle aktiven Mitarbeiter im Tagesraster nebeneinander, gleiches 15-Minuten-Raster, Tageswechsel und Wochenleiste; sowohl Sperren als auch Telefontermine direkt in der Gesamtansicht. Klick auf Profil führt zum persönlichen Kalender. Horizontales Scrollen auf kleinen Bildschirmen.
- Teamprofil: pro Wochentag Dienst an/aus, individuelle Start-/Endzeit und optionale Pause, wiederkehrend. Bestehende Demo-Schichten bleiben bis zur Bearbeitung erhalten. Neue Buchungen, persönliche Kalender und Gesamtübersicht nutzen dieselbe Schichtlogik. Änderungen, die bestehende künftige Termine oder Telefonsperren ungültig machen, werden abgelehnt. Keine produktive Backend-Anbindung.


## v0.16 — Urlaub über mehrere Tage
- Persönlicher Kalender und Gesamtkalender: Urlaub / mehrere Tage, Mitarbeiterin und erster/letzter Tag (inklusive) auswählen. Bis zu 365 Tage im Voraus. Urlaub blockiert sämtliche neuen Buchungen, auch bei späteren Änderungen der Dienstzeiten. Bestehende Kunden- und Telefonslots bleiben erhalten und werden vor Bestätigung angezeigt. Urlaub lässt sich als Zeitraum ab heute freigeben; unabhängige Sperren werden nicht entfernt. Nur lokaler Pilot.


## v0.17 — Termine verschieben und absagen
- Gebuchten Slot im Einzel- oder Gesamtkalender wählen: kompakte Termindetails, Verschieben, Kontaktdaten bearbeiten, Absagen. Beim Verschieben Datum und Mitarbeiterin auswählen; angebotene Startzeiten berücksichtigen die ursprüngliche Dauer, Dienstzeiten, Pausen, Sperren und andere Termine. Alte Belegung wird erst nach erfolgreicher Speicherung freigegeben. IDs, Kontaktdaten und Buchungsquelle bleiben erhalten.
- Absage mit separater Bestätigung, Status bleibt in der Historie; Rückgängig (8 Sekunden) für Absage und Verschiebung, nur wenn ursprüngliche Zeit weiterhin verfügbar ist. Keine automatischen Kundenbenachrichtigungen; lokaler Pilot.


## v0.18 — E-Mail-Terminbestätigung (Vorschau)
- Online-Buchung erfasst eine Test-E-Mail-Adresse und generiert nach erfolgreicher lokaler Buchung die Avanti-Bestätigung (HTML und Plaintext). Vorschau nach Buchung, kein Versand. E-Mail in internen Termindetails bearbeitbar und bleibt beim Verschieben erhalten. Keine Echtdaten im Pilot.
- Produktionsplanung: erst nach serverseitig bestätigter Buchung eine idempotente Versandaufgabe erzeugen (eindeutiger Schlüssel pro Termin und Benachrichtigungstyp); Versand serverseitig über bestätigtes SMTP-Postfach oder Transaktionsmail-Dienst. Fehler protokollieren und wiederholen, Buchung bleibt bei Mailfehler erhalten. SPF/DKIM/DMARC und Datenschutz vor Livegang prüfen. Kein Maildienst eingerichtet, keine Absage-/Änderungs-E-Mails oder Selbstabsagelinks.


## v0.19 — Schließtage
- Team: Betriebszeiten & Schließtage. Gesetzliche Feiertage Baden-Württemberg automatisch berechnet, einzelne Ausnahmen nur bei rechtlich zulässiger Öffnung. Quelle: https://im.baden-wuerttemberg.de/de/service/feiertage/ . Zusätzliche Schließzeiten bis 365 Tage im Voraus mit Konfliktwarnung; keine automatische Stornierung. Zentrale Sperren gelten auch für neu angelegte Mitglieder. Freigabe lässt individuelle Sperren bestehen. Lokaler Pilot.


## v0.20 — erster Backend-Login
- Bestehendes, separates Supabase-Projekt für Avanti (EU, Irland). Foundation-Migration auf dem Server vorhanden: sieben Tabellen, RLS aktiv, kein anonymer Direktzugriff, keine direkten Client-Schreibrechte; PostgreSQL-Exclusion-Constraint für gleichzeitige bestätigte Einträge. Keine Kundendaten oder Benutzer importiert.
- `login.html` ist ein eigenständiger echter Auth-Test: E-Mail/Passwort via Supabase Auth, anschließend Prüfung der aktiven Salonzuordnung über die geschützte Data API. Nur öffentlich nutzbarer Publishable Key, keine geheimen Schlüssel. Token nur im Arbeitsspeicher; erneuter Login nach Ablauf/Reload. Keine Selbstregistrierung in der Oberfläche. Der lokale Kalender bleibt getrennt und unverändert; der Login schützt noch keinen produktiven Kalender. Keine Accounts angelegt, End-to-end-Anmeldung erst nach autorisierter Kontoanlage überprüfbar.
- Nächster Schritt: erstes freigegebenes Inhaberkonto in Auth anlegen (Einladung durch Administrator, keine Zugangsdaten im Repo) und Mitgliedschaft `owner` in salon_members zuordnen. Schema und serverseitige RPCs für freie Slots, manuelle Termine ohne Leistung, überlappende Urlaubs-/Schließtage, Mitarbeiterverwaltung und sichere Buchungen aktualisieren. Erst danach echten Kalender verbinden. Keine Echtdaten in die Demo eingeben.
