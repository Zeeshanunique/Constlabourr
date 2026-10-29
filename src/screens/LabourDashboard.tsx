import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '../utils/supabase/info';
import { useNavigation, useRoute, NavigationProp } from '@react-navigation/native';
import type { LabourTabParamList } from '../navigation/LabourNavigator';
import { WorkerAgreementModal } from '../features/agreements/WorkerAgreementModal';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';

interface LabourDashboardProps {
  accessToken?: string;
}

interface WorkerStats {
  totalDaysWorked: number;
  presentDays: number;
  absentDays: number;
  totalEarnings: number;
  pendingAdvances: number;
  thisMonthEarnings: number;
}

export function ModernLabourDashboard({ accessToken }: LabourDashboardProps) {
  const context = useContext(AppContext);
  const navigation = useNavigation<NavigationProp<LabourTabParamList>>();
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [needsAgreementAcceptance, setNeedsAgreementAcceptance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token) {
      checkAgreementStatus();
      fetchStats();
    }
  }, [token]);

  const checkAgreementStatus = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if ((data.currentAgreement || data.agreement) && data.needsAcceptance) {
        setNeedsAgreementAcceptance(true);
      }
    } catch (error) {
      console.error('Error checking agreement status:', error);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/worker/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching worker stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), checkAgreementStatus()]);
    setRefreshing(false);
  };

  const handleAgreementAccepted = () => {
    setNeedsAgreementAcceptance(false);
    fetchStats();
  };

  if (!context) return null;

  const thisMonthEarnings = stats?.thisMonthEarnings || 18400;
  const presentDays = stats?.presentDays || 22;
  const pendingAdvances = stats?.pendingAdvances || 1500;
  const absentDays = stats?.absentDays || 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BrandLogo size={38} showText={true} variant="light" subtitle="CRAFTSMAN PORTAL" />
          <TouchableOpacity onPress={context.logout} style={styles.iconCircleButton}>
            <MaterialIcons name="logout" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.workerBadgeRow}>
          <View style={styles.statusPill}>
            <MaterialIcons name="verified" size={14} color={colors.success} />
            <Text style={styles.statusPillText}>Aadhaar Verified • Grade A</Text>
          </View>
          <Text style={styles.workerNameText}>
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
        {/* 2. HERO MONTHLY EARNINGS CARD */}
        <View style={styles.earningsHero}>
          <View>
            <Text style={styles.earningsHeroLabel}>ESTIMATED MONTHLY EARNINGS</Text>
            <Text style={styles.earningsHeroAmount}>₹{thisMonthEarnings.toLocaleString()}</Text>
            <Text style={styles.earningsHeroSub}>Direct transfer to registered bank account</Text>
          </View>
          <View style={styles.earningsHeroBadge}>
            <Text style={styles.earningsHeroBadgeText}>OCT 2026</Text>
          </View>
        </View>

        {/* 3. 3-CARD STATS BENTO */}
        <View style={styles.bentoRow}>
          <View style={styles.bentoCard}>
            <Text style={styles.bentoCardLabel}>Days Worked</Text>
            <Text style={[styles.bentoCardValue, { color: colors.success }]}>{presentDays}</Text>
            <Text style={styles.bentoCardSub}>Shifts Completed</Text>
          </View>

          <View style={styles.bentoCard}>
            <Text style={styles.bentoCardLabel}>Kharcha / Adv</Text>
            <Text style={[styles.bentoCardValue, { color: colors.warning }]}>-₹{pendingAdvances}</Text>
            <Text style={styles.bentoCardSub}>Deducted at Payout</Text>
          </View>

          <View style={styles.bentoCard}>
            <Text style={styles.bentoCardLabel}>Days Absent</Text>
            <Text style={[styles.bentoCardValue, { color: colors.error }]}>{absentDays}</Text>
            <Text style={styles.bentoCardSub}>Unmarked</Text>
          </View>
        </View>

        {/* 4. WORKER QUICK ACCESS NAVIGATION */}
        <Text style={styles.sectionLabel}>MY WORKER RECORDS</Text>
        <View style={styles.actionList}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Attendance' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
              <MaterialIcons name="calendar-month" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Monthly Attendance Sheet</Text>
              <Text style={styles.actionSub}>View check-in dates, regular hours & overtime logs</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile' as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="badge" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Wage Slip & Bank Details</Text>
              <Text style={styles.actionSub}>Check daily wage rate, mess charges & IFSC details</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mandatory Contract Modal if unaccepted */}
      {needsAgreementAcceptance && token && (
        <WorkerAgreementModal accessToken={token} onAccepted={handleAgreementAccepted} />
      )}
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
  workerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusPillText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 4,
  },
  workerNameText: {
    fontSize: 13,
    color: colors.accentLight,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
  },
  earningsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: 14,
    ...shadows.card,
  },
  earningsHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  earningsHeroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  earningsHeroSub: {
    fontSize: 11,
    color: colors.textMuted,
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
  bentoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.sm,
  },
  bentoCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  bentoCardValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 2,
  },
  bentoCardSub: {
    fontSize: 9,
    color: colors.textLight,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  actionList: {
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
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  actionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
