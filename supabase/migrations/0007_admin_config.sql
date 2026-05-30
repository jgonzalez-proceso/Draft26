-- =====================================================================
-- Draft Mundial 26 — RPCs de configuración (admin, pre-draft)
-- =====================================================================

-- Edita la configuración del draft (modo, cronómetro, picks por usuario).
-- Solo el admin y solo antes de que el draft empiece.
create or replace function public.update_draft_config(
  p_league_id uuid,
  p_draft_mode draft_mode_enum,
  p_timer_enabled boolean,
  p_turn_seconds int,
  p_picks_per_user int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status league_status_enum;
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then
    raise exception 'Sólo el administrador';
  end if;
  select status into v_status from public.drafts where league_id = p_league_id;
  if v_status not in ('pending_players', 'pending_draw') then
    raise exception 'No se puede cambiar la configuración con el draft iniciado';
  end if;
  if p_turn_seconds is not null and (p_turn_seconds < 10 or p_turn_seconds > 86400) then
    raise exception 'Segundos por turno fuera de rango';
  end if;

  update public.drafts
    set draft_mode = p_draft_mode,
        timer_enabled = p_timer_enabled,
        turn_seconds = coalesce(p_turn_seconds, turn_seconds),
        picks_per_user = p_picks_per_user
    where league_id = p_league_id;
end;
$$;

-- Edita los datos básicos de la liga (nombre, máximo de participantes).
create or replace function public.update_league_settings(
  p_league_id uuid,
  p_name text,
  p_max_participants int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then
    raise exception 'Sólo el administrador';
  end if;
  select count(*) into v_count from public.league_members where league_id = p_league_id;
  if p_max_participants < v_count then
    raise exception 'El máximo no puede ser menor que los participantes actuales (%).', v_count;
  end if;
  update public.leagues
    set name = coalesce(nullif(trim(p_name), ''), name),
        max_participants = p_max_participants
    where id = p_league_id;
end;
$$;

grant execute on function
  public.update_draft_config(uuid, draft_mode_enum, boolean, int, int),
  public.update_league_settings(uuid, text, int)
to authenticated;
