-- =====================================================================
-- Draft Mundial 26 — Realtime
-- =====================================================================
-- Publica en la replicación lógica las tablas que el dashboard del draft
-- escucha en tiempo real. Supabase Realtime respeta RLS en los cambios
-- entregados a cada cliente.
-- =====================================================================

-- REPLICA IDENTITY FULL para recibir filas completas en updates/deletes
alter table public.drafts          replica identity full;
alter table public.draft_picks     replica identity full;
alter table public.user_teams      replica identity full;
alter table public.league_members  replica identity full;
alter table public.players         replica identity full;

-- Añade las tablas a la publicación de Realtime (idempotente)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- drafts
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drafts'
    ) then execute 'alter publication supabase_realtime add table public.drafts'; end if;

    -- draft_picks
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_picks'
    ) then execute 'alter publication supabase_realtime add table public.draft_picks'; end if;

    -- user_teams
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_teams'
    ) then execute 'alter publication supabase_realtime add table public.user_teams'; end if;

    -- league_members
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_members'
    ) then execute 'alter publication supabase_realtime add table public.league_members'; end if;
  end if;
end $$;
