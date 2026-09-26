# Bahi Khata ERP

Professional **Accounting • Inventory • Manufacturing • Banking** ERP — offline-first,
cloud-synced, and cross-platform ready.

## Stack

| Layer | Tech |
|------|------|
| Frontend | React 19 + Vite + TypeScript + Tailwind v4 |
| Backend / Data | **Supabase** (`@supabase/supabase-js`) — config from `.env` only |
| Server-state | **TanStack Query** (offlineFirst) with **IndexedDB-persisted cache** |
| Offline storage | IndexedDB (`localForage` + custom `indexedDbStorage`) + local sync queue |
| Realtime | Supabase Realtime channels (`src/services/realtimeSync.ts`) |
| Mobile wrapper | Capacitor (`capacitor.config.ts`) |
| Desktop wrapper | Tauri (`src-tauri/tauri.conf.json`) |

## Quick start

```bash
cp .env.example .env      # add your VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
yarn install
yarn dev                  # http://localhost:3000
yarn build                # -> ./dist
```

## Offline-first behaviour

- Reads render instantly from the IndexedDB-persisted TanStack Query cache — the
  app never crashes while offline.
- Mutations made offline are queued locally (`syncEngine`) and automatically
  reconciled with Supabase when the network returns.
- Supabase Realtime pushes remote changes into the cache and refreshes the active
  view live; it re-subscribes automatically on reconnect.

## Supabase setup (one-time)

The Supabase project needs the app schema. Open the **Cloud Sync** screen in the
app (or use `src/services/supabaseSchema.ts`) and run the generated SQL in the
Supabase **SQL Editor**. Until then the app runs fully on local IndexedDB.

## Cross-platform builds

See **[EXPORT_GUIDE.md](./EXPORT_GUIDE.md)** for Android APK (Capacitor) and
Desktop EXE (Tauri) instructions. The same `dist/` build powers web, mobile and
desktop — no proprietary runtimes, all config via `.env`.
