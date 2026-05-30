-- =====================================================================
-- Draft Mundial 26 — pg_cron (red de seguridad del temporizador)
-- =====================================================================
-- El auto-skip "fino" lo dispara el cliente con turno activo llamando a
-- expire_turn() al llegar a 0. Este job es el FALLBACK por si ningún cliente
-- está conectado. Nota: pg_cron en Supabase tiene granularidad de 1 minuto.
--
-- Requiere la extensión pg_cron (disponible en Supabase). Ejecuta este archivo
-- en el SQL Editor del dashboard; si pg_cron no está habilitado, actívalo en
-- Database → Extensions y vuelve a ejecutar.
-- =====================================================================

create extension if not exists pg_cron;

-- Evita duplicar el job si ya existe
do $$
begin
  if exists (select 1 from cron.job where jobname = 'draft_expire_due') then
    perform cron.unschedule('draft_expire_due');
  end if;
  perform cron.schedule(
    'draft_expire_due',
    '* * * * *', -- cada minuto
    $cron$ select public.expire_all_due(); $cron$
  );
end $$;
