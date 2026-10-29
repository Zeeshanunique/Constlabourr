import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from '@/components/ui/modal';
import { VStack } from '@/components/ui/vstack';
import { theme } from '@/styles/theme';

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
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string>('all');
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

  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch =
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.phone.includes(searchTerm) ||
      worker.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedSkillFilter === 'all') return matchesSearch;
    return matchesSearch && worker.skillLevel?.toLowerCase() === selectedSkillFilter;
  });

  const handleViewDetails = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsDetailModalOpen(true);
  };

  const getSkillConfig = (level?: string) => {
    const l = level?.toLowerCase();
    switch (l) {
      case 'highly-skilled':
        return { label: 'Highly Skilled', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
      case 'skilled':
        return { label: 'Skilled', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'semi-skilled':
        return { label: 'Semi-Skilled', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      case 'unskilled':
      default:
        return { label: 'Unskilled', bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const activeCount = workers.filter(w => w.status === 'active').length;
  const skilledCount = workers.filter(w => w.skillLevel?.toLowerCase() === 'skilled').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Assigned Workforce</Text>
          <Text style={styles.headerSubtitle}>Field worker roster under your site supervision</Text>
        </View>
        <View style={styles.roleChip}>
          <MaterialIcons name="security" size={14} color="#ffffff" />
          <Text style={styles.roleChipText}>SUPERVISOR</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Quick KPI Strip */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNumber}>{workers.length}</Text>
            <Text style={styles.kpiLabel}>Total Crew</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: theme.colors.emerald[200] }]}>
            <Text style={[styles.kpiNumber, { color: theme.colors.emerald[600] }]}>{activeCount}</Text>
            <Text style={styles.kpiLabel}>Active</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: theme.colors.amber[200] }]}>
            <Text style={[styles.kpiNumber, { color: theme.colors.safetyOrange }]}>{skilledCount}</Text>
            <Text style={styles.kpiLabel}>Skilled</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrapper}>
          <MaterialIcons name="search" size={20} color={theme.colors.slate[400]} style={styles.searchIcon} />
          <Input style={styles.searchInput}>
            <InputField
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search by worker name or phone..."
              placeholderTextColor={theme.colors.slate[400]}
              style={styles.searchInputField}
            />
          </Input>
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={18} color={theme.colors.slate[400]} />
            </TouchableOpacity>
          )}
        </View>

        {/* Skill Filter Chips */}
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'All Trades' },
            { id: 'skilled', label: 'Skilled' },
            { id: 'semi-skilled', label: 'Semi-Skilled' },
            { id: 'unskilled', label: 'General' },
          ].map((chip) => {
            const isSelected = selectedSkillFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setSelectedSkillFilter(chip.id)}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Worker Cards */}
        <FlatList
          data={filteredWorkers}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const skill = getSkillConfig(item.skillLevel);
            const isActive = item.status === 'active';
            return (
              <TouchableOpacity 
                onPress={() => handleViewDetails(item)} 
                activeOpacity={0.8}
                style={styles.workerCard}
              >
                <View style={styles.workerCardHeader}>
                  <View style={styles.workerAvatar}>
                    <Text style={styles.workerAvatarText}>
                      {item.name ? item.name.charAt(0).toUpperCase() : 'W'}
                    </Text>
                  </View>
                  <View style={styles.workerInfo}>
                    <View style={styles.nameStatusRow}>
                      <Text style={styles.workerName}>{item.name}</Text>
                      <View style={[
                        styles.statusDot, 
                        { backgroundColor: isActive ? theme.colors.emerald[500] : theme.colors.red[500] }
                      ]} />
                    </View>
                    <View style={styles.skillPillContainer}>
                      <View style={[styles.skillBadge, { backgroundColor: skill.bg, borderColor: skill.border }]}>
                        <Text style={[styles.skillBadgeText, { color: skill.text }]}>{skill.label}</Text>
                      </View>
                      {item.siteName ? (
                        <View style={styles.sitePill}>
                          <MaterialIcons name="place" size={11} color={theme.colors.slate[500]} />
                          <Text style={styles.sitePillText} numberOfLines={1}>{item.siteName}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={theme.colors.slate[400]} />
                </View>

                <View style={styles.workerCardFooter}>
                  <TouchableOpacity 
                    style={styles.phoneButton}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="phone" size={14} color={theme.colors.slate[600]} />
                    <Text style={styles.phoneButtonText}>{item.phone}</Text>
                  </TouchableOpacity>

                  <View style={styles.wageBadge}>
                    <Text style={styles.wageText}>₹{item.dailyWage}</Text>
                    <Text style={styles.wageLabel}>/day</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="people-outline" size={44} color={theme.colors.slate[400]} />
              <Text style={styles.emptyText}>No Workers Found</Text>
              <Text style={styles.emptySubtext}>
                {searchTerm ? 'No worker matches your search filters.' : 'Your contractor has not assigned workers to this site roster yet.'}
              </Text>
            </View>
          }
        />
      </View>

      {/* Worker Detail Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} size="lg">
        <ModalBackdrop onPress={() => setIsDetailModalOpen(false)} />
        <ModalContent style={styles.modalContent}>
          <ModalHeader style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{selectedWorker?.name}</Text>
              <Text style={styles.modalSubtitle}>Worker Profile & Wage Breakdown</Text>
            </View>
            <ModalCloseButton onPress={() => setIsDetailModalOpen(false)}>
              <MaterialIcons name="close" size={22} color={theme.colors.slate[500]} />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody style={styles.modalBody}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedWorker && (
                <VStack space="md" style={{ paddingBottom: 20 }}>
                  {/* Quick Summary Pill */}
                  <View style={styles.modalSummaryStrip}>
                    <View style={styles.modalSummaryItem}>
                      <Text style={styles.modalSummaryLabel}>DAILY WAGE</Text>
                      <Text style={styles.modalSummaryValue}>₹{selectedWorker.dailyWage}</Text>
                    </View>
                    <View style={styles.modalSummaryDivider} />
                    <View style={styles.modalSummaryItem}>
                      <Text style={styles.modalSummaryLabel}>MESS CHARGE</Text>
                      <Text style={styles.modalSummaryValue}>-₹{selectedWorker.messCharge || 0}</Text>
                    </View>
                    <View style={styles.modalSummaryDivider} />
                    <View style={styles.modalSummaryItem}>
                      <Text style={styles.modalSummaryLabel}>NET / DAY</Text>
                      <Text style={[styles.modalSummaryValue, { color: theme.colors.emerald[600] }]}>
                        ₹{(selectedWorker.dailyWage || 0) - (selectedWorker.messCharge || 0)}
                      </Text>
                    </View>
                  </View>

                  {/* Personal Contact */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>CONTACT INFORMATION</Text>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Phone Number</Text>
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedWorker.phone}`)}>
                        <Text style={[styles.modalValue, { color: theme.colors.safetyOrange, fontWeight: '700' }]}>
                          {selectedWorker.phone}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {selectedWorker.email ? (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalLabel}>Email</Text>
                        <Text style={styles.modalValue}>{selectedWorker.email}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Deployment Details */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>SITE & TRADE</Text>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Trade Classification</Text>
                      <Text style={styles.modalValue}>{selectedWorker.skillLevel?.toUpperCase() || 'GENERAL'}</Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Assigned Site</Text>
                      <Text style={styles.modalValue}>{selectedWorker.siteName || 'Unassigned'}</Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Account Status</Text>
                      <Text style={[styles.modalValue, { color: selectedWorker.status === 'active' ? theme.colors.emerald[600] : theme.colors.red[600] }]}>
                        {selectedWorker.status?.toUpperCase() || 'ACTIVE'}
                      </Text>
                    </View>
                  </View>

                  {/* Bank Details */}
                  {selectedWorker.bankDetails?.accountNumber ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>VERIFIED BANK DISBURSEMENT</Text>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalLabel}>Account No</Text>
                        <Text style={styles.modalValue}>{selectedWorker.bankDetails.accountNumber}</Text>
                      </View>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalLabel}>IFSC Code</Text>
                        <Text style={styles.modalValue}>{selectedWorker.bankDetails.ifscCode || 'N/A'}</Text>
                      </View>
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalLabel}>Bank</Text>
                        <Text style={styles.modalValue}>{selectedWorker.bankDetails.bankName || 'N/A'}</Text>
                      </View>
                    </View>
                  ) : null}
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
  roleChip: {
    backgroundColor: theme.colors.slate[900],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleChipText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  kpiNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.slate[900],
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.slate[500],
    marginTop: 2,
    textTransform: 'uppercase',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    minHeight: 46,
    marginBottom: 10,
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
    fontSize: 14,
    color: theme.colors.slate[900],
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.slate[900],
    borderColor: theme.colors.slate[900],
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.slate[600],
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingBottom: 24,
  },
  workerCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  workerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  workerInfo: {
    flex: 1,
    gap: 4,
  },
  nameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.slate[900],
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  skillPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sitePillText: {
    fontSize: 11,
    color: theme.colors.slate[500],
    maxWidth: 120,
  },
  workerCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.slate[100],
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  phoneButtonText: {
    fontSize: 12,
    color: theme.colors.slate[600],
    fontWeight: '600',
  },
  wageBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: theme.colors.safetyOrangeLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.2)',
  },
  wageText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.safetyOrange,
  },
  wageLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.safetyOrange,
    marginLeft: 2,
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
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    padding: 20,
    maxWidth: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.slate[900],
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.slate[500],
    marginTop: 2,
  },
  modalBody: {
    padding: 0,
  },
  modalSummaryStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.slate[50],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  modalSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.slate[500],
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalSummaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.slate[900],
  },
  modalSummaryDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  modalSection: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 8,
  },
  modalSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.slate[500],
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: 13,
    color: theme.colors.slate[600],
  },
  modalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.slate[900],
  },
});
