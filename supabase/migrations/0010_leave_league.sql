-- =====================================================================
-- Draft Mundial 26 — Abandonar liga
-- =====================================================================
-- Permite a un miembro salir de una liga. Reglas:
--   • No se puede abandonar con el draft EN CURSO (activo/pausado): el orden y
--     los turnos quedarían corruptos. Se exige pausar/reiniciar antes.
--   • Se borran los picks y el equipo del usuario en esa liga (libera jugadores
--     y limpia su rastro). En pre-draft no hay ninguno.
--   • Si quien sale era el ÚLTIMO miembro, se elimina la liga entera (cascade).
--   • Si era admin y quedan otros, se promueve al miembro más antiguo a admin
--     para no dejar la liga sin administrador.
--   • Si ya se había sorteado el orden (pending_draw), se limpia el orden y se
--     vuelve a 'pending_players' (el admin debe re-sortear) para evitar huecos.

create or replace function public.leave_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_me     public.league_members%rowtype;
  v_status league_status_enum;
  v_total  int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  -- Bloquea la liga para serializar salidas/entradas concurrentes
  perform 1 from public.leagues where id = p_league_id for update;
  if not found then raise exception 'Liga no encontrada'; end if;

  select * into v_me
  from public.league_members
  where league_id = p_league_id and user_id = v_uid;
  if not found then raise exception 'No eres miembro de esta liga'; end if;

  select status into v_status from public.drafts where league_id = p_league_id;
  if v_status in ('draft_active', 'draft_paused') then
    raise exception 'No puedes abandonar con el draft en curso. Pide al admin que lo pause o reinicie.';
  end if;

  select count(*) into v_total from public.league_members where league_id = p_league_id;

  -- Limpia el rastro del usuario en la liga (libera jugadores / quita su historial)
  delete from public.draft_picks where league_id = p_league_id and user_id = v_uid;
  delete from public.user_teams  where league_id = p_league_id and user_id = v_uid;
  delete from public.league_members where league_id = p_league_id and user_id = v_uid;

  -- Último miembro: la liga deja de tener sentido → se elimina por completo
  if v_total <= 1 then
    delete from public.leagues where id = p_league_id;
    return;
  end if;

  -- Si se va el admin y no queda ninguno, promueve al miembro más antiguo
  if v_me.role = 'admin'
     and not exists (
       select 1 from public.league_members
       where league_id = p_league_id and role = 'admin'
     ) then
    update public.league_members
      set role = 'admin'
      where id = (
        select id from public.league_members
        where league_id = p_league_id
        order by joined_at asc
        limit 1
      );
  end if;

  -- Si el orden ya estaba sorteado, queda con huecos → fuerza re-sorteo
  if v_status = 'pending_draw' then
    update public.league_members set draft_order = null where league_id = p_league_id;
    update public.drafts
      set status = 'pending_players', current_pick_number = 0,
          current_turn_user_id = null, pick_deadline = null
      where league_id = p_league_id;
    update public.leagues set status = 'pending_players' where id = p_league_id;
  end if;
end;
$$;

grant execute on function public.leave_league(uuid) to authenticated;
