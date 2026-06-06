-- Fix: save_lineup comparaba text = uuid[] (v_id = any(v_seen)) sin cast,
-- lo que lanzaba "operator does not exist: text = uuid".
-- Se castea v_id a uuid antes de la comparación.

create or replace function public.save_lineup(
  p_league_id uuid,
  p_user_id   uuid,
  p_formation text,
  p_slots     jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   text;
  v_seen uuid[] := '{}';
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  if v_uid <> p_user_id and not public.is_league_admin(p_league_id, v_uid) then
    raise exception 'Solo puedes editar tu propia alineación';
  end if;

  if not exists (
    select 1 from public.league_members where league_id = p_league_id and user_id = p_user_id
  ) then
    raise exception 'El usuario no pertenece a esta liga';
  end if;

  if jsonb_typeof(p_slots) <> 'array' then
    raise exception 'slots debe ser un array';
  end if;

  for v_id in select value from jsonb_array_elements_text(p_slots) loop
    if v_id is null or v_id = 'null' then continue; end if;
    -- Cast a uuid antes de comparar con el array uuid[]
    if v_id::uuid = any(v_seen) then
      raise exception 'Jugador repetido en la alineación';
    end if;
    v_seen := array_append(v_seen, v_id::uuid);
    if not exists (
      select 1 from public.user_teams
      where league_id = p_league_id and user_id = p_user_id and player_id = v_id::uuid
    ) then
      raise exception 'Un jugador de la alineación no pertenece a ese equipo';
    end if;
  end loop;

  insert into public.user_lineups (league_id, user_id, formation, slots, updated_at)
  values (p_league_id, p_user_id, coalesce(nullif(p_formation, ''), '4-3-3'), p_slots, now())
  on conflict (league_id, user_id) do update
    set formation = excluded.formation,
        slots     = excluded.slots,
        updated_at = now();
end;
$$;
