import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';
import { projectId } from '@/utils/supabase/info';
import { colors, shadows, radii } from '@/styles/theme';
import { useTranslation } from '@/i18n';

// ==========================================
// INTERFACES & ARCHITECTURE MODELS
// ==========================================
interface Worker {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  skillLevel?: string;
  dailyWage?: number;
  overtimeRate?: number;
  messCharge?: number;
  siteId?: string;
  status?: string;
  aadhaar?: string;
  upiId?: string;
}

interface Site {
  id: string;
  name: string;
  location?: string;
}

interface AttendanceRecord {
  id?: string;
  workerId: string;
  workerName?: string;
  siteId?: string;
  date: string;
  status: 'present' | 'half-day' | 'absent' | 'overtime' | string;
  shift?: 'day' | 'night' | string;
  dailyWage?: number;
  dailyPayment?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  overtimePayment?: number;
  totalPayment?: number;
}

interface AdvanceRecord {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  reason?: string;
  status?: 'pending' | 'deducted' | 'cancelled' | string;
  givenBy?: string;
  deductedAt?: string;
  createdAt?: string;
}

export interface SettlementRecord {
  id: string;
  workerId: string;
  workerName: string;
  startDate: string;            // Range start
  endDate: string;              // Range end
  settledThroughDate: string;   // Effective date settled up to
  amount: number;               // Net cash/UPI paid
  grossWagesSettled: number;    // Gross wages settled
  advancesDeducted: number;     // Advances deducted in this settlement
  deductedAdvanceIds: string[]; // Specific Advance IDs consumed in this settlement
  method: 'UPI' | 'Cash' | 'Bank Transfer';
  ref?: string;
  settledAt: string;            // Timestamp
}

interface WorkerPayrollSummary {
  worker: Worker;
  dayWorkDays: number;
  nightWorkDays: number;
  totalWorkDaysCredited: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  otHours: number;
  otPayment: number;
  baseWages: number;
  grossWages: number;
  
  // Mess accounting
  // Mess charge is deducted whether worker is absent or half day or present.
  // Only unmarked days will NOT be calculated.
  messDaysCount: number;
  messChargePerDay: number;
  totalMessDeduction: number;
  totalPendingDeductions: number; // Pending advances + Mess deduction

  // Advance accounting
  allWorkerAdvances: AdvanceRecord[];   // All advances for this worker in cycle
  pendingAdvances: AdvanceRecord[];     // Currently active pending advances to deduct
  deductedAdvances: AdvanceRecord[];    // Advances already settled/deducted
  totalPendingAdvanceAmount: number;   // Pending advances sum
  totalDeductedAdvanceAmount: number;  // Already deducted advances sum
  totalCycleAdvances: number;          // Total advances in cycle

  // Settlements & Balances
  settlements: SettlementRecord[];     // Historical settlements in cycle
  totalSettledPaid: number;            // Total net money already disbursed
  netPayableBeforeAdvances: number;    // Gross wages - already settled gross
  balanceDue: number;                  // Net cash amount currently due to pay worker
  isFullySettled: boolean;
  isPartiallySettled: boolean;
  hasOutstandingAdvance: boolean;      // Advances exceed earnings
}

interface PayrollTabProps {
  accessToken?: string;
}

type RangePreset = 'this-week' | 'this-month' | 'last-month' | 'last-30' | 'custom';
type StatusFilter = 'all' | 'pending' | 'settled';

const STORAGE_SETTLEMENTS_KEY = 'constlabour_payroll_settlements_v3';

