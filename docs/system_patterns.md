# System Patterns & Architecture

> For the comprehensive guide, see [CODEBASE.md](../CODEBASE.md).

## 1. Overall System Architecture

ConstLabour follows a modern, decoupled client-server architecture:

```
[ React Native / Expo Client (iOS, Android, Web) ]
                       │
                       ▼ (HTTPS / REST + JWT Auth)
[ Supabase Edge Functions (Deno + Hono Server) ]
                       │
                       ▼ (Service Role Connection)
[ Supabase PostgreSQL Relational Database ]
```

## 2. Key Technical Decisions

1. **Relational PostgreSQL Migration:**
   - Moved away from the legacy Deno KV store to a normalized 9-table PostgreSQL schema (`001_create_tables.sql`).
   - Tables: `profiles`, `sites`, `attendance`, `advances`, `payroll`, `payments`, `production`, `agreements`, `agreement_acceptances`.
2. **Centralized Edge Function (`make-server-689d7d60`):**
   - Implemented with Hono (`npm:hono`).
   - All client calls target endpoints under `/functions/v1/make-server-689d7d60/...`.
   - Uses Supabase service role key inside Edge Functions to bypass client-side RLS limitations while enforcing business-layer authorization via the user's JWT.
3. **Field Mapping Abstraction (`db.ts`):**
   - Implements explicit bidirectional mappings: `mapProfile` / `unmapProfile`, `mapAttendance` / `unmapAttendance`, `mapSite` / `unmapSite`, etc.
   - Ensures camelCase convention in React Native and snake_case in PostgreSQL.
4. **Role-Based Navigation Hierarchy:**
   - Authenticated state delegates immediately to one of three isolated navigators based on `user.role`:
     - `contractor`: `ContractorNavigator` (Home, Workers, Foremen, Sites, Attendance, Payroll, Settings) + Stack (`Reports`, `Agreements`).
     - `foreman`: `ForemanNavigator` (Home, Attendance, Workers, Settings).
     - `labour`: `LabourNavigator` (Home, Attendance, Profile, Settings).

## 3. Component & State Patterns

- **Authentication State:** Centralized in `AppContext.tsx`. Manages session checking, token storage, and profile hydration via `/auth/profile`.
- **UI Components:** Built on **Gluestack UI** primitives located in `@/components/ui/` with styling governed by **NativeWind** (Tailwind CSS).
- **Reusable Forms & Dialogs:** Stored in `@/components/shared/` (`FormField`, `FormModal`, `Dropdown`, `DeleteConfirmDialog`).
- **Data Fetching:** Screens and feature tabs fetch directly on mount and refresh upon screen focus (`useFocusEffect`).
