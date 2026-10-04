# EventDesk — Slávia Catering beta V1

Pilotná implementácia univerzálneho systému **EventDesk** pre Slávia Catering.

## Čo je funkčné v demo režime

- neverejný interný login (demo lokálne účty)
- role `manager` a `admin`
- dashboard
- verejná stránka Rezervácie bez mien a interných údajov
- dopyty a workflow: nový → kontaktovaný → predbežný → prevedený na akciu
- kalendár priestorov
- akcie a detail akcie
- formulár Nová akcia s bodmi 1–15
- menu/jedlá vrátane grilovania, torty/zákuskov, baru, švédskych stolov, výzdoby a ďalších služieb
- databáza jedál a vyhľadávanie cez aliasy
- push/Notification API základ + PWA service worker
- sklad
- admin-only financie
- audit zmien

Demo údaje sú zatiaľ uložené do `localStorage`, takže sa dá celý proces preklikať bez backendu.

### Demo login

- Admin: `admin@eventdesk.local` / `1111`
- Manager 1: `manager1@eventdesk.local` / `2222`
- Manager 2: `manager2@eventdesk.local` / `3333`
- Manager 3: `manager3@eventdesk.local` / `4444`

Tieto PINy sú iba demo. Produkčne sa nepoužijú.

## Verejná rezervácia

Otvoriť `rezervacie/index.html`. Verejnosť vidí iba dostupnosť priestorov. Formulár vytvorí nezáväzný dopyt, nie automatickú záväznú rezerváciu.

## Supabase

`schema.sql` obsahuje produkčný návrh databázy a RLS:

- `profiles`
- `venues`
- `clients`
- `inquiries`
- `events`
- `event_menu`
- `event_services`
- `event_timeline`
- `foods`
- `event_finance`
- `inventory`
- `notifications`
- `push_devices`
- `audit_log`
- `availability_blocks`

Role sa majú zapisovať do `auth.users.raw_app_meta_data.role`, nie do používateľsky editovateľného `user_metadata`.

V prehliadači sa používa iba Supabase **publishable key**. Secret/service-role kľúč nesmie byť vo frontende.

### Po vytvorení Supabase projektu

1. Spustiť `schema.sql`.
2. Spustiť `seed.sql`.
3. Vytvoriť 4 používateľov v Supabase Auth.
4. Nastaviť `app_metadata.role` na `manager` alebo `admin`.
5. Skopírovať `supabase-config.example.js` na `supabase-config.js` a vložiť Project URL + publishable key.
6. Nahradiť LocalStorage operácie v `app.js` volaniami podľa `supabase-adapter.js`.
7. Otestovať RLS pre anon, manager a admin účet.
8. Spustiť Supabase security/performance advisors a odstrániť prípadné upozornenia.

## Push notifikácie

Aktuálna beta vie požiadať prehliadač o povolenie Notification API a obsahuje service worker. Skutočný vzdialený Web Push potrebuje ešte:

- VAPID kľúče
- uloženie subscriptions do `push_devices`
- server/Edge Function, ktorá odošle push pri udalosti
- HTTPS deployment

Smartwatch zvyčajne zobrazí push, ktorý zrkadlí spárovaný telefón.

## Nasadenie

Je to statický projekt, takže sa dá nasadiť na Vercel bez build procesu. V produkcii odporúčané súbory v root adresári:

- `index.html`
- `rezervacie/index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `sw.js`

SQL a dokumentačné súbory nemusia byť verejne routované.

## Stav

Toto je **funkčná beta prototypová vrstva**, nie produkčne zabezpečená verzia. Produkčný míľnik nastane po napojení Supabase Auth/DB, RLS testoch a reálnom Web Push backende.


## Neon production backend
- Project: `Eventdesk`
- Project ID: `tiny-hat-60943195`
- Database: `neondb`
- Auth: Neon Managed Better Auth
- Login: e-mail + OTP
- Data API: enabled
- App database URL (non-secret): `https://ep-rapid-haze-b51ajefp.c-7.us-east-2.aws.neon.tech/neondb`
- Trusted production domain: `https://clubmanager.app`

The frontend now uses `@neondatabase/neon-js` directly from the browser.
