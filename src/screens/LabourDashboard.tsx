import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '../utils/supabase/info';
import { useNavigation, useRoute, NavigationProp } from '@react-navigation/native';
import type { LabourTabParamList } from '../navigation/LabourNavigator';
import { WorkerAgreementModal } from '../features/agreements/WorkerAgreementModal';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';
import { useTranslation } from '../i18n';
import { DashboardSkeleton } from '../components/shared/Skeleton';
import { ErrorCard } from '../components/shared/ErrorCard';

interface LabourDashboardProps {
  accessToken?: string;
}

interface WorkerProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  skillLevel?: string;
  dailyWage?: number;
  overtimeRate?: number;
  messCharge?: number;
  siteId?: string;
  contractorId?: string;
  upiId?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
}

interface AttendanceItem {
  id: string;
  workerId?: string;
  date: string;
  status: 'present' | 'absent' | 'half-day' | 'unmarked';
  shift?: 'day' | 'night';
  checkIn?: string;
  checkOut?: string;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  dailyPayment?: number;
  overtimePayment?: number;
  totalPayment?: number;
  siteId?: string;
  siteName?: string;
  notes?: string;
}

interface AdvanceItem {
  id: string;
  amount: number;
  date: string;
  reason?: string;
  status: 'pending' | 'deducted' | 'cancelled';
}

