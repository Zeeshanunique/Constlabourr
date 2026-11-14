import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Share,
  Text,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AppContext } from '@/context/AppContext';
import { colors, shadows, radii } from '@/styles/theme';
import { useTranslation } from '@/i18n';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface WorkerProfile {
  id: string;
  name: string;
  email?: string;
  phone: string;
  skillLevel: string;
  dailyWage: number;
  overtimeRate?: number;
  messCharge?: number;
  status: string;
  siteName?: string;
  siteId?: string;
  contractorName?: string;
  contractorId?: string;
  upiId?: string;
  aadhaarHash?: string;
  createdAt?: string;
  updatedAt?: string;
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
}

interface AttendanceItem {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'half-day' | 'unmarked';
  shift?: 'day' | 'night';
  checkIn?: string;
  checkOut?: string;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  dailyPayment?: number;
  overtimePayment?: number;
  totalPayment?: number;
  messCharge?: number;
}

interface AdvanceItem {
  id: string;
  workerId?: string;
  amount: number;
  date: string;
  reason?: string;
  status: 'pending' | 'deducted' | 'cancelled';
}

interface WorkerProfileTabProps {
  accessToken?: string;
}

export function WorkerProfileTab({ accessToken }: WorkerProfileTabProps) {
  const context = useContext(AppContext);
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const { language, setLanguage, t } = useTranslation();

  // Active top tab: 'wageslip' | 'profile'
  const [activeTab, setActiveTab] = useState<'wageslip' | 'profile'>('wageslip');

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [assignedSiteName, setAssignedSiteName] = useState('Assigned Construction Site');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const [monthAttendance, setMonthAttendance] = useState<AttendanceItem[]>([]);
  const [workerAdvances, setWorkerAdvances] = useState<AdvanceItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  useEffect(() => {
    if (token) {
      loadWageSlipData();
    }
  }, [token, selectedMonth]);

  const loadWageSlipData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const y = selectedMonth.getFullYear();
      const m = selectedMonth.getMonth() + 1;
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const daysInMonth = new Date(y, m, 0).getDate();
      const endDate = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // 1. Fetch Profile first to guarantee workerId
      let loadedProfile: WorkerProfile | null = null;
      try {
        const profRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
          { headers }
        );
        if (profRes.ok) {
          const profData = await profRes.json();
          loadedProfile = profData.profile || profData.user;
          setProfile(loadedProfile);
        }
      } catch (e) {
        console.warn('Error fetching profile in WorkerProfileTab:', e);
      }

      const workerId = loadedProfile?.id || context?.user?.id || (context?.user as any)?.workerId;

      // 2. Query attendance and advances with workerId using standard endpoints
      const attUrl = workerId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?workerId=${workerId}&startDate=${startDate}&endDate=${endDate}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?startDate=${startDate}&endDate=${endDate}`;

      const advUrl = workerId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances?workerId=${workerId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances`;

      const [attRes, advRes, sitesRes] = await Promise.allSettled([
        fetch(attUrl, { headers }),
        fetch(advUrl, { headers }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`, { headers }),
      ]);

      if (sitesRes.status === 'fulfilled' && sitesRes.value.ok) {
        const sitesData = await sitesRes.value.json();
        const sitesList = sitesData.sites || [];
        const targetSiteId = loadedProfile?.siteId || (context?.user as any)?.siteId;
        if (targetSiteId) {
          const match = sitesList.find((s: any) => s.id === targetSiteId);
          if (match?.name) setAssignedSiteName(match.name);
        }
      }

      if (attRes.status === 'fulfilled' && attRes.value.ok) {
        const attData = await attRes.value.json();
        const rawList = attData.attendance || [];
        const records: AttendanceItem[] = rawList.map((r: any) => {
          const rawStatus = (r.status || '').toLowerCase().trim();
          let safeStatus: 'present' | 'absent' | 'half-day' | 'unmarked' = 'unmarked';
          if (rawStatus === 'present' || rawStatus === 'overtime') safeStatus = 'present';
          else if (rawStatus === 'half-day' || rawStatus === 'half_day' || rawStatus === 'half') safeStatus = 'half-day';
          else if (rawStatus === 'absent') safeStatus = 'absent';
          else safeStatus = 'unmarked';

          const rawShift = (r.shift || '').toLowerCase().trim();
          const safeShift: 'day' | 'night' = rawShift.includes('night') ? 'night' : 'day';

          return {
            id: r.id,
            date: r.date,
            status: safeStatus,
            shift: safeShift,
            checkIn: r.checkIn || r.check_in,
            checkOut: r.checkOut || r.check_out,
            totalHours: Number(r.totalHours ?? r.total_hours ?? 0),
            regularHours: Number(r.regularHours ?? r.regular_hours ?? 0),
            overtimeHours: Number(r.overtimeHours ?? r.overtime_hours ?? 0),
            dailyPayment: Number(r.dailyPayment ?? r.daily_payment ?? 0),
            overtimePayment: Number(r.overtimePayment ?? r.overtime_payment ?? 0),
            totalPayment: Number(r.totalPayment ?? r.total_payment ?? 0),
            messCharge: Number(r.messCharge ?? r.mess_charge ?? 0),
          };
        });

        const filtered = workerId
          ? records.filter((r: any) => (r.workerId ? (r.workerId === workerId || r.worker_id === workerId) : true))
          : records;
        setMonthAttendance(filtered);
      }

      if (advRes.status === 'fulfilled' && advRes.value.ok) {
        const advData = await advRes.value.json();
        const allAdv: any[] = advData.advances || [];
        const myAdvances = workerId
          ? allAdv.filter((a: any) => (a.workerId || a.worker_id) === workerId)
          : allAdv;
        const mappedAdvances: AdvanceItem[] = myAdvances.map((a: any) => ({
          id: a.id,
          workerId: a.workerId || a.worker_id,
          amount: Number(a.amount || 0),
          date: a.date,
          reason: a.reason || 'General Cash Advance',
          status: (a.status || 'pending').toLowerCase() as any,
        }));
        setWorkerAdvances(mappedAdvances);
      }
    } catch (error) {
      console.error('Error fetching wage slip data:', error);
      Toast.show({
        type: 'error',
        text1: 'Notice',
        text2: 'Could not sync latest wage slip records',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWageSlipData();
  };

  const changeMonth = (offset: number) => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + offset);
    setSelectedMonth(next);
  };

  const onMonthChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowMonthPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      setSelectedMonth(date);
    }
  };

  // Month Date Range Boundaries
  const monthPeriod = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth() + 1;
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const readableMonth = selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { startStr, endStr, daysInMonth, readableMonth };
  }, [selectedMonth]);

  // Wage Slip Calculations
  const slipStats = useMemo(() => {
    const dailyWage = profile?.dailyWage || 0;
    const overtimeRate = profile?.overtimeRate || 100;
    const messChargePerDay = profile?.messCharge || 0;

    const fullDays = monthAttendance.filter((a) => a.status === 'present').length;
    const halfDays = monthAttendance.filter((a) => a.status === 'half-day').length;
    const absentDays = monthAttendance.filter((a) => a.status === 'absent').length;
    const workDaysCredited = fullDays + halfDays * 0.5;

    let totalOtHours = 0;
    let totalOtPayment = 0;
    let totalRecordedBasic = 0;
    let hasRecordedPayments = false;

    monthAttendance.forEach((a) => {
      const otH = Number(a.overtimeHours || 0);
      totalOtHours += otH;
      const otP = Number(a.overtimePayment !== undefined && a.overtimePayment !== null ? a.overtimePayment : (otH * overtimeRate));
      totalOtPayment += otP;

      if (a.dailyPayment !== undefined && a.dailyPayment !== null && a.dailyPayment > 0) {
        totalRecordedBasic += Number(a.dailyPayment);
        hasRecordedPayments = true;
      }
    });

    const basicWages = hasRecordedPayments ? totalRecordedBasic : (workDaysCredited * dailyWage);
    const grossEarnings = basicWages + totalOtPayment;

    // Advances in this month
    const advancesInMonth = workerAdvances.filter(
      (a) => a.date >= monthPeriod.startStr && a.date <= monthPeriod.endStr
    );

    const pendingAdvancesTotal = advancesInMonth
      .filter((a) => a.status === 'pending')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const deductedAdvancesTotal = advancesInMonth
      .filter((a) => a.status === 'deducted')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const totalAdvancesTaken = pendingAdvancesTotal + deductedAdvancesTotal;

    // Total Mess deductions:
    // Deduct mess charge whether worker is absent or half day or present.
    // Only unmarked days will NOT be calculated.
    // Full mess charge applies per marked calendar day (even for half-day or absent).
    const markedMessDates = new Set<string>();
    monthAttendance.forEach((a) => {
      if (!a.date) return;
      const st = (a.status || '').toLowerCase().trim();
      if (st === 'present' || st === 'half-day' || st === 'absent' || st === 'overtime') {
        markedMessDates.add(a.date);
      }
    });

    const messDaysCount = markedMessDates.size;
    const totalMessCharge = messDaysCount * messChargePerDay;

    const totalDeductions = totalAdvancesTaken + totalMessCharge;
    const netTakeHome = Math.max(0, grossEarnings - totalDeductions);

    // Is month settled?
    const isSettled = deductedAdvancesTotal > 0 && pendingAdvancesTotal === 0 && grossEarnings > 0;

    return {
      dailyWage,
      overtimeRate,
      fullDays,
      halfDays,
      absentDays,
      workDaysCredited,
      messDaysCount,
      messChargePerDay,
      totalOtHours,
      totalOtPayment,
      basicWages,
      grossEarnings,
      advancesInMonth,
      pendingAdvancesTotal,
      deductedAdvancesTotal,
      totalAdvancesTaken,
      totalMessCharge,
      totalDeductions,
      netTakeHome,
      isSettled,
    };
  }, [profile, monthAttendance, workerAdvances, monthPeriod]);

  // Skill Config
  const getSkillConfig = (level?: string) => {
    const l = level?.toLowerCase();
    switch (l) {
      case 'highly-skilled':
        return { label: 'HIGHLY SKILLED', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
      case 'skilled':
        return { label: 'SKILLED', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'semi-skilled':
        return { label: 'SEMI-SKILLED', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      case 'unskilled':
      default:
        return { label: 'UNSKILLED', bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const skill = getSkillConfig(profile?.skillLevel);
  const isActive = (profile?.status || 'active').toLowerCase() === 'active';

  // Logout Handler
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your worker portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          if (context?.logout) context.logout();
        },
      },
    ]);
  };

  // ==========================================
  // WAGE SLIP HTML PDF GENERATOR
  // ==========================================
  const generateWageSlipHtml = () => {
    const workerName = profile?.name || context?.user?.name || 'Worker';
    const workerPhone = profile?.phone || 'No phone recorded';
    const upiId = profile?.upiId || 'Not linked';
    const bankName = profile?.bankDetails?.bankName || 'State Bank of India';
    const accountNum = profile?.bankDetails?.accountNumber || '•••• •••• 4892';
    const ifsc = profile?.bankDetails?.ifscCode || 'SBIN0001234';

    const advancesRows = slipStats.advancesInMonth.length > 0
      ? slipStats.advancesInMonth
          .map(
            (a, idx) => `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>Advance: "${a.reason || 'General Cash Advance'}" (${a.date})</td>
            <td style="text-align:center;">${a.status.toUpperCase()}</td>
            <td style="text-align:right; font-weight:700; color:#DC2626;">₹${Number(a.amount || 0).toLocaleString()}</td>
          </tr>
        `
          )
          .join('')
      : '<tr><td colspan="4" style="text-align:center; padding:10px; color:#64748B;">No cash advances taken during this month</td></tr>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Wage Slip - ${workerName} (${monthPeriod.readableMonth})</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; line-height: 1.4; }
          .header-box { border-bottom: 2.5px solid #0F172A; padding-bottom: 10px; margin-bottom: 14px; }
          .brand-title { font-size: 22px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px; }
          .brand-sub { font-size: 11px; font-weight: 800; color: #EA580C; text-transform: uppercase; margin-top: 2px; }
          .doc-title { text-align: center; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 12px 0; background: #F1F5F9; padding: 6px; border-radius: 4px; }
          
          .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
          .grid-table td { padding: 5px 8px; border: 1px solid #CBD5E1; }
          .label-cell { background: #F8FAFC; font-weight: 700; color: #475569; width: 22%; }
          .val-cell { font-weight: 800; color: #0F172A; width: 28%; }

          .section-title { font-size: 11px; font-weight: 800; color: #0F172A; text-transform: uppercase; margin: 10px 0 4px 0; }
          .item-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; border: 1px solid #CBD5E1; }
          .item-table th { background: #0F172A; color: #FFFFFF; padding: 6px 8px; font-size: 9px; text-transform: uppercase; text-align: left; }
          .item-table td { padding: 6px 8px; border: 1px solid #E2E8F0; }
          .item-table tr:nth-child(even) { background: #F8FAFC; }

          .net-payout-box { background: #ECFDF5; border: 2px solid #10B981; border-radius: 6px; padding: 12px; text-align: center; margin: 16px 0; }
          .net-label { font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; }
          .net-val { font-size: 26px; font-weight: 900; color: #065F46; margin: 4px 0; }
          .net-sub { font-size: 10px; font-weight: 600; color: #047857; }

          .sig-table { width: 100%; margin-top: 35px; border-collapse: collapse; font-size: 10px; }
          .sig-table td { width: 50%; text-align: center; padding: 0 30px; }
          .sig-line { border-bottom: 1px solid #94A3B8; height: 35px; margin-bottom: 6px; }
          .sig-label { font-weight: 700; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <table style="width:100%;">
            <tr>
              <td>
                <div class="brand-title">CONSTLABOUR</div>
                <div class="brand-sub">${
                  language === 'hi' ? 'ठेकेदार कार्यबल प्रबंधन एवं मजदूरी संवितरण प्रणाली • WORKFORCE & WAGE DISBURSAL SYSTEM' :
                  language === 'bn' ? 'ঠিকাদার কর্মীবাহিনী ব্যবস্থাপনা ও মজুরি বিতরণ পদ্ধতি • WORKFORCE & WAGE DISBURSAL SYSTEM' :
                  'Contractor Workforce Management & Wage Disbursal System'
                }</div>
              </td>
              <td style="text-align:right; font-size:10px; color:#475569;">
                <div><strong>${language === 'hi' ? 'अवधि / Period:' : language === 'bn' ? 'সময়কাল / Period:' : 'Pay Period:'}</strong> ${monthPeriod.readableMonth}</div>
                <div><strong>${language === 'hi' ? 'तैयार / Generated:' : language === 'bn' ? 'উত্পন্ন / Generated:' : 'Generated:'}</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </td>
            </tr>
          </table>
        </div>

        <div class="doc-title">${
          language === 'hi' ? 'आधिकारिक मासिक कारीगर वेतन पर्ची • OFFICIAL MONTHLY CRAFTSMAN WAGE SLIP' :
          language === 'bn' ? 'অফিসিয়াল মাসিক কারিগর মজুরি স্লিপ • OFFICIAL MONTHLY CRAFTSMAN WAGE SLIP' :
          'Official Monthly Craftsman Wage Slip'
        }</div>

        <!-- Worker & Employment Details Grid -->
        <table class="grid-table">
          <tr>
            <td class="label-cell">${language === 'hi' ? 'श्रमिक का नाम / Worker:' : language === 'bn' ? 'শ্রমিকের নাম / Worker:' : 'Worker Name:'}</td>
            <td class="val-cell">${workerName}</td>
            <td class="label-cell">${language === 'hi' ? 'कौशल श्रेणी / Trade:' : language === 'bn' ? 'দক্ষতার শ্রেণী / Trade:' : 'Craft / Trade:'}</td>
            <td class="val-cell">${skill.label}</td>
          </tr>
          <tr>
            <td class="label-cell">${language === 'hi' ? 'मोबाइल नंबर / Mobile:' : language === 'bn' ? 'মোবাইল নম্বর / Mobile:' : 'Mobile Phone:'}</td>
            <td class="val-cell">+91 ${workerPhone}</td>
            <td class="label-cell">${language === 'hi' ? 'कार्यस्थल / Site:' : language === 'bn' ? 'সাইট / Site:' : 'Assigned Site:'}</td>
            <td class="val-cell">${assignedSiteName}</td>
          </tr>
          <tr>
            <td class="label-cell">${language === 'hi' ? 'दैनिक मूल दर / Base Wage:' : language === 'bn' ? 'দৈনিক মূল হার / Base Wage:' : 'Daily Base Wage:'}</td>
            <td class="val-cell">₹${slipStats.dailyWage} / ${language === 'hi' ? 'दिन / Day' : language === 'bn' ? 'দিন / Day' : 'Day'}</td>
            <td class="label-cell">${language === 'hi' ? 'ओवरटाइम दर / OT Rate:' : language === 'bn' ? 'ওভারটাইম হার / OT Rate:' : 'Overtime Rate:'}</td>
            <td class="val-cell">₹${slipStats.overtimeRate} / ${language === 'hi' ? 'घंटे / Hour' : language === 'bn' ? 'ঘণ্টা / Hour' : 'Hour'}</td>
          </tr>
          <tr>
            <td class="label-cell">${language === 'hi' ? 'बैंक खाता / Bank Account:' : language === 'bn' ? 'ব্যাংক অ্যাকাউন্ট / Bank Account:' : 'Bank & Account:'}</td>
            <td class="val-cell">${bankName} (${accountNum})</td>
            <td class="label-cell">${language === 'hi' ? 'यूपीआई आईडी / UPI ID:' : language === 'bn' ? 'ইউপিআই আইডি / UPI ID:' : 'UPI ID:'}</td>
            <td class="val-cell">${upiId}</td>
          </tr>
        </table>

        <!-- Work Attendance Summary Grid -->
        <div class="section-title">${
          language === 'hi' ? '1. उपस्थिति एवं शिफ्ट ड्यूटी क्रेडिट • Attendance & Shift Duty Credits' :
          language === 'bn' ? '১. উপস্থিতি ও শিফট ডিউটি ক্রেডিট • Attendance & Shift Duty Credits' :
          '1. Attendance & Shift Duty Credits'
        }</div>
        <table class="item-table">
          <thead>
            <tr>
              <th>${language === 'hi' ? 'ड्यूटी प्रकार / Duty Type' : language === 'bn' ? 'ডিউটির ধরন / Duty Type' : 'Duty Type'}</th>
              <th style="text-align:center;">${language === 'hi' ? 'दर्ज दिन/घंटे / Logged' : language === 'bn' ? 'লগ করা দিন/ঘণ্টা / Logged' : 'Days / Hours Logged'}</th>
              <th style="text-align:center;">${language === 'hi' ? 'लागू दर / Rate' : language === 'bn' ? 'প্রযুক্ত হার / Rate' : 'Rate Applied'}</th>
              <th style="text-align:right;">${language === 'hi' ? 'उप-कुल देय / Subtotal' : language === 'bn' ? 'উপ-মোট প্রদেয় / Subtotal' : 'Subtotal Payable'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Full Day Shifts (1.0 shift credit)</td>
              <td style="text-align:center; font-weight:700;">${slipStats.fullDays} Days</td>
              <td style="text-align:center;">₹${slipStats.dailyWage} / day</td>
              <td style="text-align:right; font-weight:800;">₹${(slipStats.fullDays * slipStats.dailyWage).toLocaleString()}</td>
            </tr>
            <tr>
              <td>Half Day Shifts (0.5 shift credit)</td>
              <td style="text-align:center; font-weight:700;">${slipStats.halfDays} Days (${slipStats.halfDays * 0.5} credit)</td>
              <td style="text-align:center;">₹${Math.round(slipStats.dailyWage / 2)} / half-day</td>
              <td style="text-align:right; font-weight:800;">₹${(slipStats.halfDays * Math.round(slipStats.dailyWage / 2)).toLocaleString()}</td>
            </tr>
            <tr>
              <td>Overtime (OT) Logged</td>
              <td style="text-align:center; font-weight:700;">${slipStats.totalOtHours.toFixed(1)} Hours</td>
              <td style="text-align:center;">₹${slipStats.overtimeRate} / hour</td>
              <td style="text-align:right; font-weight:800; color:#15803D;">+₹${slipStats.totalOtPayment.toLocaleString()}</td>
            </tr>
            <tr style="background:#F1F5F9; font-weight:900;">
              <td colspan="3">${language === 'hi' ? 'कुल सकल आय / TOTAL GROSS EARNINGS' : language === 'bn' ? 'মোট মোট আয় / TOTAL GROSS EARNINGS' : 'TOTAL GROSS EARNINGS ACCRUED'} (${slipStats.workDaysCredited} Shift Credits)</td>
              <td style="text-align:right; font-size:11px;">₹${slipStats.grossEarnings.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <!-- Advances & Deductions Breakdown -->
        <div class="section-title">${
          language === 'hi' ? '2. नकद अग्रिम एवं खर्चा कटौतियां • Itemized Cash Advances & Kharcha Deductions' :
          language === 'bn' ? '২. নগদ অগ্রিম ও খরচ কর্তন • Itemized Cash Advances & Kharcha Deductions' :
          '2. Itemized Cash Advances & Kharcha Deductions'
        }</div>
        <table class="item-table">
          <thead>
            <tr>
              <th style="width:6%;">#</th>
              <th>${language === 'hi' ? 'विवरण / उद्देश्य • Description' : language === 'bn' ? 'বিবরণ / উদ্দেশ্য • Description' : 'Description / Reason'}</th>
              <th style="text-align:center; width:20%;">${language === 'hi' ? 'स्थिति / Status' : language === 'bn' ? 'অবস্থা / Status' : 'Status'}</th>
              <th style="text-align:right; width:22%;">${language === 'hi' ? 'कटौती राशि / Deduction (₹)' : language === 'bn' ? 'কর্তন পরিমাণ / Deduction (₹)' : 'Deduction (₹)'}</th>
            </tr>
          </thead>
          <tbody>
            ${advancesRows}
            ${
              slipStats.totalMessCharge > 0
                ? `
              <tr>
                <td style="text-align:center;">#</td>
                <td>${
                  language === 'hi'
                    ? `मेस और भोजन शुल्क (${slipStats.messDaysCount} दिन × ₹${slipStats.messChargePerDay}/दिन • उपस्थित/हाफ-डे/अनुपस्थित)`
                    : language === 'bn'
                    ? `মেস ও খাবার খরচ (${slipStats.messDaysCount} দিন × ₹${slipStats.messChargePerDay}/দিন • উপস্থিতি/হাফ-ডে/অনুপস্থিত)`
                    : `Mess & Food Charges (${slipStats.messDaysCount} days @ ₹${slipStats.messChargePerDay}/d • marked days)`
                }</td>
                <td style="text-align:center;">DEDUCTED</td>
                <td style="text-align:right; font-weight:700; color:#DC2626;">₹${slipStats.totalMessCharge.toLocaleString()}</td>
              </tr>
            `
                : ''
            }
            <tr style="background:#FFF7ED; font-weight:900;">
              <td colspan="3" style="color:#EA580C;">${language === 'hi' ? 'कुल कटौतियां (खर्चा + मेस) • TOTAL DEDUCTIONS' : language === 'bn' ? 'মোট কর্তন (খরচ + মেস) • TOTAL DEDUCTIONS' : 'TOTAL DEDUCTIONS (Kharcha + Mess)'}</td>
              <td style="text-align:right; font-size:11px; color:#DC2626;">-₹${slipStats.totalDeductions.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <!-- Net Take Home Box -->
        <div class="net-payout-box">
          <div class="net-label">${
            language === 'hi' ? 'शुद्ध इन-हैंड संवितरण मजदूरी • NET TAKE-HOME DISBURSABLE WAGES' :
            language === 'bn' ? 'মোট প্রদেয় নিট মজুরি • NET TAKE-HOME DISBURSABLE WAGES' :
            'NET TAKE-HOME DISBURSABLE WAGES'
          }</div>
          <div class="net-val">₹${slipStats.netTakeHome.toLocaleString()}</div>
          <div class="net-sub">${
            language === 'hi' ? 'पंजीकृत यूपीआई / बैंक खाते में सीधा वितरण' :
            language === 'bn' ? 'নিবন্ধিত ইউপিআই / ব্যাংক অ্যাকাউন্টে সরাসরি বিতরণ' :
            'Direct disbursement to registered UPI / Bank Account'
          }</div>
        </div>

        <!-- Authorization Signatures -->
        <table class="sig-table">
          <tr>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${
                language === 'hi' ? 'कारीगर हस्ताक्षर / अंगूठे का निशान • Craftsman Signature / Thumb' :
                language === 'bn' ? 'শ্রমিকের স্বাক্ষর / টিপসই • Craftsman Signature / Thumb' :
                'Craftsman Signature / Thumb Impression'
              }</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">${
                language === 'hi' ? 'अधिकृत ठेकेदार हस्ताक्षर • Authorized Employer Signature' :
                language === 'bn' ? 'অনুমোদিত ঠিকাদার স্বাক্ষর • Authorized Employer Signature' :
                'Authorized Contractor / Employer Signature'
              }</div>
            </td>
          </tr>
        </table>
              <div class="sig-label">Authorized Site Contractor / Supervisor Signature</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-label">Craftsman / Worker Signature & Acknowledgment</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  const handleDownloadWageSlipPdf = async () => {
    if (generatingPdf || sharingPdf) return;
    setGeneratingPdf(true);
    try {
      const html = generateWageSlipHtml();
      await Print.printAsync({ html });
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Download Wage Slip PDF error:', err);
        Toast.show({ type: 'error', text1: 'Print Error', text2: 'Could not open print window' });
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareWageSlipPdf = async () => {
    if (sharingPdf || generatingPdf) return;
    setSharingPdf(true);
    try {
      const html = generateWageSlipHtml();
      const file = await Print.printToFileAsync({ html, base64: true });

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const cleanBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
      const workerNameSafe = (profile?.name || 'Worker').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `WageSlip_${workerNameSafe}_${monthPeriod.startStr}_to_${monthPeriod.endStr}.pdf`;
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
            dialogTitle: `Share Wage Slip - ${profile?.name || 'Worker'} (${monthPeriod.readableMonth})`,
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
        console.warn('ExpoFile.preview failed, fallback to native Share:', previewErr);
        await Share.share({
          message: `Worker Wage Slip for ${profile?.name || 'Worker'} - ${monthPeriod.readableMonth}: Net Payable ₹${slipStats.netTakeHome.toLocaleString()}`,
          url: pdfUriToShare,
          title: `Wage Slip - ${profile?.name || 'Worker'}`,
        });
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel') && !msg.includes('dismissed')) {
        console.error('Share Wage Slip PDF error:', err);
        Toast.show({ type: 'error', text1: 'Share Error', text2: 'Could not share wage slip' });
      }
    } finally {
      setSharingPdf(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP HEADER WITH CRAFTSMAN BRAND */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {language === 'hi' ? 'वेतन पर्ची एवं क्रेडेंशियल' : language === 'bn' ? 'মজুরি স্লিপ ও প্রমাণপত্র' : 'Wage Slip & Credentials'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {language === 'hi' ? 'आधिकारिक वेतन पर्ची, कार्य क्रेडिट और बैंक प्रोफ़ाइल' : language === 'bn' ? 'অফিসিয়াল পেস্লিপ, কাজের ক্রেডিট এবং ব্যাংক প্রোফাইল' : 'Official payslip, duty credits & bank profile'}
          </Text>
        </View>
        <View style={styles.idBadge}>
          <MaterialIcons name="verified" size={14} color="#FFFFFF" />
          <Text style={styles.idBadgeText}>{t('common.verified')}</Text>
        </View>
      </View>

      {/* 2. TOP SEGMENT SWITCHER */}
      <View style={styles.segmentSwitcher}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'wageslip' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('wageslip')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="receipt-long"
            size={18}
            color={activeTab === 'wageslip' ? '#FFFFFF' : colors.textMuted}
          />
          <Text style={[styles.segmentBtnText, activeTab === 'wageslip' && styles.segmentBtnTextActive]}>
            {t('workerPortal.wageSlip')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'profile' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="person"
            size={18}
            color={activeTab === 'profile' ? '#FFFFFF' : colors.textMuted}
          />
          <Text style={[styles.segmentBtnText, activeTab === 'profile' && styles.segmentBtnTextActive]}>
            {t('workerPortal.bankDetails')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {activeTab === 'wageslip' ? (
          /* ==========================================
             VIEW A: OFFICIAL WAGE SLIP (PAYSLIP)
             ========================================== */
          <View style={styles.wageSlipTabWrapper}>
            {/* Month Switcher Bar */}
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
                <Text style={styles.monthDisplayText}>{monthPeriod.readableMonth}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} activeOpacity={0.7}>
                <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
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

            {/* Wage Slip Card Preview */}
            <View style={styles.wageSlipCard}>
              {/* Slip Card Header */}
              <View style={styles.slipCardHeader}>
                <View>
                  <Text style={styles.slipBrandTitle}>CONSTLABOUR</Text>
                  <Text style={styles.slipBrandSub}>
                    {language === 'hi' ? 'आधिकारिक कारीगर वेतन पर्ची' : language === 'bn' ? 'অফিসিয়াল কারিগর মজুরি স্লিপ' : 'Official Craftsman Wage Slip'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.settleBadge,
                    { backgroundColor: slipStats.isSettled ? '#DCFCE7' : '#FFF7ED' },
                  ]}
                >
                  <Text
                    style={[
                      styles.settleBadgeText,
                      { color: slipStats.isSettled ? colors.successDark : '#C2410C' },
                    ]}
                  >
                    {slipStats.isSettled
                      ? (language === 'hi' ? 'भुगतान संपन्न' : language === 'bn' ? 'পরিশোধ সম্পন্ন' : 'SETTLED & PAID')
                      : (language === 'hi' ? 'लंबित भुगतान' : language === 'bn' ? 'বকেয়া পরিশোধ' : 'PENDING DISBURSAL')}
                  </Text>
                </View>
              </View>

              {/* Worker & Site Meta Bar */}
              <View style={styles.slipMetaGrid}>
                <View style={styles.slipMetaCol}>
                  <Text style={styles.slipMetaLabel}>
                    {language === 'hi' ? 'कारीगर' : language === 'bn' ? 'কারিগর' : 'CRAFTSMAN'}
                  </Text>
                  <Text style={styles.slipMetaVal}>{profile?.name || 'Worker'}</Text>
                  <Text style={styles.slipMetaSub}>{skill.label}</Text>
                </View>
                <View style={styles.slipMetaDivider} />
                <View style={styles.slipMetaCol}>
                  <Text style={styles.slipMetaLabel}>{t('workers.assignedSite').toUpperCase()}</Text>
                  <Text style={styles.slipMetaVal} numberOfLines={1}>
                    {assignedSiteName}
                  </Text>
                  <Text style={styles.slipMetaSub}>
                    {language === 'hi' ? 'दर' : language === 'bn' ? 'হার' : 'Rate'}: ₹{slipStats.dailyWage}/{language === 'hi' ? 'दिन' : language === 'bn' ? 'দিন' : 'd'}
                  </Text>
                </View>
              </View>

              {/* Attendance & Shift Summary Row */}
              <View style={styles.shiftSummaryRow}>
                <View style={styles.shiftSummaryItem}>
                  <Text style={styles.shiftSummaryLabel}>
                    {language === 'hi' ? 'पूरे दिन' : language === 'bn' ? 'পুরো দিন' : 'Full Days'}
                  </Text>
                  <Text style={styles.shiftSummaryVal}>{slipStats.fullDays}</Text>
                </View>
                <View style={styles.shiftSummaryItem}>
                  <Text style={styles.shiftSummaryLabel}>
                    {language === 'hi' ? 'आधे दिन' : language === 'bn' ? 'অর্ধ দিবস' : 'Half Days'}
                  </Text>
                  <Text style={styles.shiftSummaryVal}>{slipStats.halfDays}</Text>
                </View>
                <View style={styles.shiftSummaryItem}>
                  <Text style={styles.shiftSummaryLabel}>{t('attendance.overtime')}</Text>
                  <Text style={[styles.shiftSummaryVal, { color: colors.warningDark }]}>
                    {slipStats.totalOtHours.toFixed(1)}h
                  </Text>
                </View>
                <View style={styles.shiftSummaryItem}>
                  <Text style={styles.shiftSummaryLabel}>
                    {language === 'hi' ? 'शिफ्ट क्रेडिट' : language === 'bn' ? 'শিফট ক্রেডিট' : 'Shift Credits'}
                  </Text>
                  <Text style={[styles.shiftSummaryVal, { color: colors.successDark }]}>
                    {slipStats.workDaysCredited}
                  </Text>
                </View>
              </View>

              {/* Earnings Table */}
              <Text style={styles.sectionHeaderTitle}>
                {language === 'hi' ? '1. अर्जित आय विवरण' : language === 'bn' ? '১. অর্জিত মজুরি বিবরণ' : '1. EARNINGS BREAKDOWN'}
              </Text>
              <View style={styles.breakdownTable}>
                <View style={styles.breakdownTableRow}>
                  <Text style={styles.breakdownTableDesc}>
                    {language === 'hi'
                      ? `मूल शिफ्ट मजदूरी (${slipStats.workDaysCredited} शिफ्ट × ₹${slipStats.dailyWage})`
                      : language === 'bn'
                      ? `মূল শিফট মজুরি (${slipStats.workDaysCredited} শিফট × ₹${slipStats.dailyWage})`
                      : `Basic Shift Wages (${slipStats.workDaysCredited} shifts × ₹${slipStats.dailyWage})`}
                  </Text>
                  <Text style={styles.breakdownTableAmt}>₹{slipStats.basicWages.toLocaleString()}</Text>
                </View>

                {slipStats.totalOtPayment > 0 && (
                  <View style={styles.breakdownTableRow}>
                    <Text style={styles.breakdownTableDesc}>
                      {language === 'hi'
                        ? `ओवरटाइम मुआवजा (${slipStats.totalOtHours.toFixed(1)} घंटे × ₹${slipStats.overtimeRate})`
                        : language === 'bn'
                        ? `ওভারটাইম ক্ষতিপূরণ (${slipStats.totalOtHours.toFixed(1)} ঘণ্টা × ₹${slipStats.overtimeRate})`
                        : `Overtime Compensation (${slipStats.totalOtHours.toFixed(1)} hrs × ₹${slipStats.overtimeRate})`}
                    </Text>
                    <Text style={[styles.breakdownTableAmt, { color: colors.successDark }]}>
                      +₹{slipStats.totalOtPayment.toLocaleString()}
                    </Text>
                  </View>
                )}

                <View style={[styles.breakdownTableRow, styles.breakdownTotalRow]}>
                  <Text style={styles.breakdownTotalLabel}>
                    {language === 'hi' ? 'कुल सकल आय' : language === 'bn' ? 'মোট আয়' : 'TOTAL GROSS EARNINGS'}
                  </Text>
                  <Text style={styles.breakdownTotalAmt}>₹{slipStats.grossEarnings.toLocaleString()}</Text>
                </View>
              </View>

              {/* Deductions Table */}
              <Text style={styles.sectionHeaderTitle}>
                {language === 'hi' ? '2. कटौती एवं अग्रिम' : language === 'bn' ? '২. কর্তন ও অগ্রিম' : '2. DEDUCTIONS & ADVANCES'}
              </Text>
              <View style={styles.breakdownTable}>
                {slipStats.advancesInMonth.length === 0 && slipStats.totalMessCharge === 0 ? (
                  <View style={styles.breakdownTableRow}>
                    <Text style={[styles.breakdownTableDesc, { color: colors.textMuted }]}>
                      {language === 'hi' ? 'कोई खर्चा या कटौती दर्ज नहीं' : language === 'bn' ? 'কোনো খরচ বা কর্তন লিপিবদ্ধ নেই' : 'No kharcha or deductions recorded'}
                    </Text>
                    <Text style={styles.breakdownTableAmt}>₹0</Text>
                  </View>
                ) : (
                  slipStats.advancesInMonth.map((adv) => (
                    <View key={adv.id} style={styles.breakdownTableRow}>
                      <Text style={styles.breakdownTableDesc}>
                        {language === 'hi' ? 'खर्चा:' : language === 'bn' ? 'খরচ:' : 'Kharcha:'} "{adv.reason || (language === 'hi' ? 'नकद अग्रिम' : language === 'bn' ? 'নগদ অগ্রিম' : 'Cash Advance')}" ({adv.date})
                      </Text>
                      <Text style={[styles.breakdownTableAmt, { color: colors.error }]}>
                        -₹{Number(adv.amount || 0).toLocaleString()}
                      </Text>
                    </View>
                  ))
                )}

                {slipStats.totalMessCharge > 0 && (
                  <View style={styles.breakdownTableRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.breakdownTableDesc}>
                        {language === 'hi'
                          ? `मेस / भोजन शुल्क (${slipStats.messDaysCount} दिन × ₹${slipStats.messChargePerDay})`
                          : language === 'bn'
                          ? `মেস / খাবার খরচ (${slipStats.messDaysCount} দিন × ₹${slipStats.messChargePerDay})`
                          : `Mess / Meal Charges (${slipStats.messDaysCount} days × ₹${slipStats.messChargePerDay})`}
                      </Text>
                      <Text style={styles.deductionSubDesc}>
                        {language === 'hi'
                          ? `${slipStats.messDaysCount} चिह्नित दिन (उपस्थित: ${slipStats.fullDays}, हाफ-डे: ${slipStats.halfDays}, अनुपस्थित: ${slipStats.absentDays}) • अचिह्नित दिन छोड़कर`
                          : language === 'bn'
                          ? `${slipStats.messDaysCount} চিহ্নিত দিন (উপস্থিতি: ${slipStats.fullDays}, হাফ-ডে: ${slipStats.halfDays}, অনুপস্থিত: ${slipStats.absentDays}) • অচিহ্নিত দিন ব্যতীত`
                          : `${slipStats.messDaysCount} marked days (P: ${slipStats.fullDays}, Half: ${slipStats.halfDays}, Absent: ${slipStats.absentDays}) • Unmarked excluded`}
                      </Text>
                    </View>
                    <Text style={[styles.breakdownTableAmt, { color: colors.error }]}>
                      -₹{slipStats.totalMessCharge.toLocaleString()}
                    </Text>
                  </View>
                )}

                <View style={[styles.breakdownTableRow, styles.breakdownDeductTotalRow]}>
                  <Text style={[styles.breakdownTotalLabel, { color: '#C2410C' }]}>
                    {language === 'hi' ? 'कुल कटौती' : language === 'bn' ? 'মোট কর্তন' : 'TOTAL DEDUCTIONS'}
                  </Text>
                  <Text style={[styles.breakdownTotalAmt, { color: colors.error }]}>
                    -₹{slipStats.totalDeductions.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Net Take-Home Payout Hero */}
              <View style={styles.netTakeHomeCard}>
                <Text style={styles.netTakeHomeLabel}>
                  {language === 'hi' ? 'शुद्ध इन-हैंड मजदूरी' : language === 'bn' ? 'মোট প্রদেয় মজুরি' : 'NET TAKE-HOME WAGE'}
                </Text>
                <Text style={styles.netTakeHomeVal}>₹{slipStats.netTakeHome.toLocaleString()}</Text>
                <Text style={styles.netTakeHomeSub}>
                  {language === 'hi'
                    ? `यूपीआई द्वारा वितरण: ${profile?.upiId || 'सीधे बैंक खाते में'}`
                    : language === 'bn'
                    ? `ইউপিআই মারফত বিতরণ: ${profile?.upiId || 'সরাসরি ব্যাংক অ্যাকাউন্টে'}`
                    : `Disbursal via UPI: ${profile?.upiId || 'Direct Bank Account'}`}
                </Text>
              </View>
            </View>

            {/* Action Buttons: Download PDF & Share PDF */}
            <View style={styles.slipActionsRow}>
              <TouchableOpacity
                style={styles.downloadSlipBtn}
                onPress={handleDownloadWageSlipPdf}
                disabled={generatingPdf || sharingPdf}
                activeOpacity={0.85}
              >
                {generatingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="print" size={18} color="#FFFFFF" />
                    <Text style={styles.downloadSlipBtnText}>{t('common.download')} (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareSlipBtn}
                onPress={handleShareWageSlipPdf}
                disabled={sharingPdf || generatingPdf}
                activeOpacity={0.85}
              >
                {sharingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="share" size={18} color="#FFFFFF" />
                    <Text style={styles.shareSlipBtnText}>{t('common.share')} (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ==========================================
             VIEW B: WORKER PROFILE & BANK KYC
             ========================================== */
          <View style={styles.profileTabWrapper}>
            {/* Profile Identity Card */}
            <View style={styles.profileHero}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.name || context?.user?.name || 'W').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.profileName}>{profile?.name || context?.user?.name || 'Worker'}</Text>
              <Text style={styles.profilePhone}>{profile?.phone || 'No phone recorded'}</Text>

              <View style={styles.badgesRow}>
                <View style={[styles.skillBadge, { backgroundColor: skill.bg, borderColor: skill.border }]}>
                  <Text style={[styles.skillBadgeText, { color: skill.text }]}>{skill.label}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isActive ? '#ECFDF5' : '#FEF2F2',
                      borderColor: isActive ? '#A7F3D0' : '#FECACA',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isActive ? colors.success : colors.error },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: isActive ? colors.successDark : colors.errorDark },
                    ]}
                  >
                    {isActive ? t('common.active') : t('common.inactive')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Daily Compensation Bento */}
            <View style={styles.wageCard}>
              <View style={styles.wageHeader}>
                <MaterialIcons name="monetization-on" size={18} color={colors.accent} />
                <Text style={styles.wageHeaderTitle}>
                  {language === 'hi' ? 'दैनिक मजदूरी संरचना' : language === 'bn' ? 'দৈনিক মজুরি কাঠামো' : 'DAILY WAGE STRUCTURE'}
                </Text>
              </View>
              <View style={styles.wageGrid}>
                <View style={styles.wageCol}>
                  <Text style={styles.wageSublabel}>
                    {language === 'hi' ? 'मूल दर' : language === 'bn' ? 'মূল হার' : 'BASE WAGE'}
                  </Text>
                  <Text style={styles.wageValue}>₹{profile?.dailyWage || 0}</Text>
                </View>
                <View style={styles.wageDivider} />
                <View style={styles.wageCol}>
                  <Text style={styles.wageSublabel}>
                    {t('attendance.overtime').toUpperCase()}
                  </Text>
                  <Text style={[styles.wageValue, { color: colors.warningDark }]}>
                    ₹{profile?.overtimeRate || 100}/{language === 'hi' ? 'घंटे' : language === 'bn' ? 'ঘণ্টা' : 'h'}
                  </Text>
                </View>
                <View style={styles.wageDivider} />
                <View style={styles.wageCol}>
                  <Text style={styles.wageSublabel}>
                    {language === 'hi' ? 'मेस कटौती' : language === 'bn' ? 'মেস কর্তন' : 'MESS CHARGE'}
                  </Text>
                  <Text style={[styles.wageValue, { color: colors.error }]}>
                    -₹{profile?.messCharge || 0}
                  </Text>
                </View>
              </View>
            </View>

            {/* Deployment & Contractor Bento */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <MaterialIcons name="business" size={18} color={colors.primary} />
                <Text style={styles.sectionCardTitle}>
                  {language === 'hi' ? 'तैनाती एवं नियोक्ता' : language === 'bn' ? 'নিয়োগ ও নিয়োগকর্তা' : 'ASSIGNMENT & EMPLOYER'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('workers.assignedSite')}</Text>
                <Text style={styles.infoValue}>{assignedSiteName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {language === 'hi' ? 'ठेकेदार संस्था' : language === 'bn' ? 'ঠিকাদার সংস্থা' : 'Contractor Organization'}
                </Text>
                <Text style={styles.infoValue}>{profile?.contractorName || (language === 'hi' ? 'मुख्य ठेकेदार' : language === 'bn' ? 'প্রধান ঠিকাদার' : 'Prime Contractor')}</Text>
              </View>
              {profile?.createdAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    {language === 'hi' ? 'पंजीकरण तिथि' : language === 'bn' ? 'নিবন্ধনের তারিখ' : 'Registration Date'}
                  </Text>
                  <Text style={styles.infoValue}>
                    {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* Bank Disbursement & UPI Details */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <MaterialIcons name="account-balance" size={18} color={colors.primary} />
                <Text style={styles.sectionCardTitle}>
                  {language === 'hi' ? 'बैंक भुगतान एवं यूपीआई विवरण' : language === 'bn' ? 'ব্যাংক লেনদেন ও ইউপিআই বিবরণ' : 'BANK DISBURSEMENT & UPI DETAILS'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('workers.bankName')}</Text>
                <Text style={styles.infoValue}>{profile?.bankDetails?.bankName || 'State Bank of India'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('workers.bankAccountNumber')}</Text>
                <Text style={styles.infoValue}>{profile?.bankDetails?.accountNumber || '•••• •••• 4892'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IFSC Code</Text>
                <Text style={styles.infoValue}>{profile?.bankDetails?.ifscCode || 'SBIN0001234'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Direct UPI ID</Text>
                <Text style={[styles.infoValue, { color: colors.accent, fontWeight: '800' }]}>
                  {profile?.upiId ? `⚡ ${profile.upiId}` : (language === 'hi' ? 'पंजीकृत नहीं' : language === 'bn' ? 'নিবন্ধিত নয়' : 'Not registered')}
                </Text>
              </View>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
              <MaterialIcons name="logout" size={18} color={colors.error} />
              <Text style={styles.logoutButtonText}>{t('auth.logout')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  idBadge: {
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
  idBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  segmentSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: radii.md,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radii.sm,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.accent,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  wageSlipTabWrapper: {
    gap: 10,
  },
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingHorizontal: 6,
    paddingVertical: 6,
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
  wageSlipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.card,
  },
  slipCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
  },
  slipBrandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  slipBrandSub: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    textTransform: 'uppercase',
  },
  settleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  settleBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  slipMetaGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slipMetaCol: {
    flex: 1,
  },
  slipMetaDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  slipMetaLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  slipMetaVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  slipMetaSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  shiftSummaryRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  shiftSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  shiftSummaryLabel: {
    fontSize: 8.5,
    color: colors.textMuted,
    fontWeight: '700',
  },
  shiftSummaryVal: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  breakdownTable: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  breakdownTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  breakdownTableDesc: {
    fontSize: 11,
    color: colors.text,
    flex: 1,
  },
  deductionSubDesc: {
    fontSize: 9.5,
    color: '#9A3412',
    marginTop: 2,
    fontWeight: '500',
  },
  breakdownTableAmt: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 8,
  },
  breakdownTotalRow: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
  },
  breakdownTotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  breakdownTotalAmt: {
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.primary,
  },
  breakdownDeductTotalRow: {
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 0,
  },
  netTakeHomeCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: radii.lg,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  netTakeHomeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.successDark,
    letterSpacing: 0.8,
  },
  netTakeHomeVal: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.successDark,
    marginVertical: 2,
  },
  netTakeHomeSub: {
    fontSize: 10.5,
    color: '#065F46',
    fontWeight: '600',
  },
  slipActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  downloadSlipBtn: {
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
  downloadSlipBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shareSlipBtn: {
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
  shareSlipBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileTabWrapper: {
    gap: 12,
  },
  profileHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.sm,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  profilePhone: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  skillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  wageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  wageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  wageHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  wageGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wageCol: {
    flex: 1,
    alignItems: 'center',
  },
  wageDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  wageSublabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.textMuted,
  },
  wageValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.error,
  },
});
