import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  Share,
  BackHandler,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { projectId } from '@/utils/supabase/info';
import { colors, shadows, radii } from '@/styles/theme';
import { WorkerReportView } from './WorkerReportView';
import { useTranslation } from '@/i18n';

export interface Worker {
  id: string;
  name: string;
  phone: string;
  email: string;
  skillLevel: string;
  dailyWage: number;
  overtimeRate?: number;
  messCharge?: number;
  status: string;
  siteId?: string;
  aadhaar?: string;
  upiId?: string;
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
}

export interface Site {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id?: string;
  workerId: string;
  workerName?: string;
  siteId?: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'half-day' | 'absent' | 'overtime' | string;
  shift?: 'day' | 'night';
  overtimeHours?: number;
  overtimeRate?: number;
  overtimePayment?: number;
  dailyWage?: number;
  dailyPayment?: number;
  totalPayment?: number;
  notes?: string;
}

interface AdvanceRecord {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  reason?: string;
  status?: string;
}

interface WorkerDetailViewProps {
  worker: Worker;
  onBack: () => void;
  onEdit?: () => void;
  accessToken?: string;
  sites: Site[];
  onWorkerUpdated?: () => void;
}

interface DayItem {
  dateStr: string;
  dayNum: number;
  dayName: string;
  isToday: boolean;
  isFuture: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROW_HEIGHT = 58;

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function WorkerDetailView({
  worker,
  onBack,
  onEdit,
  accessToken,
  sites,
  onWorkerUpdated,
}: WorkerDetailViewProps) {
  const { t, language } = useTranslation();
  // Navigation & Timeframe State
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-11
  const [timeframe, setTimeframe] = useState<'monthly' | 'weekly' | 'daily'>('monthly');

  // FlatList Ref
  const flatListRef = useRef<FlatList<DayItem>>(null);

  // Shift State ('day' or 'night')
  const [selectedShift, setSelectedShift] = useState<'day' | 'night'>('day');

  // Data State
  const [allAttendanceRecords, setAllAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [advancesList, setAdvancesList] = useState<AdvanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);

  // Derived lookup maps for Day and Night shifts
  const { dayAttendanceMap, nightAttendanceMap } = useMemo(() => {
    const dayMap: Record<string, AttendanceRecord> = {};
    const nightMap: Record<string, AttendanceRecord> = {};
    allAttendanceRecords.forEach((r) => {
      if (!r.date) return;
      const s = (r.shift || 'day').toLowerCase().includes('night') ? 'night' : 'day';
      if (s === 'night') {
        nightMap[r.date] = r;
      } else {
        dayMap[r.date] = r;
      }
    });
    return { dayAttendanceMap: dayMap, nightAttendanceMap: nightMap };
  }, [allAttendanceRecords]);

  // Current attendance map based on selected shift
  const currentAttendanceMap = selectedShift === 'day' ? dayAttendanceMap : nightAttendanceMap;

  // Advance Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState<boolean>(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [advanceDate, setAdvanceDate] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advanceReason, setAdvanceReason] = useState<string>('');
  const [savingAdvance, setSavingAdvance] = useState<boolean>(false);
  const [deletingAdvance, setDeletingAdvance] = useState<boolean>(false);

  // Full Page Report View State
  const [isReportViewOpen, setIsReportViewOpen] = useState<boolean>(false);

  // Map site name
  const siteName = useMemo(() => {
    if (!worker.siteId) return 'No Site Assigned';
    const found = sites.find((s) => s.id === worker.siteId);
    return found ? found.name : 'Assigned Site';
  }, [worker.siteId, sites]);

  // Load data on month or worker change
  useEffect(() => {
    loadMonthData();
  }, [worker.id, selectedYear, selectedMonth]);

  // Handle hardware / device back button
  useEffect(() => {
    const handleHardwareBack = () => {
      if (isAdvanceModalOpen) {
        setIsAdvanceModalOpen(false);
        return true;
      }
      if (isReportViewOpen) {
        setIsReportViewOpen(false);
        return true;
      }
      onBack();
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleHardwareBack
    );

    return () => backSubscription.remove();
  }, [onBack, isAdvanceModalOpen, isReportViewOpen]);

  const loadMonthData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // 1. Fetch attendance records for this worker in this month (both day and night)
      const attRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?workerId=${worker.id}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const attData = await attRes.json();
      const records: AttendanceRecord[] = attData.attendance || [];
      setAllAttendanceRecords(records);

      // 2. Fetch advances for this worker
      const advRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances?workerId=${worker.id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const advData = await advRes.json();
      setAdvancesList(advData.advances || []);
    } catch (err) {
      console.error('Error loading worker detail data:', err);
      Toast.show({ type: 'error', text1: 'Network Error', text2: 'Could not fetch attendance records' });
    } finally {
      setLoading(false);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Direct Phone Call
  const handleCall = () => {
    if (!worker.phone) {
      Toast.show({ type: 'info', text1: 'No Phone Number', text2: 'Worker phone number not provided' });
      return;
    }
    const cleanPhone = worker.phone.replace(/\D/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Toast.show({ type: 'error', text1: 'Call Failed', text2: 'Could not launch dialer' });
    });
  };

  // Days list generation for the view
  const daysList: DayItem[] = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days: DayItem[] = [];

    if (timeframe === 'monthly') {
      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(selectedYear, selectedMonth, d);
        const dayOfWeek = dateObj.getDay();
        const dateStr = formatDateKey(dateObj);
        days.push({
          dateStr,
          dayNum: d,
          dayName: DAY_NAMES[dayOfWeek],
          isToday: dateStr === todayStr,
          isFuture: dateStr > todayStr,
        });
      }
    } else if (timeframe === 'weekly') {
      const refDay = selectedMonth === today.getMonth() && selectedYear === today.getFullYear()
        ? today.getDate()
        : 1;
      const refDate = new Date(selectedYear, selectedMonth, refDay);
      const startOfWeekDay = refDate.getDate() - refDate.getDay();
      for (let i = 0; i < 7; i++) {
        const d = new Date(selectedYear, selectedMonth, startOfWeekDay + i);
        const dayOfWeek = d.getDay();
        const dateStr = formatDateKey(d);
        days.push({
          dateStr,
          dayNum: d.getDate(),
          dayName: DAY_NAMES[dayOfWeek],
          isToday: dateStr === todayStr,
          isFuture: dateStr > todayStr,
        });
      }
    } else {
      const d = selectedMonth === today.getMonth() && selectedYear === today.getFullYear() ? today : new Date(selectedYear, selectedMonth, 1);
      const dayOfWeek = d.getDay();
      const dateStr = formatDateKey(d);
      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: DAY_NAMES[dayOfWeek],
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
      });
    }

    return days;
  }, [selectedYear, selectedMonth, timeframe, today, todayStr]);

  // Index of today in the list for initial scrolling
  const todayIndex = useMemo(() => {
    return daysList.findIndex((d) => d.isToday);
  }, [daysList]);

  const initialScrollIndex = useMemo(() => {
    if (todayIndex === -1) return 0;
    return Math.max(0, todayIndex - 2);
  }, [todayIndex]);

  // Auto scroll to today on mount or when switching to current month
  useEffect(() => {
    if (todayIndex >= 0 && flatListRef.current) {
      const targetIdx = Math.max(0, todayIndex - 2);
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: targetIdx,
          animated: true,
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [todayIndex, selectedYear, selectedMonth]);

  const handleScrollToIndexFailed = (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
      });
    }, 100);
  };

  const getItemLayout = (_: any, index: number) => ({
    length: ROW_HEIGHT,
    offset: ROW_HEIGHT * index,
    index,
  });

  // Aggregate advances by date
  const advancesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    advancesList.forEach((adv) => {
      if (adv.date) {
        map[adv.date] = (map[adv.date] || 0) + Number(adv.amount || 0);
      }
    });
    return map;
  }, [advancesList]);

  // Night shift IST start hour calculation (starts at 7 PM IST)
  const NIGHT_SHIFT_START_HOUR = 19;
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
  const currentISTHour = getCurrentISTHour();
  const isNightShiftNotStarted = currentISTHour < NIGHT_SHIFT_START_HOUR;

  // Helper to compute metrics for a specific shift map
  const computeShiftMetrics = (map: Record<string, AttendanceRecord>) => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let ot = 0;
    let otPayment = 0;

    daysList.forEach((day) => {
      const rec = map[day.dateStr];
      if (rec) {
        if (rec.status === 'present') present++;
        else if (rec.status === 'half-day') halfDay++;
        else if (rec.status === 'absent') absent++;
        else if (rec.status === 'overtime') {
          ot++;
          present++; // Overtime counts as a worked day
        }

        if (rec.overtimePayment !== undefined && rec.overtimePayment !== null && rec.overtimePayment > 0) {
          otPayment += Number(rec.overtimePayment);
        } else if (rec.overtimeHours && Number(rec.overtimeHours) > 0) {
          const rate = Number(rec.overtimeRate || worker.overtimeRate || 100);
          otPayment += Number(rec.overtimeHours) * rate;
        }
      }
    });

    const workDaysCredited = present + halfDay * 0.5;
    return { present, halfDay, absent, ot, otPayment, workDaysCredited };
  };

  const dayMetrics = useMemo(() => computeShiftMetrics(dayAttendanceMap), [daysList, dayAttendanceMap, worker.overtimeRate]);
  const nightMetrics = useMemo(() => computeShiftMetrics(nightAttendanceMap), [daysList, nightAttendanceMap, worker.overtimeRate]);

  // Total advances for the selected period
  const totalAdv = useMemo(() => {
    let sum = 0;
    daysList.forEach((day) => {
      const dayAdv = advancesByDate[day.dateStr];
      if (dayAdv) sum += dayAdv;
    });
    return sum;
  }, [daysList, advancesByDate]);

  // Combined metrics across BOTH Day and Night shifts
  const combinedMetrics = useMemo(() => {
    const totalWorkDaysCredited = dayMetrics.workDaysCredited + nightMetrics.workDaysCredited;
    const baseWages = Math.round(totalWorkDaysCredited * (worker.dailyWage || 0));
    const totalOtPayment = dayMetrics.otPayment + nightMetrics.otPayment;
    const grossWage = baseWages + totalOtPayment;
    const netEstimatedPayable = Math.max(0, grossWage - totalAdv);

    return {
      totalPresent: dayMetrics.present + nightMetrics.present,
      totalHalfDay: dayMetrics.halfDay + nightMetrics.halfDay,
      totalAbsent: dayMetrics.absent + nightMetrics.absent,
      totalOt: dayMetrics.ot + nightMetrics.ot,
      totalOtPayment,
      totalWorkDaysCredited,
      baseWages,
      grossWage,
      totalAdv,
      netEstimatedPayable,
    };
  }, [dayMetrics, nightMetrics, totalAdv, worker.dailyWage]);

  // Current active shift metrics for the top bento strip
  const currentShiftMetrics = selectedShift === 'day' ? dayMetrics : nightMetrics;

  // Handle Mark Attendance
  const handleMarkAttendance = async (
    dateStr: string,
    targetStatus: 'present' | 'half-day' | 'absent' | 'overtime'
  ) => {
    if (!accessToken) return;

    // Disallow future date marking
    if (dateStr > todayStr) {
      Toast.show({ type: 'info', text1: 'Future Date', text2: 'Attendance cannot be marked for future dates' });
      return;
    }

    // Lock today's night shift before 7 PM IST
    if (dateStr === todayStr && selectedShift === 'night' && isNightShiftNotStarted) {
      Toast.show({
        type: 'error',
        text1: 'Night Shift Not Started',
        text2: 'Today’s night shift attendance cannot be marked before 07:00 PM.',
      });
      return;
    }

    const currentMap = selectedShift === 'day' ? dayAttendanceMap : nightAttendanceMap;
    const existing = currentMap[dateStr];
    const newStatus = existing?.status === targetStatus ? null : targetStatus;

    const baseDaily = worker.dailyWage || 0;
    let dailyPayment = 0;
    if (newStatus === 'present' || newStatus === 'overtime') {
      dailyPayment = baseDaily;
    } else if (newStatus === 'half-day') {
      dailyPayment = Math.round(baseDaily / 2);
    }
    const otRate = existing?.overtimeRate || worker.overtimeRate || 100;
    let otHours = existing?.overtimeHours || 0;
    if (newStatus === 'overtime') {
      otHours = otHours > 0 ? otHours : 2;
    } else {
      otHours = 0;
    }
    const otPayment = newStatus === 'overtime'
      ? (existing?.overtimePayment !== undefined && existing?.overtimePayment > 0
          ? existing.overtimePayment
          : Math.round(otHours * otRate))
      : 0;
    const totalPayment = dailyPayment + otPayment;

    // Optimistic Update
    setAllAttendanceRecords((prev) => {
      const matchShift = (r: AttendanceRecord) =>
        ((r.shift || 'day').toLowerCase().includes('night') ? 'night' : 'day') === selectedShift;

      if (!newStatus) {
        return prev.filter((r) => !(r.date === dateStr && matchShift(r)));
      }
      const existingIdx = prev.findIndex((r) => r.date === dateStr && matchShift(r));
      const updatedItem: AttendanceRecord = {
        ...(existingIdx >= 0 ? prev[existingIdx] : {}),
        workerId: worker.id,
        workerName: worker.name,
        siteId: worker.siteId || (sites.length > 0 ? sites[0].id : undefined),
        date: dateStr,
        status: newStatus,
        shift: selectedShift,
        dailyWage: baseDaily,
        dailyPayment,
        overtimeHours: otHours,
        overtimeRate: otRate,
        overtimePayment: otPayment,
        totalPayment,
      };
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = updatedItem;
        return copy;
      }
      return [...prev, updatedItem];
    });

    setSavingDate(dateStr);
    try {
      if (!newStatus) {
        if (existing?.id) {
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${existing.id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
        }
      } else {
        const targetSiteId = worker.siteId || (sites.length > 0 ? sites[0].id : null);
        const payload: any = {
          workerId: worker.id,
          workerName: worker.name,
          date: dateStr,
          status: newStatus,
          shift: selectedShift,
          dailyWage: baseDaily,
          dailyPayment,
          overtimeHours: otHours,
          overtimeRate: otRate,
          overtimePayment: otPayment,
          totalPayment,
        };
        if (targetSiteId) {
          payload.siteId = targetSiteId;
        }

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to record attendance');
        }

        const data = await res.json();
        if (data.attendance?.id) {
          setAllAttendanceRecords((prev) => {
            const matchShift = (r: AttendanceRecord) =>
              ((r.shift || 'day').toLowerCase().includes('night') ? 'night' : 'day') === selectedShift;
            const idx = prev.findIndex((r) => r.date === dateStr && matchShift(r));
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], id: data.attendance.id };
              return copy;
            }
            return [...prev, data.attendance];
          });
        }
      }
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Could not update attendance' });
      loadMonthData();
    } finally {
      setSavingDate(null);
    }
  };

  // Open Advance Modal for a day (Handles both Issue New and Edit Existing)
  const handleOpenAdvanceModal = (dateStr: string) => {
    if (dateStr > todayStr) {
      Toast.show({ type: 'info', text1: 'Future Date', text2: 'Advances cannot be issued for future dates' });
      return;
    }
    setAdvanceDate(dateStr);

    // Check if an advance already exists for this date
    const dayAdvances = advancesList.filter((a) => a.date === dateStr);
    if (dayAdvances.length > 0) {
      // EDIT MODE: pre-fill with existing amount and note
      const primaryAdv = dayAdvances[0];
      setEditingAdvanceId(primaryAdv.id);
      const totalDayAdv = advancesByDate[dateStr] || primaryAdv.amount;
      setAdvanceAmount(String(totalDayAdv));
      setAdvanceReason(primaryAdv.reason || '');
    } else {
      // NEW MODE: start fresh
      setEditingAdvanceId(null);
      setAdvanceAmount('');
      setAdvanceReason('');
    }
    setIsAdvanceModalOpen(true);
  };

  // Submit / Update Advance
  const handleSaveAdvance = async () => {
    const amountNum = parseFloat(advanceAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Please enter a valid advance amount' });
      return;
    }

    setSavingAdvance(true);
    try {
      if (editingAdvanceId) {
        // EDIT EXISTING ADVANCE: Update existing record instead of adding a new one
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${editingAdvanceId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: amountNum,
              reason: advanceReason.trim() || 'Disbursement',
              date: advanceDate,
            }),
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update advance');
        }

        // Clean up any historical duplicate entries on the same date to avoid double counting
        const otherDuplicates = advancesList.filter(
          (a) => a.date === advanceDate && a.id !== editingAdvanceId
        );
        for (const dup of otherDuplicates) {
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${dup.id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          ).catch(() => {});
        }

        // Optimistically update local advances state
        setAdvancesList((prev) => {
          const withoutDups = prev.filter(
            (a) => !(a.date === advanceDate && a.id !== editingAdvanceId)
          );
          return withoutDups.map((a) =>
            a.id === editingAdvanceId
              ? { ...a, amount: amountNum, reason: advanceReason.trim() || 'Disbursement' }
              : a
          );
        });

        Toast.show({
          type: 'success',
          text1: 'Advance Updated',
          text2: `₹${amountNum} recorded for ${worker.name}`,
        });
        setIsAdvanceModalOpen(false);
      } else {
        // ISSUE NEW ADVANCE: Insert new record
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workerId: worker.id,
              amount: amountNum,
              date: advanceDate,
              reason: advanceReason.trim() || 'Disbursement',
              status: 'pending',
            }),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to record advance');
        }

        Toast.show({
          type: 'success',
          text1: 'Advance Logged',
          text2: `₹${amountNum} recorded for ${worker.name}`,
        });
        setIsAdvanceModalOpen(false);

        if (data.advance) {
          setAdvancesList((prev) => [data.advance, ...prev]);
        }
      }
      loadMonthData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err.message || 'Could not save advance' });
    } finally {
      setSavingAdvance(false);
    }
  };

  // Delete Advance
  const handleDeleteAdvance = async () => {
    if (!editingAdvanceId || !accessToken) return;

    setDeletingAdvance(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${editingAdvanceId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete advance');
      }

      // Also clean up any other duplicates on the same date
      const otherDuplicates = advancesList.filter(
        (a) => a.date === advanceDate && a.id !== editingAdvanceId
      );
      for (const dup of otherDuplicates) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${dup.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        ).catch(() => {});
      }

      setAdvancesList((prev) => prev.filter((a) => a.date !== advanceDate));
      Toast.show({
        type: 'success',
        text1: 'Advance Cleared',
        text2: `Advance for ${advanceDate} removed`,
      });
      setIsAdvanceModalOpen(false);
      loadMonthData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not delete advance' });
    } finally {
      setDeletingAdvance(false);
    }
  };



  // Render Single Day Row in the Ledger Sheet
  const renderLedgerRow = ({ item: day }: { item: DayItem }) => {
    const record = currentAttendanceMap[day.dateStr];
    const status = record?.status;
    const dayAdvance = advancesByDate[day.dateStr];
    const isSaving = savingDate === day.dateStr;
    const isAbsent = status === 'absent';
    const isFuture = day.isFuture;
    const isNightLocked = day.isToday && selectedShift === 'night' && isNightShiftNotStarted;
    const isRowDisabled = isFuture || isNightLocked;

    return (
      <View
        style={[
          styles.ledgerRow,
          day.isToday && styles.ledgerRowToday,
          (isFuture || isNightLocked) && styles.ledgerRowFuture,
        ]}
      >
        {/* Left: Date & Day of Week (Red when worker is ABSENT) */}
        <View style={styles.dateCol}>
          <Text
            style={[
              styles.dateNumber,
              isAbsent && styles.absentDateText,
            ]}
          >
            {day.dayNum}
          </Text>
          <Text
            style={[
              styles.dateDayName,
              isAbsent && styles.absentDateText,
            ]}
          >
            {day.dayName}
          </Text>
        </View>

        {/* Middle: 4 Marking Options in sequence: P, 1/2, A, OT */}
        <View
          style={[styles.markingButtonGroup, isNightLocked && { opacity: 0.35 }]}
          pointerEvents={isRowDisabled ? 'none' : 'auto'}
        >
          {/* P Button */}
          <TouchableOpacity
            style={[
              styles.markingBtn,
              status === 'present' && styles.markingBtnPresentActive,
            ]}
            onPress={() => handleMarkAttendance(day.dateStr, 'present')}
            activeOpacity={0.7}
            disabled={isSaving || isRowDisabled}
          >
            <Text
              style={[
                styles.markingBtnText,
                status === 'present' && styles.markingBtnPresentText,
              ]}
            >
              P
            </Text>
          </TouchableOpacity>

          {/* 1/2 Button */}
          <TouchableOpacity
            style={[
              styles.markingBtn,
              status === 'half-day' && styles.markingBtnHalfActive,
            ]}
            onPress={() => handleMarkAttendance(day.dateStr, 'half-day')}
            activeOpacity={0.7}
            disabled={isSaving || isRowDisabled}
          >
            <Text
              style={[
                styles.markingBtnText,
                status === 'half-day' && styles.markingBtnHalfText,
              ]}
            >
              1/2
            </Text>
          </TouchableOpacity>

          {/* A Button */}
          <TouchableOpacity
            style={[
              styles.markingBtn,
              status === 'absent' && styles.markingBtnAbsentActive,
            ]}
            onPress={() => handleMarkAttendance(day.dateStr, 'absent')}
            activeOpacity={0.7}
            disabled={isSaving || isRowDisabled}
          >
            <Text
              style={[
                styles.markingBtnText,
                status === 'absent' && styles.markingBtnAbsentText,
              ]}
            >
              A
            </Text>
          </TouchableOpacity>

          {/* OT Button */}
          <TouchableOpacity
            style={[
              styles.markingBtn,
              status === 'overtime' && styles.markingBtnOtActive,
            ]}
            onPress={() => handleMarkAttendance(day.dateStr, 'overtime')}
            activeOpacity={0.7}
            disabled={isSaving || isRowDisabled}
          >
            <Text
              style={[
                styles.markingBtnText,
                status === 'overtime' && styles.markingBtnOtText,
              ]}
            >
              OT
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right: Advance column */}
        <View
          style={styles.advanceCol}
          pointerEvents={isFuture ? 'none' : 'auto'}
        >
          {dayAdvance && dayAdvance > 0 ? (
            <TouchableOpacity
              style={styles.advancePillActive}
              onPress={() => handleOpenAdvanceModal(day.dateStr)}
              activeOpacity={0.8}
              disabled={isFuture}
            >
              <Text style={styles.advancePillActiveText}>
                ₹{dayAdvance}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.advanceBtnDefault, isFuture && styles.advanceBtnDisabled]}
              onPress={() => handleOpenAdvanceModal(day.dateStr)}
              activeOpacity={0.7}
              disabled={isFuture}
            >
              <Text style={styles.advanceBtnDefaultText}>Adv</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (isReportViewOpen) {
    return (
      <WorkerReportView
        worker={worker}
        siteName={siteName}
        accessToken={accessToken}
        sites={sites}
        onBack={() => setIsReportViewOpen(false)}
        initialMonth={selectedMonth}
        initialYear={selectedYear}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER (FIXED) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.workerTitleBox}>
            <Text style={styles.workerNameHeader} numberOfLines={1}>
              {worker.name}
            </Text>
            {worker.phone ? (
              <Text style={styles.workerPhoneHeader}>+91 {worker.phone}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.callHeaderButton}
            onPress={handleCall}
            activeOpacity={0.8}
          >
            <MaterialIcons name="phone" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {onEdit && (
            <TouchableOpacity
              style={styles.editHeaderButton}
              onPress={onEdit}
              activeOpacity={0.8}
            >
              <MaterialIcons name="edit" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FIXED TOP DASHBOARD SECTION (NOT SCROLLABLE) */}
      <View style={styles.fixedTopSection}>
        {/* 2. TOP METRIC BENTO STRIP */}
        <View style={styles.metricsStrip}>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.success }]}>
              {currentShiftMetrics.present}
            </Text>
            <Text style={styles.metricLabel}>
              {selectedShift === 'day' ? t('attendance.present') : t('attendance.nightShift')}
            </Text>
          </View>

          <View style={styles.metricCardDivider} />

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.warning }]}>
              {currentShiftMetrics.halfDay}
            </Text>
            <Text style={styles.metricLabel}>{t('attendance.halfDay')}</Text>
          </View>

          <View style={styles.metricCardDivider} />

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.error }]}>
              {currentShiftMetrics.absent}
            </Text>
            <Text style={styles.metricLabel}>{t('attendance.absent')}</Text>
          </View>

          <View style={styles.metricCardDivider} />

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.warningDark }]}>
              ₹{totalAdv}
            </Text>
            <Text style={styles.metricLabel}>{t('payroll.advancesDeducted')}</Text>
          </View>
        </View>

        {/* 3. SITE ASSIGNMENT PILL */}
        <View style={styles.sitePillRow}>
          <View style={styles.sitePill}>
            <MaterialIcons name="business" size={15} color={colors.accent} />
            <Text style={styles.sitePillText}>{t('workers.assignedSite')}: {siteName}</Text>
          </View>

          <View style={styles.wagePill}>
            <MaterialIcons name="monetization-on" size={14} color={colors.textMuted} />
            <Text style={styles.wagePillText}>₹{worker.dailyWage || 0}/day</Text>
          </View>

          <View style={[styles.wagePill, { borderColor: colors.accent + '30', backgroundColor: colors.accent + '10' }]}>
            <MaterialIcons name="bolt" size={14} color={colors.accent} />
            <Text style={[styles.wagePillText, { color: colors.accent, fontWeight: '700' }]}>
              OT: ₹{worker.overtimeRate !== undefined ? worker.overtimeRate : 100}/hr
            </Text>
          </View>

          {(worker.upiId || (worker as any).upi_id) ? (
            <View style={[styles.wagePill, { borderColor: '#16A34A30', backgroundColor: '#F0FDF4' }]}>
              <MaterialIcons name="bolt" size={14} color="#16A34A" />
              <Text style={[styles.wagePillText, { color: '#16A34A', fontWeight: '700' }]}>
                UPI: {worker.upiId || (worker as any).upi_id}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 4. SHIFT TOGGLE ROW (DAY / NIGHT) */}
        <View style={styles.shiftToggleRow}>
          <View style={styles.shiftSelector}>
            <TouchableOpacity
              style={[styles.shiftBtn, selectedShift === 'day' && styles.shiftBtnActiveDay]}
              onPress={() => setSelectedShift('day')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="wb-sunny"
                size={13}
                color={selectedShift === 'day' ? '#FFFFFF' : '#64748B'}
              />
              <Text
                style={[
                  styles.shiftBtnText,
                  selectedShift === 'day' && styles.shiftBtnTextActive,
                ]}
              >
                {t('attendance.dayShift')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shiftBtn, selectedShift === 'night' && styles.shiftBtnActiveNight]}
              onPress={() => setSelectedShift('night')}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="nights-stay"
                size={13}
                color={selectedShift === 'night' ? '#FFFFFF' : '#64748B'}
              />
              <Text
                style={[
                  styles.shiftBtnText,
                  selectedShift === 'night' && styles.shiftBtnTextActive,
                ]}
              >
                {t('attendance.nightShift')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shiftBadge}>
            <MaterialIcons
              name={selectedShift === 'day' ? 'wb-sunny' : 'nights-stay'}
              size={13}
              color={selectedShift === 'day' ? '#EA580C' : '#2563EB'}
            />
            <Text
              style={[
                styles.shiftBadgeText,
                { color: selectedShift === 'day' ? '#EA580C' : '#2563EB' },
              ]}
            >
              {selectedShift === 'day' ? t('attendance.dayShift') : t('attendance.nightShift')}
            </Text>
          </View>
        </View>

        {/* 5. TIMEFRAME SEGMENTED TABS */}
        <View style={styles.timeframeSegment}>
          {(['monthly', 'weekly', 'daily'] as const).map((mode) => {
            const isActive = timeframe === mode;
            const label = mode === 'monthly' ? t('common.month') : mode === 'weekly' ? t('common.thisWeek') : t('common.today');
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.segmentTab, isActive && styles.segmentTabActive]}
                onPress={() => setTimeframe(mode)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentTabText, isActive && styles.segmentTabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. MONTH NAVIGATOR & REPORT BAR */}
        <View style={styles.monthNavRow}>
          <View style={styles.monthSelector}>
            <TouchableOpacity
              style={styles.navChevron}
              onPress={handlePrevMonth}
              activeOpacity={0.7}
            >
              <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
            </TouchableOpacity>

            <Text style={styles.monthTitleText}>
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </Text>

            <TouchableOpacity
              style={styles.navChevron}
              onPress={handleNextMonth}
              activeOpacity={0.7}
            >
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.openReportButton}
            onPress={() => setIsReportViewOpen(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="bar-chart" size={16} color={colors.primary} />
            <Text style={styles.openReportButtonText}>
              {language === 'hi' ? 'रिपोर्ट देखें' : language === 'bn' ? 'রিপোর্ট দেখুন' : 'View Report'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 6. ONLY ATTENDANCE SHEET IS SCROLLABLE */}
      <View style={styles.sheetContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : daysList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="event-busy" size={40} color={colors.borderDark} />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'चयनित अवधि के लिए कोई दिन नहीं' : language === 'bn' ? 'নির্বাচিত সময়ের জন্য কোনো দিন নেই' : 'No days to show for selected period'}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={daysList}
            keyExtractor={(item) => item.dateStr}
            renderItem={renderLedgerRow}
            getItemLayout={getItemLayout}
            initialScrollIndex={initialScrollIndex}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* 7. QUICK ADVANCE MODAL (ISSUE / EDIT ADVANCE) */}
      <Modal
        visible={isAdvanceModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAdvanceModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.advanceModalBox}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {editingAdvanceId ? (language === 'hi' ? 'अग्रिम संपादित करें' : language === 'bn' ? 'অগ্রিম সম্পাদনা করুন' : 'Edit Worker Advance') : t('payroll.giveAdvance')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {language === 'hi' ? `${worker.name} के लिए • ${advanceDate}` : language === 'bn' ? `${worker.name}-এর জন্য • ${advanceDate}` : `For ${worker.name} • ${advanceDate}`}
                </Text>
              </View>

              <View style={styles.modalHeaderRightActions}>
                {editingAdvanceId && (
                  <TouchableOpacity
                    onPress={handleDeleteAdvance}
                    disabled={deletingAdvance || savingAdvance}
                    style={styles.headerDeleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {deletingAdvance ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <MaterialIcons name="delete-outline" size={22} color="#DC2626" />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setIsAdvanceModalOpen(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>
                {t('payroll.advanceAmount')} {!editingAdvanceId ? '*' : ''}
              </Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="numeric"
                  placeholder={t('payroll.advanceAmountPlaceholder')}
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                  placeholderTextColor={colors.textLight}
                  selectTextOnFocus={true}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                {t('payroll.reason')} ({t('common.optional')})
              </Text>
              <TextInput
                style={styles.reasonInput}
                placeholder={t('payroll.reasonPlaceholder')}
                value={advanceReason}
                onChangeText={setAdvanceReason}
                placeholderTextColor={colors.textLight}
              />

              <View style={styles.advanceActionRow}>
                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setIsAdvanceModalOpen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelModalBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveModalBtn,
                    (!advanceAmount || parseFloat(advanceAmount) <= 0) &&
                      styles.saveModalBtnDisabled,
                  ]}
                  onPress={handleSaveAdvance}
                  disabled={savingAdvance || deletingAdvance || !advanceAmount || parseFloat(advanceAmount) <= 0}
                  activeOpacity={0.8}
                >
                  {savingAdvance ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveModalBtnText}>
                      {editingAdvanceId ? t('common.save') : t('payroll.giveAdvance')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  workerTitleBox: {
    flex: 1,
  },
  workerNameHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  workerPhoneHeader: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed Top Section
  fixedTopSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#F8FAFC',
  },
  // 2. Metrics Strip
  metricsStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.sm,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  // 3. Site Pill Row
  sitePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  sitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  sitePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  wagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  wagePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  // Shift Toggle Row
  shiftToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  shiftSelector: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 20,
    padding: 3,
  },
  shiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  shiftBtnActiveDay: {
    backgroundColor: '#EA580C',
  },
  shiftBtnActiveNight: {
    backgroundColor: '#2563EB',
  },
  shiftBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  shiftBtnTextActive: {
    color: '#FFFFFF',
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // 4. Timeframe Segment
  timeframeSegment: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginTop: 10,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentTabActive: {
    backgroundColor: '#0F172A',
    ...shadows.sm,
  },
  segmentTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // 5. Month Nav Row
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navChevron: {
    padding: 4,
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 130,
    textAlign: 'center',
  },
  openReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  openReportButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  // 6. Attendance Sheet Container (SCROLLABLE AREA)
  sheetContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...shadows.sm,
  },
  listContent: {
    paddingVertical: 4,
  },
  loadingContainer: {
    flex: 1,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#94A3B8',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    height: ROW_HEIGHT,
  },
  ledgerRowToday: {
    backgroundColor: '#F0FDF4',
  },
  ledgerRowFuture: {
    opacity: 0.35,
    backgroundColor: '#FAFAFA',
  },
  dateCol: {
    width: 44,
    alignItems: 'center',
  },
  dateNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  // Absent in RED
  absentDateText: {
    color: '#DC2626',
    fontWeight: '800',
  },
  markingButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markingBtn: {
    width: 42,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markingBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  // Present
  markingBtnPresentActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  markingBtnPresentText: {
    color: '#15803D',
    fontWeight: '800',
  },
  // Half Day
  markingBtnHalfActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  markingBtnHalfText: {
    color: '#B45309',
    fontWeight: '800',
  },
  // Absent
  markingBtnAbsentActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  markingBtnAbsentText: {
    color: '#B91C1C',
    fontWeight: '800',
  },
  // Overtime
  markingBtnOtActive: {
    backgroundColor: '#FFEDD5',
    borderColor: '#EA580C',
  },
  markingBtnOtText: {
    color: '#C2410C',
    fontWeight: '800',
  },
  // Advance column
  advanceCol: {
    width: 60,
    alignItems: 'flex-end',
  },
  advanceBtnDefault: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  advanceBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  advanceBtnDefaultText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  advancePillActive: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  advancePillActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerDeleteBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  // Advance Modal
  advanceModalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.sm,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  rupeeSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: 44,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  advanceActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelModalBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveModalBtn: {
    flex: 1.4,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  saveModalBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Report Modal
  reportModalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  reportModalScroll: {
    maxHeight: 460,
  },
  reportShiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  reportShiftTitleDay: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.5,
  },
  reportShiftHeaderNight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  reportShiftTitleNight: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  reportBody: {
    padding: 20,
  },
  reportCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  reportLabel: {
    fontSize: 13,
    color: '#475569',
  },
  reportValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  reportDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  netPayableBox: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  netPayableLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  netPayableValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#166534',
    marginTop: 2,
  },
  shareReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  shareReportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
