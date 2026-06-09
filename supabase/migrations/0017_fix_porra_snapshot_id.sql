-- set_porra_results ahora devuelve el UUID real del snapshot creado,
-- para que el cliente pueda borrar correctamente snapshots recién guardados.
-- También garantiza que delete_porra_snapshot existe (idempotente).

drop function if exists public.set_porra_results(uuid, jsonb, boolean, text);

create function public.set_porra_results(
  p_league_id uuid,
  p_results   jsonb,
  p_is_final  boolean default false,
  p_label     text    default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto_label  text;
  v_snapshot_id uuid;
begin
  if not exists (
    select 1 from league_members
    where league_id = p_league_id
      and user_id   = auth.uid()
      and role      = 'admin'
  ) then
    raise exception 'Solo el admin puede establecer los resultados de La Porra';
  end if;

  insert into porra_results (league_id, results, is_final)
  values (p_league_id, p_results, p_is_final)
  on conflict (league_id) do update
    set results    = excluded.results,
        is_final   = excluded.is_final,
        updated_at = now();

  v_auto_label := case
    when p_label <> '' then p_label
    else to_char(now() at time zone 'Europe/Madrid', 'DD/MM/YYYY · HH24:MI')
  end;

  insert into porra_result_snapshots (league_id, results, label)
  values (p_league_id, p_results, v_auto_label)
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

-- Garantizar que delete_porra_snapshot existe (por si no se ejecutó 0015)
create or replace function public.delete_porra_snapshot(p_snapshot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  select league_id into v_league_id
  from porra_result_snapshots
  where id = p_snapshot_id;

  if v_league_id is null then
    raise exception 'Snapshot no encontrado';
  end if;

  if not exists (
    select 1 from league_members
    where league_id = v_league_id
      and user_id   = auth.uid()
      and role      = 'admin'
  ) then
    raise exception 'Solo el admin puede eliminar snapshots';
  end if;

  delete from porra_result_snapshots where id = p_snapshot_id;
end;
$$;
