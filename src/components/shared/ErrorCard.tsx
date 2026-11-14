import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radii } from '../../styles/theme';
import { useTranslation } from '../../i18n';

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  isFullPage?: boolean;
}

export function ErrorCard({
  title,
  message,
  onRetry,
  retryLabel,
  isFullPage = false,
}: ErrorCardProps) {
  const { language } = useTranslation();
  const defaultTitle =
    language === 'hi'
      ? 'डेटा लोड करने में त्रुटि'
      : language === 'bn'
      ? 'ডেটা লোড করতে সমস্যা'
      : 'Unable to Load Data';

  const defaultRetry =
    language === 'hi' ? 'पुनः प्रयास करें' : language === 'bn' ? 'আবার চেষ্টা করুন' : 'Tap to Retry';

  return (
    <View style={[styles.container, isFullPage && styles.fullPage]}>
      <View style={styles.iconCircle}>
        <MaterialIcons name="error-outline" size={32} color={colors.error} />
      </View>
      <Text style={styles.title}>{title || defaultTitle}</Text>
      <Text style={styles.message}>{message}</Text>

      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>{retryLabel || defaultRetry}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: radii.xl,
    padding: 24,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#7F1D1D', // subtle dark red border
  },
  fullPage: {
    flex: 1,
    margin: 20,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
