import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

export interface BoxProps extends ViewProps {
  children?: React.ReactNode;
}

export function Box({ children, style, ...props }: BoxProps) {
  return (
    <View style={[styles.box, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {},
});

