-- Tournée.ai — schéma Supabase (tables + Row Level Security)
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run

create extension if not exists pgcrypto;

create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  address text not null,
  postal_code text,
  city text,
  sector text,
  contact text,
  phone text,
  email text,
  notes text,
  lat double precision,
  lng double precision,
  created_at timestamptz default now()
);

create table tours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  sector text,
  start_date date,
  end_date date,
  home_address text,
  home_lat double precision,
  home_lng double precision,
  days jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table user_settings (
  user_id uuid references auth.users primary key default auth.uid(),
  home_address text,
  home_lat double precision,
  home_lng double precision,
  default_visit_duration_min integer default 45,
  day_start text default '08:30',
  max_day_hours numeric default 9,
  suggestion_radius_km numeric default 5
);

alter table clients enable row level security;
alter table tours enable row level security;
alter table user_settings enable row level security;

create policy "Users manage their own clients" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own tours" on tours
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own settings" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index clients_sector_idx on clients (user_id, sector);
