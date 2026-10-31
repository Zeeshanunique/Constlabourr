import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '../utils/supabase/info';
import {
  useNavigation,
  useRoute,
  NavigationProp,
  useFocusEffect,
} from '@react-navigation/native';
import type { ContractorTabParamList } from '../navigation/ContractorNavigator';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';
import { useTranslation } from '../i18n';

interface ContractorDashboardProps {
  accessToken?: string;
}

interface Site {
  id: string;
  name: string;
  address?: string;
  status?: string;
}

interface Stats {
  totalWorkers: number;
  activeWorkers: number;
  presentToday: number;
  halfDayToday: number;
  absentToday: number;
  unmarkedToday: number;
  totalSites: number;
  activeSites: number;
  totalWagesToday: number;
  turnoutPercentage: number;
  date?: string;
  siteId?: string;
}

export function ModernContractorDashboard({ accessToken }: ContractorDashboardProps) {
  const context = useContext(AppContext);
  const navigation = useNavigation<NavigationProp<ContractorTabParamList>>();
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const { language, setLanguage, t } = useTranslation();

  const [stats, setStats] = useState<Stats | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [selectedSiteName, setSelectedSiteName] = useState('All Active Sites');
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchSites();
      fetchStats('all');
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchSites();
        fetchStats(selectedSiteId);
      }
    }, [token, selectedSiteId])
  );

  const fetchSites = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.sites && Array.isArray(data.sites)) {
          setSites(data.sites);
        }
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchStats = async (siteIdParam?: string) => {
    if (!token) return;
    const currentSiteId = siteIdParam !== undefined ? siteIdParam : selectedSiteId;
    setLoading(true);
    try {
      const query = currentSiteId && currentSiteId !== 'all' ? `?siteId=${currentSiteId}` : '';
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/dashboard/stats${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      if (data.stats) setStats(data.stats);
      if (data.sites && (!sites || sites.length === 0)) {
        setSites(data.sites);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSite = (siteId: string, siteName: string) => {
    setSelectedSiteId(siteId);
    setSelectedSiteName(siteName);
    setShowSiteModal(false);
    fetchStats(siteId);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSites(), fetchStats(selectedSiteId)]);
    setRefreshing(false);
  };

  if (!context) return null;

  const totalWorkersCount = stats?.totalWorkers ?? 0;
  const presentCount = stats?.presentToday ?? 0;
  const halfDayCount = stats?.halfDayToday ?? 0;
  const absentCount = stats?.absentToday ?? 0;
  const unmarkedCount = stats?.unmarkedToday ?? 0;
  const activeSitesCount = stats?.activeSites ?? (stats?.totalSites ?? sites.length);
  const totalWagesToday = stats?.totalWagesToday ?? (presentCount * 800 + halfDayCount * 400);
  const turnoutPercentage = stats?.turnoutPercentage ?? (
    totalWorkersCount > 0 ? Math.round(((presentCount + halfDayCount) / totalWorkersCount) * 100) : 0
  );

  // Wage format helper
  const formatWageDisplay = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL COMMAND HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BrandLogo size={38} showText={true} variant="light" subtitle="CONTRACTOR COMMAND" />
          <View style={styles.headerRightActions}>
            {/* 1-Tap Quick Language Switcher */}
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

            <TouchableOpacity onPress={context.logout} style={styles.iconCircleButton}>
              <MaterialIcons name="logout" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Site Switcher Dropdown Trigger & Profile Row */}
        <View style={styles.siteSwitcherRow}>
          <TouchableOpacity
            style={styles.siteSelectorPill}
            onPress={() => setShowSiteModal(true)}
            activeOpacity={0.75}
          >
            <View style={styles.gpsPulseDot} />
            <Text style={styles.siteSelectorText} numberOfLines={1}>
              {selectedSiteName}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.userProfileTag}>
            <MaterialIcons name="verified-user" size={14} color={colors.accentLight} />
            <Text style={styles.userProfileText}>
              {context.user?.name || context.user?.email?.split('@')[0] || 'Contractor'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* 2. REAL-TIME WORKFORCE OVERVIEW GRID */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>
            {selectedSiteId === 'all' ? "TODAY'S COMPANY OVERVIEW" : `${selectedSiteName.toUpperCase()} OVERVIEW`}
          </Text>
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>

        <View style={styles.bentoGrid}>
          {/* Card 1: Present Today */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>{t('attendance.present')}</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.successLight }]}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{presentCount}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.successDark }]}>
                {turnoutPercentage}% {t('attendance.title')}
              </Text>
            </View>
          </View>

          {/* Card 2: Daily Wages Accrual */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>{t('attendance.dailyPayment')}</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.accentLight }]}>
                <MaterialIcons name="payments" size={16} color={colors.accent} />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{formatWageDisplay(totalWagesToday)}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.accentDark }]}>
                {t('common.today')}
              </Text>
            </View>
          </View>

          {/* Card 3: Absent / Unmarked */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>{t('attendance.absent')}</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.errorLight }]}>
                <MaterialIcons name="cancel" size={16} color={colors.error} />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{absentCount}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.errorDark }]}>
                {totalWorkersCount} {t('common.total')}
              </Text>
            </View>
          </View>

          {/* Card 4: Active Sites */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>{t('nav.sites')}</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.surfaceMuted }]}>
                <MaterialIcons name="location-city" size={16} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{activeSitesCount}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.bentoTagText, { color: colors.primary }]}>
                {selectedSiteId !== 'all' ? selectedSiteName : t('common.active')}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. TACTICAL ACTION DOCK */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{t('common.actions')}</Text>
        <View style={styles.actionDockGrid}>
          <TouchableOpacity
            style={[styles.actionDockItem, { borderColor: '#FED7AA' }]}
            onPress={() => navigation.navigate('Attendance' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: colors.accent }]}>
              <MaterialIcons name="assignment-turned-in" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionDockTitle}>{t('attendance.markAttendance')}</Text>
            <Text style={styles.actionDockSubtitle}>{t('attendance.title')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionDockItem, { borderColor: '#A7F3D0' }]}
            onPress={() => navigation.navigate('Workers' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: colors.success }]}>
              <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionDockTitle}>{t('workers.addWorker')}</Text>
            <Text style={styles.actionDockSubtitle}>{t('workers.directory')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionDockItem, { borderColor: '#CBD5E1' }]}
            onPress={() => navigation.navigate('Payroll' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="receipt-long" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionDockTitle}>{t('nav.payroll')}</Text>
            <Text style={styles.actionDockSubtitle}>{t('payroll.netDisbursable')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionDockItem, { borderColor: '#FDE68A' }]}
            onPress={() => {
              const parent = navigation.getParent<NavigationProp<AppStackParamList>>();
              if (parent) parent.navigate('Reports', { accessToken: token });
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: colors.warning }]}>
              <MaterialIcons name="insert-chart" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionDockTitle}>{t('nav.reports')}</Text>
            <Text style={styles.actionDockSubtitle}>{t('common.export')}</Text>
          </TouchableOpacity>
        </View>

        {/* 4. LIVE SITE COMPLIANCE CARD */}
        <View style={styles.complianceCard}>
          <View style={styles.complianceHeader}>
            <View style={styles.complianceTitleLeft}>
              <MaterialIcons name="security" size={18} color={colors.accent} />
              <Text style={styles.complianceCardTitle}>{t('dashboard.complianceTitle')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const parent = navigation.getParent<NavigationProp<AppStackParamList>>();
                if (parent) parent.navigate('Agreements', { accessToken: token });
              }}
            >
              <Text style={styles.complianceLink}>{t('nav.agreements')} ➔</Text>
            </TouchableOpacity>
          </View>

          {/* Turnout Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>{t('dashboard.turnout')}</Text>
              <Text style={styles.progressPercent}>{turnoutPercentage}% {t('dashboard.benchmarkProductivity')}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(turnoutPercentage, 100)}%` },
                ]}
              />
            </View>

            <View style={styles.progressBreakdownRow}>
              <Text style={styles.breakdownItem}>
                <Text style={{ color: colors.success, fontWeight: '800' }}>● {presentCount}</Text> {t('attendance.present')}
              </Text>
              {halfDayCount > 0 && (
                <Text style={styles.breakdownItem}>
                  <Text style={{ color: colors.warning, fontWeight: '800' }}>● {halfDayCount}</Text> {t('attendance.halfDay')}
                </Text>
              )}
              <Text style={styles.breakdownItem}>
                <Text style={{ color: colors.error, fontWeight: '800' }}>● {absentCount}</Text> {t('attendance.absent')}
              </Text>
              {unmarkedCount > 0 && (
                <Text style={styles.breakdownItem}>
                  <Text style={{ color: colors.textMuted, fontWeight: '800' }}>● {unmarkedCount}</Text> -
                </Text>
              )}
            </View>
          </View>

          {/* Micro Checklist */}
          <View style={styles.complianceList}>
            <View style={styles.complianceItem}>
              <MaterialIcons name="check-circle" size={16} color={colors.success} />
              <Text style={styles.complianceItemText}>{t('dashboard.complianceBadge')}</Text>
            </View>
            <View style={styles.complianceItem}>
              <MaterialIcons name="check-circle" size={16} color={colors.success} />
              <Text style={styles.complianceItemText}>{t('dashboard.complianceSub')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 6. ACTIVE SITES SELECTOR MODAL */}
      <Modal visible={showSiteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t('dashboard.selectSiteModalTitle')}</Text>
                <Text style={styles.modalSubtitle}>{t('dashboard.selectSiteModalSubtitle')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSiteModal(false)}
                style={styles.modalCloseCircle}
              >
                <MaterialIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalSiteList} showsVerticalScrollIndicator={false}>
              {/* Option 1: All Active Sites */}
              <TouchableOpacity
                style={[
                  styles.siteModalItem,
                  selectedSiteId === 'all' && styles.siteModalItemActive,
                ]}
                onPress={() => handleSelectSite('all', t('dashboard.allActiveSites'))}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.siteModalIconCircle,
                    selectedSiteId === 'all' && styles.siteModalIconCircleActive,
                  ]}
                >
                  <MaterialIcons
                    name="domain"
                    size={20}
                    color={selectedSiteId === 'all' ? '#FFFFFF' : colors.primary}
                  />
                </View>
                <View style={styles.siteModalDetails}>
                  <Text style={styles.siteModalName}>{t('dashboard.allActiveSites')}</Text>
                  <Text style={styles.siteModalAddress}>
                    {sites.length} {t('sites.activeSites')}
                  </Text>
                </View>
                {selectedSiteId === 'all' && (
                  <MaterialIcons name="check-circle" size={20} color={colors.accent} />
                )}
              </TouchableOpacity>

              {/* Individual Sites */}
              {sites.map((site) => {
                const isSelected = selectedSiteId === site.id;
                return (
                  <TouchableOpacity
                    key={site.id}
                    style={[
                      styles.siteModalItem,
                      isSelected && styles.siteModalItemActive,
                    ]}
                    onPress={() => handleSelectSite(site.id, site.name)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.siteModalIconCircle,
                        isSelected && styles.siteModalIconCircleActive,
                      ]}
                    >
                      <MaterialIcons
                        name="location-city"
                        size={20}
                        color={isSelected ? '#FFFFFF' : colors.primary}
                      />
                    </View>
                    <View style={styles.siteModalDetails}>
                      <Text style={styles.siteModalName}>{site.name}</Text>
                      <Text style={styles.siteModalAddress} numberOfLines={1}>
                        {site.address || 'Active Project Site'}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check-circle" size={20} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {sites.length === 0 && (
                <View style={styles.noSitesBox}>
                  <Text style={styles.noSitesText}>{t('sites.noSitesFound')}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    ...shadows.card,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    gap: 4,
  },
  langPillButtonText: {
    fontSize: 11,
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
  siteSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  siteSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    maxWidth: '65%',
  },
  gpsPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  siteSelectorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 2,
  },
  userProfileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  userProfileText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentLight,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 30,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bentoCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  bentoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bentoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  microIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  bentoTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    marginTop: 6,
  },
  bentoTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionDockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionDockItem: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    ...shadows.sm,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionDockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  actionDockSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  complianceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 20,
    ...shadows.card,
  },
  complianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  complianceTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complianceCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 6,
  },
  complianceLink: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  progressSection: {
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  progressBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  breakdownItem: {
    fontSize: 11,
    color: colors.textMuted,
  },
  complianceList: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  complianceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complianceItemText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Site Selector Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '75%',
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSiteList: {
    maxHeight: 380,
  },
  siteModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.background,
  },
  siteModalItemActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
    borderColor: colors.accent,
  },
  siteModalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  siteModalIconCircleActive: {
    backgroundColor: colors.accent,
  },
  siteModalDetails: {
    flex: 1,
  },
  siteModalName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  siteModalAddress: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  noSitesBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noSitesText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
