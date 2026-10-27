# Formatting & Code Standards

> For the comprehensive guide, see [CODEBASE.md](../CODEBASE.md).

## 1. Language & Compiler Standards

- **TypeScript Version:** `~5.9.2`
- **Strict Mode:** Enabled in `tsconfig.json`.
- **Path Aliasing:**
  - Import from `@/` (resolving to `./src/*`) rather than deeply nested relative paths (e.g. `import { Box } from '@/components/ui/box';`).
- **ECMAScript Target:** Modern ES (ES2022+).

## 2. Code Formatting Rules

- **Indentation:** 2 spaces.
- **Quotes:** Single quotes `'...'` for TypeScript strings; double quotes `"..."` for JSX attributes.
- **Semicolons:** Always terminate statements with semicolons.
- **Imports Organization:**
  1. React & Core Native modules (`react`, `react-native`)
  2. Third-party UI / utility libraries (`@react-navigation/*`, `lucide-react-native`, `@expo/vector-icons`)
  3. Shared UI components (`@/components/ui/*`, `@/components/shared/*`)
  4. Context, Navigation types, and Utilities (`@/context/*`, `@/utils/*`)
  5. Local types & interfaces

## 3. Tailwind CSS & Styling

- Styling is primarily handled with **NativeWind** classes (`className="..."`) and Gluestack components.
- Color palette tokens follow Tailwind standards defined in `tailwind.config.js` (`primary`, `secondary`, `tertiary`).
- Use `SafeAreaView` from `react-native-safe-area-context` to wrap root screen layouts.
