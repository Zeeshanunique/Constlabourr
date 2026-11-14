import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, shadows, radii } from '@/styles/theme';
import { AppContext } from '@/context/AppContext';
import { useTranslation } from '@/i18n';

interface AttendanceRecord {
  id: string;
  workerId?: string;
  date: string;
  status: 'present' | 'absent' | 'half-day';
  shift?: 'day' | 'night';
  checkIn?: string;
  checkOut?: string;
  siteName?: string;
  siteId?: string;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  breakHours?: number;
  dailyWage?: number;
  dailyPayment?: number;
  overtimePayment?: number;
  totalPayment?: number;
  messCharge?: number;
  notes?: string;
}

interface WorkerAttendanceTabProps {
  accessToken?: string;
}

export function WorkerAttendanceTab({ accessToken }: WorkerAttendanceTabProps) {
  const context = useContext(AppContext);
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const { language, setLanguage, t } = useTranslation();

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sitesMap, setSitesMap] = useState<Map<string, string>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter Tab ('all' | 'present' | 'half-day' | 'overtime' | 'absent')
  const [activeFilter, setActiveFilter] = useState<'all' | 'present' | 'half-day' | 'overtime' | 'absent'>('all');

  useEffect(() => {
    if (token) {
      fetchAttendance();
    }
  }, [token, selectedMonth]);

  const fetchAttendance = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const y = selectedMonth.getFullYear();
      const m = selectedMonth.getMonth() + 1;
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const daysInMonth = new Date(y, m, 0).getDate();
      const endDate = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // 1. Resolve Worker ID
      let workerId = context?.user?.id;
      try {
        const profRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
          { headers }
        );
        if (profRes.ok) {
          const profData = await profRes.json();
          const p = profData.profile || profData.user;
          if (p?.id) workerId = p.id;
        }
      } catch (e) {
        console.warn('Could not fetch profile in WorkerAttendanceTab:', e);
      }

      // 2. Query attendance using standard, verified /attendance endpoint
      const attUrl = workerId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?workerId=${workerId}&startDate=${startDate}&endDate=${endDate}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?startDate=${startDate}&endDate=${endDate}`;

      const [attRes, sitesRes] = await Promise.allSettled([
        fetch(attUrl, { headers }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`, { headers }),
      ]);

      const newSitesMap = new Map<string, string>();
      if (sitesRes.status === 'fulfilled' && sitesRes.value.ok) {
        const sitesData = await sitesRes.value.json();
        (sitesData.sites || []).forEach((s: any) => {
          if (s.id && s.name) newSitesMap.set(s.id, s.name);
        });
        setSitesMap(newSitesMap);
      }

      if (attRes.status === 'fulfilled' && attRes.value.ok) {
        const attData = await attRes.value.json();
        const rawList = attData.attendance || [];
        const records: AttendanceRecord[] = rawList.map((r: any) => {
          const rawStatus = (r.status || '').toLowerCase().trim();
          let safeStatus: 'present' | 'absent' | 'half-day' = 'absent';
          if (rawStatus === 'present' || rawStatus === 'overtime') safeStatus = 'present';
          else if (rawStatus === 'half-day' || rawStatus === 'half_day' || rawStatus === 'half') safeStatus = 'half-day';

          const rawShift = (r.shift || '').toLowerCase().trim();
          const safeShift: 'day' | 'night' = rawShift.includes('night') ? 'night' : 'day';

          const sId = r.siteId || r.site_id;
          const siteName = newSitesMap.get(sId) || r.siteName || r.site_name || 'Assigned Site';

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
            dailyWage: Number(r.dailyWage ?? r.daily_wage ?? 0),
            dailyPayment: Number(r.dailyPayment ?? r.daily_payment ?? 0),
            overtimePayment: Number(r.overtimePayment ?? r.overtime_payment ?? 0),
            totalPayment: Number(r.totalPayment ?? r.total_payment ?? 0),
            siteId: sId,
            siteName,
            notes: r.notes,
          };
        });

        // Filter to worker if workerId was available and server returned list
        const filteredToWorker = workerId
          ? records.filter((r) => (r.workerId ? r.workerId === workerId : true))
          : records;

        filteredToWorker.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setAttendance(filteredToWorker);
      } else {
        // Fallback: If query with workerId failed, set empty array gracefully
        setAttendance([]);
      }
    } catch (error) {
      console.error('Error fetching attendance in WorkerAttendanceTab:', error);
      setAttendance([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendance();
  };

  const onMonthChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowMonthPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      setSelectedMonth(date);
    }
  };

  const changeMonth = (offset: number) => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + offset);
    setSelectedMonth(next);
  };

  const setMonthToCurrent = () => {
    setSelectedMonth(new Date());
  };

  const setMonthToPrevious = () => {
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    setSelectedMonth(prev);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const todayStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }, []);

  // Monthly Metrics Computation
  const stats = useMemo(() => {
    const present = attendance.filter((a) => a.status === 'present').length;
    const halfDay = attendance.filter((a) => a.status === 'half-day').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const withOtCount = attendance.filter((a) => Number(a.overtimeHours || 0) > 0).length;

    const shiftCredits = present + halfDay * 0.5;
    const totalEarnings = attendance.reduce((sum, a) => sum + Number(a.totalPayment || a.dailyPayment || 0), 0);
    const totalOtPay = attendance.reduce((sum, a) => sum + Number(a.overtimePayment || 0), 0);
    const baseWages = Math.max(0, totalEarnings - totalOtPay);
    const totalHours = attendance.reduce((sum, a) => sum + Number(a.totalHours || 0), 0);
    const totalOtHours = attendance.reduce((sum, a) => sum + Number(a.overtimeHours || 0), 0);

    return {
      present,
      halfDay,
      absent,
      withOtCount,
      shiftCredits,
      total: attendance.length,
      totalEarnings,
      baseWages,
      totalOtPay,
      totalHours,
      totalOtHours,
    };
  }, [attendance]);

  // Filtered Attendance Records
  const filteredAttendance = useMemo(() => {
    if (activeFilter === 'present') return attendance.filter((a) => a.status === 'present');
    if (activeFilter === 'half-day') return attendance.filter((a) => a.status === 'half-day');
    if (activeFilter === 'absent') return attendance.filter((a) => a.status === 'absent');
    if (activeFilter === 'overtime') return attendance.filter((a) => Number(a.overtimeHours || 0) > 0);
    return attendance;
  }, [attendance, activeFilter]);

  const isCurrentMonthActive =
    selectedMonth.getMonth() === new Date().getMonth() &&
    selectedMonth.getFullYear() === new Date().getFullYear();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('attendance.workerAttendanceLedger')}</Text>
          <Text style={styles.headerSubtitle}>{t('attendance.dutyRecord')}</Text>
        </View>
        <View style={styles.workerBadge}>
          <MaterialIcons name="verified-user" size={14} color="#FFFFFF" />
          <Text style={styles.workerBadgeText}>{t('common.verified')}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* 2. MONTH SELECTOR & QUICK PRESETS */}
        <View style={styles.monthSelectorBar}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowMonthPicker(true)}
            style={styles.monthDisplay}
            activeOpacity={0.7}
          >
            <MaterialIcons name="calendar-today" size={16} color={colors.accent} />
            <Text style={styles.monthDisplayText}>
              {selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} activeOpacity={0.7}>
            <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Quick Month Preset Chips */}
        <View style={styles.presetChipsRow}>
          <TouchableOpacity
            style={[styles.presetChip, isCurrentMonthActive && styles.presetChipActive]}
            onPress={setMonthToCurrent}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetChipText, isCurrentMonthActive && styles.presetChipTextActive]}>
              {t('common.thisMonth')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, !isCurrentMonthActive && styles.presetChipActive]}
            onPress={setMonthToPrevious}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetChipText, !isCurrentMonthActive && styles.presetChipTextActive]}>
              {t('common.previousMonth')}
            </Text>
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

        {/* 3. TACTICAL BENTO COUNTERS */}
        <View style={styles.bentoGrid}>
          <View style={[styles.bentoCard, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.bentoNumber, { color: colors.successDark }]}>{stats.present}</Text>
            <Text style={styles.bentoLabel}>{t('attendance.present')}</Text>
            <Text style={styles.bentoSub}>1.0 {language === 'hi' ? 'क्रेडिट' : language === 'bn' ? 'ক্রেডিট' : 'Credit'}</Text>
          </View>

          <View style={[styles.bentoCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
            <Text style={[styles.bentoNumber, { color: colors.warningDark }]}>{stats.halfDay}</Text>
            <Text style={styles.bentoLabel}>{t('attendance.halfDay')}</Text>
            <Text style={styles.bentoSub}>0.5 {language === 'hi' ? 'क्रेडिट' : language === 'bn' ? 'ক্রেডিট' : 'Credit'}</Text>
          </View>

          <View style={[styles.bentoCard, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.bentoNumber, { color: colors.info }]}>{stats.totalOtHours.toFixed(1)}h</Text>
            <Text style={styles.bentoLabel}>{t('attendance.overtime')}</Text>
            <Text style={styles.bentoSub}>{stats.withOtCount} d</Text>
          </View>

          <View style={[styles.bentoCard, { borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.bentoNumber, { color: colors.primary }]}>{stats.shiftCredits}</Text>
            <Text style={styles.bentoLabel}>{t('attendance.shiftCredits')}</Text>
            <Text style={styles.bentoSub}>{t('common.total')}</Text>
          </View>
        </View>

        {/* 4. EARNINGS & ACCRUAL STRIP */}
        <View style={styles.earningsHero}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsHeroLabel}>{t('workerPortal.grossEarnings').toUpperCase()}</Text>
            <Text style={styles.earningsHeroValue}>₹{stats.totalEarnings.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsHeroLabel}>{t('attendance.overtimePayment').toUpperCase()}</Text>
            <Text style={styles.earningsOtValue}>+₹{stats.totalOtPay.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* 5. FILTER TABS */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}>
              {t('common.all')} ({attendance.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'present' && styles.filterTabActive]}
            onPress={() => setActiveFilter('present')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'present' && styles.filterTabTextActive]}>
              {t('attendance.present')} ({stats.present})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'half-day' && styles.filterTabActive]}
            onPress={() => setActiveFilter('half-day')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'half-day' && styles.filterTabTextActive]}>
              {t('attendance.halfDay')} ({stats.halfDay})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'overtime' && styles.filterTabActive]}
            onPress={() => setActiveFilter('overtime')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'overtime' && styles.filterTabTextActive]}>
              OT ({stats.withOtCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'absent' && styles.filterTabActive]}
            onPress={() => setActiveFilter('absent')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'absent' && styles.filterTabTextActive]}>
              {t('attendance.absent')} ({stats.absent})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 6. DAILY RECORD LIST */}
        <FlatList
          data={filteredAttendance}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          renderItem={({ item }) => {
            const isPresent = item.status === 'present';
            const isHalfDay = item.status === 'half-day';
            const isToday = item.date === todayStr;

            const statusBg = isPresent ? '#ECFDF5' : isHalfDay ? '#FFFBEB' : '#FEF2F2';
            const statusBorder = isPresent ? '#A7F3D0' : isHalfDay ? '#FDE68A' : '#FECACA';
            const statusColor = isPresent ? colors.successDark : isHalfDay ? colors.warningDark : colors.errorDark;

            const siteName = item.siteName || (item.siteId ? sitesMap.get(item.siteId) : '') || 'Assigned Site';
            const isNight = item.shift === 'night';
            const otHours = Number(item.overtimeHours || 0);
            const otPayment = Number(item.overtimePayment || 0);

            return (
              <View style={[styles.recordCard, isToday && styles.recordCardToday]}>
                {/* Header: Date + Shift + Status Badge */}
                <View style={styles.recordHeader}>
                  <View style={styles.dateCol}>
                    <View style={styles.dateRow}>
                      <Text style={styles.dateHeading}>{formatDate(item.date)}</Text>
                      {isToday && (
                        <View style={styles.todayPill}>
                          <Text style={styles.todayPillText}>{t('common.today').toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.siteRow}>
                      <MaterialIcons name="place" size={13} color={colors.textMuted} />
                      <Text style={styles.siteNameText} numberOfLines={1}>
                        {siteName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statusCol}>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {item.status === 'present'
                          ? t('attendance.present').toUpperCase()
                          : item.status === 'half-day'
                          ? t('attendance.halfDay').toUpperCase()
                          : item.status === 'absent'
                          ? t('attendance.absent').toUpperCase()
                          : String(item.status).toUpperCase()}
                      </Text>
                    </View>

                    {/* Shift Badge: Day or Night */}
                    <View style={styles.shiftBadge}>
                      <MaterialIcons
                        name={isNight ? 'nights-stay' : 'wb-sunny'}
                        size={11}
                        color={isNight ? '#818CF8' : colors.accent}
                      />
                      <Text style={styles.shiftBadgeText}>
                        {isNight ? (language === 'hi' ? 'रात' : language === 'bn' ? 'রাত' : 'NIGHT') : (language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'DAY')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Metrics Row if Worked */}
                {(isPresent || isHalfDay) && (
                  <View style={styles.recordMetrics}>
                    <View style={styles.metricItem}>
                      <MaterialIcons name="login" size={14} color={colors.textMuted} />
                      <Text style={styles.metricLabel}>In: </Text>
                      <Text style={styles.metricValue}>{item.checkIn || '08:00 AM'}</Text>
                    </View>

                    <View style={styles.metricItem}>
                      <MaterialIcons name="logout" size={14} color={colors.textMuted} />
                      <Text style={styles.metricLabel}>Out: </Text>
                      <Text style={styles.metricValue}>{item.checkOut || '05:00 PM'}</Text>
                    </View>

                    <View style={styles.metricItem}>
                      <MaterialIcons name="payments" size={14} color={colors.successDark} />
                      <Text style={styles.metricLabel}>Credit: </Text>
                      <Text style={[styles.metricValue, { color: colors.successDark, fontWeight: '800' }]}>
                        ₹{item.totalPayment || item.dailyPayment || 0}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Overtime Strip if OT > 0 */}
                {otHours > 0 && (
                  <View style={styles.otHighlightStrip}>
                    <MaterialIcons name="bolt" size={14} color={colors.accent} />
                    <Text style={styles.otHighlightText}>
                      Overtime Logged: <Text style={{ fontWeight: '800' }}>+{otHours} hrs</Text> • Pay Credited: <Text style={{ fontWeight: '800' }}>+₹{otPayment}</Text>
                    </Text>
                  </View>
                )}

                {/* Supervisor Notes if any */}
                {item.notes ? (
                  <View style={styles.notesRow}>
                    <MaterialIcons name="chat-bubble-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.notesText} numberOfLines={2}>
                      "{item.notes}"
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.accent} />
              ) : (
                <>
                  <MaterialIcons name="event-busy" size={48} color={colors.textLight} />
                  <Text style={styles.emptyText}>No Records Found</Text>
                  <Text style={styles.emptySubtext}>
                    No verified attendance records found for {selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} matching the selected filter.
                  </Text>
                </>
              )}
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  workerBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  workerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
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
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingHorizontal: 6,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.sm,
  },
  monthArrow: {
    padding: 6,
    borderRadius: radii.sm,
  },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthDisplayText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderRadius: radii.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  bentoGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  bentoCard: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    ...shadows.sm,
  },
  bentoNumber: {
    fontSize: 16,
    fontWeight: '900',
  },
  bentoLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },
  bentoSub: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
  },
  earningsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 10,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: 8,
    ...shadows.sm,
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsHeroLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  earningsHeroValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  earningsOtValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.warningDark,
    marginTop: 2,
  },
  earningsDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 24,
    gap: 8,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.sm,
  },
  recordCardToday: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateCol: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  todayPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  todayPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  siteNameText: {
    fontSize: 10.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    gap: 3,
  },
  shiftBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.textMuted,
  },
  recordMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 2,
  },
  metricValue: {
    fontSize: 10.5,
    color: colors.text,
    fontWeight: '700',
  },
  otHighlightStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginTop: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  otHighlightText: {
    fontSize: 10,
    color: '#C2410C',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  notesText: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
