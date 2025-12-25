import React, { useEffect } from 'react';
import { config } from './config';
import { View, ViewProps } from 'react-native';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import { useColorScheme } from 'nativewind';
import { useColorScheme as useRNColorScheme } from 'react-native';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({
  mode = 'light',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const systemColorScheme = useRNColorScheme();

  useEffect(() => {
    try {
      const targetScheme = mode === 'system' ? (systemColorScheme || 'light') : mode;
      setColorScheme(targetScheme);
    } catch (error) {
      // Fallback if setColorScheme fails
      console.warn('Failed to set color scheme:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, systemColorScheme]);

  return (
    <View
      style={[
        config[colorScheme!],
        { flex: 1, height: '100%', width: '100%' },
        props.style,
      ]}
    >
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
