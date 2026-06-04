-- =====================================================================
-- Draft Mundial 26 — SETUP COMPLETO (pegar en Supabase SQL Editor y RUN)
-- Combina migraciones 0001..0006 + seed. Idempotente.
-- =====================================================================


-- ###### migrations/0001_schema.sql ######

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

-- ###### migrations/0002_rls.sql ######

-- =====================================================================
-- Draft Mundial 26 — Row Level Security
-- =====================================================================
-- Filosofía:
--  * Las LECTURAS las gobierna RLS (solo miembros de la liga ven sus datos).
--  * Las ESCRITURAS críticas (picks, turnos, estado del draft, sorteo) pasan por
--    funciones RPC SECURITY DEFINER (ver 0003_functions.sql) que se saltan RLS de
--    forma controlada. Por eso aquí no se conceden políticas de INSERT/UPDATE
--    directas sobre drafts / draft_picks / user_teams a los clientes.
-- =====================================================================

alter table public.profiles        enable row level security;
alter table public.leagues         enable row level security;
alter table public.league_members  enable row level security;
alter table public.national_teams  enable row level security;
alter table public.players         enable row level security;
alter table public.drafts          enable row level security;
alter table public.draft_picks     enable row level security;
alter table public.user_teams      enable row level security;

-- Helper SECURITY DEFINER para evitar recursión de RLS al comprobar liga compartida
create or replace function public.shares_league(p_other_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.league_members m1
    join public.league_members m2 on m1.league_id = m2.league_id
    where m1.user_id = auth.uid() and m2.user_id = p_other_user
  );
$$;

-- ----------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or public.shares_league(id)
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------------
-- leagues  (creación/edición/borrado vía RPC; sólo lectura para miembros)
-- ----------------------------------------------------------------------
drop policy if exists leagues_select_members on public.leagues;
create policy leagues_select_members on public.leagues
  for select using (public.is_league_member(id, auth.uid()));

drop policy if exists leagues_update_admin on public.leagues;
create policy leagues_update_admin on public.leagues
  for update using (public.is_league_admin(id, auth.uid()))
  with check (public.is_league_admin(id, auth.uid()));

-- ----------------------------------------------------------------------
-- league_members
-- ----------------------------------------------------------------------
drop policy if exists league_members_select on public.league_members;
create policy league_members_select on public.league_members
  for select using (public.is_league_member(league_id, auth.uid()));

drop policy if exists league_members_admin_write on public.league_members;
create policy league_members_admin_write on public.league_members
  for all using (public.is_league_admin(league_id, auth.uid()))
  with check (public.is_league_admin(league_id, auth.uid()));

-- ----------------------------------------------------------------------
-- national_teams / players (catálogo)
--  Lectura: cualquier usuario autenticado.
--  Escritura: usuarios que sean admin de alguna liga (importador / panel admin).
-- ----------------------------------------------------------------------
create or replace function public.is_any_league_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.league_members
    where user_id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists national_teams_select on public.national_teams;
create policy national_teams_select on public.national_teams
  for select to authenticated using (true);

drop policy if exists national_teams_admin_write on public.national_teams;
create policy national_teams_admin_write on public.national_teams
  for all to authenticated
  using (public.is_any_league_admin())
  with check (public.is_any_league_admin());

drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated using (true);

drop policy if exists players_admin_write on public.players;
create policy players_admin_write on public.players
  for all to authenticated
  using (public.is_any_league_admin())
  with check (public.is_any_league_admin());

-- ----------------------------------------------------------------------
-- drafts (lectura miembros; escritura sólo vía RPC)
-- ----------------------------------------------------------------------
drop policy if exists drafts_select_members on public.drafts;
create policy drafts_select_members on public.drafts
  for select using (public.is_league_member(league_id, auth.uid()));

-- ----------------------------------------------------------------------
-- draft_picks (lectura miembros; inserción sólo vía RPC)
-- ----------------------------------------------------------------------
drop policy if exists draft_picks_select_members on public.draft_picks;
create policy draft_picks_select_members on public.draft_picks
  for select using (public.is_league_member(league_id, auth.uid()));

-- ----------------------------------------------------------------------
-- user_teams (lectura miembros; escritura sólo vía RPC)
-- ----------------------------------------------------------------------
drop policy if exists user_teams_select_members on public.user_teams;
create policy user_teams_select_members on public.user_teams
  for select using (public.is_league_member(league_id, auth.uid()));

-- ###### migrations/0003_functions.sql ######

-- =====================================================================
-- Draft Mundial 26 — Funciones RPC (lógica de negocio segura)
-- =====================================================================
-- Todas SECURITY DEFINER: se ejecutan con privilegios del owner y se saltan
-- RLS de forma controlada, validando permisos con auth.uid() en su interior.
-- =====================================================================

-- ----------------------------------------------------------------------
-- Código de invitación aleatorio (6 caracteres, sin ambigüedades)
-- ----------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ----------------------------------------------------------------------
-- create_league — crea liga + draft + membresía admin (atómico)
-- ----------------------------------------------------------------------
create or replace function public.create_league(
  p_name text,
  p_max_participants int default 12,
  p_world_cup_year int default 2026,
  p_draft_mode draft_mode_enum default 'snake',
  p_timer_enabled boolean default true,
  p_turn_seconds int default 90,
  p_picks_per_user int default null
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  insert into public.leagues (name, world_cup_year, created_by, status, invite_code, max_participants)
  values (p_name, p_world_cup_year, v_uid, 'pending_players', public.gen_invite_code(), p_max_participants)
  returning * into v_league;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_uid, 'admin');

  insert into public.drafts (league_id, status, draft_mode, timer_enabled, turn_seconds, picks_per_user)
  values (v_league.id, 'pending_players', p_draft_mode, p_timer_enabled, p_turn_seconds, p_picks_per_user);

  return v_league;
end;
$$;

-- ----------------------------------------------------------------------
-- join_league — el usuario se une mediante código de invitación
-- ----------------------------------------------------------------------
create or replace function public.join_league(p_invite_code text)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_count int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_league from public.leagues
  where upper(invite_code) = upper(trim(p_invite_code));
  if not found then raise exception 'Código de invitación no válido'; end if;

  if exists (select 1 from public.league_members where league_id = v_league.id and user_id = v_uid) then
    return v_league; -- ya es miembro, idempotente
  end if;

  if v_league.status not in ('pending_players', 'pending_draw') then
    raise exception 'La liga ya no admite nuevos participantes';
  end if;

  select count(*) into v_count from public.league_members where league_id = v_league.id;
  if v_count >= v_league.max_participants then
    raise exception 'La liga está completa';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_uid, 'member');

  return v_league;
end;
$$;

