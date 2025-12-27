import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { FormField } from '@/components/shared/FormField';
import { AppContext } from '@/context/AppContext';

interface Worker {
  id: string;
  name: string;
  phone: string;
  dailyWage: number;
  siteId?: string;
}

interface Site {
  id: string;
  name: string;
  foremanId?: string | null;
}

interface Attendance {
  id: string;
  workerId: string;
  workerName: string;
  siteId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  status: 'present' | 'absent' | 'half-day';
  totalHours: number;
  breakHours: number;
  netWorkHours: number;
  regularHours: number;
  overtimeHours: number;
  dailyWage: number;
  hourlyRate: number;
  overtimeRate: number;
  dailyPayment: number;
  overtimePayment: number;
  totalPayment: number;
  geoLocation: string | null;
  notes: string;
  markedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface AttendanceTabProps {
  accessToken?: string;
}

export function AttendanceTab({ accessToken }: AttendanceTabProps) {
  const route = useRoute();
  const context = useContext(AppContext);
  const token = accessToken || (route.params as any)?.accessToken;
  const userRole = context?.user?.role;
  const isForeman = userRole === 'foreman';
  
  // State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSite, setSelectedSite] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout'>('checkin');
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editingStatus, setEditingStatus] = useState<Attendance | null>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (token) {
      fetchWorkers();
      fetchSites();
    }
  }, [token, isForeman]);

  // Refresh attendance when tab comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (selectedSite && selectedDate && token) {
        fetchAttendance();
      }
    }, [selectedSite, selectedDate, token])
  );

  useEffect(() => {
    if (selectedSite && selectedDate && token) {
      fetchAttendance();
    }
  }, [selectedDate, selectedSite, token]);

  const fetchWorkers = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
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
      const fetchedSites = data.sites || [];
      
      // If foreman, filter to only their assigned sites
      if (isForeman && context?.user?.id) {
        const userId = context.user.id;
        const userSiteId = (context.user as any).siteId; // Foreman might have siteId
        
        const foremanSites = fetchedSites.filter((site: Site) => {
          // Check if site has this foreman assigned (foremanId matches current user)
          // OR if foreman has a siteId that matches this site
          return site.foremanId === userId || (userSiteId && site.id === userSiteId);
        });
        
        setSites(foremanSites);
        
        // Auto-select the site if only one assigned
        if (foremanSites.length === 1) {
          setSelectedSite(foremanSites[0].id);
        }
      } else {
        setSites(fetchedSites);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchAttendance = async () => {
    if (!token || !selectedSite || !selectedDate) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?siteId=${selectedSite}&date=${selectedDate}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (workerId: string, status: 'present' | 'absent' | 'half-day') => {
    if (!token || !selectedSite || !selectedDate) return;
    
    try {
      const response = await fetch(
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
            date: selectedDate,
            status,
            checkIn: status === 'present' ? currentTime.toISOString() : undefined,
          }),
        }
      );

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Marked as ${status}`,
        });
        fetchAttendance();
      } else {
        throw new Error('Failed to mark attendance');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to mark attendance',
      });
    }
  };

  const handleOpenEditModal = (worker: Worker, status: Attendance) => {
    setEditingWorker(worker);
    setEditingStatus(status);
    setShowEditModal(true);
  };

  const handleEditAttendance = async (newStatus: 'present' | 'absent' | 'half-day') => {
    if (!editingWorker || !token || !selectedSite || !selectedDate) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workerId: editingWorker.id,
            siteId: selectedSite,
            date: selectedDate,
            status: newStatus,
          }),
        }
      );

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Updated to ${newStatus}`,
        });
        setShowEditModal(false);
        setEditingWorker(null);
        setEditingStatus(null);
        fetchAttendance();
      } else {
        throw new Error('Failed to update attendance');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update attendance',
      });
    }
  };

  const handleRemoveAttendance = async () => {
    if (!editingStatus || !token) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${editingStatus.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Attendance removed',
        });
        setShowEditModal(false);
        setEditingWorker(null);
        setEditingStatus(null);
        fetchAttendance();
      } else {
        throw new Error('Failed to remove attendance');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to remove attendance',
      });
    }
  };

  const handleBulkMark = async (status: 'present' | 'absent') => {
    if (!token || !selectedSite || !selectedDate) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a site and date',
      });
      return;
    }

    const unmarkedWorkers = siteWorkers.filter(w => !getWorkerStatus(w.id));
    
    if (unmarkedWorkers.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'Info',
        text2: 'All workers already marked',
      });
      return;
    }

    setLoading(true);
    try {
      const promises = unmarkedWorkers.map(worker =>
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workerId: worker.id,
              siteId: selectedSite,
              date: selectedDate,
              status,
            }),
          }
        )
      );

      await Promise.all(promises);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Marked ${unmarkedWorkers.length} workers as ${status}`,
      });

      fetchAttendance();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWorkers(), fetchSites(), fetchAttendance()]);
    setRefreshing(false);
  };

  // Calculate stats
  const siteWorkers = workers.filter(w => !w.siteId || w.siteId === selectedSite);
  const totalWorkers = siteWorkers.length;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const halfDayCount = attendance.filter(a => a.status === 'half-day').length;
  const pendingCount = totalWorkers - (presentCount + absentCount + halfDayCount);

  // Get worker status
  const getWorkerStatus = (workerId: string): Attendance | undefined => {
    return attendance.find(a => a.workerId === workerId);
  };

  const siteOptions = sites.map(site => ({
    label: site.name,
    value: site.id,
  }));

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header with Live Clock */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Attendance</Text>
              <Text style={styles.headerSubtitle}>{formatDate(currentTime)}</Text>
            </View>
            <View style={styles.clockContainer}>
              <MaterialIcons name="access-time" size={20} color="#dbeafe" />
              <Text style={styles.clockText}>{formatTime(currentTime)}</Text>
            </View>
          </View>
        </View>

        {/* Site and Date Filters */}
        <View style={styles.filtersCard}>
          {!isForeman || sites.length > 1 ? (
            <View style={styles.filterItem}>
              <FormField
                label="Site"
                type="select"
                value={selectedSite}
                onChangeText={setSelectedSite}
                selectOptions={siteOptions}
                placeholder="Choose a site"
              />
            </View>
          ) : sites.length === 1 ? (
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Site</Text>
              <View style={styles.selectedSiteDisplay}>
                <MaterialIcons name="place" size={20} color="#2563eb" />
                <Text style={styles.selectedSiteText}>{sites[0].name}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.filterItem}>
            <FormField
              label="Date"
              type="date"
              value={selectedDate}
              onChangeText={setSelectedDate}
            />
          </View>
        </View>

        {selectedSite && (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
                <View style={styles.statIconContainer}>
                  <MaterialIcons name="people" size={18} color="#3b82f6" />
                </View>
                <Text style={styles.statValue}>{totalWorkers}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
                <View style={styles.statIconContainer}>
                  <MaterialIcons name="check-circle" size={18} color="#10b981" />
                </View>
                <Text style={styles.statValue}>{presentCount}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
                <View style={styles.statIconContainer}>
                  <MaterialIcons name="pending" size={18} color="#f59e0b" />
                </View>
                <Text style={styles.statValue}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
                <View style={styles.statIconContainer}>
                  <MaterialIcons name="cancel" size={18} color="#ef4444" />
                </View>
                <Text style={styles.statValue}>{absentCount}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickActionCard, styles.quickActionPresent]}
                onPress={() => handleBulkMark('present')}
                disabled={loading}
              >
                <MaterialIcons name="check-circle" size={28} color="#10b981" />
                <Text style={styles.quickActionText}>Mark All Present</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionCard, styles.quickActionAbsent]}
                onPress={() => handleBulkMark('absent')}
                disabled={loading}
              >
                <MaterialIcons name="cancel" size={28} color="#ef4444" />
                <Text style={styles.quickActionText}>Mark All Absent</Text>
              </TouchableOpacity>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'checkin' && styles.tabActive]}
                onPress={() => setActiveTab('checkin')}
              >
                <MaterialIcons 
                  name="login" 
                  size={20} 
                  color={activeTab === 'checkin' ? '#3b82f6' : '#6b7280'} 
                />
                <Text style={[styles.tabText, activeTab === 'checkin' && styles.tabTextActive]}>
                  Check In ({pendingCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'checkout' && styles.tabActive]}
                onPress={() => setActiveTab('checkout')}
              >
                <MaterialIcons 
                  name="logout" 
                  size={20} 
                  color={activeTab === 'checkout' ? '#3b82f6' : '#6b7280'} 
                />
                <Text style={[styles.tabText, activeTab === 'checkout' && styles.tabTextActive]}>
                  Marked ({presentCount + absentCount + halfDayCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Workers List */}
            {loading && attendance.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading workers...</Text>
              </View>
            ) : siteWorkers.length > 0 ? (
              <FlatList
                data={activeTab === 'checkin' 
                  ? siteWorkers.filter(w => !getWorkerStatus(w.id))
                  : siteWorkers.filter(w => getWorkerStatus(w.id))
                }
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const status = getWorkerStatus(item.id);
                  const isMarked = !!status;
                  
                  return (
                    <View style={styles.workerCard}>
                      <View style={styles.workerLeft}>
                        <View style={[
                          styles.workerAvatar,
                          isMarked && styles.workerAvatarMarked,
                        ]}>
                          <Text style={styles.workerAvatarText}>
                            {item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.workerInfo}>
                          <Text style={styles.workerName}>{item.name}</Text>
                          <View style={styles.workerMeta}>
                            <MaterialIcons name="phone" size={14} color="#6b7280" />
                            <Text style={styles.workerPhone}>{item.phone}</Text>
                          </View>
                          <View style={styles.workerMeta}>
                            <MaterialIcons name="attach-money" size={14} color="#6b7280" />
                            <Text style={styles.workerWage}>₹{item.dailyWage}/day</Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.workerRight}>
                        {!isMarked ? (
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.actionBtnPresent]}
                              onPress={() => handleMarkAttendance(item.id, 'present')}
                            >
                              <MaterialIcons name="check" size={18} color="#ffffff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.actionBtnAbsent]}
                              onPress={() => handleMarkAttendance(item.id, 'absent')}
                            >
                              <MaterialIcons name="close" size={18} color="#ffffff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.actionBtnHalf]}
                              onPress={() => handleMarkAttendance(item.id, 'half-day')}
                            >
                              <MaterialIcons name="schedule" size={18} color="#ffffff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.statusContainer}>
                            <View style={[
                              styles.statusBadge,
                              status?.status === 'present' && styles.statusPresent,
                              status?.status === 'absent' && styles.statusAbsent,
                              status?.status === 'half-day' && styles.statusHalfDay,
                            ]}>
                              <MaterialIcons
                                name={
                                  status?.status === 'present' ? 'check-circle' :
                                  status?.status === 'absent' ? 'cancel' : 'schedule'
                                }
                                size={16}
                                color="#ffffff"
                              />
                              <Text style={styles.statusText}>
                                {status?.status === 'half-day' ? 'Half Day' : 
                                 status?.status.charAt(0).toUpperCase() + status?.status.slice(1)}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.editButton}
                              onPress={() => handleOpenEditModal(item, status)}
                            >
                              <MaterialIcons name="edit" size={16} color="#6b7280" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <MaterialIcons 
                      name={activeTab === 'checkin' ? 'check-circle' : 'people-outline'} 
                      size={48} 
                      color="#d1d5db" 
                    />
                    <Text style={styles.emptyText}>
                      {activeTab === 'checkin' 
                        ? 'All workers marked for today!' 
                        : 'No attendance marked yet'}
                    </Text>
                  </View>
                }
              />
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="people-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No workers assigned to this site</Text>
              </View>
            )}
          </>
        )}

        {!selectedSite && (
          <View style={styles.emptyState}>
            <MaterialIcons name="place" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Select a site to start marking attendance</Text>
          </View>
        )}
      </ScrollView>

      {/* Edit Attendance Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Attendance</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {editingWorker && (
              <>
                <View style={styles.modalWorkerInfo}>
                  <View style={styles.modalWorkerAvatar}>
                    <Text style={styles.modalWorkerAvatarText}>
                      {editingWorker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.modalWorkerName}>{editingWorker.name}</Text>
                    <Text style={styles.modalWorkerPhone}>{editingWorker.phone}</Text>
                  </View>
                </View>

                <View style={styles.modalCurrentStatus}>
                  <Text style={styles.modalCurrentStatusLabel}>Current Status:</Text>
                  <View style={[
                    styles.modalCurrentStatusBadge,
                    editingStatus?.status === 'present' && styles.statusPresent,
                    editingStatus?.status === 'absent' && styles.statusAbsent,
                    editingStatus?.status === 'half-day' && styles.statusHalfDay,
                  ]}>
                    <Text style={styles.modalCurrentStatusText}>
                      {editingStatus?.status === 'half-day' ? 'Half Day' : 
                       editingStatus?.status?.charAt(0).toUpperCase() + editingStatus?.status?.slice(1)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Change to:</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalActionPresent]}
                    onPress={() => handleEditAttendance('present')}
                  >
                    <MaterialIcons name="check-circle" size={24} color="#10b981" />
                    <Text style={styles.modalActionText}>Present</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalActionAbsent]}
                    onPress={() => handleEditAttendance('absent')}
                  >
                    <MaterialIcons name="cancel" size={24} color="#ef4444" />
                    <Text style={styles.modalActionText}>Absent</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalActionHalfDay]}
                    onPress={() => handleEditAttendance('half-day')}
                  >
                    <MaterialIcons name="schedule" size={24} color="#f59e0b" />
                    <Text style={styles.modalActionText}>Half Day</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBottomButtons}>
                  <TouchableOpacity
                    style={styles.modalRemoveButton}
                    onPress={handleRemoveAttendance}
                  >
                    <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                    <Text style={styles.modalRemoveText}>Remove Attendance</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#dbeafe',
  },
  clockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  clockText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  filtersCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  filterItem: {
    width: '100%',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  selectedSiteDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  selectedSiteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  statIconContainer: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  quickActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionPresent: {
    borderWidth: 2,
    borderColor: '#10b981',
  },
  quickActionAbsent: {
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  workerCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  workerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  workerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarMarked: {
    backgroundColor: '#d1fae5',
  },
  workerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  workerInfo: {
    flex: 1,
    gap: 3,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  workerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workerPhone: {
    fontSize: 13,
    color: '#6b7280',
  },
  workerWage: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  workerRight: {
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPresent: {
    backgroundColor: '#10b981',
  },
  actionBtnAbsent: {
    backgroundColor: '#ef4444',
  },
  actionBtnHalf: {
    backgroundColor: '#f59e0b',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusPresent: {
    backgroundColor: '#10b981',
  },
  statusAbsent: {
    backgroundColor: '#ef4444',
  },
  statusHalfDay: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
  },
  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalWorkerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalWorkerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalWorkerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  modalWorkerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  modalWorkerPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalCurrentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  modalCurrentStatusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  modalCurrentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalCurrentStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  modalActions: {
    gap: 12,
    marginBottom: 20,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  modalActionPresent: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  modalActionAbsent: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  modalActionHalfDay: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modalBottomButtons: {
    gap: 12,
  },
  modalRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  modalRemoveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
  modalCancelButton: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
});
