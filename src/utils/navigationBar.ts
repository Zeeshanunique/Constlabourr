import { EdgeInsets } from 'react-native-safe-area-context';
import { ViewStyle } from 'react-native';
import { colors, shadows } from '../styles/theme';

/**
 * Calculates responsive bottom tab bar dimensions that dynamically adapt to:
 * 1. Android 3-Button Navigation (system bar occupies ~48dp at screen bottom)
 * 2. Android Gesture Navigation (pill bar occupies ~16-24dp)
 * 3. Devices with no bottom inset or non-edge-to-edge layouts (insets.bottom === 0)
 * 4. High-DPI / larger display accessibility scaling
 *
 * Base tab content height (icons, labels, padding) is 56dp.
 * When insets.bottom > 0, we reserve insets.bottom + 4dp breathing room so
 * labels and icons sit cleanly ABOVE Android system controls.
 * When insets.bottom === 0, we fallback to the default 8dp padding (total 64dp).
 */
export function getResponsiveTabBarStyle(insets: EdgeInsets): ViewStyle {
  const bottomInset = insets.bottom;
  const paddingBottom = bottomInset > 0 ? bottomInset + 4 : 8;
  const height = 56 + paddingBottom;

  return {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height,
    paddingTop: 6,
    paddingBottom,
    ...shadows.dock,
  };
}
