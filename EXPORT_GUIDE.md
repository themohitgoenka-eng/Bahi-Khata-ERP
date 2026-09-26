# Export & Cross-Platform Build Guide

This project is a **standard Vite + React 19 + TypeScript** SPA. No proprietary or
platform-locked runtimes are used, so the exact same web build can be wrapped for
Mobile (Capacitor) and Desktop (Tauri).

## 1. Prerequisites

- Node.js **>= 20**, Yarn
- Copy `.env.example` -> `.env` and set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

```bash
yarn install
yarn dev        # local dev server on http://localhost:3000
yarn build      # production build into ./dist
```

## 2. Android APK (Capacitor)

`capacitor.config.ts` is already configured (`webDir: 'dist'`).

```bash
yarn add @capacitor/core
yarn add -D @capacitor/cli @capacitor/android

yarn build
npx cap add android
npx cap sync
npx cap open android   # build the APK from Android Studio
```

## 3. Desktop EXE (Tauri)

A ready `src-tauri/tauri.conf.json` is included (points to `../dist`, dev URL
`http://localhost:3000`).

```bash
# one-time (installs the Rust-side scaffold + CLI)
yarn add -D @tauri-apps/cli
npx tauri init     # accept defaults; it will detect the existing config

npx tauri dev      # run desktop app in dev
npx tauri build    # produce the installable EXE / bundle
```

## 4. Architecture Notes

- **Backend / Data:** Supabase (`@supabase/supabase-js`). All config is read from
  `.env` (`src/services/supabaseClient.ts`) — no hardcoded cloud attachments.
- **Server-state / caching:** TanStack Query with an **IndexedDB-persisted cache**
  (`src/lib/queryClient.ts`, `src/lib/queryPersister.ts`,
  `src/providers/QueryProvider.tsx`). `networkMode: 'offlineFirst'`.
- **Offline persistence:** IndexedDB via `localForage` + the app's own
  `indexedDbStorage` engine and a local **sync queue** (`src/services/syncEngine.ts`).
- **Realtime sync:** `src/services/realtimeSync.ts` subscribes to Supabase Postgres
  changes, invalidates the query cache and refreshes the active dataset. It
  auto re-subscribes on network reconnect; the sync queue flushes queued offline
  mutations back to Supabase when connectivity returns.

## 5. Folder layout (web assets are cleanly separated)

```
/  (repo root)
├── index.html            # Vite entry
├── vite.config.ts        # base: './' so builds work in Capacitor/Tauri file://
├── capacitor.config.ts   # Android wrapper config
├── src-tauri/            # Desktop wrapper config
├── src/                  # all web frontend source
│   ├── components/  context/  hooks/  services/  lib/  providers/  utils/
│   └── main.tsx
└── dist/                 # build output consumed by Capacitor & Tauri
```
