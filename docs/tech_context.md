# Technical Context

> For the comprehensive guide, see [CODEBASE.md](../CODEBASE.md).

## 1. Technologies Used

- **Frontend:**
  - React Native: `0.88.0`
  - React: `19.3.0`
  - Expo SDK: `^58.0.0`
  - React Navigation: `^6.1.0` (Stack & Bottom Tabs)
  - NativeWind: `^4.2.1` & Tailwind CSS `^3.4.19`
  - Gluestack UI: `@gluestack-ui/core` `^3.0.12`, `@gluestack-style/react` `^1.0.57`
  - Charting: `react-native-chart-kit` `^6.12.0`, `react-native-svg` `15.16.0`
  - Icons: `@expo/vector-icons`, `lucide-react-native`
  - Web Support: `react-native-web` `^0.21.4`, `dom-helpers` `^6.0.1`
- **Backend & Database:**
  - Supabase PostgreSQL (Project ID: `jkwrupxrjbrmuufxetlh`)
  - Supabase Edge Functions (Deno runtime)
  - Hono Framework: `npm:hono`
  - Supabase JS Client: `@supabase/supabase-js` `^2`

## 2. Environment Variables

Defined in `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`: Points to `https://jkwrupxrjbrmuufxetlh.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Public client key for frontend calls.
- `SUPABASE_SERVICE_ROLE_KEY`: Secret administrative key configured in Supabase Edge Function secrets.

## 3. Development Setup & Constraints

- **Web Browser Run:** `npm start` -> press `w`. When code changes cause blank screens, hard reload browser cache (`Ctrl+F5` or DevTools > "Empty Cache and Hard Reload").
- **Mobile Device Run:** `npx expo start --tunnel`. Tunnel mode is required on local development machines to bypass Windows Firewall and LAN subnet isolation.
- **Gluestack Dependency Constraint:** `@gluestack-ui/core` requires `dom-helpers` when running on web. Do not remove `dom-helpers` from `package.json`.
- **Chart Prop Constraint:** `BarChart` in `react-native-chart-kit` requires `yAxisSuffix=""` to avoid canvas crash on web.
- **InteractionManager Polyfill (RN 0.88+):** React Native 0.88 removed `InteractionManager`. Navigation stack transitions are polyfilled in `src/polyfills.ts` and reinforced via `patches/react-native+0.88.0.patch`.
