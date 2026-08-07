-- ============================================================
-- Supabase: Row Level Security + Storage policies
-- Exercuté via la connexion directe (service role / postgres)
-- ============================================================

-- 1) Bucket storage public sur Mychurch-bucket
insert into storage.buckets (id, name, public)
values ('Mychurch-bucket', 'Mychurch-bucket', true)
on conflict (id) do update set public = true;

-- Lecture publique sur tous les objets
drop policy if exists "Public Read" on storage.objects;
create policy "Public Read" on storage.objects
  for select using (bucket_id = 'Mychurch-bucket');

-- Upload via anon (les endpoints serveur utilisent la clé service)
drop policy if exists "Public Upload" on storage.objects;
create policy "Public Upload" on storage.objects
  for insert with check (bucket_id = 'Mychurch-bucket');

drop policy if exists "Public Update" on storage.objects;
create policy "Public Update" on storage.objects
  for update using (bucket_id = 'Mychurch-bucket') with check (bucket_id = 'Mychurch-bucket');

drop policy if exists "Public Delete" on storage.objects;
create policy "Public Delete" on storage.objects
  for delete using (bucket_id = 'Mychurch-bucket');