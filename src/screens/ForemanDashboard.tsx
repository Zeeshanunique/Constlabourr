import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '../utils/supabase/info';
import { useNavigation, useRoute, NavigationProp, useFocusEffect } from '@react-navigation/native';
import type { ForemanTabParamList } from '../navigation/ForemanNavigator';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';
import { useTranslation } from '../i18n';
import { DashboardSkeleton } from '../components/shared/Skeleton';
import { ErrorCard } from '../components/shared/ErrorCard';

interface ForemanDashboardProps {
  accessToken?: string;
}

interface ForemanStats {
  assignedWorkers: number;
  assignedSites: number;
  presentToday: number;
  absentToday: number;
  siteName?: string;
  totalWagesToday?: number;
  turnoutPercentage?: number;
}

export function ModernForemanDashboard({ accessToken }: ForemanDashboardProps) {
  const context = useContext(AppContext);
  const navigation = useNavigation<NavigationProp<ForemanTabParamList>>();
  const route = useRoute();
  const { language, setLanguage, t } = useTranslation();
  const token = accessToken || (route.params as any)?.accessToken;
  const [stats, setStats] = useState<ForemanStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handled reliably by useFocusEffect below without duplicate initial fetch
  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchStats();
      }
    }, [token])
  );

  const fetchStats = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const localDeviceSessionId = await AsyncStorage.getItem('@constlabour_device_session_id');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foreman/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(localDeviceSessionId ? { 'x-device-session-id': localDeviceSessionId } : {}),
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        context?.handleUnauthorized();
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data.stats || null);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching foreman stats:', err);
      setError(err?.message || 'Could not load site overview');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout') || 'Sign Out',
      language === 'hi'
        ? 'क्या आप निश्चित रूप से लॉग आउट करना चाहते हैं?'
        : language === 'bn'
        ? 'আপনি কি নিশ্চিত যে লগ আউট করতে চান?'
        : 'Are you sure you want to log out of ConstLabour?',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        { text: t('settings.logout') || 'Logout', style: 'destructive', onPress: context?.logout },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  if (!context) return null;

  const presentCount = stats?.presentToday || 0;
  const absentCount = stats?.absentToday || 0;
  const assignedWorkers = stats?.assignedWorkers || 0;
  const assignedSites = stats?.assignedSites || 1;

  const turnoutPercentage = assignedWorkers > 0 ? Math.round((presentCount / assignedWorkers) * 100) : 90;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BrandLogo
            size={38}
            showText={true}
            variant="light"
            subtitle={language === 'hi' ? 'साइट पर्यवेक्षक / फोरमैन' : language === 'bn' ? 'সাইট সুপারভাইজার / ফোরম্যান' : 'SITE SUPERVISOR / FOREMAN'}
          />
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => {
                const nextLang = language === 'en' ? 'hi' : language === 'hi' ? 'bn' : 'en';
                setLanguage(nextLang);
              }}
              style={styles.langPillButton}
              activeOpacity={0.8}
            >
              <MaterialIcons name="language" size={14} color="#FDBA74" />
              <Text style={styles.langPillButtonText}>
                {language === 'en' ? 'EN' : language === 'hi' ? 'हिन्दी' : 'বাংলা'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={styles.iconCircleButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="logout" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.foremanBadgeRow}>
          <View style={styles.activeSitePill}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.activeSitePillText}>
              {stats?.siteName
                ? `${language === 'hi' ? 'असाइन साइट' : language === 'bn' ? 'নিযুক্ত সাইট' : 'Assigned Site'} • ${stats.siteName}`
                : (language === 'hi' ? 'असाइन साइट • सक्रिय' : language === 'bn' ? 'নিযুক্ত সাইট • সক্রিয়' : 'Assigned Site • Active')}
            </Text>
          </View>
          <Text style={styles.foremanNameText}>
            {context.user?.name || context.user?.email?.split('@')[0]}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {loading && !stats ? (
          <DashboardSkeleton />
        ) : error && !stats ? (
          <ErrorCard message={error} onRetry={fetchStats} />
        ) : (
          <>
            {/* 3. 4-CARD BENTO GRID */}
            <Text style={styles.sectionLabel}>
              {language === 'hi' ? 'दैनिक साइट शिफ्ट अवलोकन' : language === 'bn' ? 'দৈনিক সাইট শিফট ওভারভিউ' : 'DAILY SITE SHIFT OVERVIEW'}
            </Text>
        <View style={styles.bentoGrid}>
          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>
                {language === 'hi' ? 'आज उपस्थित' : language === 'bn' ? 'আজ উপস্থিত' : 'Present Today'}
              </Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.successLight }]}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>{presentCount}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.successDark }]}>
                {turnoutPercentage}% {language === 'hi' ? 'उपस्थिति' : language === 'bn' ? 'উপস্থিতি' : 'Turnout'}
              </Text>
            </View>
          </View>

          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>
                {language === 'hi' ? 'अनुपस्थित / अवकाश' : language === 'bn' ? 'অনুপস্থিত / ছুটি' : 'Absent / Off'}
              </Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.errorLight }]}>
                <MaterialIcons name="cancel" size={16} color={colors.error} />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: colors.error }]} numberOfLines={1} adjustsFontSizeToFit>{absentCount}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.errorDark }]}>
                {language === 'hi' ? 'चेक-इन नहीं' : language === 'bn' ? 'চেক-ইন নেই' : 'Not Checked-In'}
              </Text>
            </View>
          </View>

          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>
                {language === 'hi' ? 'तैनात क्रू' : language === 'bn' ? 'নিযুক্ত শ্রমিক' : 'Assigned Crew'}
              </Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.surfaceMuted }]}>
                <MaterialIcons name="groups" size={16} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.bentoNumber} numberOfLines={1} adjustsFontSizeToFit>{assignedWorkers}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.bentoTagText, { color: colors.textMuted }]}>
                {language === 'hi' ? 'साइट रोस्टर' : language === 'bn' ? 'সাইট রোস্টার' : 'Site Roster'}
              </Text>
            </View>
          </View>

          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>
                {t('sites.activeSites')}
              </Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.accentLight }]}>
                <MaterialIcons name="location-city" size={16} color={colors.accent} />
              </View>
            </View>
            <Text style={styles.bentoNumber} numberOfLines={1} adjustsFontSizeToFit>{assignedSites}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.accentDark }]}>
                {language === 'hi' ? 'असाइन' : language === 'bn' ? 'বরাদ্দ' : 'Assigned'}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. TACTICAL FOREMAN ACTIONS */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
          {language === 'hi' ? 'पर्यवेक्षक कार्य' : language === 'bn' ? 'সুপারভাইজার অ্যাকশন' : 'SUPERVISOR ACTIONS'}
        </Text>
        <View style={styles.actionsList}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Attendance' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: colors.accent }]}>
              <MaterialIcons name="assignment-turned-in" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionTextContent}>
              <Text style={styles.actionTitle}>
                {language === 'hi' ? 'दैनिक उपस्थिति दर्ज करें' : language === 'bn' ? 'দৈনিক উপস্থিতি লিপিবদ্ধ করুন' : 'Mark Daily Attendance'}
              </Text>
              <Text style={styles.actionSub}>
                {language === 'hi' ? 'चेक-इन, चेक-आउट, आधा दिन और ओवरटाइम दर्ज करें' : language === 'bn' ? 'চেক-ইন, চেক-আউট, অর্ধ-দিবস এবং ওভারটাইম লগ করুন' : 'Log Check-in, Check-out, Half-day, and Overtime'}
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Workers' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="people" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionTextContent}>
              <Text style={styles.actionTitle}>
                {language === 'hi' ? 'तैनात साइट श्रमिक' : language === 'bn' ? 'নিযুক্ত সাইট শ্রমিক' : 'Assigned Site Workers'}
              </Text>
              <Text style={styles.actionSub}>
                {language === 'hi' ? 'कौशल वर्गीकरण, संपर्क और विवरण देखें' : language === 'bn' ? 'দক্ষতার শ্রেণীবিভাগ, যোগাযোগ ও তথ্য দেখুন' : 'View skill classification, contacts & emergency info'}
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 5,
  },
  langPillButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FDBA74',
  },
  iconCircleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  foremanBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  activeSitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#334155',
    flexShrink: 1,
    maxWidth: '75%',
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  activeSitePillText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    flexShrink: 1,
  },
  foremanNameText: {
    fontSize: 12,
    color: colors.accentLight,
    fontWeight: '700',
    flexShrink: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 14,
  },
  alertIcon: {
    fontSize: 20,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentDark,
    flexShrink: 1,
  },
  alertSub: {
    fontSize: 11,
    color: '#9A3412',
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  bentoCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  bentoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bentoCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    flexShrink: 1,
    marginRight: 4,
  },
  microIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 2,
  },
  bentoTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    marginTop: 4,
  },
  bentoTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  actionsList: {
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  actionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
