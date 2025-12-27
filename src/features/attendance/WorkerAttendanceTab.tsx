import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getMonthStats = () => {
    const present = attendance.filter(a => a.status === 'present').length;
    const halfDay = attendance.filter(a => a.status === 'half-day').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const totalEarnings = attendance.reduce((sum, a) => sum + (a.totalPayment || 0), 0);
    const totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    return { present, halfDay, absent, total: present + halfDay + absent, totalEarnings, totalHours };
  };

  const stats = getMonthStats();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Attendance</Text>
        <Text style={styles.headerSubtitle}>View your attendance history</Text>
      </View>

      <View style={styles.content}>
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <Button 
            variant="outline" 
            onPress={() => setShowMonthPicker(true)}
            style={styles.monthButton}
          >
            <MaterialIcons name="calendar-today" size={20} color="#16a34a" />
            <ButtonText style={styles.monthButtonText}>
              {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </ButtonText>
          </Button>
        </View>

        {showMonthPicker && (
          <DateTimePicker
            value={selectedMonth}
            mode="date"
            display="default"
            onChange={onMonthChange}
          />
        )}

        {/* Month Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: '#dcfce7' }]}>
              <MaterialIcons name="check-circle" size={24} color="#16a34a" />
              <Text style={styles.statValue}>{stats.present}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            {stats.halfDay > 0 && (
              <View style={[styles.statBox, { backgroundColor: '#fef3c7' }]}>
                <MaterialIcons name="access-time" size={24} color="#f59e0b" />
                <Text style={styles.statValue}>{stats.halfDay}</Text>
                <Text style={styles.statLabel}>Half Day</Text>
              </View>
            )}
            <View style={[styles.statBox, { backgroundColor: '#fee2e2' }]}>
              <MaterialIcons name="cancel" size={24} color="#dc2626" />
              <Text style={styles.statValue}>{stats.absent}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#e0e7ff' }]}>
              <MaterialIcons name="calendar-month" size={24} color="#4f46e5" />
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
          
          {/* Earnings Summary */}
          <View style={styles.earningsSummary}>
            <View style={styles.summaryItem}>
              <MaterialIcons name="attach-money" size={20} color="#16a34a" />
              <Text style={styles.summaryLabel}>Total Earnings</Text>
              <Text style={styles.summaryValue}>₹{stats.totalEarnings.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <MaterialIcons name="schedule" size={20} color="#3b82f6" />
              <Text style={styles.summaryLabel}>Total Hours</Text>
              <Text style={styles.summaryValue}>{stats.totalHours.toFixed(1)} hrs</Text>
            </View>
          </View>
        </View>

        {/* Attendance List */}
        <FlatList
          data={attendance}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.attendanceCard}>
              <View style={styles.cardHeader}>
                <View style={styles.dateSection}>
                  <MaterialIcons 
                    name={
                      item.status === 'present' ? 'check-circle' : 
                      item.status === 'half-day' ? 'access-time' : 
                      'cancel'
                    } 
                    size={24} 
                    color={
                      item.status === 'present' ? '#16a34a' : 
                      item.status === 'half-day' ? '#f59e0b' : 
                      '#dc2626'
                    } 
                  />
                  <View style={styles.dateInfo}>
                    <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                    {item.siteName && (
                      <View style={styles.siteInfo}>
                        <MaterialIcons name="place" size={14} color="#6b7280" />
                        <Text style={styles.siteText}>{item.siteName}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[
                  styles.statusBadge, 
                  { backgroundColor: 
                    item.status === 'present' ? '#dcfce7' : 
                    item.status === 'half-day' ? '#fef3c7' : 
                    '#fee2e2' 
                  }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: 
                      item.status === 'present' ? '#16a34a' : 
                      item.status === 'half-day' ? '#f59e0b' : 
                      '#dc2626' 
                    }
                  ]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              
              {(item.status === 'present' || item.status === 'half-day') && (
                <>
                  {/* Time Information */}
                  {(item.checkIn || item.checkOut) && (
                    <View style={styles.timeRow}>
                      {item.checkIn && (
                        <View style={styles.timeInfo}>
                          <MaterialIcons name="login" size={16} color="#6b7280" />
                          <Text style={styles.timeText}>In: {item.checkIn}</Text>
                        </View>
                      )}
                      {item.checkOut && (
                        <View style={styles.timeInfo}>
                          <MaterialIcons name="logout" size={16} color="#6b7280" />
                          <Text style={styles.timeText}>Out: {item.checkOut}</Text>
                        </View>
                      )}
                      {item.totalHours !== undefined && item.totalHours > 0 && (
                        <View style={styles.timeInfo}>
                          <MaterialIcons name="schedule" size={16} color="#6b7280" />
                          <Text style={styles.timeText}>{item.totalHours.toFixed(1)} hrs</Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* Payment Information */}
                  {item.totalPayment !== undefined && item.totalPayment > 0 && (
                    <View style={styles.paymentRow}>
                      <View style={styles.paymentItem}>
                        <Text style={styles.paymentLabel}>Daily Payment</Text>
                        <Text style={styles.paymentValue}>₹{item.dailyPayment?.toFixed(0) || 0}</Text>
                      </View>
                      {item.overtimePayment !== undefined && item.overtimePayment > 0 && (
                        <View style={styles.paymentItem}>
                          <Text style={styles.paymentLabel}>Overtime</Text>
                          <Text style={[styles.paymentValue, { color: '#16a34a' }]}>
                            +₹{item.overtimePayment.toFixed(0)}
                          </Text>
                        </View>
                      )}
                      {item.messCharge !== undefined && item.messCharge > 0 && (
                        <View style={styles.paymentItem}>
                          <Text style={styles.paymentLabel}>Mess</Text>
                          <Text style={[styles.paymentValue, { color: '#dc2626' }]}>
                            -₹{item.messCharge.toFixed(0)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.paymentItem, styles.totalPayment]}>
                        <Text style={[styles.paymentLabel, { fontWeight: '700' }]}>Total</Text>
                        <Text style={[styles.paymentValue, { fontSize: 16, fontWeight: '700', color: '#16a34a' }]}>
                          ₹{item.totalPayment.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="event-busy" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No attendance records</Text>
              <Text style={styles.emptySubtext}>
                {loading ? 'Loading...' : 'No records found for this month'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchAttendance}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  monthSelector: {
    marginVertical: 16,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#16a34a',
    backgroundColor: '#ffffff',
  },
  monthButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
  },
  statsContainer: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  earningsSummary: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 16,
  },
  attendanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  siteText: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 16,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  paymentRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  paymentItem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  totalPayment: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  paymentLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  paymentValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
});


