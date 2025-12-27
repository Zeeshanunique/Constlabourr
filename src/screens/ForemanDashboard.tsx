import React, { useState, useEffect, useContext, useCallback } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../components/ui/text";
import { AppContext } from "../context/AppContext";
import { MaterialIcons } from "@expo/vector-icons";
import { projectId } from "../utils/supabase/info";
import { useNavigation, useRoute, NavigationProp, useFocusEffect } from "@react-navigation/native";
import type { ForemanTabParamList } from "../navigation/ForemanNavigator";

interface ForemanDashboardProps {
  accessToken?: string;
}

interface ForemanStats {
  assignedWorkers: number;
  assignedSites: number;
  presentToday: number;
  absentToday: number;
}

export function ModernForemanDashboard({ accessToken }: ForemanDashboardProps) {
  const context = useContext(AppContext);
  const navigation = useNavigation<NavigationProp<ForemanTabParamList>>();
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [stats, setStats] = useState<ForemanStats | null>(null);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  // Refresh stats when dashboard comes into focus
  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchStats();
      }
    }, [token])
  );

  const fetchStats = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foreman/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await response.json();
      setStats(data.stats || null);
    } catch (error) {
      console.error("Error fetching foreman stats:", error);
    }
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
    value: number;
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
              <MaterialIcons name="business" size={28} color="#7c3aed" />
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
          <Text style={styles.dashboardLabel}>Foreman Dashboard</Text>
          <Text style={styles.welcomeText}>Welcome back!</Text>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              title="Assigned Workers"
              value={stats?.assignedWorkers || 0}
              subtitle="under supervision"
              icon="people"
              bgColor="#7c3aed"
            />
            <StatCard
              title="Assigned Sites"
              value={stats?.assignedSites || 0}
              subtitle="active locations"
              icon="place"
              bgColor="#a855f7"
            />
            <StatCard
              title="Present Today"
              value={stats?.presentToday || 0}
              subtitle="attendance marked"
              icon="check-box"
              bgColor="#22c55e"
            />
            <StatCard
              title="Absent Today"
              value={stats?.absentToday || 0}
              subtitle="workers absent"
              icon="schedule"
              bgColor="#f97316"
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <View style={styles.quickActionsList}>
              <QuickActionCard
                title="Mark Attendance"
                subtitle="Record worker attendance"
                icon="check-box"
                iconBg="#faf5ff"
                iconColor="#7c3aed"
                onPress={() => navigation.navigate("Attendance" as never)}
              />
              <QuickActionCard
                title="View Workers"
                subtitle="See all assigned workers"
                icon="people"
                iconBg="#f0fdf4"
                iconColor="#16a34a"
                onPress={() => navigation.navigate("Workers" as never)}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#7c3aed",
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
    color: '#e9d5ff',
  },
  logoutButton: {
    padding: 8,
  },
  headerBottom: {
    gap: 4,
  },
  dashboardLabel: {
    fontSize: 14,
    color: '#e9d5ff',
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
