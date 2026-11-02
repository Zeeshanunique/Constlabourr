import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { projectId } from '@/utils/supabase/info';
import { colors, shadows, radii } from '@/styles/theme';
import { Worker, Site } from './WorkerDetailView';
import { useTranslation } from '@/i18n';

interface AttendanceRecord {
  id?: string;
  workerId: string;
  workerName?: string;
  siteId?: string;
  date: string;
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

interface WorkerReportViewProps {
  worker: Worker;
  siteName: string;
  accessToken?: string;
  sites: Site[];
  onBack: () => void;
  initialMonth?: number; // 0-11
  initialYear?: number;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export function WorkerReportView({
  worker,
  siteName,
  accessToken,
  onBack,
  initialMonth,
  initialYear,
}: WorkerReportViewProps) {
  const { t, language } = useTranslation();
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);

  const nowYear = initialYear ?? today.getFullYear();
  const nowMonth = initialMonth ?? today.getMonth();

  // Presets: 'this-week' | 'this-month' | 'last-month' | 'last-30' | 'custom'
  const [rangePreset, setRangePreset] = useState<'this-week' | 'this-month' | 'last-month' | 'last-30' | 'custom'>('this-month');

  // Start Date and End Date (YYYY-MM-DD)
  const defaultStart = useMemo(() => {
    return `${nowYear}-${String(nowMonth + 1).padStart(2, '0')}-01`;
  }, [nowYear, nowMonth]);

