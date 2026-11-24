-- Optional local-development seed data. Safe to run repeatedly.
--
-- NOTE: this file does NOT create login accounts. Supabase Auth passwords
-- cannot be seeded safely from SQL, and credentials must never be committed.
-- Create administrators with:  npm run admin:create -- --email ... --password ...
insert into public.middlemen (full_name, phone, address, village)
select 'Musa Bulama', '08030000001', 'Central market', 'Damaturu'
where not exists (select 1 from public.middlemen where full_name = 'Musa Bulama');

insert into public.middlemen (full_name, phone, address, village)
select 'Ali Kachalla', '08030000002', 'Central market', 'Damaturu'
where not exists (select 1 from public.middlemen where full_name = 'Ali Kachalla');
