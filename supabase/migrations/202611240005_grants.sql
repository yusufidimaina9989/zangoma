-- Grants required for the Supabase roles to reach the tables at all.
-- RLS still controls which rows each role can see; these are table privileges.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

-- Apply the same grants to anything created later.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- Ensure the private storage bucket exists even if 0002 was skipped.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('livestock-private', 'livestock-private', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