-- ----------------------------------------------------------------------
-- draw_draft_order — sorteo aleatorio del orden (sólo admin)
-- ----------------------------------------------------------------------
create or replace function public.draw_draft_order(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then
    raise exception 'Sólo el administrador puede sortear';
  end if;

  if (select status from public.leagues where id = p_league_id) not in ('pending_players', 'pending_draw') then
    raise exception 'No se puede sortear: el draft ya ha comenzado';
  end if;

  -- Limpia orden previo y reasigna aleatoriamente 1..N
  update public.league_members set draft_order = null where league_id = p_league_id;

  with ordered as (
    select id, row_number() over (order by random()) as rn
    from public.league_members
    where league_id = p_league_id
  )
  update public.league_members lm
  set draft_order = ordered.rn
  from ordered
  where lm.id = ordered.id;

  update public.leagues set status = 'pending_draw' where id = p_league_id;
  update public.drafts  set status = 'pending_draw' where league_id = p_league_id;
end;
$$;

-- ----------------------------------------------------------------------
-- compute_turn_user — usuario que elige en un pick dado (lógica serpiente/lineal)
-- ----------------------------------------------------------------------
create or replace function public.compute_turn_user(p_draft_id uuid, p_pick_number int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
  v_count int;
  v_round int;
  v_idx int;
  v_pos int;
  v_user uuid;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  select count(*) into v_count
  from public.league_members
  where league_id = v_draft.league_id and draft_order is not null;

  if v_count = 0 then return null; end if;

  v_round := (p_pick_number - 1) / v_count;  -- división entera
  v_idx   := (p_pick_number - 1) % v_count;

  if v_draft.draft_mode = 'snake' and (v_round % 2) = 1 then
    v_pos := v_count - 1 - v_idx;   -- ronda impar: orden inverso
  else
    v_pos := v_idx;                 -- lineal o ronda par
  end if;

  select user_id into v_user
  from public.league_members
  where league_id = v_draft.league_id and draft_order = v_pos + 1; -- draft_order es 1-indexado

  return v_user;
end;
$$;

-- ----------------------------------------------------------------------
-- advance_draft_turn — avanza al siguiente pick (asume lock previo del draft)
-- ----------------------------------------------------------------------
create or replace function public.advance_draft_turn(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
  v_next_pick int;
  v_next_user uuid;
begin
  select * into v_draft from public.drafts where id = p_draft_id;

  v_next_pick := v_draft.current_pick_number + 1;

  -- ¿Se alcanzó el número máximo de picks configurado?
  if v_draft.total_picks is not null and v_next_pick > v_draft.total_picks then
    update public.drafts
      set status = 'draft_finished', current_turn_user_id = null,
          pick_deadline = null, finished_at = now()
      where id = p_draft_id;
    update public.leagues set status = 'draft_finished' where id = v_draft.league_id;
    return;
  end if;

  v_next_user := public.compute_turn_user(p_draft_id, v_next_pick);

  update public.drafts
    set current_pick_number = v_next_pick,
        current_turn_user_id = v_next_user,
        pick_deadline = case when timer_enabled
                          then now() + make_interval(secs => turn_seconds)
                          else null end
    where id = p_draft_id;
end;
$$;

-- ----------------------------------------------------------------------
-- start_draft — inicia el draft (sólo admin)
-- ----------------------------------------------------------------------
create or replace function public.start_draft(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
  v_member_count int;
  v_unordered int;
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then
    raise exception 'Sólo el administrador puede iniciar el draft';
  end if;

  select * into v_draft from public.drafts where league_id = p_league_id for update;
  if not found then raise exception 'Draft no encontrado'; end if;
  if v_draft.status not in ('pending_draw', 'draft_paused') then
    raise exception 'El draft no está listo para iniciarse';
  end if;

  select count(*) into v_member_count from public.league_members where league_id = p_league_id;
  select count(*) into v_unordered from public.league_members
    where league_id = p_league_id and draft_order is null;
  if v_member_count < 2 then raise exception 'Se necesitan al menos 2 participantes'; end if;
  if v_unordered > 0 then raise exception 'Falta sortear el orden de algunos participantes'; end if;

  update public.drafts
    set status = 'draft_active',
        current_pick_number = 1,
        current_turn_user_id = public.compute_turn_user(v_draft.id, 1),
        total_picks = case when picks_per_user is not null
                        then picks_per_user * v_member_count else null end,
        started_at = coalesce(started_at, now()),
        pick_deadline = case when timer_enabled
                          then now() + make_interval(secs => turn_seconds) else null end
    where id = v_draft.id;

  update public.leagues set status = 'draft_active' where id = p_league_id;
end;
$$;

-- ----------------------------------------------------------------------
-- pause / resume / finish (sólo admin)
-- ----------------------------------------------------------------------
create or replace function public.pause_draft(p_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then raise exception 'Sólo admin'; end if;
  update public.drafts set status = 'draft_paused', pick_deadline = null
    where league_id = p_league_id and status = 'draft_active';
  update public.leagues set status = 'draft_paused' where id = p_league_id and status = 'draft_active';
end; $$;

create or replace function public.resume_draft(p_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_draft public.drafts%rowtype;
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then raise exception 'Sólo admin'; end if;
  select * into v_draft from public.drafts where league_id = p_league_id for update;
  if v_draft.status <> 'draft_paused' then raise exception 'El draft no está pausado'; end if;
  update public.drafts
    set status = 'draft_active',
        pick_deadline = case when timer_enabled then now() + make_interval(secs => turn_seconds) else null end
    where league_id = p_league_id;
  update public.leagues set status = 'draft_active' where id = p_league_id;
end; $$;

create or replace function public.finish_draft(p_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then raise exception 'Sólo admin'; end if;
  update public.drafts
    set status = 'draft_finished', current_turn_user_id = null, pick_deadline = null, finished_at = now()
    where league_id = p_league_id;
  update public.leagues set status = 'draft_finished' where id = p_league_id;
end; $$;

-- ----------------------------------------------------------------------
-- reset_draft — reinicia: borra picks y equipos, vuelve a pre-draft (sólo admin)
-- ----------------------------------------------------------------------
create or replace function public.reset_draft(p_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_draft_id uuid;
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then raise exception 'Sólo admin'; end if;
  select id into v_draft_id from public.drafts where league_id = p_league_id;

  delete from public.draft_picks where league_id = p_league_id;
  delete from public.user_teams  where league_id = p_league_id;

  update public.drafts
    set status = 'pending_draw', current_pick_number = 0, current_turn_user_id = null,
        pick_deadline = null, started_at = null, finished_at = null, total_picks = null
    where league_id = p_league_id;
  update public.leagues set status = 'pending_draw' where id = p_league_id;
end; $$;

-- ----------------------------------------------------------------------
-- make_pick — ELECCIÓN DE JUGADOR (atómica y segura) ★ núcleo del sistema
-- ----------------------------------------------------------------------
create or replace function public.make_pick(p_draft_id uuid, p_player_id uuid)
returns public.draft_picks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_pick public.draft_picks%rowtype;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  -- Bloquea la fila del draft → serializa picks concurrentes
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado'; end if;

  if v_draft.status <> 'draft_active' then
    raise exception 'El draft no está activo';
  end if;

  -- Si el timer expiró, no se permite el pick (lo resolverá expire_turn)
  if v_draft.timer_enabled and v_draft.pick_deadline is not null and now() > v_draft.pick_deadline then
    raise exception 'Se agotó el tiempo para este turno';
  end if;

  if v_draft.current_turn_user_id is distinct from v_uid then
    raise exception 'No es tu turno';
  end if;

  if not exists (select 1 from public.league_members where league_id = v_draft.league_id and user_id = v_uid) then
    raise exception 'No perteneces a esta liga';
  end if;

  -- Jugador debe existir y no estar dado de baja
  if not exists (select 1 from public.players where id = p_player_id and is_available = true) then
    raise exception 'Jugador no disponible';
  end if;

  -- Registro del pick. El UNIQUE (league_id, player_id) en user_teams es la barrera
  -- definitiva contra elección duplicada (dos transacciones → una falla).
  insert into public.user_teams (league_id, user_id, player_id)
  values (v_draft.league_id, v_uid, p_player_id);

  insert into public.draft_picks (draft_id, league_id, pick_number, user_id, player_id, is_autoskip)
  values (p_draft_id, v_draft.league_id, v_draft.current_pick_number, v_uid, p_player_id, false)
  returning * into v_pick;

  perform public.advance_draft_turn(p_draft_id);
  return v_pick;
exception
  when unique_violation then
    raise exception 'Ese jugador ya ha sido elegido';
end;
$$;

-- ----------------------------------------------------------------------
-- expire_turn — auto-skip idempotente cuando vence el cronómetro
-- ----------------------------------------------------------------------
create or replace function public.expire_turn(p_draft_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if not found then return false; end if;
  if v_draft.status <> 'draft_active' then return false; end if;
  if not v_draft.timer_enabled then return false; end if;
  if v_draft.pick_deadline is null or now() <= v_draft.pick_deadline then return false; end if;

  -- Registra el turno saltado en el historial (sin jugador)
  insert into public.draft_picks (draft_id, league_id, pick_number, user_id, player_id, is_autoskip)
  values (p_draft_id, v_draft.league_id, v_draft.current_pick_number, v_draft.current_turn_user_id, null, true);

  perform public.advance_draft_turn(p_draft_id);
  return true;
end;
$$;

-- expire_all_due — recorre drafts activos con deadline vencido (para pg_cron)
create or replace function public.expire_all_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.drafts
    where status = 'draft_active' and timer_enabled
      and pick_deadline is not null and now() > pick_deadline
  loop
    if public.expire_turn(r.id) then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

-- ----------------------------------------------------------------------
-- Correcciones de admin
-- ----------------------------------------------------------------------
-- Cambia el jugador asignado en un pick existente (corrige error de elección)
create or replace function public.admin_correct_pick(p_pick_id uuid, p_new_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_pick public.draft_picks%rowtype;
begin
  select * into v_pick from public.draft_picks where id = p_pick_id;
  if not found then raise exception 'Pick no encontrado'; end if;
  if not public.is_league_admin(v_pick.league_id, auth.uid()) then raise exception 'Sólo admin'; end if;
  if v_pick.player_id is null then raise exception 'No se puede corregir un turno saltado'; end if;

  if not exists (select 1 from public.players where id = p_new_player_id and is_available = true) then
    raise exception 'Jugador nuevo no disponible';
  end if;

  update public.user_teams
    set player_id = p_new_player_id
    where league_id = v_pick.league_id and player_id = v_pick.player_id and user_id = v_pick.user_id;

  update public.draft_picks set player_id = p_new_player_id where id = p_pick_id;
end;
$$;

-- Marca un jugador como baja/no disponible (o lo reactiva)
create or replace function public.admin_set_player_availability(p_player_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_any_league_admin() then raise exception 'Sólo admin'; end if;
  update public.players
    set is_available = p_available,
        status = case when p_available then 'available' else 'unavailable' end
    where id = p_player_id;
end;
$$;

-- ----------------------------------------------------------------------
-- Permisos de ejecución
-- ----------------------------------------------------------------------
grant execute on function
  public.create_league(text, int, int, draft_mode_enum, boolean, int, int),
  public.join_league(text),
  public.draw_draft_order(uuid),
  public.start_draft(uuid),
  public.pause_draft(uuid),
  public.resume_draft(uuid),
  public.finish_draft(uuid),
  public.reset_draft(uuid),
  public.make_pick(uuid, uuid),
  public.expire_turn(uuid),
  public.admin_correct_pick(uuid, uuid),
  public.admin_set_player_availability(uuid, boolean)
to authenticated;

-- ###### migrations/0004_realtime.sql ######

-- =====================================================================
-- Draft Mundial 26 — Realtime
-- =====================================================================
-- Publica en la replicación lógica las tablas que el dashboard del draft
-- escucha en tiempo real. Supabase Realtime respeta RLS en los cambios
-- entregados a cada cliente.
-- =====================================================================

-- REPLICA IDENTITY FULL para recibir filas completas en updates/deletes
alter table public.drafts          replica identity full;
alter table public.draft_picks     replica identity full;
alter table public.user_teams      replica identity full;
alter table public.league_members  replica identity full;
alter table public.players         replica identity full;

-- Añade las tablas a la publicación de Realtime (idempotente)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- drafts
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drafts'
    ) then execute 'alter publication supabase_realtime add table public.drafts'; end if;

    -- draft_picks
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_picks'
    ) then execute 'alter publication supabase_realtime add table public.draft_picks'; end if;

    -- user_teams
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_teams'
    ) then execute 'alter publication supabase_realtime add table public.user_teams'; end if;

    -- league_members
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_members'
    ) then execute 'alter publication supabase_realtime add table public.league_members'; end if;
  end if;
end $$;

-- ###### migrations/0006_future_stubs.sql ######

-- =====================================================================
-- Draft Mundial 26 — Stubs de futuro (NO usados por el MVP)
-- =====================================================================
-- Estructura reservada para fases posteriores (puntuación, alineaciones,
-- clasificación, estadísticas). Se dejan COMENTADAS para no contaminar el
-- MVP ni añadir RLS/índices que aún no se necesitan. Descomentar cuando se
-- aborde cada funcionalidad.
--
-- Funcionalidades previstas (ver plan): sistema de puntuación por rendimiento,
-- estadísticas de jugadores, alineaciones, capitán, clasificación de usuarios,
-- mercado de fichajes, cambios entre jornadas, lesiones/bajas, notificaciones,
-- chat de liga, integración con API de fútbol, importación oficial de plantillas,
-- modo público de la liga.
-- =====================================================================

-- -- Estadísticas reales por jugador y jornada
-- create table public.player_stats (
--   id uuid primary key default gen_random_uuid(),
--   player_id uuid not null references public.players(id) on delete cascade,
--   matchday int not null,
--   goals int not null default 0,
--   assists int not null default 0,
--   minutes int not null default 0,
--   clean_sheet boolean not null default false,
--   yellow_cards int not null default 0,
--   red_cards int not null default 0,
--   created_at timestamptz not null default now(),
--   unique (player_id, matchday)
-- );

-- -- Reglas de puntuación configurables por liga
-- create table public.scoring_rules (
--   id uuid primary key default gen_random_uuid(),
--   league_id uuid not null references public.leagues(id) on delete cascade,
--   rule_key text not null,      -- p.ej. 'goal_fwd', 'assist', 'clean_sheet_gk'
--   points numeric not null,
--   unique (league_id, rule_key)
-- );

-- -- Alineaciones por jornada (titular/suplente, capitán)
-- create table public.lineups (
--   id uuid primary key default gen_random_uuid(),
--   league_id uuid not null references public.leagues(id) on delete cascade,
--   user_id uuid not null references public.profiles(id),
--   matchday int not null,
--   player_id uuid not null references public.players(id),
--   is_starter boolean not null default true,
--   is_captain boolean not null default false,
--   unique (league_id, user_id, matchday, player_id)
-- );

-- -- Clasificación acumulada de usuarios por liga
-- create table public.standings (
--   id uuid primary key default gen_random_uuid(),
--   league_id uuid not null references public.leagues(id) on delete cascade,
--   user_id uuid not null references public.profiles(id),
--   total_points numeric not null default 0,
--   updated_at timestamptz not null default now(),
--   unique (league_id, user_id)
-- );

-- ###### seed.sql ######

-- =====================================================================
-- Draft Mundial 26 — Seed de plantillas CONFIRMADAS (generado)
-- Generado por scripts/generate-seed.mjs a partir del CSV de convocados.
-- 48 selecciones · 1248 jugadores.
-- Idempotente (ON CONFLICT / NOT EXISTS).
-- =====================================================================

insert into public.national_teams (name, "group", flag_url) values
  ('Alemania', 'E', 'https://flagcdn.com/w320/de.png'),
  ('Arabia Saudí', 'H', 'https://flagcdn.com/w320/sa.png'),
  ('Argelia', 'J', 'https://flagcdn.com/w320/dz.png'),
  ('Argentina', 'J', 'https://flagcdn.com/w320/ar.png'),
  ('Australia', 'D', 'https://flagcdn.com/w320/au.png'),
  ('Austria', 'J', 'https://flagcdn.com/w320/at.png'),
  ('Bélgica', 'G', 'https://flagcdn.com/w320/be.png'),
  ('Bosnia y Herzegovina', 'B', 'https://flagcdn.com/w320/ba.png'),
  ('Brasil', 'C', 'https://flagcdn.com/w320/br.png'),
  ('Cabo Verde', 'H', 'https://flagcdn.com/w320/cv.png'),
  ('Canadá', 'B', 'https://flagcdn.com/w320/ca.png'),
  ('Catar', 'B', 'https://flagcdn.com/w320/qa.png'),
  ('Colombia', 'K', 'https://flagcdn.com/w320/co.png'),
  ('Corea del Sur', 'A', 'https://flagcdn.com/w320/kr.png'),
  ('Costa de Marfil', 'E', 'https://flagcdn.com/w320/ci.png'),
  ('Croacia', 'L', 'https://flagcdn.com/w320/hr.png'),
  ('Curazao', 'E', 'https://flagcdn.com/w320/cw.png'),
  ('Ecuador', 'E', 'https://flagcdn.com/w320/ec.png'),
  ('Egipto', 'G', 'https://flagcdn.com/w320/eg.png'),
  ('Escocia', 'C', 'https://flagcdn.com/w320/gb-sct.png'),
  ('España', 'H', 'https://flagcdn.com/w320/es.png'),
  ('Estados Unidos', 'D', 'https://flagcdn.com/w320/us.png'),
  ('Francia', 'I', 'https://flagcdn.com/w320/fr.png'),
  ('Ghana', 'L', 'https://flagcdn.com/w320/gh.png'),
  ('Haití', 'C', 'https://flagcdn.com/w320/ht.png'),
  ('Inglaterra', 'L', 'https://flagcdn.com/w320/gb-eng.png'),
  ('Irak', 'I', 'https://flagcdn.com/w320/iq.png'),
  ('Irán', 'G', 'https://flagcdn.com/w320/ir.png'),
  ('Japón', 'F', 'https://flagcdn.com/w320/jp.png'),
  ('Jordania', 'J', 'https://flagcdn.com/w320/jo.png'),
  ('Marruecos', 'C', 'https://flagcdn.com/w320/ma.png'),
  ('México', 'A', 'https://flagcdn.com/w320/mx.png'),
  ('Noruega', 'I', 'https://flagcdn.com/w320/no.png'),
  ('Nueva Zelanda', 'G', 'https://flagcdn.com/w320/nz.png'),
  ('Países Bajos', 'F', 'https://flagcdn.com/w320/nl.png'),
  ('Panamá', 'L', 'https://flagcdn.com/w320/pa.png'),
  ('Paraguay', 'D', 'https://flagcdn.com/w320/py.png'),
  ('Portugal', 'K', 'https://flagcdn.com/w320/pt.png'),
  ('República Checa', 'A', 'https://flagcdn.com/w320/cz.png'),
  ('República Democrática del Congo', 'K', 'https://flagcdn.com/w320/cd.png'),
  ('Senegal', 'I', 'https://flagcdn.com/w320/sn.png'),
  ('Sudáfrica', 'A', 'https://flagcdn.com/w320/za.png'),
  ('Suecia', 'F', 'https://flagcdn.com/w320/se.png'),
  ('Suiza', 'B', 'https://flagcdn.com/w320/ch.png'),
  ('Túnez', 'F', 'https://flagcdn.com/w320/tn.png'),
  ('Turquía', 'D', 'https://flagcdn.com/w320/tr.png'),
  ('Uruguay', 'H', 'https://flagcdn.com/w320/uy.png'),
  ('Uzbekistán', 'K', 'https://flagcdn.com/w320/uz.png')
on conflict (name) do update set "group" = excluded."group", flag_url = excluded.flag_url;

insert into public.players (full_name, national_team_id, primary_position, club)
select v.full_name, t.id, v.pos::position_enum, nullif(v.club, '')
from (values
  ('Waldemar Anton', 'Alemania', 'DEF', 'Borussia Dortmund'),
  ('Nathaniel Brown', 'Alemania', 'DEF', 'Eintracht Frankfurt'),
  ('David Raum', 'Alemania', 'DEF', 'RB Leipzig'),
  ('Antonio Rudiger', 'Alemania', 'DEF', 'Real Madrid'),
  ('Nico Schlotterbeck', 'Alemania', 'DEF', 'Borussia Dortmund'),
  ('Jonathan Tah', 'Alemania', 'DEF', 'Bayern Munich'),
  ('Malick Thiaw', 'Alemania', 'DEF', 'Newcastle United'),
  ('Maximilian Beier', 'Alemania', 'FWD', 'Borussia Dortmund'),
  ('Kai Havertz', 'Alemania', 'FWD', 'Arsenal'),
  ('Jamal Musiala', 'Alemania', 'FWD', 'Bayern Munich'),
  ('Leroy Sane', 'Alemania', 'FWD', 'Galatasaray'),
  ('Deniz Undav', 'Alemania', 'FWD', 'Stuttgart'),
  ('Nick Woltemade', 'Alemania', 'FWD', 'Newcastle United'),
  ('Nadiem Amiri', 'Alemania', 'MID', 'Mainz'),
  ('Leon Goretzka', 'Alemania', 'MID', 'Bayern Munich'),
  ('Pascal Gross', 'Alemania', 'MID', 'Brighton and Hove Albion'),
  ('Joshua Kimmich', 'Alemania', 'MID', 'Bayern Munich'),
  ('Jamie Leweling', 'Alemania', 'MID', 'Stuttgart'),
  ('Felix Nmecha', 'Alemania', 'MID', 'Borussia Dortmund'),
  ('Aleksandar Pavlovic', 'Alemania', 'MID', 'Bayern Munich'),
  ('Angelo Stiller', 'Alemania', 'MID', 'Stuttgart'),
  ('Florian Wirtz', 'Alemania', 'MID', 'Liverpool'),
  ('Lennart Karl', 'Alemania', 'MID', 'Bayern Munich'),
  ('Oliver Baumann', 'Alemania', 'GK', 'Hoffenheim'),
  ('Manuel Neuer', 'Alemania', 'GK', 'Bayern Munich'),
  ('Alexander Nubel', 'Alemania', 'GK', 'Stuttgart'),
  ('Tambakti', 'Arabia Saudí', 'DEF', 'Al Hilal'),
  ('Abdulhamid', 'Arabia Saudí', 'DEF', 'Lens'),
  ('Al Amri', 'Arabia Saudí', 'DEF', 'Al Nassr'),
  ('Hassan Kadesh', 'Arabia Saudí', 'DEF', 'Al Ittihad'),
  ('Yahya', 'Arabia Saudí', 'DEF', 'Al Nassr'),
  ('Majrashi', 'Arabia Saudí', 'DEF', 'Al Ahli'),
  ('Al-Harbi', 'Arabia Saudí', 'DEF', 'Al Hilal'),
  ('Boushal', 'Arabia Saudí', 'DEF', 'Al Nassr'),
  ('Ali Lajami', 'Arabia Saudí', 'DEF', 'Al Hilal'),
  ('Abu Al-Shamat', 'Arabia Saudí', 'DEF', 'Al Qadsiah'),
  ('Thakri', 'Arabia Saudí', 'DEF', 'Al Qadsiah'),
  ('Al-Shehri', 'Arabia Saudí', 'FWD', 'Al Ittihad'),
  ('Al Brikan', 'Arabia Saudí', 'FWD', 'Al Ahli'),
  ('K. Al Ghannam', 'Arabia Saudí', 'FWD', 'Al Ettifaq'),
  ('Al Hamdan', 'Arabia Saudí', 'FWD', 'Al Nassr'),
  ('Sultan Mandash', 'Arabia Saudí', 'FWD', 'Al Hilal'),
  ('S. Al-Dawsari', 'Arabia Saudí', 'MID', 'Al Hilal'),
  ('N. Al Dawsari', 'Arabia Saudí', 'MID', 'Al Hilal'),
  ('Kanno', 'Arabia Saudí', 'MID', 'Al Hilal'),
  ('Al-Juwayr', 'Arabia Saudí', 'MID', 'Al Qadsiah'),
  ('Al-Johani', 'Arabia Saudí', 'MID', 'Al Ahli'),
  ('Alaa Hejji', 'Arabia Saudí', 'MID', 'Neom'),
  ('Al-Owais', 'Arabia Saudí', 'GK', 'Al Ula'),
  ('Al-Aqidi', 'Arabia Saudí', 'GK', 'Al Nassr'),
  ('Al-Kassar', 'Arabia Saudí', 'GK', 'Al Qadsiah'),
  ('Mandi', 'Argelia', 'DEF', 'LOSC Lille'),
  ('Aït-Nouri', 'Argelia', 'DEF', 'Manchester City'),
  ('Belghali', 'Argelia', 'DEF', 'KV Mechelen'),
  ('Belaïd', 'Argelia', 'DEF', 'Saint-Trond VV'),
  ('Achraf Abada', 'Argelia', 'DEF', 'MC Alger'),
  ('Chergui', 'Argelia', 'DEF', 'USM Alger'),
  ('Bensebaini', 'Argelia', 'DEF', 'Borussia Dortmund'),
  ('Hadjam', 'Argelia', 'DEF', 'BSC Young Boys'),
  ('Tougai', 'Argelia', 'DEF', 'Espérance de Tunis'),
  ('Mahrez', 'Argelia', 'FWD', 'Al-Ahli'),
  ('Boulbina', 'Argelia', 'FWD', 'Paradou AC'),
  ('Amoura', 'Argelia', 'FWD', 'VfL Wolfsburg'),
  ('Amine Gouiri', 'Argelia', 'FWD', 'Olympique de Marseille'),
  ('Hadj Moussa', 'Argelia', 'FWD', 'Feyenoord'),
  ('Benbouali', 'Argelia', 'FWD', 'Charleroi SC'),
  ('Ghedjemis', 'Argelia', 'FWD', 'FC Vizela'),
  ('Bentaleb', 'Argelia', 'MID', 'LOSC Lille'),
  ('Boudaoui', 'Argelia', 'MID', 'OGC Nice'),
  ('Zerrouki', 'Argelia', 'MID', 'Feyenoord'),
  ('Aouar', 'Argelia', 'MID', 'Al-Ittihad'),
  ('Ibrahim Maza', 'Argelia', 'MID', 'Bayer Leverkusen'),
  ('Titraoui', 'Argelia', 'MID', 'Charleroi SC'),
  ('Farès Chaïbi', 'Argelia', 'MID', 'Eintracht Frankfurt'),
  ('Luca Zidane', 'Argelia', 'GK', 'Granada CF'),
  ('Melvin Mastil', 'Argelia', 'GK', 'KVC Westerlo'),
  ('Benbout', 'Argelia', 'GK', 'USM Alger'),
  ('Leonardo Balerdi', 'Argentina', 'DEF', 'Marseille'),
  ('Lisandro Martínez', 'Argentina', 'DEF', 'Manchester United'),
  ('Facundo Medina', 'Argentina', 'DEF', 'Marseille'),
  ('Nahuel Molina', 'Argentina', 'DEF', 'Atletico Madrid'),
  ('Gonzalo Montiel', 'Argentina', 'DEF', 'River Plate'),
  ('Nicolas Otamendi', 'Argentina', 'DEF', 'Benfica'),
  ('Cristian Romero', 'Argentina', 'DEF', 'Tottenham'),
  ('Nicolas Tagliafico', 'Argentina', 'DEF', 'Lyon'),
  ('Thiago Almada', 'Argentina', 'FWD', 'Atletico Madrid'),
  ('Julian Alvarez', 'Argentina', 'FWD', 'Atletico Madrid'),
  ('Nicolas Gonzalez', 'Argentina', 'FWD', 'Atletico Madrid'),
  ('Jose Manuel Lopez', 'Argentina', 'FWD', 'Palmeiras'),
  ('Lautaro Martínez', 'Argentina', 'FWD', 'Inter Milan'),
  ('Lionel Messi', 'Argentina', 'FWD', 'Inter Miami'),
  ('Nicolas Paz', 'Argentina', 'FWD', 'Como'),
  ('Giuliano Simeone', 'Argentina', 'FWD', 'Atletico Madrid'),
  ('Emiliano Martínez', 'Argentina', 'MID', 'Aston Villa'),
  ('Valentín Barco', 'Argentina', 'MID', 'Strasbourg'),
  ('Rodrigo De Paul', 'Argentina', 'MID', 'Inter Miami'),
  ('Enzo Fernandez', 'Argentina', 'MID', 'Chelsea'),
  ('Giovani Lo Celso', 'Argentina', 'MID', 'Real Betis'),
  ('Alexis Mac Allister', 'Argentina', 'MID', 'Liverpool'),
  ('Exequiel Palacios', 'Argentina', 'MID', 'Bayer Leverkusen'),
  ('Leandro Paredes', 'Argentina', 'MID', 'Boca Juniors'),
  ('Juan Musso', 'Argentina', 'GK', 'Atletico Madrid'),
  ('Geronimo Rulli', 'Argentina', 'GK', 'Olympique de Marseille'),
  ('Aziz Behich', 'Australia', 'DEF', 'Melbourne City'),
  ('Milos Degenek', 'Australia', 'DEF', 'APOEL'),
  ('H. Souttar', 'Australia', 'DEF', 'Leicester'),
  ('Jacob Italiano', 'Australia', 'DEF', 'Grazer AK 1902'),
  ('Herrington', 'Australia', 'DEF', 'Colorado Rapids'),
  ('Circati', 'Australia', 'DEF', 'Parma'),
  ('Jason Geria', 'Australia', 'DEF', 'Albirex Niigata'),
  ('Burgess', 'Australia', 'DEF', 'Swansea'),
  ('Jordan Bos', 'Australia', 'DEF', 'Feyenoord'),
  ('Mathew Leckie', 'Australia', 'FWD', 'Melbourne City'),
  ('Mabil', 'Australia', 'FWD', 'Castellón'),
  ('Irankunda', 'Australia', 'FWD', 'Watford'),
  ('Velupillay', 'Australia', 'FWD', 'Melbourne City'),
  ('Tete Yengi', 'Australia', 'FWD', 'Machida Zelvia'),
  ('Mohamed Toure', 'Australia', 'FWD', 'Norwich'),
  ('Hrustic', 'Australia', 'MID', 'Heracles'),
  ('Devlin', 'Australia', 'MID', 'Hearts'),
  ('Jackson Irvine', 'Australia', 'MID', 'St. Pauli'),
  ('O''Neill', 'Australia', 'MID', 'New York City'),
  ('Kai Trewin', 'Australia', 'MID', 'New York City'),
  ('Okon', 'Australia', 'MID', 'Sydney FC'),
  ('Metcalfe', 'Australia', 'MID', 'St. Pauli'),
  ('Volpato', 'Australia', 'MID', 'Sassuolo'),
  ('Ryan', 'Australia', 'GK', 'Levante'),
  ('Beach', 'Australia', 'GK', 'Melbourne City'),
  ('Paul Izzo', 'Australia', 'GK', 'Randers'),
  ('David Affengruber', 'Austria', 'DEF', 'Elche'),
  ('Kevin Danso', 'Austria', 'DEF', 'Tottenham'),
  ('Stefan Posch', 'Austria', 'DEF', 'Como'),
  ('David Alaba', 'Austria', 'DEF', 'Real Madrid'),
  ('Philipp Lienhart', 'Austria', 'DEF', 'Freiburg'),
  ('Phillipp Mwene', 'Austria', 'DEF', 'Mainz'),
  ('Alexander Prass', 'Austria', 'DEF', 'Hoffenheim'),
  ('Marco Friedl', 'Austria', 'DEF', 'Werder Bremen'),
  ('Michael Svoboda', 'Austria', 'DEF', 'Venezia'),
  ('Marko Arnautovic', 'Austria', 'FWD', 'Red Star Belgrade'),
  ('Michael Gregoritsch', 'Austria', 'FWD', 'Brondby'),
  ('Sasa Kalajdzic', 'Austria', 'FWD', 'Wolves'),
  ('Xaver Schlager', 'Austria', 'MID', 'RB Leipzig'),
  ('Nicolas Seiwald', 'Austria', 'MID', 'RB Leipzig'),
  ('Marcel Sabitzer', 'Austria', 'MID', 'Borussia Dortmund'),
  ('Florian Grillitsch', 'Austria', 'MID', 'Braga'),
  ('Carney Chukwuemeka', 'Austria', 'MID', 'Borussia Dortmund'),
  ('Romano Schmid', 'Austria', 'MID', 'Werder Bremen'),
  ('Christoph Baumgartner', 'Austria', 'MID', 'Hoffenheim'),
  ('Konrad Laimer', 'Austria', 'MID', 'Bayern Munich'),
  ('Patrick Wimmer', 'Austria', 'MID', 'VfL Wolfsburg'),
  ('Paul Wanner', 'Austria', 'MID', 'PSV'),
  ('Alessandro Schopf', 'Austria', 'MID', 'Wolfsberger'),
  ('Alexander Schlager', 'Austria', 'GK', 'Red Bull Salzburg'),
  ('Florian Wiegele', 'Austria', 'GK', 'Viktoria Plzen'),
  ('Patrick Pentz', 'Austria', 'GK', 'Brondby'),
  ('Timothy Castagne', 'Bélgica', 'DEF', 'Fulham'),
  ('Zeno Debast', 'Bélgica', 'DEF', 'Sporting Lisbon'),
  ('Maxim De Cuyper', 'Bélgica', 'DEF', 'Brighton & Hove Albion'),
  ('Koni De Winter', 'Bélgica', 'DEF', 'AC Milan'),
  ('Brandon Mechele', 'Bélgica', 'DEF', 'Club Brugge'),
  ('Thomas Meunier', 'Bélgica', 'DEF', 'Lille'),
  ('Nathan Ngoy', 'Bélgica', 'DEF', 'Lille'),
  ('Joaquin Seys', 'Bélgica', 'DEF', 'Club Brugge'),
  ('Arthur Theate', 'Bélgica', 'DEF', 'Eintracht Frankfurt'),
  ('Charles De Ketelaere', 'Bélgica', 'FWD', 'Atalanta'),
  ('Jeremy Doku', 'Bélgica', 'FWD', 'Manchester City'),
  ('Matias Fernandez-Pardo', 'Bélgica', 'FWD', 'Lille'),
  ('Romelu Lukaku', 'Bélgica', 'FWD', 'Napoli'),
  ('Dodi Lukebakio', 'Bélgica', 'FWD', 'Benfica'),
  ('Alexis Saelemaekers', 'Bélgica', 'FWD', 'AC Milan'),
  ('Leandro Trossard', 'Bélgica', 'FWD', 'Arsenal'),
  ('Kevin De Bruyne', 'Bélgica', 'MID', 'Napoli'),
  ('Amadou Onana', 'Bélgica', 'MID', 'Aston Villa'),
  ('Nicolas Raskin', 'Bélgica', 'MID', 'Rangers'),
  ('Youri Tielemans', 'Bélgica', 'MID', 'Aston Villa'),
  ('Hans Vanaken', 'Bélgica', 'MID', 'Club Brugge'),
  ('Axel Witsel', 'Bélgica', 'MID', 'Girona'),
  ('Diego Moreira', 'Bélgica', 'MID', 'Racing Strasbourg'),
  ('Thibaut Courtois', 'Bélgica', 'GK', 'Real Madrid'),
  ('Senne Lammens', 'Bélgica', 'GK', 'Manchester United'),
  ('Mike Penders', 'Bélgica', 'GK', 'Racing Strasbourg'),
  ('Sead Kolasinac', 'Bosnia y Herzegovina', 'DEF', 'Atalanta'),
  ('Amar Dedic', 'Bosnia y Herzegovina', 'DEF', 'Benfica'),
  ('Nihad Mujakic', 'Bosnia y Herzegovina', 'DEF', 'Gaziantep'),
  ('Nikola Katic', 'Bosnia y Herzegovina', 'DEF', 'Schalke 04'),
  ('Tarik Muharemovic', 'Bosnia y Herzegovina', 'DEF', 'Sassuolo'),
  ('Stjepan Radeljic', 'Bosnia y Herzegovina', 'DEF', 'Rijeka'),
  ('Dennis Hadzikadunic', 'Bosnia y Herzegovina', 'DEF', 'Sampdoria'),
  ('Nidal Celik', 'Bosnia y Herzegovina', 'DEF', 'Lens'),
  ('Ermedin Demirovic', 'Bosnia y Herzegovina', 'FWD', 'VfB Stuttgart'),
  ('Jovo Lukic', 'Bosnia y Herzegovina', 'FWD', 'Universitatea Cluj'),
  ('Samed Bazdar', 'Bosnia y Herzegovina', 'FWD', 'Jagiellonia Bialystok'),
  ('Haris Tabakovic', 'Bosnia y Herzegovina', 'FWD', 'Borussia Moenchengladbach'),
  ('Edin Dzeko', 'Bosnia y Herzegovina', 'FWD', 'Schalke 04'),
  ('Amir Hadziahmetovic', 'Bosnia y Herzegovina', 'MID', 'Hull City'),
  ('Ivan Sunjic', 'Bosnia y Herzegovina', 'MID', 'Pafos'),
  ('Ivan Basic', 'Bosnia y Herzegovina', 'MID', 'Astana'),
  ('Dzenis Burnic', 'Bosnia y Herzegovina', 'MID', 'Karlsruher SC'),
  ('Ermin Mahmic', 'Bosnia y Herzegovina', 'MID', 'Slovan Liberec'),
  ('Benjamin Tahirovic', 'Bosnia y Herzegovina', 'MID', 'Brondby'),
  ('Amar Memic', 'Bosnia y Herzegovina', 'MID', 'Viktoria Plzen'),
  ('Armin Gigovic', 'Bosnia y Herzegovina', 'MID', 'Young Boys'),
  ('Kerim Alajbegovic', 'Bosnia y Herzegovina', 'MID', 'RB Salzburg'),
  ('Esmir Bajraktarevic', 'Bosnia y Herzegovina', 'MID', 'PSV Eindhoven'),
  ('Nikola Vasilj', 'Bosnia y Herzegovina', 'GK', 'St Pauli'),
  ('Martin Zlomislic', 'Bosnia y Herzegovina', 'GK', 'Rijeka'),
  ('Osman Hadzikic', 'Bosnia y Herzegovina', 'GK', 'Slaven Belupo'),
  ('Marquinhos', 'Brasil', 'DEF', 'PSG'),
  ('Gabriel', 'Brasil', 'DEF', 'Arsenal'),
  ('Bremer', 'Brasil', 'DEF', 'Juventus'),
  ('Ibanez', 'Brasil', 'DEF', 'Al Ahli'),
  ('Leo Pereira', 'Brasil', 'DEF', 'Flamengo'),
  ('Wesley', 'Brasil', 'DEF', 'Roma'),
  ('Danilo', 'Brasil', 'DEF', 'Flamengo'),
  ('Alex Sandro', 'Brasil', 'DEF', 'Flamengo'),
  ('Douglas Santos', 'Brasil', 'DEF', 'Zenit'),
  ('Vinicius Jr', 'Brasil', 'FWD', 'Real Madrid'),
  ('Raphinha', 'Brasil', 'FWD', 'Barcelona'),
  ('Matheus Cunha', 'Brasil', 'FWD', 'Manchester United'),
  ('Luiz Henrique', 'Brasil', 'FWD', 'Zenit'),
  ('Igor Thiago', 'Brasil', 'FWD', 'Brentford'),
  ('Endrick', 'Brasil', 'FWD', 'Lyon/Real Madrid'),
  ('Martinelli', 'Brasil', 'FWD', 'Arsenal'),
  ('Rayan', 'Brasil', 'FWD', 'Bournemouth'),
  ('Neymar', 'Brasil', 'FWD', 'Santos'),
  ('Casemiro', 'Brasil', 'MID', 'Manchester United'),
  ('Bruno Guimaraes', 'Brasil', 'MID', 'Newcastle'),
  ('Fabinho', 'Brasil', 'MID', 'Al Ittihad'),
  ('Danilo', 'Brasil', 'MID', 'Botafogo'),
  ('Lucas Paqueta', 'Brasil', 'MID', 'Flamengo'),
  ('Alisson', 'Brasil', 'GK', 'Liverpool'),
  ('Ederson', 'Brasil', 'GK', 'Fenerbahce'),
  ('Weverton', 'Brasil', 'GK', 'Gremio'),
  ('Stopira', 'Cabo Verde', 'DEF', 'Torreense'),
  ('Roberto Lopes', 'Cabo Verde', 'DEF', 'Shamrock Rovers'),
  ('Diney', 'Cabo Verde', 'DEF', 'Al Bataeh'),
  ('Logan Costa', 'Cabo Verde', 'DEF', 'Villarreal'),
  ('Steven Moreira', 'Cabo Verde', 'DEF', 'Columbus Crew'),
  ('Wagner Pina', 'Cabo Verde', 'DEF', 'Trabzonspor'),
  ('Sidny Lopes Cabral', 'Cabo Verde', 'DEF', 'Benfica'),
  ('Kelvin Pires', 'Cabo Verde', 'DEF', 'SJK'),
  ('Ryan Mendes', 'Cabo Verde', 'FWD', 'Igdir'),
  ('Garry Rodrigues', 'Cabo Verde', 'FWD', 'Apollon Limassol'),
  ('Willy Semedo', 'Cabo Verde', 'FWD', 'Omonia'),
  ('Jovane Cabral', 'Cabo Verde', 'FWD', 'Estrela Amadora'),
  ('Gilson Tavares', 'Cabo Verde', 'FWD', 'Akron Tolyatti'),
  ('Dailon Livramento', 'Cabo Verde', 'FWD', 'Casa Pia'),
  ('Helio Varela', 'Cabo Verde', 'FWD', 'Maccabi Tel Aviv'),
  ('Nuno da Costa', 'Cabo Verde', 'FWD', 'Istanbul Basaksehir'),
  ('Joao Paulo', 'Cabo Verde', 'MID', 'FCSB'),
  ('Jamiro Monteiro', 'Cabo Verde', 'MID', 'PEC Zwolle'),
  ('Kevin Pina', 'Cabo Verde', 'MID', 'Krasnodar'),
  ('Deroy Duarte', 'Cabo Verde', 'MID', 'Ludogorets'),
  ('Telmo Arcanjo', 'Cabo Verde', 'MID', 'Vitoria Guimaraes'),
  ('Laros Duarte', 'Cabo Verde', 'MID', 'Puskas Akademia'),
  ('Yannick Semedo', 'Cabo Verde', 'MID', 'Farense'),
  ('Vozinha', 'Cabo Verde', 'GK', 'Chaves'),
  ('Marcio Rosa', 'Cabo Verde', 'GK', 'Montana'),
  ('CJ dos Santos', 'Cabo Verde', 'GK', 'San Diego'),
  ('Davies', 'Canadá', 'DEF', 'Bayern de Múnich'),
  ('Waterman', 'Canadá', 'DEF', 'Chicago Fire'),
  ('Johnston', 'Canadá', 'DEF', 'Celtic'),
  ('Bombito', 'Canadá', 'DEF', 'Nice'),
  ('D. Cornelius', 'Canadá', 'DEF', 'Olympique Marsella'),
  ('Laryea', 'Canadá', 'DEF', 'Toronto'),
  ('De Fougerolles', 'Canadá', 'DEF', 'Fulham'),
  ('Alfie Jones', 'Canadá', 'DEF', 'Middlesbrough'),
  ('Shaffelburg', 'Canadá', 'FWD', 'LAFC'),
  ('Buchanan', 'Canadá', 'FWD', 'Villarreal'),
  ('Oluwaseyi', 'Canadá', 'FWD', 'Villarreal'),
  ('Cyle Larin', 'Canadá', 'FWD', 'Southampton'),
  ('Jonathan David', 'Canadá', 'FWD', 'Juventus'),
  ('Liam Millar', 'Canadá', 'FWD', 'Hull City'),
  ('Promise David', 'Canadá', 'FWD', 'Unión Saint-Gilloise'),
  ('Eustaquio', 'Canadá', 'MID', 'Oporto'),
  ('Ali Ahmed', 'Canadá', 'MID', 'Norwich'),
  ('Osorio', 'Canadá', 'MID', 'Toronto'),
  ('Koné', 'Canadá', 'MID', 'Sassuolo'),
  ('Niko Sigur', 'Canadá', 'MID', 'Hajduk Split'),
  ('Dylan Saliba', 'Canadá', 'MID', 'Anderlecht'),
  ('Choiniere', 'Canadá', 'MID', 'LAFC'),
  ('Crépeau', 'Canadá', 'GK', 'Orlando City'),
  ('St. Clair', 'Canadá', 'GK', 'Inter Miami'),
  ('Goodman', 'Canadá', 'GK', 'Barnsley'),
  ('Pedro Miguel', 'Catar', 'DEF', 'Al-Sadd'),
  ('Khoukhi', 'Catar', 'DEF', 'Al-Sadd'),
  ('Al-Amin', 'Catar', 'DEF', 'Cultural Leonesa'),
  ('Issa Laye', 'Catar', 'DEF', 'Al-Arabi'),
  ('Al-Hussain', 'Catar', 'DEF', 'Al-Arabi'),
  ('Al-Oui', 'Catar', 'DEF', 'Al-Gharafa'),
  ('Al-Brake', 'Catar', 'DEF', 'Al-Duhail'),
  ('Lucas Mendes', 'Catar', 'DEF', 'Al-Wakrah'),
  ('Muntari', 'Catar', 'FWD', 'Al-Gharafa'),
  ('Hasan Al Haydos', 'Catar', 'FWD', 'Al-Sadd'),
  ('Ahmed Alaa', 'Catar', 'FWD', 'Al-Rayyan'),
  ('Almoez Ali', 'Catar', 'FWD', 'Al-Duhail'),
  ('Akram Afif', 'Catar', 'FWD', 'Al-Sadd'),
  ('Mohammed Jamshid', 'Catar', 'FWD', 'Al-Arabi'),
  ('Edmílson Junior', 'Catar', 'FWD', 'Al-Duhail'),
  ('Al-Ganehi', 'Catar', 'FWD', 'Al-Gharafa'),
  ('Abdurisag', 'Catar', 'FWD', 'Al-Wakrah'),
  ('Ahmed Fathi', 'Catar', 'MID', 'Al-Arabi'),
  ('Abdelaziz Hatem', 'Catar', 'MID', 'Al-Rayyan'),
  ('Madibo', 'Catar', 'MID', 'Al-Wakrah'),
  ('Boudiaf', 'Catar', 'MID', 'Al-Duhail'),
  ('Jassem Gaber', 'Catar', 'MID', 'Al-Arabi'),
  ('Al-Mannai', 'Catar', 'MID', 'Al-Shamal'),
  ('Zakaria', 'Catar', 'GK', 'Al-Duhail'),
  ('Barsham', 'Catar', 'GK', 'Al-Sadd'),
  ('Abunada', 'Catar', 'GK', 'Al-Rayyan'),
  ('Davinson Sanchez', 'Colombia', 'DEF', 'Galatasaray'),
  ('Jhon Lucumi', 'Colombia', 'DEF', 'Bologna'),
  ('Yerry Mina', 'Colombia', 'DEF', 'Cagliari'),
  ('Willer Ditta', 'Colombia', 'DEF', 'Cruz Azul'),
  ('Daniel Munoz', 'Colombia', 'DEF', 'Crystal Palace'),
  ('Santiago Arias', 'Colombia', 'DEF', 'Independiente'),
  ('Johan Mojica', 'Colombia', 'DEF', 'Mallorca'),
  ('Deiver Machado', 'Colombia', 'DEF', 'Nantes'),
  ('Jhon Arias', 'Colombia', 'FWD', 'Palmeiras'),
  ('Juan Camilo Hernandez', 'Colombia', 'FWD', 'Real Betis'),
  ('Luis Diaz', 'Colombia', 'FWD', 'Bayern Munich'),
  ('Luis Suarez', 'Colombia', 'FWD', 'Sporting CP'),
  ('Carlos Andres Gomez', 'Colombia', 'FWD', 'Vasco da Gama'),
  ('Jhon Cordoba', 'Colombia', 'FWD', 'FC Krasnodar'),
  ('Richard Rios', 'Colombia', 'MID', 'Benfica'),
  ('Jefferson Lerma', 'Colombia', 'MID', 'Crystal Palace'),
  ('Kevin Castano', 'Colombia', 'MID', 'River Plate'),
  ('Juan Camilo Portilla', 'Colombia', 'MID', 'Athletico Paranaense'),
  ('Gustavo Puerta', 'Colombia', 'MID', 'Racing de Santander'),
  ('Jorge Carrascal', 'Colombia', 'MID', 'Flamengo'),
  ('Juan Fernando Quintero', 'Colombia', 'MID', 'River Plate'),
  ('James Rodriguez', 'Colombia', 'MID', 'Minnesota United'),
  ('Jaminton Campaz', 'Colombia', 'MID', 'Rosario Central'),
  ('Camilo Vargas', 'Colombia', 'GK', 'Atlas'),
  ('Alvaro Montero', 'Colombia', 'GK', 'Velez Sarsfield'),
  ('David Ospina', 'Colombia', 'GK', 'Atletico Nacional'),
  ('Moon-hwan Kim', 'Corea del Sur', 'DEF', 'Daejeon'),
  ('Min-jae Kim', 'Corea del Sur', 'DEF', 'Bayern Munich'),
  ('Tae-hyon Kim', 'Corea del Sur', 'DEF', 'Kashima Antlers'),
  ('Jin-seob Park', 'Corea del Sur', 'DEF', 'Zhejiang'),
  ('Young-woo Sool', 'Corea del Sur', 'DEF', 'Red Star Belgrade'),
  ('Jens Castrop', 'Corea del Sur', 'DEF', 'Borussia Monchengladbach'),
  ('Ki-hyuk Lee', 'Corea del Sur', 'DEF', 'Gangwon'),
  ('Tae-seok Lee', 'Corea del Sur', 'DEF', 'Austria Wien'),
  ('Han-beom Lee', 'Corea del Sur', 'DEF', 'Midtjylland'),
  ('Yu-min Cho', 'Corea del Sur', 'DEF', 'Sharjah'),
  ('Hee-chan Hwang', 'Corea del Sur', 'FWD', 'Wolves'),
  ('Heung-min Son', 'Corea del Sur', 'FWD', 'LAFC'),
  ('Hyeon-gyu Oh', 'Corea del Sur', 'FWD', 'Besitkas'),
  ('Gue-sung Cho', 'Corea del Sur', 'FWD', 'Midtjylland'),
  ('Jin-gyu Kim', 'Corea del Sur', 'MID', 'Jeonbuk'),
  ('Jun-ho Bae', 'Corea del Sur', 'MID', 'Stoke City'),
  ('Seung-ho Paik', 'Corea del Sur', 'MID', 'Birmingham'),
  ('Hyun-jun Yang', 'Corea del Sur', 'MID', 'Celtic'),
  ('Ji-sung Eom', 'Corea del Sur', 'MID', 'Swansea'),
  ('Kang-in Lee', 'Corea del Sur', 'MID', 'Paris St-Germain'),
  ('Dong-gyeong Lee', 'Corea del Sur', 'MID', 'Ulsan'),
  ('Jae-sung Lee', 'Corea del Sur', 'MID', 'Mainz'),
  ('In-beom Hwang', 'Corea del Sur', 'MID', 'Feyenoord'),
  ('Hyeon-woo Jo', 'Corea del Sur', 'GK', 'Ulsan'),
  ('Seung-gyu Kim', 'Corea del Sur', 'GK', 'FC Tokyo'),
  ('Bum-keun Song', 'Corea del Sur', 'GK', 'Jeonbuk'),
  ('Emmanuel Agbadou', 'Costa de Marfil', 'DEF', 'Beşiktaş'),
  ('Clément Akpa', 'Costa de Marfil', 'DEF', 'AJ Auxerre'),
  ('Ousmane Diomande', 'Costa de Marfil', 'DEF', 'Sporting'),
  ('Guela Doué', 'Costa de Marfil', 'DEF', 'Strasbourg'),
  ('Ghislain Konan', 'Costa de Marfil', 'DEF', 'Gil Vicente'),
  ('Odilon Kossounou', 'Costa de Marfil', 'DEF', 'Atalanta BC'),
  ('Evan Ndicka', 'Costa de Marfil', 'DEF', 'Roma'),
  ('Wilfried Singo', 'Costa de Marfil', 'DEF', 'Galatasaray'),
  ('Simon Adingra', 'Costa de Marfil', 'FWD', 'Monaco'),
  ('Ange-Yoan Bonny', 'Costa de Marfil', 'FWD', 'Inter Milan'),
  ('Oumar Diakité', 'Costa de Marfil', 'FWD', 'Cercle Brugge'),
  ('Yan Diomande', 'Costa de Marfil', 'FWD', 'RB Leipzig'),
  ('Evann Guessand', 'Costa de Marfil', 'FWD', 'Crystal Palace'),
  ('Nicolas Pépé', 'Costa de Marfil', 'FWD', 'Villarreal'),
  ('Bazoumana Touré', 'Costa de Marfil', 'FWD', 'Hoffenheim'),
  ('Elye Wahi', 'Costa de Marfil', 'FWD', 'Nice'),
  ('Seko Fofana', 'Costa de Marfil', 'MID', 'Porto'),
  ('Parfait Guiagon', 'Costa de Marfil', 'MID', 'Charleroi'),
  ('Christ Inao Oulaï', 'Costa de Marfil', 'MID', 'Trabzonspor'),
  ('Franck Kessié', 'Costa de Marfil', 'MID', 'Al Ahli'),
  ('Ibrahim Sangaré', 'Costa de Marfil', 'MID', 'Nottingham Forest'),
  ('Jean-Michaël Seri', 'Costa de Marfil', 'MID', 'Maribor'),
  ('Amad Diallo', 'Costa de Marfil', 'MID', 'Manchester United'),
  ('Yahia Fofana', 'Costa de Marfil', 'GK', 'Çaykur Rizespor'),
  ('Mohamed Koné', 'Costa de Marfil', 'GK', 'Charleroi'),
  ('Alban Lafont', 'Costa de Marfil', 'GK', 'Panathinaikos'),
  ('Josko Gvardiol', 'Croacia', 'DEF', 'Man City'),
  ('Duje Caleta-Car', 'Croacia', 'DEF', 'Real Sociedad'),
  ('Josip Sutalo', 'Croacia', 'DEF', 'Ajax'),
  ('Josip Stanisic', 'Croacia', 'DEF', 'Bayern Munich'),
  ('Marin Pongracic', 'Croacia', 'DEF', 'Fiorentina'),
  ('Martin Erlic', 'Croacia', 'DEF', 'Midtjylland'),
  ('Luka Vuskovic', 'Croacia', 'DEF', 'Hamburg'),
  ('Ivan Perisic', 'Croacia', 'FWD', 'PSV Eindhoven'),
  ('Andrej Kramaric', 'Croacia', 'FWD', 'Hoffenheim'),
  ('Ante Budimir', 'Croacia', 'FWD', 'Osasuna'),
  ('Marco Pasalic', 'Croacia', 'FWD', 'Orlando City'),
  ('Petar Musa', 'Croacia', 'FWD', 'Dallas'),
  ('Igor Matanovic', 'Croacia', 'FWD', 'Freiburg'),
  ('Luka Modric', 'Croacia', 'MID', 'AC Milan'),
  ('Mateo Kovacic', 'Croacia', 'MID', 'Man City'),
  ('Mario Pasalic', 'Croacia', 'MID', 'Atalanta'),
  ('Nikola Vlasic', 'Croacia', 'MID', 'Torino'),
  ('Luka Sucic', 'Croacia', 'MID', 'Real Sociedad'),
  ('Martin Baturina', 'Croacia', 'MID', 'Como'),
  ('Kristijan Jakic', 'Croacia', 'MID', 'Augsburg'),
  ('Petar Sucic', 'Croacia', 'MID', 'Inter Milan'),
  ('Nikola Moro', 'Croacia', 'MID', 'Bologna'),
  ('Toni Fruk', 'Croacia', 'MID', 'Rijeka'),
  ('Dominik Livakovic', 'Croacia', 'GK', 'Dinamo Zagreb'),
  ('Dominik Kotarski', 'Croacia', 'GK', 'Copenhagen'),
  ('Ivor Pandur', 'Croacia', 'GK', 'Hull'),
  ('Riechedly Bazoer', 'Curazao', 'DEF', 'Konyaspor'),
  ('Joshua Brenet', 'Curazao', 'DEF', 'Kayserispor'),
  ('Roshon Van Eijma', 'Curazao', 'DEF', 'RKC Waalwijk'),
  ('Sherel Floranus', 'Curazao', 'DEF', 'PEC Zwolle'),
  ('Deveron Fonville', 'Curazao', 'DEF', 'NEC Nijmegen'),
  ('Jurien Gaari', 'Curazao', 'DEF', 'Abha Club'),
  ('Armando Obispo', 'Curazao', 'DEF', 'PSV Eindhoven'),
  ('Shurandy Sambo', 'Curazao', 'DEF', 'Sparta Rotterdam'),
  ('Jeremy Antonisse', 'Curazao', 'FWD', 'AE Kifisia'),
  ('Kenji Gorré', 'Curazao', 'FWD', 'Maccabi Haifa'),
  ('Sontje Hansen', 'Curazao', 'FWD', 'Middlesbrough'),
  ('Gervane Kastaneer', 'Curazao', 'FWD', 'Terengganu FC'),
  ('Brandley Kuwas', 'Curazao', 'FWD', 'FC Volendam'),
  ('Jürgen Locadia', 'Curazao', 'FWD', 'Miami FC'),
  ('Jearl Margaritha', 'Curazao', 'FWD', 'SK Beveren'),
  ('Juninho Bacuna', 'Curazao', 'MID', 'FC Volendam'),
  ('Leandro Bacuna', 'Curazao', 'MID', 'Igdır'),
  ('Livano Comenencia', 'Curazao', 'MID', 'FC Zürich'),
  ('Kevin Felida', 'Curazao', 'MID', 'FC Den Bosch'),
  ('Ar''Jany Martha', 'Curazao', 'MID', 'Rotherham'),
  ('Tyrese Noslin', 'Curazao', 'MID', 'SC Telstar'),
  ('Godfried Roemeratoe', 'Curazao', 'MID', 'RKC Waalwijk'),
  ('Tahith Chong', 'Curazao', 'MID', 'Sheffield United'),
  ('Tyrick Bodak', 'Curazao', 'GK', 'SC Telstar'),
  ('Trevor Doornbusch', 'Curazao', 'GK', 'VVV-Venlo'),
  ('Eloy Room', 'Curazao', 'GK', 'Miami FC'),
  ('Félix Torres', 'Ecuador', 'DEF', 'Internacional'),
  ('Porozo', 'Ecuador', 'DEF', 'Club Tijuana'),
  ('Pacho', 'Ecuador', 'DEF', 'PSG'),
  ('Preciado', 'Ecuador', 'DEF', 'Atlético Mineiro'),
  ('Estupiñán', 'Ecuador', 'DEF', 'Milan'),
  ('Hincapié', 'Ecuador', 'DEF', 'Arsenal'),
  ('Joel Ordóñez', 'Ecuador', 'DEF', 'Brujas'),
  ('Yaimar Medina', 'Ecuador', 'DEF', 'KRC Genk'),
  ('Enner Valencia', 'Ecuador', 'FWD', 'Pachuca'),
  ('Gonzalo Plata', 'Ecuador', 'FWD', 'Flamengo'),
  ('Jordy Caicedo', 'Ecuador', 'FWD', 'Huracán'),
  ('Kevin Rodríguez', 'Ecuador', 'FWD', 'Unión Saint-Gilloise'),
  ('Anthony Valencia', 'Ecuador', 'FWD', 'Royal Antwerp'),
  ('Alan Minda', 'Ecuador', 'FWD', 'Cercle Brugge'),
  ('Arévalo', 'Ecuador', 'FWD', 'Stuttgart'),
  ('Nilson Angulo', 'Ecuador', 'FWD', 'Sunderland'),
  ('Moisés Caicedo', 'Ecuador', 'MID', 'Chelsea'),
  ('Kendry Páez', 'Ecuador', 'MID', 'River Plate'),
  ('Pedro Vite', 'Ecuador', 'MID', 'UNAM'),
  ('John Yeboah', 'Ecuador', 'MID', 'Venezia'),
  ('Alan Franco', 'Ecuador', 'MID', 'Atlético Mineiro'),
  ('Jordy Alcívar', 'Ecuador', 'MID', 'Independiente del Valle'),
  ('Denil Castillo', 'Ecuador', 'MID', 'Midtjylland'),
  ('Galíndez', 'Ecuador', 'GK', 'Huracán'),
  ('Moisés Ramírez', 'Ecuador', 'GK', 'AE Kifisias'),
  ('Gonzalo Valle', 'Ecuador', 'GK', 'Liga de Quito'),
  ('Mohamed Hany', 'Egipto', 'DEF', 'Al Ahly'),
  ('Tarek Alaa', 'Egipto', 'DEF', 'Zed'),
  ('Hamdy Fathy', 'Egipto', 'DEF', 'Al Wakrah'),
  ('Rami Rabia', 'Egipto', 'DEF', 'Al Ain'),
  ('Yasser Ibrahim', 'Egipto', 'DEF', 'Al Ahly'),
  ('Hossam Abdelmaguid', 'Egipto', 'DEF', 'Zamalek'),
  ('Mohamed Abdelmonemn', 'Egipto', 'DEF', 'Nice'),
  ('Ahmed Fatouh', 'Egipto', 'DEF', 'Zamalek'),
  ('Karim Hafez', 'Egipto', 'DEF', 'Pyramids'),
  ('Mostafa Ziko', 'Egipto', 'FWD', 'Pyramids'),
  ('Ibrahim Adel', 'Egipto', 'FWD', 'Nordsjaelland'),
  ('Haissem Hassan', 'Egipto', 'FWD', 'Real Ovideo'),
  ('Omar Marmoush', 'Egipto', 'FWD', 'Manchester City'),
  ('Mohamed Salah', 'Egipto', 'FWD', 'Liverpool'),
  ('Aqtay Abdallah', 'Egipto', 'FWD', 'Enppi'),
  ('Hamza Abdelkarim', 'Egipto', 'FWD', 'Barcelona'),
  ('Marwan Ateya', 'Egipto', 'MID', 'Al Ahly'),
  ('Mohanad Lasheen', 'Egipto', 'MID', 'Pyramids'),
  ('Nabil Emad', 'Egipto', 'MID', 'Al Najma'),
  ('Mahmoud Saber', 'Egipto', 'MID', 'Zed'),
  ('Ahmed Zizo', 'Egipto', 'MID', 'Al Ahly'),
  ('Emam Ashour', 'Egipto', 'MID', 'Al Ahly'),
  ('Mahmoud Trezeguet', 'Egipto', 'MID', 'Al Ahly'),
  ('Mohamed El Shenawy', 'Egipto', 'GK', 'Al Ahly'),
  ('Mostafa Shobeir', 'Egipto', 'GK', 'Al Ahly'),
  ('El Mahdi Soliman', 'Egipto', 'GK', 'Zamalek'),
  ('Mohamed Alaa', 'Egipto', 'GK', 'El Gouna'),
  ('Grant Hanley', 'Escocia', 'DEF', 'Hibernian'),
  ('Jack Hendry', 'Escocia', 'DEF', 'Al Etiffaq'),
  ('Aaron Hickey', 'Escocia', 'DEF', 'Brentford'),
  ('Dom Hyam', 'Escocia', 'DEF', 'Wrexham'),
  ('Scott McKenna', 'Escocia', 'DEF', 'Dinamo Zagreb'),
  ('Nathan Patterson', 'Escocia', 'DEF', 'Everton'),
  ('Anthony Ralston', 'Escocia', 'DEF', 'Celtic'),
  ('Andy Robertson', 'Escocia', 'DEF', 'Liverpool'),
  ('John Souttar', 'Escocia', 'DEF', 'Rangers'),
  ('Kieran Tierney', 'Escocia', 'DEF', 'Celtic'),
  ('Findlay Curtis', 'Escocia', 'FWD', 'Kilmarnock'),
  ('Che Adams', 'Escocia', 'FWD', 'Torino'),
  ('Lyndon Dykes', 'Escocia', 'FWD', 'Charlton Athletic'),
  ('George Hirst', 'Escocia', 'FWD', 'Ipswich'),
  ('Lawrence Shankland', 'Escocia', 'FWD', 'Hearts'),
  ('Ross Stewart', 'Escocia', 'FWD', 'Southampton'),
  ('Ryan Christie', 'Escocia', 'MID', 'Bournemouth'),
  ('Lewis Ferguson', 'Escocia', 'MID', 'Bologna'),
  ('Ben Gannon-Doak', 'Escocia', 'MID', 'Bournemouth'),
  ('Billy Gilmour', 'Escocia', 'MID', 'Napoli'),
  ('John McGinn', 'Escocia', 'MID', 'Aston Villa'),
  ('Kenny McLean', 'Escocia', 'MID', 'Norwich'),
  ('Scott McTominay', 'Escocia', 'MID', 'Napoli'),
  ('Craig Gordon', 'Escocia', 'GK', 'Hearts'),
  ('Angus Gunn', 'Escocia', 'GK', 'Nottingham Forest'),
  ('Liam Kelly', 'Escocia', 'GK', 'Rangers'),
  ('Aymeric Laporte', 'España', 'DEF', 'Athletic Club'),
  ('Marc Cucurella', 'España', 'DEF', 'Chelsea'),
  ('Marcos Llorente', 'España', 'DEF', 'Atletico Madrid'),
  ('Eric Garcia', 'España', 'DEF', 'Barcelona'),
  ('Pedro Porro', 'España', 'DEF', 'Tottenham'),
  ('Alex Grimaldo', 'España', 'DEF', 'Bayer Leverkusen'),
  ('Pau Cubarsi', 'España', 'DEF', 'Barcelona'),
  ('Marc Pubill', 'España', 'DEF', 'Atletico Madrid'),
  ('Ferran Torres', 'España', 'FWD', 'Barcelona'),
  ('Mikel Oyarzabal', 'España', 'FWD', 'Real Sociedad'),
  ('Nico Williams', 'España', 'FWD', 'Athletic Club'),
  ('Lamine Yamal', 'España', 'FWD', 'Barcelona'),
  ('Yeremy Pino', 'España', 'FWD', 'Crystal Palace'),
  ('Borja Iglesias', 'España', 'FWD', 'Celta Vigo'),
  ('Victor Munoz', 'España', 'FWD', 'Osasuna'),
  ('Rodri', 'España', 'MID', 'Manchester City'),
  ('Fabian Ruiz', 'España', 'MID', 'Paris Saint-Germain'),
  ('Mikel Merino', 'España', 'MID', 'Arsenal'),
  ('Pedri', 'España', 'MID', 'Barcelona'),
  ('Gavi', 'España', 'MID', 'Barcelona'),
  ('Martin Zubimendi', 'España', 'MID', 'Arsenal'),
  ('Alex Baena', 'España', 'MID', 'Atletico Madrid'),
  ('Dani Olmo', 'España', 'MID', 'Barcelona'),
  ('Unai Simon', 'España', 'GK', 'Athletic Club'),
  ('David Raya', 'España', 'GK', 'Arsenal'),
  ('Joan Garcia', 'España', 'GK', 'Barcelona'),
  ('Sergiño Dest', 'Estados Unidos', 'DEF', 'PSV Eindhoven'),
  ('Alex Freeman', 'Estados Unidos', 'DEF', 'Villarreal'),
  ('Mark McKenzie', 'Estados Unidos', 'DEF', 'Toulouse'),
  ('Tim Ream', 'Estados Unidos', 'DEF', 'Charlotte FC'),
  ('Chris Richards', 'Estados Unidos', 'DEF', 'Crystal Palace'),
  ('Antonee Robinson', 'Estados Unidos', 'DEF', 'Fulham'),
  ('Miles Robinson', 'Estados Unidos', 'DEF', 'FC Cincinnati'),
  ('Joe Scally', 'Estados Unidos', 'DEF', 'Borussia Mönchengladbach'),
  ('Auston Trusty', 'Estados Unidos', 'DEF', 'Celtic'),
  ('Max Arfsten', 'Estados Unidos', 'FWD', 'Columbus Crew'),
  ('Brenden Aaronson', 'Estados Unidos', 'FWD', 'Leeds United'),
  ('Folarin Balogun', 'Estados Unidos', 'FWD', 'Monaco'),
  ('Ricardo Pepi', 'Estados Unidos', 'FWD', 'PSV Eindhoven'),
  ('Christian Pulisic', 'Estados Unidos', 'FWD', 'AC Milan'),
  ('Tim Weah', 'Estados Unidos', 'FWD', 'Marseille'),
  ('Haji Wright', 'Estados Unidos', 'FWD', 'Coventry City'),
  ('Alejandro Zendejas', 'Estados Unidos', 'FWD', 'Club América'),
  ('Tyler Adams', 'Estados Unidos', 'MID', 'AFC Bournemouth'),
  ('Sebastian Berhalter', 'Estados Unidos', 'MID', 'Vancouver Whitecaps'),
  ('Weston McKennie', 'Estados Unidos', 'MID', 'Juventus'),
  ('Gio Reyna', 'Estados Unidos', 'MID', 'Borussia Mönchengladbach'),
  ('Cristian Roldan', 'Estados Unidos', 'MID', 'Seattle Sounders'),
  ('Malik Tillman', 'Estados Unidos', 'MID', 'Bayer Leverkusen'),
  ('Chris Brady', 'Estados Unidos', 'GK', 'Chicago Fire'),
  ('Matt Freese', 'Estados Unidos', 'GK', 'New York City FC'),
  ('Matt Turner', 'Estados Unidos', 'GK', 'New England Revolution'),
  ('Lucas Digne', 'Francia', 'DEF', 'Aston Villa'),
  ('Malo Gusto', 'Francia', 'DEF', 'Chelsea'),
  ('Lucas Hernández', 'Francia', 'DEF', 'Paris Saint-Germain'),
  ('Theo Hernández', 'Francia', 'DEF', 'Al Hilal'),
  ('Ibrahima Konaté', 'Francia', 'DEF', 'Liverpool'),
  ('Jules Koundé', 'Francia', 'DEF', 'Barcelona'),
  ('Maxence Lacroix', 'Francia', 'DEF', 'Crystal Palace'),
  ('William Saliba', 'Francia', 'DEF', 'Arsenal'),
  ('Dayot Upamecano', 'Francia', 'DEF', 'Bayern Munich'),
  ('Maghnes Akliouche', 'Francia', 'FWD', 'AS Monaco'),
  ('Bradley Barcola', 'Francia', 'FWD', 'Paris Saint-Germain'),
  ('Rayan Cherki', 'Francia', 'FWD', 'Manchester City'),
  ('Ousmane Dembélé', 'Francia', 'FWD', 'Paris Saint-Germain'),
  ('Désiré Doué', 'Francia', 'FWD', 'Paris Saint-Germain'),
  ('Jean-Philippe Mateta', 'Francia', 'FWD', 'Crystal Palace'),
  ('Kylian Mbappé', 'Francia', 'FWD', 'Real Madrid'),
  ('Michael Olise', 'Francia', 'FWD', 'Bayern Munich'),
  ('Marcus Thuram', 'Francia', 'FWD', 'Inter Milan'),
  ('N''Golo Kanté', 'Francia', 'MID', 'Fenerbahçe'),
  ('Manu Koné', 'Francia', 'MID', 'AS Roma'),
  ('Adrien Rabiot', 'Francia', 'MID', 'AC Milan'),
  ('Aurélien Tchouaméni', 'Francia', 'MID', 'Real Madrid'),
  ('Warren Zaïre-Emery', 'Francia', 'MID', 'Paris Saint-Germain'),
  ('Mike Maignan', 'Francia', 'GK', 'AC Milan'),
  ('Robin Risser', 'Francia', 'GK', 'Lens'),
  ('Brice Samba', 'Francia', 'GK', 'Rennes'),
  ('Mumin', 'Ghana', 'DEF', 'Rayo Vallecano'),
  ('Seidu', 'Ghana', 'DEF', 'Stade Rennais'),
  ('Mensah', 'Ghana', 'DEF', 'Auxerre'),
  ('Opoku', 'Ghana', 'DEF', 'Estambul Basaksehir'),
  ('Senaya', 'Ghana', 'DEF', 'Auxerre'),
  ('Abdul Rahman', 'Ghana', 'DEF', 'PAOK'),
  ('Adjetey', 'Ghana', 'DEF', 'Wolsfburgo'),
  ('Oppong', 'Ghana', 'DEF', 'Niza'),
  ('Jordan Ayew', 'Ghana', 'FWD', 'Leicester City'),
  ('Fatawu', 'Ghana', 'FWD', 'Leicester City'),
  ('K. Sulemana', 'Ghana', 'FWD', 'Atalanta'),
  ('Semenyo', 'Ghana', 'FWD', 'Manchester City'),
  ('Iñaki Williams', 'Ghana', 'FWD', 'Athletic Club'),
  ('Prince Adu', 'Ghana', 'FWD', 'Viktoria Plzen'),
  ('Nuamah', 'Ghana', 'FWD', 'Lyon'),
  ('Bonsu Baah', 'Ghana', 'FWD', 'Al-Qadisiyah'),
  ('Thomas-Asante', 'Ghana', 'FWD', 'Coventry City'),
  ('Thomas Partey', 'Ghana', 'MID', 'Villarreal'),
  ('Owusu', 'Ghana', 'MID', 'Auxerre'),
  ('Yirenkyi', 'Ghana', 'MID', 'Nordsjaelland'),
  ('Sibo', 'Ghana', 'MID', 'Oviedo'),
  ('Boakye', 'Ghana', 'MID', 'Saint-Ettiene'),
  ('Ati-Zigi', 'Ghana', 'GK', 'St. Gallen'),
  ('Joseph Anang', 'Ghana', 'GK', 'St. Patrick Athletic'),
  ('Asare', 'Ghana', 'GK', 'Hearts of Oak'),
  ('Carlens Arcus', 'Haití', 'DEF', 'Angers'),
  ('Wilguens Pauguain', 'Haití', 'DEF', 'Zulte Waregem'),
  ('Duke Lacroix', 'Haití', 'DEF', 'Colorado Springs'),
  ('Martin Expérience', 'Haití', 'DEF', 'Nancy'),
  ('Jean-Kevin Duverne', 'Haití', 'DEF', 'KAA Gent'),
  ('Ricardo Ade', 'Haití', 'DEF', 'LDU Quito'),
  ('Hannes Delcroix', 'Haití', 'DEF', 'Lugano'),
  ('Keeto Thermoncy', 'Haití', 'DEF', 'Young Boys Berne'),
  ('Louicius Deedson', 'Haití', 'FWD', 'Dallas'),
  ('Ruben Providence', 'Haití', 'FWD', 'Almere City'),
  ('Josue Casimir', 'Haití', 'FWD', 'Auxerre'),
  ('Derrick Etienne', 'Haití', 'FWD', 'Toronto'),
  ('Wilson Isidor', 'Haití', 'FWD', 'Sunderland'),
  ('Duckens Nazon', 'Haití', 'FWD', 'Esteghlal'),
  ('Frantzdy Pierrot', 'Haití', 'FWD', 'Caykur Rizespor'),
  ('Yassin Fortune', 'Haití', 'FWD', 'Vizela'),
  ('Lenny Joseph', 'Haití', 'FWD', 'Ferencvaros'),
  ('Leverton Pierre', 'Haití', 'MID', 'Vizela'),
  ('Carl-Fred Sainthe', 'Haití', 'MID', 'El Paso Locomotive'),
  ('Jean-Jacques Danley', 'Haití', 'MID', 'Philadelphia Union'),
  ('Jean-Ricner Bellegarde', 'Haití', 'MID', 'Wolves'),
  ('Pierre Woodenski', 'Haití', 'MID', 'Violette'),
  ('Dominique Simon', 'Haití', 'MID', 'Tatran Presov'),
  ('Johnny Placide', 'Haití', 'GK', 'Bastia'),
  ('Alexandre Pierre', 'Haití', 'GK', 'Sochaux'),
  ('Josue Duverger', 'Haití', 'GK', 'FC Cosmos Koblenz'),
  ('Reece James', 'Inglaterra', 'DEF', 'Chelsea'),
  ('Ezri Konsa', 'Inglaterra', 'DEF', 'Aston Villa'),
  ('Jarell Quansah', 'Inglaterra', 'DEF', 'Bayer Leverkusen'),
  ('John Stones', 'Inglaterra', 'DEF', 'Manchester City'),
  ('Marc Guehi', 'Inglaterra', 'DEF', 'Manchester City'),
  ('Dan Burn', 'Inglaterra', 'DEF', 'Newcastle'),
  ('Nico O''Reilly', 'Inglaterra', 'DEF', 'Manchester City'),
  ('Djed Spence', 'Inglaterra', 'DEF', 'Tottenham'),
  ('Tino Livramento', 'Inglaterra', 'DEF', 'Newcastle'),
  ('Harry Kane', 'Inglaterra', 'FWD', 'Bayern Munich'),
  ('Ivan Toney', 'Inglaterra', 'FWD', 'Al Ahli'),
  ('Ollie Watkins', 'Inglaterra', 'FWD', 'Aston Villa'),
  ('Bukayo Saka', 'Inglaterra', 'FWD', 'Arsenal'),
  ('Marcus Rashford', 'Inglaterra', 'FWD', 'Barcelona'),
  ('Anthony Gordon', 'Inglaterra', 'FWD', 'Newcastle'),
  ('Noni Madueke', 'Inglaterra', 'FWD', 'Arsenal'),
  ('Declan Rice', 'Inglaterra', 'MID', 'Arsenal'),
  ('Elliot Anderson', 'Inglaterra', 'MID', 'Nottingham Forest'),
  ('Kobbie Mainoo', 'Inglaterra', 'MID', 'Manchester United'),
  ('Jordan Henderson', 'Inglaterra', 'MID', 'Brentford'),
  ('Morgan Rogers', 'Inglaterra', 'MID', 'Aston Villa'),
  ('Jude Bellingham', 'Inglaterra', 'MID', 'Real Madrid'),
  ('Eberechi Eze', 'Inglaterra', 'MID', 'Arsenal'),
  ('Jordan Pickford', 'Inglaterra', 'GK', 'Everton'),
  ('Dean Henderson', 'Inglaterra', 'GK', 'Crystal Palace'),
  ('James Trafford', 'Inglaterra', 'GK', 'Manchester City'),
  ('Frans Putros', 'Irak', 'DEF', 'PERSIB Bandung'),
  ('Hussein Ali', 'Irak', 'DEF', 'Pogon Szczecin'),
  ('Zaid Tahseen', 'Irak', 'DEF', 'Pakhtakor Tashkent'),
  ('Sulaka', 'Irak', 'DEF', 'Port FC'),
  ('Hashem', 'Irak', 'DEF', 'Al-Zawraa'),
  ('Doski', 'Irak', 'DEF', 'Viktoria Plzen'),
  ('Younis', 'Irak', 'DEF', 'Al-Shorta'),
  ('Ahmed Yahya', 'Irak', 'DEF', 'Al-Shorta'),
  ('Saadoon', 'Irak', 'DEF', 'Al-Shorta'),
  ('Al Hamadi', 'Irak', 'FWD', 'Luton Town'),
  ('Mimi', 'Irak', 'FWD', 'Dibba SCC'),
  ('Hussein', 'Irak', 'FWD', 'Al-Karma'),
  ('Ali Yousif', 'Irak', 'FWD', 'Al-Talaba'),
  ('Ahmed Qasem', 'Irak', 'FWD', 'Nashville SC'),
  ('Marko Farji', 'Irak', 'MID', 'Venezia'),
  ('Aimar Sher', 'Irak', 'MID', 'Sarpsborg 08 FF'),
  ('Ali Jasim', 'Irak', 'MID', 'Al-Najma'),
  ('Al Ammari', 'Irak', 'MID', 'Cracovia'),
  ('Zidane Iqbal', 'Irak', 'MID', 'Utrecht'),
  ('Amyn', 'Irak', 'MID', 'AEK Larnaca'),
  ('Bayesh', 'Irak', 'MID', 'Al-Dhafra'),
  ('Kevin Yakob', 'Irak', 'MID', 'Aarhus GF'),
  ('Ismail', 'Irak', 'MID', 'Al-Talaba'),
  ('Ahmed Basil', 'Irak', 'GK', 'Al-Shorta'),
  ('Fahad Talib', 'Irak', 'GK', 'Al-Talaba'),
  ('Jalal Hassan', 'Irak', 'GK', 'Al-Zawraa'),
  ('Hajsafi', 'Irán', 'DEF', 'Sepahan'),
  ('Rezaeian', 'Irán', 'DEF', 'Foolad'),
  ('Mohammadi', 'Irán', 'DEF', 'Persepolis'),
  ('Khalilzadeh', 'Irán', 'DEF', 'Tractor FC'),
  ('Kanaani', 'Irán', 'DEF', 'Persepolis'),
  ('Yousefi', 'Irán', 'DEF', 'Sepahan'),
  ('Ali Nemati', 'Irán', 'DEF', 'Foolad FC'),
  ('Hardani', 'Irán', 'DEF', 'Esteghlal'),
  ('Danial Eiri', 'Irán', 'DEF', 'Malavan Bandar Anzali'),
  ('Jahanbakhsh', 'Irán', 'FWD', 'FCV Dender EH'),
  ('Ghoddos', 'Irán', 'FWD', 'Kalba'),
  ('Taremi', 'Irán', 'FWD', 'Olympiacos'),
  ('Dargahi', 'Irán', 'FWD', 'Standard de Lieja'),
  ('Mohebi', 'Irán', 'FWD', 'FK Rostov'),
  ('Ali Alipour', 'Irán', 'FWD', 'Persepolis'),
  ('Mehdi Ghayedi', 'Irán', 'FWD', 'Al-Nasr'),
  ('Hosseinzadeh', 'Irán', 'FWD', 'Tractor FC'),
  ('Moghanlou', 'Irán', 'FWD', 'Kalba'),
  ('Ezatolahi', 'Irán', 'MID', 'Shabab Al-Ahli Club'),
  ('Cheshmi', 'Irán', 'MID', 'Esteghlal'),
  ('Razzaghinia', 'Irán', 'MID', 'Esteghlal'),
  ('Ghorbani', 'Irán', 'MID', 'Al-Wahda'),
  ('Beiranvand', 'Irán', 'GK', 'Tractor FC'),
  ('Hossein Hosseini', 'Irán', 'GK', 'Sepahan'),
  ('Niazmand', 'Irán', 'GK', 'Persepolis'),
  ('Yuto Nagatomo', 'Japón', 'DEF', 'FC Tokyo'),
  ('Shogo Taniguchi', 'Japón', 'DEF', 'Sint-Truiden'),
  ('Ko Itakura', 'Japón', 'DEF', 'Ajax'),
  ('Tsuyoshi Watanabe', 'Japón', 'DEF', 'Feyenoord'),
  ('Takehiro Tomiyasu', 'Japón', 'DEF', 'Ajax'),
  ('Hiroki Ito', 'Japón', 'DEF', 'Bayern Munich'),
  ('Yukinari Sugawara', 'Japón', 'DEF', 'Werder Bremen'),
  ('Junosuke Suzuki', 'Japón', 'DEF', 'FC Copenhagen'),
  ('Junya Ito', 'Japón', 'FWD', 'Genk'),
  ('Ayase Ueda', 'Japón', 'FWD', 'Feyenoord'),
  ('Keito Nakamura', 'Japón', 'FWD', 'Stade de Reims'),
  ('Ito Suzuki', 'Japón', 'FWD', 'SC Freiburg'),
  ('Kento Shiode', 'Japón', 'FWD', 'Wolfsburg'),
  ('Keisuke Goto', 'Japón', 'FWD', 'Sint-Truiden'),
  ('Ayumu Seko', 'Japón', 'MID', 'Le Havre AC'),
  ('Wataru Endo', 'Japón', 'MID', 'Liverpool'),
  ('Daichi Kamada', 'Japón', 'MID', 'Crystal Palace'),
  ('Koki Ogawa', 'Japón', 'MID', 'NEC Nijmegen'),
  ('Daizen Maeda', 'Japón', 'MID', 'Celtic'),
  ('Ritsu Doan', 'Japón', 'MID', 'Eintracht Frankfurt'),
  ('Ao Tanaka', 'Japón', 'MID', 'Leeds United'),
  ('Kaishu Sano', 'Japón', 'MID', 'Mainz 05'),
  ('Takefusa Kubo', 'Japón', 'MID', 'Real Sociedad'),
  ('Tomoki Hayakawa', 'Japón', 'GK', 'Kashima Antlers'),
  ('Keisuke Osako', 'Japón', 'GK', 'Sanfrecce Hiroshima'),
  ('Aya Suzuka', 'Japón', 'GK', 'Parma Calcio'),
  ('Abu Hasheesh', 'Jordania', 'DEF', 'Al-Karma'),
  ('M. Taha', 'Jordania', 'DEF', 'Al-Hussein'),
  ('Obaid', 'Jordania', 'DEF', 'Al-Hussein'),
  ('Nasib', 'Jordania', 'DEF', 'Al-Zawraa'),
  ('Al Rosan', 'Jordania', 'DEF', 'Al-Hussein'),
  ('Abu Taha', 'Jordania', 'DEF', 'Al-Hussein'),
  ('Ehsan Haddad', 'Jordania', 'DEF', 'Al-Hussein'),
  ('Al-Arab', 'Jordania', 'DEF', 'FC Seúl'),
  ('Abualnadi', 'Jordania', 'DEF', 'Selangor'),
  ('Al Mardi', 'Jordania', 'FWD', 'Al-Hussein'),
  ('Shararh', 'Jordania', 'FWD', 'Al-Faisaly'),
  ('Ali Olwan', 'Jordania', 'FWD', 'Al-Sailiya'),
  ('Mousa Tamari', 'Jordania', 'FWD', 'Stade Rennais'),
  ('Ibrahim Sabra', 'Jordania', 'FWD', 'Lokomotiv Zagreb'),
  ('Al-Azaizeh', 'Jordania', 'FWD', 'Al-Shabab'),
  ('Amer Jamous', 'Jordania', 'MID', 'Al-Zawraa'),
  ('Abu Dahab', 'Jordania', 'MID', 'Al-Faisaly'),
  ('Saadeh', 'Jordania', 'MID', 'Al-Karma'),
  ('Al Rashdan', 'Jordania', 'MID', 'Qatar SC'),
  ('Rajaei Ayed', 'Jordania', 'MID', 'Al-Hussein'),
  ('Al-Rawabdeh', 'Jordania', 'MID', 'Selangor'),
  ('Al-Dawoud', 'Jordania', 'MID', 'Al-Wehdat'),
  ('Bani Attiah', 'Jordania', 'GK', 'Al-Faisaly'),
  ('Abulaila', 'Jordania', 'GK', 'Al-Hussein'),
  ('Al-Fakhouri', 'Jordania', 'GK', 'Al-Wehdat'),
  ('Noussair Mazraoui', 'Marruecos', 'DEF', 'Manchester United'),
  ('Anass Salah-Eddine', 'Marruecos', 'DEF', 'PSV Eindhoven'),
  ('Youssef Belammari', 'Marruecos', 'DEF', 'Al Ahly'),
  ('Nayef Aguerd', 'Marruecos', 'DEF', 'Marseille'),
  ('Chadi Riad', 'Marruecos', 'DEF', 'Crystal Palace'),
  ('Issa Diop', 'Marruecos', 'DEF', 'West Ham United'),
  ('Redouane Halhal', 'Marruecos', 'DEF', 'KV Mechelen'),
  ('Achraf Hakimi', 'Marruecos', 'DEF', 'Paris St-Germain'),
  ('Zakaria El Ouahdi', 'Marruecos', 'DEF', 'Genk'),
  ('Abdessamad Ezzalzouli', 'Marruecos', 'FWD', 'Real Betis'),
  ('Chemsdine Talbi', 'Marruecos', 'FWD', 'Sunderland'),
  ('Soufiane Rahimi', 'Marruecos', 'FWD', 'Al Ain'),
  ('Ayoub El Kaabi', 'Marruecos', 'FWD', 'Olympiacos'),
  ('Brahim Diaz', 'Marruecos', 'FWD', 'Real Madrid'),
  ('Yassine Gessime', 'Marruecos', 'FWD', 'Strasbourg'),
  ('Ayoub Amaimouni-Echghouyabe', 'Marruecos', 'FWD', 'Eintracht Frankfurt'),
  ('Samir El Mourabet', 'Marruecos', 'MID', 'Strasbourg'),
  ('Ayyoub Bouaddi', 'Marruecos', 'MID', 'Lille'),
  ('Neil El Aynaoui', 'Marruecos', 'MID', 'Roma'),
  ('Sofyan Amrabat', 'Marruecos', 'MID', 'Real Betis'),
  ('Azzedine Ounahi', 'Marruecos', 'MID', 'Girona'),
  ('Bilal El Khannouss', 'Marruecos', 'MID', 'Stuttgart'),
  ('Ismael Saibari', 'Marruecos', 'MID', 'PSV Eindhoven'),
  ('Yassine Bounou', 'Marruecos', 'GK', 'Al Hilal'),
  ('Munir Mohamedi', 'Marruecos', 'GK', 'RS Berkane'),
  ('Ahmed Tagnaouti', 'Marruecos', 'GK', 'Royal Armed Forces'),
  ('Johan Vásquez', 'México', 'DEF', 'Genoa'),
  ('Israel Reyes', 'México', 'DEF', 'América'),
  ('Jorge Sánchez', 'México', 'DEF', 'Cruz Azul'),
  ('Jesús Gallardo', 'México', 'DEF', 'Toluca'),
  ('César Montes', 'México', 'DEF', 'Lokomotiv Moscú'),
  ('Mateo Chávez', 'México', 'DEF', 'AZ Alkmaar'),
  ('Julián Quiñones', 'México', 'FWD', 'Al Qadsiah'),
  ('Raúl Jiménez', 'México', 'FWD', 'Fulham'),
  ('Guillermo Martínez', 'México', 'FWD', 'Pumas'),
  ('Alexis Vega', 'México', 'FWD', 'Toluca'),
  ('César Huerta', 'México', 'FWD', 'Anderlecht'),
  ('Santiago Giménez', 'México', 'FWD', 'Milan'),
  ('Armando González', 'México', 'FWD', 'Chivas'),
  ('Luis Romo', 'México', 'MID', 'Chivas'),
  ('Edson Álvarez', 'México', 'MID', 'West Ham'),
  ('Orbelín Pineda', 'México', 'MID', 'AEK Atenas'),
  ('Roberto Alvarado', 'México', 'MID', 'Chivas'),
  ('Luis Chávez', 'México', 'MID', 'Dinamo Moscú'),
  ('Érik Lira', 'México', 'MID', 'Cruz Azul'),
  ('Álvaro Fidalgo', 'México', 'MID', 'Betis'),
  ('Obed Vargas', 'México', 'MID', 'Atlético de Madrid'),
  ('Gilberto Mora', 'México', 'MID', 'Tijuana'),
  ('Brian Gutiérrez', 'México', 'MID', 'Chivas'),
  ('Carlos Acevedo', 'México', 'GK', 'Santos Laguna'),
  ('Ochoa', 'México', 'GK', 'AEL Limassol'),
  ('Rangel', 'México', 'GK', 'Chivas'),
  ('Julian Ryerson', 'Noruega', 'DEF', 'Borussia Dortmund'),
  ('Marcus Holmgren Pedersen', 'Noruega', 'DEF', 'Torino'),
  ('David Moller Wolfe', 'Noruega', 'DEF', 'Wolverhampton'),
  ('Fredrik Bjorkan', 'Noruega', 'DEF', 'Bodo/Glimt'),
  ('Kristoffer Ajer', 'Noruega', 'DEF', 'Brentford'),
  ('Torbjorn Heggem', 'Noruega', 'DEF', 'Bologna'),
  ('Leo Skiri Ostigard', 'Noruega', 'DEF', 'Genoa'),
  ('Sondre Langas', 'Noruega', 'DEF', 'Derby County'),
  ('Henrik Falchener', 'Noruega', 'DEF', 'Viking'),
  ('Erling Haaland', 'Noruega', 'FWD', 'Manchester City'),
  ('Alexander Sorloth', 'Noruega', 'FWD', 'Atletico Madrid'),
  ('Jorgen Strand Larsen', 'Noruega', 'FWD', 'Crystal Palace'),
  ('Antonio Nusa', 'Noruega', 'FWD', 'RB Leipzig'),
  ('Oscar Bobb', 'Noruega', 'FWD', 'Fulham'),
  ('Andreas Schjelderup', 'Noruega', 'FWD', 'Benfica'),
  ('Jens Petter Hauge', 'Noruega', 'FWD', 'Bodo/Glimt'),
  ('Martin Odegaard', 'Noruega', 'MID', 'Arsenal'),
  ('Sander Berge', 'Noruega', 'MID', 'Fulham'),
  ('Fredrik Aursnes', 'Noruega', 'MID', 'Benfica'),
  ('Patrick Berg', 'Noruega', 'MID', 'Bodo/Glimt'),
  ('Kristian Thorstvedt', 'Noruega', 'MID', 'Sassuolo'),
  ('Morten Thorsby', 'Noruega', 'MID', 'Cremonese'),
  ('Thelo Aasgaard', 'Noruega', 'MID', 'Rangers'),
  ('Orjan Haskjold Nyland', 'Noruega', 'GK', 'Sevilla'),
  ('Egil Selvik', 'Noruega', 'GK', 'Watford'),
  ('Sander Tangvik', 'Noruega', 'GK', 'Hamburger SV'),
  ('Tim Payne', 'Nueva Zelanda', 'DEF', 'Wellington Phoenix'),
  ('Francis De Vries', 'Nueva Zelanda', 'DEF', 'Auckland'),
  ('Tyler Bindon', 'Nueva Zelanda', 'DEF', 'Nottingham Forest'),
  ('Michael Boxall', 'Nueva Zelanda', 'DEF', 'Minnesota United'),
  ('Liberato Cacace', 'Nueva Zelanda', 'DEF', 'Wrexham'),
  ('Nando Pijnaker', 'Nueva Zelanda', 'DEF', 'Auckland FC'),
  ('Finn Surman', 'Nueva Zelanda', 'DEF', 'Portland Timbers'),
  ('Callan Elliot', 'Nueva Zelanda', 'DEF', 'Auckland'),
  ('Tommy Smith', 'Nueva Zelanda', 'DEF', 'Braintree Town'),
  ('Ben Old', 'Nueva Zelanda', 'DEF', 'Saint-Étienne'),
  ('Chris Wood', 'Nueva Zelanda', 'FWD', 'Nottingham Forest'),
  ('Eli Just', 'Nueva Zelanda', 'FWD', 'Motherwell'),
  ('Kosta Barbarouses', 'Nueva Zelanda', 'FWD', 'Western Sydney Wanderers'),
  ('Ben Waine', 'Nueva Zelanda', 'FWD', 'Port Vale'),
  ('Callum McCowatt', 'Nueva Zelanda', 'FWD', 'Silkeborg IF'),
  ('Jesse Randall', 'Nueva Zelanda', 'FWD', 'Auckland FC'),
  ('Lachlan Bayliss', 'Nueva Zelanda', 'FWD', 'Newcastle Jets'),
  ('Joe Bell', 'Nueva Zelanda', 'MID', 'Viking FK'),
  ('Matt Garbett', 'Nueva Zelanda', 'MID', 'Peterborough United'),
  ('Marko Stamenic', 'Nueva Zelanda', 'MID', 'Swansea City'),
  ('Sarpreet Singh', 'Nueva Zelanda', 'MID', 'Wellington Phoenix'),
  ('Alex Rufer', 'Nueva Zelanda', 'MID', 'Wellington Phoenix'),
  ('Ryan Thomas', 'Nueva Zelanda', 'MID', 'PEC Zwolle'),
  ('Max Crocombe', 'Nueva Zelanda', 'GK', 'Millwall'),
  ('Alex Paulsen', 'Nueva Zelanda', 'GK', 'Lechia Gdańsk'),
  ('Michael Woud', 'Nueva Zelanda', 'GK', 'Auckland'),
  ('Nathan Aké', 'Países Bajos', 'DEF', 'Manchester City'),
  ('Virgil van Dijk', 'Países Bajos', 'DEF', 'Liverpool'),
  ('Denzel Dumfries', 'Países Bajos', 'DEF', 'Inter Milan'),
  ('Jorrel Hato', 'Países Bajos', 'DEF', 'Chelsea'),
  ('Jan Paul van Hecke', 'Países Bajos', 'DEF', 'Brighton'),
  ('Micky van de Ven', 'Países Bajos', 'DEF', 'Tottenham'),
  ('Jurrien Timber', 'Países Bajos', 'DEF', 'Arsenal'),
  ('Brian Brobbey', 'Países Bajos', 'FWD', 'Sunderland'),
  ('Memphis Depay', 'Países Bajos', 'FWD', 'Corinthians'),
  ('Cody Gakpo', 'Países Bajos', 'FWD', 'Liverpool'),
  ('Justin Kluivert', 'Países Bajos', 'FWD', 'Bournemouth'),
  ('Noa Lang', 'Países Bajos', 'FWD', 'Galatasaray'),
  ('Donyell Malen', 'Países Bajos', 'FWD', 'Roma'),
  ('Crysencio Summerville', 'Países Bajos', 'FWD', 'West Ham'),
  ('Wout Weghorst', 'Países Bajos', 'FWD', 'Ajax'),
  ('Ryan Gravenberch', 'Países Bajos', 'MID', 'Liverpool'),
  ('Frenkie de Jong', 'Países Bajos', 'MID', 'Barcelona'),
  ('Teun Koopmeiners', 'Países Bajos', 'MID', 'Juventus'),
  ('Tijjani Reijnders', 'Países Bajos', 'MID', 'Manchester City'),
  ('Marten de Roon', 'Países Bajos', 'MID', 'Atalanta'),
  ('Guus Til', 'Países Bajos', 'MID', 'PSV Eindhoven'),
  ('Quinten Timber', 'Países Bajos', 'MID', 'Marseille'),
  ('Mats Wieffer', 'Países Bajos', 'MID', 'Brighton'),
  ('Mark Flekken', 'Países Bajos', 'GK', 'Bayer Leverkusen'),
  ('Robin Roefs', 'Países Bajos', 'GK', 'Sunderland'),
  ('Bart Verbruggen', 'Países Bajos', 'GK', 'Brighton'),
  ('César Blackman', 'Panamá', 'DEF', 'Slovan Bratislava'),
  ('Jorge Gutiérrez', 'Panamá', 'DEF', 'Deportivo La Guaira'),
  ('Michael Amir Murillo', 'Panamá', 'DEF', 'Beşiktaş'),
  ('Fidel Escobar', 'Panamá', 'DEF', 'Saprissa'),
  ('Andrés Andrade', 'Panamá', 'DEF', 'LASK'),
  ('Edgardo Fariña', 'Panamá', 'DEF', 'Pari Nizhniy Novgorod'),
  ('José Córdoba', 'Panamá', 'DEF', 'Norwich City'),
  ('Éric Davis', 'Panamá', 'DEF', 'CD Plaza Amador'),
  ('Jiovany Ramos', 'Panamá', 'DEF', 'Academia Puerto Cabello'),
  ('Roderick Miller', 'Panamá', 'DEF', 'Turan Tovuz'),
  ('César Yanis', 'Panamá', 'FWD', 'Cobresal'),
  ('Yoel Bárcenas', 'Panamá', 'FWD', 'Mazatlán FC'),
  ('Ismael Díaz', 'Panamá', 'FWD', 'Club León'),
  ('Cecilio Waterman', 'Panamá', 'FWD', 'Universidad de Concepción'),
  ('José Fajardo', 'Panamá', 'FWD', 'Universidad Católica'),
  ('Tomás Rodríguez', 'Panamá', 'FWD', 'Saprissa'),
  ('Aníbal Godoy', 'Panamá', 'MID', 'San Diego FC'),
  ('Adalberto Carrasquilla', 'Panamá', 'MID', 'Pumas UNAM'),
  ('Carlos Harvey', 'Panamá', 'MID', 'Minnesota United'),
  ('Cristian Martínez', 'Panamá', 'MID', 'Ironi Kiryat Shmona'),
  ('José Luis Rodríguez', 'Panamá', 'MID', 'FC Juárez'),
  ('Alberto Quintero', 'Panamá', 'MID', 'CD Plaza Amador'),
  ('Azarías Londoño', 'Panamá', 'MID', 'Universidad Católica de Chile'),
  ('Orlando Mosquera', 'Panamá', 'GK', 'Al-Fayha FC'),
  ('Luis Mejía', 'Panamá', 'GK', 'Club Nacional'),
  ('César Samudio', 'Panamá', 'GK', 'CD Marathón'),
  ('José Canale', 'Paraguay', 'DEF', 'Lanús'),
  ('Júnior Alonso', 'Paraguay', 'DEF', 'Atlético Mineiro'),
  ('Velázquez', 'Paraguay', 'DEF', 'Cerro Porteño'),
  ('Alderete', 'Paraguay', 'DEF', 'Getafe'),
  ('Gustavo Gomez', 'Paraguay', 'DEF', 'Palmeiras'),
  ('Maidana', 'Paraguay', 'DEF', 'Olimpia'),
  ('Balbuena', 'Paraguay', 'DEF', 'Dinamo Moscú'),
  ('Cáceres', 'Paraguay', 'DEF', 'Dynamo Moscú'),
  ('Sanabria', 'Paraguay', 'FWD', 'Torino'),
  ('Sosa', 'Paraguay', 'FWD', 'Palmeiras'),
  ('Alex Arce', 'Paraguay', 'FWD', 'Liga de Quito'),
  ('Gabriel Ávalos', 'Paraguay', 'FWD', 'Independiente'),
  ('Isidro Pitta', 'Paraguay', 'FWD', 'Red Bull Bragantino'),
  ('Almirón', 'Paraguay', 'FWD', 'Atlanta United'),
  ('Caballero', 'Paraguay', 'FWD', 'Nacional'),
  ('Braian Ojeda', 'Paraguay', 'MID', 'Real Salt Lake'),
  ('Cubas', 'Paraguay', 'MID', 'Vancouver Whitecaps'),
  ('Bobadilla', 'Paraguay', 'MID', 'São Paulo'),
  ('Diego Gómez', 'Paraguay', 'MID', 'Brighton'),
  ('Kaku', 'Paraguay', 'MID', 'Al-Ain'),
  ('Mauricio', 'Paraguay', 'MID', 'Libertad'),
  ('Enciso', 'Paraguay', 'MID', 'Estrasburgo'),
  ('Matías Galarza', 'Paraguay', 'MID', 'Talleres de Córdoba'),
  ('Orlando Gill', 'Paraguay', 'GK', 'San Lorenzo'),
  ('Gastón Olveira', 'Paraguay', 'GK', 'Olimpia'),
  ('Roberto Fernández', 'Paraguay', 'GK', 'Cerro Porteño'),
  ('Diogo Dalot', 'Portugal', 'DEF', 'Manchester United'),
  ('Matheus Nunes', 'Portugal', 'DEF', 'Manchester City'),
  ('Nélson Semedo', 'Portugal', 'DEF', 'Fenerbahçe SK'),
  ('João Cancelo', 'Portugal', 'DEF', 'FC Barcelona'),
  ('Nuno Mendes', 'Portugal', 'DEF', 'PSG'),
  ('Gonçalo Inácio', 'Portugal', 'DEF', 'Sporting CP'),
  ('Renato Veiga', 'Portugal', 'DEF', 'Villarreal'),
  ('Rúben Dias', 'Portugal', 'DEF', 'Manchester City'),
  ('Tomás Araújo', 'Portugal', 'DEF', 'SL Benfica'),
  ('João Félix', 'Portugal', 'FWD', 'Al Nassr'),
  ('Francisco Trincão', 'Portugal', 'FWD', 'Sporting CP'),
  ('Francisco Conceição', 'Portugal', 'FWD', 'Juventus'),
  ('Pedro Neto', 'Portugal', 'FWD', 'Chelsea'),
  ('Rafael Leão', 'Portugal', 'FWD', 'AC Milan'),
  ('Gonçalo Guedes', 'Portugal', 'FWD', 'Real Sociedad'),
  ('Gonçalo Ramos', 'Portugal', 'FWD', 'PSG'),
  ('Cristiano Ronaldo', 'Portugal', 'FWD', 'Al Nassr'),
  ('Rúben Neves', 'Portugal', 'MID', 'Al Hilal'),
  ('Samuel Costa', 'Portugal', 'MID', 'Mallorca'),
  ('João Neves', 'Portugal', 'MID', 'PSG'),
  ('Vitinha', 'Portugal', 'MID', 'PSG'),
  ('Bruno Fernandes', 'Portugal', 'MID', 'Manchester United'),
  ('Bernardo Silva', 'Portugal', 'MID', 'Manchester City'),
  ('Diogo Costa', 'Portugal', 'GK', 'FC Porto'),
  ('José Sá', 'Portugal', 'GK', 'Wolverhampton Wanderers'),
  ('Rui Silva', 'Portugal', 'GK', 'Sporting CP'),
  ('Ricardo Velho', 'Portugal', 'GK', 'Genclerbirligi Ankara'),
  ('Zelený', 'República Checa', 'DEF', 'Sparta Praga'),
  ('Zima', 'República Checa', 'DEF', 'Slavia Praga'),
  ('Tomás Holes', 'República Checa', 'DEF', 'Slavia Praga'),
  ('Krejci', 'República Checa', 'DEF', 'Wolverhampton'),
  ('Coufal', 'República Checa', 'DEF', 'Hoffenheim'),
  ('Chaloupek', 'República Checa', 'DEF', 'Slavia Praga'),
  ('Hranac', 'República Checa', 'DEF', 'Hoffenheim'),
  ('D. Jurásek', 'República Checa', 'DEF', 'Slavia Praga'),
  ('Jan Kuchta', 'República Checa', 'FWD', 'Sparta Praga'),
  ('Hlozek', 'República Checa', 'FWD', 'Hoffenheim'),
  ('Schick', 'República Checa', 'FWD', 'Bayer Leverkusen'),
  ('Chytil', 'República Checa', 'FWD', 'Slavia Praga'),
  ('Chory', 'República Checa', 'FWD', 'Slavia Praga'),
  ('Darida', 'República Checa', 'MID', 'Hradec Kralove'),
  ('Michal Sadílek', 'República Checa', 'MID', 'Slavia Praga'),
  ('Lukas Cerv', 'República Checa', 'MID', 'Viktoria Plzen'),
  ('Provod', 'República Checa', 'MID', 'Slavia Praga'),
  ('Visinsky', 'República Checa', 'MID', 'Viktoria Plzen'),
  ('Soucek', 'República Checa', 'MID', 'West Ham'),
  ('Sochurek', 'República Checa', 'MID', 'Sparta Praga'),
  ('Doudera', 'República Checa', 'MID', 'Slavia Praga'),
  ('Sojka', 'República Checa', 'MID', 'Viktoria Plzen'),
  ('Sulc', 'República Checa', 'MID', 'Olympique Lyon'),
  ('Stanek', 'República Checa', 'GK', 'Slavia Praga'),
  ('Kovar', 'República Checa', 'GK', 'PSV'),
  ('Hornicek', 'República Checa', 'GK', 'SC Braga'),
  ('Dylan Batubinsika', 'República Democrática del Congo', 'DEF', 'Larisa'),
  ('Rocky Bushiri', 'República Democrática del Congo', 'DEF', 'Hibernian'),
  ('Gedeon Kalulu', 'República Democrática del Congo', 'DEF', 'Aris Limassol'),
  ('Steve Kapuadi', 'República Democrática del Congo', 'DEF', 'Widzew Lodz'),
  ('Joris Kayembe', 'República Democrática del Congo', 'DEF', 'Racing Genk'),
  ('Arthur Masuaku', 'República Democrática del Congo', 'DEF', 'Racing Lens'),
  ('Chancel Mbemba', 'República Democrática del Congo', 'DEF', 'Lille'),
  ('Axel Tuanzebe', 'República Democrática del Congo', 'DEF', 'Burnley'),
  ('Aaron Wan-Bissaka', 'República Democrática del Congo', 'DEF', 'West Ham'),
  ('Cedric Bakambu', 'República Democrática del Congo', 'FWD', 'Real Betis'),
  ('Simon Banza', 'República Democrática del Congo', 'FWD', 'Al Jazira'),
  ('Fiston Mayele', 'República Democrática del Congo', 'FWD', 'Pyramids'),
  ('Yoane Wissa', 'República Democrática del Congo', 'FWD', 'Newcastle'),
  ('Theo Bongonda', 'República Democrática del Congo', 'MID', 'Spartak Moscow'),
  ('Brian Cipenga', 'República Democrática del Congo', 'MID', 'Castellon'),
  ('Meshack Elia', 'República Democrática del Congo', 'MID', 'Alanyaspor'),
  ('Gael Kakuta', 'República Democrática del Congo', 'MID', 'Larisa'),
  ('Edo Kayembe', 'República Democrática del Congo', 'MID', 'Watford'),
  ('Nathanael Mbuku', 'República Democrática del Congo', 'MID', 'Montpellier'),
  ('Samuel Moutoussamy', 'República Democrática del Congo', 'MID', 'Atromitos'),
  ('Ngal''ayel Mukau', 'República Democrática del Congo', 'MID', 'Lille'),
  ('Charles Pickel', 'República Democrática del Congo', 'MID', 'Espanyol'),
  ('Noah Sadiki', 'República Democrática del Congo', 'MID', 'Sunderland'),
  ('Matthieu Epolo', 'República Democrática del Congo', 'GK', 'Standard Liege'),
  ('Timothy Fayulu', 'República Democrática del Congo', 'GK', 'Noah'),
  ('Lionel Mpasi', 'República Democrática del Congo', 'GK', 'Le Havre'),
  ('Krépin Diatta', 'Senegal', 'DEF', 'AS Monaco'),
  ('Antoine Mendy', 'Senegal', 'DEF', 'OGC Nice'),
  ('Kalidou Koulibaly', 'Senegal', 'DEF', 'Al-Hilal'),
  ('El Hadji Malick Diouf', 'Senegal', 'DEF', 'West Ham United'),
  ('Mamadou Sarr', 'Senegal', 'DEF', 'Chelsea'),
  ('Moussa Niakhaté', 'Senegal', 'DEF', 'Lyon'),
  ('Moustapha Mbow', 'Senegal', 'DEF', 'Paris FC'),
  ('Abdoulaye Seck', 'Senegal', 'DEF', 'Maccabi Haifa'),
  ('Ismaïl Jakobs', 'Senegal', 'DEF', 'Galatasaray SK'),
  ('Ilay Camara', 'Senegal', 'DEF', 'Anderlecht'),
  ('Sadio Mané', 'Senegal', 'FWD', 'Al-Nassr'),
  ('Ismaïla Sarr', 'Senegal', 'FWD', 'Crystal Palace'),
  ('Iliman Ndiaye', 'Senegal', 'FWD', 'Everton'),
  ('Assane Diao', 'Senegal', 'FWD', 'Como'),
  ('Ibrahim Mbaye', 'Senegal', 'FWD', 'PSG'),
  ('Nicolas Jackson', 'Senegal', 'FWD', 'Chelsea'),
  ('Bamba Dieng', 'Senegal', 'FWD', 'Lorient'),
  ('Chérif Ndiaye', 'Senegal', 'FWD', 'Samsunspor'),
  ('Idrissa Gana Gueye', 'Senegal', 'MID', 'Everton'),
  ('Pape Gueye', 'Senegal', 'MID', 'Villarreal CF'),
  ('Lamine Camara', 'Senegal', 'MID', 'AS Monaco'),
  ('Habib Diarra', 'Senegal', 'MID', 'Sunderland'),
  ('Pathé Ciss', 'Senegal', 'MID', 'Rayo Vallecano'),
  ('Pape Matar Sarr', 'Senegal', 'MID', 'Tottenham Hotspur'),
  ('Bara Sapoko Ndiaye', 'Senegal', 'MID', 'Bayern Munich'),
  ('Édouard Mendy', 'Senegal', 'GK', 'Al-Ahli'),
  ('Mory Diaw', 'Senegal', 'GK', 'Le Havre AC'),
  ('Yehvann Diouf', 'Senegal', 'GK', 'OGC Nice'),
  ('Aubrey Modiba', 'Sudáfrica', 'DEF', 'Mamelodi Sundowns'),
  ('Khuliso Mudau', 'Sudáfrica', 'DEF', 'Mamelodi Sundowns'),
  ('Nkosinathi Sibisi', 'Sudáfrica', 'DEF', 'Orlando Pirates'),
  ('Mbekezeli Mbokazi', 'Sudáfrica', 'DEF', 'Chicago Fire'),
  ('Ime Okon', 'Sudáfrica', 'DEF', 'Hannover'),
  ('Samukele Kabini', 'Sudáfrica', 'DEF', 'Molde'),
  ('Khulumani Ndamane', 'Sudáfrica', 'DEF', 'Mamelodi Sundowns'),
  ('Thabang Matuludi', 'Sudáfrica', 'DEF', 'Polokwane City'),
  ('Kamogelo Sebelebele', 'Sudáfrica', 'DEF', 'Orlando Pirates'),
  ('Bradley Cross', 'Sudáfrica', 'DEF', 'Kaizer Chiefs'),
  ('Olwethy Makhanya', 'Sudáfrica', 'DEF', 'Philadelphia Union'),
  ('Themba Zwane', 'Sudáfrica', 'FWD', 'Mamelodi Sundowns'),
  ('Lyle Foster', 'Sudáfrica', 'FWD', 'Burnley'),
  ('Evidence Makgopa', 'Sudáfrica', 'FWD', 'Orlando Pirates'),
  ('Oswin Appollis', 'Sudáfrica', 'FWD', 'Orlando Pirates'),
  ('Iqraam Rayners', 'Sudáfrica', 'FWD', 'Mamelodi Sundowns'),
  ('Relebohile Mofokeng', 'Sudáfrica', 'FWD', 'Orlando Pirates'),
  ('Thapelo Maseko', 'Sudáfrica', 'FWD', 'AEL Limassol'),
  ('Tshepang Moremi', 'Sudáfrica', 'FWD', 'Orlando Pirates'),
  ('Teboho Mokoena', 'Sudáfrica', 'MID', 'Mamelodi Sundowns'),
  ('Sphephelo Sithole', 'Sudáfrica', 'MID', 'Tondela'),
  ('Thalente Mbatha', 'Sudáfrica', 'MID', 'Orlando Pirates'),
  ('Jayden Adams', 'Sudáfrica', 'MID', 'Mamelodi Sundowns'),
  ('Sipho Chaine', 'Sudáfrica', 'GK', 'Orlando Pirates'),
  ('Ricardo Goss', 'Sudáfrica', 'GK', 'Siwele'),
  ('Ronwen Williams', 'Sudáfrica', 'GK', 'Mamelodi Sundowns'),
  ('Hjalmar Ekdal', 'Suecia', 'DEF', 'Burnley'),
  ('Gabriel Gudmundsson', 'Suecia', 'DEF', 'Leeds United'),
  ('Isak Hien', 'Suecia', 'DEF', 'Atalanta'),
  ('Emil Holm', 'Suecia', 'DEF', 'Juventus'),
  ('Gustaf Lagerbielke', 'Suecia', 'DEF', 'Braga'),
  ('Victor Lindelof', 'Suecia', 'DEF', 'Aston Villa'),
  ('Erik Smith', 'Suecia', 'DEF', 'St. Pauli'),
  ('Carl Starfelt', 'Suecia', 'DEF', 'Celta Vigo'),
  ('Daniel Svensson', 'Suecia', 'DEF', 'Borussia Dortmund'),
  ('Taha Ali', 'Suecia', 'FWD', 'Malmo'),
  ('Alexander Bernhardsson', 'Suecia', 'FWD', 'Holstein Kiel'),
  ('Anthony Elanga', 'Suecia', 'FWD', 'Newcastle United'),
  ('Viktor Gyokeres', 'Suecia', 'FWD', 'Arsenal'),
  ('Alexander Isak', 'Suecia', 'FWD', 'Liverpool'),
  ('Gustaf Nilsson', 'Suecia', 'FWD', 'Club Brugge'),
  ('Benjamin Nygren', 'Suecia', 'FWD', 'Celtic'),
  ('Elliot Stroud', 'Suecia', 'MID', 'Mjallby'),
  ('Yasin Ayari', 'Suecia', 'MID', 'Brighton'),
  ('Lucas Bergvall', 'Suecia', 'MID', 'Tottenham'),
  ('Jesper Karlstrom', 'Suecia', 'MID', 'Udinese'),
  ('Ken Sema', 'Suecia', 'MID', 'Pafos'),
  ('Mattias Svanberg', 'Suecia', 'MID', 'Wolfsburg'),
  ('Besfort Zeneli', 'Suecia', 'MID', 'Union St-Gilloise'),
  ('Viktor Johansson', 'Suecia', 'GK', 'Stoke City'),
  ('Kristoffer Nordfeldt', 'Suecia', 'GK', 'AIK'),
  ('Jacob Widell Zetterstrom', 'Suecia', 'GK', 'Derby County'),
  ('Manuel Akanji', 'Suiza', 'DEF', 'Inter Milan'),
  ('Aurele Amenda', 'Suiza', 'DEF', 'Eintracht Frankfurt'),
  ('Eray Comert', 'Suiza', 'DEF', 'Valencia'),
  ('Nico Elvedi', 'Suiza', 'DEF', 'Borussia Monchengladbach'),
  ('Luca Jaquez', 'Suiza', 'DEF', 'VfB Stuttgart'),
  ('Miro Muheim', 'Suiza', 'DEF', 'Hamburg'),
  ('Ricardo Rodriguez', 'Suiza', 'DEF', 'Real Betis'),
  ('Silvan Widmer', 'Suiza', 'DEF', 'Mainz'),
  ('Ruben Vargas', 'Suiza', 'FWD', 'Sevilla'),
  ('Zeki Amdouni', 'Suiza', 'FWD', 'Burnley'),
  ('Breel Embolo', 'Suiza', 'FWD', 'Stade Rennais'),
  ('Cedric Itten', 'Suiza', 'FWD', 'Fortuna Dusseldorf'),
  ('Dan Ndoye', 'Suiza', 'FWD', 'Nottingham Forest'),
  ('Noah Okafor', 'Suiza', 'FWD', 'Leeds'),
  ('Michel Aebischer', 'Suiza', 'MID', 'Pisa'),
  ('Christian Fassnacht', 'Suiza', 'MID', 'Young Boys'),
  ('Remo Freuler', 'Suiza', 'MID', 'Bologna'),
  ('Ardon Jashari', 'Suiza', 'MID', 'AC Milan'),
  ('Johan Manzambi', 'Suiza', 'MID', 'Freiburg'),
  ('Fabian Rieder', 'Suiza', 'MID', 'Augsburg'),
  ('Djibril Sow', 'Suiza', 'MID', 'Sevilla'),
  ('Granit Xhaka', 'Suiza', 'MID', 'Sunderland'),
  ('Denis Zakaria', 'Suiza', 'MID', 'Monaco'),
  ('Marvin Keller', 'Suiza', 'GK', 'Young Boys'),
  ('Gregor Kobel', 'Suiza', 'GK', 'Borussia Dortmund'),
  ('Yvon Mvogo', 'Suiza', 'GK', 'Lorient'),
  ('Ali Abdi', 'Túnez', 'DEF', 'Nice'),
  ('Adem Arous', 'Túnez', 'DEF', 'Kasimpasa'),
  ('Mohamed Amine Ben Hamida', 'Túnez', 'DEF', 'Esperance'),
  ('Dylan Bronn', 'Túnez', 'DEF', 'Servette Geneva'),
  ('Raed Chikhaoui', 'Túnez', 'DEF', 'US Monastir'),
  ('Moutaz Neffati', 'Túnez', 'DEF', 'Norrkoping'),
  ('Omar Rekik', 'Túnez', 'DEF', 'NK Maribor'),
  ('Montassar Talbi', 'Túnez', 'DEF', 'Lorient'),
  ('Yan Valery', 'Túnez', 'DEF', 'Young Boys Berne'),
  ('Elias Achouri', 'Túnez', 'FWD', 'Copenhagen'),
  ('Khalil Ayari', 'Túnez', 'FWD', 'PSG'),
  ('Firas Chaouat', 'Túnez', 'FWD', 'Club Africain'),
  ('Rayan Elloumi', 'Túnez', 'FWD', 'Vancouver Whitecaps'),
  ('Hazem Mastouri', 'Túnez', 'FWD', 'Dynamo Makhachkala'),
  ('Elias Saad', 'Túnez', 'FWD', 'Hannover 96'),
  ('Sebastian Tounekti', 'Túnez', 'FWD', 'Celtic'),
  ('Mortadha Ben Ouanes', 'Túnez', 'MID', 'Kasimpasa'),
  ('Anis Ben Slimane', 'Túnez', 'MID', 'Norwich City'),
  ('Ismael Gharbi', 'Túnez', 'MID', 'Augsburg'),
  ('Rani Khedira', 'Túnez', 'MID', 'Union Berlin'),
  ('Mohamed Hadj Mahmoud', 'Túnez', 'MID', 'Lugano'),
  ('Hannibal Mejbri', 'Túnez', 'MID', 'Burnley'),
  ('Ellyes Skhiri', 'Túnez', 'MID', 'Eintracht Frankfurt'),
  ('Sabri Ben Hessen', 'Túnez', 'GK', 'Etoile Sahel'),
  ('Abdelmouhib Chamakh', 'Túnez', 'GK', 'Club Africain'),
  ('Aymen Dahman', 'Túnez', 'GK', 'CS Sfaxien'),
  ('Kabak', 'Turquía', 'DEF', 'Hoffenheim'),
  ('Söyüncü', 'Turquía', 'DEF', 'Fenerbahce'),
  ('Zeki Çelik', 'Turquía', 'DEF', 'Roma'),
  ('Demiral', 'Turquía', 'DEF', 'Al Ahli'),
  ('Müldür', 'Turquía', 'DEF', 'Fenerbahce'),
  ('Kadıoğlu', 'Turquía', 'DEF', 'Brighton'),
  ('Elmali', 'Turquía', 'DEF', 'Galatasaray'),
  ('Akaydin', 'Turquía', 'DEF', 'Fenerbahce'),
  ('Bardakci', 'Turquía', 'DEF', 'Galatasaray'),
  ('Aydın', 'Turquía', 'FWD', 'Fenerbahce'),
  ('B. Yilmaz', 'Turquía', 'FWD', 'Galatasaray'),
  ('Akgün', 'Turquía', 'FWD', 'Galatasaray'),
  ('Can Kahveci', 'Turquía', 'FWD', 'Fenerbahce'),
  ('Deniz Gül', 'Turquía', 'FWD', 'Porto'),
  ('Yildiz', 'Turquía', 'FWD', 'Juventus'),
  ('Akturkoglu', 'Turquía', 'FWD', 'Fenerbahce'),
  ('Can Uzun', 'Turquía', 'MID', 'Eintracht Frankfurt'),
  ('Yüksek', 'Turquía', 'MID', 'Fenerbahce'),
  ('Calhanoglu', 'Turquía', 'MID', 'Inter de Milán'),
  ('Özcan', 'Turquía', 'MID', 'Borussia Dortmund'),
  ('Kökcü', 'Turquía', 'MID', 'Besiktas'),
  ('Güler', 'Turquía', 'MID', 'Real Madrid'),
  ('Ayhan', 'Turquía', 'MID', 'Galatasaray'),
  ('Bayindir', 'Turquía', 'GK', 'Manchester United'),
  ('Çakir', 'Turquía', 'GK', 'Galatasaray'),
  ('Mert Günok', 'Turquía', 'GK', 'Besiktas'),
  ('Giménez', 'Uruguay', 'DEF', 'Atlético de Madrid'),
  ('R. Araújo', 'Uruguay', 'DEF', 'FC Barcelona'),
  ('Mouriño', 'Uruguay', 'DEF', 'Deportivo Alavés'),
  ('M. Araújo', 'Uruguay', 'DEF', 'Sporting CP'),
  ('Viña', 'Uruguay', 'DEF', 'Flamengo'),
  ('S. Cáceres', 'Uruguay', 'DEF', 'Club América'),
  ('Santi Bueno', 'Uruguay', 'DEF', 'Wolverhampton Wanderers'),
  ('Varela', 'Uruguay', 'DEF', 'Flamengo'),
  ('Joaquín Piquerez', 'Uruguay', 'DEF', 'Palmeiras'),
  ('Sanabria', 'Uruguay', 'DEF', 'Atlético de San Luis'),
  ('Darwin Núñez', 'Uruguay', 'FWD', 'Al-Hilal'),
  ('Cristian Olivera', 'Uruguay', 'FWD', 'Grêmio'),
  ('Canobbio', 'Uruguay', 'FWD', 'Fluminense'),
  ('Brian Rodríguez', 'Uruguay', 'FWD', 'Club América'),
  ('Pellistri', 'Uruguay', 'FWD', 'Panathinaikos'),
  ('Rodrigo Aguirre', 'Uruguay', 'FWD', 'Club América'),
  ('Fede Viñas', 'Uruguay', 'FWD', 'Real Oviedo'),
  ('De Arrascaeta', 'Uruguay', 'MID', 'Flamengo'),
  ('Fede Valverde', 'Uruguay', 'MID', 'Real Madrid'),
  ('Bentancur', 'Uruguay', 'MID', 'Tottenham Hotspur'),
  ('Emiliano Martínez', 'Uruguay', 'MID', 'Palmeiras'),
  ('Zalazar', 'Uruguay', 'MID', 'SC Braga'),
  ('De la Cruz', 'Uruguay', 'MID', 'Flamengo'),
  ('Ugarte', 'Uruguay', 'MID', 'Manchester United'),
  ('Muslera', 'Uruguay', 'GK', 'Estudiantes de La Plata'),
  ('Santiago Mele', 'Uruguay', 'GK', 'Monterrey'),
  ('Rochet', 'Uruguay', 'GK', 'Internacional'),
  ('Ashurmatov', 'Uzbekistán', 'DEF', 'Esteghlal'),
  ('Urozov', 'Uzbekistán', 'DEF', 'Dinamo Samarqand'),
  ('Eshmurodov', 'Uzbekistán', 'DEF', 'Nasaf Qarshi'),
  ('Sayfiev', 'Uzbekistán', 'DEF', 'Neftchi Fergana'),
  ('Alizhonov', 'Uzbekistán', 'DEF', 'Pakhtakor Tashkent'),
  ('Khusanov', 'Uzbekistán', 'DEF', 'Manchester City'),
  ('Nasrullaev', 'Uzbekistán', 'DEF', 'Pakhtakor Tashkent'),
  ('Karimov', 'Uzbekistán', 'DEF', 'Surkhon Termiz'),
  ('Ulmasaliev', 'Uzbekistán', 'DEF', 'Pakhtakor Tashkent'),
  ('Urunov', 'Uzbekistán', 'FWD', 'Persépolis'),
  ('Khamdamov', 'Uzbekistán', 'FWD', 'Pakhtakor Tashkent'),
  ('Sergeev', 'Uzbekistán', 'FWD', 'Persépolis'),
  ('Shomurodov', 'Uzbekistán', 'FWD', 'Basaksehir'),
  ('Abdullayev', 'Uzbekistán', 'FWD', 'Dibba Al-Fujairah Club'),
  ('Masharipov', 'Uzbekistán', 'FWD', 'Esteghlal Tehran'),
  ('Amanov', 'Uzbekistán', 'FWD', 'Dinamo Samarcanda'),
  ('Fayzullaev', 'Uzbekistán', 'FWD', 'Basaksehir'),
  ('Mozgovoy', 'Uzbekistán', 'MID', 'Pakhtakor Tashkent'),
  ('Iskanderov', 'Uzbekistán', 'MID', 'Neftchi Fergana'),
  ('Khamrobekov', 'Uzbekistán', 'MID', 'Tractor S.C.'),
  ('Ganiev', 'Uzbekistán', 'MID', 'Nasaf Qarshi'),
  ('Shukurov', 'Uzbekistán', 'MID', 'Baniyas Club'),
  ('Esanov', 'Uzbekistán', 'MID', 'Bukhara'),
  ('Ergashev', 'Uzbekistán', 'GK', 'Neftchi Fergana'),
  ('Nematov', 'Uzbekistán', 'GK', 'Nasaf Qarshi'),
  ('Yusupov', 'Uzbekistán', 'GK', 'Navbahor')
) as v(full_name, team, pos, club)
join public.national_teams t on t.name = v.team
where not exists (
  select 1 from public.players p
  where p.full_name = v.full_name and p.national_team_id = t.id
);
