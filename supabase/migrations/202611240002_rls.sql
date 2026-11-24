alter table public.profiles enable row level security;
alter table public.middlemen enable row level security;
alter table public.market_settings enable row level security;
alter table public.transactions enable row level security;
alter table public.animal_identifications enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.auth_user_id=auth.uid() and p.role='admin' and p.is_active);
$$;

create or replace function public.profile_id_for_auth()
returns uuid language sql stable security definer set search_path=public as $$
  select id from public.profiles where auth_user_id=auth.uid() and is_active limit 1;
$$;

create policy "profiles read own" on public.profiles for select using (auth_user_id=auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create policy "active middlemen readable" on public.middlemen for select using (is_active or public.is_admin());
create policy "admin middlemen write" on public.middlemen for all using (public.is_admin()) with check (public.is_admin());

create policy "market settings admin read" on public.market_settings for select using (public.is_admin());
create policy "market settings admin write" on public.market_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "collector own transactions" on public.transactions for select using (collector_id=public.profile_id_for_auth() or public.is_admin());
create policy "admin or collector insert" on public.transactions for insert with check (collector_id=public.profile_id_for_auth() or public.is_admin());
create policy "admin update transactions" on public.transactions for update using (public.is_admin()) with check (public.is_admin());

create policy "identifications own or admin" on public.animal_identifications for select using (exists(select 1 from public.transactions t where t.id=transaction_id and (t.collector_id=public.profile_id_for_auth() or public.is_admin())));
create policy "admin or collector insert identification" on public.animal_identifications for insert with check (exists(select 1 from public.transactions t where t.id=transaction_id and (t.collector_id=public.profile_id_for_auth() or public.is_admin())));

create policy "audit admin read" on public.audit_logs for select using (public.is_admin());
create policy "audit insert authenticated" on public.audit_logs for insert with check (auth.uid() is not null);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('livestock-private','livestock-private',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "authenticated signed storage read" on storage.objects for select using (bucket_id='livestock-private' and auth.role()='authenticated');
create policy "authenticated upload private files" on storage.objects for insert with check (bucket_id='livestock-private' and auth.role()='authenticated');
create policy "authenticated update own private files" on storage.objects for update using (bucket_id='livestock-private' and owner_id=auth.uid()::text) with check (bucket_id='livestock-private');
