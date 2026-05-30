-- =====================================================================
-- Draft Mundial 26 — Esquema base
-- =====================================================================
-- Tablas, enums, índices y constraints del MVP del draft.
-- La disponibilidad "elegido" dentro de una liga es la existencia de fila
-- en user_teams(league_id, player_id) (fuente de verdad por liga).
-- players.is_available se reserva para bajas/lesiones marcadas por el admin.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------
do $$ begin
  create type position_enum as enum ('GK', 'DEF', 'MID', 'FWD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type player_status_enum as enum ('available', 'picked', 'unavailable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type league_status_enum as enum (
    'pending_players', 'pending_draw', 'draft_active', 'draft_paused', 'draft_finished'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type draft_mode_enum as enum ('snake', 'linear');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role_enum as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------
-- profiles (extiende auth.users)
-- ----------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Crea automáticamente el perfil al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------
-- leagues
-- ----------------------------------------------------------------------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  world_cup_year int not null default 2026,
  created_by uuid not null references public.profiles(id),
  status league_status_enum not null default 'pending_players',
  invite_code text not null unique,
  max_participants int not null default 12 check (max_participants between 2 and 64),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- league_members
-- ----------------------------------------------------------------------
create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role_enum not null default 'member',
  draft_order int,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id),
  unique (league_id, draft_order)
);
create index if not exists idx_league_members_league on public.league_members(league_id);
create index if not exists idx_league_members_user on public.league_members(user_id);

-- ----------------------------------------------------------------------
-- national_teams
-- ----------------------------------------------------------------------
create table if not exists public.national_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  "group" text,
  flag_url text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- players
-- ----------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  national_team_id uuid not null references public.national_teams(id) on delete cascade,
  primary_position position_enum not null,
  secondary_position position_enum,
  club text,
  age int check (age is null or age between 14 and 60),
  image_url text,
  status player_status_enum not null default 'available',
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_players_team on public.players(national_team_id);
create index if not exists idx_players_position on public.players(primary_position);

-- ----------------------------------------------------------------------
-- drafts (una fila por liga)
-- ----------------------------------------------------------------------
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references public.leagues(id) on delete cascade,
  status league_status_enum not null default 'pending_players',
  current_pick_number int not null default 0,
  current_turn_user_id uuid references public.profiles(id),
  draft_mode draft_mode_enum not null default 'snake',
  timer_enabled boolean not null default true,
  turn_seconds int not null default 90 check (turn_seconds between 10 and 86400),
  pick_deadline timestamptz,
  picks_per_user int, -- null = ilimitado (el admin finaliza manualmente)
  total_picks int,    -- se fija al iniciar = picks_per_user * nº participantes
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- ----------------------------------------------------------------------
-- draft_picks (historial; player_id null = turno saltado por tiempo)
-- ----------------------------------------------------------------------
create table if not exists public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  pick_number int not null,
  user_id uuid not null references public.profiles(id),
  player_id uuid references public.players(id),
  is_autoskip boolean not null default false,
  created_at timestamptz not null default now(),
  unique (draft_id, pick_number)
);
create index if not exists idx_draft_picks_league on public.draft_picks(league_id);
create index if not exists idx_draft_picks_draft on public.draft_picks(draft_id);

-- ----------------------------------------------------------------------
-- user_teams (equipos; fuente de verdad de "elegido en esta liga")
-- ----------------------------------------------------------------------
create table if not exists public.user_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  player_id uuid not null references public.players(id),
  created_at timestamptz not null default now(),
  unique (league_id, player_id) -- un jugador solo puede ser elegido una vez por liga
);
create index if not exists idx_user_teams_league on public.user_teams(league_id);
create index if not exists idx_user_teams_user on public.user_teams(league_id, user_id);

-- ----------------------------------------------------------------------
-- Helpers de pertenencia (SECURITY DEFINER) — usados por RLS
-- ----------------------------------------------------------------------
create or replace function public.is_league_member(p_league_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id
  );
$$;

create or replace function public.is_league_admin(p_league_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id and role = 'admin'
  );
$$;