  const defaultEnd = useMemo(() => {
    const daysInM = new Date(nowYear, nowMonth + 1, 0).getDate();
    return `${nowYear}-${String(nowMonth + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
  }, [nowYear, nowMonth]);

  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);

  // Data State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [advancesList, setAdvancesList] = useState<AdvanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // PDF Export State
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [sharingPdf, setSharingPdf] = useState<boolean>(false);

  // Date picker state for iOS/fallback
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [tempPickerDate, setTempPickerDate] = useState<Date>(new Date());

  // Hardware Back Handler
  useEffect(() => {
    const handleHardwareBack = () => {
      onBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => sub.remove();
  }, [onBack]);

  // Load Data on date range change
  useEffect(() => {
    loadReportData();
  }, [worker.id, startDate, endDate]);

  const loadReportData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      // 1. Fetch attendance records in date range
      const attRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?workerId=${worker.id}&startDate=${startDate}&endDate=${endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const attData = await attRes.json();
      setAttendanceRecords(attData.attendance || []);

      // 2. Fetch advances in date range
      const advRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances?workerId=${worker.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const advData = await advRes.json();
      const allAdv: AdvanceRecord[] = advData.advances || [];
      const filteredAdv = allAdv.filter(
        (a) => a.date && a.date >= startDate && a.date <= endDate
      );
      setAdvancesList(filteredAdv);
    } catch (err) {
      console.error('Error loading report data:', err);
      Toast.show({ type: 'error', text1: 'Network Error', text2: 'Could not fetch report data' });
    } finally {
      setLoading(false);
    }
  };

  // Preset Handlers (including 'this-week')
  const handleSelectPreset = (preset: 'this-week' | 'this-month' | 'last-month' | 'last-30' | 'custom') => {
    setRangePreset(preset);
    const curr = new Date();

    if (preset === 'this-week') {
      const day = curr.getDay(); // 0 is Sun, 1 is Mon...
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

  // Open Date Picker
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
              if (formatted > endDate) {
                setEndDate(formatted);
              }
              setStartDate(formatted);
            } else {
              if (formatted < startDate) {
                setStartDate(formatted);
              }
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

  const handleIOSDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      const formatted = formatDateKey(selectedDate);
      setRangePreset('custom');
      if (pickerTarget === 'start') {
        if (formatted > endDate) {
          setEndDate(formatted);
        }
        setStartDate(formatted);
      } else if (pickerTarget === 'end') {
        if (formatted < startDate) {
          setStartDate(formatted);
        }
        setEndDate(formatted);
      }
    }
    setPickerTarget(null);
  };

  // Generate All Dates in Selected Range
  const daysInRange = useMemo(() => {
    const list: { dateStr: string; dayNum: number; dayName: string }[] = [];
    if (!startDate || !endDate) return list;

    const startParts = startDate.split('-').map(Number);
    const endParts = endDate.split('-').map(Number);
    const current = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

    while (current <= end) {
      const dateStr = formatDateKey(current);
      list.push({
        dateStr,
        dayNum: current.getDate(),
        dayName: DAY_NAMES[current.getDay()],
      });
      current.setDate(current.getDate() + 1);
    }
    return list;
  }, [startDate, endDate]);

  // Derived Lookup Maps
  const { dayAttendanceMap, nightAttendanceMap } = useMemo(() => {
    const dayMap: Record<string, AttendanceRecord> = {};
    const nightMap: Record<string, AttendanceRecord> = {};
    attendanceRecords.forEach((r) => {
      if (!r.date) return;
      const s = (r.shift || 'day').toLowerCase().includes('night') ? 'night' : 'day';
      if (s === 'night') {
        nightMap[r.date] = r;
      } else {
        dayMap[r.date] = r;
      }
    });
    return { dayAttendanceMap: dayMap, nightAttendanceMap: nightMap };
  }, [attendanceRecords]);

  const advancesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    advancesList.forEach((adv) => {
      if (adv.date) {
        map[adv.date] = (map[adv.date] || 0) + Number(adv.amount || 0);
      }
    });
    return map;
  }, [advancesList]);

  // Attendance metrics in DAYS, Overtime in HOURS
  const computeMetrics = (map: Record<string, AttendanceRecord>) => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let ot = 0;
    let otHours = 0;
    let otPayment = 0;

    daysInRange.forEach((d) => {
      const rec = map[d.dateStr];
      if (rec) {
        if (rec.status === 'present') present++;
        else if (rec.status === 'half-day') halfDay++;
        else if (rec.status === 'absent') absent++;
        else if (rec.status === 'overtime') {
          ot++;
          present++;
        }

        const hours = Number(rec.overtimeHours || 0);
        if (hours > 0) {
          otHours += hours;
        }

        if (rec.overtimePayment !== undefined && rec.overtimePayment !== null && rec.overtimePayment > 0) {
          otPayment += Number(rec.overtimePayment);
        } else if (hours > 0) {
          const rate = Number(rec.overtimeRate || worker.overtimeRate || 100);
          otPayment += hours * rate;
        }
      }
    });

    const workDaysCredited = present + halfDay * 0.5;

    return {
      present,
      halfDay,
      absent,
      ot,
      otHours,
      otPayment,
      workDaysCredited,
    };
  };

  const dayMetrics = useMemo(() => computeMetrics(dayAttendanceMap), [daysInRange, dayAttendanceMap, worker.overtimeRate]);
  const nightMetrics = useMemo(() => computeMetrics(nightAttendanceMap), [daysInRange, nightAttendanceMap, worker.overtimeRate]);

  const totalAdv = useMemo(() => {
    return Object.values(advancesByDate).reduce((sum, val) => sum + val, 0);
  }, [advancesByDate]);

  const combinedMetrics = useMemo(() => {
    const totalWorkDaysCredited = dayMetrics.workDaysCredited + nightMetrics.workDaysCredited;
    const baseWages = Math.round(totalWorkDaysCredited * (worker.dailyWage || 0));
    const totalOtPayment = dayMetrics.otPayment + nightMetrics.otPayment;
    const grossWage = baseWages + totalOtPayment;

    // Mess Kharcha Calculation:
    // Deduct mess charge whether worker is absent or half day or present.
    // Only unmarked days will NOT be calculated.
    const markedDates = new Set<string>();
    daysInRange.forEach((d) => {
      const dayRec = dayAttendanceMap[d.dateStr];
      const nightRec = nightAttendanceMap[d.dateStr];
      const daySt = (dayRec?.status || '').toLowerCase().trim();
      const nightSt = (nightRec?.status || '').toLowerCase().trim();
      const isDayMarked = ['present', 'half-day', 'absent', 'overtime'].includes(daySt);
      const isNightMarked = ['present', 'half-day', 'absent', 'overtime'].includes(nightSt);
      if (isDayMarked || isNightMarked) {
        markedDates.add(d.dateStr);
      }
    });

    const messDaysCount = markedDates.size;
    const messChargePerDay = Number(worker.messCharge || 0);
    const totalMessCharge = messDaysCount * messChargePerDay;
    const totalDeductions = totalAdv + totalMessCharge;
    const netEstimatedPayable = Math.max(0, grossWage - totalDeductions);
    const totalOtHours = dayMetrics.otHours + nightMetrics.otHours;

    return {
      totalPresent: dayMetrics.present + nightMetrics.present,
      totalHalfDay: dayMetrics.halfDay + nightMetrics.halfDay,
      totalAbsent: dayMetrics.absent + nightMetrics.absent,
      totalOt: dayMetrics.ot + nightMetrics.ot,
      totalOtHours,
      totalOtPayment,
      totalWorkDaysCredited,
      baseWages,
      grossWage,
      totalAdv,
      messDaysCount,
      messChargePerDay,
      totalMessCharge,
      totalDeductions,
      netEstimatedPayable,
    };
  }, [dayMetrics, nightMetrics, totalAdv, worker.dailyWage, worker.messCharge, daysInRange, dayAttendanceMap, nightAttendanceMap]);

  // Clean, Table-based HTML Generator for PDF Export (Rock-Solid across Android & iOS)
  const generatePdfHtml = () => {
    const todayFormatted = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date());

    const tableRows = daysInRange.map((d) => {
      const dayRec = dayAttendanceMap[d.dateStr];
      const nightRec = nightAttendanceMap[d.dateStr];
      const adv = advancesByDate[d.dateStr] || 0;

      const formatStatus = (rec?: AttendanceRecord) => {
        if (!rec || !rec.status) return '<span style="color:#94A3B8;">-</span>';
        if (rec.status === 'present') return '<span style="color:#15803D; font-weight:700;">P</span>';
        if (rec.status === 'half-day') return '<span style="color:#B45309; font-weight:700;">1/2</span>';
        if (rec.status === 'absent') return '<span style="color:#DC2626; font-weight:700;">A</span>';
        if (rec.status === 'overtime') {
          const ot = rec.overtimeHours ? ` (${rec.overtimeHours}h)` : '';
          return `<span style="color:#EA580C; font-weight:700;">OT${ot}</span>`;
        }
        return rec.status.toUpperCase();
      };

      let dayEarned = 0;
      if (dayRec) {
        if (dayRec.status === 'present' || dayRec.status === 'overtime') dayEarned += (worker.dailyWage || 0);
        else if (dayRec.status === 'half-day') dayEarned += Math.round((worker.dailyWage || 0) / 2);
        dayEarned += (dayRec.overtimePayment || 0);
      }
      if (nightRec) {
        if (nightRec.status === 'present' || nightRec.status === 'overtime') dayEarned += (worker.dailyWage || 0);
        else if (nightRec.status === 'half-day') dayEarned += Math.round((worker.dailyWage || 0) / 2);
        dayEarned += (nightRec.overtimePayment || 0);
      }

      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0; font-weight:600; font-size:11px;">${d.dayNum} ${d.dayName}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align:center;">${formatStatus(dayRec)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align:center;">${formatStatus(nightRec)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align:right; color:#B45309; font-weight:600;">${adv > 0 ? `₹${adv}` : '-'}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align:right; font-weight:700;">₹${dayEarned}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Worker Attendance & Wage Report - ${worker.name}</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #0F172A;
            margin: 0;
            padding: 16px;
            background: #FFFFFF;
            font-size: 11px;
            line-height: 1.4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .header-table {
            margin-bottom: 12px;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 10px;
          }
          .brand-title {
            font-size: 22px;
            font-weight: 900;
            color: #0F172A;
            letter-spacing: -0.5px;
            margin: 0;
          }
          .brand-sub {
            font-size: 10px;
            color: #EA580C;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 2px;
          }
          .badge-cell {
            text-align: right;
            font-size: 10px;
            color: #475569;
          }
          .info-table {
            margin-top: 10px;
            margin-bottom: 12px;
            background: #F8FAFC;
            border: 1px solid #CBD5E1;
            border-radius: 6px;
          }
          .info-table td {
            padding: 6px 10px;
            font-size: 11px;
            border-bottom: 1px solid #E2E8F0;
          }
          .info-label {
            color: #64748B;
            font-weight: 700;
            width: 25%;
          }
          .info-val {
            color: #0F172A;
            font-weight: 800;
            width: 25%;
          }
          .payable-table {
            margin-top: 8px;
            margin-bottom: 14px;
            background: #F0FDF4;
            border: 1.5px solid #86EFAC;
            border-radius: 6px;
          }
          .payable-table td {
            padding: 10px;
            text-align: center;
          }
          .payable-title {
            font-size: 10px;
            font-weight: 800;
            color: #15803D;
            text-transform: uppercase;
          }
          .payable-amt {
            font-size: 20px;
            font-weight: 900;
            color: #166534;
            margin-top: 2px;
          }
          .shift-table {
            margin-top: 10px;
            margin-bottom: 14px;
            border: 1px solid #CBD5E1;
          }
          .shift-table th {
            background: #0F172A;
            color: #FFFFFF;
            padding: 7px 8px;
            font-size: 10px;
            text-transform: uppercase;
          }
          .shift-table td {
            padding: 6px 8px;
            border-bottom: 1px solid #E2E8F0;
            font-size: 11px;
          }
          .ledger-table {
            margin-top: 8px;
            margin-bottom: 16px;
            border: 1px solid #CBD5E1;
          }
          .ledger-table th {
            background: #F1F5F9;
            color: #475569;
            padding: 6px 8px;
            font-size: 10px;
            text-transform: uppercase;
            border-bottom: 1px solid #CBD5E1;
          }
          .ledger-table td {
            padding: 5px 8px;
            border-bottom: 1px solid #E2E8F0;
            font-size: 10px;
          }
          .sig-table {
            margin-top: 24px;
            width: 100%;
          }
          .sig-table td {
            width: 50%;
            text-align: center;
            padding: 0 25px;
            vertical-align: bottom;
          }
          .sig-line {
            border-bottom: 1px solid #94A3B8;
            height: 32px;
            margin-bottom: 6px;
          }
          .sig-label {
            font-size: 10px;
            font-weight: 700;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="brand-title">CONSTLABOUR</div>
              <div class="brand-sub">${
                language === 'hi' ? 'ठेकेदार कार्यबल और वैधानिक मजदूरी खाता • WORKFORCE & STATUTORY WAGE LEDGER' :
                language === 'bn' ? 'ঠিকাদার কর্মীবাহিনী ও বিধিবদ্ধ মজুরি খতিয়ান • WORKFORCE & STATUTORY WAGE LEDGER' :
                'Contractor Workforce & Statutory Wage Ledger'
              }</div>
            </td>
            <td class="badge-cell">
              <div><strong>${language === 'hi' ? 'दिनांक / Date:' : language === 'bn' ? 'তারিখ / Date:' : 'Report Date:'}</strong> ${todayFormatted}</div>
              <div><strong>${language === 'hi' ? 'अवधि / Range:' : language === 'bn' ? 'সময়কাল / Range:' : 'Range:'}</strong> ${startDate} to ${endDate}</div>
            </td>
          </tr>
        </table>

        <!-- WORKER, SITE & DATE RANGE INFO TABLE -->
        <table class="info-table">
          <tr>
            <td class="info-label">${language === 'hi' ? 'श्रमिक का नाम / Worker:' : language === 'bn' ? 'শ্রমিকের নাম / Worker:' : 'Worker Name:'}</td>
            <td class="info-val">${worker.name}</td>
            <td class="info-label">${language === 'hi' ? 'कार्यस्थल / Site:' : language === 'bn' ? 'সাইট / Site:' : 'Assigned Site:'}</td>
            <td class="info-val">${siteName}</td>
          </tr>
          <tr>
            <td class="info-label">${language === 'hi' ? 'मोबाइल नंबर / Mobile:' : language === 'bn' ? 'মোবাইল / Mobile:' : 'Mobile Number:'}</td>
            <td class="info-val">${worker.phone ? `+91 ${worker.phone}` : 'N/A'}</td>
            <td class="info-label">${language === 'hi' ? 'कौशल श्रेणी / Skill:' : language === 'bn' ? 'দক্ষতার শ্রেণী / Skill:' : 'Skill Category:'}</td>
            <td class="info-val">${worker.skillLevel ? worker.skillLevel.toUpperCase() : 'GENERAL LABOUR'}</td>
          </tr>
          <tr>
            <td class="info-label">${language === 'hi' ? 'तारीख सीमा / Range:' : language === 'bn' ? 'তারিখ পরিসীমা / Range:' : 'Date Range:'}</td>
            <td class="info-val" style="color:#EA580C;">${startDate} to ${endDate}</td>
            <td class="info-label">${language === 'hi' ? 'दैनिक दर / Wage Rate:' : language === 'bn' ? 'দৈনিক হার / Wage Rate:' : 'Daily Wage Rate:'}</td>
            <td class="info-val">₹${worker.dailyWage || 0} / day</td>
          </tr>
          <tr>
            <td class="info-label">${language === 'hi' ? 'ओवरटाइम दर / OT Rate:' : language === 'bn' ? 'ওভারটাইম হার / OT Rate:' : 'Overtime Rate:'}</td>
            <td class="info-val">₹${worker.overtimeRate !== undefined ? worker.overtimeRate : 100} / hr</td>
            <td class="info-label">${language === 'hi' ? 'आधार कार्ड / Aadhaar ID:' : language === 'bn' ? 'আধার কার্ড / Aadhaar ID:' : 'Aadhaar / ID:'}</td>
            <td class="info-val">${worker.aadhaar || 'Verified on file'}</td>
          </tr>
        </table>

        <!-- EXECUTIVE FINANCIAL SUMMARY -->
        <table class="payable-table">
          <tr>
            <td style="border-right: 1px solid #86EFAC; width: ${combinedMetrics.totalMessCharge > 0 ? '20%' : '25%'};">
              <div class="payable-title">${language === 'hi' ? 'कार्य दिवस / Work Days' : language === 'bn' ? 'কাজের দিন / Work Days' : 'Work Days Credited'}</div>
              <div class="payable-amt" style="color:#0F172A;">${combinedMetrics.totalWorkDaysCredited} days</div>
            </td>
            <td style="border-right: 1px solid #86EFAC; width: ${combinedMetrics.totalMessCharge > 0 ? '20%' : '25%'};">
              <div class="payable-title">${language === 'hi' ? 'सकल मजदूरी / Gross Wages' : language === 'bn' ? 'মোট মজুরি / Gross Wages' : 'Gross Wages'}</div>
              <div class="payable-amt" style="color:#0F172A;">₹${combinedMetrics.grossWage}</div>
            </td>
            <td style="border-right: 1px solid #86EFAC; width: ${combinedMetrics.totalMessCharge > 0 ? '20%' : '25%'};">
              <div class="payable-title">${language === 'hi' ? 'अग्रिम कटौती / Advances' : language === 'bn' ? 'অগ্রিম কর্তন / Advances' : 'Advances Deducted'}</div>
              <div class="payable-amt" style="color:#DC2626;">-₹${combinedMetrics.totalAdv}</div>
            </td>
            ${
              combinedMetrics.totalMessCharge > 0
                ? `<td style="border-right: 1px solid #86EFAC; width: 20%;">
              <div class="payable-title">${language === 'hi' ? 'मेस कटौती / Mess Kharcha' : language === 'bn' ? 'মেস কর্তন / Mess Kharcha' : 'Mess Kharcha'}</div>
              <div class="payable-amt" style="color:#EA580C;">-₹${combinedMetrics.totalMessCharge}</div>
              <div style="font-size:8px; color:#64748B;">${combinedMetrics.messDaysCount}d @ ₹${combinedMetrics.messChargePerDay}/d</div>
            </td>`
                : ''
            }
            <td style="width: ${combinedMetrics.totalMessCharge > 0 ? '20%' : '25%'};">
              <div class="payable-title">${language === 'hi' ? 'कुल देय राशि / Net Payable' : language === 'bn' ? 'মোট প্রদেয় / Net Payable' : 'Net Estimated Payable'}</div>
              <div class="payable-amt">₹${combinedMetrics.netEstimatedPayable}</div>
            </td>
          </tr>
        </table>

        <!-- SHIFT BREAKDOWN TABLE -->
        <table class="shift-table">
          <thead>
            <tr>
              <th style="text-align:left;">${language === 'hi' ? 'शिफ्ट प्रकार / Shift Type' : language === 'bn' ? 'শিফটের ধরন / Shift Type' : 'Shift Type'}</th>
              <th style="text-align:center;">${language === 'hi' ? 'उपस्थित / Present' : language === 'bn' ? 'উপস্থিত / Present' : 'Present'}</th>
              <th style="text-align:center;">${language === 'hi' ? 'आधा दिन / Half Day' : language === 'bn' ? 'অর্ধ দিবস / Half Day' : 'Half Day (0.5x)'}</th>
              <th style="text-align:center;">${language === 'hi' ? 'अनुपस्थित / Absent' : language === 'bn' ? 'অনুপস্থিত / Absent' : 'Absent'}</th>
              <th style="text-align:center;">${language === 'hi' ? 'ओवरटाइम / OT' : language === 'bn' ? 'ওভারটাইম / OT' : 'Overtime Hours'}</th>
              <th style="text-align:right;">${language === 'hi' ? 'ओटी भुगतान / OT Pay' : language === 'bn' ? 'ওটি বেতন / OT Pay' : 'OT Pay'}</th>
              <th style="text-align:right;">${language === 'hi' ? 'कुल दिन / Credits' : language === 'bn' ? 'মোট দিন / Credits' : 'Work Days Credited'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>☀️ Day Shift</strong></td>
              <td style="text-align:center; color:#15803D; font-weight:700;">${dayMetrics.present} days</td>
              <td style="text-align:center; color:#B45309; font-weight:700;">${dayMetrics.halfDay} days</td>
              <td style="text-align:center; color:#DC2626;">${dayMetrics.absent} days</td>
              <td style="text-align:center; font-weight:700; color:#EA580C;">${dayMetrics.otHours} hrs</td>
              <td style="text-align:right;">+₹${dayMetrics.otPayment}</td>
              <td style="text-align:right; font-weight:800; color:#0F172A;">${dayMetrics.workDaysCredited} days</td>
            </tr>
            <tr>
              <td><strong>🌙 Night Shift</strong></td>
              <td style="text-align:center; color:#15803D; font-weight:700;">${nightMetrics.present} days</td>
              <td style="text-align:center; color:#B45309; font-weight:700;">${nightMetrics.halfDay} days</td>
              <td style="text-align:center; color:#DC2626;">${nightMetrics.absent} days</td>
              <td style="text-align:center; font-weight:700; color:#EA580C;">${nightMetrics.otHours} hrs</td>
              <td style="text-align:right;">+₹${nightMetrics.otPayment}</td>
              <td style="text-align:right; font-weight:800; color:#0F172A;">${nightMetrics.workDaysCredited} days</td>
            </tr>
            <tr style="background:#F8FAFC; font-weight:800;">
              <td>${language === 'hi' ? 'कुल योग / Combined Total' : language === 'bn' ? 'সর্বমোট / Combined Total' : 'Combined Total'}</td>
              <td style="text-align:center;">${combinedMetrics.totalPresent} days</td>
              <td style="text-align:center;">${combinedMetrics.totalHalfDay} days</td>
              <td style="text-align:center;">${combinedMetrics.totalAbsent} days</td>
              <td style="text-align:center; color:#EA580C;">${combinedMetrics.totalOtHours} hrs</td>
              <td style="text-align:right; color:#EA580C;">+₹${combinedMetrics.totalOtPayment}</td>
              <td style="text-align:right; color:#166534; font-size:12px;">${combinedMetrics.totalWorkDaysCredited} days</td>
            </tr>
          </tbody>
        </table>

        <!-- ITEMIZED DAILY SCHEDULE TABLE -->
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:4px;">
          ${language === 'hi' ? `दैनिक विस्तृत अनुसूची / Itemized Daily Schedule (${daysInRange.length} दिन / Days)` :
            language === 'bn' ? `দৈনিক বিস্তারিত সময়সূচী / Itemized Daily Schedule (${daysInRange.length} দিন / Days)` :
            `Itemized Daily Schedule (${daysInRange.length} Days)`}
        </div>
        <table class="ledger-table">
          <thead>
            <tr>
              <th style="text-align:left; width: 22%;">${language === 'hi' ? 'तारीख / Date' : language === 'bn' ? 'তারিখ / Date' : 'Date'}</th>
              <th style="text-align:center; width: 22%;">${language === 'hi' ? 'दिन की शिफ्ट / Day Shift' : language === 'bn' ? 'দিনের শিফট / Day Shift' : 'Day Shift'}</th>
              <th style="text-align:center; width: 22%;">${language === 'hi' ? 'रात की शिफ्ट / Night Shift' : language === 'bn' ? 'রাতের শিফট / Night Shift' : 'Night Shift'}</th>
              <th style="text-align:right; width: 17%;">${language === 'hi' ? 'अग्रिम / Advance' : language === 'bn' ? 'অগ্রিম / Advance' : 'Advance'}</th>
              <th style="text-align:right; width: 17%;">${language === 'hi' ? 'अर्जित / Earned' : language === 'bn' ? 'অর্জিত / Earned' : 'Earned'}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <!-- SIGNATURES -->
        <table class="sig-table">
          <tr>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${language === 'hi' ? 'श्रमिक के हस्ताक्षर / अंगूठे का निशान • Worker Signature / Thumb Impression' :
                language === 'bn' ? 'শ্রমিকের স্বাক্ষর / টিপসই • Worker Signature / Thumb Impression' :
                'Worker Signature / Thumb Impression'}</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${language === 'hi' ? 'अधिकृत हस्ताक्षरकर्ता • Authorized Signatory (Contractor / Supervisor)' :
                language === 'bn' ? 'অনুমোদিত স্বাক্ষরকারী • Authorized Signatory (Contractor / Supervisor)' :
                'Authorized Signatory (Contractor / Site Supervisor)'}</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  // Formatted Text Report for Instant Native Sharing Fallback
  const generateTextReport = () => {
    const isHi = language === 'hi';
    const isBn = language === 'bn';
    return `📋 ConstLabour ${isHi ? 'वैधानिक उपस्थिति एवं मजदूरी खाता' : isBn ? 'বিধিবদ্ধ উপস্থিতি ও মজুরি খতিয়ান' : 'Statutory Attendance & Wage Ledger'}
👷 ${isHi ? 'श्रमिक' : isBn ? 'শ্রমিক' : 'Worker'}: ${worker.name}
📍 ${isHi ? 'कार्यस्थल' : isBn ? 'সাইট' : 'Site'}: ${siteName}
📅 ${isHi ? 'अवधि' : isBn ? 'সময়কাল' : 'Date Range'}: ${startDate} to ${endDate} (${daysInRange.length} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'})
💰 ${isHi ? 'दैनिक दर' : isBn ? 'দৈনিক হার' : 'Daily Wage'}: ₹${worker.dailyWage || 0}/${isHi ? 'दिन' : isBn ? 'দিন' : 'day'} | ${isHi ? 'ओटी दर' : isBn ? 'ওটি হার' : 'OT Rate'}: ₹${worker.overtimeRate !== undefined ? worker.overtimeRate : 100}/${isHi ? 'घंटे' : isBn ? 'ঘণ্টা' : 'hr'}
----------------------------------------
☀️ ${isHi ? 'दिन की शिफ्ट' : isBn ? 'দিনের শিফট' : 'DAY SHIFT'}:
  • ${isHi ? 'उपस्थित' : isBn ? 'উপস্থিত' : 'Present'}: ${dayMetrics.present} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
  • ${isHi ? 'आधा दिन' : isBn ? 'অর্ধ দিবস' : 'Half Day'}: ${dayMetrics.halfDay} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
  • ${isHi ? 'अनुपस्थित' : isBn ? 'অনুপস্থিত' : 'Absent'}: ${dayMetrics.absent} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
  • ${isHi ? 'ओवरटाइम' : isBn ? 'ওভারটাইম' : 'Overtime'}: ${dayMetrics.otHours} ${isHi ? 'घंटे' : isBn ? 'ঘণ্টা' : 'hrs'} (+₹${dayMetrics.otPayment})
  • ${isHi ? 'मान्य दिन' : isBn ? 'গণ্য দিন' : 'Work Days Credited'}: ${dayMetrics.workDaysCredited} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}

🌙 ${isHi ? 'रात की शिफ्ट' : isBn ? 'রাতের শিফট' : 'NIGHT SHIFT'}:
  • ${isHi ? 'उपस्थित' : isBn ? 'উপস্থিত' : 'Present'}: ${nightMetrics.present} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
  • ${isHi ? 'आधा दिन' : isBn ? 'অর্ধ দিবস' : 'Half Day'}: ${nightMetrics.halfDay} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
  • ${isHi ? 'अनुपस्थित' : isBn ? 'অনুপস্থিত' : 'Absent'}: ${nightMetrics.absent} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
  • ${isHi ? 'ओवरटाइम' : isBn ? 'ওভারটাইম' : 'Overtime'}: ${nightMetrics.otHours} ${isHi ? 'घंटे' : isBn ? 'ঘণ্টা' : 'hrs'} (+₹${nightMetrics.otPayment})
  • ${isHi ? 'मान्य दिन' : isBn ? 'গণ্য দিন' : 'Work Days Credited'}: ${nightMetrics.workDaysCredited} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
----------------------------------------
📊 ${isHi ? 'कुल मान्य कार्य दिवस' : isBn ? 'মোট গণ্য কাজের দিন' : 'TOTAL WORK DAYS CREDITED'}: ${combinedMetrics.totalWorkDaysCredited} ${isHi ? 'दिन' : isBn ? 'দিন' : 'days'}
⚡ ${isHi ? 'कुल ओवरटाइम' : isBn ? 'মোট ওভারটাইম' : 'Total Overtime'}: ${combinedMetrics.totalOtHours} ${isHi ? 'घंटे' : isBn ? 'ঘণ্টা' : 'hrs'} (+₹${combinedMetrics.totalOtPayment})
💵 ${isHi ? 'कुल सकल अर्जित मजदूरी' : isBn ? 'মোট অর্জিত মজুরি' : 'Gross Wages Earned'}: ₹${combinedMetrics.grossWage}
🔻 ${isHi ? 'अग्रिम कटौती' : isBn ? 'অগ্রিম কর্তন' : 'Advances Deducted'}: -₹${combinedMetrics.totalAdv}
👉 ${isHi ? 'अनुमानित शुद्ध देय राशि' : isBn ? 'আনুমানিক প্রদেয় মজুরি' : 'NET ESTIMATED PAYABLE'}: ₹${combinedMetrics.netEstimatedPayable}
----------------------------------------
Generated via ConstLabour`;
  };

  // Download PDF Handler - Uses Android System Print / "Save as PDF" directly
  const handleDownloadPdf = async () => {
    if (generatingPdf || sharingPdf) return;
    setGeneratingPdf(true);
    try {
      const html = generatePdfHtml();
      await Print.printAsync({ html });
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Download / Print PDF error:', err);
        Toast.show({
          type: 'error',
          text1: 'Download Failed',
          text2: 'Could not open PDF print / save window',
        });
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Share PDF Handler - Generates local PDF and shares via native share sheet
  const handleSharePdf = async () => {
    if (sharingPdf || generatingPdf) return;
    setSharingPdf(true);
    try {
      const html = generatePdfHtml();
      // Generate PDF file with base64 for secure in-sandbox writing
      const file = await Print.printToFileAsync({ html, base64: true });

      // Build target URI in Expo's permitted storage directory
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const cleanBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
      const safeWorkerName = (worker.name || 'Worker').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeFileName = `Attendance_${safeWorkerName}_${startDate}_to_${endDate}.pdf`;
      const targetUri = `${cleanBaseDir}${safeFileName}`;

      // Write or copy file into Expo sandbox so FilePermissionService grants read permission
      if (file?.base64) {
        await FileSystem.writeAsStringAsync(targetUri, file.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (file?.uri) {
        await FileSystem.copyAsync({
          from: file.uri,
          to: targetUri,
        });
      }

      const pdfUriToShare = targetUri.startsWith('file://') ? targetUri : `file://${targetUri}`;

      // Reset sharing state slightly early to avoid UI freezes on modal launch
      setSharingPdf(false);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 1. Primary: Native Expo Sharing sheet
      if (await Sharing.isAvailableAsync()) {
        try {
          await Sharing.shareAsync(pdfUriToShare, {
            mimeType: 'application/pdf',
            dialogTitle: `Share ${worker.name} Attendance Report PDF`,
            UTI: 'com.adobe.pdf',
          });
          return;
        } catch (shareErr: any) {
          console.warn('Sharing.shareAsync failed, trying native PDF viewer preview:', shareErr);
        }
      }

      // 2. Secondary: Hand off to native PDF viewer (Drive/Samsung PDF Viewer with 1-tap share)
      try {
        const expoFile = new ExpoFile(pdfUriToShare);
        await expoFile.preview({ mimeType: 'application/pdf' });
        return;
      } catch (previewErr) {
        console.warn('ExpoFile.preview failed, trying Print spooler fallback:', previewErr);
      }

      // 3. Tertiary: Launch Android Print Spooler (which allows Save as PDF and Share)
      try {
        await Print.printAsync({ html });
        return;
      } catch (printErr) {
        console.warn('Print spooler failed, falling back to text share:', printErr);
      }

      // 4. Final Fallback: Text report
      await Share.share({
        title: `Attendance Report - ${worker.name}`,
        message: generateTextReport(),
      });
    } catch (err: any) {
      console.error('Error sharing PDF report:', err);
      try {
        await Share.share({
          title: `Attendance Report - ${worker.name}`,
          message: generateTextReport(),
        });
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Share Failed',
          text2: 'Could not share PDF report',
        });
      }
    } finally {
      setSharingPdf(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
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
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {language === 'hi' ? 'उपस्थिति एवं मजदूरी रिपोर्ट' : language === 'bn' ? 'উপস্থিতি ও মজুরি রিপোর্ট' : 'Attendance & Wage Report'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {worker.name} • {siteName}
            </Text>
          </View>
        </View>

        <View style={styles.wageHeaderBadge}>
          <Text style={styles.wageHeaderBadgeText}>₹{worker.dailyWage || 0}/{language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'd'}</Text>
        </View>
      </View>

      {/* 2. CUSTOM DATE RANGE CONTROLS (WITH 'THIS WEEK' OPTION) */}
      <View style={styles.filterSection}>
        {/* Preset Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {/* THIS WEEK OPTION */}
          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'this-week' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('this-week')}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetChipText, rangePreset === 'this-week' && styles.presetChipTextActive]}>
              {t('common.thisWeek')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'this-month' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('this-month')}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetChipText, rangePreset === 'this-month' && styles.presetChipTextActive]}>
              {t('common.thisMonth')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'last-month' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('last-month')}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetChipText, rangePreset === 'last-month' && styles.presetChipTextActive]}>
              {t('common.lastMonth')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'last-30' && styles.presetChipActive]}
            onPress={() => handleSelectPreset('last-30')}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetChipText, rangePreset === 'last-30' && styles.presetChipTextActive]}>
              {t('common.last30Days')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, rangePreset === 'custom' && styles.presetChipActive]}
            onPress={() => setRangePreset('custom')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="date-range"
              size={13}
              color={rangePreset === 'custom' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.presetChipText, rangePreset === 'custom' && styles.presetChipTextActive]}>
              {t('common.customRange')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Date Selector Bar */}
        <View style={styles.dateSelectorRow}>
          <TouchableOpacity
            style={styles.dateSelectorBtn}
            onPress={() => handleOpenDatePicker('start')}
            activeOpacity={0.7}
          >
            <Text style={styles.dateSelectorLabel}>
              {language === 'hi' ? 'प्रारंभ तिथि' : language === 'bn' ? 'শুরুর তারিখ' : 'START DATE'}
            </Text>
            <View style={styles.dateSelectorValueRow}>
              <MaterialIcons name="calendar-today" size={14} color="#EA580C" />
              <Text style={styles.dateSelectorValue}>{startDate}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.dateArrowBox}>
            <MaterialIcons name="arrow-forward" size={16} color="#94A3B8" />
          </View>

          <TouchableOpacity
            style={styles.dateSelectorBtn}
            onPress={() => handleOpenDatePicker('end')}
            activeOpacity={0.7}
          >
            <Text style={styles.dateSelectorLabel}>
              {language === 'hi' ? 'अंतिम तिथि' : language === 'bn' ? 'শেষ তারিখ' : 'END DATE'}
            </Text>
            <View style={styles.dateSelectorValueRow}>
              <MaterialIcons name="event" size={14} color="#2563EB" />
              <Text style={styles.dateSelectorValue}>{endDate}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* iOS Date Picker Fallback */}
      {pickerTarget && (
        <DateTimePicker
          value={tempPickerDate}
          mode="date"
          display="default"
          onChange={handleIOSDateChange}
        />
      )}

      {/* 3. SCROLLABLE REPORT BODY */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loadingText}>
              {language === 'hi' ? 'ऑडिट रिकॉर्ड संकलित किए जा रहे हैं...' : language === 'bn' ? 'অডিট রেকর্ড সংকলন করা হচ্ছে...' : 'Compiling audit records...'}
            </Text>
          </View>
        ) : (
          <>
            {/* 3.0 WORKER NAME, SITE NAME & DATE RANGE INFO CARD */}
            <View style={styles.workerSummaryCard}>
              <View style={styles.workerSummaryRow}>
                <View style={styles.workerSummaryCol}>
                  <Text style={styles.workerSummaryLabel}>{t('workers.workerName').toUpperCase()}</Text>
                  <Text style={styles.workerSummaryName} numberOfLines={1}>
                    {worker.name}
                  </Text>
                  <Text style={styles.workerSummarySkill}>
                    {worker.skillLevel ? worker.skillLevel.toUpperCase() : 'GENERAL LABOUR'}
                  </Text>
                </View>
                <View style={styles.workerSummaryColRight}>
                  <Text style={styles.workerSummaryLabel}>{t('workers.assignedSite').toUpperCase()}</Text>
                  <Text style={styles.workerSummarySite} numberOfLines={1}>
                    {siteName}
                  </Text>
                  <View style={styles.wageMiniBadge}>
                    <Text style={styles.wageMiniBadgeText}>
                      ₹{worker.dailyWage || 0}/{language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'day'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.workerSummaryDivider} />

              <View style={styles.workerSummaryBottomRow}>
                <View style={styles.dateRangePill}>
                  <MaterialIcons name="date-range" size={13} color="#EA580C" />
                  <Text style={styles.dateRangePillText}>
                    {startDate} {t('common.to')} {endDate} ({daysInRange.length} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'})
                  </Text>
                </View>

                <View style={styles.otRatePill}>
                  <MaterialIcons name="bolt" size={13} color="#2563EB" />
                  <Text style={styles.otRatePillText}>
                    OT: ₹{worker.overtimeRate !== undefined ? worker.overtimeRate : 100}/{language === 'hi' ? 'घंटे' : language === 'bn' ? 'ঘণ্টা' : 'hr'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3.1 FINANCIAL SUMMARY BANNER */}
            <View style={styles.financialBanner}>
              <View style={styles.payableHeaderRow}>
                <View>
                  <Text style={styles.payableLabel}>
                    {language === 'hi' ? 'अनुमानित शुद्ध देय राशि' : language === 'bn' ? 'আনুমানিক মোট প্রদেয়' : 'NET ESTIMATED PAYABLE'}
                  </Text>
                  <Text style={styles.payableSubtitle}>
                    {combinedMetrics.totalMessCharge > 0
                      ? (language === 'hi'
                          ? `कुल कटौती: अग्रिम ₹${combinedMetrics.totalAdv} + मेस ₹${combinedMetrics.totalMessCharge}`
                          : language === 'bn'
                          ? `মোট কর্তন: অগ্রিম ₹${combinedMetrics.totalAdv} + মেস ₹${combinedMetrics.totalMessCharge}`
                          : `Deductions: Adv ₹${combinedMetrics.totalAdv} + Mess ₹${combinedMetrics.totalMessCharge}`)
                      : (language === 'hi'
                          ? `₹${combinedMetrics.totalAdv} अग्रिम कटौती के बाद`
                          : language === 'bn'
                          ? `₹${combinedMetrics.totalAdv} অগ্রিম কর্তনের পর`
                          : `After ₹${combinedMetrics.totalAdv} advance deductions`)}
                  </Text>
                </View>
                <Text style={styles.payableAmount}>₹{combinedMetrics.netEstimatedPayable}</Text>
              </View>

              <View style={styles.financialDivider} />

              <View style={styles.financialStatsRow}>
                <View style={styles.financialStatItem}>
                  <Text style={styles.finStatLabel}>
                    {language === 'hi' ? 'कार्य दिवस' : language === 'bn' ? 'কাজের দিন' : 'Work Days'}
                  </Text>
                  <Text style={styles.finStatValue}>{combinedMetrics.totalWorkDaysCredited} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}</Text>
                </View>
                <View style={styles.financialStatDivider} />
                <View style={styles.financialStatItem}>
                  <Text style={styles.finStatLabel}>
                    {language === 'hi' ? 'सकल अर्जित' : language === 'bn' ? 'মোট অর্জিত' : 'Gross Earned'}
                  </Text>
                  <Text style={[styles.finStatValue, { color: '#0F172A' }]}>
                    ₹{combinedMetrics.grossWage}
                  </Text>
                </View>
                <View style={styles.financialStatDivider} />
                <View style={styles.financialStatItem}>
                  <Text style={styles.finStatLabel}>
                    {language === 'hi' ? 'अग्रिम कटौती' : language === 'bn' ? 'অগ্রিম কর্তন' : 'Advances'}
                  </Text>
                  <Text style={[styles.finStatValue, { color: '#DC2626' }]}>
                    -₹{combinedMetrics.totalAdv}
                  </Text>
                </View>
                {combinedMetrics.totalMessCharge > 0 && (
                  <>
                    <View style={styles.financialStatDivider} />
                    <View style={styles.financialStatItem}>
                      <Text style={styles.finStatLabel}>
                        {language === 'hi' ? 'मेस कटौती' : language === 'bn' ? 'মেস কর্তন' : 'Mess Kharcha'}
                      </Text>
                      <Text style={[styles.finStatValue, { color: '#EA580C' }]}>
                        -₹{combinedMetrics.totalMessCharge}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* 3.2 SHIFT PERFORMANCE SUMMARY CARDS */}
            <View style={styles.shiftCardsRow}>
              {/* Day Shift Card */}
              <View style={[styles.shiftCard, styles.shiftCardDay]}>
                <View style={styles.shiftCardHeader}>
                  <MaterialIcons name="wb-sunny" size={16} color="#EA580C" />
                  <Text style={styles.shiftCardTitleDay}>
                    {language === 'hi' ? 'दिन की शिफ्ट' : language === 'bn' ? 'দিনের শিফট' : 'DAY SHIFT'}
                  </Text>
                </View>
                <View style={styles.shiftCardBody}>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>{t('attendance.present')}:</Text>
                    <Text style={[styles.shiftStatVal, { color: colors.success }]}>
                      {dayMetrics.present} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>{t('attendance.halfDay')}:</Text>
                    <Text style={[styles.shiftStatVal, { color: colors.warning }]}>
                      {dayMetrics.halfDay} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>{t('attendance.absent')}:</Text>
                    <Text style={[styles.shiftStatVal, { color: colors.error }]}>
                      {dayMetrics.absent} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>
                      {language === 'hi' ? 'ओवरटाइम:' : language === 'bn' ? 'ওভারটাইম:' : 'Overtime:'}
                    </Text>
                    <Text style={[styles.shiftStatVal, { color: colors.accent }]}>
                      {dayMetrics.otHours} {language === 'hi' ? 'घंटे' : language === 'bn' ? 'ঘণ্টা' : 'hrs'} (+₹{dayMetrics.otPayment})
                    </Text>
                  </View>
                  <View style={styles.shiftCardDivider} />
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatCreditedLabel}>
                      {language === 'hi' ? 'मान्य दिन:' : language === 'bn' ? 'গণ্য দিন:' : 'Credited:'}
                    </Text>
                    <Text style={styles.shiftStatCreditedVal}>
                      {dayMetrics.workDaysCredited} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Night Shift Card */}
              <View style={[styles.shiftCard, styles.shiftCardNight]}>
                <View style={styles.shiftCardHeader}>
                  <MaterialIcons name="nights-stay" size={16} color="#2563EB" />
                  <Text style={styles.shiftCardTitleNight}>
                    {language === 'hi' ? 'रात की शिफ्ट' : language === 'bn' ? 'রাতের শিফট' : 'NIGHT SHIFT'}
                  </Text>
                </View>
                <View style={styles.shiftCardBody}>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>{t('attendance.present')}:</Text>
                    <Text style={[styles.shiftStatVal, { color: colors.success }]}>
                      {nightMetrics.present} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>{t('attendance.halfDay')}:</Text>
                    <Text style={[styles.shiftStatVal, { color: colors.warning }]}>
                      {nightMetrics.halfDay} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>{t('attendance.absent')}:</Text>
                    <Text style={[styles.shiftStatVal, { color: colors.error }]}>
                      {nightMetrics.absent} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatLabel}>
                      {language === 'hi' ? 'ओवरटाइम:' : language === 'bn' ? 'ওভারটাইম:' : 'Overtime:'}
                    </Text>
                    <Text style={[styles.shiftStatVal, { color: colors.accent }]}>
                      {nightMetrics.otHours} {language === 'hi' ? 'घंटे' : language === 'bn' ? 'ঘণ্টা' : 'hrs'} (+₹{nightMetrics.otPayment})
                    </Text>
                  </View>
                  <View style={styles.shiftCardDivider} />
                  <View style={styles.shiftStatRow}>
                    <Text style={styles.shiftStatCreditedLabel}>
                      {language === 'hi' ? 'मान्य दिन:' : language === 'bn' ? 'গণ্য দিন:' : 'Credited:'}
                    </Text>
                    <Text style={styles.shiftStatCreditedVal}>
                      {nightMetrics.workDaysCredited} {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'days'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 3.3 ITEMIZED DAILY BREAKDOWN TABLE */}
            <View style={styles.ledgerSection}>
              <View style={styles.ledgerHeaderRow}>
                <Text style={styles.ledgerSectionTitle}>
                  {language === 'hi'
                    ? `दैनिक विस्तृत अनुसूची (${daysInRange.length} दिन)`
                    : language === 'bn'
                    ? `দৈনিক বিস্তারিত সময়সূচী (${daysInRange.length} দিন)`
                    : `ITEMIZED SCHEDULE (${daysInRange.length} DAYS)`}
                </Text>
              </View>

              <View style={styles.ledgerTable}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableColHeader, { width: 70 }]}>
                    {language === 'hi' ? 'तारीख' : language === 'bn' ? 'তারিখ' : 'DATE'}
                  </Text>
                  <Text style={[styles.tableColHeader, { width: 62, textAlign: 'center' }]}>
                    {language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'DAY'}
                  </Text>
                  <Text style={[styles.tableColHeader, { width: 62, textAlign: 'center' }]}>
                    {language === 'hi' ? 'रात' : language === 'bn' ? 'রাত' : 'NIGHT'}
                  </Text>
                  <Text style={[styles.tableColHeader, { flex: 1, textAlign: 'right' }]}>
                    {language === 'hi' ? 'अग्रिम' : language === 'bn' ? 'অগ্রিম' : 'ADV'}
                  </Text>
                  <Text style={[styles.tableColHeader, { width: 72, textAlign: 'right' }]}>
                    {language === 'hi' ? 'अर्जित' : language === 'bn' ? 'অর্জিত' : 'EARNED'}
                  </Text>
                </View>

                {/* Table Rows */}
                {daysInRange.map((day) => {
                  const dayRec = dayAttendanceMap[day.dateStr];
                  const nightRec = nightAttendanceMap[day.dateStr];
                  const adv = advancesByDate[day.dateStr] || 0;

                  let earned = 0;
                  if (dayRec) {
                    if (dayRec.status === 'present' || dayRec.status === 'overtime') {
                      earned += (worker.dailyWage || 0);
                    } else if (dayRec.status === 'half-day') {
                      earned += Math.round((worker.dailyWage || 0) / 2);
                    }
                    earned += (dayRec.overtimePayment || 0);
                  }
                  if (nightRec) {
                    if (nightRec.status === 'present' || nightRec.status === 'overtime') {
                      earned += (worker.dailyWage || 0);
                    } else if (nightRec.status === 'half-day') {
                      earned += Math.round((worker.dailyWage || 0) / 2);
                    }
                    earned += (nightRec.overtimePayment || 0);
                  }

                  const renderBadge = (rec?: AttendanceRecord) => {
                    if (!rec || !rec.status) return <Text style={styles.unmarkedBadgeText}>-</Text>;
                    if (rec.status === 'present') return <Text style={styles.pBadgeText}>P</Text>;
                    if (rec.status === 'half-day') return <Text style={styles.halfBadgeText}>1/2</Text>;
                    if (rec.status === 'absent') return <Text style={styles.aBadgeText}>A</Text>;
                    if (rec.status === 'overtime') {
                      const ot = rec.overtimeHours ? ` (${rec.overtimeHours}h)` : '';
                      return <Text style={styles.otBadgeText}>OT{ot}</Text>;
                    }
                    return <Text style={styles.unmarkedBadgeText}>{rec.status.slice(0, 2)}</Text>;
                  };

                  return (
                    <View
                      key={day.dateStr}
                      style={[
                        styles.tableRow,
                        day.dateStr === todayStr && styles.tableRowToday,
                      ]}
                    >
                      <View style={{ width: 70 }}>
                        <Text style={styles.rowDateNum}>{day.dayNum} {day.dayName}</Text>
                      </View>

                      <View style={{ width: 62, alignItems: 'center' }}>
                        {renderBadge(dayRec)}
                      </View>

                      <View style={{ width: 62, alignItems: 'center' }}>
                        {renderBadge(nightRec)}
                      </View>

                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        {adv > 0 ? (
                          <Text style={styles.rowAdvText}>₹{adv}</Text>
                        ) : (
                          <Text style={styles.rowAdvNone}>-</Text>
                        )}
                      </View>

                      <View style={{ width: 72, alignItems: 'flex-end' }}>
                        <Text style={styles.rowEarnedText}>₹{earned}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* 4. FIXED BOTTOM DOCK (DOWNLOAD PDF & SHARE PDF) */}
      <View style={styles.bottomDock}>
        <TouchableOpacity
          style={styles.downloadPdfBtn}
          onPress={handleDownloadPdf}
          disabled={generatingPdf || sharingPdf || loading}
          activeOpacity={0.85}
        >
          {generatingPdf ? (
            <ActivityIndicator size="small" color="#0F172A" />
          ) : (
            <>
              <MaterialIcons name="file-download" size={18} color="#0F172A" />
              <Text style={styles.downloadPdfBtnText}>{t('reports.downloadPdf')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sharePdfBtn}
          onPress={handleSharePdf}
          disabled={generatingPdf || sharingPdf || loading}
          activeOpacity={0.85}
        >
          {sharingPdf ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="share" size={18} color="#FFFFFF" />
              <Text style={styles.sharePdfBtnText}>{t('reports.sharePdf')}</Text>
            </>
          )}
        </TouchableOpacity>
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
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  wageHeaderBadge: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    borderWidth: 1,
    borderColor: '#EA580C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  wageHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  presetScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
  },
  dateSelectorBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateSelectorLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  dateSelectorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dateSelectorValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateArrowBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  /* WORKER SUMMARY CARD */
  workerSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    ...shadows.sm,
  },
  workerSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workerSummaryCol: {
    flex: 1,
    marginRight: 8,
  },
  workerSummaryColRight: {
    alignItems: 'flex-end',
  },
  workerSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  workerSummaryName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  workerSummarySkill: {
    fontSize: 11,
    color: '#EA580C',
    fontWeight: '700',
    marginTop: 1,
  },
  workerSummarySite: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  wageMiniBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wageMiniBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  workerSummaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  workerSummaryBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  dateRangePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  otRatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  otRatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  /* FINANCIAL BANNER */
  financialBanner: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
    marginBottom: 14,
    ...shadows.sm,
  },
  payableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payableLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  payableSubtitle: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
  payableAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#166534',
  },
  financialDivider: {
    height: 1,
    backgroundColor: '#BBF7D0',
    marginVertical: 12,
  },
  financialStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  financialStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  financialStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#BBF7D0',
  },
  finStatLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  finStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  shiftCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  shiftCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.sm,
  },
  shiftCardDay: {
    borderColor: '#FED7AA',
  },
  shiftCardNight: {
    borderColor: '#BFDBFE',
  },
  shiftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  shiftCardTitleDay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.5,
  },
  shiftCardTitleNight: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  shiftCardBody: {
    padding: 12,
    gap: 8,
  },
  shiftStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  shiftStatVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  shiftCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  shiftStatCreditedLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  shiftStatCreditedVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  ledgerSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
    ...shadows.sm,
  },
  ledgerHeaderRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  ledgerSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  ledgerTable: {
    paddingBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowToday: {
    backgroundColor: '#F0FDF4',
  },
  rowDateNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  pBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  halfBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  aBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  otBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
  },
  unmarkedBadgeText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  rowAdvText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  rowAdvNone: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  rowEarnedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...shadows.card,
  },
  downloadPdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: 13,
    borderRadius: 12,
  },
  downloadPdfBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sharePdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 13,
    borderRadius: 12,
  },
  sharePdfBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
