import React, { useState } from 'react';
import { TextInput, StyleSheet, Platform } from 'react-native';
import { Box } from './box';

interface RNInputProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  size?: 'sm' | 'md' | 'lg';
  [key: string]: any;
}

export function RNInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  size = 'md',
  ...props
}: RNInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const height = size === 'lg' ? 48 : size === 'sm' ? 36 : 40;
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 14 : 15;
  const padding = size === 'lg' ? 14 : size === 'sm' ? 10 : 12;

  return (
    <Box
      className={`border rounded-md bg-white justify-center ${isFocused ? 'border-blue-500' : 'border-gray-300'}`}
      style={{
        paddingHorizontal: padding,
        paddingVertical: 8,
        height: height,
      }}
    >
      <TextInput
        style={[
          styles.input,
          {
            fontSize,
            padding: 0,
            height: '100%',
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  input: {
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      },
    }),
  },
});

