-- =====================================================================
-- Draft Mundial 26 — Alineaciones (formación + posiciones por arrastre)
-- =====================================================================
-- Guarda, por (liga, usuario), la formación elegida y la colocación de los
-- jugadores en el campo. `slots` es un array JSON de player_id (uuid) | null en
-- el orden de los huecos de la formación (el banquillo se deduce: plantilla menos
-- los colocados). Escrituras solo vía RPC save_lineup; lecturas por RLS (miembros).

create table if not exists public.user_lineups (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  formation  text not null default '4-3-3',
  slots      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table public.user_lineups enable row level security;

-- Lectura: cualquier miembro de la liga ve las alineaciones (como user_teams)
drop policy if exists user_lineups_select on public.user_lineups;
create policy user_lineups_select on public.user_lineups
  for select to authenticated
  using (public.is_league_member(league_id, auth.uid()));
-- (Sin políticas de escritura: solo se modifica vía save_lineup SECURITY DEFINER)

-- ----------------------------------------------------------------------
-- save_lineup — guarda la formación y la colocación del equipo de un usuario
-- ----------------------------------------------------------------------
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
  v_uid uuid := auth.uid();
  v_id  text;
  v_seen uuid[] := '{}';
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  -- Permiso: el propio jugador o un admin de la liga
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

  -- Cada jugador colocado debe ser del equipo de ese usuario y no repetirse
  for v_id in select value from jsonb_array_elements_text(p_slots) loop
    if v_id is null or v_id = 'null' then continue; end if;
    if v_id = any(v_seen) then
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
        slots = excluded.slots,
        updated_at = now();
end;
$$;

grant execute on function public.save_lineup(uuid, uuid, text, jsonb) to authenticated;

-- Realtime (idempotente): publica user_lineups para sincronizar entre dispositivos
alter table public.user_lineups replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_lineups'
    ) then execute 'alter publication supabase_realtime add table public.user_lineups'; end if;
  end if;
end $$;
