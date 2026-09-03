-- Ajoute le réglage de durée de pause déjeuner (existant déjà côté app avec valeur par défaut 60 min).
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run

alter table user_settings add column if not exists lunch_break_min integer default 60;
