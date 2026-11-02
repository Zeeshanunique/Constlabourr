/**
 * ConstLabour Industrial Swiss Design System Tokens
 * Source: Approved Stitch Design System (assets/9a5249c1f75d46df80a00664edddd3cf)
 */

export const colors = {
  // Brand & Architecture
  primary: '#0F172A',       // Deep Architectural Slate
  primaryHover: '#1E293B',  // Slate 800
  primaryDark: '#020617',   // Slate 950
  
  // Tactical Accent (Safety Orange)
  accent: '#EA580C',        // Safety Orange 600
  accentDark: '#C2410C',    // Orange 700
  accentLight: '#FFEDD5',   // Orange 100
  accentSoft: '#FFF7ED',    // Orange 50
  safetyOrange: '#EA580C',
  safetyOrangeLight: '#FFF7ED',
  
  // Status Colors
  success: '#10B981',       // Signal Emerald 500 (Present, Verified, On Budget)
  successLight: '#ECFDF5',  // Emerald 50
  successDark: '#047857',   // Emerald 700
  
  warning: '#F59E0B',       // Warning Amber 500 (Overtime, Pending, Half-Day)
  warningLight: '#FFFBEB',  // Amber 50
  warningDark: '#B45309',   // Amber 700
  
  error: '#EF4444',         // Alert Red 500 (Absent, Overdue, Cancelled)
  errorLight: '#FEF2F2',    // Red 50
  errorDark: '#B91C1C',     // Red 700

  info: '#3B82F6',          // Tactical Blue 500
  infoLight: '#EFF6FF',     // Blue 50

  // Palette Scales
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },

  // Canvas & Surfaces (Engineered for outdoor sunlight contrast)
  background: '#F8FAFC',    // Slate 50 canvas
  surface: '#FFFFFF',       // Card pure white
  surfaceMuted: '#F1F5F9',  // Slate 100
  surfaceSubtle: '#F8FAFC', // Slate 50
  
  // Borders & Dividers
  border: '#E2E8F0',        // Slate 200
  borderDark: '#CBD5E1',    // Slate 300
  borderStrong: '#94A3B8',  // Slate 400
  
  // High-Readability Typography
  text: '#0F172A',          // Deep Slate text
  textMuted: '#64748B',     // Slate 500 secondary
  textLight: '#94A3B8',     // Slate 400 tertiary
  textInverted: '#FFFFFF',  // Crisp white on dark
};

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dock: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  hero: {
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
};

export const theme = {
  colors,
  shadows,
  radii,
};

export default theme;
