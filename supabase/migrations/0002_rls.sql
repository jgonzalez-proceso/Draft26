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
