# Codebase Conventions & Standards

> For the comprehensive guide, see [CODEBASE.md](../CODEBASE.md).

## 1. Directory & File Organization

- `src/screens/`: High-level dashboard views and full-screen flows (e.g. `ContractorDashboard.tsx`, `LanguageSelectionScreen.tsx`, `LoginScreen.tsx`).
- `src/features/`: Domain-specific business logic and tab views organized by feature:
  - `workers/`: `WorkersTab.tsx`, `ForemenTab.tsx`, `ForemanWorkersTab.tsx`
  - `sites/`: `SitesTab.tsx`
  - `attendance/`: `AttendanceTab.tsx`, `BulkAttendanceTab.tsx`, `WorkerAttendanceTab.tsx`
  - `payroll/`: `PayrollTab.tsx`
  - `agreements/`: `AgreementTab.tsx`, `WorkerAgreementModal.tsx`
  - `reports/`: `ReportsTab.tsx`
  - `profile/`: `WorkerProfileTab.tsx`
- `src/components/shared/`: Reusable multi-feature UI components (`FormField`, `FormModal`, `Dropdown`, `DeleteConfirmDialog`).
- `src/components/ui/`: Atomic Gluestack UI components (`box`, `button`, `card`, `input`, `text`, etc.).
- `src/navigation/`: Navigator definitions with typed `ParamList` interfaces.

## 2. Naming Conventions

- **Components & Files:** PascalCase (e.g., `ModernContractorDashboard.tsx`, `BulkAttendanceTab.tsx`).
- **Hooks & Utility Functions:** camelCase (e.g., `fetchWorkers`, `handleLogin`, `unmapProfile`).
- **Database Tables & Columns:** snake_case in PostgreSQL (e.g., `contractor_id`, `daily_wage`, `aadhaar_hash`).
- **Frontend State & Props:** camelCase in TypeScript (e.g., `contractorId`, `dailyWage`, `aadhaarHash`).
- **Types & Interfaces:** PascalCase (e.g., `User`, `UserRole`, `Worker`, `Site`, `Attendance`).

## 3. Data Flow & Communication Pattern

1. Component hooks onto route token: `const token = accessToken || (route.params as any)?.accessToken;`
2. Fetch requests call `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/<endpoint>` with `Authorization: Bearer ${token}`.
3. Edge Function parses the JWT token with `db.supabase.auth.getUser(t)`.
4. Edge Function executes queries via `db.ts` helpers.
5. Toast feedback via `Toast.show({ type: 'success' | 'error', text1: '...', text2: '...' })`.
