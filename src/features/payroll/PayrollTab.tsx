import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { FormField } from '@/components/shared/FormField';
import { colors, shadows, radii } from '@/styles/theme';

interface Worker {
  id: string;
  name: string;
  phone: string;
  role?: string;
  dailyWage?: number;
}

interface PayrollEntry {
  id: string;
  workerId: string;
  workerName: string;
  period?: string;
  daysWorked?: number;
  dailyWage?: number;
  totalWage?: number;
  advances?: number;
  deductions?: number;
  netPay?: number;
  status: 'pending' | 'paid';
}

interface PayrollTabProps {
  accessToken?: string;
}

export function PayrollTab({ accessToken }: PayrollTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);

  // Date range defaults to current week
  const [startDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [endDate] = useState(new Date());

  // Give Advance modal state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  useEffect(() => {
    if (token) {
      fetchPayroll();
      fetchWorkers();
    }
  }, [token]);

  const fetchPayroll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/payroll?startDate=${startStr}&endDate=${endStr}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch payroll: ${response.status}`);
      const data = await response.json();
      setPayrollEntries(data.payroll || []);
    } catch (error: any) {
      console.error('Error fetching payroll:', error);
      setPayrollEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (error: any) {
      console.error('Error fetching workers:', error);
    }
  };

  const handleGiveAdvance = async () => {
    if (!selectedWorker || !advanceAmount) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please select worker and amount' });
      return;
    }

    const amount = parseFloat(advanceAmount);
    if (isNaN(amount) || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Enter a valid positive number' });
      return;
    }

    setSubmittingAdvance(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/advances`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workerId: selectedWorker,
            amount,
            date: new Date().toISOString().split('T')[0],
            reason: advanceReason || 'Kharcha / Advance',
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to record advance');

      Toast.show({ type: 'success', text1: 'Advance Granted', text2: `₹${amount} recorded.` });
      setSelectedWorker('');
      setAdvanceAmount('');
      setAdvanceReason('');
      setShowAdvanceModal(false);
      fetchPayroll();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const handleProcessPayroll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/payroll/process`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ startDate: startStr, endDate: endStr }),
        }
      );

      if (!response.ok) throw new Error('Failed to calculate wages');
      Toast.show({ type: 'success', text1: 'Payroll Processed', text2: 'Wage calculations updated.' });
      fetchPayroll();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (entryId: string) => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/payroll/${entryId}/mark-paid`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to mark as paid');
      Toast.show({ type: 'success', text1: 'Settled', text2: 'Payment marked as disbursed' });
      fetchPayroll();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
  };

  // Financial aggregates
  const totalGross = payrollEntries.reduce((sum, e) => sum + (e.totalWage || (e as any).totalGross || 0), 0);
  const totalAdvances = payrollEntries.reduce((sum, e) => sum + (e.advances || 0), 0);
  const totalDeductions = payrollEntries.reduce((sum, e) => sum + (e.deductions || 0), 0);
  const totalNet = payrollEntries.reduce((sum, e) => sum + (e.netPay || (e as any).totalNet || e.totalWage || 0), 0);

  const workerOptions = workers.map((w) => ({ label: `${w.name} (Base ₹${w.dailyWage || 800})`, value: w.id }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Payroll & Wage Disbursal</Text>
            <Text style={styles.headerSubtitle}>Weekly settlements, cash advances & UPI payouts</Text>
          </View>
          <TouchableOpacity
            style={styles.giveAdvanceBtn}
            onPress={() => setShowAdvanceModal(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="account-balance-wallet" size={16} color="#FFFFFF" />
            <Text style={styles.giveAdvanceText}>Give Advance</Text>
          </TouchableOpacity>
        </View>

        {/* Date Period Selector Pill */}
        <View style={styles.periodPill}>
          <MaterialIcons name="date-range" size={14} color={colors.accentLight} />
          <Text style={styles.periodText}>
            Current Settlement Cycle: {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. HIGH-IMPACT FINANCIAL BENTO */}
        <View style={styles.bentoRow}>
          <View style={styles.bentoMiniCard}>
            <Text style={styles.bentoMiniLabel}>Gross Wages</Text>
            <Text style={styles.bentoMiniVal}>₹{totalGross.toLocaleString()}</Text>
            <Text style={styles.bentoSubLabel}>{payrollEntries.length} Workers</Text>
          </View>
          <View style={styles.bentoMiniCard}>
            <Text style={styles.bentoMiniLabel}>Advances</Text>
            <Text style={[styles.bentoMiniVal, { color: colors.warning }]}>-₹{totalAdvances.toLocaleString()}</Text>
            <Text style={styles.bentoSubLabel}>Deducted</Text>
          </View>
          <View style={styles.bentoMiniCard}>
            <Text style={styles.bentoMiniLabel}>Mess / Kharcha</Text>
            <Text style={[styles.bentoMiniVal, { color: colors.error }]}>-₹{totalDeductions.toLocaleString()}</Text>
            <Text style={styles.bentoSubLabel}>Canteen</Text>
          </View>
        </View>

        {/* HERO NET PAYABLE CARD */}
        <View style={styles.heroNetCard}>
          <View style={styles.heroNetLeft}>
            <Text style={styles.heroNetLabel}>NET DISBURSABLE AMOUNT</Text>
            <Text style={styles.heroNetValue}>₹{totalNet.toLocaleString()}</Text>
            <Text style={styles.heroNetSub}>Direct Bank / UPI Settlement Ready</Text>
          </View>
          <TouchableOpacity
            style={styles.recalcBtn}
            onPress={handleProcessPayroll}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.recalcBtnText}>Calculate</Text>
          </TouchableOpacity>
        </View>

        {/* 3. WORKER WAGE LEDGER */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>WORKER WAGE BREAKDOWN ({payrollEntries.length})</Text>
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>

        {payrollEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="payments" size={48} color={colors.borderDark} />
            <Text style={styles.emptyTitle}>No Payroll Entries for This Cycle</Text>
            <Text style={styles.emptySubtitle}>Tap "Calculate" to generate wage computations from attendance records.</Text>
          </View>
        ) : (
          payrollEntries.map((entry) => {
            const isPaid = entry.status === 'paid';
            const netAmount = entry.netPay ?? (entry as any).totalNet ?? entry.totalWage ?? 0;

            return (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryWorkerInfo}>
                    <Text style={styles.entryWorkerName}>{entry.workerName}</Text>
                    <Text style={styles.entryMeta}>
                      {entry.daysWorked || 7} Days Worked • Base ₹{entry.dailyWage || 800}/day
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, isPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                    <Text style={[styles.statusBadgeText, isPaid ? styles.statusTextPaid : styles.statusTextPending]}>
                      {isPaid ? 'PAID & SETTLED' : 'READY TO PAY'}
                    </Text>
                  </View>
                </View>

                {/* Financial Breakdown Grid */}
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Gross</Text>
                    <Text style={styles.breakdownVal}>₹{(entry.totalWage || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Advance</Text>
                    <Text style={[styles.breakdownVal, { color: colors.warning }]}>-₹{entry.advances || 0}</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Mess</Text>
                    <Text style={[styles.breakdownVal, { color: colors.error }]}>-₹{entry.deductions || 0}</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={[styles.breakdownLabel, { fontWeight: '800' }]}>Net Pay</Text>
                    <Text style={[styles.breakdownVal, { color: colors.primary, fontWeight: '800' }]}>
                      ₹{netAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Direct Pay Action */}
                {!isPaid && (
                  <View style={styles.entryActionRow}>
                    <TouchableOpacity
                      style={styles.payUpiBtn}
                      onPress={() => handleMarkPaid(entry.id)}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="bolt" size={16} color="#FFFFFF" />
                      <Text style={styles.payUpiBtnText}>Disburse ₹{netAmount.toLocaleString()} via UPI</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 4. GIVE ADVANCE MODAL */}
      <Modal visible={showAdvanceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Issue Worker Advance</Text>
              <TouchableOpacity onPress={() => setShowAdvanceModal(false)}>
                <MaterialIcons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <FormField
              label="Select Worker *"
              type="select"
              value={selectedWorker}
              onChangeText={setSelectedWorker}
              selectOptions={workerOptions}
              placeholder="Select worker for advance"
            />

            <FormField
              label="Advance Amount (₹) *"
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
              placeholder="e.g. 1500"
              keyboardType="numeric"
            />

            <FormField
              label="Reason / Purpose *"
              value={advanceReason}
              onChangeText={setAdvanceReason}
              placeholder="e.g. Medical emergency / Family travel"
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleGiveAdvance}
              disabled={submittingAdvance}
              activeOpacity={0.85}
            >
              {submittingAdvance ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Disburse & Record Advance</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 10,
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
  giveAdvanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  giveAdvanceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  periodText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  bentoMiniCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  bentoMiniLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  bentoMiniVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 2,
  },
  bentoSubLabel: {
    fontSize: 9,
    color: colors.textLight,
  },
  heroNetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: 16,
    ...shadows.card,
  },
  heroNetLeft: {
    flex: 1,
  },
  heroNetLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  heroNetValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  heroNetSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  recalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    marginLeft: 12,
  },
  recalcBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...shadows.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  entryWorkerInfo: {
    flex: 1,
  },
  entryWorkerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  entryMeta: {
    fontSize: 11,
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
  statusBadgePending: {
    backgroundColor: '#FFF7ED',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextPaid: {
    color: colors.successDark,
  },
  statusTextPending: {
    color: colors.accent,
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
  breakdownLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  entryActionRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payUpiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  payUpiBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubmitBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: 14,
    ...shadows.hero,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
