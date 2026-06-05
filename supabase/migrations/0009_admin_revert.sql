-- =====================================================================
-- Draft Mundial 26 — Deshacer el último pick (reversión parcial del admin)
-- =====================================================================
-- Complementa a admin_correct_pick (cambiar jugador de un pick) y a reset_draft
-- (borrado total). Permite al admin revertir SOLO el último pick:
--   • Libera el jugador (borra su fila en user_teams) si el pick no fue autoskip.
--   • Elimina la fila de draft_picks.
--   • Devuelve el turno a ese participante recalculándolo con compute_turn_user.
--   • Reactiva el draft a 'draft_active' aunque estuviera finalizado o pausado,
--     para que el turno corregido quede en juego (el admin puede volver a pausar).
-- Se apoya en el ÚLTIMO pick real (max pick_number), no en current_pick_number,
-- porque advance_draft_turn/finish_draft no lo incrementan al finalizar.

create or replace function public.admin_undo_last_pick(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
  v_pick  public.draft_picks%rowtype;
begin
  if not public.is_league_admin(p_league_id, auth.uid()) then
    raise exception 'Sólo el administrador';
  end if;

  -- Bloquea el draft → serializa frente a make_pick/expire_turn concurrentes
  select * into v_draft from public.drafts where league_id = p_league_id for update;
  if not found then raise exception 'Draft no encontrado'; end if;

  -- Último pick realizado (incluye autoskips)
  select * into v_pick
  from public.draft_picks
  where draft_id = v_draft.id
  order by pick_number desc
  limit 1;
  if not found then raise exception 'No hay picks que deshacer'; end if;

  -- Libera el jugador elegido (si no fue un turno saltado)
  if v_pick.player_id is not null then
    delete from public.user_teams
    where league_id = v_draft.league_id
      and player_id = v_pick.player_id
      and user_id   = v_pick.user_id;
  end if;

  delete from public.draft_picks where id = v_pick.id;

  -- Devuelve el turno a ese slot y reactiva el draft
  update public.drafts
    set status = 'draft_active',
        current_pick_number = v_pick.pick_number,
        current_turn_user_id = public.compute_turn_user(v_draft.id, v_pick.pick_number),
        finished_at = null,
        pick_deadline = case when timer_enabled
                          then now() + make_interval(secs => turn_seconds)
                          else null end
    where id = v_draft.id;

  update public.leagues set status = 'draft_active' where id = v_draft.league_id;
end;
$$;

grant execute on function public.admin_undo_last_pick(uuid) to authenticated;