// ==========================================
// DATE HELPER UTILITIES
// ==========================================
const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatReadableDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export function PayrollTab({ accessToken }: PayrollTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const { language, setLanguage, t } = useTranslation();

  // Raw data from Supabase
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [allSettlements, setAllSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Expanded Advances Section State: { [workerId]: boolean }
  const [expandedAdvances, setExpandedAdvances] = useState<Record<string, boolean>>({});

  // Filters
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [rangePreset, setRangePreset] = useState<RangePreset>('this-month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Date range defaults to current month (1st to last day of current month)
  const [startDate, setStartDate] = useState<string>(() => {
    const curr = new Date();
    const firstDay = new Date(curr.getFullYear(), curr.getMonth(), 1);
    return formatDateKey(firstDay);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const curr = new Date();
    const lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
    return formatDateKey(lastDay);
  });

  // iOS DatePicker temporary target
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | 'adv-start' | 'adv-end' | null>(null);
  const [tempPickerDate, setTempPickerDate] = useState<Date>(new Date());

  // Give Advance Modal State
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advWorkerDropdownOpen, setAdvWorkerDropdownOpen] = useState(false);
  const [advWorkerSearch, setAdvWorkerSearch] = useState('');
  const [advWorkerId, setAdvWorkerId] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advReason, setAdvReason] = useState('');
  const [advDate, setAdvDate] = useState(formatDateKey(new Date()));
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  // Advance History Modal & Custom Date Range State
  const [showAdvanceHistory, setShowAdvanceHistory] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'pending' | 'deducted'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [advRangePreset, setAdvRangePreset] = useState<RangePreset>('this-month');
  const [advStartDate, setAdvStartDate] = useState<string>(() => {
    const curr = new Date();
    return `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [advEndDate, setAdvEndDate] = useState<string>(() => {
    const curr = new Date();
    const days = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).getDate();
    return `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
  });

  // Settlement / Disbursal Modal for Individual Worker
  const [settleTarget, setSettleTarget] = useState<WorkerPayrollSummary | null>(null);
  const [settleMethod, setSettleMethod] = useState<'UPI' | 'Cash' | 'Bank Transfer'>('UPI');
  const [settleRef, setSettleRef] = useState('');
  const [processingSettle, setProcessingSettle] = useState(false);

  // Export / Share PDF State for Main Payroll
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  // Export / Share PDF State for Advance History
  const [generatingHistoryPdf, setGeneratingHistoryPdf] = useState(false);
  const [sharingHistoryPdf, setSharingHistoryPdf] = useState(false);

  // ==========================================
  // INITIAL DATA & SETTLEMENTS LOADING
  // ==========================================
  useEffect(() => {
    loadSettlementsFromStorage();
  }, []);

  useEffect(() => {
    if (token) {
      loadAllPayrollData();
    }
  }, [token, startDate, endDate, selectedSiteId]);

  const loadSettlementsFromStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_SETTLEMENTS_KEY);
      if (stored) {
        setAllSettlements(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Error loading settlements from storage:', err);
    }
  };

  const saveSettlementHistory = async (updated: SettlementRecord[]) => {
    setAllSettlements(updated);
    try {
      await AsyncStorage.setItem(STORAGE_SETTLEMENTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving settlements to storage:', err);
    }
  };

  const loadAllPayrollData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Workers (Normalize upiId & messCharge)
      const workersPromise = fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`, { headers })
        .then((r) => r.json())
        .then((d) =>
          (d.workers || []).map((w: any) => ({
            ...w,
            upiId: (w.upiId || w.upi_id || '').trim() || undefined,
            messCharge: Number(w.messCharge ?? w.mess_charge ?? 0),
          }))
        );

      // 2. Fetch Sites
      const sitesPromise = fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`, { headers })
        .then((r) => r.json())
        .then((d) => d.sites || []);

      // 3. Fetch Attendance records for cycle
      let attUrl = `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?startDate=${startDate}&endDate=${endDate}`;
      if (selectedSiteId !== 'all') {
        attUrl += `&siteId=${selectedSiteId}`;
      }
      const attendancePromise = fetch(attUrl, { headers })
        .then((r) => r.json())
        .then((d) => d.attendance || []);

      // 4. Fetch Advances from Supabase (All records so we have both pending and deducted)
      const advancesPromise = fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances`, { headers })
        .then((r) => r.json())
        .then((d) => d.advances || []);

      const [workersRes, sitesRes, attendanceRes, advancesRes] = await Promise.all([
        workersPromise,
        sitesPromise,
        attendancePromise,
        advancesPromise,
      ]);

      setWorkers(workersRes);
      setSites(sitesRes);
      setAttendanceRecords(attendanceRes);
      setAdvances(advancesRes);
    } catch (err) {
      console.error('Error loading payroll ledger data:', err);
      Toast.show({ type: 'error', text1: 'Network Error', text2: 'Could not fetch payroll data' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSettlementsFromStorage();
    loadAllPayrollData();
  }, [startDate, endDate, selectedSiteId]);

  // ==========================================
  // PRESET & DATE RANGE HANDLERS
  // ==========================================
  const handleSelectPreset = (preset: RangePreset) => {
    setRangePreset(preset);
    const curr = new Date();

    if (preset === 'this-week') {
      const day = curr.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(curr);
      monday.setDate(curr.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDateKey(monday));
      setEndDate(formatDateKey(sunday));
    } else if (preset === 'this-month') {
      const s = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-01`;
      const days = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).getDate();
      const e = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(e);
    } else if (preset === 'last-month') {
      const lastMDate = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
      const s = `${lastMDate.getFullYear()}-${String(lastMDate.getMonth() + 1).padStart(2, '0')}-01`;
      const days = new Date(lastMDate.getFullYear(), lastMDate.getMonth() + 1, 0).getDate();
      const e = `${lastMDate.getFullYear()}-${String(lastMDate.getMonth() + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(e);
    } else if (preset === 'last-30') {
      const past30 = new Date(curr);
      past30.setDate(past30.getDate() - 29);
      setStartDate(formatDateKey(past30));
      setEndDate(formatDateKey(curr));
    }
  };

  const handleSelectAdvPreset = (preset: RangePreset) => {
    setAdvRangePreset(preset);
    const curr = new Date();

    if (preset === 'this-week') {
      const day = curr.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(curr);
      monday.setDate(curr.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setAdvStartDate(formatDateKey(monday));
      setAdvEndDate(formatDateKey(sunday));
    } else if (preset === 'this-month') {
      const s = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-01`;
      const days = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).getDate();
      const e = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      setAdvStartDate(s);
      setAdvEndDate(e);
    } else if (preset === 'last-month') {
      const lastMDate = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
      const s = `${lastMDate.getFullYear()}-${String(lastMDate.getMonth() + 1).padStart(2, '0')}-01`;
      const days = new Date(lastMDate.getFullYear(), lastMDate.getMonth() + 1, 0).getDate();
      const e = `${lastMDate.getFullYear()}-${String(lastMDate.getMonth() + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      setAdvStartDate(s);
      setAdvEndDate(e);
    } else if (preset === 'last-30') {
      const past30 = new Date(curr);
      past30.setDate(past30.getDate() - 29);
      setAdvStartDate(formatDateKey(past30));
      setAdvEndDate(formatDateKey(curr));
    }
  };

  const handleOpenDatePicker = (target: 'start' | 'end') => {
    const initialDateStr = target === 'start' ? startDate : endDate;
    const parts = initialDateStr.split('-');
    const initialDate = parts.length === 3 ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)) : new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            const formatted = formatDateKey(selectedDate);
            setRangePreset('custom');
            if (target === 'start') {
              if (formatted > endDate) setEndDate(formatted);
              setStartDate(formatted);
            } else {
              if (formatted < startDate) setStartDate(formatted);
              setEndDate(formatted);
            }
          }
        },
        mode: 'date',
      });
    } else {
      setPickerTarget(target);
      setTempPickerDate(initialDate);
    }
  };

  const handleOpenAdvDatePicker = (target: 'start' | 'end') => {
    const initialDateStr = target === 'start' ? advStartDate : advEndDate;
    const parts = initialDateStr.split('-');
    const initialDate = parts.length === 3 ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)) : new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            const formatted = formatDateKey(selectedDate);
            setAdvRangePreset('custom');
            if (target === 'start') {
              if (formatted > advEndDate) setAdvEndDate(formatted);
              setAdvStartDate(formatted);
            } else {
              if (formatted < advStartDate) setAdvStartDate(formatted);
              setAdvEndDate(formatted);
            }
          }
        },
        mode: 'date',
      });
    } else {
      setPickerTarget(target === 'start' ? 'adv-start' : 'adv-end');
      setTempPickerDate(initialDate);
    }
  };

  const handleIOSDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      const formatted = formatDateKey(selectedDate);
      if (pickerTarget === 'start') {
        setRangePreset('custom');
        if (formatted > endDate) setEndDate(formatted);
        setStartDate(formatted);
      } else if (pickerTarget === 'end') {
        setRangePreset('custom');
        if (formatted < startDate) setStartDate(formatted);
        setEndDate(formatted);
      } else if (pickerTarget === 'adv-start') {
        setAdvRangePreset('custom');
        if (formatted > advEndDate) setAdvEndDate(formatted);
        setAdvStartDate(formatted);
      } else if (pickerTarget === 'adv-end') {
        setAdvRangePreset('custom');
        if (formatted < advStartDate) setAdvStartDate(formatted);
        setAdvEndDate(formatted);
      }
    }
    setPickerTarget(null);
  };

  // Toggle advances details expander
  const toggleAdvancesExpander = (workerId: string) => {
    setExpandedAdvances((prev) => ({
      ...prev,
      [workerId]: !prev[workerId],
    }));
  };

  // ==========================================
  // CORE ACCOUNTING ENGINE & PAYROLL COMPUTATIONS
  // ==========================================
  const payrollSummaries: WorkerPayrollSummary[] = useMemo(() => {
    // 1. Filter workers by site if selected
    const activeWorkers = selectedSiteId === 'all'
      ? workers
      : workers.filter((w) => w.siteId === selectedSiteId);

    // 2. Index attendance by workerId within the selected date range
    const attByWorker: Record<string, AttendanceRecord[]> = {};
    attendanceRecords.forEach((rec) => {
      if (rec.workerId && rec.date >= startDate && rec.date <= endDate) {
        if (!attByWorker[rec.workerId]) attByWorker[rec.workerId] = [];
        attByWorker[rec.workerId].push(rec);
      }
    });

    // 3. Index advances by workerId
    // An advance belongs to this cycle if its date is within [startDate, endDate] OR if it is pending prior to endDate!
    const advByWorker: Record<string, AdvanceRecord[]> = {};
    advances.forEach((adv) => {
      if (adv.workerId) {
        if (!advByWorker[adv.workerId]) advByWorker[adv.workerId] = [];
        // Include advances whose date falls in cycle, or any active pending advance on or before endDate
        const inCycleDate = adv.date >= startDate && adv.date <= endDate;
        const isPriorPending = adv.status === 'pending' && adv.date <= endDate;
        if (inCycleDate || isPriorPending) {
          advByWorker[adv.workerId].push(adv);
        }
      }
    });

    // 4. Compute summaries for each worker
    return activeWorkers.map((worker) => {
      const records = attByWorker[worker.id] || [];
      const workerDailyWage = Number(worker.dailyWage || 0);
      const workerOtRate = Number(worker.overtimeRate !== undefined ? worker.overtimeRate : 100);

      let dayPresent = 0;
      let dayHalf = 0;
      let dayAbsent = 0;
      let dayOtHours = 0;
      let dayOtPayment = 0;

      let nightPresent = 0;
      let nightHalf = 0;
      let nightAbsent = 0;
      let nightOtHours = 0;
      let nightOtPayment = 0;

      records.forEach((rec) => {
        const isNight = (rec.shift || '').toLowerCase() === 'night' || (rec.shift || '').toLowerCase() === 'night shift';
        const st = (rec.status || '').toLowerCase();
        const hours = Number(rec.overtimeHours || 0);
        let otPay = Number(rec.overtimePayment || 0);
        if (otPay === 0 && hours > 0) {
          const rate = Number(rec.overtimeRate || workerOtRate);
          otPay = hours * rate;
        }

        if (isNight) {
          if (st === 'present' || st === 'overtime') nightPresent++;
          else if (st === 'half-day' || st === 'half_day') nightHalf++;
          else if (st === 'absent') nightAbsent++;
          nightOtHours += hours;
          nightOtPayment += otPay;
        } else {
          if (st === 'present' || st === 'overtime') dayPresent++;
          else if (st === 'half-day' || st === 'half_day') dayHalf++;
          else if (st === 'absent') dayAbsent++;
          dayOtHours += hours;
          dayOtPayment += otPay;
        }
      });

      const dayWorkDays = dayPresent + dayHalf * 0.5;
      const nightWorkDays = nightPresent + nightHalf * 0.5;
      const totalWorkDaysCredited = dayWorkDays + nightWorkDays;
      const baseWages = Math.round(totalWorkDaysCredited * workerDailyWage);
      const totalOtPayment = dayOtPayment + nightOtPayment;
      const grossWages = baseWages + totalOtPayment;

      // Classify advances for this worker
      const workerAdvances = advByWorker[worker.id] || [];
      // Sort newest first
      workerAdvances.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      // Pending advances: advances that are still active and will be deducted in next settlement
      const pendingAdvances = workerAdvances.filter((a) => a.status === 'pending');
      // Deducted advances: advances already deducted in a settlement
      const deductedAdvances = workerAdvances.filter((a) => a.status === 'deducted');

      const totalPendingAdvanceAmount = pendingAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const totalDeductedAdvanceAmount = deductedAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const totalCycleAdvances = totalPendingAdvanceAmount + totalDeductedAdvanceAmount;

      // Find all historical settlements for this worker
      const allWorkerSettlements = allSettlements.filter((s) => s.workerId === worker.id);

      // Determine date-level settlement status for records in this cycle [startDate, endDate]
      let settledGrossWagesInCycle = 0;
      let unsettledGrossWagesInCycle = 0;
      const markedMessDates = new Set<string>();
      const unsettledMarkedMessDates = new Set<string>();

      records.forEach((rec) => {
        if (!rec.date) return;
        const st = (rec.status || '').toLowerCase().trim();
        const isMarked =
          st === 'present' ||
          st === 'half-day' ||
          st === 'half_day' ||
          st === 'absent' ||
          st === 'overtime';
        if (isMarked) {
          markedMessDates.add(rec.date);
        }

        // Calculate gross earned for this day
        const hours = Number(rec.overtimeHours || 0);
        let otPay = Number(rec.overtimePayment || 0);
        if (otPay === 0 && hours > 0) {
          const rate = Number(rec.overtimeRate || workerOtRate);
          otPay = hours * rate;
        }
        let dayGross = 0;
        if (st === 'present' || st === 'overtime') {
          dayGross = workerDailyWage + otPay;
        } else if (st === 'half-day' || st === 'half_day') {
          dayGross = Math.round(workerDailyWage / 2) + otPay;
        }

        // Check if this specific date is covered by ANY settlement for this worker
        const isDateSettled = allWorkerSettlements.some((s) => {
          const sStart = s.startDate || s.settledThroughDate;
          const sEnd = s.endDate || s.settledThroughDate;
          if (!sStart || !sEnd) return false;
          return rec.date >= sStart && rec.date <= sEnd;
        });

        if (isDateSettled) {
          settledGrossWagesInCycle += dayGross;
        } else {
          unsettledGrossWagesInCycle += dayGross;
          if (isMarked) {
            unsettledMarkedMessDates.add(rec.date);
          }
        }
      });

      // Find settlements for this worker that overlap this cycle's wage period
      const workerSettlements = allWorkerSettlements.filter((s) => {
        const sStart = s.startDate || s.settledThroughDate;
        const sEnd = s.endDate || s.settledThroughDate;
        if (!sStart || !sEnd) return false;
        return sStart <= endDate && sEnd >= startDate;
      });

      // Mess Accounting:
      // Deduct mess charge whether worker is absent or half day or present.
      // Only unmarked days will NOT be calculated.
      const messDaysCount = markedMessDates.size;
      const messChargePerDay = Number(worker.messCharge || 0);
      const totalMessDeduction = messDaysCount * messChargePerDay;
      const pendingMessDeduction = unsettledMarkedMessDates.size * messChargePerDay;

      // Pending Deductions = Pending Advances + Pending Mess Deductions (only on unsettled days)
      const totalPendingDeductions = totalPendingAdvanceAmount + pendingMessDeduction;

      // Remaining Gross Wages to settle = only the unsettled gross wages in this cycle
      const unsettledGrossWages = unsettledGrossWagesInCycle;
      const totalSettledGross = settledGrossWagesInCycle;

      // Net amount disbursed for settled portion in this cycle
      const totalSettledPaid = Math.max(
        0,
        totalSettledGross -
          totalDeductedAdvanceAmount -
          (messDaysCount - unsettledMarkedMessDates.size) * messChargePerDay
      );

      // Balance Due = Unsettled Gross - Total Pending Deductions
      // If Gross >= Deductions: Net cash to pay worker
      // If Deductions > Gross: Worker has an outstanding advance/kharcha balance!
      const rawNet = unsettledGrossWages - totalPendingDeductions;
      const balanceDue = Math.max(0, rawNet);
      const hasOutstandingAdvance =
        totalPendingAdvanceAmount > 0 && totalPendingDeductions > unsettledGrossWages;

      const isFullySettled =
        (totalSettledGross > 0 || grossWages === 0) &&
        unsettledGrossWages === 0 &&
        balanceDue === 0 &&
        totalPendingAdvanceAmount === 0;

      const isPartiallySettled =
        (totalSettledGross > 0 || totalSettledPaid > 0) &&
        (balanceDue > 0 || unsettledGrossWages > 0);

      return {
        worker,
        dayWorkDays,
        nightWorkDays,
        totalWorkDaysCredited,
        presentDays: dayPresent + nightPresent,
        halfDays: dayHalf + nightHalf,
        absentDays: dayAbsent + nightAbsent,
        otHours: dayOtHours + nightOtHours,
        otPayment: totalOtPayment,
        baseWages,
        grossWages,
        messDaysCount,
        messChargePerDay,
        totalMessDeduction,
        totalPendingDeductions,
        allWorkerAdvances: workerAdvances,
        pendingAdvances,
        deductedAdvances,
        totalPendingAdvanceAmount,
        totalDeductedAdvanceAmount,
        totalCycleAdvances,
        settlements: workerSettlements,
        totalSettledPaid,
        netPayableBeforeAdvances: unsettledGrossWages,
        balanceDue,
        isFullySettled,
        isPartiallySettled,
        hasOutstandingAdvance,
      };
    });
  }, [workers, selectedSiteId, attendanceRecords, advances, startDate, endDate, allSettlements]);

  // Filtered summaries according to search and status filter
  const filteredSummaries = useMemo(() => {
    let result = payrollSummaries;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.worker.name.toLowerCase().includes(q) ||
          (s.worker.phone && s.worker.phone.includes(q)) ||
          (s.worker.skillLevel && s.worker.skillLevel.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === 'pending') {
      result = result.filter((s) => s.balanceDue > 0 || s.totalPendingAdvanceAmount > 0);
    } else if (statusFilter === 'settled') {
      result = result.filter((s) => s.isFullySettled);
    }

    return result;
  }, [payrollSummaries, searchQuery, statusFilter]);

  // Overall Financial Totals
  const totals = useMemo(() => {
    let totalGross = 0;
    let totalPendingAdvances = 0;
    let totalMessDeductions = 0;
    let totalPendingDeductions = 0;
    let totalDeductedAdvances = 0;
    let totalSettled = 0;
    let totalPendingDisbursable = 0;
    let totalDays = 0;
    let pendingCount = 0;
    let settledCount = 0;

    payrollSummaries.forEach((s) => {
      totalGross += s.grossWages;
      totalPendingAdvances += s.totalPendingAdvanceAmount;
      totalMessDeductions += s.totalMessDeduction;
      totalPendingDeductions += s.totalPendingDeductions;
      totalDeductedAdvances += s.totalDeductedAdvanceAmount;
      totalSettled += s.totalSettledPaid;
      totalPendingDisbursable += s.balanceDue;
      totalDays += s.totalWorkDaysCredited;

      if (s.isFullySettled) {
        settledCount++;
      } else if (s.balanceDue > 0 || s.totalPendingAdvanceAmount > 0) {
        pendingCount++;
      }
    });

    return {
      totalGross,
      totalPendingAdvances,
      totalMessDeductions,
      totalPendingDeductions,
      totalDeductedAdvances,
      totalSettled,
      totalPendingDisbursable,
      totalDays,
      pendingCount,
      settledCount,
    };
  }, [payrollSummaries]);

  // Every Issued Advance for current period and site
  const cycleAdvances = useMemo(() => {
    const workerMap = new Map<string, Worker>();
    workers.forEach((w) => workerMap.set(w.id, w));

    const filtered = advances.filter((adv) => {
      if (!adv.workerId) return false;
      const w = workerMap.get(adv.workerId);
      if (!w) return false;
      if (selectedSiteId !== 'all' && w.siteId !== selectedSiteId) return false;

      // Belong to cycle if date in range OR pending prior to endDate
      const inCycleDate = adv.date >= startDate && adv.date <= endDate;
      const isPriorPending = adv.status === 'pending' && adv.date <= endDate;
      return inCycleDate || isPriorPending;
    });

    // Sort newest first
    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return filtered;
  }, [advances, workers, selectedSiteId, startDate, endDate]);

  // Filtered advances for the Advance History modal (filtered strictly by custom time period advStartDate & advEndDate)
  const historyFilteredAdvances = useMemo(() => {
    const workerMap = new Map<string, Worker>();
    workers.forEach((w) => workerMap.set(w.id, w));

    // 1. Filter by site and custom date range [advStartDate, advEndDate]
    let result = advances.filter((adv) => {
      if (!adv.workerId) return false;
      const w = workerMap.get(adv.workerId);
      if (!w) return false;
      if (selectedSiteId !== 'all' && w.siteId !== selectedSiteId) return false;

      // Filter by the selected custom time period!
      return adv.date >= advStartDate && adv.date <= advEndDate;
    });

    // 2. Sort newest first
    result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 3. Filter by status tab in history modal ('all' | 'pending' | 'deducted')
    if (historyStatusFilter === 'pending') {
      result = result.filter((a) => a.status === 'pending');
    } else if (historyStatusFilter === 'deducted') {
      result = result.filter((a) => a.status === 'deducted');
    }

    // 4. Filter by search query in history modal
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase().trim();
      result = result.filter((adv) => {
        const w = workerMap.get(adv.workerId);
        const nameMatch = w ? w.name.toLowerCase().includes(q) : false;
        const phoneMatch = w && w.phone ? w.phone.includes(q) : false;
        const upiMatch = w && w.upiId ? w.upiId.toLowerCase().includes(q) : false;
        const reasonMatch = (adv.reason || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || upiMatch || reasonMatch;
      });
    }

    return result;
  }, [advances, workers, selectedSiteId, advStartDate, advEndDate, historyStatusFilter, historySearchQuery]);

  // Advance History metrics summary for the selected custom time period
  const historyMetrics = useMemo(() => {
    const workerMap = new Map<string, Worker>();
    workers.forEach((w) => workerMap.set(w.id, w));

    // Advances in the selected custom time period
    const inPeriodAdvances = advances.filter((adv) => {
      if (!adv.workerId) return false;
      const w = workerMap.get(adv.workerId);
      if (!w) return false;
      if (selectedSiteId !== 'all' && w.siteId !== selectedSiteId) return false;
      return adv.date >= advStartDate && adv.date <= advEndDate;
    });

    let totalPendingAmt = 0;
    let totalDeductedAmt = 0;
    let pendingCount = 0;
    let deductedCount = 0;

    inPeriodAdvances.forEach((a) => {
      const amt = Number(a.amount || 0);
      if (a.status === 'deducted') {
        totalDeductedAmt += amt;
        deductedCount++;
      } else {
        totalPendingAmt += amt;
        pendingCount++;
      }
    });

    return {
      totalCount: inPeriodAdvances.length,
      totalAmount: totalPendingAmt + totalDeductedAmt,
      totalPendingAmt,
      totalDeductedAmt,
      pendingCount,
      deductedCount,
    };
  }, [advances, workers, selectedSiteId, advStartDate, advEndDate]);

  // Selected site display name
  const currentSiteName = useMemo(() => {
    if (selectedSiteId === 'all') return 'All Construction Sites';
    const found = sites.find((s) => s.id === selectedSiteId);
    return found ? found.name : 'Selected Site';
  }, [selectedSiteId, sites]);

  // Selected worker for advance modal
  const selectedAdvWorker = useMemo(() => {
    return workers.find((w) => w.id === advWorkerId);
  }, [workers, advWorkerId]);

  // Filtered workers list for advance dropdown
  const dropdownFilteredWorkers = useMemo(() => {
    if (!advWorkerSearch.trim()) return workers;
    const q = advWorkerSearch.toLowerCase().trim();
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.phone && w.phone.includes(q)) ||
        (w.skillLevel && w.skillLevel.toLowerCase().includes(q))
    );
  }, [workers, advWorkerSearch]);

  // ==========================================
  // DISBURSAL & SETTLEMENT HANDLERS
  // ==========================================
  const handleOpenSettleModal = (summary: WorkerPayrollSummary) => {
    setSettleTarget(summary);
    setSettleMethod(summary.worker.upiId ? 'UPI' : 'Cash');
    setSettleRef('');
  };

  const handleConfirmSettle = async () => {
    if (!settleTarget) return;
    const amountToSettle = settleTarget.balanceDue;
    if (amountToSettle <= 0 && settleTarget.totalPendingAdvanceAmount === 0) {
      Toast.show({ type: 'info', text1: 'Already Settled', text2: 'No remaining balance to disburse' });
      setSettleTarget(null);
      return;
    }

    setProcessingSettle(true);
    try {
      const advancesToDeduct = settleTarget.pendingAdvances;
      const advanceDeductionAmount = advancesToDeduct.reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const deductedIds = advancesToDeduct.map((a) => a.id);

      // 1. Mark each deducted advance as 'deducted' in Supabase database!
      for (const adv of advancesToDeduct) {
        try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${adv.id}/status`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'deducted' }),
          });
        } catch (e) {
          console.warn('Could not update advance status in DB:', e);
        }
      }

      // 2. Insert payment record into Supabase payments table
      try {
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/payments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workerId: settleTarget.worker.id,
            amount: amountToSettle,
            paymentMethod: settleMethod,
            transactionRef: settleRef || '',
            date: formatDateKey(new Date()),
            notes: `Cycle ${startDate} to ${endDate} settlement. Advances deducted: ₹${advanceDeductionAmount}`,
          }),
        });
      } catch (e) {
        console.warn('Could not insert payment into Supabase payments table:', e);
      }

      // 3. Create persistent Settlement Record
      const newRecord: SettlementRecord = {
        id: `settle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workerId: settleTarget.worker.id,
        workerName: settleTarget.worker.name,
        startDate,
        endDate,
        settledThroughDate: endDate,
        amount: amountToSettle,
        grossWagesSettled: settleTarget.netPayableBeforeAdvances,
        advancesDeducted: advanceDeductionAmount,
        deductedAdvanceIds: deductedIds,
        method: settleMethod,
        ref: settleRef || (settleTarget.isPartiallySettled ? 'Remaining cycle disbursal' : 'Cycle disbursal'),
        settledAt: new Date().toISOString(),
      };

      const updatedHistory = [...allSettlements, newRecord];
      await saveSettlementHistory(updatedHistory);

      Toast.show({
        type: 'success',
        text1: 'Wage Disbursed',
        text2: `₹${amountToSettle.toLocaleString()} disbursed to ${settleTarget.worker.name}`,
      });

      setSettleTarget(null);
      // Reload Supabase data to refresh advance statuses
      loadAllPayrollData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Settlement Error', text2: err.message });
    } finally {
      setProcessingSettle(false);
    }
  };

  const handleRevertLastSettlement = (summary: WorkerPayrollSummary) => {
    if (summary.settlements.length === 0) return;
    const lastSettlement = summary.settlements[summary.settlements.length - 1];

    Alert.alert(
      'Revert Settlement',
      `Undo disbursal of ₹${lastSettlement.amount.toLocaleString()} for ${summary.worker.name}? Any deducted advances will be restored to Pending status.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: async () => {
            // Restore advance statuses back to pending in Supabase
            if (lastSettlement.deductedAdvanceIds && lastSettlement.deductedAdvanceIds.length > 0) {
              for (const advId of lastSettlement.deductedAdvanceIds) {
                try {
                  await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${advId}/status`, {
                    method: 'PUT',
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: 'pending' }),
                  });
                } catch (e) {
                  console.warn('Could not restore advance status in DB:', e);
                }
              }
            }

            const updated = allSettlements.filter((s) => s.id !== lastSettlement.id);
            await saveSettlementHistory(updated);

            Toast.show({
              type: 'info',
              text1: 'Settlement Reverted',
              text2: `Disbursal undone. Advances restored to pending.`,
            });

            loadAllPayrollData();
          },
        },
      ]
    );
  };

  const handleDeleteAdvance = (advId: string, workerName: string, amount: number) => {
    Alert.alert(
      'Delete Advance',
      `Cancel and delete ₹${amount.toLocaleString()} advance for ${workerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${advId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error('Failed to delete advance');
              Toast.show({ type: 'success', text1: 'Advance Removed', text2: `₹${amount} advance deleted` });
              loadAllPayrollData();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: err.message });
            }
          },
        },
      ]
    );
  };

  const handleSettleAllPending = () => {
    const pendingList = payrollSummaries.filter((s) => s.balanceDue > 0);
    if (pendingList.length === 0) {
      Toast.show({ type: 'info', text1: 'All Settled', text2: 'No pending wage payouts in this cycle' });
      return;
    }

    Alert.alert(
      'Bulk Disbursal',
      `Mark all ${pendingList.length} workers with remaining balance as settled? (Total: ₹${totals.totalPendingDisbursable.toLocaleString()})`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disburse All',
          onPress: async () => {
            const now = new Date().toISOString();
            const newRecords: SettlementRecord[] = [];

            for (const s of pendingList) {
              const deductedIds = s.pendingAdvances.map((a) => a.id);
              // Update advance statuses in DB
              for (const adv of s.pendingAdvances) {
                try {
                  await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances/${adv.id}/status`, {
                    method: 'PUT',
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: 'deducted' }),
                  });
                } catch (e) {
                  console.warn('Could not update advance status in DB:', e);
                }
              }

              newRecords.push({
                id: `settle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${s.worker.id}`,
                workerId: s.worker.id,
                workerName: s.worker.name,
                startDate,
                endDate,
                settledThroughDate: endDate,
                amount: s.balanceDue,
                grossWagesSettled: s.netPayableBeforeAdvances,
                advancesDeducted: s.totalPendingAdvanceAmount,
                deductedAdvanceIds: deductedIds,
                method: 'Cash',
                ref: 'Bulk Cycle Settlement',
                settledAt: now,
              });
            }

            const updated = [...allSettlements, ...newRecords];
            await saveSettlementHistory(updated);

            Toast.show({
              type: 'success',
              text1: 'Bulk Settlement Complete',
              text2: `${pendingList.length} workers settled`,
            });

            loadAllPayrollData();
          },
        },
      ]
    );
  };

  // Quick Direct UPI Link Launch (PhonePe / GPay / Paytm)
  const handleLaunchUpi = (summary: WorkerPayrollSummary) => {
    const worker = summary.worker;
    const workerUpi = (worker.upiId || '').trim();

    // Check if worker has a real registered UPI ID
    if (!workerUpi) {
      Toast.show({
        type: 'error',
        text1: t('payroll.upiNotRegistered'),
        text2: language === 'hi'
          ? `${worker.name} के लिए यूपीआई आईडी पंजीकृत नहीं है।`
          : language === 'bn'
          ? `${worker.name}-এর জন্য ইউপিআই আইডি নিবন্ধিত নেই।`
          : `UPI ID is not registered for ${worker.name}.`,
      });
      return;
    }

    const vpa = workerUpi;
    const amountToPay = summary.balanceDue;
    const workerName = worker.name;

    const upiUrl = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(workerName)}&am=${amountToPay}&cu=INR&tn=${encodeURIComponent(`Wage_${startDate}_${endDate}`)}`;

    Linking.openURL(upiUrl).catch(() => {
      Linking.canOpenURL(upiUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(upiUrl);
          } else {
            Toast.show({
              type: 'info',
              text1: language === 'hi' ? 'यूपीआई ऐप नहीं मिला' : language === 'bn' ? 'ইউপিআই অ্যাপ পাওয়া যায়নি' : 'No UPI App Found',
              text2: language === 'hi' ? 'भुगतान के लिए GPay, PhonePe या Paytm ऐप इंस्टॉल करें।' : language === 'bn' ? 'পেমেন্টের জন্য GPay, PhonePe বা Paytm অ্যাপ ইনস্টল করুন।' : 'Please install GPay, PhonePe or Paytm to pay via UPI.',
            });
          }
        })
        .catch(() => {
          Toast.show({
            type: 'info',
            text1: language === 'hi' ? 'यूपीआई ऐप नहीं मिला' : language === 'bn' ? 'ইউপিআই ऐप পাওয়া যায়নি' : 'No UPI App Found',
            text2: language === 'hi' ? 'भुगतान के लिए GPay, PhonePe या Paytm ऐप इंस्टॉल करें।' : language === 'bn' ? 'পেমেন্টের জন্য GPay, PhonePe বা Paytm অ্যাপ ইনস্টল করুন।' : 'Please install GPay, PhonePe or Paytm to pay via UPI.',
          });
        });
    });
  };

  // Quick Direct UPI Link Launch for an Advance
  const handleLaunchAdvanceUpi = (adv: AdvanceRecord, worker?: Worker) => {
    if (!worker) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: language === 'hi' ? 'श्रमिक का विवरण नहीं मिला।' : language === 'bn' ? 'শ্রমিকের বিবরণ পাওয়া যায়নি।' : 'Worker details not found.',
      });
      return;
    }

    const workerUpi = (worker.upiId || '').trim();

    // Check if worker has a real registered UPI ID
    if (!workerUpi) {
      Toast.show({
        type: 'error',
        text1: t('payroll.upiNotRegistered'),
        text2: language === 'hi'
          ? `${worker.name} के लिए यूपीआई आईडी पंजीकृत नहीं है।`
          : language === 'bn'
          ? `${worker.name}-এর জন্য ইউপিআই আইডি নিবন্ধিত নেই।`
          : `UPI ID is not registered for ${worker.name}.`,
      });
      return;
    }

    const vpa = workerUpi;
    const amountToPay = adv.amount;
    const workerName = worker.name;

    const upiUrl = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(workerName)}&am=${amountToPay}&cu=INR&tn=${encodeURIComponent(`Kharcha_${adv.date}`)}`;

    Linking.openURL(upiUrl).catch(() => {
      Linking.canOpenURL(upiUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(upiUrl);
          } else {
            Toast.show({
              type: 'info',
              text1: language === 'hi' ? 'यूपीआई ऐप नहीं मिला' : language === 'bn' ? 'ইউপিআই অ্যাপ পাওয়া যায়নি' : 'No UPI App Found',
              text2: language === 'hi' ? 'भुगतान के लिए GPay, PhonePe या Paytm ऐप इंस्टॉल करें।' : language === 'bn' ? 'পেমেন্টের জন্য GPay, PhonePe বা Paytm অ্যাপ ইনস্টল করুন।' : 'Please install GPay, PhonePe or Paytm to pay via UPI.',
            });
          }
        })
        .catch(() => {
          Toast.show({
            type: 'info',
            text1: language === 'hi' ? 'यूपीआई ऐप नहीं मिला' : language === 'bn' ? 'ইউপিআই ऐप পাওয়া যায়নি' : 'No UPI App Found',
            text2: language === 'hi' ? 'भुगतान के लिए GPay, PhonePe या Paytm ऐप इंस्टॉल करें।' : language === 'bn' ? 'পেমেন্টের জন্য GPay, PhonePe বা Paytm অ্যাপ ইনস্টল করুন।' : 'Please install GPay, PhonePe or Paytm to pay via UPI.',
          });
        });
    });
  };

  // ==========================================
  // GIVE ADVANCE HANDLER
  // ==========================================
  const handleGiveAdvance = async () => {
    if (!advWorkerId || !advAmount) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please select a worker and enter amount' });
      return;
    }
    const amt = parseFloat(advAmount);
    if (isNaN(amt) || amt <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Enter a valid positive number' });
      return;
    }

    setSubmittingAdvance(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId: advWorkerId,
          amount: amt,
          date: advDate || formatDateKey(new Date()),
          reason: advReason || 'Kharcha / Cash Advance',
        }),
      });

      if (!response.ok) throw new Error('Failed to record advance');

      Toast.show({
        type: 'success',
        text1: 'Advance Recorded',
        text2: `₹${amt.toLocaleString()} kharcha issued.`,
      });

      setAdvWorkerId('');
      setAdvAmount('');
      setAdvReason('');
      setShowAdvanceModal(false);
      loadAllPayrollData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setSubmittingAdvance(false);
    }
  };

  // ==========================================
  // PDF REPORT GENERATION & SHARING
  // ==========================================
  const generatePayrollPdfHtml = () => {
    const todayFormatted = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rowsHtml = payrollSummaries
      .map((s, index) => {
        let statusBadge = '<span style="color:#EA580C; font-weight:800;">PENDING</span>';
        if (s.isFullySettled) {
          statusBadge = '<span style="color:#15803D; font-weight:800;">SETTLED</span>';
        } else if (s.isPartiallySettled) {
          statusBadge = `<span style="color:#B45309; font-weight:800;">PARTIAL (₹${s.balanceDue.toLocaleString()} DUE)</span>`;
        } else if (s.hasOutstandingAdvance) {
          statusBadge = `<span style="color:#DC2626; font-weight:800;">ADVANCE BAL (-₹${(s.totalPendingAdvanceAmount - s.netPayableBeforeAdvances).toLocaleString()})</span>`;
        }

        return `
          <tr>
            <td style="text-align:center;">${index + 1}</td>
            <td>
              <strong>${s.worker.name}</strong><br/>
              <span style="font-size:9px; color:#64748B;">${(s.worker.skillLevel || 'LABOUR').toUpperCase()} • ${s.worker.phone || 'N/A'}</span>
            </td>
            <td style="text-align:right;">₹${s.worker.dailyWage || 0}</td>
            <td style="text-align:center; font-weight:700;">${s.totalWorkDaysCredited} d</td>
            <td style="text-align:center; color:#EA580C;">${s.otHours} h</td>
            <td style="text-align:right; font-weight:700;">₹${s.grossWages.toLocaleString()}</td>
            <td style="text-align:right; color:#DC2626;">
              -₹${s.totalPendingDeductions.toLocaleString()}<br/>
              <span style="font-size:8px; color:#64748B;">${s.totalMessDeduction > 0 ? `Adv: ₹${s.totalPendingAdvanceAmount} | Mess: ₹${s.totalMessDeduction}` : `Adv: ₹${s.totalPendingAdvanceAmount}`}</span>
            </td>
            <td style="text-align:right; color:#15803D;">₹${s.totalSettledPaid.toLocaleString()}</td>
            <td style="text-align:right; font-weight:900; color:#166534; font-size:11px;">₹${s.balanceDue.toLocaleString()}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="height:28px; border-bottom:1px solid #CBD5E1;"></td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Payroll Disbursal Sheet - ${currentSiteName}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .brand-title { font-size: 19px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px; }
          .brand-sub { font-size: 10px; color: #EA580C; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
          .meta-cell { text-align: right; font-size: 10px; color: #475569; }
          
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 6px; }
          .summary-table td { padding: 6px 10px; text-align: center; border-right: 1px solid #E2E8F0; }
          .summary-table td:last-child { border-right: none; }
          .summary-title { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; }
          .summary-val { font-size: 16px; font-weight: 900; color: #0F172A; margin-top: 2px; }

          .ledger-table { width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #CBD5E1; }
          .ledger-table th { background: #0F172A; color: #FFFFFF; padding: 5px 6px; font-size: 8.5px; text-transform: uppercase; border: 1px solid #334155; }
          .ledger-table td { padding: 5px 6px; border: 1px solid #E2E8F0; }
          .ledger-table tr:nth-child(even) { background: #F8FAFC; }

          .sig-table { width: 100%; margin-top: 20px; border-collapse: collapse; }
          .sig-table td { width: 50%; text-align: center; padding: 0 40px; }
          .sig-line { border-bottom: 1px solid #94A3B8; height: 30px; margin-bottom: 5px; }
          .sig-label { font-size: 9.5px; font-weight: 700; color: #475569; }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="brand-title">CONSTLABOUR</div>
              <div class="brand-sub">${
                language === 'hi' ? 'ठेकेदार कार्यबल मजदूरी भुगतान खाता • WORKFORCE WAGE DISBURSAL LEDGER' :
                language === 'bn' ? 'ঠিকাদার কর্মীবাহিনীর মজুরি পরিশোধ খতিয়ান • WORKFORCE WAGE DISBURSAL LEDGER' :
                'Contractor Workforce Wage Disbursal Ledger'
              }</div>
            </td>
            <td class="meta-cell">
              <div><strong>${language === 'hi' ? 'साइट / Site:' : language === 'bn' ? 'সাইট / Site:' : 'Site:'}</strong> ${currentSiteName}</div>
              <div><strong>${language === 'hi' ? 'अवधि / Period:' : language === 'bn' ? 'সময়কাল / Period:' : 'Cycle Period:'}</strong> ${startDate} to ${endDate}</div>
              <div><strong>${language === 'hi' ? 'तैयार / Generated:' : language === 'bn' ? 'উত্পন্ন / Generated:' : 'Generated:'}</strong> ${todayFormatted}</div>
            </td>
          </tr>
        </table>

        <table class="summary-table">
          <tr>
            <td>
              <div class="summary-title">${language === 'hi' ? 'कुल श्रमिक / Workforce' : language === 'bn' ? 'মোট শ্রমিক / Workforce' : 'Workforce Count'}</div>
              <div class="summary-val">${payrollSummaries.length} Workers</div>
            </td>
            <td>
              <div class="summary-title">${language === 'hi' ? 'कार्य दिवस / Work Days' : language === 'bn' ? 'কাজের দিন / Work Days' : 'Work Days Credited'}</div>
              <div class="summary-val">${totals.totalDays} Days</div>
            </td>
            <td>
              <div class="summary-title">${language === 'hi' ? 'सकल मजदूरी / Gross Wages' : language === 'bn' ? 'মোট মজুরি / Gross Wages' : 'Gross Wages'}</div>
              <div class="summary-val">₹${totals.totalGross.toLocaleString()}</div>
            </td>
            <td>
              <div class="summary-title">${language === 'hi' ? 'कुल कटौतियां / Deductions' : language === 'bn' ? 'মোট কর্তন / Deductions' : 'Total Deductions (Adv + Mess)'}</div>
              <div class="summary-val" style="color:#DC2626;">-₹${totals.totalPendingDeductions.toLocaleString()}</div>
            </td>
            <td>
              <div class="summary-title" style="color:#15803D;">${language === 'hi' ? 'भुगतान किया / Disbursed' : language === 'bn' ? 'প্রদেয় মজুরি / Disbursed' : 'Already Disbursed'}</div>
              <div class="summary-val" style="color:#15803D;">₹${totals.totalSettled.toLocaleString()}</div>
            </td>
            <td style="background:#FFF7ED;">
              <div class="summary-title" style="color:#EA580C;">${language === 'hi' ? 'लंबित भुगतान / Pending' : language === 'bn' ? 'বাকি পরিশোধ / Pending' : 'Pending Disbursal'}</div>
              <div class="summary-val" style="color:#EA580C;">₹${totals.totalPendingDisbursable.toLocaleString()}</div>
            </td>
          </tr>
        </table>

        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width:3%;">#</th>
              <th style="text-align:left; width:19%;">${language === 'hi' ? 'श्रमिक का नाम व कौशल / Worker' : language === 'bn' ? 'শ্রমিকের নাম ও দক্ষতা / Worker' : 'Worker Name & Skill'}</th>
              <th style="text-align:right; width:8%;">${language === 'hi' ? 'दैनिक दर / Base' : language === 'bn' ? 'দৈনিক হার / Base' : 'Daily Base'}</th>
              <th style="text-align:center; width:8%;">${language === 'hi' ? 'दिन / Days' : language === 'bn' ? 'দিন / Days' : 'Work Days'}</th>
              <th style="text-align:center; width:7%;">${language === 'hi' ? 'ओटी / OT' : language === 'bn' ? 'ওটি / OT' : 'OT (Hrs)'}</th>
              <th style="text-align:right; width:10%;">${language === 'hi' ? 'सकल मजदूरी / Gross' : language === 'bn' ? 'মোট মজুরি / Gross' : 'Gross Wages'}</th>
              <th style="text-align:right; width:9%;">${language === 'hi' ? 'कटौतियां / Deduct' : language === 'bn' ? 'কর্তন / Deduct' : 'Deductions'}</th>
              <th style="text-align:right; width:9%;">${language === 'hi' ? 'भुगतान / Paid' : language === 'bn' ? 'পরিশোধ / Paid' : 'Already Paid'}</th>
              <th style="text-align:right; width:10%;">${language === 'hi' ? 'शेष देय / Due' : language === 'bn' ? 'বকেয়া / Due' : 'Balance Due'}</th>
              <th style="text-align:center; width:9%;">${language === 'hi' ? 'स्थिति / Status' : language === 'bn' ? 'অবস্থা / Status' : 'Status'}</th>
              <th style="width:8%;">${language === 'hi' ? 'हस्ताक्षर / Thumb' : language === 'bn' ? 'স্বাক্ষর / Thumb' : 'Signature / Thumb'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table class="sig-table">
          <tr>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${language === 'hi' ? 'अधिकृत ठेकेदार / पर्यवेक्षक हस्ताक्षर • Contractor / Supervisor' : language === 'bn' ? 'অনুমোদিত ঠিকাদার / সুপারভাইজার স্বাক্ষর • Contractor / Supervisor' : 'Authorized Site Supervisor / Contractor Signature'}</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${language === 'hi' ? 'लेखा अधिकारी / खजांची सत्यापन • Accounts Officer / Cashier' : language === 'bn' ? 'হিসাব কর্মকর্তা / ক্যাশিয়ার যাচাইকরণ • Accounts Officer / Cashier' : 'Accounts Officer / Cashier Verification'}</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  const handleDownloadPdf = async () => {
    if (generatingPdf || sharingPdf) return;
    setGeneratingPdf(true);
    try {
      const html = generatePayrollPdfHtml();
      await Print.printAsync({ html });
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Download PDF error:', err);
        Toast.show({ type: 'error', text1: 'Print Error', text2: 'Could not open print window' });
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    if (sharingPdf || generatingPdf) return;
    setSharingPdf(true);
    try {
      const html = generatePayrollPdfHtml();
      const file = await Print.printToFileAsync({ html, base64: true });

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const cleanBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
      const safeSite = currentSiteName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Payroll_${safeSite}_${startDate}_to_${endDate}.pdf`;
      const targetUri = `${cleanBaseDir}${filename}`;

      if (file?.base64) {
        await FileSystem.writeAsStringAsync(targetUri, file.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (file?.uri) {
        await FileSystem.copyAsync({ from: file.uri, to: targetUri });
      }

      const pdfUriToShare = targetUri.startsWith('file://') ? targetUri : `file://${targetUri}`;
      setSharingPdf(false);
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (await Sharing.isAvailableAsync()) {
        try {
          await Sharing.shareAsync(pdfUriToShare, {
            mimeType: 'application/pdf',
            dialogTitle: `Share Payroll Ledger - ${currentSiteName}`,
            UTI: 'com.adobe.pdf',
          });
          return;
        } catch (shareErr) {
          console.warn('Sharing.shareAsync failed, trying File.preview:', shareErr);
        }
      }

      try {
        const expoFile = new ExpoFile(pdfUriToShare);
        await expoFile.preview({ mimeType: 'application/pdf' });
        return;
      } catch (previewErr) {
        console.warn('ExpoFile.preview failed, trying Print spooler:', previewErr);
      }

      await Print.printAsync({ html });
    } catch (err: any) {
      console.error('Error sharing PDF report:', err);
      Toast.show({ type: 'error', text1: 'Share Failed', text2: 'Could not share PDF report' });
    } finally {
      setSharingPdf(false);
    }
  };

  // ==========================================
  // ADVANCE & KHARCHA HISTORY PDF (DOWNLOAD & SHARE)
  // ==========================================
  const generateAdvanceHistoryPdfHtml = () => {
    const todayFormatted = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const listToPrint = historyFilteredAdvances;

    const workerMap = new Map<string, Worker>();
    workers.forEach((w) => workerMap.set(w.id, w));

    let totalAmt = 0;
    let pendingAmt = 0;
    let deductedAmt = 0;

    const rowsHtml = listToPrint
      .map((adv, index) => {
        const worker = workerMap.get(adv.workerId);
        const workerSite = sites.find((s) => s.id === worker?.siteId);
        const isDeducted = adv.status === 'deducted';
        const amt = Number(adv.amount || 0);

        totalAmt += amt;
        if (isDeducted) deductedAmt += amt;
        else pendingAmt += amt;

        const statusBadge = isDeducted
          ? '<span style="color:#15803D; font-weight:800; background:#DCFCE7; padding:3px 7px; border-radius:4px; font-size:9px;">DEDUCTED IN SETTLEMENT</span>'
          : '<span style="color:#C2410C; font-weight:800; background:#FFEDD5; padding:3px 7px; border-radius:4px; font-size:9px;">PENDING DEDUCTION</span>';

        return `
          <tr>
            <td style="text-align:center;">${index + 1}</td>
            <td style="text-align:center; font-weight:700;">${formatReadableDate(adv.date)}</td>
            <td>
              <strong>${worker?.name || 'Worker'}</strong><br/>
              <span style="font-size:9px; color:#64748B;">
                ${(worker?.skillLevel || 'LABOUR').toUpperCase()} • ${worker?.phone ? `+91 ${worker.phone}` : 'No phone'}${worker?.upiId ? ` • UPI: ${worker.upiId}` : ''}
              </span>
            </td>
            <td>${workerSite?.name || currentSiteName}</td>
            <td style="text-align:right; font-weight:900; color:#DC2626; font-size:11px;">₹${amt.toLocaleString()}</td>
            <td style="color:#334155; font-style:italic;">"${adv.reason || 'General Cash Advance'}"</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="height:26px; border-bottom:1px solid #CBD5E1;"></td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Worker Advance & Kharcha Ledger - ${currentSiteName}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .brand-title { font-size: 19px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px; }
          .brand-sub { font-size: 10px; color: #EA580C; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
          .meta-cell { text-align: right; font-size: 10px; color: #475569; }
          
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 6px; }
          .summary-table td { padding: 6px 10px; text-align: center; border-right: 1px solid #E2E8F0; }
          .summary-table td:last-child { border-right: none; }
          .summary-title { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; }
          .summary-val { font-size: 16px; font-weight: 900; color: #0F172A; margin-top: 2px; }

          .ledger-table { width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #CBD5E1; }
          .ledger-table th { background: #0F172A; color: #FFFFFF; padding: 6px 8px; font-size: 8.5px; text-transform: uppercase; border: 1px solid #334155; }
          .ledger-table td { padding: 6px 8px; border: 1px solid #E2E8F0; }
          .ledger-table tr:nth-child(even) { background: #F8FAFC; }

          .sig-table { width: 100%; margin-top: 25px; border-collapse: collapse; }
          .sig-table td { width: 50%; text-align: center; padding: 0 40px; }
          .sig-line { border-bottom: 1px solid #94A3B8; height: 30px; margin-bottom: 5px; }
          .sig-label { font-size: 9.5px; font-weight: 700; color: #475569; }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="brand-title">CONSTLABOUR</div>
              <div class="brand-sub">${
                language === 'hi' ? 'ठेकेदार कार्यबल खर्चा और अग्रिम बहीखाता • WORKFORCE KHARCHA & ADVANCE LEDGER' :
                language === 'bn' ? 'ঠিকাদার কর্মীবাহিনীর খরচ ও অগ্রিম খতিয়ান • WORKFORCE KHARCHA & ADVANCE LEDGER' :
                'Contractor Workforce Kharcha & Cash Advance Ledger'
              }</div>
            </td>
            <td class="meta-cell">
              <div><strong>${language === 'hi' ? 'साइट / Site:' : language === 'bn' ? 'সাইট / Site:' : 'Site:'}</strong> ${currentSiteName}</div>
              <div><strong>${language === 'hi' ? 'अवधि / Period:' : language === 'bn' ? 'সময়কাল / Period:' : 'Period:'}</strong> ${formatReadableDate(advStartDate)} to ${formatReadableDate(advEndDate)}</div>
              <div><strong>${language === 'hi' ? 'तैयार / Generated:' : language === 'bn' ? 'উত্পন্ন / Generated:' : 'Generated:'}</strong> ${todayFormatted}</div>
            </td>
          </tr>
        </table>

        <table class="summary-table">
          <tr>
            <td>
              <div class="summary-title">${language === 'hi' ? 'कुल जारी अग्रिम / Total Records' : language === 'bn' ? 'মোট জারি করা অগ্রিম / Total Records' : 'Total Advances Issued'}</div>
              <div class="summary-val">${listToPrint.length} Records</div>
            </td>
            <td>
              <div class="summary-title">${language === 'hi' ? 'कुल अग्रिम राशि / Total Amount' : language === 'bn' ? 'মোট অগ্রিমের পরিমাণ / Total Amount' : 'Total Kharcha Amount'}</div>
              <div class="summary-val">₹${totalAmt.toLocaleString()}</div>
            </td>
            <td style="background:#FFF7ED;">
              <div class="summary-title" style="color:#EA580C;">${language === 'hi' ? 'कटौती लंबित / Pending' : language === 'bn' ? 'কর্তন বাকি / Pending' : 'Pending Deduction'}</div>
              <div class="summary-val" style="color:#EA580C;">₹${pendingAmt.toLocaleString()}</div>
            </td>
            <td style="background:#F0FDF4;">
              <div class="summary-title" style="color:#15803D;">${language === 'hi' ? 'समायोजित / Deducted' : language === 'bn' ? 'সমন্বিত / Deducted' : 'Deducted in Settlements'}</div>
              <div class="summary-val" style="color:#15803D;">₹${deductedAmt.toLocaleString()}</div>
            </td>
          </tr>
        </table>

        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width:4%;">#</th>
              <th style="text-align:center; width:11%;">${language === 'hi' ? 'तारीख / Date' : language === 'bn' ? 'তারিখ / Date' : 'Issue Date'}</th>
              <th style="text-align:left; width:22%;">${language === 'hi' ? 'श्रमिक का नाम / Worker' : language === 'bn' ? 'শ্রমিকের নাম / Worker' : 'Worker Name & Contact'}</th>
              <th style="text-align:left; width:13%;">${language === 'hi' ? 'कार्यस्थल / Site' : language === 'bn' ? 'সাইট / Site' : 'Assigned Site'}</th>
              <th style="text-align:right; width:11%;">${language === 'hi' ? 'राशि / Amount' : language === 'bn' ? 'টাকার পরিমাণ / Amount' : 'Amount'}</th>
              <th style="text-align:left; width:19%;">${language === 'hi' ? 'उद्देश्य / Reason' : language === 'bn' ? 'উদ্দেশ্য / Reason' : 'Purpose / Reason'}</th>
              <th style="text-align:center; width:10%;">${language === 'hi' ? 'स्थिति / Status' : language === 'bn' ? 'অবস্থা / Status' : 'Status'}</th>
              <th style="width:10%;">${language === 'hi' ? 'हस्ताक्षर / Signature' : language === 'bn' ? 'স্বাক্ষর / Signature' : 'Worker Signature'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:15px; color:#64748B;">No advances found</td></tr>'}
          </tbody>
        </table>

        <table class="sig-table">
          <tr>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${language === 'hi' ? 'अधिकृत ठेकेदार / पर्यवेक्षक हस्ताक्षर • Contractor / Supervisor' : language === 'bn' ? 'অনুমোদিত ঠিকাদার / সুপারভাইজার স্বাক্ষর • Contractor / Supervisor' : 'Authorized Site Supervisor / Contractor Signature'}</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${language === 'hi' ? 'लेखा अधिकारी / खजांची सत्यापन • Accounts Officer / Cashier' : language === 'bn' ? 'হিসাব কর্মকর্তা / ক্যাশিয়ার যাচাইকরণ • Accounts Officer / Cashier' : 'Accounts Officer / Cashier Verification'}</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  const handleDownloadAdvanceHistoryPdf = async () => {
    if (generatingHistoryPdf || sharingHistoryPdf) return;
    setGeneratingHistoryPdf(true);
    try {
      const html = generateAdvanceHistoryPdfHtml();
      await Print.printAsync({ html });
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Download Advance History PDF error:', err);
        Toast.show({ type: 'error', text1: 'Print Error', text2: 'Could not open print window' });
      }
    } finally {
      setGeneratingHistoryPdf(false);
    }
  };

  const handleShareAdvanceHistoryPdf = async () => {
    if (sharingHistoryPdf || generatingHistoryPdf) return;
    setSharingHistoryPdf(true);
    try {
      const html = generateAdvanceHistoryPdfHtml();
      const file = await Print.printToFileAsync({ html, base64: true });

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const cleanBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
      const safeSite = currentSiteName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Advance_History_${safeSite}_${advStartDate}_to_${advEndDate}.pdf`;
      const targetUri = `${cleanBaseDir}${filename}`;

      if (file?.base64) {
        await FileSystem.writeAsStringAsync(targetUri, file.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (file?.uri) {
        await FileSystem.copyAsync({ from: file.uri, to: targetUri });
      }

      const pdfUriToShare = targetUri.startsWith('file://') ? targetUri : `file://${targetUri}`;
      setSharingHistoryPdf(false);
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (await Sharing.isAvailableAsync()) {
        try {
          await Sharing.shareAsync(pdfUriToShare, {
            mimeType: 'application/pdf',
            dialogTitle: `Share Advance History (${formatReadableDate(advStartDate)} - ${formatReadableDate(advEndDate)}) - ${currentSiteName}`,
            UTI: 'com.adobe.pdf',
          });
          return;
        } catch (shareErr) {
          console.warn('Sharing.shareAsync failed, trying File.preview:', shareErr);
        }
      }

      try {
        const expoFile = new ExpoFile(pdfUriToShare);
        await expoFile.preview({ mimeType: 'application/pdf' });
        return;
      } catch (previewErr) {
        console.warn('ExpoFile.preview failed, trying Print spooler:', previewErr);
      }

      await Print.printAsync({ html });
    } catch (err: any) {
      console.error('Error sharing Advance History PDF report:', err);
      Toast.show({ type: 'error', text1: 'Share Failed', text2: 'Could not share PDF report' });
    } finally {
      setSharingHistoryPdf(false);
    }
  };

  const quickAdvanceAmounts = [500, 1000, 2000, 5000];
  const quickAdvanceReasons = ['Ration / Mess', 'Medical Emergency', 'Family Travel', 'Kharcha / Cash', 'Mobile Recharge'];

  // Render a single Advance Card (User Request: Display every issued advance in payroll page as new card)
  const renderAdvanceCard = (adv: AdvanceRecord) => {
    const worker = workers.find((w) => w.id === adv.workerId);
    const workerSite = sites.find((s) => s.id === worker?.siteId);
    const workerInitials = (worker?.name || 'W')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const isDeducted = adv.status === 'deducted';
    const amountNum = Number(adv.amount || 0);

    return (
      <View
        key={adv.id}
        style={[
          styles.advanceEntryCard,
          isDeducted && styles.advanceEntryCardDeducted,
        ]}
      >
        {/* Card Header: Worker Avatar, Worker Name, Skill, Site & Amount */}
        <View style={styles.advEntryHeader}>
          <View style={[styles.advAvatar, isDeducted && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
            <Text style={[styles.advAvatarText, isDeducted && { color: colors.textMuted }]}>
              {workerInitials}
            </Text>
          </View>

          <View style={styles.advWorkerMeta}>
            <View style={styles.advNameRow}>
              <Text style={styles.advWorkerName}>{worker?.name || 'Worker'}</Text>
              <View style={styles.advSkillBadge}>
                <Text style={styles.advSkillBadgeText}>
                  {(worker?.skillLevel || 'Labour').toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.advContactText} numberOfLines={1}>
              {worker?.phone ? `+91 ${worker.phone}` : 'No mobile'}
              {worker?.upiId ? ` • ⚡ ${worker.upiId}` : ''}
              {workerSite ? ` • 📍 ${workerSite.name}` : ''}
            </Text>
          </View>

          <View style={styles.advAmountBox}>
            <Text style={[styles.advAmountVal, isDeducted && { color: colors.textMuted }]}>
              -₹{amountNum.toLocaleString()}
            </Text>
            <Text style={styles.advAmountSub}>Kharcha / Adv</Text>
          </View>
        </View>

        {/* Card Body: Date and Reason */}
        <View style={styles.advBodyRow}>
          <View style={styles.advDateBox}>
            <MaterialIcons name="event" size={13} color={colors.textMuted} />
            <Text style={styles.advDateText}>{formatReadableDate(adv.date)}</Text>
          </View>

          <View style={styles.advReasonBox}>
            <MaterialIcons name="format-quote" size={14} color={colors.accent} />
            <Text style={styles.advReasonText} numberOfLines={1}>
              "{adv.reason || 'General Cash Advance'}"
            </Text>
          </View>
        </View>

        {/* Card Footer: Status Pill, UPI Pay Action & Delete */}
        <View style={styles.advFooterRow}>
          <View
            style={[
              styles.advStatusBadge,
              isDeducted ? styles.advStatusDeducted : styles.advStatusPending,
            ]}
          >
            <MaterialIcons
              name={isDeducted ? 'check-circle' : 'hourglass-top'}
              size={12}
              color={isDeducted ? colors.successDark : '#C2410C'}
            />
            <Text
              style={[
                styles.advStatusText,
                isDeducted ? styles.advStatusTextDeducted : styles.advStatusTextPending,
              ]}
            >
              {isDeducted ? 'DEDUCTED IN SETTLEMENT' : 'PENDING DEDUCTION'}
            </Text>
          </View>

          <View style={styles.advCardActions}>
            {!isDeducted && (
              <TouchableOpacity
                style={styles.advDeleteActionBtn}
                onPress={() => handleDeleteAdvance(adv.id, worker?.name || 'Worker', amountNum)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="delete-outline" size={15} color={colors.error} />
                <Text style={styles.advDeleteActionText}>Delete</Text>
              </TouchableOpacity>
            )}

            {!isDeducted && (
              <TouchableOpacity
                style={[
                  styles.advUpiActionBtn,
                  !worker?.upiId && { backgroundColor: '#64748B' }
                ]}
                onPress={() => handleLaunchAdvanceUpi(adv, worker)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="bolt" size={13} color="#FFFFFF" />
                <Text style={styles.advUpiActionText}>Pay UPI</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>{t('payroll.title')}</Text>
            <Text style={styles.headerSubtitle}>
              {currentSiteName} • {formatReadableDate(startDate)} to {formatReadableDate(endDate)}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleSharePdf}
              disabled={sharingPdf || generatingPdf}
              activeOpacity={0.7}
            >
              {sharingPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="share" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleDownloadPdf}
              disabled={generatingPdf || sharingPdf}
              activeOpacity={0.7}
            >
              {generatingPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="print" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>

          </View>
        </View>

        {/* Action Bar: Advance History & + Advance buttons */}
        <View style={styles.headerAdvanceRow}>
          <TouchableOpacity
            style={styles.advanceHistoryBtn}
            onPress={() => setShowAdvanceHistory(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="history" size={17} color="#FFFFFF" />
            <Text style={styles.advanceHistoryBtnText}>
              {t('payroll.advanceHistory')} ({cycleAdvances.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.giveAdvanceBtn}
            onPress={() => {
              setAdvWorkerId('');
              setAdvWorkerDropdownOpen(false);
              setAdvAmount('');
              setAdvReason('');
              setShowAdvanceModal(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.giveAdvanceText}>{t('payroll.giveAdvance')}</Text>
          </TouchableOpacity>
        </View>

        {/* Preset Date Range Selector Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'this-week' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('this-week')}
          >
            <Text style={[styles.presetChipText, rangePreset === 'this-week' && styles.presetChipTextActive]}>
              {t('common.thisWeek')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'this-month' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('this-month')}
          >
            <Text style={[styles.presetChipText, rangePreset === 'this-month' && styles.presetChipTextActive]}>
              {t('common.thisMonth')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'last-month' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('last-month')}
          >
            <Text style={[styles.presetChipText, rangePreset === 'last-month' && styles.presetChipTextActive]}>
              {t('common.previousMonth')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'last-30' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('last-30')}
          >
            <Text style={[styles.presetChipText, rangePreset === 'last-30' && styles.presetChipTextActive]}>
              {t('common.last30Days')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'custom' && styles.presetChipActive]}
            onPress={() => handleOpenDatePicker('start')}
          >
            <MaterialIcons
              name="calendar-today"
              size={12}
              color={rangePreset === 'custom' ? '#FFFFFF' : '#94A3B8'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.presetChipText, rangePreset === 'custom' && styles.presetChipTextActive]}>
              {t('common.customPeriod')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Custom Date Pickers Display if Custom */}
        {rangePreset === 'custom' && (
          <View style={styles.customDateBar}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => handleOpenDatePicker('start')}
            >
              <Text style={styles.datePickerLabel}>{t('common.from').toUpperCase()}:</Text>
              <Text style={styles.datePickerVal}>{startDate}</Text>
            </TouchableOpacity>

            <MaterialIcons name="arrow-forward" size={14} color="#94A3B8" />

            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => handleOpenDatePicker('end')}
            >
              <Text style={styles.datePickerLabel}>{t('common.to').toUpperCase()}:</Text>
              <Text style={styles.datePickerVal}>{endDate}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Site Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.siteScroll}
        >
          <TouchableOpacity
            style={[styles.sitePill, selectedSiteId === 'all' && styles.sitePillActive]}
            onPress={() => setSelectedSiteId('all')}
          >
            <Text style={[styles.sitePillText, selectedSiteId === 'all' && styles.sitePillTextActive]}>
              {t('dashboard.allActiveSites')} ({workers.length})
            </Text>
          </TouchableOpacity>

          {sites.map((site) => {
            const count = workers.filter((w) => w.siteId === site.id).length;
            const isSel = selectedSiteId === site.id;
            return (
              <TouchableOpacity
                key={site.id}
                style={[styles.sitePill, isSel && styles.sitePillActive]}
                onPress={() => setSelectedSiteId(site.id)}
              >
                <Text style={[styles.sitePillText, isSel && styles.sitePillTextActive]}>
                  {site.name} ({count})
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
        }
      >
        {/* 2. HIGH-IMPACT FINANCIAL BENTO SUMMARY */}
        <View style={styles.bentoRow}>
          <View style={styles.bentoCard}>
            <View style={styles.bentoIconBox}>
              <MaterialIcons name="payments" size={16} color={colors.primary} />
            </View>
            <Text style={styles.bentoLabel}>{t('payroll.grossWages')}</Text>
            <Text style={styles.bentoVal}>₹{totals.totalGross.toLocaleString()}</Text>
            <Text style={styles.bentoSub}>{totals.totalDays} {t('attendance.shiftCredits')}</Text>
          </View>

          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => setShowAdvanceHistory(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconBox, { backgroundColor: '#FEF2F2' }]}>
              <MaterialIcons name="money-off" size={16} color={colors.error} />
            </View>
            <Text style={styles.bentoLabel}>{t('workerPortal.pendingKharcha')}</Text>
            <Text style={[styles.bentoVal, { color: colors.error }]}>-₹{totals.totalPendingAdvances.toLocaleString()}</Text>
            <Text style={styles.bentoSub}>{t('payroll.advanceHistory')} ({cycleAdvances.length}) ▾</Text>
          </TouchableOpacity>

          <View style={styles.bentoCard}>
            <View style={[styles.bentoIconBox, { backgroundColor: '#ECFDF5' }]}>
              <MaterialIcons name="check-circle" size={16} color={colors.success} />
            </View>
            <Text style={styles.bentoLabel}>{t('payroll.settled')}</Text>
            <Text style={[styles.bentoVal, { color: colors.successDark }]}>
              ₹{totals.totalSettled.toLocaleString()}
            </Text>
            <Text style={styles.bentoSub}>{totals.settledCount} {t('payroll.settled')}</Text>
          </View>
        </View>

        {/* HERO NET PENDING DISBURSAL CARD */}
        <View style={styles.heroNetCard}>
          <View style={styles.heroNetLeft}>
            <View style={styles.heroBadgeRow}>
              <Text style={styles.heroNetLabel}>{t('payroll.netDisbursable').toUpperCase()}</Text>
              {totals.pendingCount > 0 ? (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{totals.pendingCount} {t('payroll.pending').toUpperCase()}</Text>
                </View>
              ) : (
                <View style={[styles.pendingBadge, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.pendingBadgeText, { color: colors.successDark }]}>{t('payroll.settled').toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroNetValue} numberOfLines={1} adjustsFontSizeToFit>₹{totals.totalPendingDisbursable.toLocaleString()}</Text>
            <Text style={styles.heroNetSub}>
              {totals.pendingCount > 0
                ? 'Direct UPI • Cash Envelopes • Bank Transfer Settlement Ready'
                : 'All wages for this period have been fully settled.'}
            </Text>
          </View>

          {totals.pendingCount > 0 && (
            <TouchableOpacity
              style={styles.settleAllBtn}
              onPress={handleSettleAllPending}
              activeOpacity={0.85}
            >
              <MaterialIcons name="done-all" size={18} color="#FFFFFF" />
              <Text style={styles.settleAllBtnText}>{t('payroll.settleAllDue')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. SEARCH & STATUS FILTER ROW */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={`${t('common.search')}...`}
              placeholderTextColor={colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="cancel" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Status Filter Tabs */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'all' && styles.filterTabActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.filterTabText, statusFilter === 'all' && styles.filterTabTextActive]}>
              {t('workers.totalWorkers')} ({payrollSummaries.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'pending' && styles.filterTabActive]}
            onPress={() => setStatusFilter('pending')}
          >
            <View style={styles.dotPending} />
            <Text style={[styles.filterTabText, statusFilter === 'pending' && styles.filterTabTextActive]}>
              {t('payroll.pending')} ({totals.pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'settled' && styles.filterTabActive]}
            onPress={() => setStatusFilter('settled')}
          >
            <View style={styles.dotSettled} />
            <Text style={[styles.filterTabText, statusFilter === 'settled' && styles.filterTabTextActive]}>
              {t('payroll.settled')} ({totals.settledCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. WORKFORCE WAGE & DISBURSAL CARDS (UNCONGESTED & CLEAN) */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Calculating Cycle Wages & Advances...</Text>
          </View>
        ) : filteredSummaries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="payments" size={48} color={colors.borderDark} />
            <Text style={styles.emptyTitle}>No Matching Worker Payroll</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'No workers match your search query.'
                : 'No workers found for this cycle or site selection.'}
            </Text>
          </View>
        ) : (
          filteredSummaries.map((summary) => {
            const {
              worker,
              totalWorkDaysCredited,
              otHours,
              otPayment,
              grossWages,
              allWorkerAdvances,
              totalPendingAdvanceAmount,
              totalDeductedAdvanceAmount,
              totalSettledPaid,
              balanceDue,
              isFullySettled,
              isPartiallySettled,
              hasOutstandingAdvance,
              settlements,
            } = summary;

            const isExpanded = !!expandedAdvances[worker.id];
            const workerInitials = (worker.name || 'W')
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const lastSettlement = settlements.length > 0 ? settlements[settlements.length - 1] : null;

            return (
              <View key={worker.id} style={styles.entryCard}>
                {/* Worker Header */}
                <View style={styles.entryHeader}>
                  <View style={styles.workerAvatar}>
                    <Text style={styles.workerAvatarText}>{workerInitials}</Text>
                  </View>

                  <View style={styles.entryWorkerInfo}>
                    <View style={styles.workerTitleRow}>
                      <Text style={styles.entryWorkerName}>{worker.name}</Text>
                      <View style={styles.skillBadge}>
                        <Text style={styles.skillBadgeText}>
                          {(worker.skillLevel || 'LABOUR').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.entryMeta}>
                      Base ₹{worker.dailyWage || 0}/day • {worker.phone ? `+91 ${worker.phone}` : 'No Phone'}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  {isFullySettled ? (
                    <View style={[styles.statusBadge, styles.statusBadgePaid]}>
                      <Text style={[styles.statusBadgeText, styles.statusTextPaid]}>
                        {t('payroll.settled').toUpperCase()}
                      </Text>
                    </View>
                  ) : isPartiallySettled ? (
                    <View style={[styles.statusBadge, styles.statusBadgePartial]}>
                      <Text style={[styles.statusBadgeText, styles.statusTextPartial]}>
                        PARTIAL (₹{balanceDue.toLocaleString()} DUE)
                      </Text>
                    </View>
                  ) : hasOutstandingAdvance ? (
                    <View style={[styles.statusBadge, styles.statusBadgeAdvance]}>
                      <Text style={[styles.statusBadgeText, styles.statusTextAdvance]}>
                        ADVANCE OUTSTANDING
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, styles.statusBadgePending]}>
                      <Text style={[styles.statusBadgeText, styles.statusTextPending]}>
                        {t('payroll.pending').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Financial Breakdown Grid */}
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>{t('attendance.hours')}</Text>
                    <Text style={styles.breakdownVal}>{totalWorkDaysCredited} d</Text>
                    {summary.nightWorkDays > 0 && (
                      <Text style={styles.nightSub}>🌙 {summary.nightWorkDays}d night</Text>
                    )}
                  </View>

                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>{t('attendance.overtime')}</Text>
                    <Text style={[styles.breakdownVal, { color: colors.accent }]}>
                      {otHours} hrs
                    </Text>
                    <Text style={styles.breakdownSub}>+₹{otPayment}</Text>
                  </View>

                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>{t('payroll.grossWages')}</Text>
                    <Text style={styles.breakdownVal}>₹{grossWages.toLocaleString()}</Text>
                  </View>

                  {/* Deductions Cell (Advances + Mess) - Clickable to toggle details */}
                  <TouchableOpacity
                    style={[styles.breakdownItem, styles.advanceClickableItem]}
                    onPress={() => toggleAdvancesExpander(worker.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.breakdownLabel}>
                      {summary.totalMessDeduction > 0
                        ? (language === 'hi' ? 'कटौती (खर्चा+मेस)' : language === 'bn' ? 'কর্তন (খরচ+মেস)' : 'Deductions (Adv+Mess)')
                        : t('payroll.advancesDeducted')}
                    </Text>
                    <Text style={[styles.breakdownVal, { color: summary.totalPendingDeductions > 0 ? colors.error : colors.textMuted }]}>
                      {summary.totalPendingDeductions > 0 ? `-₹${summary.totalPendingDeductions.toLocaleString()}` : '₹0'}
                    </Text>
                    {summary.totalMessDeduction > 0 ? (
                      <View style={[styles.advCountBadge, { backgroundColor: '#FFEDD5' }]}>
                        <Text style={[styles.advCountBadgeText, { color: '#C2410C' }]}>
                          Mess: -₹{summary.totalMessDeduction} ▾
                        </Text>
                      </View>
                    ) : allWorkerAdvances.length > 0 ? (
                      <View style={styles.advCountBadge}>
                        <Text style={styles.advCountBadgeText}>{allWorkerAdvances.length} Recs ▾</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>

                  <View style={[styles.breakdownItem, styles.netPayCol]}>
                    <Text style={[styles.breakdownLabel, { fontWeight: '800', color: balanceDue > 0 ? colors.accentDark : '#166534' }]}>
                      {isFullySettled ? t('payroll.settled') : t('payroll.balanceDue')}
                    </Text>
                    <Text style={[styles.netPayVal, { color: balanceDue > 0 ? colors.accentDark : '#166534' }]}>
                      ₹{(balanceDue > 0 ? balanceDue : totalSettledPaid).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* 5. ITEMISED ADVANCES BREAKDOWN SECTION (CRITICAL USER REQUIREMENT) */}
                {isExpanded && (
                  <View style={styles.advancesDetailsCard}>
                    <View style={styles.advancesDetailsHeader}>
                      <View style={styles.advancesDetailsTitleRow}>
                        <MaterialIcons name="account-balance-wallet" size={16} color={colors.accent} />
                        <Text style={styles.advancesDetailsTitle}>
                          {t('payroll.kharchaHistory')} ({allWorkerAdvances.length})
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleAdvancesExpander(worker.id)}>
                        <Text style={styles.advancesDetailsClose}>{t('common.close')} ▲</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Dedicated Mess Kharcha Transparency Banner */}
                    {summary.totalMessDeduction > 0 && (
                      <View style={styles.messDeductionBanner}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <MaterialIcons name="restaurant" size={16} color="#EA580C" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.messDeductionBannerTitle}>
                              {language === 'hi'
                                ? `मेस / भोजन कटौती (${summary.messDaysCount} दिन × ₹${summary.messChargePerDay}/दिन)`
                                : language === 'bn'
                                ? `মেস / খাবার কর্তন (${summary.messDaysCount} দিন × ₹${summary.messChargePerDay}/দিন)`
                                : `Mess / Meal Deduction (${summary.messDaysCount} days @ ₹${summary.messChargePerDay}/d)`}
                            </Text>
                            <Text style={styles.messDeductionBannerSub}>
                              {language === 'hi'
                                ? `${summary.messDaysCount} चिह्नित दिन (उपस्थित, हाफ-डे, अनुपस्थित) • अचिह्नित दिन छोड़कर`
                                : language === 'bn'
                                ? `${summary.messDaysCount} চিহ্নিত দিন (উপস্থিতি, হাফ-ডে, অনুপস্থিত) • অচিহ্নিত দিন ব্যতীত`
                                : `${summary.messDaysCount} marked days (P: ${summary.presentDays}, Half: ${summary.halfDays}, A: ${summary.absentDays}) • Unmarked excluded`}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.messDeductionBannerAmt}>-₹{summary.totalMessDeduction.toLocaleString()}</Text>
                      </View>
                    )}

                    {allWorkerAdvances.length === 0 ? (
                      <Text style={styles.noAdvancesText}>No cash advances recorded for this worker.</Text>
                    ) : (
                      allWorkerAdvances.map((adv) => {
                        const isDeducted = adv.status === 'deducted';
                        return (
                          <View key={adv.id} style={styles.advanceItemRow}>
                            <View style={styles.advanceItemLeft}>
                              <View style={styles.advanceDateRow}>
                                <MaterialIcons name="event" size={13} color={colors.textMuted} />
                                <Text style={styles.advanceItemDate}>
                                  {formatReadableDate(adv.date)}
                                </Text>
                                <View
                                  style={[
                                    styles.advStatusTag,
                                    isDeducted ? styles.advStatusTagDeducted : styles.advStatusTagPending,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.advStatusTagText,
                                      isDeducted ? styles.advStatusTextDeducted : styles.advStatusTextPending,
                                    ]}
                                  >
                                    {isDeducted ? 'DEDUCTED IN SETTLEMENT' : 'PENDING DEDUCTION'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.advanceItemReason}>
                                Purpose: "{adv.reason || 'General Kharcha'}"
                              </Text>
                            </View>

                            <View style={styles.advanceItemRight}>
                              <Text
                                style={[
                                  styles.advanceItemAmount,
                                  isDeducted ? { color: colors.textMuted } : { color: colors.error },
                                ]}
                              >
                                ₹{Number(adv.amount || 0).toLocaleString()}
                              </Text>

                              {!isDeducted && (
                                <TouchableOpacity
                                  style={styles.deleteAdvBtn}
                                  onPress={() => handleDeleteAdvance(adv.id, worker.name, Number(adv.amount || 0))}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <MaterialIcons name="delete-outline" size={16} color={colors.error} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* Prior Settlement Audit Tag if any */}
                {totalSettledPaid > 0 && (
                  <View style={styles.settlementAuditBox}>
                    <View style={styles.settlementAuditLeft}>
                      <MaterialIcons name="check-circle" size={14} color={colors.success} />
                      <Text style={styles.settlementAuditText}>
                        Already Disbursed: <Text style={{ fontWeight: '800' }}>₹{totalSettledPaid.toLocaleString()}</Text>
                        {lastSettlement ? ` (Last: ${formatReadableDate(lastSettlement.settledAt.slice(0, 10))} via ${lastSettlement.method})` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.revertBtn}
                      onPress={() => handleRevertLastSettlement(summary)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.revertBtnText}>Revert</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Outstanding Advance Warning Banner */}
                {hasOutstandingAdvance && (
                  <View style={styles.outstandingAdvanceBanner}>
                    <MaterialIcons name="info" size={15} color={colors.warningDark} />
                    <Text style={styles.outstandingAdvanceText}>
                      Worker has ₹{(totalPendingAdvanceAmount - summary.netPayableBeforeAdvances).toLocaleString()} outstanding advance exceeding current wages. Will be adjusted against future attendance.
                    </Text>
                  </View>
                )}

                {/* Action Buttons Row */}
                <View style={styles.entryActionRow}>
                  {isFullySettled || (balanceDue === 0 && totalPendingAdvanceAmount === 0) ? (
                    <View style={styles.fullySettledBanner}>
                      <MaterialIcons name="verified" size={16} color={colors.successDark} />
                      <Text style={styles.fullySettledText}>
                        All wages for this period settled.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.actionButtonsGroup}>
                      {/* Direct UPI Payment Shortcut */}
                      {balanceDue > 0 && (
                        <TouchableOpacity
                          style={[
                            styles.quickUpiBtn,
                            !summary.worker.upiId && { backgroundColor: '#64748B' }
                          ]}
                          onPress={() => handleLaunchUpi(summary)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="bolt" size={16} color="#FFFFFF" />
                          <Text style={styles.quickUpiBtnText}>Pay UPI (₹{balanceDue.toLocaleString()})</Text>
                        </TouchableOpacity>
                      )}

                      {/* Open Settle & Record Modal - Only show if there is a balance due OR pending advances to deduct */}
                      {(balanceDue > 0 || totalPendingAdvanceAmount > 0) && (
                        <TouchableOpacity
                          style={[styles.settleBtn, balanceDue === 0 ? { backgroundColor: colors.accent } : null]}
                          onPress={() => handleOpenSettleModal(summary)}
                          activeOpacity={0.85}
                        >
                          <MaterialIcons name="check" size={16} color="#FFFFFF" />
                          <Text style={styles.settleBtnText}>
                            {isPartiallySettled
                              ? `Disburse Remaining ₹${balanceDue.toLocaleString()}`
                              : balanceDue > 0
                              ? `Disburse ₹${balanceDue.toLocaleString()}`
                              : `Mark Advance Deducted (₹${totalPendingAdvanceAmount.toLocaleString()})`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ==========================================
          5. SETTLE & DISBURSE MODAL
          ========================================== */}
      <Modal
        visible={!!settleTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setSettleTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('payroll.settleWorker')}</Text>
                <Text style={styles.modalSubtitle}>
                  {settleTarget?.worker.name} • {settleTarget?.worker.phone || '-'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSettleTarget(null)}>
                <MaterialIcons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Amount Banner */}
            <View style={styles.settleAmountBanner}>
              <Text style={styles.settleAmountLabel}>
                {settleTarget?.isPartiallySettled ? t('payroll.balanceDue').toUpperCase() : t('payroll.netDisbursable').toUpperCase()}
              </Text>
              <Text style={styles.settleAmountVal}>
                ₹{settleTarget ? settleTarget.balanceDue.toLocaleString() : '0'}
              </Text>
              <Text style={styles.settleAmountSub}>
                {t('payroll.cyclePeriod')}: {startDate} {t('common.to')} {endDate} ({settleTarget?.totalWorkDaysCredited || 0} {t('attendance.hours')})
                {settleTarget && settleTarget.totalSettledPaid > 0
                  ? ` • ₹${settleTarget.totalSettledPaid.toLocaleString()} ${t('payroll.settled')}`
                  : ''}
              </Text>
            </View>

            {/* Advances Deduction Preview */}
            {settleTarget && settleTarget.pendingAdvances.length > 0 && (
              <View style={styles.settleAdvPreviewBox}>
                <Text style={styles.settleAdvPreviewTitle}>
                  {t('payroll.advancesDeducted')} ({settleTarget.pendingAdvances.length}):
                </Text>
                {settleTarget.pendingAdvances.map((adv) => (
                  <View key={adv.id} style={styles.settleAdvPreviewRow}>
                    <Text style={styles.settleAdvPreviewText}>
                      • {formatReadableDate(adv.date)}: {adv.reason || 'Kharcha'}
                    </Text>
                    <Text style={styles.settleAdvPreviewAmt}>-₹{Number(adv.amount).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Mess Deduction Preview */}
            {settleTarget && settleTarget.totalMessDeduction > 0 && (
              <View style={[styles.settleAdvPreviewBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.settleAdvPreviewTitle, { color: '#C2410C' }]}>
                    {language === 'hi' ? 'मेस कटौती / Mess Deduction:' : language === 'bn' ? 'মেস কর্তন / Mess Deduction:' : 'Mess & Food Deduction:'}
                  </Text>
                  <Text style={[styles.settleAdvPreviewAmt, { color: '#C2410C' }]}>-₹{settleTarget.totalMessDeduction.toLocaleString()}</Text>
                </View>
                <Text style={{ fontSize: 10, color: '#9A3412', marginTop: 3 }}>
                  {language === 'hi'
                    ? `${settleTarget.messDaysCount} चिह्नित दिन (उपस्थित, हाफ-डे, अनुपस्थित) × ₹${settleTarget.messChargePerDay}/दिन • अचिह्नित दिन मुक्त`
                    : language === 'bn'
                    ? `${settleTarget.messDaysCount} চিহ্নিত দিন (উপস্থিতি, হাফ-ডে, অনুপস্থিত) × ₹${settleTarget.messChargePerDay}/দিন • অচিহ্নিত দিন ব্যতীত`
                    : `${settleTarget.messDaysCount} marked days (P: ${settleTarget.presentDays}, Half: ${settleTarget.halfDays}, A: ${settleTarget.absentDays}) @ ₹${settleTarget.messChargePerDay}/d`}
                </Text>
              </View>
            )}

            {/* Payment Method Selector */}
            <Text style={styles.inputSectionLabel}>{t('common.actions')} *</Text>
            <View style={styles.methodRow}>
              {(['UPI', 'Cash', 'Bank Transfer'] as const).map((method) => {
                const active = settleMethod === method;
                const methodLabel = method === 'UPI' ? 'UPI' : method === 'Cash' ? t('payroll.cashDisbursement') : 'Bank';
                return (
                  <TouchableOpacity
                    key={method}
                    style={[styles.methodBtn, active && styles.methodBtnActive]}
                    onPress={() => setSettleMethod(method)}
                  >
                    <MaterialIcons
                      name={method === 'UPI' ? 'bolt' : method === 'Cash' ? 'attach-money' : 'account-balance'}
                      size={18}
                      color={active ? '#FFFFFF' : colors.textMuted}
                    />
                    <Text style={[styles.methodBtnText, active && styles.methodBtnTextActive]}>
                      {methodLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* UPI Status / Registration Indicator inside Settle Modal */}
            {settleMethod === 'UPI' && (
              <View
                style={[
                  styles.settleAdvPreviewBox,
                  settleTarget?.worker.upiId
                    ? { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }
                    : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                  { marginTop: 4, marginBottom: 10 },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <MaterialIcons
                      name={settleTarget?.worker.upiId ? 'verified' : 'error-outline'}
                      size={16}
                      color={settleTarget?.worker.upiId ? colors.successDark : colors.error}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: settleTarget?.worker.upiId ? colors.successDark : colors.error,
                      }}
                    >
                      {settleTarget?.worker.upiId
                        ? `UPI ID: ${settleTarget.worker.upiId}`
                        : t('payroll.upiNotRegistered')}
                    </Text>
                  </View>
                  {settleTarget?.worker.upiId && (
                    <TouchableOpacity
                      onPress={() => handleLaunchUpi(settleTarget)}
                      style={{
                        backgroundColor: '#166534',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: radii.sm,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                        Pay UPI ↗
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!settleTarget?.worker.upiId && (
                  <Text style={{ fontSize: 9.5, color: colors.error, marginTop: 3 }}>
                    {t('payroll.upiNotRegisteredDesc')}
                  </Text>
                )}
              </View>
            )}

            {/* Transaction Ref / Receipt Input */}
            <Text style={styles.inputSectionLabel}>{t('payroll.settlementReceipt')} ({t('common.optional')})</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={
                settleMethod === 'UPI'
                  ? 'e.g. UTR 4293810293'
                  : settleMethod === 'Cash'
                  ? 'e.g. Cash voucher signed by worker'
                  : 'e.g. NEFT Reference number'
              }
              placeholderTextColor={colors.textLight}
              value={settleRef}
              onChangeText={setSettleRef}
            />

            {/* Confirm Disbursal Button */}
            <TouchableOpacity
              style={styles.confirmSettleBtn}
              onPress={handleConfirmSettle}
              disabled={processingSettle}
              activeOpacity={0.85}
            >
              {processingSettle ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmSettleBtnText}>
                  {t('payroll.settleWorker')} (₹{settleTarget ? settleTarget.balanceDue.toLocaleString() : '0'})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          6. ISSUE ADVANCE MODAL (WITH DROPDOWN)
          ========================================== */}
      <Modal
        visible={showAdvanceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdvanceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('payroll.giveAdvance')}</Text>
                <Text style={styles.modalSubtitle}>
                  {language === 'hi' ? 'बहीखाते में दर्ज और मजदूरी निपटान में काटा जाएगा' :
                   language === 'bn' ? 'খতিয়ানে রেকর্ড এবং মজুরি নিষ্পত্তিতে কাটা হবে' :
                   'Recorded in ledger & deducted in wage settlements'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAdvanceModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Worker Selector Dropdown Trigger */}
            <Text style={styles.inputSectionLabel}>{t('payroll.selectWorker')} *</Text>
            <TouchableOpacity
              style={[styles.dropdownTrigger, advWorkerDropdownOpen && styles.dropdownTriggerActive]}
              onPress={() => setAdvWorkerDropdownOpen(!advWorkerDropdownOpen)}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownTriggerLeft}>
                <MaterialIcons
                  name="person"
                  size={20}
                  color={selectedAdvWorker ? colors.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.dropdownTriggerText,
                    selectedAdvWorker ? styles.dropdownTriggerTextSelected : null,
                  ]}
                  numberOfLines={1}
                >
                  {selectedAdvWorker
                    ? `${selectedAdvWorker.name} (Base ₹${selectedAdvWorker.dailyWage || 0}/d • ${(selectedAdvWorker.skillLevel || 'Labour').toUpperCase()}${selectedAdvWorker.upiId ? ` • ⚡ ${selectedAdvWorker.upiId}` : ''})`
                    : t('payroll.selectWorkerPlaceholder')}
                </Text>
              </View>
              <MaterialIcons
                name={advWorkerDropdownOpen ? 'expand-less' : 'expand-more'}
                size={22}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {/* Dropdown Menu Popup Box */}
            {advWorkerDropdownOpen && (
              <View style={styles.dropdownMenuBox}>
                <View style={styles.dropdownSearchRow}>
                  <MaterialIcons name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.dropdownSearchInput}
                    placeholder={`${t('common.search')}...`}
                    placeholderTextColor={colors.textLight}
                    value={advWorkerSearch}
                    onChangeText={setAdvWorkerSearch}
                    autoFocus
                  />
                  {advWorkerSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setAdvWorkerSearch('')}>
                      <MaterialIcons name="close" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={styles.dropdownListScroll} nestedScrollEnabled>
                  {dropdownFilteredWorkers.length === 0 ? (
                    <Text style={styles.dropdownEmptyText}>{t('workers.noWorkersFound')}</Text>
                  ) : (
                    dropdownFilteredWorkers.map((w) => {
                      const isSelected = advWorkerId === w.id;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                          onPress={() => {
                            setAdvWorkerId(w.id);
                            setAdvWorkerDropdownOpen(false);
                            setAdvWorkerSearch('');
                          }}
                        >
                          <View>
                            <Text style={[styles.dropdownItemName, isSelected && styles.dropdownItemNameActive]}>
                              {w.name}
                            </Text>
                            <Text style={styles.dropdownItemSub}>
                              Base ₹{w.dailyWage || 0}/d • {(w.skillLevel || 'Labour').toUpperCase()}{w.upiId ? ` • ⚡ ${w.upiId}` : ''}
                            </Text>
                          </View>
                          {isSelected && (
                            <MaterialIcons name="check" size={18} color={colors.accent} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}

            {/* Quick Amount Chips */}
            <Text style={styles.inputSectionLabel}>{t('payroll.advanceAmount')} (₹) *</Text>
            <View style={styles.quickAmountRow}>
              {quickAdvanceAmounts.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickAmountChip}
                  onPress={() => setAdvAmount(String(amt))}
                >
                  <Text style={styles.quickAmountText}>+₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder={t('payroll.advanceAmountPlaceholder')}
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
              value={advAmount}
              onChangeText={setAdvAmount}
            />

            {/* Quick Reason Suggestions */}
            <Text style={styles.inputSectionLabel}>{t('payroll.reason')}</Text>
            <View style={styles.quickReasonRow}>
              {quickAdvanceReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.quickReasonChip}
                  onPress={() => setAdvReason(reason)}
                >
                  <Text style={styles.quickReasonText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder={t('payroll.reasonPlaceholder')}
              placeholderTextColor={colors.textLight}
              value={advReason}
              onChangeText={setAdvReason}
            />

            <TouchableOpacity
              style={styles.confirmSettleBtn}
              onPress={handleGiveAdvance}
              disabled={submittingAdvance}
              activeOpacity={0.85}
            >
              {submittingAdvance ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmSettleBtnText}>{t('payroll.giveAdvance')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          ADVANCE & KHARCHA HISTORY FULL MODAL
          ========================================== */}
      <Modal
        visible={showAdvanceHistory}
        animationType="slide"
        onRequestClose={() => setShowAdvanceHistory(false)}
      >
        <SafeAreaView style={styles.historyContainer} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.historyHeader}>
            <TouchableOpacity
              style={styles.historyBackBtn}
              onPress={() => setShowAdvanceHistory(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.historyHeaderTitleBox}>
              <Text style={styles.historyHeaderTitle}>{t('payroll.advanceHistory')}</Text>
              <Text style={styles.historyHeaderSubtitle}>
                {currentSiteName} • {formatReadableDate(advStartDate)} {t('common.to')} {formatReadableDate(advEndDate)}
              </Text>
            </View>

            <View style={styles.historyHeaderRightActions}>
              <TouchableOpacity
                style={styles.historyIconBtn}
                onPress={handleShareAdvanceHistoryPdf}
                disabled={sharingHistoryPdf || generatingHistoryPdf}
                activeOpacity={0.7}
              >
                {sharingHistoryPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="share" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.historyIconBtn}
                onPress={handleDownloadAdvanceHistoryPdf}
                disabled={generatingHistoryPdf || sharingHistoryPdf}
                activeOpacity={0.7}
              >
                {generatingHistoryPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="print" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.historyGiveAdvBtn}
                onPress={() => {
                  setAdvWorkerId('');
                  setAdvWorkerDropdownOpen(false);
                  setAdvAmount('');
                  setAdvReason('');
                  setShowAdvanceModal(true);
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.historyGiveAdvText}>+ {t('payroll.giveAdvance')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Time Period Filter Bar (Presets & Custom Date Picker) */}
          <View style={styles.historyPeriodBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyPresetScroll}
            >
              <TouchableOpacity
                style={[styles.historyPresetChip, advRangePreset === 'this-month' && styles.historyPresetChipActive]}
                onPress={() => handleSelectAdvPreset('this-month')}
              >
                <Text style={[styles.historyPresetChipText, advRangePreset === 'this-month' && styles.historyPresetChipTextActive]}>
                  {t('common.thisMonth')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.historyPresetChip, advRangePreset === 'this-week' && styles.historyPresetChipActive]}
                onPress={() => handleSelectAdvPreset('this-week')}
              >
                <Text style={[styles.historyPresetChipText, advRangePreset === 'this-week' && styles.historyPresetChipTextActive]}>
                  {t('common.thisWeek')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.historyPresetChip, advRangePreset === 'last-month' && styles.historyPresetChipActive]}
                onPress={() => handleSelectAdvPreset('last-month')}
              >
                <Text style={[styles.historyPresetChipText, advRangePreset === 'last-month' && styles.historyPresetChipTextActive]}>
                  {t('common.previousMonth')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.historyPresetChip, advRangePreset === 'last-30' && styles.historyPresetChipActive]}
                onPress={() => handleSelectAdvPreset('last-30')}
              >
                <Text style={[styles.historyPresetChipText, advRangePreset === 'last-30' && styles.historyPresetChipTextActive]}>
                  {t('common.last30Days')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.historyPresetChip, advRangePreset === 'custom' && styles.historyPresetChipActive]}
                onPress={() => handleOpenAdvDatePicker('start')}
              >
                <MaterialIcons
                  name="date-range"
                  size={12}
                  color={advRangePreset === 'custom' ? '#FFFFFF' : '#94A3B8'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.historyPresetChipText, advRangePreset === 'custom' && styles.historyPresetChipTextActive]}>
                  Custom Range
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Custom Date Pickers Display Bar */}
            <View style={styles.historyCustomDateRow}>
              <TouchableOpacity
                style={[styles.historyDateBtn, advRangePreset === 'custom' && styles.historyDateBtnActive]}
                onPress={() => handleOpenAdvDatePicker('start')}
                activeOpacity={0.7}
              >
                <MaterialIcons name="calendar-today" size={13} color={colors.accent} />
                <Text style={styles.historyDateLabel}>FROM:</Text>
                <Text style={styles.historyDateVal}>{advStartDate}</Text>
              </TouchableOpacity>

              <MaterialIcons name="arrow-forward" size={14} color="#64748B" />

              <TouchableOpacity
                style={[styles.historyDateBtn, advRangePreset === 'custom' && styles.historyDateBtnActive]}
                onPress={() => handleOpenAdvDatePicker('end')}
                activeOpacity={0.7}
              >
                <MaterialIcons name="calendar-today" size={13} color={colors.accent} />
                <Text style={styles.historyDateLabel}>TO:</Text>
                <Text style={styles.historyDateVal}>{advEndDate}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Financial Summary Bento Strip */}
          <View style={styles.historyMetricsRow}>
            <View style={styles.historyMetricCard}>
              <Text style={styles.historyMetricLabel}>TOTAL ADVANCES</Text>
              <Text style={styles.historyMetricVal}>₹{historyMetrics.totalAmount.toLocaleString()}</Text>
              <Text style={styles.historyMetricSub}>{historyMetrics.totalCount} Records</Text>
            </View>

            <View style={[styles.historyMetricCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <Text style={[styles.historyMetricLabel, { color: '#C2410C' }]}>PENDING DEDUCTION</Text>
              <Text style={[styles.historyMetricVal, { color: colors.error }]}>
                ₹{historyMetrics.totalPendingAmt.toLocaleString()}
              </Text>
              <Text style={[styles.historyMetricSub, { color: '#C2410C' }]}>
                {historyMetrics.pendingCount} Pending
              </Text>
            </View>

            <View style={[styles.historyMetricCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[styles.historyMetricLabel, { color: colors.successDark }]}>DEDUCTED</Text>
              <Text style={[styles.historyMetricVal, { color: colors.successDark }]}>
                ₹{historyMetrics.totalDeductedAmt.toLocaleString()}
              </Text>
              <Text style={[styles.historyMetricSub, { color: colors.successDark }]}>
                {historyMetrics.deductedCount} Settled
              </Text>
            </View>
          </View>

          {/* Search Row */}
          <View style={styles.historySearchBox}>
            <MaterialIcons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.historySearchInput}
              placeholder="Search by worker name, phone, trade or reason..."
              placeholderTextColor={colors.textLight}
              value={historySearchQuery}
              onChangeText={setHistorySearchQuery}
            />
            {historySearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setHistorySearchQuery('')}>
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <View style={styles.historyFilterRow}>
            <TouchableOpacity
              style={[styles.historyFilterPill, historyStatusFilter === 'all' && styles.historyFilterPillActive]}
              onPress={() => setHistoryStatusFilter('all')}
            >
              <Text style={[styles.historyFilterPillText, historyStatusFilter === 'all' && styles.historyFilterPillTextActive]}>
                All ({historyMetrics.totalCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.historyFilterPill, historyStatusFilter === 'pending' && styles.historyFilterPillActive]}
              onPress={() => setHistoryStatusFilter('pending')}
            >
              <Text style={[styles.historyFilterPillText, historyStatusFilter === 'pending' && styles.historyFilterPillTextActive]}>
                Pending Deduction ({historyMetrics.pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.historyFilterPill, historyStatusFilter === 'deducted' && styles.historyFilterPillActive]}
              onPress={() => setHistoryStatusFilter('deducted')}
            >
              <Text style={[styles.historyFilterPillText, historyStatusFilter === 'deducted' && styles.historyFilterPillTextActive]}>
                Deducted ({historyMetrics.deductedCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable List of Advance Cards */}
          <ScrollView
            style={styles.historyScroll}
            contentContainerStyle={styles.historyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {historyFilteredAdvances.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="account-balance-wallet" size={48} color={colors.borderDark} />
                <Text style={styles.emptyTitle}>No Advances Found</Text>
                <Text style={styles.emptySubtitle}>
                  {historySearchQuery
                    ? 'No advances match your search.'
                    : 'No advance records found for this period or filter.'}
                </Text>
              </View>
            ) : (
              historyFilteredAdvances.map(renderAdvanceCard)
            )}
          </ScrollView>

          {/* Bottom Action Bar for Download & Share PDF */}
          <View style={styles.historyBottomBar}>
            <TouchableOpacity
              style={styles.historyBottomDownloadBtn}
              onPress={handleDownloadAdvanceHistoryPdf}
              disabled={generatingHistoryPdf || sharingHistoryPdf}
              activeOpacity={0.85}
            >
              {generatingHistoryPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="file-download" size={18} color="#FFFFFF" />
                  <Text style={styles.historyBottomDownloadText}>Download PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.historyBottomShareBtn}
              onPress={handleShareAdvanceHistoryPdf}
              disabled={sharingHistoryPdf || generatingHistoryPdf}
              activeOpacity={0.85}
            >
              {sharingHistoryPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="share" size={18} color="#FFFFFF" />
                  <Text style={styles.historyBottomShareText}>Share PDF Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* iOS DateTimePicker Modal */}
      {Platform.OS === 'ios' && pickerTarget && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setPickerTarget(null)}
        >
          <View style={styles.iosPickerOverlay}>
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setPickerTarget(null)}>
                  <Text style={styles.iosPickerCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.iosPickerTitle}>
                  {language === 'hi' ? 'तारीख चुनें' : language === 'bn' ? 'তারিখ নির্বাচন করুন' : `Select ${pickerTarget === 'start' || pickerTarget === 'adv-start' ? 'Start' : 'End'} Date`}
                </Text>
                <TouchableOpacity onPress={() => setPickerTarget(null)}>
                  <Text style={styles.iosPickerDone}>{t('common.confirm')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempPickerDate}
                mode="date"
                display="spinner"
                onChange={handleIOSDateChange}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitleBox: {
    flex: 1,
    marginRight: 8,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerAdvanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  advanceHistoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#334155',
    ...shadows.sm,
  },
  advanceHistoryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  giveAdvanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  giveAdvanceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  presetScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  customDateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePickerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  datePickerVal: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  siteScroll: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  sitePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sitePillActive: {
    backgroundColor: '#334155',
    borderColor: colors.accent,
  },
  sitePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  sitePillTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  bentoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  bentoCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  bentoIconBox: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bentoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  bentoVal: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginVertical: 1,
  },
  bentoSub: {
    fontSize: 9,
    color: colors.textLight,
  },
  heroNetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: 14,
    ...shadows.card,
  },
  heroNetLeft: {
    flex: 1,
    minWidth: 160,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroNetLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  pendingBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.xs,
  },
  pendingBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.accent,
  },
  heroNetValue: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginVertical: 1,
  },
  heroNetSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  settleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 40,
    borderRadius: radii.md,
  },
  settleAllBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  searchRow: {
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    marginLeft: 8,
    padding: 0,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  dotPending: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
    marginRight: 6,
  },
  dotSettled: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...shadows.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  workerAvatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  entryWorkerInfo: {
    flex: 1,
  },
  workerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryWorkerName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  skillBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  skillBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
  },
  entryMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  statusBadgePaid: {
    backgroundColor: colors.successLight,
  },
  statusBadgePartial: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgePending: {
    backgroundColor: '#FFF7ED',
  },
  statusBadgeAdvance: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusTextPaid: {
    color: colors.successDark,
  },
  statusTextPartial: {
    color: colors.warningDark,
  },
  statusTextPending: {
    color: colors.accent,
  },
  statusTextAdvance: {
    color: colors.error,
  },
  breakdownRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 8,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  advanceClickableItem: {
    backgroundColor: '#FEF2F2',
    borderRadius: radii.sm,
    paddingVertical: 2,
  },
  advCountBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: radii.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
  },
  advCountBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.error,
  },
  breakdownLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 2,
    textAlign: 'center',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  breakdownSub: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 1,
  },
  nightSub: {
    fontSize: 8,
    color: '#6366F1',
    fontWeight: '700',
    marginTop: 1,
  },
  netPayCol: {
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    paddingLeft: 4,
  },
  netPayVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  advancesDetailsCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
    padding: 10,
  },
  advancesDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    marginBottom: 6,
  },
  advancesDetailsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  advancesDetailsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.error,
  },
  advancesDetailsClose: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  messDeductionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  messDeductionBannerTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#C2410C',
  },
  messDeductionBannerSub: {
    fontSize: 9.5,
    color: '#9A3412',
    marginTop: 1,
  },
  messDeductionBannerAmt: {
    fontSize: 12,
    fontWeight: '900',
    color: '#C2410C',
    marginLeft: 6,
  },
  noAdvancesText: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 6,
  },
  advanceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  advanceItemLeft: {
    flex: 1,
    marginRight: 6,
  },
  advanceDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  advanceItemDate: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.text,
  },
  advStatusTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.xs,
    marginLeft: 4,
  },
  advStatusTagPending: {
    backgroundColor: '#FFFBEB',
  },
  advStatusTagDeducted: {
    backgroundColor: '#ECFDF5',
  },
  advStatusTagText: {
    fontSize: 7.5,
    fontWeight: '800',
  },
  advStatusTextPending: {
    color: colors.warningDark,
  },
  advStatusTextDeducted: {
    color: colors.successDark,
  },
  advanceItemReason: {
    fontSize: 9.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  advanceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  advanceItemAmount: {
    fontSize: 12,
    fontWeight: '900',
  },
  deleteAdvBtn: {
    padding: 2,
  },
  settlementAuditBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  settlementAuditLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  settlementAuditText: {
    fontSize: 9.5,
    color: '#166534',
    flex: 1,
  },
  revertBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  revertBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
    textDecorationLine: 'underline',
  },
  outstandingAdvanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    gap: 4,
  },
  outstandingAdvanceText: {
    fontSize: 9.5,
    color: colors.error,
    flex: 1,
    fontWeight: '600',
  },
  entryActionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fullySettledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  fullySettledText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successDark,
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  quickUpiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  quickUpiBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  settleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  settleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  settleAmountBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  settleAmountLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  settleAmountVal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#166534',
    marginVertical: 2,
  },
  settleAmountSub: {
    fontSize: 10,
    color: '#166534',
    textAlign: 'center',
  },
  settleAdvPreviewBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radii.md,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  settleAdvPreviewTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.error,
    marginBottom: 4,
  },
  settleAdvPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  settleAdvPreviewText: {
    fontSize: 9.5,
    color: colors.text,
  },
  settleAdvPreviewAmt: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.error,
  },
  inputSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 10,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  methodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  methodBtnTextActive: {
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmSettleBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...shadows.hero,
  },
  confirmSettleBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownTriggerActive: {
    borderColor: colors.accent,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  dropdownTriggerText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dropdownTriggerTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  dropdownMenuBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginTop: 6,
    padding: 8,
    ...shadows.md,
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    gap: 6,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 11,
    color: colors.text,
    padding: 0,
  },
  dropdownListScroll: {
    maxHeight: 150,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: '#FFEDD5',
    borderRadius: radii.xs,
  },
  dropdownItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  dropdownItemNameActive: {
    color: colors.accentDark,
    fontWeight: '800',
  },
  dropdownItemSub: {
    fontSize: 9.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  dropdownEmptyText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    paddingVertical: 16,
  },
  quickAmountRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  quickAmountChip: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  quickReasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickReasonChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickReasonText: {
    fontSize: 9.5,
    color: colors.text,
    fontWeight: '600',
  },
  iosPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  iosPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 20,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  iosPickerCancel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  iosPickerDone: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  // Advance Card Styles
  advanceEntryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
    ...shadows.sm,
  },
  advanceEntryCardDeducted: {
    borderLeftColor: '#94A3B8',
    backgroundColor: '#F8FAFC',
  },
  advEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  advAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    marginRight: 10,
  },
  advAvatarText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#EA580C',
  },
  advWorkerMeta: {
    flex: 1,
  },
  advNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  advWorkerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.text,
  },
  advSkillBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  advSkillBadgeText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  advContactText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1.5,
  },
  advAmountBox: {
    alignItems: 'flex-end',
  },
  advAmountVal: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.error,
  },
  advAmountSub: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  advBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: radii.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  advDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  advDateText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.text,
  },
  advReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  advReasonText: {
    fontSize: 10.5,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  advFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
  },
  advStatusPending: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  advStatusDeducted: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  advStatusText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  advCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  advDeleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  advDeleteActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  advUpiActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: '#16A34A',
    ...shadows.sm,
  },
  advUpiActionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionHeaderTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  viewAllAdvLink: {
    paddingVertical: 2,
  },
  viewAllAdvLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  newAdvMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  newAdvMiniBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  allAdvancesSectionBox: {
    marginBottom: 12,
    paddingBottom: 6,
  },
  bentoCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: '#FFF7ED',
  },
  // Dedicated Advance History Modal Styles
  historyContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.card,
  },
  historyBackBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyHeaderTitleBox: {
    flex: 1,
  },
  historyHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  historyHeaderSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  historyGiveAdvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  historyGiveAdvText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 3,
  },
  historyPeriodBar: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  historyPresetScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  historyPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyPresetChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  historyPresetChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  historyPresetChipTextActive: {
    color: '#FFFFFF',
  },
  historyCustomDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
  },
  historyDateBtnActive: {
    backgroundColor: '#334155',
  },
  historyDateLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
  },
  historyDateVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.accent,
  },
  historyMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  historyMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...shadows.sm,
  },
  historyMetricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  historyMetricVal: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  historyMetricSub: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 1,
  },
  historySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historySearchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    marginLeft: 8,
  },
  historyFilterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  historyFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyFilterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  historyFilterPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
  },
  historyFilterPillTextActive: {
    color: '#FFFFFF',
  },
  historyScroll: {
    flex: 1,
  },
  historyScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  historyHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyIconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyBottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.card,
  },
  historyBottomDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: radii.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyBottomDownloadText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  historyBottomShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.md,
    gap: 6,
    ...shadows.sm,
  },
  historyBottomShareText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
