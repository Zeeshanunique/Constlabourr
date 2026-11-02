import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Text,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AppContext } from '@/context/AppContext';
import { colors, shadows, radii } from '@/styles/theme';
import { FormField } from '@/components/shared/FormField';
import { useTranslation } from '@/i18n';

interface Worker {
  id: string;
  name: string;
  phone: string;
  dailyWage: number;
  overtimeRate?: number;
  siteId?: string;
  skillLevel?: string;
}

interface Site {
  id: string;
  name: string;
  foremanId?: string | null;
}

interface Attendance {
  id: string;
  workerId: string;
  workerName?: string;
  siteId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: 'present' | 'absent' | 'half-day';
  shift?: string;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  overtimePayment?: number;
  dailyWage?: number;
  dailyPayment?: number;
  totalPayment?: number;
  messCharge?: number;
}

interface AttendanceTabProps {
  accessToken?: string;
}

const getTodayStr = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const formatTimeString = (date: Date) => {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const LiveShiftClock = React.memo(function LiveShiftClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text style={styles.headerSubtitle}>
      {time.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })} • {formatTimeString(time)}
    </Text>
  );
});

export function AttendanceTab({ accessToken }: AttendanceTabProps) {
  const route = useRoute();
  const context = useContext(AppContext);
  const { t, language } = useTranslation();
  const token = accessToken || (route.params as any)?.accessToken;
  const userRole = context?.user?.role;
  const isForeman = userRole === 'foreman';

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedShift, setSelectedShift] = useState<'Day Shift' | 'Night Shift'>('Day Shift');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState('All');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedWorkers, setExpandedWorkers] = useState<Record<string, boolean>>({});

  const toggleWorkerExpanded = (workerId: string) => {
    setExpandedWorkers(prev => ({
      ...prev,
      [workerId]: !prev[workerId],
    }));
  };

  // Edit record modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [modalStatus, setModalStatus] = useState<'present' | 'half-day' | 'absent'>('present');
  const [customCheckIn, setCustomCheckIn] = useState('');
  const [customCheckOut, setCustomCheckOut] = useState('');
  const [customOvertime, setCustomOvertime] = useState('');
  const [customOvertimeRate, setCustomOvertimeRate] = useState('100');

  useEffect(() => {
    if (token) {
      fetchWorkers();
      fetchSites();
    }
  }, [token, isForeman]);

  // Screen focus & dependency-triggered attendance fetch (deduplicated)
  useFocusEffect(
    useCallback(() => {
      if (selectedSite && selectedDate && token) {
        fetchAttendance();
      }
    }, [selectedSite, selectedDate, selectedShift, token])
  );

  const fetchWorkers = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const fetchSites = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      const fetchedSites = data.sites || [];

      if (isForeman && context?.user?.id) {
        const userId = context.user.id;
        const foremanSites = fetchedSites.filter(
          (s: Site) => s.foremanId === userId || (context.user as any)?.siteId === s.id
        );
        setSites(foremanSites);
        if (foremanSites.length > 0) setSelectedSite(foremanSites[0].id);
      } else {
        setSites(fetchedSites);
        if (fetchedSites.length > 0 && !selectedSite) setSelectedSite(fetchedSites[0].id);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const currentShiftKey = selectedShift === 'Night Shift' ? 'night' : 'day';

  const fetchAttendance = async () => {
    if (!token || !selectedSite || !selectedDate) return;
    setLoading(true);
    try {
      const shiftParam = selectedShift === 'Night Shift' ? 'night' : 'day';
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?siteId=${selectedSite}&date=${selectedDate}&shift=${shiftParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const toStandardTime = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formatDisplayTime = (timeStr?: string | null) => {
    if (!timeStr) return '';
    const clean = timeStr.replace(/[\u202f\u00a0]/g, ' ').trim();
    const parts = clean.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const mins = parts[1].slice(0, 2);
      if (!isNaN(hours)) {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
      }
    }
    return clean;
  };

  const getWorkerStatus = (workerId: string): Attendance | undefined => {
    const currShift = selectedShift === 'Night Shift' ? 'night' : 'day';
    return attendance.find((a) => {
      if (a.workerId !== workerId) return false;
      const recShift = (a.shift || 'day').toLowerCase().includes('night') ? 'night' : 'day';
      return recShift === currShift;
    });
  };

  const openEditModal = (worker: Worker, record: Attendance) => {
    setEditingWorker(worker);
    setEditingRecord(record);
    setModalStatus((record.status as 'present' | 'half-day' | 'absent') || 'present');
    setCustomCheckIn(record.checkIn || '');
    setCustomCheckOut(record.checkOut || '');
    setCustomOvertime(record.overtimeHours ? record.overtimeHours.toString() : '');
    const otRate = record.overtimeRate !== undefined && record.overtimeRate > 0
      ? record.overtimeRate
      : (worker.overtimeRate !== undefined && worker.overtimeRate > 0 ? worker.overtimeRate : 100);
    setCustomOvertimeRate(otRate.toString());
    setShowEditModal(true);
  };

  const NIGHT_SHIFT_START_HOUR = 19; // 07:00 PM IST

  const getCurrentISTHour = () => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(new Date()), 10);
    } catch {
      return new Date().getHours();
    }
  };

  const todayDateStr = getTodayStr();
  const isFutureDate = selectedDate > todayDateStr;
  const isToday = selectedDate === todayDateStr;
  const currentISTHour = getCurrentISTHour();
  const isNightShiftNotStarted = currentISTHour < NIGHT_SHIFT_START_HOUR;
  // Intentional lock: Block only today's night shift before 7:00 PM IST (past dates remain markable)
  const isNightShiftBlocked = isToday && selectedShift === 'Night Shift' && isNightShiftNotStarted;

  const handleOpenDatePicker = () => {
    let currentDate = new Date();
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    } catch {}

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const iso = `${y}-${m}-${d}`;

            if (iso > todayDateStr) {
              Toast.show({
                type: 'error',
                text1: 'Future Date Blocked',
                text2: 'Attendance cannot be marked for future dates.',
              });
              return;
            }

            setSelectedDate(iso);
          }
        },
        mode: 'date',
        maximumDate: new Date(),
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const handleIOSDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;

      if (iso > todayDateStr) {
        Toast.show({
          type: 'error',
          text1: 'Future Date Blocked',
          text2: 'Attendance cannot be marked for future dates.',
        });
        return;
      }

      setSelectedDate(iso);
    }
  };

  const handleCardStatusPress = (worker: Worker, targetStatus: 'present' | 'absent' | 'half-day') => {
    if (isFutureDate) {
      Toast.show({
        type: 'error',
        text1: 'Future Date Blocked',
        text2: 'Attendance cannot be marked for future dates.',
      });
      return;
    }
    if (isNightShiftBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Night Shift Not Started',
        text2: 'Night shift attendance can only be marked after shift starts (07:00 PM).',
      });
      return;
    }
    const existing = getWorkerStatus(worker.id);
    if (existing?.status) {
      setExpandedWorkers(prev => ({ ...prev, [worker.id]: true }));
      Toast.show({
        type: 'info',
        text1: 'Attendance Already Marked',
        text2: 'Tap Edit in details below to modify attendance.',
      });
      return;
    }
    handleMarkAttendance(worker.id, targetStatus);
  };

  // MARK ATTENDANCE (P / HD / A) - Handles both new insertion and updating existing records
  const handleMarkAttendance = async (workerId: string, status: 'present' | 'absent' | 'half-day') => {
    if (selectedDate > todayDateStr) {
      Toast.show({
        type: 'error',
        text1: 'Future Date Blocked',
        text2: 'Attendance cannot be marked for future dates.',
      });
      return;
    }
    if (isNightShiftBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Night Shift Not Started',
        text2: 'Night shift attendance can only be marked after shift starts (07:00 PM).',
      });
      return;
    }
    if (!token || !selectedSite || !selectedDate) {
      Toast.show({ type: 'error', text1: 'Site Required', text2: 'Please select a construction site.' });
      return;
    }

    const currentShift = selectedShift === 'Night Shift' ? 'night' : 'day';
    const existingRecord = getWorkerStatus(workerId);
    const worker = workers.find((w) => w.id === workerId);
    const checkInTime = status === 'present' ? toStandardTime(new Date()) : null;

    const baseDailyWage = worker?.dailyWage || existingRecord?.dailyWage || 0;
    let dailyPayment = 0;
    if (status === 'present') {
      dailyPayment = baseDailyWage;
    } else if (status === 'half-day') {
      dailyPayment = Math.round(baseDailyWage / 2);
    } else {
      dailyPayment = 0;
    }

    const otHours = existingRecord?.overtimeHours || 0;
    const otRate = existingRecord?.overtimeRate || worker?.overtimeRate || 100;
    const otPayment = existingRecord?.overtimePayment !== undefined
      ? existingRecord.overtimePayment
      : Math.round(otHours * otRate);
    const totalPayment = dailyPayment + otPayment;

    // Optimistic UI update
    if (existingRecord) {
      setAttendance((prev) =>
        prev.map((rec) =>
          rec.id === existingRecord.id
            ? {
                ...rec,
                status,
                shift: currentShift,
                checkIn: checkInTime,
                dailyWage: baseDailyWage,
                dailyPayment,
                overtimeHours: otHours,
                overtimeRate: otRate,
                overtimePayment: otPayment,
                totalPayment,
              }
            : rec
        )
      );
    } else {
      const tempId = `temp-${Date.now()}`;
      setAttendance((prev) => [
        ...prev,
        {
          id: tempId,
          workerId,
          workerName: worker?.name || '',
          siteId: selectedSite,
          date: selectedDate,
          status,
          shift: currentShift,
          checkIn: checkInTime,
          checkOut: null,
          totalHours: status === 'present' ? 8 : status === 'half-day' ? 4 : 0,
          dailyWage: baseDailyWage,
          dailyPayment,
          overtimeHours: otHours,
          overtimeRate: otRate,
          overtimePayment: otPayment,
          totalPayment,
        },
      ]);
    }

    try {
      if (existingRecord?.id && !existingRecord.id.startsWith('temp-')) {
        // UPDATE existing record via PUT
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${existingRecord.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status,
              shift: currentShift,
              checkIn: checkInTime,
              dailyWage: baseDailyWage,
              dailyPayment,
              overtimeHours: otHours,
              overtimeRate: otRate,
              overtimePayment: otPayment,
              totalPayment,
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update attendance');
        }

        Toast.show({
          type: 'success',
          text1: 'Attendance Updated',
          text2: `${worker?.name || 'Worker'} marked as ${status.toUpperCase()}`,
        });
        fetchAttendance();
      } else {
        // CREATE new record via POST
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workerId,
              siteId: selectedSite,
              date: selectedDate,
              status,
              shift: currentShift,
              checkIn: checkInTime,
              dailyWage: baseDailyWage,
              dailyPayment,
              overtimeHours: otHours,
              overtimeRate: otRate,
              overtimePayment: otPayment,
              totalPayment,
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to mark attendance');
        }

        Toast.show({
          type: 'success',
          text1: 'Attendance Marked',
          text2: `${worker?.name || 'Worker'} marked as ${status.toUpperCase()}`,
        });
        fetchAttendance();
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Attendance Error', text2: error.message || 'Operation failed' });
      fetchAttendance(); // Revert on failure
    }
  };

  // CHECK-IN HANDLER
  const handleCheckIn = async (workerId: string) => {
    if (selectedDate > todayDateStr) {
      Toast.show({
        type: 'error',
        text1: 'Future Date Blocked',
        text2: 'Check-in cannot be recorded for future dates.',
      });
      return;
    }
    if (isNightShiftBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Night Shift Not Started',
        text2: 'Night shift check-in can only be recorded after 07:00 PM.',
      });
      return;
    }
    if (!token || !selectedSite || !selectedDate) return;

    const currentShift = selectedShift === 'Night Shift' ? 'night' : 'day';
    const existingRecord = getWorkerStatus(workerId);
    const worker = workers.find((w) => w.id === workerId);
    const timeStr = toStandardTime(new Date());

    try {
      if (existingRecord?.id && !existingRecord.id.startsWith('temp-')) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${existingRecord.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              checkIn: timeStr,
              status: 'present',
              shift: currentShift,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to record check-in');
      } else {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workerId,
              siteId: selectedSite,
              date: selectedDate,
              status: 'present',
              shift: currentShift,
              checkIn: timeStr,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to record check-in');
      }

      Toast.show({
        type: 'success',
        text1: 'Check-In Recorded',
        text2: `${worker?.name || 'Worker'} checked in at ${formatDisplayTime(timeStr)}`,
      });
      fetchAttendance();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Check-In Failed', text2: error.message });
    }
  };

  // CHECK-OUT HANDLER
  const handleCheckOut = async (workerId: string) => {
    if (selectedDate > todayDateStr) {
      Toast.show({
        type: 'error',
        text1: 'Future Date Blocked',
        text2: 'Check-out cannot be recorded for future dates.',
      });
      return;
    }
    if (isNightShiftBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Night Shift Not Started',
        text2: 'Night shift check-out cannot be recorded before shift starts.',
      });
      return;
    }
    if (!token || !selectedSite || !selectedDate) return;

    const existingRecord = getWorkerStatus(workerId);
    const worker = workers.find((w) => w.id === workerId);
    const timeStr = toStandardTime(new Date());

    if (!existingRecord?.id) {
      Toast.show({ type: 'error', text1: 'Check-In Required', text2: 'Worker must check in before checking out.' });
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${existingRecord.id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            checkOut: timeStr,
            totalHours: 8,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to record check-out');

      Toast.show({
        type: 'success',
        text1: 'Check-Out Recorded',
        text2: `${worker?.name || 'Worker'} checked out at ${formatDisplayTime(timeStr)}`,
      });
      fetchAttendance();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Check-Out Failed', text2: error.message });
    }
  };

  // BULK MARK ALL ATTENDANCE
  const handleBulkMarkAll = async (status: 'present' | 'absent') => {
    if (selectedDate > todayDateStr) {
      Toast.show({
        type: 'error',
        text1: 'Future Date Blocked',
        text2: 'Bulk attendance cannot be marked for future dates.',
      });
      return;
    }
    if (isNightShiftBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Night Shift Not Started',
        text2: 'Bulk attendance for night shift can only be marked after 07:00 PM.',
      });
      return;
    }
    if (!token || !selectedSite || !selectedDate) return;

    if (siteWorkers.length === 0) {
      Toast.show({ type: 'info', text1: 'No Workers', text2: 'No workers assigned to this site.' });
      return;
    }

    const currentShift = selectedShift === 'Night Shift' ? 'night' : 'day';
    setLoading(true);
    try {
      const promises = siteWorkers.map((w) => {
        const existing = getWorkerStatus(w.id);
        if (existing?.id && !existing.id.startsWith('temp-')) {
          return fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${existing.id}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status,
                shift: currentShift,
              }),
            }
          );
        } else {
          return fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workerId: w.id,
              siteId: selectedSite,
              date: selectedDate,
              status,
              shift: currentShift,
              checkIn: status === 'present' ? toStandardTime(new Date()) : undefined,
            }),
          });
        }
      });

      await Promise.all(promises);

      Toast.show({
        type: 'success',
        text1: 'Bulk Attendance Complete',
        text2: `Marked ${siteWorkers.length} workers as ${status.toUpperCase()}`,
      });
      fetchAttendance();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Bulk Attendance Error', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  // SAVE CUSTOM EDIT MODAL RECORD
  const handleSaveModalRecord = async () => {
    if (!editingRecord || !token) return;
    if (selectedDate > todayDateStr) {
      Toast.show({
        type: 'error',
        text1: 'Future Date Blocked',
        text2: 'Attendance cannot be modified for future dates.',
      });
      return;
    }
    const isEditingNight = (editingRecord.shift?.toLowerCase().includes('night') || selectedShift === 'Night Shift');
    if (isToday && isEditingNight && isNightShiftNotStarted) {
      Toast.show({
        type: 'error',
        text1: 'Night Shift Not Started',
        text2: 'Today’s night shift attendance cannot be modified before shift starts (07:00 PM).',
      });
      return;
    }

    try {
      const otHours = parseFloat(customOvertime) || 0;
      const otRate = parseFloat(customOvertimeRate) || (editingWorker?.overtimeRate ?? 100);
      const otPayment = Math.round(otHours * otRate);

      const baseDailyWage = editingWorker?.dailyWage || editingRecord.dailyWage || 0;
      let dailyPayment = 0;
      if (modalStatus === 'present') {
        dailyPayment = baseDailyWage;
      } else if (modalStatus === 'half-day') {
        dailyPayment = Math.round(baseDailyWage / 2);
      } else {
        dailyPayment = 0;
      }
      const totalPayment = dailyPayment + otPayment;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${editingRecord.id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: modalStatus,
            checkIn: customCheckIn || null,
            checkOut: customCheckOut || null,
            overtimeHours: otHours,
            overtimeRate: otRate,
            dailyWage: baseDailyWage,
            dailyPayment,
            overtimePayment: otPayment,
            totalPayment,
          }),
        }
      );

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Record Updated',
          text2: `Status saved as ${modalStatus.toUpperCase()}`,
        });
        setShowEditModal(false);
        fetchAttendance();
      } else {
        throw new Error('Failed to update record');
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
  };

  // REMOVE RECORD
  const handleRemoveRecord = () => {
    if (!editingRecord || !token) return;

    Alert.alert(
      t('common.confirm') || 'Confirm Deletion',
      'Are you sure you want to delete this attendance record? This will remove hours and wage calculation for this day.',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${editingRecord.id}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              if (response.ok) {
                Toast.show({ type: 'success', text1: 'Removed', text2: 'Attendance record deleted' });
                setShowEditModal(false);
                fetchAttendance();
              }
            } catch (error: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: error.message });
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWorkers(), fetchSites(), fetchAttendance()]);
    setRefreshing(false);
  };

  // STRICT SITE FILTERING: ONLY workers assigned to selectedSite
  const siteWorkers = selectedSite
    ? workers.filter((w) => w.siteId === selectedSite)
    : [];

  const filteredWorkers = (!selectedTrade || selectedTrade === 'All')
    ? siteWorkers
    : siteWorkers.filter((w) => (w?.skillLevel || 'unskilled').toLowerCase().includes(selectedTrade.toLowerCase()));

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const halfDayCount = attendance.filter((a) => a.status === 'half-day').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const totalCount = siteWorkers.length;

  // Generate recent 5-day retrospective scrubber (Past 4 days up to Today)
  const generateRecentDays = () => {
    const today = new Date();
    const days = [];
    for (let i = -4; i <= 0; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${day}`;
      const isToday = i === 0;
      const dayName = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      days.push({ iso, dayName, dayNum });
    }
    return days;
  };

  const recentDays = generateRecentDays();

  // Dynamic custom past pill if selectedDate is older than the recent 5 days
  const customPastDateInfo = (() => {
    if (!selectedDate || isFutureDate) return null;
    const isPresentInRecent = recentDays.some((d) => d.iso === selectedDate);
    if (isPresentInRecent) return null;
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return {
          iso: selectedDate,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: d.getDate(),
          monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        };
      }
    } catch {}
    return null;
  })();

  const isCustomDateSelected = !!customPastDateInfo;
  const siteOptions = sites.map((s) => ({ label: s.name, value: s.id }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t('attendance.title')}</Text>
            <LiveShiftClock />
          </View>

          {/* TWO SHIFTS TOGGLE */}
          <View style={styles.shiftSelector}>
            <TouchableOpacity
              style={[styles.shiftBtn, selectedShift === 'Day Shift' && styles.shiftBtnActive]}
              onPress={() => setSelectedShift('Day Shift')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="wb-sunny"
                size={13}
                color={selectedShift === 'Day Shift' ? '#ffffff' : '#94A3B8'}
              />
              <Text style={[styles.shiftBtnText, selectedShift === 'Day Shift' && styles.shiftBtnTextActive]}>
                {t('attendance.dayShift')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shiftBtn, selectedShift === 'Night Shift' && styles.shiftBtnActive]}
              onPress={() => setSelectedShift('Night Shift')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="nights-stay"
                size={13}
                color={selectedShift === 'Night Shift' ? '#ffffff' : '#94A3B8'}
              />
              <Text style={[styles.shiftBtnText, selectedShift === 'Night Shift' && styles.shiftBtnTextActive]}>
                {t('attendance.nightShift')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RECENT SCRUBBER & CALENDAR PICKER */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrubberScroll}>
          {/* 1. CALENDAR PICKER BOX */}
          <TouchableOpacity
            style={[styles.calendarPickerBtn, isCustomDateSelected && styles.calendarPickerBtnActive]}
            onPress={handleOpenDatePicker}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="calendar-month"
              size={18}
              color={isCustomDateSelected ? colors.accent : '#94A3B8'}
            />
            <Text style={[styles.calendarPickerText, isCustomDateSelected && styles.calendarPickerTextActive]}>
              {isCustomDateSelected ? t('common.customPeriod') : t('common.date')}
            </Text>
          </TouchableOpacity>

          {/* 2. DYNAMIC HISTORICAL PAST PILL */}
          {customPastDateInfo && (
            <TouchableOpacity
              key={customPastDateInfo.iso}
              style={[styles.scrubberDay, styles.scrubberDayActive, styles.customHistoricalDay]}
              onPress={() => setSelectedDate(customPastDateInfo.iso)}
              activeOpacity={0.8}
            >
              <View style={styles.customPillBadge}>
                <Text style={styles.customPillBadgeText}>{customPastDateInfo.monthName}</Text>
              </View>
              <Text style={[styles.scrubberDayName, styles.scrubberDayNameActive]}>
                {customPastDateInfo.dayName}
              </Text>
              <Text style={[styles.scrubberDayNum, styles.scrubberDayNumActive]}>
                {customPastDateInfo.dayNum}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3. RECENT 5 DAYS */}
          {recentDays.map((day) => {
            const isSelected = day.iso === selectedDate;
            return (
              <TouchableOpacity
                key={day.iso}
                style={[styles.scrubberDay, isSelected && styles.scrubberDayActive]}
                onPress={() => setSelectedDate(day.iso)}
                activeOpacity={0.8}
              >
                <Text style={[styles.scrubberDayName, isSelected && styles.scrubberDayNameActive]}>
                  {day.dayName}
                </Text>
                <Text style={[styles.scrubberDayNum, isSelected && styles.scrubberDayNumActive]}>
                  {day.dayNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* 2. ATTENDANCE METRIC COUNTERS */}
        <View style={styles.bentoCountersRow}>
          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>{t('common.total')}</Text>
            <Text style={styles.counterValue} numberOfLines={1} adjustsFontSizeToFit>{totalCount}</Text>
            <View style={[styles.counterTag, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.counterTagText, { color: colors.textMuted }]}>{t('nav.workers')}</Text>
            </View>
          </View>

          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>{t('attendance.present')}</Text>
            <Text style={[styles.counterValue, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>{presentCount}</Text>
            <View style={[styles.counterTag, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.counterTagText, { color: colors.successDark }]}>P</Text>
            </View>
          </View>

          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>{t('attendance.halfDay')}</Text>
            <Text style={[styles.counterValue, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>{halfDayCount}</Text>
            <View style={[styles.counterTag, { backgroundColor: colors.warningLight }]}>
              <Text style={[styles.counterTagText, { color: colors.warningDark }]}>HD</Text>
            </View>
          </View>

          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>{t('attendance.absent')}</Text>
            <Text style={[styles.counterValue, { color: colors.error }]} numberOfLines={1} adjustsFontSizeToFit>{absentCount}</Text>
            <View style={[styles.counterTag, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.counterTagText, { color: colors.errorDark }]}>A</Text>
            </View>
          </View>
        </View>

        {/* 3. SITE SELECTOR & QUICK BULK ACTIONS */}
        <View style={styles.siteSelectorCard}>
          <FormField
            label={t('attendance.selectSite').toUpperCase()}
            type="select"
            value={selectedSite}
            onChangeText={setSelectedSite}
            selectOptions={siteOptions}
            placeholder={t('workers.selectSitePlaceholder')}
          />

          <View style={styles.bulkRow}>
            <TouchableOpacity
              style={[
                styles.bulkBtn,
                { backgroundColor: colors.successLight, borderColor: '#A7F3D0' },
                (isFutureDate || isNightShiftBlocked) && styles.btnDisabled,
              ]}
              onPress={() => !isFutureDate && !isNightShiftBlocked && handleBulkMarkAll('present')}
              activeOpacity={(isFutureDate || isNightShiftBlocked) ? 1 : 0.8}
              disabled={isFutureDate || isNightShiftBlocked}
            >
              <MaterialIcons name="done-all" size={16} color={(isFutureDate || isNightShiftBlocked) ? colors.textMuted : colors.successDark} />
              <Text style={[styles.bulkBtnText, { color: (isFutureDate || isNightShiftBlocked) ? colors.textMuted : colors.successDark }]}>{t('attendance.bulkPresent')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.bulkBtn,
                { backgroundColor: colors.errorLight, borderColor: '#FECACA' },
                (isFutureDate || isNightShiftBlocked) && styles.btnDisabled,
              ]}
              onPress={() => !isFutureDate && !isNightShiftBlocked && handleBulkMarkAll('absent')}
              activeOpacity={(isFutureDate || isNightShiftBlocked) ? 1 : 0.8}
              disabled={isFutureDate || isNightShiftBlocked}
            >
              <MaterialIcons name="close" size={16} color={(isFutureDate || isNightShiftBlocked) ? colors.textMuted : colors.errorDark} />
              <Text style={[styles.bulkBtnText, { color: (isFutureDate || isNightShiftBlocked) ? colors.textMuted : colors.errorDark }]}>{t('attendance.absent')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FUTURE DATE LOCK BANNER */}
        {isFutureDate && (
          <View style={styles.futureDateBanner}>
            <MaterialIcons name="event-busy" size={18} color={colors.errorDark} />
            <Text style={styles.futureDateBannerText}>
              {language === 'hi' ? `भविष्य की तारीख चुनी गई है (${selectedDate})। अग्रिम में उपस्थिति दर्ज नहीं की जा सकती।` :
               language === 'bn' ? `ভবিষ্যতের তারিখ নির্বাচন করা হয়েছে (${selectedDate})। অগ্রিম উপস্থিতি দেওয়া যাবে না।` :
               `Future date selected (${selectedDate}). Attendance cannot be marked in advance.`}
            </Text>
          </View>
        )}

        {/* NIGHT SHIFT NOT STARTED BANNER - ONLY FOR TODAY BEFORE 7 PM */}
        {isNightShiftBlocked && (
          <View style={styles.nightShiftLockBanner}>
            <MaterialIcons name="nights-stay" size={18} color="#1E40AF" />
            <Text style={styles.nightShiftLockBannerText}>
              {language === 'hi' ? 'आज की रात की शिफ्ट अभी शुरू नहीं हुई है (शाम 07:00 बजे IST से शुरू होगी)। अग्रिम में उपस्थिति दर्ज नहीं की जा सकती।' :
               language === 'bn' ? 'আজকের রাতের শিফট এখনো শুরু হয়নি (সন্ধ্যা ০৭:০০ টায় শুরু)। অগ্রিম উপস্থিতি দেওয়া যাবে না।' :
               "Today's night shift has not started yet (begins at 07:00 PM IST). Attendance cannot be marked in advance."}
            </Text>
          </View>
        )}

        {/* 4. TRADE FILTER PILLS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tradeFilterRow}>
          {['All', 'Skilled', 'Semi-Skilled', 'Unskilled', 'Highly Skilled'].map((trade) => {
            const isTradeActive = selectedTrade === trade;
            const label = trade === 'All' ? t('common.all') :
              trade === 'Skilled' ? t('workers.skilled') :
              trade === 'Semi-Skilled' ? t('workers.semiSkilled') :
              trade === 'Unskilled' ? t('workers.unskilled') :
              trade === 'Highly Skilled' ? t('workers.highlySkilled') : trade;
            return (
              <TouchableOpacity
                key={trade}
                style={[styles.tradePill, isTradeActive && styles.tradePillActive]}
                onPress={() => setSelectedTrade(trade)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tradePillText, isTradeActive && styles.tradePillTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. WORKER ATTENDANCE CARDS */}
        <View style={styles.workerListHeader}>
          <Text style={styles.workerListTitle}>
            {t('sites.workersOnSite').toUpperCase()} ({filteredWorkers.length})
          </Text>
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>

        {filteredWorkers.length === 0 ? (
          <View style={styles.emptySiteCrewBox}>
            <MaterialIcons name="group-off" size={44} color={colors.borderDark} />
            <Text style={styles.emptySiteCrewTitle}>{t('workers.noWorkersFound')}</Text>
            <Text style={styles.emptySiteCrewSub}>
              {language === 'hi' ? 'केवल इस साइट पर तैनात श्रमिक यहाँ दिखाई देते हैं। कार्यबल सूची से श्रमिकों को इस साइट पर असाइन करें।' :
               language === 'bn' ? 'শুধুমাত্র এই সাইটে নিযুক্ত শ্রমিকরা এখানে প্রদর্শিত হবে। শ্রমিক তালিকা থেকে শ্রমিকদের এই সাইটে যুক্ত করুন।' :
               'Only workers deployed to the selected site appear here. Assign workers to this site from the Workforce Roster tab.'}
            </Text>
          </View>
        ) : (
          filteredWorkers.map((worker) => {
            const statusRecord = getWorkerStatus(worker.id);
            const currentStatus = statusRecord?.status;
            const hasCheckIn = Boolean(statusRecord?.checkIn);
            const hasCheckOut = Boolean(statusRecord?.checkOut);
            const isExpanded = Boolean(expandedWorkers[worker.id]);

            return (
              <View key={worker.id} style={styles.workerCard}>
                {/* Main Compact Row: Avatar + Info + P / 1/2 / A + Dropdown */}
                <View style={styles.workerCardMainRow}>
                  <View style={[
                    styles.workerAvatar,
                    currentStatus === 'present' && styles.avatarPresent,
                    currentStatus === 'half-day' && styles.avatarHalfDay,
                    currentStatus === 'absent' && styles.avatarAbsent,
                  ]}>
                    <Text style={styles.avatarText}>{worker.name.charAt(0).toUpperCase()}</Text>
                    {currentStatus && (
                      <View style={[
                        styles.avatarStatusDot,
                        currentStatus === 'present' && styles.dotPresent,
                        currentStatus === 'half-day' && styles.dotHalfDay,
                        currentStatus === 'absent' && styles.dotAbsent,
                      ]} />
                    )}
                  </View>

                  <View style={styles.workerInfo}>
                    <Text style={styles.workerName} numberOfLines={1}>{worker.name}</Text>
                    <Text style={styles.workerMeta} numberOfLines={1}>
                      {worker.skillLevel ? worker.skillLevel.toUpperCase() : 'GENERAL'} • ₹{worker.dailyWage || 800}/d
                      {hasCheckIn ? ` • In: ${formatDisplayTime(statusRecord?.checkIn)}` : ''}
                    </Text>
                  </View>

                  {/* Marking Action Group: P, 1/2, A + Dropdown Chevron */}
                  <View style={styles.quickMarkGroup}>
                    {/* P (Present) */}
                    <TouchableOpacity
                      style={[
                        styles.quickMarkBtn,
                        currentStatus === 'present' && styles.btnPresentActive,
                        Boolean(currentStatus) && currentStatus !== 'present' && styles.quickMarkBtnMuted,
                        (isFutureDate || isNightShiftBlocked) && styles.quickMarkBtnDisabled,
                      ]}
                      onPress={() => handleCardStatusPress(worker, 'present')}
                      activeOpacity={(isFutureDate || isNightShiftBlocked) ? 1 : 0.8}
                    >
                      <Text
                        style={[
                          styles.quickMarkText,
                          currentStatus === 'present' && styles.quickMarkTextActive,
                        ]}
                        maxFontSizeMultiplier={1.25}
                      >
                        P
                      </Text>
                    </TouchableOpacity>

                    {/* 1/2 (Half-Day) */}
                    <TouchableOpacity
                      style={[
                        styles.quickMarkBtn,
                        currentStatus === 'half-day' && styles.btnHalfDayActive,
                        Boolean(currentStatus) && currentStatus !== 'half-day' && styles.quickMarkBtnMuted,
                        (isFutureDate || isNightShiftBlocked) && styles.quickMarkBtnDisabled,
                      ]}
                      onPress={() => handleCardStatusPress(worker, 'half-day')}
                      activeOpacity={(isFutureDate || isNightShiftBlocked) ? 1 : 0.8}
                    >
                      <Text
                        style={[
                          styles.quickMarkText,
                          currentStatus === 'half-day' && styles.quickMarkTextActive,
                        ]}
                        maxFontSizeMultiplier={1.25}
                      >
                        1/2
                      </Text>
                    </TouchableOpacity>

                    {/* A (Absent) */}
                    <TouchableOpacity
                      style={[
                        styles.quickMarkBtn,
                        currentStatus === 'absent' && styles.btnAbsentActive,
                        Boolean(currentStatus) && currentStatus !== 'absent' && styles.quickMarkBtnMuted,
                        (isFutureDate || isNightShiftBlocked) && styles.quickMarkBtnDisabled,
                      ]}
                      onPress={() => handleCardStatusPress(worker, 'absent')}
                      activeOpacity={(isFutureDate || isNightShiftBlocked) ? 1 : 0.8}
                    >
                      <Text
                        style={[
                          styles.quickMarkText,
                          currentStatus === 'absent' && styles.quickMarkTextActive,
                        ]}
                        maxFontSizeMultiplier={1.25}
                      >
                        A
                      </Text>
                    </TouchableOpacity>

                    {/* Dropdown Chevron */}
                    <TouchableOpacity
                      style={[
                        styles.dropdownChevronBtn,
                        isExpanded && styles.dropdownChevronBtnActive,
                      ]}
                      onPress={() => toggleWorkerExpanded(worker.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <MaterialIcons
                        name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                        size={22}
                        color={isExpanded ? colors.accent : colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <View style={styles.expandedDrawer}>
                    {/* Status & Shift Meta Chips */}
                    <View style={styles.expandedInfoRow}>
                      <View style={[
                        styles.statusBadge,
                        currentStatus === 'present' && styles.statusBadgePresent,
                        currentStatus === 'half-day' && styles.statusBadgeHalfDay,
                        currentStatus === 'absent' && styles.statusBadgeAbsent,
                        !currentStatus && styles.statusBadgeUnmarked,
                      ]}>
                        <MaterialIcons
                          name={
                            currentStatus === 'present' ? 'check-circle' :
                            currentStatus === 'half-day' ? 'timelapse' :
                            currentStatus === 'absent' ? 'cancel' : 'help-outline'
                          }
                          size={13}
                          color={
                            currentStatus === 'present' ? colors.successDark :
                            currentStatus === 'half-day' ? colors.warningDark :
                            currentStatus === 'absent' ? colors.errorDark : colors.textMuted
                          }
                        />
                        <Text style={[
                          styles.statusBadgeText,
                          currentStatus === 'present' && styles.textSuccessDark,
                          currentStatus === 'half-day' && styles.textWarningDark,
                          currentStatus === 'absent' && styles.textErrorDark,
                          !currentStatus && styles.textMutedDark,
                        ]}>
                          {currentStatus === 'present' ? t('attendance.present') : currentStatus === 'half-day' ? t('attendance.halfDay') : currentStatus === 'absent' ? t('attendance.absent') : '-'}
                        </Text>
                      </View>

                      <View style={styles.expandedChip}>
                        <MaterialIcons
                          name={(statusRecord?.shift || selectedShift).toLowerCase().includes('night') ? 'nightlight-round' : 'wb-sunny'}
                          size={12}
                          color={colors.textMuted}
                        />
                        <Text style={styles.expandedChipText}>
                          {(statusRecord?.shift || selectedShift).toLowerCase().includes('night') ? t('attendance.nightShift') : t('attendance.dayShift')}
                          {statusRecord?.overtimeHours ? ` • +${statusRecord.overtimeHours}h OT${statusRecord.overtimePayment ? ` (₹${statusRecord.overtimePayment})` : ''}` : ''}
                        </Text>
                      </View>

                      <View style={[styles.expandedChip, { marginLeft: 'auto' }]}>
                        <Text style={styles.expandedWageText}>
                          {(() => {
                            const baseRate = worker.dailyWage || statusRecord?.dailyWage || 0;
                            if (!currentStatus) {
                              return `₹${baseRate}/d`;
                            }
                            if (currentStatus === 'absent') {
                              return '₹0/d';
                            }
                            const ot = statusRecord?.overtimePayment !== undefined && statusRecord.overtimePayment !== null && statusRecord.overtimePayment > 0
                              ? statusRecord.overtimePayment
                              : (statusRecord?.overtimeHours ? Math.round(Number(statusRecord.overtimeHours) * (statusRecord.overtimeRate || worker.overtimeRate || 100)) : 0);

                            let baseEarned = 0;
                            if (currentStatus === 'present' || (currentStatus as string) === 'overtime') {
                              baseEarned = baseRate;
                            } else if (currentStatus === 'half-day') {
                              baseEarned = Math.round(baseRate / 2);
                            }

                            const total = (statusRecord?.totalPayment !== undefined && statusRecord.totalPayment !== null && statusRecord.totalPayment > 0)
                              ? statusRecord.totalPayment
                              : (baseEarned + ot);

                            return `₹${total}/d`;
                          })()}
                        </Text>
                      </View>
                    </View>

                    {/* Check In / Out Time Punch Actions */}
                    {(currentStatus === 'present' || currentStatus === 'half-day') && (
                      <View style={styles.expandedPunchRow}>
                        <TouchableOpacity
                          style={[styles.punchActionBtn, hasCheckIn && styles.punchActionBtnActive]}
                          onPress={() => handleCheckIn(worker.id)}
                          activeOpacity={0.75}
                        >
                          <MaterialIcons
                            name={hasCheckIn ? "login" : "schedule"}
                            size={14}
                            color={hasCheckIn ? colors.successDark : colors.textMuted}
                          />
                          <Text style={[styles.punchActionText, hasCheckIn && styles.punchActionTextActive]}>
                            {hasCheckIn ? `${t('attendance.checkIn')}: ${formatDisplayTime(statusRecord?.checkIn)}` : t('attendance.checkIn')}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.punchActionBtn, hasCheckOut && styles.punchActionBtnActiveOut]}
                          onPress={() => handleCheckOut(worker.id)}
                          activeOpacity={0.75}
                        >
                          <MaterialIcons
                            name={hasCheckOut ? "logout" : "more-time"}
                            size={14}
                            color={hasCheckOut ? colors.accentDark : colors.textMuted}
                          />
                          <Text style={[styles.punchActionText, hasCheckOut && styles.punchActionTextActiveOut]}>
                            {hasCheckOut ? `${t('attendance.checkOut')}: ${formatDisplayTime(statusRecord?.checkOut)}` : t('attendance.checkOut')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Bottom Edit Action & Worker Contact */}
                    <View style={styles.expandedBottomRow}>
                      {statusRecord ? (
                        <TouchableOpacity
                          style={styles.expandedEditBtn}
                          onPress={() => openEditModal(worker, statusRecord)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="edit" size={13} color={colors.accent} />
                          <Text style={styles.expandedEditBtnText}>{t('common.edit')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.unmarkedHintText}>
                          Tap P, 1/2, or A to mark attendance
                        </Text>
                      )}

                      {worker.phone ? (
                        <View style={styles.workerPhoneChip}>
                          <MaterialIcons name="phone" size={12} color={colors.textMuted} />
                          <Text style={styles.workerPhoneText}>{worker.phone}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 6. EDIT ATTENDANCE RECORD MODAL */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('attendance.markAttendance')}</Text>
                <Text style={styles.modalSubtitle}>{editingWorker?.name} • {selectedDate}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalCloseCircle}>
                <MaterialIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFormContent}>
              <View style={styles.modalTimeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>{t('attendance.inTime').toUpperCase()}</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={customCheckIn}
                    onChangeText={setCustomCheckIn}
                    placeholder="e.g. 08:30 AM"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>{t('attendance.outTime').toUpperCase()}</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={customCheckOut}
                    onChangeText={setCustomCheckOut}
                    placeholder="e.g. 05:30 PM"
                  />
                </View>
              </View>

              <View style={[styles.modalTimeRow, { marginTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>{t('attendance.otHours').toUpperCase()}</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={customOvertime}
                    onChangeText={setCustomOvertime}
                    placeholder="e.g. 2.0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>{t('workers.overtimeRate').toUpperCase()} (₹/HR)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={customOvertimeRate}
                    onChangeText={setCustomOvertimeRate}
                    placeholder="100"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.modalStatusRow}>
                {(['present', 'half-day', 'absent'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.modalStatusBtn,
                      modalStatus === st && styles.modalStatusBtnActive,
                    ]}
                    onPress={() => setModalStatus(st)}
                  >
                    <Text
                      style={[
                        styles.modalStatusBtnText,
                        modalStatus === st && styles.modalStatusBtnTextActive,
                      ]}
                    >
                      {st === 'present' ? t('attendance.present') : st === 'half-day' ? t('attendance.halfDay') : t('attendance.absent')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Live Overtime & Wage Calculation Card */}
              {(() => {
                const otH = parseFloat(customOvertime) || 0;
                const otR = parseFloat(customOvertimeRate) || 0;
                const otPay = Math.round(otH * otR);
                const baseDaily = editingWorker?.dailyWage || editingRecord?.dailyWage || 0;
                const basePay = modalStatus === 'present' ? baseDaily : modalStatus === 'half-day' ? Math.round(baseDaily / 2) : 0;
                const totalDayPay = basePay + otPay;

                return (
                  <View style={styles.wageCalculationCard}>
                    <View style={styles.wageCalcHeader}>
                      <MaterialIcons name="calculate" size={15} color={colors.accent} />
                      <Text style={styles.wageCalcTitle}>{t('attendance.dailyPayment').toUpperCase()}</Text>
                    </View>
                    <View style={styles.wageCalcRow}>
                      <Text style={styles.wageCalcLabel}>
                        {t('attendance.dailyPayment')} ({modalStatus === 'present' ? t('attendance.present') : modalStatus === 'half-day' ? t('attendance.halfDay') : t('attendance.absent')}):
                      </Text>
                      <Text style={styles.wageCalcVal}>₹{basePay}</Text>
                    </View>
                    {otH > 0 ? (
                      <View style={styles.wageCalcRow}>
                        <Text style={styles.wageCalcLabel}>
                          {t('attendance.overtime')} ({otH} hrs × ₹{otR}/hr):
                        </Text>
                        <Text style={[styles.wageCalcVal, { color: colors.accent }]}>+ ₹{otPay}</Text>
                      </View>
                    ) : null}
                    <View style={styles.wageCalcDivider} />
                    <View style={styles.wageCalcRowTotal}>
                      <Text style={styles.wageCalcTotalLabel}>{t('attendance.totalPayment')}:</Text>
                      <Text style={styles.wageCalcTotalVal}>₹{totalDayPay}</Text>
                    </View>
                  </View>
                );
              })()}

              <View style={styles.modalFooterActions}>
                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={handleRemoveRecord}
                >
                  <MaterialIcons name="delete-outline" size={16} color={colors.error} />
                  <Text style={styles.modalDeleteBtnText}>{t('common.delete')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveModalRecord}
                >
                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  <Text style={styles.modalSaveBtnText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. CALENDAR DATE PICKER (iOS / Non-Android Modal) */}
      {Platform.OS !== 'android' && showDatePicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.iosDatePickerOverlay}>
            <View style={styles.iosDatePickerSheet}>
              <View style={styles.iosDatePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.iosDatePickerCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.iosDatePickerTitle}>
                  {language === 'hi' ? 'तारीख चुनें' : language === 'bn' ? 'তারিখ নির্বাচন করুন' : 'Select Date'}
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.iosDatePickerDone}>{t('common.confirm')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={(() => {
                  try {
                    const parts = selectedDate.split('-');
                    if (parts.length === 3) {
                      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    }
                  } catch {}
                  return new Date();
                })()}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handleIOSDateChange}
              />
            </View>
          </View>
        </Modal>
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
    paddingBottom: 14,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  shiftSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  shiftBtnActive: {
    backgroundColor: colors.accent,
  },
  shiftBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  shiftBtnTextActive: {
    color: '#FFFFFF',
  },
  scrubberScroll: {
    marginTop: 4,
  },
  scrubberDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: '#1E293B',
    marginRight: 8,
    minWidth: 50,
  },
  scrubberDayActive: {
    backgroundColor: colors.accent,
  },
  scrubberDayName: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scrubberDayNameActive: {
    color: '#FFFFFF',
  },
  scrubberDayNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  scrubberDayNumActive: {
    color: '#FFFFFF',
  },
  calendarPickerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    marginRight: 8,
    minWidth: 54,
  },
  calendarPickerBtnActive: {
    borderColor: colors.accent,
    backgroundColor: '#2A1F17',
  },
  calendarPickerText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  calendarPickerTextActive: {
    color: colors.accent,
  },
  customHistoricalDay: {
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    position: 'relative',
  },
  customPillBadge: {
    backgroundColor: '#9A3412',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 2,
  },
  customPillBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FED7AA',
    textTransform: 'uppercase',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  bentoCountersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  counterCard: {
    flex: 1,
    minWidth: '22%',
    minHeight: 68,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  counterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 2,
  },
  counterTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.xs,
  },
  counterTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  siteSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...shadows.sm,
  },
  bulkRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  bulkBtnText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
    flexShrink: 1,
  },
  tradeFilterRow: {
    marginBottom: 12,
  },
  tradePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  tradePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tradePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tradePillTextActive: {
    color: '#FFFFFF',
  },
  workerListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  workerListTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  emptySiteCrewBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
    gap: 8,
  },
  emptySiteCrewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  emptySiteCrewSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  workerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    ...shadows.sm,
  },
  workerCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarPresent: {
    borderColor: colors.success,
  },
  avatarHalfDay: {
    borderColor: colors.warning,
  },
  avatarAbsent: {
    borderColor: colors.error,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dotPresent: {
    backgroundColor: colors.success,
  },
  dotHalfDay: {
    backgroundColor: colors.warning,
  },
  dotAbsent: {
    backgroundColor: colors.error,
  },
  workerInfo: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  workerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  workerMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  quickMarkGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickMarkBtn: {
    minWidth: 32,
    minHeight: 32,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickMarkText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  btnPresentActive: {
    backgroundColor: colors.success,
    borderColor: colors.successDark,
  },
  btnHalfDayActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warningDark,
  },
  btnAbsentActive: {
    backgroundColor: colors.error,
    borderColor: colors.errorDark,
  },
  quickMarkTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  quickMarkBtnMuted: {
    opacity: 0.38,
  },
  quickMarkBtnDisabled: {
    opacity: 0.3,
  },
  dropdownChevronBtn: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    marginLeft: 2,
  },
  dropdownChevronBtnActive: {
    backgroundColor: colors.accentSoft,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  futureDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  futureDateBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.errorDark,
  },
  nightShiftLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  nightShiftLockBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  iosDatePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  iosDatePickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosDatePickerCancel: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
  },
  iosDatePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  iosDatePickerDone: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: '700',
  },
  expandedDrawer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  expandedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  statusBadgePresent: {
    backgroundColor: colors.successLight,
    borderColor: '#A7F3D0',
  },
  statusBadgeHalfDay: {
    backgroundColor: colors.warningLight,
    borderColor: '#FDE68A',
  },
  statusBadgeAbsent: {
    backgroundColor: colors.errorLight,
    borderColor: '#FECACA',
  },
  statusBadgeUnmarked: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textSuccessDark: {
    color: colors.successDark,
  },
  textWarningDark: {
    color: colors.warningDark,
  },
  textErrorDark: {
    color: colors.errorDark,
  },
  textMutedDark: {
    color: colors.textMuted,
  },
  expandedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expandedChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  expandedWageText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  expandedPunchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  punchActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  punchActionBtnActive: {
    backgroundColor: colors.successLight,
    borderColor: '#A7F3D0',
  },
  punchActionBtnActiveOut: {
    backgroundColor: colors.accentLight,
    borderColor: '#FED7AA',
  },
  punchActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  punchActionTextActive: {
    color: colors.successDark,
  },
  punchActionTextActiveOut: {
    color: colors.accentDark,
  },
  expandedBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  expandedEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.25)',
  },
  expandedEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  unmarkedHintText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  workerPhoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    marginLeft: 'auto',
  },
  workerPhoneText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFormContent: {
    gap: 8,
  },
  modalTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  modalStatusRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  modalStatusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalStatusBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalStatusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modalStatusBtnTextActive: {
    color: '#FFFFFF',
  },
  modalFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  modalDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
  },
  modalSaveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  wageCalculationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 12,
  },
  wageCalcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  wageCalcTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  wageCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  wageCalcLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  wageCalcVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  wageCalcDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  wageCalcRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  wageCalcTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  wageCalcTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.successDark,
  },
});
