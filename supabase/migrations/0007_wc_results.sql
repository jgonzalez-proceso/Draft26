-- Tablas para los resultados del Mundial 2026 escritas por el workflow N8N
-- (upsert vía ESPN API cada minuto durante los días con partidos).
-- RLS abierto en lectura: son datos públicos del torneo.

create table if not exists public.wc_fixtures (
  espn_id     text primary key,
  match_date  timestamptz,
  round       text,
  home_name   text, home_logo text, home_score int,
  away_name   text, away_logo text, away_score int,
  status_short text,     -- "pre" | "in" | "post"
  elapsed     int,
  updated_at  timestamptz default now()
);

create table if not exists public.wc_events (
  id              bigint generated always as identity primary key,
  espn_fixture_id text references public.wc_fixtures(espn_id) on delete cascade,
  elapsed         int,
  team_abbr       text,
  player_name     text,
  event_type      text    -- "goal" | "penalty" | "ownGoal"
);

-- Índice para consultas por espn_fixture_id
create index if not exists wc_events_fixture_idx on public.wc_events(espn_fixture_id);

-- RLS
alter table public.wc_fixtures enable row level security;
alter table public.wc_events   enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'wc_fixtures' and policyname = 'lectura publica wc_fixtures'
  ) then
    create policy "lectura publica wc_fixtures" on public.wc_fixtures
      for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'wc_events' and policyname = 'lectura publica wc_events'
  ) then
    create policy "lectura publica wc_events" on public.wc_events
      for select using (true);
  end if;
end $$;
