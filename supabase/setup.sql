-- ============================================================================
-- LIVESTOCK MARKET SYSTEM — ONE-SHOT DATABASE SETUP
--
-- How to use:
--   1. Open your Supabase project → SQL Editor → New query.
--   2. Paste this ENTIRE file and click Run.
--   3. Then run:  npm run admin:create -- --email admin@market.local --password "ChangeMe123"
--
-- This file is equivalent to running migrations 0001 → 0004 in order and is
-- written to be safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- types ----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin','collector');
  end if;
  if not exists (select 1 from pg_type where typname = 'animal_type') then
    create type animal_type as enum ('camel','donkey','horse');
  end if;
  if not exists (select 1 from pg_type where typname = 'animal_sex') then
    create type animal_sex as enum ('male','female','unknown');
  end if;
  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type transaction_status as enum ('active','voided');
  end if;
end $$;

-- --------------------------------------------------------------- tables ----
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  address text,
  role app_role not null default 'collector',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.middlemen (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  address text,
  village text,
  photo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_settings (
  id smallint primary key default 1 check (id = 1),
  market_name text not null default 'Livestock Market',
  market_location text,
  district text,
  local_government text,
  state text default 'Yobe State',
  contact_information text,
  receipt_prefix text not null default 'LVM',
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.market_settings(id) values(1) on conflict do nothing;

create sequence if not exists public.transaction_sequence;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique not null,
  sequence_number bigint unique not null,
  transaction_date date not null,
  transaction_time time not null,
  animal_type animal_type not null,
  animal_sex animal_sex not null,
  animal_colour text,
  animal_age text,
  animal_description text,
  seller_name text not null,
  seller_phone text,
  seller_address text,
  seller_village text,
  seller_photo_path text,
  buyer_name text not null,
  buyer_phone text,
  buyer_address text,
  buyer_village text,
  buyer_photo_path text,
  middleman_id uuid references public.middlemen(id),
  collector_id uuid not null references public.profiles(id),
  status transaction_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text
);

create table if not exists public.animal_identifications (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  left_side_image_path text,
  right_side_image_path text,
  left_side_description text,
  right_side_description text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- indexes ----
create index if not exists transactions_receipt_idx on public.transactions(receipt_number);
create index if not exists transactions_middleman_idx on public.transactions(middleman_id);
create index if not exists transactions_collector_idx on public.transactions(collector_id);
create index if not exists transactions_date_idx on public.transactions(transaction_date);
create index if not exists transactions_animal_idx on public.transactions(animal_type);
create index if not exists audit_created_idx on public.audit_logs(created_at desc);
create index if not exists middlemen_name_idx on public.middlemen (lower(full_name));
create index if not exists profiles_name_idx on public.profiles (lower(full_name));
create index if not exists transactions_receipt_lower_idx on public.transactions (lower(receipt_number));

-- --------------------------------------------------------------- grants ----
-- Without these, Supabase roles get "permission denied for table ..." (42501)
-- before RLS is even evaluated.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- ---------------------------------------------------- row level security ----
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

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select using (auth_user_id=auth.uid() or public.is_admin());

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "active middlemen readable" on public.middlemen;
create policy "active middlemen readable" on public.middlemen for select using (is_active or public.is_admin());

drop policy if exists "admin middlemen write" on public.middlemen;
create policy "admin middlemen write" on public.middlemen for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "market settings admin read" on public.market_settings;
drop policy if exists "market settings authenticated read" on public.market_settings;
create policy "market settings authenticated read" on public.market_settings for select using (auth.uid() is not null);

drop policy if exists "market settings admin write" on public.market_settings;
create policy "market settings admin write" on public.market_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "collector own transactions" on public.transactions;
create policy "collector own transactions" on public.transactions for select using (collector_id=public.profile_id_for_auth() or public.is_admin());

drop policy if exists "admin or collector insert" on public.transactions;
create policy "admin or collector insert" on public.transactions for insert with check (collector_id=public.profile_id_for_auth() or public.is_admin());

drop policy if exists "admin update transactions" on public.transactions;
create policy "admin update transactions" on public.transactions for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "identifications own or admin" on public.animal_identifications;
create policy "identifications own or admin" on public.animal_identifications for select using (exists(select 1 from public.transactions t where t.id=transaction_id and (t.collector_id=public.profile_id_for_auth() or public.is_admin())));

drop policy if exists "admin or collector insert identification" on public.animal_identifications;
create policy "admin or collector insert identification" on public.animal_identifications for insert with check (exists(select 1 from public.transactions t where t.id=transaction_id and (t.collector_id=public.profile_id_for_auth() or public.is_admin())));

drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs for select using (public.is_admin());

drop policy if exists "audit insert authenticated" on public.audit_logs;
create policy "audit insert authenticated" on public.audit_logs for insert with check (auth.uid() is not null);

-- --------------------------------------------------------------- storage ----
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('livestock-private','livestock-private',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "authenticated signed storage read" on storage.objects;
create policy "authenticated signed storage read" on storage.objects for select using (bucket_id='livestock-private' and auth.role()='authenticated');

drop policy if exists "authenticated upload private files" on storage.objects;
create policy "authenticated upload private files" on storage.objects for insert with check (bucket_id='livestock-private' and auth.role()='authenticated');

drop policy if exists "authenticated update own private files" on storage.objects;
create policy "authenticated update own private files" on storage.objects for update using (bucket_id='livestock-private' and owner_id=auth.uid()::text) with check (bucket_id='livestock-private');

-- ------------------------------------- atomic transaction + receipt number --
create sequence if not exists public.receipt_seq_camel start 1;
create sequence if not exists public.receipt_seq_donkey start 1;
create sequence if not exists public.receipt_seq_horse start 1;

create or replace function public.create_livestock_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_collector uuid;
  v_id uuid;
  v_seq bigint;
  v_type_seq bigint;
  v_receipt text;
  v_type animal_type;
  v_code text;
begin
  -- Trusted server path: no end-user JWT, collector id supplied by the Netlify
  -- function after it verified the access token.
  if auth.uid() is null and coalesce(p_payload->>'collector_id','') <> '' then
    select id into v_collector
      from public.profiles
     where id = (p_payload->>'collector_id')::uuid
       and is_active
     limit 1;

    if v_collector is null then
      raise exception 'Invalid or inactive collector' using errcode='22023';
    end if;
  else
    -- Direct user-JWT path (also used for manual testing).
    select id into v_collector
      from public.profiles
     where auth_user_id = auth.uid()
       and is_active
     limit 1;

    if v_collector is null then
      raise exception 'Unauthorized collector' using errcode='42501';
    end if;
  end if;

  v_type := (p_payload->>'animal_type')::animal_type;

  case v_type
    when 'camel'  then v_code := 'C';  v_type_seq := nextval('public.receipt_seq_camel');
    when 'donkey' then v_code := 'DK'; v_type_seq := nextval('public.receipt_seq_donkey');
    when 'horse'  then v_code := 'H';  v_type_seq := nextval('public.receipt_seq_horse');
  end case;

  v_seq := nextval('public.transaction_sequence');
  v_receipt := v_code || '-' || lpad(v_type_seq::text, 4, '0');

  insert into public.transactions(
    receipt_number,sequence_number,transaction_date,transaction_time,animal_type,animal_sex,
    animal_colour,animal_age,animal_description,seller_name,seller_phone,seller_address,seller_village,seller_photo_path,
    buyer_name,buyer_phone,buyer_address,buyer_village,buyer_photo_path,middleman_id,collector_id
  ) values (
    v_receipt,v_seq,(p_payload->>'transaction_date')::date,(p_payload->>'transaction_time')::time,
    (p_payload->>'animal_type')::animal_type,(coalesce(p_payload->>'animal_sex','unknown'))::animal_sex,
    p_payload->>'animal_colour',p_payload->>'animal_age',p_payload->>'animal_description',
    p_payload->>'seller_name',p_payload->>'seller_phone',p_payload->>'seller_address',p_payload->>'seller_village',p_payload->>'seller_photo_path',
    p_payload->>'buyer_name',p_payload->>'buyer_phone',p_payload->>'buyer_address',p_payload->>'buyer_village',p_payload->>'buyer_photo_path',
    nullif(p_payload->>'middleman_id','')::uuid,v_collector
  ) returning id into v_id;

  insert into public.animal_identifications(transaction_id,left_side_image_path,right_side_image_path,left_side_description,right_side_description)
  values(v_id,p_payload->>'left_side_image_path',p_payload->>'right_side_image_path',p_payload->>'left_side_description',p_payload->>'right_side_description');

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_values)
  values(v_collector,'TRANSACTION_CREATED','transaction',v_id,p_payload || jsonb_build_object('receipt_number',v_receipt));

  return jsonb_build_object('id',v_id,'receipt_number',v_receipt,'sequence_number',v_seq,'animal_number',v_type_seq);
end;
$$;

revoke all on function public.create_livestock_transaction(jsonb) from public;
revoke all on function public.create_livestock_transaction(jsonb) from anon;
revoke all on function public.create_livestock_transaction(jsonb) from authenticated;
grant execute on function public.create_livestock_transaction(jsonb) to service_role;

-- Done. Next step:
--   npm run admin:create -- --email admin@market.local --password "ChangeMe123"
