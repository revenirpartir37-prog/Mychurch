-- Lot 3 — RLS Realtime Message/Notification
-- Si RLS activée, anon SELECT est filtré silencieusement côté Realtime.
-- Ce fichier garantit que la lecture Realtime par churchId fonctionne.
-- À exécuter dans Supabase SQL Editor.

-- Messages: autoriser anon/authenticated à lire les messages de sa church (filtrage fin côté app par receiverId/senderId + publication)
alter table public."Message" enable row level security;
drop policy if exists "realtime_select_message" on public."Message";
create policy "realtime_select_message" on public."Message"
  for select to anon, authenticated
  using (true);

-- Notifications: même besoin pour le badge header + realtime
alter table public."Notification" enable row level security;
drop policy if exists "realtime_select_notification" on public."Notification";
create policy "realtime_select_notification" on public."Notification"
  for select to anon, authenticated
  using (true);

-- Vérif: SELECT * FROM pg_policies WHERE tablename IN ('Message','Notification');
-- Publication déjà dans db/supabase-realtime.sql: alter publication supabase_realtime add table public."Message";
-- Si besoin réactiver: alter publication supabase_realtime add table public."Notification";
