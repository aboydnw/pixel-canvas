# Pixel Canvas

Collaborative real-time pixel art canvas. Multiple simultaneous users paint on a shared 25x30 grid. No auth — public throwaway app.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript, Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend:** Supabase (Realtime Broadcast for live updates, Postgres for persistence)
- **Deployment:** Vercel

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Type-check + production build
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

## Environment Variables

Defined in `.env.local` (git-ignored via `*.local` pattern):

- `VITE_SUPABASE_URL` — Supabase project URL (uses `.supabase.co` domain)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key

These are also set in Vercel for production.

## Architecture

### Real-time strategy: Broadcast-first, DB as cold storage

- **Supabase Broadcast** is the sole real-time transport during active use
- DB stores a snapshot for initial load and post-session persistence
- No continuous DB writes during the session — eliminates JSONB merge race conditions
- Periodic snapshot save (every 30s) + save on visibility change / beforeunload

### Rendering: Canvas element, not DOM grid

- A single `<canvas>` element with direct pixel drawing
- Click/tap → calculate cell from coordinates → paint locally + broadcast
- Retina support via `devicePixelRatio` scaling
- Bresenham's line interpolation fills gaps during fast drag painting

### Broadcast batching

- Outgoing cell changes are batched over 100ms before sending
- Batch size capped at 50 cells to avoid Realtime rate limits
- Incoming batches are applied in one pass to the canvas

## Project Structure

```
src/
├── App.tsx                      # Root component — layout, state, wiring
├── main.tsx                     # Entry point (no StrictMode — avoids double-subscribe)
├── index.css                    # Tailwind import + global touch overrides
├── components/
│   ├── PixelCanvas.tsx          # <canvas> element, pointer/touch handling, drawing
│   ├── ColorPicker.tsx          # Color swatch toolbar + clear button
│   └── ConfirmModal.tsx         # Generic confirmation dialog
├── hooks/
│   └── usePixelGrid.ts          # Core state: grid Map, broadcast, batching, snapshots
└── lib/
    ├── constants.ts             # Grid dimensions, colors, timing constants
    └── supabase.ts              # Supabase client singleton
```

## Supabase Schema

Single table `pixel_grid` in the `public` schema:

```sql
create table pixel_grid (
  id text primary key default 'main',
  state jsonb not null default '{}',
  updated_at timestamptz default now()
);
```

- RLS is enabled with a permissive `public_all` policy (no auth needed)
- `state` is a flat JSON object: keys are `"row-col"` strings, values are hex color strings
- Only one row exists (`id = 'main'`) — full state overwrite on snapshot save

### Broadcast Events

Channel name: `pixel-canvas`

- **`paint`** — `{ cells: [{ row, col, color }, ...] }` — batched cell updates
- **`clear`** — `{}` — clears the entire grid for all clients
- **Presence** — tracks connected user count via `presenceState()`

## Key Constants

| Constant | Value | Notes |
|----------|-------|-------|
| `GRID_ROWS` | 30 | |
| `GRID_COLS` | 25 | |
| `CELL_SIZE_DESKTOP` | 20px | |
| `CELL_SIZE_MOBILE` | 14px | Breakpoint at 640px width |
| `DEFAULT_COLOR` | `#f5f0e8` | Parchment off-white for empty cells |
| `BATCH_INTERVAL_MS` | 100 | Outgoing broadcast batch window |
| `BATCH_MAX_CELLS` | 50 | Max cells per broadcast message |
| `SNAPSHOT_INTERVAL_MS` | 30000 | DB snapshot frequency |

## Design Decisions

- **No StrictMode** in `main.tsx` — avoids double-mounting which causes duplicate Supabase channel subscriptions
- **Grid stored as `Map<string, string>` in a `useRef`** — avoids re-renders; canvas reads from it directly
- **Draw functions registered via callback** — `usePixelGrid` holds grid state but `PixelCanvas` owns the canvas context; draw functions are passed up via `registerDrawFunctions`
- **Optimistic local painting** — cells are drawn immediately on click, then batched and broadcast asynchronously
- **Bresenham line interpolation** — fills gaps when dragging fast across cells
- **Snapshot persistence** — full state overwrite (not incremental) since broadcast is the real-time source of truth
- **`touch-action: none` + `overscroll-behavior: none`** — prevents iOS Safari scroll/zoom/bounce during painting

## Debugging

Console logs prefixed with `[rt]` are broadcast diagnostics:
- `[rt] subscribe status:` — channel connection state
- `[rt] ← received broadcast` — incoming paint events
- `[rt] ← received clear` — incoming clear events
- `[rt] → sent batch` — outgoing batch sends with cell count and result
- `[rt] presence sync, count:` — connected user count changes
