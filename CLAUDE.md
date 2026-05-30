# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

App web (Next.js 14 App Router + Supabase) para un **draft fantástico del Mundial 2026**:
un grupo de usuarios se une a una liga, se sortea el orden y eligen jugadores **por turnos**
(formato serpiente). Sin precios ni pujas. El MVP es solo el draft; la arquitectura queda
preparada para puntuación/estadísticas/alineaciones (ver `supabase/migrations/0006_future_stubs.sql`).

El plan por etapas vive en `C:\Users\javie\.claude\plans\quiero-crear-una-aplicaci-n-ethereal-cherny.md`.
Estado: Etapas 0–2 hechas (arranque, BD/RLS/RPCs, auth). Pendientes: ligas (3), admin+sorteo (4),
motor de draft UI (5), dashboard realtime (6), exploración (7), equipos/historial (8), cierre (9).

## Comandos

```bash
# IMPORTANTE: en esta máquina npm necesita el CA del sistema (proxy SSL corporativo),
# o el install se cuelga con UNABLE_TO_VERIFY_LEAF_SIGNATURE.
NODE_OPTIONS=--use-system-ca npm install

npm run dev          # arranca en http://localhost:3000
npm run build        # build de producción (valida tipos + rutas)
npm run lint
npm run seed         # regenera supabase/seed.sql desde supabase/data/convocados_mundial_2026.csv
npx tsc --noEmit     # typecheck

./start.sh           # (o start.bat en Windows) instala si falta y arranca dev con el CA ya configurado
```

No hay framework de tests configurado todavía. La verificación se hace con `npm run build` /
`tsc --noEmit` y probando el flujo contra un Supabase real.

## Setup de Supabase (necesario para que la app funcione)

1. Crear proyecto en Supabase Cloud. Copiar `.env.local.example` → `.env.local` y rellenar
   `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Ejecutar en el SQL Editor, **en orden**, los archivos de `supabase/migrations/` (0001→0006)
   y luego `supabase/seed.sql` (836 jugadores reales de 32 selecciones).
3. `0005_cron.sql` requiere la extensión `pg_cron` (Database → Extensions).
4. Para pruebas rápidas, desactivar la confirmación de email en Auth → Providers.

## Arquitectura

**Clientes Supabase** (patrón `@supabase/ssr`, copiado del CRM Infinitia):
- `src/lib/supabase/client.ts` — browser (Client Components).
- `src/lib/supabase/server.ts` — Server Components / route handlers (lee cookies).
- `src/lib/supabase/middleware.ts` + `src/middleware.ts` — refresca sesión y protege rutas.
  Rutas públicas: `/`, `/login`, `/register`, `/auth/*`. El resto exige sesión.

**Rutas** (App Router con route groups): `(auth)` para login/registro, `(dashboard)` para todo
lo autenticado (layout en `src/app/(dashboard)/layout.tsx` valida `auth.getUser()` y monta el
`Topbar`). Las ligas cuelgan de `/ligas/[leagueId]/...`.

**Modelo de seguridad — clave del proyecto:**
- **Las LECTURAS las gobierna RLS**: un usuario solo ve datos de ligas donde es miembro
  (helpers `is_league_member` / `is_league_admin`, SECURITY DEFINER para evitar recursión).
- **Las ESCRITURAS críticas NO se hacen con INSERT/UPDATE directos** desde el cliente, sino
  vía **funciones RPC `SECURITY DEFINER`** en `supabase/migrations/0003_functions.sql`, que
  validan permisos con `auth.uid()` por dentro. Por eso no existen políticas de escritura sobre
  `drafts` / `draft_picks` / `user_teams`. Al añadir features, mantener este patrón: lógica de
  negocio en RPC, no en el cliente.

**RPCs principales** (llamar con `supabase.rpc('nombre', {...})`):
- `create_league`, `join_league` (por código de invitación).
- `draw_draft_order` (sorteo aleatorio), `start_draft`, `pause_draft`, `resume_draft`,
  `finish_draft`, `reset_draft`.
- `make_pick(p_draft_id, p_player_id)` — **núcleo**: bloquea la fila del draft (`FOR UPDATE`),
  valida turno/estado/deadline, inserta en `user_teams` (UNIQUE `(league_id, player_id)` es la
  barrera atómica contra doble elección) y `draft_picks`, y avanza el turno.
- `expire_turn` / `expire_all_due` — auto-skip cuando vence el cronómetro.
- `admin_correct_pick`, `admin_set_player_availability`.

**Lógica de turnos (serpiente)** en `compute_turn_user`: con N participantes y pick `p`,
`round=(p-1)/N`, `idx=(p-1)%N`; en rondas impares se invierte (`N-1-idx`). `draft_mode` permite
`linear` en el futuro. El orden vive en `league_members.draft_order` (1..N, asignado por el sorteo).

**Temporizador**: `drafts.pick_deadline` se fija al iniciar cada turno. El cliente con el turno
llama a `expire_turn` al llegar a 0 (idempotente); `pg_cron` (`0005_cron.sql`, cada minuto) es el
fallback si nadie está conectado.

**Realtime**: `0004_realtime.sql` publica `drafts`, `draft_picks`, `user_teams`, `league_members`,
`players`. El dashboard del draft se suscribe a estos cambios (respetando RLS).

**Datos de jugadores**: `players.is_available` es global (bajas/lesiones del admin); el "elegido
en esta liga" se deriva de la existencia de fila en `user_teams(league_id, player_id)`. El catálogo
se carga vía `supabase/seed.sql` o el importador CSV (`src/lib/csv.ts`, parser sin dependencias).

**Tipos**: `src/types/domain.ts` (enums, etiquetas ES de posiciones y estados, interfaces de tabla).
Posiciones: `GK|DEF|MID|FWD`. Estados de liga: `pending_players|pending_draw|draft_active|draft_paused|draft_finished`.

## Convenciones

- UI y dominio en **español** (etiquetas, mensajes, nombres de ruta como `/ligas`, `/perfil`).
- Tema oscuro deportivo: clases utilitarias en `globals.css` (`.card`, `.btn-primary`, `.btn-gold`,
  `.btn-ghost`, `.input`, `.badge`) y colores de marca/estado en `tailwind.config.ts`
  (`pitch`, `gold`, `state.available|picked|active|paused|finished`). Mobile-first.
- Migraciones idempotentes (`do $$ ... exception when duplicate_object`, `create ... if not exists`,
  `on conflict`). Numerar nuevos archivos `00NN_*.sql` en orden de ejecución.
