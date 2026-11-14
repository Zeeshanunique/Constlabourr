import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '@/styles/theme';

interface Worker {
  id: string;
  name: string;
  phone: string;
  skillLevel?: string;
  dailyWage?: number;
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout'>('checkin');

  useEffect(() => {
    if (token) {
      fetchSites();
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedSite) {
      fetchWorkers();
    }
  }, [token, selectedSite]);

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
      const loadedSites = data.sites || [];
      setSites(loadedSites);
      if (loadedSites.length > 0 && !selectedSite) {
        setSelectedSite(loadedSites[0].id);
      }
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
      setSelectedWorkers(new Set());
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

  const handleBulkMark = async (status: 'present' | 'absent' | 'half-day') => {
    if (!token || selectedWorkers.size === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Workers Selected',
        text2: 'Select at least one worker to mark attendance',
      });
      return;
    }

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateStr > todayStr) {
        Toast.show({
          type: 'error',
          text1: 'Future Date Blocked',
          text2: 'Attendance cannot be marked for future dates.',
        });
        setLoading(false);
        return;
      }
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
        text1: 'Bulk Attendance Marked',
        text2: `Successfully marked ${selectedWorkers.size} workers as ${status.toUpperCase()}`,
      });

      setSelectedWorkers(new Set());
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to submit bulk attendance',
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

  const isAllSelected = workers.length > 0 && selectedWorkers.size === workers.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bulk Attendance Desk</Text>
          <Text style={styles.headerSubtitle}>Multi-select rapid attendance logging</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{selectedWorkers.size} Selected</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Site Selector Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.siteScroller}>
          {sites.map((site) => {
            const isSelected = selectedSite === site.id;
            return (
              <TouchableOpacity
                key={site.id}
                onPress={() => setSelectedSite(site.id)}
                style={[styles.siteChip, isSelected && styles.siteChipActive]}
                activeOpacity={0.7}
              >
                <MaterialIcons 
                  name="place" 
                  size={14} 
                  color={isSelected ? '#ffffff' : theme.colors.slate[500]} 
                />
                <Text style={[styles.siteChipText, isSelected && styles.siteChipTextActive]}>
                  {site.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Date Selector Strip */}
        <View style={styles.dateRow}>
          <TouchableOpacity 
            style={styles.datePickerBtn} 
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="event" size={18} color={theme.colors.safetyOrange} />
            <Text style={styles.datePickerText}>
              {selectedDate.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.selectAllBtn, isAllSelected && styles.selectAllBtnActive]} 
            onPress={selectAll}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name={isAllSelected ? "check-box" : "check-box-outline-blank"} 
              size={18} 
              color={isAllSelected ? theme.colors.safetyOrange : theme.colors.slate[500]} 
            />
            <Text style={[styles.selectAllText, isAllSelected && styles.selectAllTextActive]}>
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={onDateChange}
          />
        )}

        {/* Shift Mode Switcher */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, activeTab === 'checkin' && styles.modeTabActive]}
            onPress={() => setActiveTab('checkin')}
            activeOpacity={0.8}
          >
            <MaterialIcons 
              name="wb-sunny" 
              size={16} 
              color={activeTab === 'checkin' ? theme.colors.safetyOrange : theme.colors.slate[500]} 
            />
            <Text style={[styles.modeTabText, activeTab === 'checkin' && styles.modeTabTextActive]}>
              Morning Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, activeTab === 'checkout' && styles.modeTabActive]}
            onPress={() => setActiveTab('checkout')}
            activeOpacity={0.8}
          >
            <MaterialIcons 
              name="nights-stay" 
              size={16} 
              color={activeTab === 'checkout' ? theme.colors.safetyOrange : theme.colors.slate[500]} 
            />
            <Text style={[styles.modeTabText, activeTab === 'checkout' && styles.modeTabTextActive]}>
              Evening Sign-Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Worker Checklist */}
        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isChecked = selectedWorkers.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.workerCard, isChecked && styles.workerCardChecked]}
                onPress={() => toggleWorker(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.checkboxArea}>
                  <MaterialIcons 
                    name={isChecked ? "check-circle" : "radio-button-unchecked"} 
                    size={22} 
                    color={isChecked ? theme.colors.safetyOrange : theme.colors.slate[400]} 
                  />
                </View>
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{item.name}</Text>
                  <View style={styles.workerMetaRow}>
                    <Text style={styles.workerPhone}>{item.phone}</Text>
                    {item.skillLevel ? (
                      <View style={styles.skillBadge}>
                        <Text style={styles.skillBadgeText}>{item.skillLevel.toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {item.dailyWage ? (
                  <View style={styles.wagePill}>
                    <Text style={styles.wageText}>₹{item.dailyWage}/d</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="group-off" size={44} color={theme.colors.slate[400]} />
              <Text style={styles.emptyText}>No Workers Assigned</Text>
              <Text style={styles.emptySubtext}>
                No workers are assigned to this jobsite. Select another site or deploy workers first.
              </Text>
            </View>
          }
        />

        {/* Action Trigger Footer */}
        {selectedWorkers.size > 0 && (
          <View style={styles.footerDock}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.presentBtn]}
              onPress={() => handleBulkMark('present')}
              disabled={loading}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check" size={18} color="#ffffff" />
              <Text style={styles.actionBtnText}>Mark Present ({selectedWorkers.size})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.absentBtn]}
              onPress={() => handleBulkMark('absent')}
              disabled={loading}
              activeOpacity={0.85}
            >
              <MaterialIcons name="close" size={18} color="#ffffff" />
              <Text style={styles.actionBtnText}>Mark Absent ({selectedWorkers.size})</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.slate[900],
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.slate[500],
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: theme.colors.slate[900],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  siteScroller: {
    maxHeight: 38,
    marginBottom: 10,
  },
  siteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  siteChipActive: {
    backgroundColor: theme.colors.slate[900],
    borderColor: theme.colors.slate[900],
  },
  siteChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.slate[700],
  },
  siteChipTextActive: {
    color: '#ffffff',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  datePickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.slate[900],
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectAllBtnActive: {},
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.slate[600],
  },
  selectAllTextActive: {
    color: theme.colors.safetyOrange,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.slate[100],
    borderRadius: theme.radii.md,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.slate[200],
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radii.sm,
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    ...theme.shadows.sm,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.slate[600],
  },
  modeTabTextActive: {
    color: theme.colors.slate[900],
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 90,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  workerCardChecked: {
    borderColor: theme.colors.safetyOrange,
    backgroundColor: '#FFF7ED',
  },
  checkboxArea: {
    marginRight: 12,
  },
  workerInfo: {
    flex: 1,
    gap: 2,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.slate[900],
  },
  workerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerPhone: {
    fontSize: 12,
    color: theme.colors.slate[500],
  },
  skillBadge: {
    backgroundColor: theme.colors.slate[100],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  skillBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.slate[600],
  },
  wagePill: {
    backgroundColor: theme.colors.slate[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  wageText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.slate[700],
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.slate[900],
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.slate[500],
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  footerDock: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.dock,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
  },
  presentBtn: {
    backgroundColor: theme.colors.emerald[600],
  },
  absentBtn: {
    backgroundColor: theme.colors.red[600],
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
