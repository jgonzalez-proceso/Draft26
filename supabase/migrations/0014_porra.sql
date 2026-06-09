-- La Porra: juego paralelo de predicción de clasificación final del fantasy.
-- Cada miembro predice en qué posición quedará cada equipo.
-- El admin fija los resultados reales y el sistema calcula los puntos.

create table if not exists public.porra_predictions (
  id           uuid        default gen_random_uuid() primary key,
  league_id    uuid        not null references public.leagues(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  -- [{member_user_id: uuid, predicted_position: int}]
  predictions  jsonb       not null default '[]'::jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint porra_predictions_league_user_key unique(league_id, user_id)
);

create table if not exists public.porra_results (
  id          uuid        default gen_random_uuid() primary key,
  league_id   uuid        not null references public.leagues(id) on delete cascade,
  -- [{member_user_id: uuid, real_position: int}]
  results     jsonb       not null default '[]'::jsonb,
  -- true = predicciones bloqueadas, puntuación definitiva
  is_final    boolean     not null default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  constraint porra_results_league_key unique(league_id)
);

alter table public.porra_predictions enable row level security;
alter table public.porra_results    enable row level security;

do $$ begin
  create policy "members_read_porra_predictions"
    on public.porra_predictions for select
    using (is_league_member(league_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "members_read_porra_results"
    on public.porra_results for select
    using (is_league_member(league_id));
exception when duplicate_object then null; end $$;

-- Guarda (o actualiza) la predicción del usuario en curso.
create or replace function save_porra_prediction(
  p_league_id   uuid,
  p_predictions jsonb   -- [{member_user_id, predicted_position}]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count   int;
  v_members int;
begin
  if not is_league_member(p_league_id) then
    raise exception 'No eres miembro de esta liga';
  end if;

  -- Impedir edición si los resultados son definitivos
  if exists (
    select 1 from porra_results
    where league_id = p_league_id and is_final = true
  ) then
    raise exception 'Los resultados son definitivos; las predicciones están cerradas';
  end if;

  select count(*) into v_members
  from league_members
  where league_id = p_league_id;

  v_count := jsonb_array_length(p_predictions);

  if v_count != v_members then
    raise exception 'Número de predicciones (%) distinto al de miembros (%)', v_count, v_members;
  end if;

  -- Sin posiciones duplicadas
  if (
    select count(distinct (e->>'predicted_position')::int)
    from jsonb_array_elements(p_predictions) e
  ) != v_count then
    raise exception 'No puede haber posiciones duplicadas en la predicción';
  end if;

  insert into porra_predictions (league_id, user_id, predictions)
  values (p_league_id, v_user_id, p_predictions)
  on conflict (league_id, user_id) do update
    set predictions = excluded.predictions,
        updated_at  = now();
end;
$$;

-- Establece (o actualiza) los resultados reales. Solo el admin.
create or replace function set_porra_results(
  p_league_id uuid,
  p_results   jsonb,          -- [{member_user_id, real_position}]
  p_is_final  boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
end;
$$;
