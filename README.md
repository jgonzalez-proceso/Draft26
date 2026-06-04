# 🏆 Draft Mundial 26

App web para hacer un **draft fantástico del Mundial 2026** con amigos: te unes a una liga,
se sortea el orden y elegís jugadores **por turnos** (formato serpiente). Sin precios ni pujas.
Todo en tiempo real.

Stack: **Next.js 14** (App Router) · **Supabase** (Auth + Postgres + RLS + Realtime + RPC) ·
**TailwindCSS** · **TypeScript**.

## Arranque rápido (local)

```bash
# Windows: doble clic en start.bat   |   o en terminal:
./start.sh
```

El script crea `.env.local` si falta, instala dependencias y arranca en
http://localhost:3000. **La landing y el login se ven sin configurar nada**, pero para
registrarte y draftear necesitas un proyecto Supabase (abajo).

> Nota: en máquinas con proxy SSL corporativo, los scripts ya usan
> `NODE_OPTIONS=--use-system-ca` para que `npm install` no falle con
> `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

## Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com). En **Project Settings → API**
   copia la URL y la *anon key* a `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
2. En el **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations/`
   (`0001` → `0006`).
3. Ejecuta `supabase/seed.sql` para cargar **1248 jugadores reales de 48 selecciones**
   (plantillas confirmadas). Para regenerarlo desde un CSV nuevo:
   `npm run seed` (lee `supabase/data/convocados_mundial_2026.csv`).
4. `0005_cron.sql` necesita la extensión **pg_cron** (Database → Extensions) — es el
   fallback del cronómetro de turnos.
5. Para probar sin email: **Auth → Providers → Email** y desactiva *Confirm email*.

## Estructura

```
src/app/(auth)/        login, registro
src/app/(dashboard)/   zona autenticada (ligas, perfil, draft…)
src/lib/supabase/      clientes browser/server/middleware
src/lib/csv.ts         parser CSV del importador
src/types/domain.ts    enums, etiquetas y tipos de dominio
supabase/migrations/   esquema, RLS, funciones RPC, realtime, pg_cron, stubs futuros
supabase/seed.sql      plantillas confirmadas (generado)
scripts/generate-seed.mjs  CSV → seed.sql
```

Detalles de arquitectura y convenciones en [CLAUDE.md](CLAUDE.md). Plan por etapas en
`.claude/plans/`.

## Despliegue

Frontend en **Vercel** (importa el repo, define `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` en *Environment Variables*). Base de datos en **Supabase Cloud**.
