import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { ChevronDown, Check, Globe } from 'lucide-react-native';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';
import { useTranslation, SUPPORTED_LANGUAGES, LanguageOption, SupportedLanguage } from '../i18n';

export function LanguageSelectionScreen() {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();
  const { language, setLanguage, t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownHeight] = useState(new Animated.Value(0));

  const currentOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const toggleDropdown = () => {
    if (isOpen) {
      Animated.timing(dropdownHeight, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      Animated.timing(dropdownHeight, {
        toValue: 160,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleSelectLanguage = async (lang: LanguageOption) => {
    await setLanguage(lang.code);
    toggleDropdown();
  };

  const handleQuickSelect = async (code: SupportedLanguage) => {
    await setLanguage(code);
  };

  const handleContinue = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Top Header & Brand Identity */}
        <View style={styles.header}>
          <BrandLogo size={52} showText={true} subtitle="FIELD OPERATIONS OS v3.4" />
          <Text style={styles.screenTitle}>{t('auth.selectLanguageTitle')}</Text>
          <Text style={styles.screenSubtitle}>
            {t('auth.selectLanguageSubtitle')} • अपनी कार्य भाषा चुनें
          </Text>
        </View>

        {/* Dropdown Card */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>{t('auth.primaryLanguage')}</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, isOpen && styles.dropdownButtonActive]}
            onPress={toggleDropdown}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeft}>
              <View style={styles.globeBox}>
                <Globe size={18} color={colors.accent} />
              </View>
              <Text style={styles.selectedText}>
                {currentOption.nativeLabel} ({currentOption.label})
              </Text>
            </View>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: dropdownHeight.interpolate({
                      inputRange: [0, 160],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              }}
            >
              <ChevronDown size={20} color={colors.textMuted} />
            </Animated.View>
          </TouchableOpacity>

          {isOpen && (
            <Animated.View style={[styles.dropdownMenu, { height: dropdownHeight }]}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                    onPress={() => handleSelectLanguage(lang)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                        {lang.nativeLabel} <Text style={styles.dropdownItemSubText}>({lang.label})</Text>
                      </Text>
                      {lang.subLabel && <Text style={styles.dropdownItemRegion}>{lang.subLabel}</Text>}
                    </View>
                    {isSelected && <Check size={18} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}

          {/* Quick Language Badges Grid (English, Hindi, Bengali) */}
          <View style={styles.quickBadgeGrid}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.quickBadge, isSelected && styles.quickBadgeActive]}
                  onPress={() => handleQuickSelect(lang.code)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickBadgeText, isSelected && styles.quickBadgeTextActive]}>
                    {lang.nativeLabel}
                  </Text>
                  <Text style={[styles.quickBadgeSub, isSelected && styles.quickBadgeSubActive]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>{t('common.continue')}</Text>
            <Text style={styles.arrowIcon}>➔</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  header: {
    paddingTop: 16,
    alignItems: 'flex-start',
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 24,
    lineHeight: 32,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 52,
  },
  dropdownButtonActive: {
    borderColor: colors.accent,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  globeBox: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dropdownMenu: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: '#FFF7ED',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dropdownItemTextActive: {
    color: colors.accent,
  },
  dropdownItemSubText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  dropdownItemRegion: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 1,
  },
  quickBadgeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  quickBadge: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickBadgeActive: {
    borderColor: colors.accent,
    backgroundColor: '#FFF7ED',
  },
  quickBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  quickBadgeTextActive: {
    color: colors.accent,
  },
  quickBadgeSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  quickBadgeSubActive: {
    color: colors.accentDark,
  },
  footer: {
    paddingBottom: 8,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 52,
    gap: 8,
    ...shadows.md,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  arrowIcon: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '900',
  },
});
