-- Retire temporairement l'authentification : plus besoin de compte pour utiliser l'app.
-- Les données (clients, tournées, réglages) sont partagées, sans policies liées à auth.uid().
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run
-- (à appliquer APRÈS supabase-schema.sql, sur une base qui a déjà les tables clients/tours/user_settings)

alter table clients drop constraint if exists clients_user_id_fkey;
alter table clients alter column user_id drop not null;
alter table clients alter column user_id drop default;
alter table clients disable row level security;

alter table tours drop constraint if exists tours_user_id_fkey;
alter table tours alter column user_id drop not null;
alter table tours alter column user_id drop default;
alter table tours disable row level security;

alter table user_settings drop constraint if exists user_settings_user_id_fkey;
alter table user_settings alter column user_id set default '00000000-0000-0000-0000-000000000001'::uuid;
alter table user_settings disable row level security;

-- Pour réactiver l'authentification plus tard :
-- alter table clients enable row level security;
-- alter table tours enable row level security;
-- alter table user_settings enable row level security;
-- (et recréer les policies "Users manage their own ..." de supabase-schema.sql,
--  remettre `references auth.users` + `default auth.uid()` sur les colonnes user_id)
