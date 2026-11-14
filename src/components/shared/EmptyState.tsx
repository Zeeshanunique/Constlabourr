import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radii } from '../../styles/theme';
import { useTranslation } from '../../i18n';

interface EmptyStateProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isSearch?: boolean;
  onClearSearch?: () => void;
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  isSearch = false,
  onClearSearch,
}: EmptyStateProps) {
  const { language } = useTranslation();
  const clearText =
    language === 'hi' ? 'खोज हटाएं' : language === 'bn' ? 'অনুসন্ধান মুছুন' : 'Clear Search';

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialIcons
          name={icon}
          size={36}
          color={isSearch ? colors.textMuted : colors.accent}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {isSearch && onClearSearch && (
        <TouchableOpacity
          style={styles.clearSearchBtn}
          onPress={onClearSearch}
          activeOpacity={0.8}
        >
          <MaterialIcons name="close" size={16} color="#FFFFFF" />
          <Text style={styles.clearSearchText}>{clearText}</Text>
        </TouchableOpacity>
      )}

      {!isSearch && actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  clearSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  clearSearchText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});
