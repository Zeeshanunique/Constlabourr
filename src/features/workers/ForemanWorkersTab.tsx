import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from '@/components/ui/modal';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';

interface Worker {
  id: string;
  name: string;
  phone: string;
  email: string;
  skillLevel: string;
  dailyWage: number;
  messCharge?: number;
  status: string;
  siteId?: string;
  siteName?: string;
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
}

interface ForemanWorkersTabProps {
  accessToken?: string;
}

export function ForemanWorkersTab({ accessToken }: ForemanWorkersTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (token) {
      fetchWorkers();
    }
  }, [token]);

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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch workers',
      });
    }
  };

  const filteredWorkers = workers.filter((worker) =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.phone.includes(searchTerm) ||
    worker.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsDetailModalOpen(true);
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'skilled': return '#22c55e';
      case 'semi-skilled': return '#f59e0b';
      case 'unskilled': return '#9ca3af';
      default: return '#9ca3af';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#22c55e' : '#ef4444';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workers</Text>
        <Text style={styles.headerSubtitle}>View assigned workers (Read-only)</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <Input style={styles.searchInput}>
            <InputField
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search workers..."
              placeholderTextColor="#9ca3af"
              style={styles.searchInputField}
            />
          </Input>
        </View>

        <FlatList
          data={filteredWorkers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleViewDetails(item)}>
              <Card style={styles.workerCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.workerInfo}>
                    <Text style={styles.workerName}>{item.name}</Text>
                    <View style={styles.badges}>
                      <View style={[styles.badge, { backgroundColor: getSkillLevelColor(item.skillLevel) }]}>
                        <Text style={styles.badgeText}>{item.skillLevel}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.badgeText}>{item.status}</Text>
                      </View>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
                </View>
                
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="phone" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>{item.phone}</Text>
                  </View>
                  {item.email && (
                    <View style={styles.detailRow}>
                      <MaterialIcons name="email" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{item.email}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <MaterialIcons name="payments" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>₹{item.dailyWage}/day</Text>
                  </View>
                  {item.siteName && (
                    <View style={styles.detailRow}>
                      <MaterialIcons name="place" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{item.siteName}</Text>
                    </View>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No workers found</Text>
              <Text style={styles.emptySubtext}>
                {searchTerm ? 'Try a different search term' : 'No workers assigned yet'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </View>

      {/* Worker Detail Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} size="lg">
        <ModalBackdrop onPress={() => setIsDetailModalOpen(false)} />
        <ModalContent style={styles.modalContent}>
          <ModalHeader style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Worker Details</Text>
            <ModalCloseButton onPress={() => setIsDetailModalOpen(false)}>
              <MaterialIcons name="close" size={24} color="#717182" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody style={styles.modalBody}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedWorker && (
                <VStack space="lg" style={{ paddingBottom: 20 }}>
                  {/* Personal Information */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <View style={styles.infoGrid}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Name</Text>
                        <Text style={styles.infoValue}>{selectedWorker.name}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone</Text>
                        <Text style={styles.infoValue}>{selectedWorker.phone}</Text>
                      </View>
                      {selectedWorker.email && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Email</Text>
                          <Text style={styles.infoValue}>{selectedWorker.email}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Work Details */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Work Details</Text>
                    <View style={styles.infoGrid}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Skill Level</Text>
                        <View style={[styles.badge, { backgroundColor: getSkillLevelColor(selectedWorker.skillLevel) }]}>
                          <Text style={styles.badgeText}>{selectedWorker.skillLevel}</Text>
                        </View>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Status</Text>
                        <View style={[styles.badge, { backgroundColor: getStatusColor(selectedWorker.status) }]}>
                          <Text style={styles.badgeText}>{selectedWorker.status}</Text>
                        </View>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Daily Wage</Text>
                        <Text style={styles.infoValue}>₹{selectedWorker.dailyWage}</Text>
                      </View>
                      {selectedWorker.messCharge !== undefined && selectedWorker.messCharge > 0 && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Mess Charge</Text>
                          <Text style={styles.infoValue}>₹{selectedWorker.messCharge}</Text>
                        </View>
                      )}
                      {selectedWorker.siteName && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Assigned Site</Text>
                          <Text style={styles.infoValue}>{selectedWorker.siteName}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Bank Details */}
                  {selectedWorker.bankDetails && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Bank Details</Text>
                      <View style={styles.infoGrid}>
                        {selectedWorker.bankDetails.accountNumber && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Account Number</Text>
                            <Text style={styles.infoValue}>{selectedWorker.bankDetails.accountNumber}</Text>
                          </View>
                        )}
                        {selectedWorker.bankDetails.ifscCode && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>IFSC Code</Text>
                            <Text style={styles.infoValue}>{selectedWorker.bankDetails.ifscCode}</Text>
                          </View>
                        )}
                        {selectedWorker.bankDetails.bankName && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Bank Name</Text>
                            <Text style={styles.infoValue}>{selectedWorker.bankDetails.bankName}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </VStack>
              )}
            </ScrollView>
          </ModalBody>
        </ModalContent>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  searchInputField: {
    fontSize: 16,
    color: '#111827',
  },
  listContent: {
    paddingBottom: 16,
  },
  workerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  cardDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  infoGrid: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
});

