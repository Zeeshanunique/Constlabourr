import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { ChevronDown, Check, Globe } from 'lucide-react-native';

const { width } = Dimensions.get('window');

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
        duration: 200,
        useNativeDriver: false,
      }).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      Animated.timing(dropdownHeight, {
        toValue: 240,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleSelectLanguage = (lang: LanguageOption) => {
    setSelectedLanguage(lang);
    toggleDropdown();
  };

  const handleContinue = () => {
    // Navigate to Login screen
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.appName}>ConstLabour</Text>
          <Text style={styles.title}>Select your preferred{'\n'}language</Text>
        </View>

        {/* Dropdown Card Container */}
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.dropdownButton, isOpen && styles.dropdownButtonActive]}
            onPress={toggleDropdown}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownButtonLeft}>
              <Globe size={20} color="#2563eb" style={styles.globeIcon} />
              <Text style={styles.selectedText}>
                {selectedLanguage.label} ({selectedLanguage.nativeLabel})
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
              <ChevronDown size={20} color="#6b7280" />
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
                    {isSelected && <Check size={18} color="#2563eb" />}
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}
        </View>

        {/* Bottom Section */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.9}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoContainer: {
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  logoImage: {
    width: '90%',
    height: '90%',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    width: '100%',
    marginVertical: 40,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    minHeight: 52,
  },
  dropdownButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#ffffff',
  },
  dropdownButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  globeIcon: {
    marginRight: 12,
  },
  selectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownMenu: {
    overflow: 'hidden',
    marginTop: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  dropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  dropdownItemSubText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '400',
  },
  footer: {
    marginBottom: 20,
    width: '100%',
  },
  continueButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    minHeight: 54,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
