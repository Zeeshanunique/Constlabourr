import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { ChevronDown, Check, Globe } from 'lucide-react-native';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';

interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
];

export function LanguageSelectionScreen() {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(LANGUAGES[0]);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownHeight] = useState(new Animated.Value(0));

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
        toValue: 240,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleSelectLanguage = (lang: LanguageOption) => {
    setSelectedLanguage(lang);
    toggleDropdown();
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
          <Text style={styles.screenTitle}>Select Operational{'\n'}Language</Text>
          <Text style={styles.screenSubtitle}>अपनी कार्य भाषा चुनें / Choose preferred vernacular</Text>
        </View>

        {/* Dropdown Card */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>PRIMARY LANGUAGE</Text>
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
                {selectedLanguage.nativeLabel} ({selectedLanguage.label})
              </Text>
            </View>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: dropdownHeight.interpolate({
                      inputRange: [0, 240],
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
              {LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage.code === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                    onPress={() => handleSelectLanguage(lang)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                      {lang.nativeLabel} <Text style={styles.dropdownItemSubText}>({lang.label})</Text>
                    </Text>
                    {isSelected && <Check size={18} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}

          {/* Quick Language Badges Grid */}
          <View style={styles.quickBadgeGrid}>
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLanguage.code === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.quickBadge, isSelected && styles.quickBadgeActive]}
                  onPress={() => setSelectedLanguage(lang)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickBadgeText, isSelected && styles.quickBadgeTextActive]}>
                    {lang.nativeLabel}
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
            <Text style={styles.continueButtonText}>Continue to Portal</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: '#FFF7ED',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dropdownItemTextActive: {
    fontWeight: '800',
    color: colors.accent,
  },
  dropdownItemSubText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  quickBadgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  quickBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  quickBadgeTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    paddingBottom: 12,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.md,
    ...shadows.hero,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  arrowIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
