import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '@/styles/theme';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'half-day';
  checkIn?: string;
  checkOut?: string;
  siteName?: string;
  siteId?: string;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  breakHours?: number;
  dailyPayment?: number;
  overtimePayment?: number;
  totalPayment?: number;
  messCharge?: number;
}

interface WorkerAttendanceTabProps {
  accessToken?: string;
}

export function WorkerAttendanceTab({ accessToken }: WorkerAttendanceTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAttendance();
    }
  }, [token, selectedMonth]);

  const fetchAttendance = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/worker/attendance?year=${year}&month=${month}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch attendance records',
      });
    } finally {
      setLoading(false);
    }
  };

  const onMonthChange = (event: any, date?: Date) => {
    setShowMonthPicker(Platform.OS === 'ios');
    if (date) {
      setSelectedMonth(date);
    }
  };

  const changeMonth = (offset: number) => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + offset);
    setSelectedMonth(next);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric',
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getMonthStats = () => {
    const present = attendance.filter(a => a.status === 'present').length;
    const halfDay = attendance.filter(a => a.status === 'half-day').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const totalEarnings = attendance.reduce((sum, a: any) => sum + (a.totalPayment || a.total_payment || 0), 0);
    const totalHours = attendance.reduce((sum, a: any) => sum + (a.totalHours || a.total_hours || 0), 0);
    return { present, halfDay, absent, total: present + halfDay + absent, totalEarnings, totalHours };
  };

  const stats = getMonthStats();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Attendance Ledger</Text>
          <Text style={styles.headerSubtitle}>Verified shift check-ins & duty record</Text>
        </View>
        <View style={styles.workerBadge}>
          <MaterialIcons name="verified-user" size={14} color="#ffffff" />
          <Text style={styles.workerBadgeText}>CRAFTSMAN</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Month Selector Bar */}
        <View style={styles.monthSelectorBar}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={24} color={theme.colors.slate[700]} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowMonthPicker(true)} 
            style={styles.monthDisplay}
            activeOpacity={0.7}
          >
            <MaterialIcons name="calendar-today" size={16} color={theme.colors.safetyOrange} />
            <Text style={styles.monthDisplayText}>
              {selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} activeOpacity={0.7}>
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.slate[700]} />
          </TouchableOpacity>
        </View>

        {showMonthPicker && (
          <DateTimePicker
            value={selectedMonth}
            mode="date"
            display="default"
            onChange={onMonthChange}
          />
        )}

        {/* Tactical 4-Card Bento Counters */}
        <View style={styles.bentoGrid}>
          <View style={[styles.bentoCard, { borderColor: theme.colors.emerald[200] }]}>
            <Text style={[styles.bentoNumber, { color: theme.colors.emerald[600] }]}>{stats.present}</Text>
            <Text style={styles.bentoLabel}>Present</Text>
          </View>
          <View style={[styles.bentoCard, { borderColor: theme.colors.amber[200] }]}>
            <Text style={[styles.bentoNumber, { color: theme.colors.amber[600] }]}>{stats.halfDay}</Text>
            <Text style={styles.bentoLabel}>Half Day</Text>
          </View>
          <View style={[styles.bentoCard, { borderColor: theme.colors.red[200] }]}>
            <Text style={[styles.bentoNumber, { color: theme.colors.red[600] }]}>{stats.absent}</Text>
            <Text style={styles.bentoLabel}>Absent</Text>
          </View>
          <View style={[styles.bentoCard, { borderColor: theme.colors.border }]}>
            <Text style={[styles.bentoNumber, { color: theme.colors.slate[900] }]}>{stats.total}</Text>
            <Text style={styles.bentoLabel}>Total Days</Text>
          </View>
        </View>

        {/* Earnings & Hours Strip */}
        <View style={styles.earningsHero}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsHeroLabel}>ACCRUED THIS MONTH</Text>
            <Text style={styles.earningsHeroValue}>₹{stats.totalEarnings.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsHeroLabel}>TOTAL HOURS LOGGED</Text>
            <Text style={styles.earningsHoursValue}>{stats.totalHours.toFixed(1)} hrs</Text>
          </View>
        </View>

        {/* Daily Record List */}
        <FlatList
          data={attendance}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isPresent = item.status === 'present';
            const isHalfDay = item.status === 'half-day';

            const statusBg = isPresent ? '#ECFDF5' : isHalfDay ? '#FFFBEB' : '#FEF2F2';
            const statusBorder = isPresent ? '#A7F3D0' : isHalfDay ? '#FDE68A' : '#FECACA';
            const statusColor = isPresent ? '#059669' : isHalfDay ? '#D97706' : '#DC2626';

            return (
              <View style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateHeading}>{formatDate(item.date)}</Text>
                    {item.siteName ? (
                      <View style={styles.siteRow}>
                        <MaterialIcons name="place" size={12} color={theme.colors.slate[500]} />
                        <Text style={styles.siteNameText} numberOfLines={1}>{item.siteName}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {(isPresent || isHalfDay) && (
                  <View style={styles.recordMetrics}>
                    <View style={styles.metricItem}>
                      <MaterialIcons name="login" size={13} color={theme.colors.slate[500]} />
                      <Text style={styles.metricLabel}>In: </Text>
                      <Text style={styles.metricValue}>{item.checkIn || '08:00 AM'}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <MaterialIcons name="logout" size={13} color={theme.colors.slate[500]} />
                      <Text style={styles.metricLabel}>Out: </Text>
                      <Text style={styles.metricValue}>{item.checkOut || '05:00 PM'}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <MaterialIcons name="payments" size={13} color={theme.colors.emerald[600]} />
                      <Text style={styles.metricLabel}>Day: </Text>
                      <Text style={[styles.metricValue, { color: theme.colors.emerald[600], fontWeight: '700' }]}>
                        ₹{item.totalPayment || item.dailyPayment || 0}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="event-busy" size={44} color={theme.colors.slate[400]} />
              <Text style={styles.emptyText}>No Records for This Month</Text>
              <Text style={styles.emptySubtext}>
                No verified attendance records found for {selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.slate[900],
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.slate[500],
    marginTop: 2,
  },
  workerBadge: {
    backgroundColor: theme.colors.slate[900],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  monthArrow: {
    padding: 6,
  },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthDisplayText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.slate[900],
  },
  bentoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  bentoNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.slate[500],
    marginTop: 2,
    textTransform: 'uppercase',
  },
  earningsHero: {
    flexDirection: 'row',
    backgroundColor: theme.colors.slate[900],
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 14,
    ...theme.shadows.md,
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsHeroLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.slate[400],
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  earningsHeroValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.emerald[400],
  },
  earningsHoursValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  earningsDivider: {
    width: 1,
    backgroundColor: theme.colors.slate[700],
  },
  listContent: {
    paddingBottom: 24,
  },
  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCol: {
    flex: 1,
  },
  dateHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.slate[900],
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  siteNameText: {
    fontSize: 11,
    color: theme.colors.slate[500],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recordMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.slate[100],
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricLabel: {
    fontSize: 11,
    color: theme.colors.slate[500],
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.slate[800],
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.slate[900],
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.slate[500],
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
});
