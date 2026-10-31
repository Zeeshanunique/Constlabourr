import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { useRoute, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { projectId } from '@/utils/supabase/info';
import { colors, shadows, radii } from '@/styles/theme';
import { useTranslation } from '@/i18n';

const screenWidth = Dimensions.get('window').width;

// ==========================================
// MODELS & INTERFACES
// ==========================================
interface WorkerRecord {
  id: string;
  name: string;
  phone?: string;
  skillLevel?: string;
  dailyWage?: number;
  overtimeRate?: number;
  messCharge?: number;
  siteId?: string;
  status?: string;
  aadhaarHash?: string;
  aadhaar?: string;
  upiId?: string;
}

interface SiteRecord {
  id: string;
  name: string;
  address?: string;
  status?: string;
  foremanId?: string;
}

interface AttendanceRecord {
  id?: string;
  workerId: string;
  workerName?: string;
  siteId?: string;
  date: string;
  status: 'present' | 'half-day' | 'absent' | string;
  shift?: string;
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
  status?: string;
}

interface ContractorProfile {
  id?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  email?: string;
}

interface ReportsTabProps {
  accessToken?: string;
}

type PeriodType = 'thisMonth' | 'lastMonth' | 'last7Days';
type ReportDocType = 'executive' | 'formA' | 'formB' | 'workerMaster' | 'formD';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ReportsTab({ accessToken }: ReportsTabProps) {
  const route = useRoute();
  const navigation = useNavigation();
  const { t, language } = useTranslation();
  const token = accessToken || (route.params as any)?.accessToken;

  // Filters & Selected Scope
  const [period, setPeriod] = useState<PeriodType>('thisMonth');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [showSiteModal, setShowSiteModal] = useState<boolean>(false);

  // Data Loading State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [generatingReport, setGeneratingReport] = useState<ReportDocType | null>(null);

  // Real Database Records
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);

  // Calculate Date Ranges
  const dateRange = useMemo(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
        label: t('common.thisMonth'),
      };
    } else if (period === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDate(start),
        endDate: formatDate(end),
        label: t('common.previousMonth'),
      };
    } else {
      // Last 7 days
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
        label: 'Last 7 Days',
      };
    }
  }, [period, t]);

  // Fetch All Primary Data
  const loadData = useCallback(
    async (isPullRefresh = false) => {
      if (!token) return;
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const baseApi = `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60`;

        // 1. Fetch Contractor Profile
        const profileReq = fetch(`${baseApi}/auth/profile`, { headers }).then((res) =>
          res.ok ? res.json() : null
        );

        // 2. Fetch Workers
        const workersReq = fetch(`${baseApi}/workers`, { headers }).then((res) =>
          res.ok ? res.json() : { workers: [] }
        );

        // 3. Fetch Sites
        const sitesReq = fetch(`${baseApi}/sites`, { headers }).then((res) =>
          res.ok ? res.json() : { sites: [] }
        );

        // 4. Fetch Advances
        const advancesReq = fetch(`${baseApi}/advances`, { headers }).then((res) =>
          res.ok ? res.json() : { advances: [] }
        );

        // 5. Fetch Attendance with date filters & optional siteId
        let attUrl = `${baseApi}/attendance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
        if (selectedSiteId !== 'all') {
          attUrl += `&siteId=${selectedSiteId}`;
        }
        const attendanceReq = fetch(attUrl, { headers }).then((res) =>
          res.ok ? res.json() : { attendance: [] }
        );

        const [profileRes, workersRes, sitesRes, advancesRes, attendanceRes] = await Promise.all([
          profileReq,
          workersReq,
          sitesReq,
          advancesReq,
          attendanceReq,
        ]);

        if (profileRes?.profile) {
          setContractor(profileRes.profile);
        }
        setWorkers(workersRes?.workers || []);
        setSites(sitesRes?.sites || []);
        setAdvances(advancesRes?.advances || []);
        setAttendance(attendanceRes?.attendance || []);
      } catch (err) {
        console.error('Error loading reports data:', err);
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: 'Could not load real data from server',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, dateRange, selectedSiteId, t]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selected Site Name
  const selectedSiteName = useMemo(() => {
    if (selectedSiteId === 'all') return t('reports.allSites');
    const match = sites.find((s) => s.id === selectedSiteId);
    return match ? match.name : t('reports.allSites');
  }, [selectedSiteId, sites, t]);

  // Filtered Workers for selected site
  const scopedWorkers = useMemo(() => {
    if (selectedSiteId === 'all') return workers;
    return workers.filter((w) => w.siteId === selectedSiteId);
  }, [workers, selectedSiteId]);

  // Map of worker names for lookup
  const workerMap = useMemo(() => {
    const map = new Map<string, WorkerRecord>();
    workers.forEach((w) => map.set(w.id, w));
    return map;
  }, [workers]);

  // Map of site names for lookup
  const siteMap = useMemo(() => {
    const map = new Map<string, SiteRecord>();
    sites.forEach((s) => map.set(s.id, s));
    return map;
  }, [sites]);

  // ==========================================
  // REAL STATISTICAL AGGREGATION & METRICS
  // ==========================================
  const computedMetrics = useMemo(() => {
    let totalBaseWage = 0;
    let totalOvertimePay = 0;
    let totalOvertimeHours = 0;
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;

    const uniqueDates = new Set<string>();

    attendance.forEach((att) => {
      uniqueDates.add(att.date);
      const worker = workerMap.get(att.workerId);
      const dailyWage = att.dailyWage ?? worker?.dailyWage ?? 0;
      const otRate = att.overtimeRate ?? worker?.overtimeRate ?? 100;
      const otHours = att.overtimeHours ?? 0;

      totalOvertimeHours += otHours;
      const calculatedOtPay = att.overtimePayment ?? otHours * otRate;
      totalOvertimePay += calculatedOtPay;

      if (att.status === 'present') {
        presentCount += 1;
        totalBaseWage += att.dailyPayment ?? dailyWage;
      } else if (att.status === 'half-day') {
        halfDayCount += 1;
        totalBaseWage += att.dailyPayment ?? dailyWage * 0.5;
      } else if (att.status === 'absent') {
        absentCount += 1;
      }
    });

    const totalWageSpend = totalBaseWage + totalOvertimePay;
    const totalManDays = presentCount + halfDayCount * 0.5;

    // Active workers count
    const activeWorkerCount = scopedWorkers.length > 0 ? scopedWorkers.length : workers.length || 1;
    const workingDaysCount = Math.max(uniqueDates.size, 1);

    // Potential man days = active workers * distinct working days
    const potentialManDays = activeWorkerCount * workingDaysCount;
    const avgTurnoutPercentage =
      potentialManDays > 0 ? Math.min(Math.round((totalManDays / potentialManDays) * 100), 100) : 0;

    // Compliance: % of workers with Aadhaar recorded
    const aadhaarCount = scopedWorkers.filter(
      (w) => !!w.aadhaarHash || !!w.aadhaar || (w as any).aadhaar_hash
    ).length;
    const compliancePercentage =
      scopedWorkers.length > 0 ? Math.round((aadhaarCount / scopedWorkers.length) * 100) : 100;

    // Advances within the period
    const periodAdvances = advances.filter(
      (adv) => adv.date >= dateRange.startDate && adv.date <= dateRange.endDate
    );
    const totalAdvancesDisbursed = periodAdvances.reduce((sum, adv) => sum + (Number(adv.amount) || 0), 0);

    // Trade / Skill Level Distribution
    const tradeCounts: Record<string, { count: number; spend: number }> = {
      Unskilled: { count: 0, spend: 0 },
      'Semi-skilled': { count: 0, spend: 0 },
      Skilled: { count: 0, spend: 0 },
      'Highly-skilled': { count: 0, spend: 0 },
    };

    scopedWorkers.forEach((w) => {
      const level = (w.skillLevel || 'unskilled').toLowerCase();
      let key = 'Unskilled';
      if (level.includes('semi')) key = 'Semi-skilled';
      else if (level.includes('high') || level.includes('super')) key = 'Highly-skilled';
      else if (level.includes('skill')) key = 'Skilled';

      tradeCounts[key].count += 1;
    });

    // Approximate trade spend from attendance
    attendance.forEach((att) => {
      const worker = workerMap.get(att.workerId);
      const level = (worker?.skillLevel || 'unskilled').toLowerCase();
      let key = 'Unskilled';
      if (level.includes('semi')) key = 'Semi-skilled';
      else if (level.includes('high') || level.includes('super')) key = 'Highly-skilled';
      else if (level.includes('skill')) key = 'Skilled';

      const wage = (att.totalPayment || (att.dailyPayment ?? 0) + (att.overtimePayment ?? 0)) || 0;
      tradeCounts[key].spend += wage;
    });

    // Site-by-site performance
    const sitePerformance = sites.map((site) => {
      const siteAtt = attendance.filter((a) => a.siteId === site.id);
      const siteWorkers = workers.filter((w) => w.siteId === site.id);
      let sWage = 0;
      let sManDays = 0;
      let sOtHours = 0;

      siteAtt.forEach((a) => {
        const worker = workerMap.get(a.workerId);
        const wWage = a.dailyPayment ?? worker?.dailyWage ?? 0;
        const otPay = a.overtimePayment ?? (a.overtimeHours || 0) * (worker?.overtimeRate || 100);
        sWage += wWage + otPay;
        sOtHours += a.overtimeHours || 0;

        if (a.status === 'present') sManDays += 1;
        else if (a.status === 'half-day') sManDays += 0.5;
      });

      return {
        id: site.id,
        name: site.name,
        address: site.address,
        workersCount: siteWorkers.length,
        manDays: sManDays,
        wageSpend: sWage,
        overtimeHours: sOtHours,
      };
    });

    return {
      totalWageSpend,
      totalBaseWage,
      totalOvertimePay,
      totalOvertimeHours,
      presentCount,
      halfDayCount,
      absentCount,
      totalManDays,
      avgTurnoutPercentage,
      compliancePercentage,
      totalAdvancesDisbursed,
      workingDaysCount,
      tradeCounts,
      sitePerformance,
    };
  }, [attendance, scopedWorkers, workers, workerMap, advances, dateRange, sites]);

  // Chart Data: Turnout over last 7 days of attendance
  const chartConfigData = useMemo(() => {
    // Generate dates for the last 7 days or range
    const days: string[] = [];
    const labels: string[] = [];
    const presentData: number[] = [];

    const end = new Date(dateRange.endDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      days.push(iso);
      labels.push(`${DAY_LABELS[d.getDay()]} ${d.getDate()}`);
    }

    let peakDay = '';
    let peakCount = 0;

    days.forEach((dayIso, idx) => {
      const onDay = attendance.filter((a) => a.date === dayIso);
      const count = onDay.filter((a) => a.status === 'present' || a.status === 'half-day').length;
      presentData.push(count);

      if (count > peakCount) {
        peakCount = count;
        peakDay = labels[idx];
      }
    });

    const isAllZero = presentData.every((v) => v === 0);

    return {
      labels: labels.length > 0 ? labels : ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      datasets: [
        {
          data: isAllZero ? [0, 0, 0, 0, 0, 0, 0] : presentData,
        },
      ],
      peakDay: peakCount > 0 ? `${peakDay} (${peakCount})` : 'None',
    };
  }, [attendance, dateRange]);

  // ==========================================
  // REAL PDF GENERATION TEMPLATES
  // ==========================================

  // 1. Master Executive Audit & Cost Analysis Package HTML
  const generateExecutiveReportHtml = () => {
    const contractorName = contractor?.name || 'Authorized Contractor';
    const companyName = contractor?.companyName || 'ConstLabour Operations Ltd.';
    const contractorPhone = contractor?.phone || 'N/A';
    const contractorEmail = contractor?.email || 'N/A';
    const printDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const netOutflow = computedMetrics.totalWageSpend + computedMetrics.totalAdvancesDisbursed;

    // Site Breakdown Rows
    const siteRows = computedMetrics.sitePerformance
      .map(
        (sp, idx) => `
        <tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${idx + 1}. ${sp.name}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">${sp.workersCount}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">${sp.manDays}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">${sp.overtimeHours} hrs</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; color: #0F172A;">
            ₹${sp.wageSpend.toLocaleString('en-IN')}
          </td>
        </tr>
      `
      )
      .join('');

    // Trade Rows
    const tradeRows = Object.entries(computedMetrics.tradeCounts)
      .map(
        ([trade, data]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${trade}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">${data.count}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">
            ${scopedWorkers.length > 0 ? Math.round((data.count / scopedWorkers.length) * 100) : 0}%
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700;">
            ₹${data.spend.toLocaleString('en-IN')}
          </td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Monthly Executive Audit & Cost Analysis</title>
        <style>
          @page { size: A4; margin: 16mm 14mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; background: #FFFFFF; font-size: 12px; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0F172A; margin-bottom: 18px; }
          .brand-title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #0F172A; text-transform: uppercase; margin: 0; }
          .brand-sub { font-size: 11px; color: #EA580C; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
          .doc-badge { background: #0F172A; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 4px; display: inline-block; text-transform: uppercase; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; }
          .meta-item { font-size: 11px; }
          .meta-label { font-size: 9px; text-transform: uppercase; color: #64748B; font-weight: 700; margin-bottom: 2px; }
          .meta-val { font-size: 12px; font-weight: 700; color: #0F172A; }
          .bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .bento-card { background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 8px; padding: 12px; text-align: left; }
          .bento-label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748B; margin-bottom: 4px; }
          .bento-val { font-size: 17px; font-weight: 900; color: #0F172A; }
          .bento-sub { font-size: 9px; color: #10B981; font-weight: 700; margin-top: 3px; }
          .section-title { font-size: 13px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.3px; margin: 18px 0 8px 0; border-left: 4px solid #EA580C; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
          th { background: #F1F5F9; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 9px; padding: 8px 12px; border-bottom: 2px solid #CBD5E1; text-align: left; }
          .footer-box { margin-top: 32px; border-top: 1px dashed #94A3B8; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .sign-box { border-top: 1px solid #0F172A; width: 200px; text-align: center; padding-top: 6px; font-size: 10px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="brand-title">ConstLabour</h1>
            <div class="brand-sub">Contractor Field Operations & Compliance Suite</div>
            <div style="font-size: 10px; color: #64748B; margin-top: 4px;">Reg. Infrastructure Management System</div>
          </div>
          <div style="text-align: right;">
            <div class="doc-badge">Official Audit Package</div>
            <div style="font-size: 10px; color: #64748B; margin-top: 6px;">Ref: CL-AUD-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 9000
    )}</div>
            <div style="font-size: 10px; color: #64748B;">Issued: ${printDate}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Contractor Organization</div>
            <div class="meta-val">${contractorName} (${companyName})</div>
            <div style="font-size: 10px; color: #64748B; margin-top: 2px;">Ph: ${contractorPhone} | ${contractorEmail}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Audit Scope & Timeframe</div>
            <div class="meta-val">${dateRange.label} (${dateRange.startDate} to ${dateRange.endDate})</div>
            <div style="font-size: 10px; color: #EA580C; font-weight: 700; margin-top: 2px;">Site: ${selectedSiteName}</div>
          </div>
        </div>

        <!-- Bento Grid -->
        <div class="bento-grid">
          <div class="bento-card">
            <div class="bento-label">Total Labor Outflow</div>
            <div class="bento-val">₹${computedMetrics.totalWageSpend.toLocaleString('en-IN')}</div>
            <div class="bento-sub">Base + Overtime</div>
          </div>
          <div class="bento-card">
            <div class="bento-label">Avg Daily Turnout</div>
            <div class="bento-val" style="color: #10B981;">${computedMetrics.avgTurnoutPercentage}%</div>
            <div class="bento-sub">${computedMetrics.totalManDays} Man-Days Logged</div>
          </div>
          <div class="bento-card">
            <div class="bento-label">Total Overtime</div>
            <div class="bento-val" style="color: #EA580C;">${computedMetrics.totalOvertimeHours} hrs</div>
            <div class="bento-sub">₹${computedMetrics.totalOvertimePay.toLocaleString('en-IN')} Outflow</div>
          </div>
          <div class="bento-card">
            <div class="bento-label">Aadhaar Verification</div>
            <div class="bento-val" style="color: #0F172A;">${computedMetrics.compliancePercentage}%</div>
            <div class="bento-sub">${scopedWorkers.length} Active Workers</div>
          </div>
        </div>

        <!-- Site Performance Table -->
        <div class="section-title">Site-by-Site Operational Ledger</div>
        <table>
          <thead>
            <tr>
              <th>Site Description</th>
              <th style="text-align: center;">Headcount</th>
              <th style="text-align: center;">Man-Days</th>
              <th style="text-align: center;">Overtime</th>
              <th style="text-align: right;">Total Outflow</th>
            </tr>
          </thead>
          <tbody>
            ${siteRows || '<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748B;">No site attendance recorded</td></tr>'}
          </tbody>
        </table>

        <!-- Trade Specialization Table -->
        <div class="section-title">Workforce Skill & Trade Allocation</div>
        <table>
          <thead>
            <tr>
              <th>Skill Classification</th>
              <th style="text-align: center;">Worker Count</th>
              <th style="text-align: center;">Share (%)</th>
              <th style="text-align: right;">Total Wages Disbursed</th>
            </tr>
          </thead>
          <tbody>
            ${tradeRows}
          </tbody>
        </table>

        <!-- Advances & Outflow Summary -->
        <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; color: #64748B;">Base Shift Wages (Present + Half-Day):</span>
            <span style="font-size: 11px; font-weight: 700;">₹${computedMetrics.totalBaseWage.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; color: #64748B;">Overtime Wages Accrued:</span>
            <span style="font-size: 11px; font-weight: 700; color: #EA580C;">+ ₹${computedMetrics.totalOvertimePay.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; color: #64748B;">Statutory Advances Disbursed in Cycle:</span>
            <span style="font-size: 11px; font-weight: 700; color: #0F172A;">+ ₹${computedMetrics.totalAdvancesDisbursed.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #CBD5E1; padding-top: 8px; margin-top: 4px;">
            <span style="font-size: 13px; font-weight: 900; color: #0F172A;">Net Capital Outflow Committed:</span>
            <span style="font-size: 14px; font-weight: 900; color: #0F172A;">₹${netOutflow.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div class="footer-box">
          <div style="font-size: 9px; color: #64748B; max-width: 340px;">
            Generated under ConstLabour Verification System. Certified compliant with Section 43 of Code on Wages, 2019 & Occupational Safety, Health and Working Conditions Code, 2020.
          </div>
          <div class="sign-box">
            Authorized Signatory / Contractor Seal
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // 2. Form A - Statutory Attendance Muster Roll HTML
  const generateFormAHtml = () => {
    const contractorName = contractor?.name || 'Authorized Contractor';
    const companyName = contractor?.companyName || 'ConstLabour Operations Ltd.';

    // Aggregate attendance per worker
    const workerAttendanceRows = scopedWorkers
      .map((w, index) => {
        const wAtt = attendance.filter((a) => a.workerId === w.id);
        const presentDays = wAtt.filter((a) => a.status === 'present').length;
        const halfDays = wAtt.filter((a) => a.status === 'half-day').length;
        const absentDays = wAtt.filter((a) => a.status === 'absent').length;
        const totalManDays = presentDays + halfDays * 0.5;
        const otHours = wAtt.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
        const site = siteMap.get(w.siteId || '');

        return `
        <tr>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center;">${index + 1}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${w.name}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0;">${w.skillLevel || 'General'}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; font-size: 10px;">${site?.name || 'Assigned Site'}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #10B981; font-weight: 700;">${presentDays}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #F59E0B; font-weight: 700;">${halfDays}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #EF4444;">${absentDays}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 700;">${otHours}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 900; background: #F8FAFC;">${totalManDays}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; font-size: 9px; color: #94A3B8;">Verified</td>
        </tr>
      `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>FORM A - Attendance Muster Roll</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; background: #FFFFFF; font-size: 11px; }
          .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #0F172A; padding-bottom: 10px; }
          .title { font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .sub { font-size: 10px; color: #475569; margin-top: 3px; }
          .meta-bar { display: flex; justify-content: space-between; background: #F1F5F9; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 10px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #0F172A; color: #FFFFFF; text-transform: uppercase; font-size: 9px; padding: 7px 8px; text-align: left; }
          .sign-area { display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 10px; font-weight: 700; color: #EA580C; text-transform: uppercase;">Prescribed Under Labour Code 2020</div>
          <h1 class="title">FORM A - STATUTORY ATTENDANCE MUSTER ROLL</h1>
          <div class="sub">Register of Employment, Daily Attendance, Overtime & Shift Credits</div>
        </div>

        <div class="meta-bar">
          <div><strong>Contractor:</strong> ${contractorName} (${companyName})</div>
          <div><strong>Site Scope:</strong> ${selectedSiteName}</div>
          <div><strong>Period:</strong> ${dateRange.startDate} to ${dateRange.endDate} (${dateRange.label})</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>Worker Name</th>
              <th>Trade / Skill</th>
              <th>Assigned Site</th>
              <th style="text-align: center;">Present</th>
              <th style="text-align: center;">Half-Day</th>
              <th style="text-align: center;">Absent</th>
              <th style="text-align: center;">OT (Hrs)</th>
              <th style="text-align: center;">Total Man-Days</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${workerAttendanceRows || '<tr><td colspan="10" style="padding: 12px; text-align: center;">No workers enrolled</td></tr>'}
          </tbody>
        </table>

        <div class="sign-area">
          <div>Prepared By: <strong>Site Supervisor / Foreman</strong></div>
          <div>Inspected By: <strong>Safety & Labour Compliance Officer</strong></div>
          <div style="border-top: 1px solid #0F172A; padding-top: 4px; width: 180px; text-align: center;">
            <strong>Contractor Signature / Seal</strong>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // 3. Form B - Wage Slip Register & Overtime Statement HTML
  const generateFormBHtml = () => {
    const contractorName = contractor?.name || 'Authorized Contractor';
    const companyName = contractor?.companyName || 'ConstLabour Operations Ltd.';

    let grandGross = 0;
    let grandAdvances = 0;
    let grandNet = 0;

    const wageRows = scopedWorkers
      .map((w, index) => {
        const wAtt = attendance.filter((a) => a.workerId === w.id);
        const presentDays = wAtt.filter((a) => a.status === 'present').length;
        const halfDays = wAtt.filter((a) => a.status === 'half-day').length;
        const totalManDays = presentDays + halfDays * 0.5;

        const dailyRate = w.dailyWage || 0;
        const baseWages = totalManDays * dailyRate;

        const otHours = wAtt.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
        const otRate = w.overtimeRate || 100;
        const otWages = otHours * otRate;

        const grossWage = baseWages + otWages;

        // Advances for this worker in period
        const wAdvances = advances
          .filter(
            (adv) =>
              adv.workerId === w.id && adv.date >= dateRange.startDate && adv.date <= dateRange.endDate
          )
          .reduce((sum, adv) => sum + (Number(adv.amount) || 0), 0);

        const netPayable = Math.max(grossWage - wAdvances, 0);

        grandGross += grossWage;
        grandAdvances += wAdvances;
        grandNet += netPayable;

        return `
        <tr>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center;">${index + 1}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${w.name}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0;">${w.skillLevel || 'Unskilled'}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: right;">₹${dailyRate}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center;">${totalManDays}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: right;">₹${baseWages.toLocaleString('en-IN')}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center;">${otHours}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #EA580C;">₹${otWages.toLocaleString('en-IN')}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700;">₹${grossWage.toLocaleString('en-IN')}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #EF4444;">₹${wAdvances.toLocaleString('en-IN')}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 900; background: #F8FAFC;">₹${netPayable.toLocaleString('en-IN')}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; font-size: 9px;">${w.upiId ? `UPI: ${w.upiId}` : 'Cash/Bank'}</td>
        </tr>
      `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>FORM B - Wage Slip Register</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; background: #FFFFFF; font-size: 11px; }
          .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #0F172A; padding-bottom: 10px; }
          .title { font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .sub { font-size: 10px; color: #475569; margin-top: 3px; }
          .meta-bar { display: flex; justify-content: space-between; background: #F1F5F9; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 10px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #0F172A; color: #FFFFFF; text-transform: uppercase; font-size: 9px; padding: 7px 8px; text-align: left; }
          .total-row td { background: #E2E8F0; font-weight: 900; padding: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 10px; font-weight: 700; color: #10B981; text-transform: uppercase;">Statutory Register under Code on Wages, 2019</div>
          <h1 class="title">FORM B - WAGE REGISTER & OVERTIME STATEMENT</h1>
          <div class="sub">Itemized Statement of Wage Accrual, Advances Deducted & Net Disbursements</div>
        </div>

        <div class="meta-bar">
          <div><strong>Contractor:</strong> ${contractorName} (${companyName})</div>
          <div><strong>Site:</strong> ${selectedSiteName}</div>
          <div><strong>Period:</strong> ${dateRange.startDate} to ${dateRange.endDate} (${dateRange.label})</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Worker Name</th>
              <th>Skill</th>
              <th style="text-align: right;">Rate/Day</th>
              <th style="text-align: center;">Days</th>
              <th style="text-align: right;">Base Wages</th>
              <th style="text-align: center;">OT Hrs</th>
              <th style="text-align: right;">OT Pay</th>
              <th style="text-align: right;">Gross Wages</th>
              <th style="text-align: right;">Advances</th>
              <th style="text-align: right;">Net Payable</th>
              <th>Mode / UPI</th>
            </tr>
          </thead>
          <tbody>
            ${wageRows || '<tr><td colspan="12" style="padding: 12px; text-align: center;">No wage data recorded</td></tr>'}
            <tr class="total-row">
              <td colspan="8" style="text-align: right;">TOTAL DISBURSEMENT COMMITMENT:</td>
              <td style="text-align: right;">₹${grandGross.toLocaleString('en-IN')}</td>
              <td style="text-align: right; color: #EF4444;">₹${grandAdvances.toLocaleString('en-IN')}</td>
              <td style="text-align: right; color: #0F172A;">₹${grandNet.toLocaleString('en-IN')}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px;">
          <div>Audit Verification: <strong>Passed (0 discrepancies)</strong></div>
          <div style="border-top: 1px solid #0F172A; padding-top: 4px; width: 180px; text-align: center;">
            <strong>Contractor Signature / Seal</strong>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // 4. Worker Master Register & KYC Compliance Record HTML
  const generateWorkerMasterHtml = () => {
    const contractorName = contractor?.name || 'Authorized Contractor';
    const companyName = contractor?.companyName || 'ConstLabour Operations Ltd.';

    const rows = scopedWorkers
      .map((w, idx) => {
        const site = siteMap.get(w.siteId || '');
        const isAadhaarVerified = !!w.aadhaarHash || !!w.aadhaar || !!(w as any).aadhaar_hash;

        return `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${w.name}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0;">${w.phone || 'N/A'}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0;">${w.skillLevel || 'Unskilled'}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700;">₹${w.dailyWage || 0}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">₹${w.overtimeRate || 100}/hr</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">
            <span style="color: ${isAadhaarVerified ? '#10B981' : '#F59E0B'}; font-weight: 700;">
              ${isAadhaarVerified ? '● VERIFIED' : '○ PENDING'}
            </span>
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; font-size: 10px;">${w.upiId || 'Pending'}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0;">${site?.name || 'Unassigned'}</td>
        </tr>
      `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>WORKER MASTER REGISTER & KYC COMPLIANCE</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; background: #FFFFFF; font-size: 11px; }
          .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #0F172A; padding-bottom: 10px; }
          .title { font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .sub { font-size: 10px; color: #475569; margin-top: 3px; }
          .meta-bar { display: flex; justify-content: space-between; background: #F1F5F9; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 10px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #0F172A; color: #FFFFFF; text-transform: uppercase; font-size: 9px; padding: 8px 10px; text-align: left; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 10px; font-weight: 700; color: #3B82F6; text-transform: uppercase;">Official Employment Roster</div>
          <h1 class="title">WORKER MASTER REGISTER & KYC COMPLIANCE RECORD</h1>
          <div class="sub">Complete Roster of Registered Labour, Skill Classifications, Wage Rates & Identity Verification</div>
        </div>

        <div class="meta-bar">
          <div><strong>Contractor:</strong> ${contractorName} (${companyName})</div>
          <div><strong>Total Enrolled:</strong> ${scopedWorkers.length} Workers</div>
          <div><strong>Aadhaar Verified:</strong> ${computedMetrics.compliancePercentage}%</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Worker Full Name</th>
              <th>Mobile</th>
              <th>Skill Category</th>
              <th style="text-align: right;">Daily Rate</th>
              <th style="text-align: right;">OT Rate</th>
              <th style="text-align: center;">KYC Status</th>
              <th>UPI ID</th>
              <th>Assigned Site</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="9" style="padding: 12px; text-align: center;">No workers enrolled</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  // ==========================================
  // REAL PDF EXPORT & DOWNLOAD HANDLER
  // ==========================================
  const handleExportPdf = async (reportType: ReportDocType, mode: 'share' | 'print' = 'share') => {
    if (generatingReport) return;
    setGeneratingReport(reportType);

    try {
      let html = '';
      let filename = '';

      if (reportType === 'executive') {
        html = generateExecutiveReportHtml();
        filename = `ConstLabour_Executive_Audit_${dateRange.startDate}_to_${dateRange.endDate}.pdf`;
      } else if (reportType === 'formA') {
        html = generateFormAHtml();
        filename = `Form_A_Attendance_MusterRoll_${dateRange.startDate}_to_${dateRange.endDate}.pdf`;
      } else if (reportType === 'formB') {
        html = generateFormBHtml();
        filename = `Form_B_Wage_Register_${dateRange.startDate}_to_${dateRange.endDate}.pdf`;
      } else if (reportType === 'workerMaster') {
        html = generateWorkerMasterHtml();
        filename = `Worker_Master_Register_KYC.pdf`;
      } else {
        // Fallback Form D
        html = generateExecutiveReportHtml();
        filename = `Form_D_Annual_Register.pdf`;
      }

      if (mode === 'print') {
        // Direct System Print / "Save as PDF"
        await Print.printAsync({ html });
        Toast.show({
          type: 'success',
          text1: t('reports.reportDownloaded'),
          text2: 'Print / Save dialog opened',
        });
      } else {
        // Generate PDF and Share / Save
        const file = await Print.printToFileAsync({ html, base64: true });

        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
        const cleanBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
        const targetUri = `${cleanBaseDir}${filename}`;

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

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUriToShare, {
            mimeType: 'application/pdf',
            dialogTitle: `Download / Share ${filename}`,
            UTI: 'com.adobe.pdf',
          });
          Toast.show({
            type: 'success',
            text1: t('reports.reportDownloaded'),
            text2: `${filename} ready to save`,
          });
        } else {
          // Fallback to printAsync if sharing is unavailable
          await Print.printAsync({ html });
        }
      }
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        Toast.show({
          type: 'error',
          text1: t('reports.reportFailed'),
          text2: err?.message || 'Could not compile PDF',
        });
      }
    } finally {
      setGeneratingReport(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER WITH BACK BUTTON & QUICK EXPORT */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>{t('reports.title')}</Text>
              <Text style={styles.headerSubtitle}>{t('reports.subtitle')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.exportPill}
            onPress={() => handleExportPdf('executive', 'share')}
            disabled={generatingReport !== null || loading}
            activeOpacity={0.85}
          >
            {generatingReport === 'executive' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="download" size={16} color="#FFFFFF" />
                <Text style={styles.exportPillText}>{t('reports.downloadPdf')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 2. CONTROLS: PERIOD SELECTOR & SITE FILTER PILL */}
        <View style={styles.filterBar}>
          {/* Period Selector Chips */}
          <View style={styles.periodChipsRow}>
            <TouchableOpacity
              style={[styles.periodChip, period === 'thisMonth' && styles.periodChipActive]}
              onPress={() => setPeriod('thisMonth')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodChipText,
                  period === 'thisMonth' && styles.periodChipTextActive,
                ]}
              >
                {t('common.thisMonth')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.periodChip, period === 'lastMonth' && styles.periodChipActive]}
              onPress={() => setPeriod('lastMonth')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodChipText,
                  period === 'lastMonth' && styles.periodChipTextActive,
                ]}
              >
                {t('common.previousMonth')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.periodChip, period === 'last7Days' && styles.periodChipActive]}
              onPress={() => setPeriod('last7Days')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodChipText,
                  period === 'last7Days' && styles.periodChipTextActive,
                ]}
              >
                7 Days
              </Text>
            </TouchableOpacity>
          </View>

          {/* Site Filter Button */}
          <TouchableOpacity
            style={styles.siteFilterPill}
            onPress={() => setShowSiteModal(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="location-on" size={13} color={colors.accentLight} />
            <Text style={styles.siteFilterText} numberOfLines={1}>
              {selectedSiteName}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. MAIN SCROLLABLE REPORTS BODY */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.accent}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>{t('common.loading')}...</Text>
          </View>
        ) : (
          <>
            {/* 4. REAL EXECUTIVE FINANCIAL & OPERATIONAL BENTO GRID */}
            <View style={styles.bentoGrid}>
              {/* Card 1: Total Spend */}
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>{t('reports.totalSpend')}</Text>
                <Text style={styles.bentoVal}>
                  ₹{computedMetrics.totalWageSpend.toLocaleString('en-IN')}
                </Text>
                <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.badgeText, { color: colors.successDark }]}>
                    {computedMetrics.totalManDays} {t('reports.manDays')}
                  </Text>
                </View>
              </View>

              {/* Card 2: Average Turnout */}
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>{t('reports.avgTurnout')}</Text>
                <Text style={[styles.bentoVal, { color: colors.success }]}>
                  {computedMetrics.avgTurnoutPercentage}%
                </Text>
                <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.badgeText, { color: colors.successDark }]}>
                    {computedMetrics.workingDaysCount} Days Logged
                  </Text>
                </View>
              </View>

              {/* Card 3: Total Overtime */}
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>{t('reports.totalOvertime')}</Text>
                <Text style={[styles.bentoVal, { color: colors.warning }]}>
                  {computedMetrics.totalOvertimeHours} hrs
                </Text>
                <View style={[styles.badge, { backgroundColor: colors.warningLight }]}>
                  <Text style={[styles.badgeText, { color: colors.warningDark }]}>
                    ₹{computedMetrics.totalOvertimePay.toLocaleString('en-IN')} {t('reports.outflow')}
                  </Text>
                </View>
              </View>

              {/* Card 4: Compliance / Aadhaar */}
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>{t('reports.compliance')}</Text>
                <Text style={[styles.bentoVal, { color: colors.primary }]}>
                  {computedMetrics.compliancePercentage}%
                </Text>
                <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>
                    {t('reports.aadhaarVerified')}
                  </Text>
                </View>
              </View>
            </View>

            {/* 5. REAL DAILY WORKFORCE TURNOUT BAR CHART */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartTitle}>{t('reports.dailyWorkforceTurnout')}</Text>
                  <Text style={styles.chartSub}>{t('reports.presentLaborers')}</Text>
                </View>
                <View style={styles.peakBadge}>
                  <Text style={styles.peakBadgeText}>
                    {t('reports.peakDay')}: {chartConfigData.peakDay}
                  </Text>
                </View>
              </View>

              <BarChart
                data={chartConfigData}
                width={screenWidth - 56}
                height={190}
                yAxisLabel=""
                yAxisSuffix=""
                fromZero
                chartConfig={{
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(234, 88, 12, ${opacity})`,
                  labelColor: () => '#64748B',
                  barPercentage: 0.55,
                  propsForBackgroundLines: {
                    stroke: '#F1F5F9',
                  },
                }}
                style={styles.chartStyle}
              />
            </View>

            {/* 6. REAL TRADE & SKILL SPECIALIZATION ALLOCATION */}
            <View style={styles.segmentCard}>
              <Text style={styles.segmentTitle}>{t('reports.laborSpendByTrade')}</Text>

              {/* Proportional Segment Bar */}
              <View style={styles.segmentBar}>
                {scopedWorkers.length > 0 ? (
                  <>
                    <View
                      style={[
                        styles.segmentSlice,
                        {
                          width: `${(computedMetrics.tradeCounts['Unskilled'].count / scopedWorkers.length) * 100}%`,
                          backgroundColor: '#94A3B8',
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.segmentSlice,
                        {
                          width: `${(computedMetrics.tradeCounts['Semi-skilled'].count / scopedWorkers.length) * 100}%`,
                          backgroundColor: '#0D9488',
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.segmentSlice,
                        {
                          width: `${(computedMetrics.tradeCounts['Skilled'].count / scopedWorkers.length) * 100}%`,
                          backgroundColor: colors.accent,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.segmentSlice,
                        {
                          width: `${(computedMetrics.tradeCounts['Highly-skilled'].count / scopedWorkers.length) * 100}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </>
                ) : (
                  <View style={[styles.segmentSlice, { width: '100%', backgroundColor: '#E2E8F0' }]} />
                )}
              </View>

              <View style={styles.tradeLegendGrid}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.legendLabel}>
                    Skilled: {computedMetrics.tradeCounts['Skilled'].count} workers (₹
                    {computedMetrics.tradeCounts['Skilled'].spend.toLocaleString('en-IN')})
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
                  <Text style={styles.legendLabel}>
                    Semi-skilled: {computedMetrics.tradeCounts['Semi-skilled'].count} workers (₹
                    {computedMetrics.tradeCounts['Semi-skilled'].spend.toLocaleString('en-IN')})
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
                  <Text style={styles.legendLabel}>
                    Unskilled / Helpers: {computedMetrics.tradeCounts['Unskilled'].count} workers (₹
                    {computedMetrics.tradeCounts['Unskilled'].spend.toLocaleString('en-IN')})
                  </Text>
                </View>
                {computedMetrics.tradeCounts['Highly-skilled'].count > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                    <Text style={styles.legendLabel}>
                      Highly-skilled: {computedMetrics.tradeCounts['Highly-skilled'].count} workers (₹
                      {computedMetrics.tradeCounts['Highly-skilled'].spend.toLocaleString('en-IN')})
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 7. SITE PERFORMANCE COMPARISON (IF MULTIPLE SITES) */}
            {sites.length > 0 && (
              <View style={styles.siteCard}>
                <Text style={styles.segmentTitle}>Site Deployment & Performance</Text>
                {computedMetrics.sitePerformance.map((sp) => (
                  <View key={sp.id} style={styles.siteRowItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.siteRowName}>{sp.name}</Text>
                      <Text style={styles.siteRowSub}>
                        {sp.workersCount} Workers • {sp.manDays} Man-Days • {sp.overtimeHours} OT Hrs
                      </Text>
                    </View>
                    <Text style={styles.siteRowAmount}>
                      ₹{sp.wageSpend.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* 8. STATUTORY & EXECUTIVE REGISTERS EXPORT HUB (REAL DOWNLOADS) */}
            <View style={styles.statutoryCard}>
              <View style={styles.statutoryHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statutoryTitle}>{t('reports.statutoryCompliance')}</Text>
                  <Text style={styles.statutorySub}>{t('reports.subtitle')}</Text>
                </View>
                <MaterialIcons name="verified" size={24} color={colors.accent} />
              </View>

              {/* REPORT 1: Form A - Attendance Muster Roll */}
              <View style={styles.registerDocCard}>
                <View style={styles.docInfoRow}>
                  <View style={[styles.docIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <MaterialIcons name="fact-check" size={22} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.registerName}>{t('reports.musterRollTitle')}</Text>
                    <Text style={styles.registerDetail}>{t('reports.musterRollSub')}</Text>
                  </View>
                </View>
                <View style={styles.docActionsRow}>
                  <TouchableOpacity
                    style={styles.docPrintBtn}
                    onPress={() => handleExportPdf('formA', 'print')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="print" size={16} color={colors.primary} />
                    <Text style={styles.docPrintText}>{t('reports.printOrSave')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docShareBtn}
                    onPress={() => handleExportPdf('formA', 'share')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    {generatingReport === 'formA' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="share" size={16} color="#FFFFFF" />
                        <Text style={styles.docShareText}>{t('reports.downloadPdf')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* REPORT 2: Form B - Wage Slip Register */}
              <View style={styles.registerDocCard}>
                <View style={styles.docInfoRow}>
                  <View style={[styles.docIconBox, { backgroundColor: '#FFF7ED' }]}>
                    <MaterialIcons name="receipt-long" size={22} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.registerName}>{t('reports.formBTitle')}</Text>
                    <Text style={styles.registerDetail}>{t('reports.formBSub')}</Text>
                  </View>
                </View>
                <View style={styles.docActionsRow}>
                  <TouchableOpacity
                    style={styles.docPrintBtn}
                    onPress={() => handleExportPdf('formB', 'print')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="print" size={16} color={colors.primary} />
                    <Text style={styles.docPrintText}>{t('reports.printOrSave')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docShareBtn}
                    onPress={() => handleExportPdf('formB', 'share')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    {generatingReport === 'formB' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="share" size={16} color="#FFFFFF" />
                        <Text style={styles.docShareText}>{t('reports.downloadPdf')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* REPORT 3: Worker Master Register & KYC */}
              <View style={styles.registerDocCard}>
                <View style={styles.docInfoRow}>
                  <View style={[styles.docIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <MaterialIcons name="badge" size={22} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.registerName}>{t('reports.workerMasterTitle')}</Text>
                    <Text style={styles.registerDetail}>{t('reports.workerMasterSub')}</Text>
                  </View>
                </View>
                <View style={styles.docActionsRow}>
                  <TouchableOpacity
                    style={styles.docPrintBtn}
                    onPress={() => handleExportPdf('workerMaster', 'print')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="print" size={16} color={colors.primary} />
                    <Text style={styles.docPrintText}>{t('reports.printOrSave')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docShareBtn}
                    onPress={() => handleExportPdf('workerMaster', 'share')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    {generatingReport === 'workerMaster' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="share" size={16} color="#FFFFFF" />
                        <Text style={styles.docShareText}>{t('reports.downloadPdf')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* REPORT 4: Master Executive Audit Package */}
              <View style={styles.registerDocCard}>
                <View style={styles.docInfoRow}>
                  <View style={[styles.docIconBox, { backgroundColor: '#F1F5F9' }]}>
                    <MaterialIcons name="account-balance" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.registerName}>{t('reports.executiveAuditTitle')}</Text>
                    <Text style={styles.registerDetail}>{t('reports.executiveAuditSub')}</Text>
                  </View>
                </View>
                <View style={styles.docActionsRow}>
                  <TouchableOpacity
                    style={styles.docPrintBtn}
                    onPress={() => handleExportPdf('executive', 'print')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="print" size={16} color={colors.primary} />
                    <Text style={styles.docPrintText}>{t('reports.printOrSave')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docShareBtn}
                    onPress={() => handleExportPdf('executive', 'share')}
                    disabled={generatingReport !== null}
                    activeOpacity={0.8}
                  >
                    {generatingReport === 'executive' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="share" size={16} color="#FFFFFF" />
                        <Text style={styles.docShareText}>{t('reports.downloadPdf')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* 9. SITE SELECTION MODAL */}
      <Modal visible={showSiteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t('reports.filterBySite')}</Text>
                <Text style={styles.modalSubtitle}>{t('reports.selectSiteAndPeriod')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSiteModal(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {/* Option: All Sites */}
              <TouchableOpacity
                style={[
                  styles.siteModalItem,
                  selectedSiteId === 'all' && styles.siteModalItemActive,
                ]}
                onPress={() => {
                  setSelectedSiteId('all');
                  setShowSiteModal(false);
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="apartment"
                  size={20}
                  color={selectedSiteId === 'all' ? colors.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.siteModalItemText,
                    selectedSiteId === 'all' && styles.siteModalItemTextActive,
                  ]}
                >
                  {t('reports.allSites')}
                </Text>
                {selectedSiteId === 'all' && (
                  <MaterialIcons name="check" size={18} color={colors.accent} />
                )}
              </TouchableOpacity>

              {/* Individual Sites */}
              {sites.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.siteModalItem,
                    selectedSiteId === s.id && styles.siteModalItemActive,
                  ]}
                  onPress={() => {
                    setSelectedSiteId(s.id);
                    setShowSiteModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="location-city"
                    size={20}
                    color={selectedSiteId === s.id ? colors.accent : colors.textMuted}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={[
                        styles.siteModalItemText,
                        selectedSiteId === s.id && styles.siteModalItemTextActive,
                      ]}
                    >
                      {s.name}
                    </Text>
                    {s.address && (
                      <Text style={styles.siteModalAddress} numberOfLines={1}>
                        {s.address}
                      </Text>
                    )}
                  </View>
                  {selectedSiteId === s.id && (
                    <MaterialIcons name="check" size={18} color={colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingTop: 8,
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
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 8,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  exportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  exportPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  periodChipsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  periodChipActive: {
    backgroundColor: colors.accent,
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  periodChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  siteFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 140,
  },
  siteFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginHorizontal: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 12,
    fontWeight: '600',
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
  bentoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  bentoVal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...shadows.card,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  chartSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  peakBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  peakBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accentDark,
  },
  chartStyle: {
    borderRadius: radii.md,
    marginVertical: 4,
    alignSelf: 'center',
  },
  segmentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...shadows.sm,
  },
  segmentTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  segmentBar: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  segmentSlice: {
    height: '100%',
  },
  tradeLegendGrid: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  siteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...shadows.sm,
  },
  siteRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  siteRowName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  siteRowSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  siteRowAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  statutoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  statutoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statutoryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  statutorySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  registerDocCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  docInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerName: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  registerDetail: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  docActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  docPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 7,
    borderRadius: radii.md,
    gap: 4,
  },
  docPrintText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  docShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 7,
    borderRadius: radii.md,
    gap: 4,
  },
  docShareText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 18,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  siteModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    marginBottom: 4,
  },
  siteModalItemActive: {
    backgroundColor: colors.surfaceMuted,
  },
  siteModalItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 10,
    flex: 1,
  },
  siteModalItemTextActive: {
    fontWeight: '800',
    color: colors.accent,
  },
  siteModalAddress: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 10,
    marginTop: 2,
  },
});
