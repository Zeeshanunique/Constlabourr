# ConstLabour 🏗️

> Construction workforce and site management cross-platform mobile and web application.

For complete architectural specifications, API catalogs, schema definitions, and AI development rules, read **[CODEBASE.md](./CODEBASE.md)**.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Ensure `.env` contains your Supabase keys:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://jkwrupxrjbrmuufxetlh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
```

### 3. Run Development Server
- **Web Browser:**
  ```bash
  npm start
  ```
  Press `w` to open `http://localhost:8081`.
- **Mobile Device (Expo Go via Tunnel):**
  ```bash
  npx expo start --tunnel
  ```
  Scan the QR code in Expo Go.

---

## Core Documentation
- **[CODEBASE.md](./CODEBASE.md):** Complete Master Codebase Architecture & Context
- **[docs/system_patterns.md](./docs/system_patterns.md):** Architecture & Component Patterns
- **[docs/tech_context.md](./docs/tech_context.md):** Tech Stack & Constraints
- **[docs/conventions.md](./docs/conventions.md):** Code & Naming Conventions
- **[docs/formatting.md](./docs/formatting.md):** Code Style & Formatting
- **[docs/testing.md](./docs/testing.md):** Testing & Verification Guide
- **[PRIVACY_POLICY.md](./PRIVACY_POLICY.md):** Privacy Policy & Data Collection Disclosure
