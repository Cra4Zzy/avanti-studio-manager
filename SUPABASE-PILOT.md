# Avanti – verbundener Supabase-Pilot (23.11.2026)

Der Produktionsstand der Kundenwebsite auf ALL-INKL wurde nicht verändert.

## Zugänge und Test-URLs

- Mitarbeiterkalender (Supabase-Pilot): https://cra4zzy.github.io/avanti-studio-manager/studio-live.html
- Kunden-Verfügbarkeitsvorschau (Supabase-Pilot): https://cra4zzy.github.io/Avanti-Website-Termin-Test-lauf-/termin/pilot.html
- Lokale Demo mit allen bisherigen Funktionen: https://cra4zzy.github.io/avanti-studio-manager/studio.html
- Originale Website-Testdemo: https://cra4zzy.github.io/Avanti-Website-Termin-Test-lauf-/termin/
- Supabase-Projekt: avanti-studio-manager (xvxgqyrykkxdfadppoor, eu-west-1).

## Bereits implementiert

- Sechs Services (Probedaten), fünf Teamprofile (fiktiv), Schichtfenster einschließlich einer Pause.
- Eine Datenbank für interne Termine, 15-Minuten-Sperren und öffentliche Verfügbarkeiten.
- PostgreSQL-GiST-Ausschlussbedingung verhindert parallele bestätigte Einträge derselben Mitarbeiterin.
- Transaktionale SQL-Funktionen für neue Termine und Sperren. Aufruf ausschließlich durch serverseitige Rolle.
- Edge Function `avanti-booking` mit serverseitiger JWT- und aktiver Salon-Mitgliedschaftsprüfung für Mitarbeiteraktionen.
- Interner Live-Pilot für telefonische Termine (Leistung übernimmt Dauer), 15-Minuten-Sperren, Freigaben, Absagen und Tages-Gesamtkalender.
- Live-Website-Pilot mit Live-Verfügbarkeiten und Auswahl „Egal welche Mitarbeiterin“. Öffentliche **echte Buchungen deaktiviert**.
- Mitarbeiter-Pilot: automatische Aktualisierung etwa alle 25 Sekunden und beim Tab-Fokus; kein WebSocket-Realtime.
- Lokale Demos unverändert gelassen. Die Demo-Daten sind **nicht** in Supabase importiert.

## Warum noch nicht live?

Der Salon muss zunächst die echten Mitarbeiterdaten, die Servicepreise, Behandlungszeiten, Wochenarbeitszeiten und die rechtmäßigen Öffnungs-/Schließtage bestätigen. Feiertage, Betriebsurlaub, Schichtänderungen und Profilverwaltung der lokalen Demo wurden noch nicht in die neue Live-Oberfläche übertragen. Bestätigungsmails, PWA-Installation, Kundenselbststorno und DSGVO-Dokumentation benötigen weitere Freigabe.

**Der Supabase-Pilot besitzt derzeit keine Mitarbeiterkonten und keine salon_members-Zuordnung.** Anmeldung ist erst nach Einrichtung eines Auth-Benutzers möglich. Niemals einen Service-Role-Key, geheime Schlüssel oder Kundendaten in GitHub committen.

## Inhaberkonto freigeben (nach Angabe der gewünschten E-Mail)

1. Im Supabase-Dashboard unter Authentication → Users ein Inhaberkonto einladen (kein Passwort per Chat oder ins Repo).
2. Die Benutzer-ID dem Salon `avanti` in `salon_members` mit Rolle `owner` zuordnen.
3. Mitarbeiterkalender öffnen und Anmeldung, Laden, Sperren, Telefontermin, Absage sowie Website-Anzeige der freien Slots auf zwei Geräten testen.
4. End-to-end-Daten zuerst mit fiktiven Kundennamen testen und wieder aus dem Kalender entfernen.

### Beispiel für autorisierte Salonzuordnung

Nach dem Einladen die E-Mail im folgenden SQL **manuell durch die freigegebene Adresse** ersetzen:

```sql
insert into public.salon_members(salon_id,user_id,role,active)
select s.id,u.id,'owner',true
from public.salons s
join auth.users u on lower(u.email)=lower('<FREIGEGEBENE-INHABER-EMAIL>')
where s.slug='avanti'
on conflict (salon_id,user_id) do update set role='owner', active=true;
```

Die Backend-API ist unter `https://xvxgqyrykkxdfadppoor.supabase.co/functions/v1/avanti-booking` mit `action=catalog`, `action=availability` und authentifiziertem `action=studio` verfügbar. Die Serverrolle wird nur in der Edge Function gelesen.

Die Edge Function ist mit `verify_jwt=false` bereitgestellt, **weil öffentliche reine Lesefunktionen ohne Nutzerkonto funktionieren müssen**. Alle schreibenden Mitarbeiteraktionen werden intern mittels Supabase Auth und aktiver `salon_members`-Mitgliedschaft geprüft. Öffentliche Buchungen sind über `AVANTI_PUBLIC_BOOKING_ENABLED` standardmäßig deaktiviert. Vor einem späteren Aktivieren müssen Anti-Bot-Schutz, E-Mail-Bestätigung, Fehlschlagbehandlung, Datenschutz und ein E2E-Test abgeschlossen sein; eine reine Umstellung auf true wird nicht empfohlen.

## Teststatus

- Datenbankmigrationen `avanti_foundation` und `avanti_pilot_booking_core` installiert.
- Datenbanktest: Buchung und absichtliche Doppelbuchung ausgeführt. Die Doppelbuchung wurde zurückgewiesen; der Testeintrag anschließend gelöscht, 0 Termine verblieben.
- `anon` und `authenticated` haben keine direkte Ausführungsberechtigung auf `avanti_create_booking`, `service_role` schon.
- Edge Function: Deployment bestätigt, aber externer HTTP-End-to-End-Test mangels Auth-Benutzer/Netzzugriff nicht vollständig durchgeführt.
- Der Security Advisor meldet einen RLS-Hinweis zur abgeschotteten Rate-Limit-Tabelle ohne direkte Policies; die Tabelle ist absichtlich nur per Service-Rolle zugänglich.
