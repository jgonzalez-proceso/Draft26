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
