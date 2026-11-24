create extension if not exists pgcrypto;

create type app_role as enum ('admin','collector');
create type animal_type as enum ('camel','donkey','horse');
create type animal_sex as enum ('male','female','unknown');
create type transaction_status as enum ('active','voided');

create table public.profiles (
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

create table public.middlemen (
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

create table public.market_settings (
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

create sequence public.transaction_sequence;

create table public.transactions (
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

create table public.animal_identifications (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  left_side_image_path text,
  right_side_image_path text,
  left_side_description text,
  right_side_description text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index transactions_receipt_idx on public.transactions(receipt_number);
create index transactions_seller_idx on public.transactions using gin(to_tsvector('simple', coalesce(seller_name,'')));
create index transactions_buyer_idx on public.transactions using gin(to_tsvector('simple', coalesce(buyer_name,'')));
create index transactions_middleman_idx on public.transactions(middleman_id);
create index transactions_collector_idx on public.transactions(collector_id);
create index transactions_date_idx on public.transactions(transaction_date);
create index transactions_animal_idx on public.transactions(animal_type);
create index audit_created_idx on public.audit_logs(created_at desc);
