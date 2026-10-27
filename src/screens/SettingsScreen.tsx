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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext, AppContextType } from '../context/AppContext';
import Toast from 'react-native-toast-message';
import {
  User as UserIcon,
  Phone,
  Lock,
  ChevronRight,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  BookOpen,
  MessageSquare,
  Star,
  LogOut,
  Settings as SettingsIcon,
  Check,
} from 'lucide-react-native';

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
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const handleLanguageSelect = (lang: LanguageOption) => {
    setSelectedLanguage(lang);
    setIsLanguageModalOpen(false);
    Toast.show({
      type: 'success',
      text1: 'Language Changed',
      text2: `App language set to ${lang.label} (${lang.nativeLabel})`,
    });
  };

  const handleLogout = () => {
    if (logout) {
      logout();
    }
  };

  const handleReferFriend = async () => {
    const shareMessage = 'Hey! Manage your construction workforce easily with ConstLabour app. Download now!';
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
    
    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        Toast.show({
          type: 'info',
          text1: 'WhatsApp Not Installed',
          text2: 'Could not open WhatsApp. Copy link to share.',
        });
      }
    } catch (error) {
      console.error('Sharing error:', error);
    }
  };

  const renderLanguageItem = ({ item }: { item: LanguageOption }) => {
    const isSelected = item.code === selectedLanguage.code;
    return (
      <TouchableOpacity
        style={[styles.langItem, isSelected && styles.langItemActive]}
        onPress={() => handleLanguageSelect(item)}
      >
        <Text style={[styles.langItemText, isSelected && styles.langItemTextActive]}>
          {item.nativeLabel} ({item.label})
        </Text>
        {isSelected && <Check size={18} color="#2563eb" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Settings</Text>
        
        {/* Language Selection Trigger */}
        <TouchableOpacity
          style={styles.langToggle}
          onPress={() => setIsLanguageModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.langToggleText}>अ/A</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Profile Info */}
        <Text style={styles.sectionLabel}>Profile Info</Text>
        <View style={styles.cardGroup}>
          {/* Row 1: Name */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperGrey}>
                <UserIcon size={20} color="#64748b" />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Name</Text>
                <Text style={styles.rowSubTitle}>
                  {user?.name || 'MANAGER'}
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.roleTag}>{(user?.role || 'contractor').toUpperCase()}</Text>
              <ChevronRight size={18} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 2: Mobile */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperGrey}>
                <Phone size={20} color="#64748b" />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Mobile</Text>
                <Text style={styles.rowSubTitle}>
                  {user?.phone || '9835812224'}
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <ChevronRight size={18} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 3: App Lock */}
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperGrey}>
                <Lock size={20} color="#64748b" />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>App Lock</Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.switchLabel}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
              <Switch
                value={isAppLockEnabled}
                onValueChange={setIsAppLockEnabled}
                trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                thumbColor={isAppLockEnabled ? '#2563eb' : '#f1f5f9'}
              />
            </View>
          </View>
        </View>

        {/* Laborbook Pro Banner Card */}
        <TouchableOpacity style={styles.proCard} activeOpacity={0.85}>
          <View style={styles.proLeft}>
            <View style={styles.proIcon}>
              <Text style={styles.proIconText}>L</Text>
            </View>
            <Text style={styles.proTitle}>Laborbook Pro</Text>
          </View>
          <ChevronRight size={18} color="#cbd5e1" />
        </TouchableOpacity>

        {/* Section: General */}
        <Text style={styles.sectionLabel}>General</Text>
        <View style={styles.cardGroup}>
          {/* Row 1: App Backup */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperBlue}>
                <RefreshCw size={18} color="#2563eb" />
              </View>
              <Text style={styles.generalItemText}>App Backup</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 2: Pricing */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperBlue}>
                <CreditCard size={18} color="#2563eb" />
              </View>
              <Text style={styles.generalItemText}>Pricing</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 3: Privacy Policy */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperBlue}>
                <ShieldCheck size={18} color="#2563eb" />
              </View>
              <Text style={styles.generalItemText}>Privacy Policy</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 4: Terms & Conditions */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperBlue}>
                <BookOpen size={18} color="#2563eb" />
              </View>
              <Text style={styles.generalItemText}>Terms & Conditions</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 5: Request a Feature */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperBlue}>
                <MessageSquare size={18} color="#2563eb" />
              </View>
              <Text style={styles.generalItemText}>Request a Feature</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 6: Give us Rating & Feedback */}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperBlue}>
                <Star size={18} color="#2563eb" />
              </View>
              <Text style={styles.generalItemText}>Give us Rating & Feedback</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 7: Logout */}
          <TouchableOpacity
            style={styles.rowItem}
            onPress={handleLogout}
            activeOpacity={0.6}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapperBlue}>
                <LogOut size={18} color="#2563eb" />
              </View>
              <Text style={styles.generalItemText}>Logout</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* WhatsApp Refer Banner */}
        <TouchableOpacity
          style={styles.referBanner}
          onPress={handleReferFriend}
          activeOpacity={0.9}
        >
          <View style={styles.referLeft}>
            <View style={styles.whatsappIconCircle}>
              <Phone size={20} color="#ffffff" style={{ transform: [{ rotate: '45deg' }] }} />
            </View>
            <View style={styles.referTexts}>
              <Text style={styles.referTitle}>Refer a friend</Text>
              <Text style={styles.referSubTitle}>Refer ConstLabour app to your friends</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#ffffff" />
        </TouchableOpacity>

        {/* Footer Brand Logo & Badges */}
        <View style={styles.footerBrand}>
          <View style={styles.brandRow}>
            <SettingsIcon size={24} color="#2563eb" style={styles.brandGear} />
            <Text style={styles.brandText}>ConstLabour</Text>
          </View>
          <Text style={styles.versionText}>V1.5.2</Text>
          <View style={styles.secureBadge}>
            <ShieldCheck size={14} color="#10b981" style={{ marginRight: 4 }} />
            <Text style={styles.secureText}>100% Secure data · Made in India 🇮🇳</Text>
          </View>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={isLanguageModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Language</Text>
            <FlatList
              data={LANGUAGES}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsLanguageModalOpen(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  langToggle: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  langToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 24,
    marginBottom: 8,
    paddingLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapperGrey: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowTexts: {
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  rowSubTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  switchLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  proLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ef4444', // Pro Red icon
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  proIconText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
  },
  proTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  iconWrapperBlue: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  generalItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  referBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#22c55e', // Green theme
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 24,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  referLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  whatsappIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referTexts: {
    flex: 1,
  },
  referTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  referSubTitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '500',
  },
  footerBrand: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brandGear: {
    marginRight: 4,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  versionText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 4,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  secureText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '60%',
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  langItemActive: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  langItemText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  langItemTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  modalCloseButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
});
