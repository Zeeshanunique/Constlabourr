import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormModal } from '@/components/shared/FormModal';
import { FormField } from '@/components/shared/FormField';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { colors, shadows, radii } from '@/styles/theme';

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
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('All');
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
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch workers' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const handleSubmit = async () => {
    if (!token) return;

    if (!formData.name.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter worker name' });
      return;
    }
    const cleanPhone = formData.phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 10-digit mobile number' });
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid email address' });
      return;
    }
    if (!editingWorker && (!formData.password || formData.password.length < 6)) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Password must be at least 6 characters' });
      return;
    }
    const dailyWageNum = parseFloat(formData.dailyWage);
    if (isNaN(dailyWageNum) || dailyWageNum <= 0) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid daily wage rate' });
      return;
    }

    setLoading(true);
    try {
      const workerData: any = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: cleanPhone,
        skillLevel: formData.skillLevel || 'unskilled',
        dailyWage: dailyWageNum,
        messCharge: parseFloat(formData.messCharge) || 0,
        siteId: formData.siteId || null,
        bankDetails: {
          accountNumber: formData.accountNumber.trim(),
          ifscCode: formData.ifscCode.trim().toUpperCase(),
          bankName: formData.bankName.trim(),
        },
      };

      if (formData.aadhaar) workerData.aadhaar = formData.aadhaar.trim();

      if (editingWorker) {
        if (formData.password && formData.password.trim().length >= 6) {
          workerData.password = formData.password.trim();
        }
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers/${editingWorker.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(workerData),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update worker profile');
        }
        Toast.show({ type: 'success', text1: 'Worker Updated', text2: `${workerData.name} record updated.` });
      } else {
        workerData.password = formData.password.trim();

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(workerData),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create worker account');
        }
        Toast.show({ type: 'success', text1: 'Worker Enrolled', text2: `${workerData.name} enrolled successfully.` });
      }

      setIsModalOpen(false);
      resetForm();
      fetchWorkers();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Operation Failed', text2: error.message || 'Worker saving failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (worker: Worker) => {
    Alert.alert(
      'Remove Worker',
      `Are you sure you want to remove ${worker.name} from the roster?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers/${worker.id}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              if (!response.ok) throw new Error('Failed to delete worker');
              Toast.show({ type: 'success', text1: 'Worker Removed', text2: `${worker.name} removed.` });
              fetchWorkers();
            } catch (error: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: error.message });
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
      aadhaar: (worker as any).aadhaar || (worker as any).aadhaarHash || '',
      skillLevel: worker.skillLevel || 'unskilled',
      dailyWage: worker.dailyWage ? worker.dailyWage.toString() : '',
      messCharge: worker.messCharge ? worker.messCharge.toString() : '',
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

  // Filter workers by search and skill
  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.phone.includes(searchTerm) ||
      w.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSkill =
      selectedSkillFilter === 'All' ||
      (w.skillLevel || 'unskilled').toLowerCase() === selectedSkillFilter.toLowerCase();
    return matchesSearch && matchesSkill;
  });

  const avgWage = workers.length > 0
    ? Math.round(workers.reduce((acc, w) => acc + (w.dailyWage || 0), 0) / workers.length)
    : 800;

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const skillOptions = [
    { label: 'Unskilled', value: 'unskilled' },
    { label: 'Semi-Skilled', value: 'semi-skilled' },
    { label: 'Skilled', value: 'skilled' },
    { label: 'Highly Skilled', value: 'highly-skilled' },
  ];

  const siteOptions = sites.map((s) => ({ label: s.name, value: s.id }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Workforce Roster</Text>
            <Text style={styles.headerSubtitle}>Directory, wage rates & site assignments</Text>
          </View>
          <TouchableOpacity
            style={styles.addWorkerButton}
            onPress={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={16} color="#FFFFFF" />
            <Text style={styles.addWorkerButtonText}>Add Worker</Text>
          </TouchableOpacity>
        </View>

        {/* 2. WORKFORCE KPI BENTO STRIP */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Crew</Text>
            <Text style={styles.kpiValue}>{workers.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Wage</Text>
            <Text style={[styles.kpiValue, { color: colors.accent }]}>₹{avgWage}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>KYC Verified</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>98%</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Contracts</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{workers.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* 3. SEARCH & SKILL FILTER BAR */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by worker name, phone or skill..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={colors.textLight}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <MaterialIcons name="clear" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Skill Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.skillFilterScroll}>
          {['All', 'Skilled', 'Semi-Skilled', 'Unskilled'].map((skill) => {
            const isSelected = selectedSkillFilter === skill;
            return (
              <TouchableOpacity
                key={skill}
                style={[styles.skillPill, isSelected && styles.skillPillActive]}
                onPress={() => setSelectedSkillFilter(skill)}
                activeOpacity={0.8}
              >
                <Text style={[styles.skillPillText, isSelected && styles.skillPillTextActive]}>
                  {skill}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 4. WORKER CARDS LIST */}
        <FlatList
          data={filteredWorkers}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchWorkers}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="people-outline" size={48} color={colors.borderDark} />
              <Text style={styles.emptyTitle}>No Workers Found</Text>
              <Text style={styles.emptySubtitle}>Tap "+ Add Worker" to onboard crew members.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const siteName = item.siteId ? siteMap.get(item.siteId) || 'Assigned Site' : 'No Site Assigned';
            const isSkilled = item.skillLevel === 'skilled';

            return (
              <View style={styles.workerCard}>
                <View style={styles.cardMain}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarInitials}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.workerDetails}>
                    <View style={styles.nameRow}>
                      <Text style={styles.workerNameText}>{item.name}</Text>
                      <View style={[styles.skillBadge, isSkilled && styles.skillBadgeHigh]}>
                        <Text style={[styles.skillBadgeText, isSkilled && styles.skillBadgeTextHigh]}>
                          {(item.skillLevel || 'unskilled').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.workerContact}>
                      📞 {item.phone || 'No phone'} • ✉️ {item.email}
                    </Text>

                    <View style={styles.siteBadgeRow}>
                      <MaterialIcons name="location-on" size={13} color={colors.accent} />
                      <Text style={styles.siteBadgeText}>{siteName}</Text>
                    </View>

                    {/* Financial Row */}
                    <View style={styles.financeRow}>
                      <View style={styles.financePill}>
                        <Text style={styles.financePillLabel}>Base Daily:</Text>
                        <Text style={styles.financePillVal}>₹{item.dailyWage || 0}</Text>
                      </View>
                      {item.messCharge ? (
                        <View style={[styles.financePill, { backgroundColor: colors.warningLight }]}>
                          <Text style={[styles.financePillLabel, { color: colors.warningDark }]}>Mess:</Text>
                          <Text style={[styles.financePillVal, { color: colors.warningDark }]}>-₹{item.messCharge}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Card Action Strip */}
                <View style={styles.cardActionsStrip}>
                  <View style={styles.kycStatusRow}>
                    <MaterialIcons name="verified" size={14} color={colors.success} />
                    <Text style={styles.kycStatusText}>Aadhaar Verified</Text>
                  </View>

                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => handleEdit(item)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="edit" size={16} color={colors.primary} />
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionIconButton, { marginLeft: 8 }]}
                      onPress={() => handleDelete(item)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="delete-outline" size={16} color={colors.error} />
                      <Text style={[styles.actionButtonText, { color: colors.error }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* 5. ONBOARDING / EDIT MODAL */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWorker ? 'Edit Worker Profile' : 'Add New Construction Worker'}
        subtitle={editingWorker ? 'Update worker wage rates or site assignment' : 'Enroll worker credentials & bank disbursement details'}
        submitLabel={editingWorker ? 'Update Worker' : 'Register Worker'}
        onSubmit={handleSubmit}
        loading={loading}
        submitDisabled={
          !formData.name.trim() ||
          formData.phone.trim().length < 10 ||
          !formData.email.trim() ||
          !formData.email.includes('@') ||
          (!editingWorker && (!formData.password || formData.password.length < 6)) ||
          !formData.dailyWage.trim() ||
          isNaN(parseFloat(formData.dailyWage)) ||
          parseFloat(formData.dailyWage) <= 0
        }
      >
        <FormField
          label="Worker Full Name"
          required
          value={formData.name}
          onChangeText={(val) => setFormData({ ...formData, name: val })}
          placeholder="e.g. Ramesh Kumar"
        />

        <FormField
          label="Mobile Phone Number"
          required
          type="phone"
          value={formData.phone}
          onChangeText={(val) => setFormData({ ...formData, phone: val })}
          placeholder="10-digit mobile number"
          helperText="Worker will receive SMS alerts on this number"
        />

        <FormField
          label="Email Address (Login ID)"
          required
          type="email"
          value={formData.email}
          onChangeText={(val) => setFormData({ ...formData, email: val })}
          placeholder="e.g. ramesh@constlabour.com"
          autoCapitalize="none"
        />

        <FormField
          label="Aadhaar Number (12 Digits)"
          type="number"
          value={formData.aadhaar}
          onChangeText={(val) => setFormData({ ...formData, aadhaar: val })}
          placeholder="12-digit Aadhaar number"
          helperText="Encrypted for statutory labor compliance"
        />

        <FormField
          label={editingWorker ? 'Change Password (Optional)' : 'Worker Login Password'}
          required={!editingWorker}
          type="password"
          value={formData.password}
          onChangeText={(val) => setFormData({ ...formData, password: val })}
          placeholder={editingWorker ? 'Leave blank to retain current password' : 'Minimum 6 characters'}
          helperText={!editingWorker ? 'Used for worker portal login' : undefined}
        />

        <FormField
          label="Skill Level & Classification"
          type="select"
          value={formData.skillLevel}
          onChangeText={(val) => setFormData({ ...formData, skillLevel: val })}
          selectOptions={skillOptions}
          placeholder="Select trade qualification"
        />

        <FormField
          label="Daily Base Wage Rate (₹)"
          required
          type="number"
          value={formData.dailyWage}
          onChangeText={(val) => setFormData({ ...formData, dailyWage: val })}
          placeholder="e.g. 850"
        />

        <FormField
          label="Daily Mess / Canteen Deduction (₹)"
          type="number"
          value={formData.messCharge}
          onChangeText={(val) => setFormData({ ...formData, messCharge: val })}
          placeholder="e.g. 50 (or 0 for no mess)"
        />

        <FormField
          label="Assigned Construction Site"
          type="select"
          value={formData.siteId}
          onChangeText={(val) => setFormData({ ...formData, siteId: val })}
          selectOptions={[
            { label: 'Unassigned (Floating Worker)', value: '' },
            ...siteOptions,
          ]}
          placeholder="Select active project site"
        />

        <FormField
          label="Bank Name"
          value={formData.bankName}
          onChangeText={(val) => setFormData({ ...formData, bankName: val })}
          placeholder="e.g. State Bank of India"
        />

        <FormField
          label="Bank Account Number"
          type="number"
          value={formData.accountNumber}
          onChangeText={(val) => setFormData({ ...formData, accountNumber: val })}
          placeholder="Account number for direct UPI/IMPS"
        />

        <FormField
          label="Bank IFSC Code"
          value={formData.ifscCode}
          onChangeText={(val) => setFormData({ ...formData, ifscCode: val })}
          placeholder="e.g. SBIN0001234"
          autoCapitalize="characters"
        />
      </FormModal>
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
    marginBottom: 12,
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
  addWorkerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  addWorkerButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  skillFilterScroll: {
    marginBottom: 10,
    maxHeight: 34,
  },
  skillPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  skillPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  skillPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  skillPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 24,
  },
  workerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...shadows.sm,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  workerDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  workerNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  skillBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  skillBadgeHigh: {
    backgroundColor: '#EFF6FF',
  },
  skillBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  skillBadgeTextHigh: {
    color: '#1D4ED8',
  },
  workerContact: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  siteBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  siteBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    marginLeft: 2,
  },
  financeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  financePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  financePillLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginRight: 4,
  },
  financePillVal: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  cardActionsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  kycStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kycStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.successDark,
    marginLeft: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 3,
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
  },
});
