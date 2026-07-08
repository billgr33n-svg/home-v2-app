# Home v2 app

Native mobile client for the Home v2 coordination spine. Expo React Native +
TypeScript, Supabase, TanStack Query, Expo Notifications. Governed by the docs
in the vault root; `HOME_V2_PROJECT_SPEC.md` is the source of truth.

## Status

M0-M3 built (pending device boot). Auth, household create/join with invite
tokens, and a tabbed home (Today / Rides / News / Polls) on a Supabase backend
with household-isolation RLS proven green (see supabase/tests/rls_isolation.sql).
Migrations 0001-0008 in supabase/. Ride claim and poll close are race-safe
(optimistic concurrency, ADR-0008).

Run `npm install` then `npx expo start`; sign in as a seeded user
(bill@greenhouse.test / devpass) to see the Green demo day, or sign up fresh to
hit onboarding.

## Prerequisites

- Node LTS (20+), Git
- Expo CLI (`npx expo`), Expo Go on a device or a simulator (Xcode / Android Studio)
- Supabase CLI (for migrations)

## Setup

```bash
cp .env.example .env       # fill in the two EXPO_PUBLIC_ values
npm install
npm run start              # then open in Expo Go / simulator
```

`.env` holds only client-safe values. The service-role key and DATABASE_URL
never go in this app or its bundle; they live in Supabase secrets or a
server-side environment.

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
```

CI (`.github/workflows/ci.yml`) runs all three on push and PR.

## Repo location note

This folder currently lives inside the iCloud-synced Obsidian vault for
session continuity. Before running `npm install`, either:

1. move `home-v2-app/` out of the iCloud vault and `git init` it as its own
   repo (recommended, keeps `node_modules` off iCloud), or
2. keep it here and add `home-v2-app/` to Obsidian's excluded files, accepting
   that iCloud will sync installed dependencies.

`node_modules/`, `.env`, and native folders are gitignored either way.

## Layout

```
index.js                 registerRootComponent entry
App.tsx                  providers + root screen
src/config/env.ts        client-safe env, fails fast if missing
src/lib/supabase.ts      shared anon client (RLS enforces isolation)
src/lib/queryClient.ts   TanStack Query client
src/providers/           app-wide providers
src/screens/             screens (Today shell at M0)
src/domain/              pure domain logic + unit tests
```
