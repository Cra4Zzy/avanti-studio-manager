# Studio deployment (ALL-INKL)
Production: https://studio.haarstudio-avanti.de/
The customer site has its own repository and deployment. Never reuse its FTP account here.
1. Confirm SSL and the document root of the studio subdomain in KAS. Create a dedicated FTP user whose root is this directory only.
2. In this repository's Actions secrets add STUDIO_FTPS_HOST, STUDIO_FTPS_USER, STUDIO_FTPS_PASSWORD. Never paste credentials in chat or commit them.
3. In Actions, run "Avanti Studio — validate and deploy to ALL-INKL" with publish unchecked for a read-only FTP login test.
4. Once correct target directory and SSL are confirmed, run again with publish checked. No deletion; HTTPS byte comparison verifies the published bundle.
5. After successful first publication, set Actions variable STUDIO_AUTO_DEPLOY=true.
Only the authenticated app ships; previews, SQL files and local models are excluded.
## Salon access
In the Avanti Supabase project's Authentication > Users, create one user with a salon email and strong unique password; enable Auto Confirm User (no confirmation mail). Do not expose password. Add its exact auth user ID to public.salon_members for the Avanti salon with role owner and active true. Only an authorized salon administrator may add this membership. The app never registers users, and backend authorization requires membership. Existing public booking remains locked pending final testing.
