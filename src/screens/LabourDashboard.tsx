import React, { useState, useEffect, useContext } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../components/ui/text";
import { AppContext } from "../context/AppContext";
import { MaterialIcons } from "@expo/vector-icons";
import { projectId } from "../utils/supabase/info";
import { useNavigation, useRoute, NavigationProp } from "@react-navigation/native";
import type { LabourTabParamList } from "../navigation/LabourNavigator";
import { WorkerAgreementModal } from "../features/agreements/WorkerAgreementModal";

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
  const [checkingAgreement, setCheckingAgreement] = useState(true);

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
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      
      if (data.currentAgreement && data.needsAcceptance) {
        setNeedsAgreementAcceptance(true);
      }
    } catch (error) {
      console.error('Error checking agreement status:', error);
    } finally {
      setCheckingAgreement(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/worker/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch stats");

      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching worker stats:", error);
    }
  };

  const handleAgreementAccepted = () => {
    setNeedsAgreementAcceptance(false);
    fetchStats(); // Refresh stats after agreement acceptance
  };

  if (!context) return null;

  const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    bgColor,
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: string;
    bgColor: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={styles.statCardContent}>
        <View style={styles.statCardText}>
          <Text style={styles.statCardTitle}>{title}</Text>
          <Text style={styles.statCardValue}>{value}</Text>
          <Text style={styles.statCardSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.statCardIcon}>
          <MaterialIcons name={icon as any} size={24} color="white" />
        </View>
      </View>
    </View>
  );

  const QuickActionCard = ({
    title,
    subtitle,
    icon,
    iconBg,
    iconColor,
    onPress,
  }: {
    title: string;
    subtitle: string;
    icon: string;
    iconBg: string;
    iconColor: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.quickActionCard}>
      <View style={styles.quickActionContent}>
        <View style={styles.quickActionLeft}>
          <View style={[styles.quickActionIcon, { backgroundColor: iconBg }]}>
            <MaterialIcons name={icon as any} size={24} color={iconColor} />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>{title}</Text>
            <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.logoContainer}>
              <MaterialIcons name="business" size={28} color="#16a34a" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>ConstLabour</Text>
              <Text style={styles.headerSubtitle}>{context.user?.email || context.user?.name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={context.logout} style={styles.logoutButton}>
            <MaterialIcons name="logout" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerBottom}>
          <Text style={styles.dashboardLabel}>Worker Dashboard</Text>
          <Text style={styles.welcomeText}>Welcome back!</Text>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              title="Days Worked"
              value={stats?.totalDaysWorked || 0}
              subtitle={`${stats?.presentDays || 0} present`}
              icon="calendar-today"
              bgColor="#16a34a"
            />
            <StatCard
              title="Total Earnings"
              value={`₹${stats?.totalEarnings || 0}`}
              subtitle="all time"
              icon="account-balance-wallet"
              bgColor="#3b82f6"
            />
            <StatCard
              title="This Month"
              value={`₹${stats?.thisMonthEarnings || 0}`}
              subtitle="current month"
              icon="attach-money"
              bgColor="#a855f7"
            />
            <StatCard
              title="Advances"
              value={`₹${stats?.pendingAdvances || 0}`}
              subtitle="pending"
              icon="payments"
              bgColor="#f97316"
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <View style={styles.quickActionsList}>
              <QuickActionCard
                title="My Attendance"
                subtitle="View attendance history"
                icon="calendar-today"
                iconBg="#f0fdf4"
                iconColor="#16a34a"
                onPress={() => navigation.navigate("Attendance" as never)}
              />
              <QuickActionCard
                title="My Profile"
                subtitle="View personal information"
                icon="person"
                iconBg="#eff6ff"
                iconColor="#2563eb"
                onPress={() => navigation.navigate("Profile" as never)}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {needsAgreementAcceptance && token && (
        <WorkerAgreementModal
          accessToken={token}
          onAccepted={handleAgreementAccepted}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#16a34a",
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerText: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bbf7d0',
  },
  logoutButton: {
    padding: 8,
  },
  headerBottom: {
    gap: 4,
  },
  dashboardLabel: {
    fontSize: 14,
    color: '#bbf7d0',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 16,
    marginHorizontal: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statCardText: {
    flex: 1,
    gap: 4,
  },
  statCardTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  statCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionsSection: {
    marginTop: 8,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  quickActionsList: {
    gap: 12,
  },
  quickActionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    flex: 1,
    gap: 4,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
});
