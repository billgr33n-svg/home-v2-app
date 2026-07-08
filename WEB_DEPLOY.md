# Deploying the live web app (Netlify)

The Home v2 Expo app runs on the web with **no code changes**: the Supabase client
already uses AsyncStorage (web-safe), and no app code imports native-only modules
(`expo-notifications` / `expo-secure-store` are native build plugins only).

## Already staged in this repo
- `app.json` → `web: { bundler: "metro", output: "single" }`
- `package.json` → added `react-dom`, `react-native-web`, `@expo/metro-runtime`
- `public/_redirects` → SPA fallback for Netlify

## Build (on a machine with Node)
```
cd home-v2-app
npm install
npx expo export --platform web      # outputs ./dist
```
The build inlines `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
from `.env` (client-safe; RLS enforces isolation).

## Deploy to Netlify
- Drag the `dist/` folder onto https://app.netlify.com/drop, **or**
- `npx netlify-cli deploy --dir=dist --prod` (needs a Netlify token)

## Log in (live data)
The seeded accounts have real passwords, so you can sign in immediately:
- `bill@greenhouse.test` / `devpass` (Green household admin)

Real family accounts come later via the in-app sign-up + create/join-household flow.

## What web-only gives up
No native push. A PWA can add web push later (Chrome/Android/desktop today; iOS
only for installed PWAs, 16.4+). Everything else — auth, live data, all eight tabs,
household RLS isolation — works in the browser.
