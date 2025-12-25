import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectItem, SelectItemText } from '@/components/ui/select';
import { Input, InputField } from '@/components/ui/input';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

interface PayrollEntry {
  id: string;
  workerId: string;
  workerName: string;
  period: string;
  daysWorked: number;
  dailyWage: number;
  totalWage: number;
  advances: number;
  deductions: number;
  netPay: number;
  status: 'pending' | 'paid';
}

interface PayrollTabProps {
  accessToken?: string;
}

export function PayrollTab({ accessToken }: PayrollTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchPayroll();
    }
  }, [token, startDate, endDate]);

  const fetchPayroll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/payroll?startDate=${startStr}&endDate=${endStr}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setPayrollEntries(data.payroll || []);
    } catch (error) {
      console.error('Error fetching payroll:', error);
      // Mock data for demonstration
      setPayrollEntries([
        {
          id: '1',
          workerId: '1',
          workerName: 'John Doe',
          period: '2024-01-01 to 2024-01-07',
          daysWorked: 6,
          dailyWage: 500,
          totalWage: 3000,
          advances: 500,
          deductions: 0,
          netPay: 2500,
          status: 'pending',
        },
      ]);
    } finally {
      setLoading(false);
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
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate: startStr,
            endDate: endStr,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to process payroll');
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Payroll processed successfully',
      });

      fetchPayroll();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to process payroll',
      });
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
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark as paid');
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Marked as paid',
      });

      fetchPayroll();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update status',
      });
    }
  };

  const totalAmount = payrollEntries.reduce((sum, entry) => sum + entry.netPay, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Payroll Management</Text>
            <Text style={styles.headerSubtitle}>Calculate and process worker payments</Text>
          </View>
          <View style={styles.headerButtons}>
            <Button
              onPress={() => {}}
              style={styles.actionButton}
            >
              <MaterialIcons name="account-balance-wallet" size={20} color="#ffffff" />
              <ButtonText style={styles.actionButtonText}>Give Advance</ButtonText>
            </Button>
            <Button
              onPress={handleProcessPayroll}
              isDisabled={loading}
              style={[styles.actionButton, styles.primaryButton]}
            >
              <MaterialIcons name="calculate" size={20} color="#ffffff" />
              <ButtonText style={styles.primaryButtonText}>
                {loading ? 'Processing...' : 'Calculate Payroll'}
              </ButtonText>
            </Button>
          </View>
        </View>

        {/* Date Range Selectors */}
        <View style={styles.dateRangeContainer}>
          <View style={styles.dateSelector}>
            <Text style={styles.dateLabel}>Start Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {startDate.toLocaleDateString()}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
          <View style={styles.dateSelector}>
            <Text style={styles.dateLabel}>End Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {endDate.toLocaleDateString()}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowStartPicker(Platform.OS === 'ios');
              if (date) setStartDate(date);
            }}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowEndPicker(Platform.OS === 'ios');
              if (date) setEndDate(date);
            }}
          />
        )}

        {/* Payroll Entries or Empty State */}
        {payrollEntries.length > 0 ? (
          <>
            {totalAmount > 0 && (
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Total Payroll</Text>
                <Text style={styles.totalAmount}>₹{totalAmount.toLocaleString()}</Text>
              </View>
            )}
            <FlatList
              data={payrollEntries}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.payrollCard}>
                  <View style={styles.payrollCardHeader}>
                    <Text style={styles.workerName}>{item.workerName}</Text>
                    <View style={[styles.statusBadge, item.status === 'paid' && styles.statusBadgePaid]}>
                      <Text style={[styles.statusText, item.status === 'paid' && styles.statusTextPaid]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.period}>{item.period}</Text>
                  <View style={styles.payrollDetails}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Days Worked</Text>
                      <Text style={styles.detailValue}>{item.daysWorked}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Daily Wage</Text>
                      <Text style={styles.detailValue}>₹{item.dailyWage}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Net Pay</Text>
                      <Text style={styles.detailValueNet}>₹{item.netPay}</Text>
                    </View>
                  </View>
                  {item.status === 'pending' && (
                    <Button
                      onPress={() => handleMarkPaid(item.id)}
                      style={styles.markPaidButton}
                    >
                      <MaterialIcons name="check-circle" size={18} color="#ffffff" />
                      <ButtonText style={styles.markPaidButtonText}>Mark as Paid</ButtonText>
                    </Button>
                  )}
                </View>
              )}
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-long" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No payroll calculated</Text>
            <Text style={styles.emptySubtitle}>Calculate payroll to process payments</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerText: {
    marginBottom: 16,
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
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  actionButtonText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dateSelector: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  totalCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563eb',
  },
  payrollCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  payrollCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgePaid: {
    backgroundColor: '#dcfce7',
  },
  statusText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusTextPaid: {
    color: '#16a34a',
  },
  period: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  payrollDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  detailValueNet: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  markPaidButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 36,
  },
  markPaidButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
