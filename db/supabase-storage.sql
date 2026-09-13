-- ============================================================
-- Supabase: Row Level Security + Storage policies
-- Exercuté via la connexion directe (service role / postgres)
-- ============================================================

-- 1) Bucket storage privé sur Mychurch-bucket
insert into storage.buckets (id, name, public)
values ('Mychurch-bucket', 'Mychurch-bucket', false)
on conflict (id) do update set public = false;

drop policy if exists "Public Read" on storage.objects;
-- Lecture via URL signée côté serveur uniquement.

drop policy if exists "Public Upload" on storage.objects;
create policy "Public Upload" on storage.objects
  for insert to service_role with check (bucket_id = 'Mychurch-bucket');

drop policy if exists "Public Update" on storage.objects;
create policy "Public Update" on storage.objects
  for update to service_role using (bucket_id = 'Mychurch-bucket') with check (bucket_id = 'Mychurch-bucket');

drop policy if exists "Public Delete" on storage.objects;
create policy "Public Delete" on storage.objects
  for delete to service_role using (bucket_id = 'Mychurch-bucket');