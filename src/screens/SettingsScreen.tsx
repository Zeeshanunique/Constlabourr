import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Linking,
  Modal,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppContext, AppContextType } from '../context/AppContext';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import { theme, colors, shadows, radii } from '@/styles/theme';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { useTranslation, SUPPORTED_LANGUAGES, LanguageOption } from '../i18n';
import { projectId } from '@/utils/supabase/info';

const SUPPORT_PHONE = '9835812224';
const SUPPORT_PHONE_DISPLAY = '+91 98358 12224';

export function SettingsScreen() {
  const context = useContext(AppContext) as AppContextType | null;
  const user = context?.user;
  const logout = context?.logout;
  const { language, setLanguage, t, currentLanguageOption } = useTranslation();

  // 1. Persistent Switch States
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isOfflineSyncEnabled, setIsOfflineSyncEnabled] = useState(true);

  // 2. Modals Visibility
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // 3. Edit Profile Form State
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Load preferences from AsyncStorage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [appLock, notifs, offlineSync] = await Promise.all([
          AsyncStorage.getItem('@constlabour_app_lock'),
          AsyncStorage.getItem('@constlabour_notifications'),
          AsyncStorage.getItem('@constlabour_offline_sync'),
        ]);

        if (appLock !== null) setIsAppLockEnabled(appLock === 'true');
        if (notifs !== null) setIsNotificationsEnabled(notifs === 'true');
        if (offlineSync !== null) setIsOfflineSyncEnabled(offlineSync === 'true');
      } catch (e) {
        console.error('Failed to load local preferences:', e);
      }
    };
    loadPreferences();
  }, []);

  // Sync profile form state when user changes
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
      setEditEmail(user.email || '');
    }
  }, [user]);

  // Preference Handlers with persistence & biometric security
  const handleToggleAppLock = async (val: boolean) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (val) {
        if (!hasHardware) {
          Alert.alert(
            'Hardware Not Supported',
            'Your device does not support biometric or device lock authentication.'
          );
          return;
        }
        if (!isEnrolled) {
          Alert.alert(
            'Security Lock Required',
            'No fingerprint, Face ID, or device screen PIN is set up on this device. Please enable screen lock or biometrics in your phone Settings first.'
          );
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify identity to enable App Lock',
          fallbackLabel: 'Use Device PIN / Password',
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsAppLockEnabled(true);
          await AsyncStorage.setItem('@constlabour_app_lock', 'true');
          Toast.show({
            type: 'success',
            text1: 'App Lock Enabled',
            text2: 'Fingerprint, Face ID or PIN required when opening app',
          });
        }
      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify identity to disable App Lock',
          fallbackLabel: 'Use Device PIN / Password',
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsAppLockEnabled(false);
          await AsyncStorage.setItem('@constlabour_app_lock', 'false');
          Toast.show({
            type: 'info',
            text1: 'App Lock Disabled',
            text2: 'Standard direct access restored',
          });
        }
      }
    } catch (e: any) {
      console.error('App lock toggle error:', e);
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: e.message || 'Could not verify biometric identity',
      });
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    setIsNotificationsEnabled(val);
    await AsyncStorage.setItem('@constlabour_notifications', val ? 'true' : 'false');
    Toast.show({
      type: 'success',
      text1: val ? 'Shift Alerts Active' : 'Alerts Muted',
      text2: val ? 'Real-time attendance & wage notices enabled' : 'Notifications turned off',
    });
  };

  const handleToggleOfflineSync = async (val: boolean) => {
    setIsOfflineSyncEnabled(val);
    await AsyncStorage.setItem('@constlabour_offline_sync', val ? 'true' : 'false');
    Toast.show({
      type: 'success',
      text1: val ? 'Offline First Sync Active' : 'Offline Sync Disabled',
      text2: val
        ? 'Field shifts cached locally and synced when online'
        : 'Direct internet connection required',
    });
  };

  // Language Select Handler
  const handleLanguageSelect = async (lang: LanguageOption) => {
    await setLanguage(lang.code);
    setIsLanguageModalOpen(false);
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: `${t('settings.chooseLanguage')}: ${lang.label} (${lang.nativeLabel})`,
    });
  };

  // Profile Save Handler (using real backend endpoint PUT /auth/profile)
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter a valid full name',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const { data: sessionData } = (await context?.supabase.auth.getSession()) || {};
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: editName.trim(),
            email: editEmail.trim(),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      // Refresh application context so headers & dashboards update immediately
      if (context?.refreshUser) {
        await context.refreshUser();
      }

      setIsEditProfileModalOpen(false);
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('settings.profileUpdated'),
      });
    } catch (err: any) {
      console.error('Profile update error:', err);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: err.message || 'Could not update profile',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // WhatsApp Support Launcher (Target: 9835812224)
  const openWhatsAppSupport = async () => {
    const supportMessage = `Hello ConstLabour Support, I need assistance with my account: ${
      user?.name || ''
    } (${user?.phone || user?.email || ''}).`;
    const cleanNumber = `91${SUPPORT_PHONE}`;

    // Universal web link works across all browsers & native app
    const waUniversal = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(supportMessage)}`;
    const waAppUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodeURIComponent(
      supportMessage
    )}`;

    setIsSupportModalOpen(false);

    try {
      const canOpenApp = await Linking.canOpenURL(waAppUrl).catch(() => false);
      if (canOpenApp) {
        await Linking.openURL(waAppUrl);
        return;
      }
      // Fallback to universal WhatsApp web link
      await Linking.openURL(waUniversal);
    } catch (err) {
      console.error('WhatsApp redirect error:', err);
      // Fallback to direct phone dialer
      Linking.openURL(`tel:+91${SUPPORT_PHONE}`).catch(() => {
        Toast.show({
          type: 'info',
          text1: 'Support Helpline',
          text2: `WhatsApp / Call: ${SUPPORT_PHONE_DISPLAY}`,
        });
      });
    }
  };

  // Direct Phone Call Launcher (Target: 9835812224)
  const callSupportHelpline = () => {
    setIsSupportModalOpen(false);
    Linking.openURL(`tel:+91${SUPPORT_PHONE}`).catch(() => {
      Toast.show({
        type: 'info',
        text1: 'Support Helpline',
        text2: `Helpline: ${SUPPORT_PHONE_DISPLAY}`,
      });
    });
  };

  // Native Multi-App Referral Share
  const handleReferFriend = async () => {
    const shareMessage =
      'Track site attendance, wage payouts, and generate statutory Form D/B with ConstLabour Pro. Download the app today: https://constlabour.com';
    try {
      await Share.share({
        message: shareMessage,
        title: 'Recommend ConstLabour Pro',
      });
    } catch (error) {
      console.error('Sharing error:', error);
    }
  };

  // Logout Confirmation
  const handleLogout = () => {
    Alert.alert(
      t('auth.logoutConfirmTitle'),
      t('auth.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: () => {
            if (logout) {
              logout();
            }
          },
        },
      ]
    );
  };

  const renderLanguageItem = ({ item }: { item: LanguageOption }) => {
    const isSelected = item.code === language;
    return (
      <TouchableOpacity
        style={[styles.langItem, isSelected && styles.langItemActive]}
        onPress={() => handleLanguageSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.langItemLeft}>
          <Text style={[styles.langNativeText, isSelected && styles.langItemTextActive]}>
            {item.nativeLabel}
          </Text>
          <Text style={[styles.langLabelText, isSelected && styles.langLabelTextActive]}>
            {item.label} {item.subLabel ? `• ${item.subLabel}` : ''}
          </Text>
        </View>
        {isSelected ? (
          <MaterialIcons name="check-circle" size={20} color={theme.colors.safetyOrange} />
        ) : (
          <View style={styles.langUncheckCircle} />
        )}
      </TouchableOpacity>
    );
  };

  const roleTitle = (user?.role || 'contractor').toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('settings.subtitle')}</Text>
        </View>

        {/* Language Selection Pill */}
        <TouchableOpacity
          style={styles.langToggle}
          onPress={() => setIsLanguageModalOpen(true)}
          activeOpacity={0.75}
        >
          <MaterialIcons name="language" size={15} color={theme.colors.safetyOrange} />
          <Text style={styles.langToggleText}>{currentLanguageOption.nativeLabel}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. CONTRACTOR IDENTITY HERO CARD WITH EDIT ACTION */}
        <View style={styles.profileHeroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{(user?.name || 'C').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.heroTexts}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user?.name || 'Apex Infrastructure'}
                </Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>{roleTitle}</Text>
                </View>
              </View>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email || 'admin@constlabour.com'}
              </Text>
              {user?.phone ? (
                <Text style={styles.profilePhone}>📱 +91 {user.phone}</Text>
              ) : null}
            </View>

            {/* Quick Edit Profile Button */}
            <TouchableOpacity
              style={styles.editHeroPill}
              onPress={() => setIsEditProfileModalOpen(true)}
              activeOpacity={0.75}
            >
              <MaterialIcons name="edit" size={16} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.complianceRibbon}>
            <MaterialIcons name="verified-user" size={14} color={theme.colors.emerald[600]} />
            <Text style={styles.complianceText}>{t('settings.complianceRibbon')}</Text>
          </View>
        </View>

        {/* 2. CONSTLABOUR PRO ENTERPRISE PASS (INTERACTIVE) */}
        <TouchableOpacity
          style={styles.proCard}
          onPress={() => setIsProModalOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.proLeft}>
            <View style={styles.proBadgeIcon}>
              <MaterialIcons name="star" size={20} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.proTitleRow}>
                <Text style={styles.proTitle}>ConstLabour Pro Enterprise</Text>
                <View style={styles.proActiveTag}>
                  <Text style={styles.proActiveTagText}>{t('settings.enterprisePass')}</Text>
                </View>
              </View>
              <Text style={styles.proSubtitle}>{t('dashboard.complianceBadge')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* 3. SECTION: SYSTEM PREFERENCES & CONTROLS */}
        <Text style={styles.sectionLabel}>{t('settings.systemPreferences')}</Text>
        <View style={styles.cardGroup}>
          {/* Row 1: App Interface Language */}
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => setIsLanguageModalOpen(true)}
            activeOpacity={0.65}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="translate" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.language')}</Text>
                <Text style={styles.rowSubTitle}>
                  {currentLanguageOption.nativeLabel} ({currentLanguageOption.label})
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 2: Biometric App Lock */}
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="fingerprint" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.appLock')}</Text>
                <Text style={styles.rowSubTitle}>{t('settings.appLockSub')}</Text>
              </View>
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: theme.colors.slate[300], true: theme.colors.safetyOrange }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.divider} />

          {/* Row 3: Push Notifications */}
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons
                  name="notifications-none"
                  size={18}
                  color={theme.colors.slate[700]}
                />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.notifications')}</Text>
                <Text style={styles.rowSubTitle}>{t('settings.notificationsSub')}</Text>
              </View>
            </View>
            <Switch
              value={isNotificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: theme.colors.slate[300], true: theme.colors.emerald[500] }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.divider} />

          {/* Row 4: Offline Field Sync */}
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="cloud-sync" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.offlineSync')}</Text>
                <Text style={styles.rowSubTitle}>{t('settings.offlineSyncSub')}</Text>
              </View>
            </View>
            <Switch
              value={isOfflineSyncEnabled}
              onValueChange={handleToggleOfflineSync}
              trackColor={{ false: theme.colors.slate[300], true: theme.colors.safetyOrange }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* 4. SECTION: STATUTORY & LEGAL COMPLIANCE */}
        <Text style={styles.sectionLabel}>{t('reports.statutoryCompliance')}</Text>
        <View style={styles.cardGroup}>
          {/* Row 1: Labour Code 2020 Guidelines */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.65}
            onPress={() => setIsComplianceModalOpen(true)}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleEmerald}>
                <MaterialIcons name="gavel" size={18} color={theme.colors.emerald[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('dashboard.complianceBadge')}</Text>
                <Text style={styles.rowSubTitle}>{t('dashboard.complianceSub')}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 2: Privacy Policy */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.65}
            onPress={() => setIsPrivacyModalOpen(true)}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="shield" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.privacyPolicy')}</Text>
                <Text style={styles.rowSubTitle}>{t('settings.privacyPolicySub')}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 3: Terms of Service */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.65}
            onPress={() => setIsTermsModalOpen(true)}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="menu-book" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.terms')}</Text>
                <Text style={styles.rowSubTitle}>{t('settings.termsSub')}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>
        </View>

        {/* 5. SECTION: SUPPORT & COMMUNITY (WHATSAPP 9835812224) */}
        <Text style={styles.sectionLabel}>{t('settings.support')}</Text>
        <View style={styles.cardGroup}>
          {/* Row 1: WhatsApp Support (Redirects to 9835812224) */}
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => setIsSupportModalOpen(true)}
            activeOpacity={0.65}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircleEmerald, { backgroundColor: '#ECFDF5' }]}>
                <MaterialIcons name="support-agent" size={18} color="#059669" />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.support')}</Text>
                <Text style={styles.rowSubTitle}>
                  {SUPPORT_PHONE_DISPLAY} • {t('settings.supportSub')}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 2: Refer a Contractor Peer */}
          <TouchableOpacity
            style={styles.rowItem}
            onPress={handleReferFriend}
            activeOpacity={0.65}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.iconCircleSlate,
                  { backgroundColor: theme.colors.safetyOrangeLight },
                ]}
              >
                <MaterialIcons name="share" size={18} color={theme.colors.safetyOrange} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{t('settings.referFriend')}</Text>
                <Text style={styles.rowSubTitle}>{t('settings.referFriendSub')}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>
        </View>

        {/* 6. SIGN OUT BUTTON */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <MaterialIcons name="logout" size={18} color={theme.colors.red[600]} />
          <Text style={styles.logoutButtonText}>{t('auth.logout')}</Text>
        </TouchableOpacity>

        {/* 7. FOOTER BRAND LOGO & SYSTEM INFO */}
        <View style={styles.footerBrand}>
          <BrandLogo size={42} showText={true} />
          <Text style={styles.versionText}>{t('settings.version')}</Text>
          <View style={styles.secureBadge}>
            <MaterialIcons name="security" size={13} color={theme.colors.emerald[600]} />
            <Text style={styles.secureText}>
              {language === 'hi'
                ? '256-बिट एन्क्रिप्टेड डेटा • भारत में निर्मित 🇮🇳'
                : language === 'bn'
                ? '২৫৬-বিট এনক্রিপ্ট করা ডেটা • ভারতে নির্মিত 🇮🇳'
                : '256-Bit Encrypted Data • Made in India 🇮🇳'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL 1: WHATSAPP & PHONE SUPPORT MODAL (9835812224) */}
      {/* ======================================================== */}
      <Modal
        visible={isSupportModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSupportModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>{t('settings.supportModalTitle')}</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {SUPPORT_PHONE_DISPLAY} (Mon - Sat, 9 AM - 8 PM)
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSupportModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, gap: 12 }}>
              {/* WhatsApp Option */}
              <TouchableOpacity
                style={styles.supportWaBtn}
                onPress={openWhatsAppSupport}
                activeOpacity={0.85}
              >
                <MaterialIcons name="chat" size={20} color="#FFFFFF" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.supportWaTitle}>{t('settings.chatWhatsApp')}</Text>
                  <Text style={styles.supportWaSub}>Instant Chat with Labor Specialist</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Direct Call Option */}
              <TouchableOpacity
                style={styles.supportCallBtn}
                onPress={callSupportHelpline}
                activeOpacity={0.85}
              >
                <MaterialIcons name="phone" size={20} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.supportCallTitle}>{t('settings.callSupport')}</Text>
                  <Text style={styles.supportCallSub}>Direct Voice Call Helpline</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: EDIT PROFILE MODAL */}
      {/* ======================================================== */}
      <Modal
        visible={isEditProfileModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditProfileModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>{t('settings.editProfile')}</Text>
                <Text style={styles.modalHeaderSubtitle}>Update contractor identity & contact</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditProfileModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, gap: 14 }}>
              <View>
                <Text style={styles.inputLabel}>{t('forms.fullName')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter full name / organization"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>{t('forms.mobileNumber')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <MaterialIcons name="lock" size={12} color="#64748B" />
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Non-editable</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.textInput, { backgroundColor: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' }]}
                  value={editPhone}
                  editable={false}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  Mobile number is locked to your verified account identity.
                </Text>
              </View>

              <View>
                <Text style={styles.inputLabel}>{t('forms.emailAddress')}</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: '#F8FAFC' }]}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="contractor@domain.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setIsEditProfileModalOpen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelModalBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveModalBtn}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                  activeOpacity={0.85}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveModalBtnText}>{t('forms.saveChanges')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: PRO ENTERPRISE PASS DETAILS */}
      {/* ======================================================== */}
      <Modal
        visible={isProModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsProModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>ConstLabour Pro Enterprise</Text>
                <Text style={styles.modalHeaderSubtitle}>Industrial License Details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsProModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <View style={styles.proBadgeRow}>
                <MaterialIcons name="workspace-premium" size={28} color={colors.accent} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>
                    Active Enterprise Tier
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>
                    ● Lifetime Active Field License
                  </Text>
                </View>
              </View>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.featureItemText}>Unlimited Construction Sites & Workers</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.featureItemText}>
                    Labour Code 2020 Form A, B & D PDF Exports
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.featureItemText}>Direct UPI & Bank Wage Disbursements</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.featureItemText}>
                    Priority 24/7 WhatsApp Desk (+91 98358 12224)
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.proCloseBtn}
                onPress={() => setIsProModalOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.proCloseBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: STATUTORY LABOUR CODE COMPLIANCE MODAL */}
      {/* ======================================================== */}
      <Modal
        visible={isComplianceModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsComplianceModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>{t('dashboard.complianceBadge')}</Text>
                <Text style={styles.modalHeaderSubtitle}>Official Statutory Guidelines</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsComplianceModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, padding: 18 }} showsVerticalScrollIndicator={false}>
              <View style={styles.guidelineCard}>
                <Text style={styles.guidelineHeading}>Code on Wages, 2019 (Section 43)</Text>
                <Text style={styles.guidelineBody}>
                  Mandates all registered contractors to maintain electronic registers of wages
                  (Form B) and attendance muster rolls (Form A), ensuring itemized wage slip
                  delivery.
                </Text>
              </View>

              <View style={styles.guidelineCard}>
                <Text style={styles.guidelineHeading}>Working Hours & Overtime Regulation</Text>
                <Text style={styles.guidelineBody}>
                  Standard daily shift limit is 8 hours (48 hours/week). Overtime is calculated at
                  200% (2x) the standard hourly wage rate.
                </Text>
              </View>

              <View style={styles.guidelineCard}>
                <Text style={styles.guidelineHeading}>Contract Labour (R&A) Act, 1970</Text>
                <Text style={styles.guidelineBody}>
                  Requires digital proof of wage disbursement through UPI or Bank Transfer to
                  protect contractor indemnification.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.proCloseBtn, { marginTop: 12, marginBottom: 16 }]}
                onPress={() => setIsComplianceModalOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.proCloseBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: PRIVACY POLICY & DATA SECURITY */}
      {/* ======================================================== */}
      <Modal
        visible={isPrivacyModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPrivacyModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>{t('settings.privacyPolicy')}</Text>
                <Text style={styles.modalHeaderSubtitle}>DPDP Act 2023 Compliant Storage</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsPrivacyModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, padding: 18 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.legalBody}>
                ConstLabour Pro employs AES-256 bit encryption for all contractor and worker
                records. Worker Aadhaar numbers are cryptographically hashed using SHA-256 with
                only the final 4 digits displayed for verification.
              </Text>
              <Text style={styles.legalBody}>
                Geolocation data is captured solely during shift check-in and check-out to verify
                site geofencing limits and is never shared with third parties.
              </Text>
              <TouchableOpacity
                style={[styles.proCloseBtn, { marginTop: 14, marginBottom: 16 }]}
                onPress={() => setIsPrivacyModalOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.proCloseBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 6: TERMS OF SERVICE */}
      {/* ======================================================== */}
      <Modal
        visible={isTermsModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsTermsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>{t('settings.terms')}</Text>
                <Text style={styles.modalHeaderSubtitle}>Software Service & Usage Terms</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsTermsModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, padding: 18 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.legalBody}>
                By using ConstLabour Pro, the contractor confirms authorization to manage site
                attendances, calculate statutory deductions, and process worker wages.
              </Text>
              <Text style={styles.legalBody}>
                The platform generates official statutory registers in accordance with applicable
                Indian labour legislation. Contractors are responsible for ensuring timely wage
                settlements.
              </Text>
              <TouchableOpacity
                style={[styles.proCloseBtn, { marginTop: 14, marginBottom: 16 }]}
                onPress={() => setIsTermsModalOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.proCloseBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 7: LANGUAGE SELECTION MODAL */}
      {/* ======================================================== */}
      <Modal
        visible={isLanguageModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>
                  {t('settings.selectLanguageModalTitle')}
                </Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {t('settings.selectLanguageModalSubtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsLanguageModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={SUPPORTED_LANGUAGES}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              contentContainerStyle={{ paddingVertical: 8 }}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.slate[900],
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.slate[500],
    marginTop: 2,
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.3)',
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.safetyOrangeLight,
  },
  langToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.safetyOrange,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 12,
  },
  profileHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroTexts: {
    flex: 1,
    gap: 3,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.slate[900],
    flex: 1,
  },
  editHeroPill: {
    padding: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleTag: {
    backgroundColor: theme.colors.safetyOrangeLight,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.safetyOrange,
    letterSpacing: 0.5,
  },
  profileEmail: {
    fontSize: 12,
    color: theme.colors.slate[600],
    fontWeight: '500',
  },
  profilePhone: {
    fontSize: 12,
    color: theme.colors.slate[500],
  },
  complianceRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.sm,
    marginTop: 12,
  },
  complianceText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.emerald[700],
  },
  proCard: {
    backgroundColor: theme.colors.slate[900],
    borderRadius: theme.radii.lg,
    padding: 14,
    ...theme.shadows.md,
  },
  proLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.safetyOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  proActiveTag: {
    backgroundColor: theme.colors.emerald[600],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proActiveTagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  proSubtitle: {
    fontSize: 11,
    color: theme.colors.slate[400],
    marginTop: 2,
    lineHeight: 15,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.slate[500],
    marginTop: 10,
    marginBottom: -4,
    paddingLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardGroup: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 10,
  },
  iconCircleSlate: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.slate[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleEmerald: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.emerald[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.slate[900],
  },
  rowSubTitle: {
    fontSize: 11,
    color: theme.colors.slate[500],
    lineHeight: 14,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.slate[100],
    marginLeft: 60,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: theme.radii.md,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.red[600],
  },
  footerBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    gap: 6,
  },
  versionText: {
    fontSize: 11,
    color: theme.colors.slate[400],
    fontWeight: '600',
    marginTop: 4,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  secureText: {
    fontSize: 11,
    color: theme.colors.slate[500],
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.xl,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.slate[100],
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.slate[900],
  },
  modalHeaderSubtitle: {
    fontSize: 11,
    color: theme.colors.slate[500],
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  langItemActive: {
    backgroundColor: theme.colors.safetyOrangeLight,
  },
  langItemLeft: {
    gap: 2,
  },
  langNativeText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.slate[800],
  },
  langLabelText: {
    fontSize: 12,
    color: theme.colors.slate[500],
  },
  langItemTextActive: {
    color: theme.colors.safetyOrange,
    fontWeight: '800',
  },
  langLabelTextActive: {
    color: theme.colors.safetyOrange,
  },
  langUncheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: theme.colors.slate[300],
  },
  modalDivider: {
    height: 1,
    backgroundColor: theme.colors.slate[100],
    marginHorizontal: 16,
  },
  // WhatsApp Support Modal Styles
  supportWaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: radii.lg,
    padding: 14,
    ...shadows.sm,
  },
  supportWaTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  supportWaSub: {
    fontSize: 11,
    color: '#ECFDF5',
    marginTop: 1,
  },
  supportCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
  },
  supportCallTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  supportCallSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  // Edit Profile Modal Styles
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  saveModalBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    ...shadows.sm,
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Pro Modal Styles
  proBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  proCloseBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  proCloseBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Guidelines & Legal Styles
  guidelineCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  guidelineHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  guidelineBody: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  legalBody: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
});
