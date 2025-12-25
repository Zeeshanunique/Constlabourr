import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export function GluestackUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      {children}
    </SafeAreaProvider>
  );
}

