import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/text';
import { Button, ButtonText } from '../../components/ui/button';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '../../utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { FormField } from '../../components/shared/FormField';

interface Worker {
  id: string;
  name: string;
  phone: string;
  siteId?: string;
  siteName?: string;
}

interface Site {
  id: string;
  name: string;
}

interface BulkAttendanceTabProps {
  accessToken?: string;
}

export function BulkAttendanceTab({ accessToken }: BulkAttendanceTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout'>('checkin');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchSites = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchWorkers = async () => {
    if (!token || !selectedSite) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers?siteId=${selectedSite}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const toggleWorker = (workerId: string) => {
    const newSelected = new Set(selectedWorkers);
    if (newSelected.has(workerId)) {
      newSelected.delete(workerId);
    } else {
      newSelected.add(workerId);
    }
    setSelectedWorkers(newSelected);
  };

  const selectAll = () => {
    if (selectedWorkers.size === workers.length) {
      setSelectedWorkers(new Set());
    } else {
      setSelectedWorkers(new Set(workers.map(w => w.id)));
    }
  };

  const handleBulkMark = async (status: 'present' | 'absent') => {
    if (!token || selectedWorkers.size === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select at least one worker',
      });
      return;
    }

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const promises = Array.from(selectedWorkers).map(workerId =>
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
          {
            method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workerId,
              siteId: selectedSite,
              date: dateStr,
              status,
            }),
          }
        )
      );

      await Promise.all(promises);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Marked ${selectedWorkers.size} workers as ${status}`,
      });

      setSelectedWorkers(new Set());
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to mark attendance',
      });
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const filteredWorkers = selectedSite
    ? workers.filter(w => !w.siteId || w.siteId === selectedSite)
    : workers;

  const pendingCount = filteredWorkers.length;
  const workingCount = 0; // This would come from actual attendance data
  const completedCount = 0; // This would come from actual attendance data

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Site and Date Selectors */}
        <View style={styles.selectorsContainer}>
          <View style={styles.selectorGroup}>
            <Text style={styles.selectorLabel}>Site</Text>
            <Select selectedValue={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger variant="outline" size="md" style={styles.selectTrigger}>
                <SelectInput placeholder="Select site" />
                <SelectIcon />
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
              <SelectContent>
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>
                {sites.map((site) => (
                    <SelectItem key={site.id} label={site.name} value={site.id}>
                      <SelectItemText>{site.name}</SelectItemText>
                  </SelectItem>
                ))}
              </SelectContent>
              </SelectPortal>
            </Select>
          </View>
          <View style={styles.selectorGroup}>
            <Text style={styles.selectorLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {selectedDate.toISOString().split('T')[0]}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {/* Current Time and Date Display */}
        <View style={styles.timeDateContainer}>
          <View style={styles.timeDisplay}>
            <MaterialIcons name="access-time" size={24} color="#2563eb" />
            <View style={styles.timeText}>
              <Text style={styles.timeLabel}>Current Time</Text>
              <Text style={styles.timeValue}>{formatTime(currentTime)}</Text>
            </View>
          </View>
          <View style={styles.dateDisplay}>
            <Text style={styles.dateLabel}>Today</Text>
            <Text style={styles.dateValue}>{formatDate(new Date())}</Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="pending" size={24} color="#f97316" />
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="work" size={24} color="#2563eb" />
            <Text style={styles.statValue}>{workingCount}</Text>
            <Text style={styles.statLabel}>Working</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={24} color="#22c55e" />
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'checkin' && styles.tabActive]}
            onPress={() => setActiveTab('checkin')}
          >
            <MaterialIcons name="login" size={20} color={activeTab === 'checkin' ? '#2563eb' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'checkin' && styles.tabTextActive]}>
              Check-In ({pendingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'checkout' && styles.tabActive]}
            onPress={() => setActiveTab('checkout')}
          >
            <MaterialIcons name="logout" size={20} color={activeTab === 'checkout' ? '#2563eb' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'checkout' && styles.tabTextActive]}>
              Check-Out ({completedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Worker List */}
        {selectedSite && (
          <View style={styles.workersSection}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'checkin' ? 'Morning Check-In:' : 'Evening Check-Out:'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {activeTab === 'checkin' 
                ? 'Tap each worker as they arrive at the site'
                : 'Tap each worker as they leave the site'}
            </Text>
            <FlatList
              data={filteredWorkers}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.workerCard}>
                  <View style={styles.workerCardContent}>
                    <View style={styles.workerInfo}>
                      <Text style={styles.workerName}>{item.name}</Text>
                      <Text style={styles.workerPhone}>{item.phone}</Text>
                      <View style={styles.workerWage}>
                        <MaterialIcons name="attach-money" size={16} color="#6b7280" />
                        <Text style={styles.workerWageText}>₹500/day</Text>
                      </View>
                    </View>
                    <View style={styles.workerActions}>
        <Button
                        onPress={() => handleBulkMark(activeTab === 'checkin' ? 'present' : 'absent')}
                        style={styles.checkButton}
                      >
                        <MaterialIcons name={activeTab === 'checkin' ? 'login' : 'logout'} size={20} color="#ffffff" />
                        <ButtonText style={styles.checkButtonText}>
                          {activeTab === 'checkin' ? 'Check In' : 'Check Out'}
                        </ButtonText>
        </Button>
                      <TouchableOpacity style={styles.moreButton}>
                        <MaterialIcons name="more-vert" size={20} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No workers found for this site</Text>
                </View>
              }
            />
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
  selectorsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  selectorGroup: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  selectTrigger: {
    minHeight: 44,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  timeDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timeText: {
    gap: 2,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dateDisplay: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  workersSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  workerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  workerCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerInfo: {
    flex: 1,
    gap: 4,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  workerPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  workerWage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  workerWageText: {
    fontSize: 14,
    color: '#6b7280',
  },
  workerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
  },
  checkButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  moreButton: {
    padding: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
