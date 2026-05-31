-- =====================================================================
-- Draft Mundial 26 — Activar/desactivar el cronómetro DURANTE el draft
-- =====================================================================
-- A diferencia de update_draft_config (solo pre-draft), este RPC permite al
-- admin activar/desactivar el límite de tiempo con el draft en curso.
--   • Al ACTIVAR: no toca el turno actual; el cronómetro empieza a contar en el
--     próximo turno (make_pick fija pick_deadline según timer_enabled al avanzar).
--   • Al DESACTIVAR: detiene el cronómetro actual (pick_deadline = null).

create or replace function public.set_draft_timer(
  p_league_id uuid,
  p_enabled boolean,
  p_turn_seconds int default null
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
  if v_status is null then
    raise exception 'Draft no encontrado';
  end if;
  if v_status = 'draft_finished' then
    raise exception 'El draft ha finalizado';
  end if;
  if p_turn_seconds is not null and (p_turn_seconds < 10 or p_turn_seconds > 86400) then
    raise exception 'Segundos por turno fuera de rango';
  end if;

  update public.drafts
    set timer_enabled = p_enabled,
        turn_seconds   = coalesce(p_turn_seconds, turn_seconds),
        -- Al desactivar paramos el cronómetro en curso; al activar se mantiene
        -- (contará desde el próximo turno vía make_pick).
        pick_deadline  = case when p_enabled then pick_deadline else null end
    where league_id = p_league_id;
end;
$$;

grant execute on function public.set_draft_timer(uuid, boolean, int) to authenticated;
