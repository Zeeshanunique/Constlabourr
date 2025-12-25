import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { FormModal } from '@/components/shared/FormModal';
import { FormField } from '@/components/shared/FormField';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

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
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
}

interface Site {
  id: string;
  name: string;
}

interface WorkersTabProps {
  accessToken?: string;
}

export function WorkersTab({ accessToken }: WorkersTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    aadhaar: '',
    skillLevel: 'unskilled',
    dailyWage: '',
    messCharge: '',
    siteId: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
  });

  useEffect(() => {
    if (token) {
      fetchWorkers();
      fetchSites();
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

  const handleSubmit = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const workerData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        skillLevel: formData.skillLevel,
        dailyWage: parseFloat(formData.dailyWage) || 0,
        messCharge: parseFloat(formData.messCharge) || 0,
        siteId: formData.siteId || null,
        bankDetails: {
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          bankName: formData.bankName,
        },
      };

      if (formData.aadhaar) {
        workerData.aadhaar = formData.aadhaar;
      }

      if (editingWorker) {
        // Update worker
        if (formData.password) {
          workerData.password = formData.password;
        }
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers/${editingWorker.id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(workerData),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update worker');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Worker updated successfully',
        });
      } else {
        // Create worker
        if (!formData.password) {
          throw new Error('Password is required');
        }
        workerData.password = formData.password;

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(workerData),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create worker');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Worker created successfully',
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchWorkers();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to save worker',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (worker: Worker) => {
    Alert.alert(
      'Delete Worker',
      `Are you sure you want to delete ${worker.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers/${worker.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` },
                }
              );

              if (!response.ok) {
                throw new Error('Failed to delete worker');
              }

              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Worker deleted successfully',
              });
              fetchWorkers();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to delete worker',
              });
            }
          },
        },
      ]
    );
  };

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setFormData({
      name: worker.name,
      email: worker.email,
      password: '',
      phone: worker.phone,
      aadhaar: '',
      skillLevel: worker.skillLevel,
      dailyWage: worker.dailyWage.toString(),
      messCharge: (worker.messCharge || 0).toString(),
      siteId: worker.siteId || '',
      accountNumber: worker.bankDetails?.accountNumber || '',
      ifscCode: worker.bankDetails?.ifscCode || '',
      bankName: worker.bankDetails?.bankName || '',
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      aadhaar: '',
      skillLevel: 'unskilled',
      dailyWage: '',
      messCharge: '',
      siteId: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    });
    setEditingWorker(null);
  };

  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.phone.includes(searchTerm) ||
    worker.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Workers</Text>
            <Text style={styles.headerSubtitle}>Manage your labour workforce</Text>
          </View>
          <Button
            onPress={() => { resetForm(); setIsModalOpen(true); }}
            style={styles.addButton}
          >
            <MaterialIcons name="add" size={20} color="#ffffff" />
            <ButtonText style={styles.addButtonText}>Add Worker</ButtonText>
          </Button>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Input size="md" variant="outline" style={styles.searchWrapper}>
            <MaterialIcons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
            <InputField
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
              placeholderTextColor="#9ca3af"
            />
          </Input>
        </View>

        {/* Workers List */}
        <FlatList
          data={filteredWorkers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.workerCard}>
              <View style={styles.workerCardHeader}>
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{item.name}</Text>
                  <Text style={styles.workerPhone}>{item.phone}</Text>
                </View>
                <View style={styles.workerActions}>
                  <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                    <MaterialIcons name="edit" size={20} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                    <MaterialIcons name="delete" size={20} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.workerDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Skill Level:</Text>
                  <Text style={styles.detailValue}>{item.skillLevel}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Daily Wage:</Text>
                  <Text style={styles.detailValue}>₹{item.dailyWage}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[styles.statusBadge, item.status === 'active' && styles.statusBadgeActive]}>
                    <Text style={[styles.statusText, item.status === 'active' && styles.statusTextActive]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="people-outline" size={64} color="#d1d5db" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>No workers found</Text>
              <Text style={styles.emptySubtext}>Add your first worker to get started</Text>
            </View>
          }
        />
      </View>

      {/* Add/Edit Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={editingWorker ? 'Edit Worker' : 'Add New Worker'}
        subtitle={editingWorker ? 'Update worker information' : 'Enter worker details to create their profile'}
        onSubmit={handleSubmit}
        submitLabel={editingWorker ? 'Update Worker' : 'Create Worker'}
        loading={loading}
        submitDisabled={!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()}
      >
        <FormField
          label="Full Name"
                      value={formData.name}
                      onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="Full name"
          required
          type="text"
        />

        <FormField
          label="Phone Number"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="Phone number"
          required
          type="phone"
        />

        <FormField
          label="Email Address"
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      placeholder="worker@example.com"
          required
          type="email"
        />

                {!editingWorker && (
          <FormField
            label="Password"
                        value={formData.password}
                        onChangeText={(text) => setFormData({ ...formData, password: text })}
            placeholder="Minimum 6 characters"
            required
            type="password"
          />
                )}

                {editingWorker && (
          <FormField
            label="New Password (optional)"
                        value={formData.password}
                        onChangeText={(text) => setFormData({ ...formData, password: text })}
                        placeholder="Leave blank to keep current"
            type="password"
          />
                )}

        <FormField
          label="Aadhaar Number"
                      value={formData.aadhaar}
                      onChangeText={(text) => setFormData({ ...formData, aadhaar: text })}
          placeholder="XXXX XXXX XXXX"
          type="number"
                      keyboardType="number-pad"
        />

        <FormField
          label="Skill Level"
          value={formData.skillLevel}
          onValueChange={(value) => setFormData({ ...formData, skillLevel: value })}
          placeholder="Select skill level"
          required
          type="select"
          selectOptions={[
            { label: 'Unskilled', value: 'unskilled' },
            { label: 'Semi-skilled', value: 'semi-skilled' },
            { label: 'Skilled', value: 'skilled' },
            { label: 'Highly Skilled', value: 'highly-skilled' },
          ]}
        />

        <FormField
          label="Daily Wage (₹)"
                      value={formData.dailyWage}
                      onChangeText={(text) => setFormData({ ...formData, dailyWage: text })}
                      placeholder="Daily wage"
          required
          type="number"
                      keyboardType="decimal-pad"
        />

        <FormField
          label="Daily Mess Charge (₹)"
                      value={formData.messCharge}
                      onChangeText={(text) => setFormData({ ...formData, messCharge: text })}
                      placeholder="Mess charge per day"
          helperText="Deducted from payroll when present"
          type="number"
                      keyboardType="decimal-pad"
        />

        <FormField
          label="Assign to Site"
          value={formData.siteId}
          onValueChange={(value) => setFormData({ ...formData, siteId: value })}
          placeholder="Select site"
          type="select"
          selectOptions={[
            { label: 'None', value: '' },
            ...sites.map((site) => ({ label: site.name, value: site.id })),
          ]}
        />

        <Text size="md" bold style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 16 }}>Bank Details (Optional)</Text>

        <FormField
          label="Bank Name"
          value={formData.bankName}
          onChangeText={(text) => setFormData({ ...formData, bankName: text })}
          placeholder="Bank name"
          type="text"
        />

        <FormField
          label="Account Number"
                      value={formData.accountNumber}
                      onChangeText={(text) => setFormData({ ...formData, accountNumber: text })}
                      placeholder="Bank account number"
          type="number"
                      keyboardType="number-pad"
        />

        <FormField
          label="IFSC Code"
                      value={formData.ifscCode}
                      onChangeText={(text) => setFormData({ ...formData, ifscCode: text.toUpperCase() })}
                      placeholder="IFSC code"
          type="text"
                      autoCapitalize="characters"
        />
      </FormModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
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
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  workerCard: {
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
  workerCardHeader: {
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
    marginBottom: 4,
  },
  workerPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  workerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  workerDetails: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#dcfce7',
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#16a34a',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