export function ModernLabourDashboard({ accessToken }: LabourDashboardProps) {
  const context = useContext(AppContext);
  const navigation = useNavigation<NavigationProp<LabourTabParamList>>();
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const { language, setLanguage, t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [needsAgreementAcceptance, setNeedsAgreementAcceptance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded Data
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [assignedSiteName, setAssignedSiteName] = useState<string>('Floating / Not Assigned');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceItem[]>([]);
  const [advancesList, setAdvancesList] = useState<AdvanceItem[]>([]);

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    if (!token) return;
    setError(null);
    try {
      const localDeviceSessionId = await AsyncStorage.getItem('@constlabour_device_session_id');
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...(localDeviceSessionId ? { 'x-device-session-id': localDeviceSessionId } : {}),
      };
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // Check if workerId is already available in context to eliminate waterfall
      const knownWorkerId = context?.user?.id || (context?.user as any)?.workerId;

      // Prepare common requests in parallel
      const profilePromise = fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
        { headers }
      );
      const agrPromise = fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/status`,
        { headers }
      );
      const sitesPromise = fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        { headers }
      );

      let attRes: PromiseSettledResult<Response>;
      let advRes: PromiseSettledResult<Response>;
      let agrRes: PromiseSettledResult<Response>;
      let sitesRes: PromiseSettledResult<Response>;
      let loadedProfile: WorkerProfile | null = null;

      if (knownWorkerId) {
        // FAST PATH: All 5 requests dispatched concurrently in parallel!
        const attPromise = fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?workerId=${knownWorkerId}&startDate=${startOfMonth}&endDate=${endOfMonth}`,
          { headers }
        );
        const advPromise = fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances?workerId=${knownWorkerId}`,
          { headers }
        );

        const [profSettled, attSettled, advSettled, agrSettled, sitesSettled] = await Promise.allSettled([
          profilePromise,
          attPromise,
          advPromise,
          agrPromise,
          sitesPromise,
        ]);

        if (
          profSettled.status === 'fulfilled' &&
          (profSettled.value.status === 401 || profSettled.value.status === 403)
        ) {
          context?.handleUnauthorized();
          return;
        }

        if (profSettled.status === 'fulfilled' && profSettled.value.ok) {
          try {
            const profData = await profSettled.value.json();
            loadedProfile = profData.profile || profData.user;
            setProfile(loadedProfile);
          } catch (e) {
            console.warn('Error parsing profile json:', e);
          }
        }

        attRes = attSettled;
        advRes = advSettled;
        agrRes = agrSettled;
        sitesRes = sitesSettled;
      } else {
        // FALLBACK PATH: Wait for profile first to get workerId
        const [profSettled, agrSettled, sitesSettled] = await Promise.allSettled([
          profilePromise,
          agrPromise,
          sitesPromise,
        ]);

        if (
          profSettled.status === 'fulfilled' &&
          (profSettled.value.status === 401 || profSettled.value.status === 403)
        ) {
          context?.handleUnauthorized();
          return;
        }

        if (profSettled.status === 'fulfilled' && profSettled.value.ok) {
          try {
            const profData = await profSettled.value.json();
            loadedProfile = profData.profile || profData.user;
            setProfile(loadedProfile);
          } catch (e) {
            console.warn('Error parsing profile json:', e);
          }
        }

        const resolvedWorkerId = loadedProfile?.id;
        const attUrl = resolvedWorkerId
          ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?workerId=${resolvedWorkerId}&startDate=${startOfMonth}&endDate=${endOfMonth}`
          : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?startDate=${startOfMonth}&endDate=${endOfMonth}`;

        const advUrl = resolvedWorkerId
          ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances?workerId=${resolvedWorkerId}`
          : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances`;

        const [attSettled, advSettled] = await Promise.allSettled([
          fetch(attUrl, { headers }),
          fetch(advUrl, { headers }),
        ]);

        attRes = attSettled;
        advRes = advSettled;
        agrRes = agrSettled;
        sitesRes = sitesSettled;
      }

      const workerId = loadedProfile?.id || knownWorkerId;

      // Process Sites
      const sitesMap = new Map<string, string>();
      if (sitesRes.status === 'fulfilled' && sitesRes.value.ok) {
        const sitesData = await sitesRes.value.json();
        const sitesList = sitesData.sites || [];
        sitesList.forEach((s: any) => {
          if (s.id && s.name) sitesMap.set(s.id, s.name);
        });
        const targetSiteId = loadedProfile?.siteId || (context?.user as any)?.siteId;
        if (targetSiteId && sitesMap.has(targetSiteId)) {
          setAssignedSiteName(sitesMap.get(targetSiteId)!);
        }
      }

      // Process Attendance
      if (attRes.status === 'fulfilled' && attRes.value.ok) {
        const attData = await attRes.value.json();
        const rawList = attData.attendance || [];
        const records: AttendanceItem[] = rawList.map((r: any) => {
          const rawStatus = (r.status || '').toLowerCase().trim();
          let safeStatus: 'present' | 'absent' | 'half-day' | 'unmarked' = 'unmarked';
          if (rawStatus === 'present' || rawStatus === 'overtime') safeStatus = 'present';
          else if (rawStatus === 'half-day' || rawStatus === 'half_day' || rawStatus === 'half') safeStatus = 'half-day';
          else if (rawStatus === 'absent') safeStatus = 'absent';
          else safeStatus = 'unmarked';

          const rawShift = (r.shift || '').toLowerCase().trim();
          const safeShift: 'day' | 'night' = rawShift.includes('night') ? 'night' : 'day';

          const sId = r.siteId || r.site_id;
          const sName = sitesMap.get(sId) || r.siteName || r.site_name || 'Assigned Site';

          return {
            id: r.id,
            workerId: r.workerId || r.worker_id,
            date: r.date,
            status: safeStatus,
            shift: safeShift,
            checkIn: r.checkIn || r.check_in,
            checkOut: r.checkOut || r.check_out,
            totalHours: Number(r.totalHours ?? r.total_hours ?? 0),
            regularHours: Number(r.regularHours ?? r.regular_hours ?? 0),
            overtimeHours: Number(r.overtimeHours ?? r.overtime_hours ?? 0),
            dailyPayment: Number(r.dailyPayment ?? r.daily_payment ?? 0),
            overtimePayment: Number(r.overtimePayment ?? r.overtime_payment ?? 0),
            totalPayment: Number(r.totalPayment ?? r.total_payment ?? 0),
            siteId: sId,
            siteName: sName,
            notes: r.notes,
          };
        });

        const filtered = workerId
          ? records.filter((r) => (r.workerId ? r.workerId === workerId : true))
          : records;
        setAttendanceRecords(filtered);
      }

      // Process Advances
      if (advRes.status === 'fulfilled' && advRes.value.ok) {
        const advData = await advRes.value.json();
        const allAdv: any[] = advData.advances || [];
        const myAdv = workerId ? allAdv.filter((a) => (a.workerId || a.worker_id) === workerId) : allAdv;
        const mapped: AdvanceItem[] = myAdv.map((a) => ({
          id: a.id,
          amount: Number(a.amount || 0),
          date: a.date,
          reason: a.reason || 'General Cash Advance',
          status: (a.status || 'pending').toLowerCase() as any,
        }));
        mapped.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setAdvancesList(mapped);
      }

      // Process Agreement
      if (agrRes.status === 'fulfilled' && agrRes.value.ok) {
        const agrData = await agrRes.value.json();
        if ((agrData.currentAgreement || agrData.agreement) && agrData.needsAcceptance) {
          setNeedsAgreementAcceptance(true);
        }
      }
    } catch (err: any) {
      console.error('Error loading worker dashboard data:', err);
      setError(err?.message || 'Failed to load craftsman dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const handleAgreementAccepted = () => {
    setNeedsAgreementAcceptance(false);
    loadDashboardData();
  };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to sign out of ConstLabour?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: context?.logout },
      ]
    );
  };

  if (!context) return null;

  // ==========================================
  // REAL-TIME COMPUTATIONS
  // ==========================================
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayIndian = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }, []);

  const currentMonthLabel = now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase();

  // Today's attendance record (check both device date and IST date)
  const todayRecord = attendanceRecords.find((a) => a.date === todayStr || a.date === todayIndian);

  // Memoized workforce finance & attendance computations to avoid re-calculating on every tick/render
  const computations = useMemo(() => {
    // Month Attendance Breakdown
    const fullPresent = attendanceRecords.filter((a) => a.status === 'present').length;
    const halfDay = attendanceRecords.filter((a) => a.status === 'half-day').length;
    const absent = attendanceRecords.filter((a) => a.status === 'absent').length;
    const shiftCredits = fullPresent + halfDay * 0.5;

    // Skill Config & Wage Rates
    const skillLvl = (profile?.skillLevel || (context?.user as any)?.skillLevel || 'Skilled').toUpperCase();
    const wage = profile?.dailyWage || (context?.user as any)?.dailyWage || 0;
    const otRate = profile?.overtimeRate || (context?.user as any)?.overtimeRate || 100;
    const upi = profile?.upiId || (context?.user as any)?.upiId;

    // Earnings Breakdown
    let gross = 0;
    let otHours = 0;
    let otPay = 0;
    let hasItemized = false;

    attendanceRecords.forEach((a) => {
      const pay = Number(a.totalPayment || a.dailyPayment || 0);
      if (pay > 0) hasItemized = true;
      gross += pay;

      const otH = Number(a.overtimeHours || 0);
      otHours += otH;
      const otP = Number(a.overtimePayment !== undefined && a.overtimePayment !== null && a.overtimePayment > 0 ? a.overtimePayment : (otH * otRate));
      otPay += otP;
    });

    if (!hasItemized && shiftCredits > 0) {
      gross = (shiftCredits * wage) + otPay;
    }

    const basePay = Math.max(0, gross - otPay);

    // Advances Breakdown
    const pendingTotal = advancesList
      .filter((a) => a.status === 'pending')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const deductedTotal = advancesList
      .filter((a) => a.status === 'deducted')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    // Mess Kharcha Deduction
    const messPerDay = Number(profile?.messCharge || (context?.user as any)?.messCharge || 0);
    const markedDates = new Set<string>();
    attendanceRecords.forEach((a) => {
      if (!a.date) return;
      const st = (a.status || '').toLowerCase().trim();
      if (st === 'present' || st === 'half-day' || st === 'absent' || st === 'overtime') {
        markedDates.add(a.date);
      }
    });
    const messDays = markedDates.size;
    const messCharge = messDays * messPerDay;
    const deductionsTotal = pendingTotal + messCharge;
    const netEarnings = Math.max(0, gross - deductionsTotal);

    return {
      fullPresentCount: fullPresent,
      halfDayCount: halfDay,
      absentCount: absent,
      totalShiftCredits: shiftCredits,
      skill: skillLvl,
      dailyWage: wage,
      overtimeRate: otRate,
      upiId: upi,
      grossAccrued: gross,
      totalOtHours: otHours,
      totalOtPay: otPay,
      baseShiftPay: basePay,
      pendingAdvancesTotal: pendingTotal,
      deductedAdvancesTotal: deductedTotal,
      messDaysCount: messDays,
      messChargePerDay: messPerDay,
      totalMessCharge: messCharge,
      totalAccruedDeductions: deductionsTotal,
      netAccruedEarnings: netEarnings,
    };
  }, [attendanceRecords, advancesList, profile, context?.user]);

  const {
    fullPresentCount,
    halfDayCount,
    absentCount,
    totalShiftCredits,
    skill,
    dailyWage,
    overtimeRate,
    upiId,
    grossAccrued,
    totalOtHours,
    totalOtPay,
    baseShiftPay,
    pendingAdvancesTotal,
    deductedAdvancesTotal,
    messDaysCount,
    messChargePerDay,
    totalMessCharge,
    totalAccruedDeductions,
    netAccruedEarnings,
  } = computations;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BrandLogo size={36} showText={true} variant="light" subtitle="CRAFTSMAN PORTAL" />
          <View style={styles.headerRightRow}>
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

            <TouchableOpacity onPress={handleLogout} style={styles.iconCircleButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="logout" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Worker Identity Badge Card */}
        <View style={styles.workerIdentityCard}>
          <View style={styles.workerAvatar}>
            <Text style={styles.workerAvatarText}>
              {(profile?.name || context.user?.name || 'W').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.workerIdentityMeta}>
            <View style={styles.workerNameRow}>
              <Text style={styles.workerNameText} numberOfLines={1}>
                {profile?.name || context.user?.name || 'Craftsman'}
              </Text>
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={13} color={colors.success} />
                <Text style={styles.verifiedBadgeText}>{t('common.verified')}</Text>
              </View>
            </View>
            <Text style={styles.workerSubDetails}>
              {skill} • {assignedSiteName}
            </Text>
            <View style={styles.wagePillRow}>
              <View style={styles.wageRatePill}>
                <MaterialIcons name="bolt" size={12} color={colors.accent} />
                <Text style={styles.wageRatePillText}>₹{dailyWage}/{language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'Day'}</Text>
              </View>
              <View style={styles.otRatePill}>
                <Text style={styles.otRatePillText}>₹{overtimeRate}/{language === 'hi' ? 'घंटे ओटी' : language === 'bn' ? 'ঘণ্টা ওটি' : 'hr OT'}</Text>
              </View>
              {upiId && (
                <View style={styles.upiPill}>
                  <Text style={styles.upiPillText}>⚡ {upiId}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {loading && !profile && attendanceRecords.length === 0 ? (
        <DashboardSkeleton />
      ) : error && !profile ? (
        <View style={{ padding: 16 }}>
          <ErrorCard message={error} onRetry={loadDashboardData} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
        {/* 2. TODAY'S SHIFT STATUS BANNER */}
        <View style={styles.todayBannerWrapper}>
          {todayRecord ? (
            <View
              style={[
                styles.todayBanner,
                todayRecord.status === 'present'
                  ? styles.todayBannerPresent
                  : todayRecord.status === 'half-day'
                  ? styles.todayBannerHalf
                  : styles.todayBannerAbsent,
              ]}
            >
              <View style={styles.todayBannerIconBox}>
                <MaterialIcons
                  name={
                    todayRecord.status === 'present'
                      ? 'check-circle'
                      : todayRecord.status === 'half-day'
                      ? 'timelapse'
                      : 'cancel'
                  }
                  size={24}
                  color={
                    todayRecord.status === 'present'
                      ? colors.successDark
                      : todayRecord.status === 'half-day'
                      ? colors.warningDark
                      : colors.errorDark
                  }
                />
              </View>
              <View style={styles.todayBannerContent}>
                <View style={styles.todayBannerRow}>
                  <Text style={styles.todayBannerTitle}>
                    {todayRecord.status === 'present' ? t('workerPortal.todayPresent') : todayRecord.status === 'half-day' ? t('workerPortal.todayHalf') : t('workerPortal.todayAbsent')}
                  </Text>
                  <View style={styles.todayShiftBadge}>
                    <Text style={styles.todayShiftBadgeText}>
                      {todayRecord.shift === 'night' ? t('attendance.nightShift') : t('attendance.dayShift')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.todayBannerSubtitle}>
                  {todayRecord.siteName || assignedSiteName} • {t('attendance.totalPayment')}: ₹{todayRecord.totalPayment || todayRecord.dailyPayment || 0}
                  {Number(todayRecord.overtimeHours || 0) > 0 ? ` (+${todayRecord.overtimeHours}h OT)` : ''}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.todayBannerPending}>
              <MaterialIcons name="schedule" size={24} color={colors.accent} />
              <View style={styles.todayBannerContent}>
                <Text style={styles.todayPendingTitle}>{t('workerPortal.todayShift')}</Text>
                <Text style={styles.todayPendingSub}>
                  {t('workerPortal.todayAbsent')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 3. HERO ESTIMATED EARNINGS CARD */}
        <View style={styles.earningsHero}>
          <View style={styles.earningsHeroHeader}>
            <View>
              <Text style={styles.earningsHeroLabel}>{t('workerPortal.netTakeHome')}</Text>
              <Text style={styles.earningsHeroAmount} numberOfLines={1} adjustsFontSizeToFit>₹{netAccruedEarnings.toLocaleString()}</Text>
            </View>
            <View style={styles.earningsHeroBadge}>
              <Text style={styles.earningsHeroBadgeText}>{currentMonthLabel}</Text>
            </View>
          </View>
          <Text style={styles.earningsHeroSub}>
            {t('payroll.subtitle')}
          </Text>

          {/* Mini Financial Breakdown Row */}
          <View style={styles.heroBreakdownRow}>
            <View style={styles.heroBreakdownItem}>
              <Text style={styles.heroBreakdownLabel}>{t('workerPortal.baseShiftWages')}</Text>
              <Text style={styles.heroBreakdownVal}>₹{baseShiftPay.toLocaleString()}</Text>
            </View>
            <View style={styles.heroBreakdownDivider} />
            <View style={styles.heroBreakdownItem}>
              <Text style={styles.heroBreakdownLabel}>{t('attendance.overtime')}</Text>
              <Text style={[styles.heroBreakdownVal, { color: colors.warningDark }]}>
                +₹{totalOtPay.toLocaleString()}
              </Text>
            </View>
            <View style={styles.heroBreakdownDivider} />
            <View style={styles.heroBreakdownItem}>
              <Text style={styles.heroBreakdownLabel}>
                {totalMessCharge > 0 ? (language === 'hi' ? 'खर्चा व मेस' : language === 'bn' ? 'খরচ ও মেস' : 'Kharcha & Mess') : t('workerPortal.pendingKharcha')}
              </Text>
              <Text style={[styles.heroBreakdownVal, { color: colors.error }]}>
                -₹{totalAccruedDeductions.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Mess Kharcha Transparency Pill */}
          {totalMessCharge > 0 && (
            <View style={styles.heroMessDeductionStrip}>
              <MaterialIcons name="restaurant" size={13} color="#EA580C" />
              <Text style={styles.heroMessDeductionText}>
                {language === 'hi'
                  ? `मेस कटौती: ₹${totalMessCharge.toLocaleString()} (${messDaysCount} दिन × ₹${messChargePerDay}) • उपस्थित/हाफ-डे/अनुपस्थित`
                  : language === 'bn'
                  ? `মেস কর্তন: ₹${totalMessCharge.toLocaleString()} (${messDaysCount} দিন × ₹${messChargePerDay}) • উপস্থিতি/হাফ-ডে/অনুপস্থিত`
                  : `Mess Deduction: ₹${totalMessCharge.toLocaleString()} (${messDaysCount} days @ ₹${messChargePerDay}/d) • Marked days`}
              </Text>
            </View>
          )}
        </View>

        {/* 4. 4-CARD WORK & KHARCHA BENTO */}
        <View style={styles.bentoRow}>
          <View style={styles.bentoCard}>
            <Text style={styles.bentoCardLabel}>{t('attendance.present')}</Text>
            <Text style={[styles.bentoCardValue, { color: colors.successDark }]} numberOfLines={1} adjustsFontSizeToFit>
              {fullPresentCount}
            </Text>
            <Text style={styles.bentoCardSub}>1.0 {language === 'hi' ? 'क्रेडिट/दिन' : language === 'bn' ? 'ক্রেডিট/দিন' : 'Credit/d'}</Text>
          </View>

          <View style={styles.bentoCard}>
            <Text style={styles.bentoCardLabel}>{t('attendance.halfDay')}</Text>
            <Text style={[styles.bentoCardValue, { color: colors.warningDark }]} numberOfLines={1} adjustsFontSizeToFit>
              {halfDayCount}
            </Text>
            <Text style={styles.bentoCardSub}>0.5 {language === 'hi' ? 'क्रेडिट/दिन' : language === 'bn' ? 'ক্রেডিট/দিন' : 'Credit/d'}</Text>
          </View>

          <View style={styles.bentoCard}>
            <Text style={styles.bentoCardLabel}>{t('attendance.overtime')}</Text>
            <Text style={[styles.bentoCardValue, { color: colors.info }]} numberOfLines={1} adjustsFontSizeToFit>
              {totalOtHours.toFixed(1)}h
            </Text>
            <Text style={styles.bentoCardSub}>{t('attendance.otHours')}</Text>
          </View>

          <View style={[styles.bentoCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <Text style={[styles.bentoCardLabel, { color: '#C2410C' }]}>{t('workerPortal.pendingKharcha')}</Text>
            <Text style={[styles.bentoCardValue, { color: colors.error }]} numberOfLines={1} adjustsFontSizeToFit>
              ₹{pendingAdvancesTotal}
            </Text>
            <Text style={[styles.bentoCardSub, { color: '#C2410C' }]}>{t('payroll.pending')}</Text>
          </View>
        </View>

        {/* 5. RECENT KHARCHA / ADVANCES LEDGER STRIP */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>
            {language === 'hi' ? 'मेरे हालिया खर्चे और अग्रिम' : language === 'bn' ? 'আমার সাম্প্রতিক খরচ ও অগ্রিম' : 'MY RECENT KHARCHA & ADVANCES'}
          </Text>
          <Text style={styles.sectionSubtitleBadge}>
            {advancesList.length} {language === 'hi' ? 'कुल' : language === 'bn' ? 'মোট' : 'Total'}
          </Text>
        </View>

        {advancesList.length === 0 ? (
          <View style={styles.emptyAdvanceBox}>
            <MaterialIcons name="account-balance-wallet" size={24} color={colors.textLight} />
            <Text style={styles.emptyAdvanceText}>
              {language === 'hi' ? 'इस महीने कोई अग्रिम या खर्चा दर्ज नहीं किया गया।' : language === 'bn' ? 'এই মাসে কোনো অগ্রিম বা খরচ লিপিবদ্ধ করা হয়নি।' : 'No cash advances or kharcha recorded this month.'}
            </Text>
          </View>
        ) : (
          <View style={styles.advanceMiniList}>
            {advancesList.slice(0, 3).map((adv) => {
              const isDeducted = adv.status === 'deducted';
              return (
                <View key={adv.id} style={styles.advanceMiniCard}>
                  <View style={styles.advanceMiniLeft}>
                    <View
                      style={[
                        styles.advanceMiniIcon,
                        { backgroundColor: isDeducted ? '#DCFCE7' : '#FFEDD5' },
                      ]}
                    >
                      <MaterialIcons
                        name={isDeducted ? 'check' : 'hourglass-top'}
                        size={16}
                        color={isDeducted ? colors.successDark : colors.accent}
                      />
                    </View>
                    <View>
                      <Text style={styles.advanceMiniReason}>
                        {adv.reason || (language === 'hi' ? 'सामान्य नकद अग्रिम' : language === 'bn' ? 'সাধারণ নগদ অগ্রিম' : 'General Cash Advance')}
                      </Text>
                      <Text style={styles.advanceMiniDate}>{adv.date}</Text>
                    </View>
                  </View>

                  <View style={styles.advanceMiniRight}>
                    <Text style={styles.advanceMiniAmount}>-₹{Number(adv.amount || 0).toLocaleString()}</Text>
                    <View
                      style={[
                        styles.advanceStatusBadge,
                        { backgroundColor: isDeducted ? '#DCFCE7' : '#FFF7ED' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.advanceStatusText,
                          { color: isDeducted ? colors.successDark : '#C2410C' },
                        ]}
                      >
                        {isDeducted ? (language === 'hi' ? 'कटौती हो गई' : language === 'bn' ? 'কর্তন সম্পন্ন' : 'DEDUCTED') : (language === 'hi' ? 'लंबित' : language === 'bn' ? 'বকেয়া' : 'PENDING')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 6. WORKER QUICK ACCESS NAVIGATION */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
          {language === 'hi' ? 'त्वरित कार्य' : language === 'bn' ? 'দ্রুত অ্যাকশন' : 'QUICK ACCESS ACTIONS'}
        </Text>
        <View style={styles.actionList}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Attendance' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
              <MaterialIcons name="calendar-month" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>
                {language === 'hi' ? 'मासिक उपस्थिति पत्रक' : language === 'bn' ? 'মাসিক উপস্থিতি খতিয়ান' : 'Monthly Attendance Sheet'}
              </Text>
              <Text style={styles.actionSub}>
                {language === 'hi' ? 'दैनिक उपस्थिति, दिन/रात की शिफ्ट और ओवरटाइम विवरण देखें' : language === 'bn' ? 'দৈনিক উপস্থিতি, দিন/রাতের শিফট ও ওভারটাইম বিবরণ দেখুন' : 'View daily check-ins, Day/Night shifts, and overtime breakdown'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="receipt-long" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>
                {language === 'hi' ? 'आधिकारिक वेतन पर्ची एवं पीडीएफ डाउनलोड' : language === 'bn' ? 'অফিসিয়াল মজুরি স্লিপ ও পিডিএফ ডাউনলোড' : 'Official Wage Slip & PDF Download'}
              </Text>
              <Text style={styles.actionSub}>
                {language === 'hi' ? 'सत्यापित वेतन पर्ची, मदवार कटौतियां देखें और पीडीएफ साझा करें' : language === 'bn' ? 'যাচাইকৃত বেতন স্লিপ, বিস্তারিত কর্তন দেখুন ও পিডিএফ শেয়ার করুন' : 'View verified salary slip, itemized deductions & share PDF'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      )}

      {/* Mandatory Employment Contract Modal if not accepted */}
      {needsAgreementAcceptance && token && (
        <WorkerAgreementModal accessToken={token} onAccepted={handleAgreementAccepted} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerRightRow: {
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
  workerIdentityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  workerAvatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  workerIdentityMeta: {
    flex: 1,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workerNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    flexShrink: 1,
    marginRight: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    gap: 3,
  },
  verifiedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.success,
  },
  workerSubDetails: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  wagePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  wageRatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  wageRatePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  otRatePill: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  otRatePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  upiPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#334155',
  },
  upiPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
  },
  todayBannerWrapper: {
    marginBottom: 12,
  },
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1.5,
    gap: 12,
    ...shadows.sm,
  },
  todayBannerPresent: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  todayBannerHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  todayBannerAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  todayBannerPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...shadows.sm,
  },
  todayBannerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBannerContent: {
    flex: 1,
  },
  todayBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayBannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#0F172A',
    flexShrink: 1,
    marginRight: 6,
  },
  todayShiftBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  todayShiftBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  todayBannerSubtitle: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
    fontWeight: '600',
  },
  todayPendingTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  todayPendingSub: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  earningsHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: 12,
    ...shadows.card,
  },
  earningsHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  earningsHeroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
    marginVertical: 2,
  },
  earningsHeroBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  earningsHeroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accentDark,
  },
  earningsHeroSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroMessDeductionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  heroMessDeductionText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#C2410C',
    flex: 1,
  },
  heroBreakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroBreakdownDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  heroBreakdownLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  heroBreakdownVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  bentoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  bentoCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.sm,
  },
  bentoCardLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  bentoCardValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginVertical: 2,
  },
  bentoCardSub: {
    fontSize: 8.5,
    color: colors.textLight,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionSubtitleBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  emptyAdvanceBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    gap: 4,
  },
  emptyAdvanceText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  advanceMiniList: {
    gap: 8,
  },
  advanceMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.sm,
  },
  advanceMiniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  advanceMiniIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceMiniReason: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  advanceMiniDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  advanceMiniRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  advanceMiniAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.error,
  },
  advanceStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  advanceStatusText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  actionList: {
    gap: 10,
    marginTop: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.text,
  },
  actionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
});
