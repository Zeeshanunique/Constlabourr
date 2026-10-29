import React, { useState, useEffect, useContext, useCallback } from 'react';
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
import { useNavigation, useRoute, NavigationProp, useFocusEffect } from '@react-navigation/native';
import type { ForemanTabParamList } from '../navigation/ForemanNavigator';
import { colors, shadows, radii } from '../styles/theme';
import { BrandLogo } from '../components/shared/BrandLogo';

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
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

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

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching foreman stats:', error);
    }
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
          <BrandLogo size={38} showText={true} variant="light" subtitle="SITE SUPERVISOR / FOREMAN" />
          <TouchableOpacity onPress={context.logout} style={styles.iconCircleButton}>
            <MaterialIcons name="logout" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.foremanBadgeRow}>
          <View style={styles.activeSitePill}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.activeSitePillText}>Assigned Site • Pier 102 Metro Line</Text>
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
        {/* 3. 4-CARD BENTO GRID */}
        <Text style={styles.sectionLabel}>DAILY SITE SHIFT OVERVIEW</Text>
        <View style={styles.bentoGrid}>
          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>Present Today</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.successLight }]}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: colors.success }]}>{presentCount}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.successDark }]}>{turnoutPercentage}% Turnout</Text>
            </View>
          </View>

          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>Absent / Off</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.errorLight }]}>
                <MaterialIcons name="cancel" size={16} color={colors.error} />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: colors.error }]}>{absentCount}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.errorDark }]}>Not Checked-In</Text>
            </View>
          </View>

          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>Assigned Crew</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.surfaceMuted }]}>
                <MaterialIcons name="groups" size={16} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{assignedWorkers}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.bentoTagText, { color: colors.textMuted }]}>Site Roster</Text>
            </View>
          </View>

          <View style={styles.bentoCard}>
            <View style={styles.bentoHeaderRow}>
              <Text style={styles.bentoCardTitle}>Active Sites</Text>
              <View style={[styles.microIconCircle, { backgroundColor: colors.accentLight }]}>
                <MaterialIcons name="location-city" size={16} color={colors.accent} />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{assignedSites}</Text>
            <View style={[styles.bentoTag, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.bentoTagText, { color: colors.accentDark }]}>Assigned</Text>
            </View>
          </View>
        </View>

        {/* 4. TACTICAL FOREMAN ACTIONS */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>SUPERVISOR ACTIONS</Text>
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
              <Text style={styles.actionTitle}>Mark Daily Attendance</Text>
              <Text style={styles.actionSub}>Log Check-in, Check-out, Half-day, and Overtime</Text>
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
              <Text style={styles.actionTitle}>Assigned Site Workers</Text>
              <Text style={styles.actionSub}>View skill classification, contacts & emergency info</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>
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
  },
  foremanNameText: {
    fontSize: 12,
    color: colors.accentLight,
    fontWeight: '700',
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
    width: '48.5%',
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
