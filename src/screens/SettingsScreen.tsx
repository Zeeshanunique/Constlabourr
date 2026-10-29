import React, { useState, useContext } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext, AppContextType } from '../context/AppContext';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/styles/theme';
import { BrandLogo } from '@/components/shared/BrandLogo';

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

export function SettingsScreen() {
  const context = useContext(AppContext) as AppContextType | null;
  const user = context?.user;
  const logout = context?.logout;

  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isOfflineSyncEnabled, setIsOfflineSyncEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const handleLanguageSelect = (lang: LanguageOption) => {
    setSelectedLanguage(lang);
    setIsLanguageModalOpen(false);
    Toast.show({
      type: 'success',
      text1: 'Language Updated',
      text2: `Portal interface language set to ${lang.label} (${lang.nativeLabel})`,
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out of ConstLabour',
      'Are you sure you want to log out of your session on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
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

  const handleReferFriend = async () => {
    const shareMessage =
      'Track site attendance, wage payouts, and generate statutory Form D/B with ConstLabour Pro. Download the app today: https://constlabour.com';
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        Toast.show({
          type: 'info',
          text1: 'WhatsApp Not Installed',
          text2: 'Could not open WhatsApp. Link copied to clipboard.',
        });
      }
    } catch (error) {
      console.error('Sharing error:', error);
    }
  };

  const handleContactSupport = async () => {
    const supportMessage = `Hello ConstLabour Support, I need assistance with account ${user?.email || user?.name || ''}.`;
    const whatsappUrl = `whatsapp://send?phone=919876543210&text=${encodeURIComponent(supportMessage)}`;
    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        Toast.show({
          type: 'info',
          text1: 'Support Helpline',
          text2: 'Helpline: +91 98765 43210 (9 AM - 7 PM)',
        });
      }
    } catch (error) {
      console.error('Support link error:', error);
    }
  };

  const renderLanguageItem = ({ item }: { item: LanguageOption }) => {
    const isSelected = item.code === selectedLanguage.code;
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
            {item.label}
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
          <Text style={styles.headerTitle}>Account & Settings</Text>
          <Text style={styles.headerSubtitle}>System configuration, security & compliance</Text>
        </View>

        {/* Language Selection Pill */}
        <TouchableOpacity
          style={styles.langToggle}
          onPress={() => setIsLanguageModalOpen(true)}
          activeOpacity={0.75}
        >
          <MaterialIcons name="language" size={15} color={theme.colors.safetyOrange} />
          <Text style={styles.langToggleText}>
            {selectedLanguage.code.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. CONTRACTOR IDENTITY HERO CARD */}
        <View style={styles.profileHeroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>
                {(user?.name || 'C').charAt(0).toUpperCase()}
              </Text>
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
                <Text style={styles.profilePhone}>
                  📱 +91 {user.phone}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.complianceRibbon}>
            <MaterialIcons name="verified-user" size={14} color={theme.colors.emerald[600]} />
            <Text style={styles.complianceText}>
              Labour Code 2020 Compliant • Verified Entity
            </Text>
          </View>
        </View>

        {/* 2. CONSTLABOUR PRO ENTERPRISE PASS */}
        <View style={styles.proCard}>
          <View style={styles.proLeft}>
            <View style={styles.proBadgeIcon}>
              <MaterialIcons name="star" size={20} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.proTitleRow}>
                <Text style={styles.proTitle}>ConstLabour Pro Enterprise</Text>
                <View style={styles.proActiveTag}>
                  <Text style={styles.proActiveTagText}>ACTIVE</Text>
                </View>
              </View>
              <Text style={styles.proSubtitle}>
                Automated Form D/B Registers • Direct UPI Disbursals
              </Text>
            </View>
          </View>
        </View>

        {/* 3. SECTION: PREFERENCES & DISPLAY */}
        <Text style={styles.sectionLabel}>System Preferences</Text>
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
                <Text style={styles.rowTitle}>Language / भाषा</Text>
                <Text style={styles.rowSubTitle}>
                  {selectedLanguage.nativeLabel} ({selectedLanguage.label})
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
                <Text style={styles.rowTitle}>Biometric App Lock</Text>
                <Text style={styles.rowSubTitle}>
                  {Platform.OS === 'ios' ? 'Face ID / Touch ID on launch' : 'Fingerprint security on launch'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={setIsAppLockEnabled}
              trackColor={{ false: theme.colors.slate[300], true: theme.colors.safetyOrange }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.divider} />

          {/* Row 3: Push Notifications */}
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="notifications-none" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Attendance & Shift Alerts</Text>
                <Text style={styles.rowSubTitle}>Notify upon shift check-in or duty updates</Text>
              </View>
            </View>
            <Switch
              value={isNotificationsEnabled}
              onValueChange={setIsNotificationsEnabled}
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
                <Text style={styles.rowTitle}>Offline First Sync</Text>
                <Text style={styles.rowSubTitle}>Store attendance offline & push when connected</Text>
              </View>
            </View>
            <Switch
              value={isOfflineSyncEnabled}
              onValueChange={setIsOfflineSyncEnabled}
              trackColor={{ false: theme.colors.slate[300], true: theme.colors.safetyOrange }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* 4. SECTION: STATUTORY & LEGAL COMPLIANCE */}
        <Text style={styles.sectionLabel}>Statutory Compliance & Legal</Text>
        <View style={styles.cardGroup}>
          {/* Row 1: Labour Code 2020 */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.65}
            onPress={() => {
              Toast.show({
                type: 'info',
                text1: 'Statutory Guidelines',
                text2: 'Muster rolls formatted to Contract Labour (R&A) Act 1970 standards.',
              });
            }}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleEmerald}>
                <MaterialIcons name="gavel" size={18} color={theme.colors.emerald[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Labour Law Standards (Form D & B)</Text>
                <Text style={styles.rowSubTitle}>Compliant statutory muster format</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 2: Privacy Policy */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.65}
            onPress={() => {
              Linking.openURL('https://constlabour.com/privacy').catch(() => {});
            }}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="shield" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Privacy Policy & Data Security</Text>
                <Text style={styles.rowSubTitle}>Encrypted Aadhaar & wage records</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 3: Terms of Service */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.65}
            onPress={() => {
              Linking.openURL('https://constlabour.com/terms').catch(() => {});
            }}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconCircleSlate}>
                <MaterialIcons name="menu-book" size={18} color={theme.colors.slate[700]} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Terms of Service</Text>
                <Text style={styles.rowSubTitle}>Contractor software licensing terms</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>
        </View>

        {/* 5. SECTION: SUPPORT & COMMUNITY */}
        <Text style={styles.sectionLabel}>Help & Contractor Community</Text>
        <View style={styles.cardGroup}>
          {/* Row 1: 24/7 WhatsApp Field Support */}
          <TouchableOpacity
            style={styles.rowItem}
            onPress={handleContactSupport}
            activeOpacity={0.65}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircleEmerald, { backgroundColor: '#ECFDF5' }]}>
                <MaterialIcons name="support-agent" size={18} color="#059669" />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>24/7 WhatsApp Field Support</Text>
                <Text style={styles.rowSubTitle}>Direct chat with labor desk specialists</Text>
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
              <View style={[styles.iconCircleSlate, { backgroundColor: theme.colors.safetyOrangeLight }]}>
                <MaterialIcons name="share" size={18} color={theme.colors.safetyOrange} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Share App with Contractors</Text>
                <Text style={styles.rowSubTitle}>Recommend ConstLabour to site managers</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
          </TouchableOpacity>
        </View>

        {/* 6. SIGN OUT BUTTON */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialIcons name="logout" size={18} color={theme.colors.red[600]} />
          <Text style={styles.logoutButtonText}>Sign Out from ConstLabour</Text>
        </TouchableOpacity>

        {/* 7. FOOTER BRAND LOGO & SYSTEM INFO */}
        <View style={styles.footerBrand}>
          <BrandLogo size={42} showText={true} />
          <Text style={styles.versionText}>Version 2.4.0 (Industrial Swiss Edition)</Text>
          <View style={styles.secureBadge}>
            <MaterialIcons name="security" size={13} color={theme.colors.emerald[600]} />
            <Text style={styles.secureText}>256-Bit Encrypted Data • Made in India 🇮🇳</Text>
          </View>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
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
                <Text style={styles.modalHeaderTitle}>Select Language</Text>
                <Text style={styles.modalHeaderSubtitle}>Choose your preferred interface language</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsLanguageModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={18} color={theme.colors.slate[600]} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={LANGUAGES}
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
});
