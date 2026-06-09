-- Histórico de clasificaciones de La Porra.
-- Cada vez que el admin guarda la clasificación se crea un snapshot.
-- Los snapshots se pueden cargar (para editar) o borrar.

create table if not exists public.porra_result_snapshots (
  id         uuid        default gen_random_uuid() primary key,
  league_id  uuid        not null references public.leagues(id) on delete cascade,
  results    jsonb       not null,   -- [{member_user_id, real_position}]
  label      text        not null default '',
  created_at timestamptz default now()
);

alter table public.porra_result_snapshots enable row level security;

do $$ begin
  create policy "members_read_porra_snapshots"
    on public.porra_result_snapshots for select
    using (public.is_league_member(league_id, auth.uid()));
exception when duplicate_object then null; end $$;

-- Reemplaza set_porra_results para que también cree un snapshot.
-- Hay que bajar la firma anterior (3 args) y recrear con 4 (p_label).
drop function if exists public.set_porra_results(uuid, jsonb, boolean);

create or replace function public.set_porra_results(
  p_league_id uuid,
  p_results   jsonb,
  p_is_final  boolean default false,
  p_label     text    default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto_label text;
begin
  if not exists (
    select 1 from league_members
    where league_id = p_league_id
      and user_id   = auth.uid()
      and role      = 'admin'
  ) then
    raise exception 'Solo el admin puede establecer los resultados de La Porra';
  end if;

  -- Upsert resultado actual
  insert into porra_results (league_id, results, is_final)
  values (p_league_id, p_results, p_is_final)
  on conflict (league_id) do update
    set results    = excluded.results,
        is_final   = excluded.is_final,
        updated_at = now();

  -- Guardar snapshot con etiqueta (auto-generada si no se provee)
  v_auto_label := case
    when p_label <> '' then p_label
    else to_char(now() at time zone 'Europe/Madrid', 'DD/MM/YYYY · HH24:MI')
  end;

  insert into porra_result_snapshots (league_id, results, label)
  values (p_league_id, p_results, v_auto_label);
end;
$$;

-- Borra un snapshot (solo el admin de la liga puede hacerlo).
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
