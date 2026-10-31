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
  Linking,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormModal } from '@/components/shared/FormModal';
import { FormField } from '@/components/shared/FormField';
import { formStyles } from '@/components/shared/form-styles';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { colors, shadows, radii } from '@/styles/theme';
import { WorkerDetailView } from './WorkerDetailView';
import { useTranslation } from '@/i18n';

interface Worker {
  id: string;
  name: string;
  phone: string;
  email: string;
  skillLevel: string;
  dailyWage: number;
  overtimeRate?: number;
  messCharge?: number;
  status: string;
  siteId?: string;
  aadhaar?: string;
  upiId?: string;
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
  const { t, language } = useTranslation();
  const token = accessToken || (route.params as any)?.accessToken;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const handleCall = (phone?: string) => {
    if (!phone) {
      Toast.show({ type: 'info', text1: 'No Phone Number', text2: 'No phone number saved for this worker' });
      return;
    }
    const clean = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      Toast.show({ type: 'error', text1: 'Call Failed', text2: 'Could not open phone dialer' });
    });
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    aadhaar: '',
    skillLevel: 'unskilled',
    dailyWage: '',
    overtimeRate: '100',
    messCharge: '',
    siteId: '',
    upiId: '',
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

  // Handle hardware / device back button when worker detail is open
  useEffect(() => {
    const onHardwareBack = () => {
      if (selectedWorker) {
        setSelectedWorker(null);
        return true; // Intercept and prevent navigating back to Dashboard
      }
      return false; // Default navigation behavior
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => backSub.remove();
  }, [selectedWorker]);

  const fetchWorkers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      const list = (data.workers || []).map((w: any) => ({
        ...w,
        upiId: (w.upiId || w.upi_id || '').trim(),
      }));
      setWorkers(list);
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
    const digits = formData.phone.trim().replace(/\D/g, '');
    const cleanPhone = digits.length > 10 ? digits.slice(-10) : digits;
    if (cleanPhone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Mobile phone number must be exactly 10 digits' });
      return;
    }
    const cleanAadhaar = formData.aadhaar ? formData.aadhaar.trim().replace(/\D/g, '').slice(0, 12) : '';
    if (cleanAadhaar && cleanAadhaar.length !== 12) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Aadhaar number must be exactly 12 digits (or leave blank)' });
      return;
    }
    const cleanEmail = formData.email.trim().toLowerCase();
    if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid email address or leave blank' });
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
      const otRateNum = formData.overtimeRate.trim() ? parseFloat(formData.overtimeRate) : 100;
      const workerData: any = {
        name: formData.name.trim(),
        email: cleanEmail || null,
        phone: cleanPhone,
        skillLevel: formData.skillLevel || 'unskilled',
        dailyWage: dailyWageNum,
        overtimeRate: isNaN(otRateNum) ? 100 : otRateNum,
        messCharge: parseFloat(formData.messCharge) || 0,
        siteId: formData.siteId || null,
        upiId: formData.upiId.trim() || null,
        upi_id: formData.upiId.trim() || null,
        bankDetails: {
          accountNumber: formData.accountNumber.trim(),
          ifscCode: formData.ifscCode.trim().toUpperCase(),
          bankName: formData.bankName.trim(),
        },
      };

      if (cleanAadhaar) workerData.aadhaar = cleanAadhaar;

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
    const rawAadhaar = (worker as any).aadhaar || '';
    const isClean12 = rawAadhaar.replace(/\D/g, '').length === 12;

    setFormData({
      name: worker.name,
      email: worker.email || '',
      password: '',
      phone: worker.phone ? worker.phone.replace(/\D/g, '').slice(-10) : '',
      aadhaar: isClean12 ? rawAadhaar : '',
      skillLevel: worker.skillLevel || 'unskilled',
      dailyWage: worker.dailyWage ? worker.dailyWage.toString() : '',
      overtimeRate: worker.overtimeRate !== undefined ? worker.overtimeRate.toString() : '100',
      messCharge: worker.messCharge ? worker.messCharge.toString() : '',
      siteId: worker.siteId || '',
      upiId: worker.upiId || (worker as any).upi_id || '',
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
      overtimeRate: '100',
      messCharge: '',
      siteId: '',
      upiId: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    });
    setEditingWorker(null);
  };

  // Filter workers by search and skill (null-safe for optional fields like email)
  const filteredWorkers = workers.filter((w) => {
    if (!w) return false;
    const term = (searchTerm || '').trim().toLowerCase();
    const nameMatch = (w.name || '').toLowerCase().includes(term);
    const phoneMatch = (w.phone || '').includes(term);
    const emailMatch = (w.email || '').toLowerCase().includes(term);
    const matchesSearch = !term || nameMatch || phoneMatch || emailMatch;

    const workerSkill = (w.skillLevel || 'unskilled').toLowerCase();
    const filterSkill = (selectedSkillFilter || 'All').toLowerCase();
    const matchesSkill = filterSkill === 'all' || workerSkill === filterSkill;

    return matchesSearch && matchesSkill;
  });

  const avgWage = workers.length > 0
    ? Math.round(workers.reduce((acc, w) => acc + (w.dailyWage || 0), 0) / workers.length)
    : 800;

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const skillOptions = [
    { label: t('workers.unskilled'), value: 'unskilled' },
    { label: t('workers.semiSkilled'), value: 'semi-skilled' },
    { label: t('workers.skilled'), value: 'skilled' },
    { label: t('workers.highlySkilled'), value: 'highly-skilled' },
  ];

  const siteOptions = sites.map((s) => ({ label: s.name, value: s.id }));

  return (
    <SafeAreaView style={styles.container} edges={selectedWorker ? [] : ['top']}>
      {selectedWorker ? (
        <WorkerDetailView
          worker={workers.find((w) => w.id === selectedWorker.id) || selectedWorker}
          onBack={() => setSelectedWorker(null)}
          onEdit={() => handleEdit(workers.find((w) => w.id === selectedWorker.id) || selectedWorker)}
          accessToken={token}
          sites={sites}
          onWorkerUpdated={fetchWorkers}
        />
      ) : (
        <>
          {/* 1. TOP INDUSTRIAL HEADER */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>{t('workers.directory')}</Text>
                <Text style={styles.headerSubtitle}>{t('workers.directorySubtitle')}</Text>
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
                <Text style={styles.addWorkerButtonText}>{t('workers.addWorker')}</Text>
              </TouchableOpacity>
            </View>

            {/* 2. WORKFORCE KPI BENTO STRIP */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t('workers.totalWorkers')}</Text>
                <Text style={styles.kpiValue}>{workers.length}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t('attendance.ratePerDay')}</Text>
                <Text style={[styles.kpiValue, { color: colors.accent }]}>₹{avgWage}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t('common.verified')}</Text>
                <Text style={[styles.kpiValue, { color: colors.success }]}>98%</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t('nav.agreements')}</Text>
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
                placeholder={t('common.search')}
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
                const label = skill === 'All' ? t('common.all') :
                  skill === 'Skilled' ? t('workers.skilled') :
                  skill === 'Semi-Skilled' ? t('workers.semiSkilled') :
                  skill === 'Unskilled' ? t('workers.unskilled') : skill;
                return (
                  <TouchableOpacity
                    key={skill}
                    style={[styles.skillPill, isSelected && styles.skillPillActive]}
                    onPress={() => setSelectedSkillFilter(skill)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.skillPillText, isSelected && styles.skillPillTextActive]}>
                      {label}
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
                  <Text style={styles.emptyTitle}>{t('workers.noWorkersFound')}</Text>
                  <Text style={styles.emptySubtitle}>
                    {language === 'hi' ? `"+ ${t('workers.addWorker')}" दबाकर नए श्रमिक जोड़ें।` :
                     language === 'bn' ? `"+ ${t('workers.addWorker')}" ট্যাপ করে নতুন শ্রমিক যোগ করুন।` :
                     `Tap "+ ${t('workers.addWorker')}" to onboard crew members.`}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const siteName = item.siteId ? siteMap.get(item.siteId) || t('workers.assignedSite') : '-';
                const isSkilled = item.skillLevel === 'skilled';
                const skillLabel = item.skillLevel === 'skilled' ? t('workers.skilled') :
                  item.skillLevel === 'semi-skilled' ? t('workers.semiSkilled') :
                  item.skillLevel === 'highly-skilled' ? t('workers.highlySkilled') : t('workers.unskilled');

                return (
                  <TouchableOpacity
                    style={styles.workerCard}
                    onPress={() => setSelectedWorker(item)}
                    activeOpacity={0.88}
                  >
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
                              {skillLabel.toUpperCase()}
                            </Text>
                          </View>

                          {/* Phone Call Icon Button on Card */}
                          <TouchableOpacity
                            style={styles.cardHeaderCallBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleCall(item.phone);
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons name="phone" size={15} color="#16A34A" />
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.workerContact}>
                          📞 {item.phone || '-'} • ✉️ {item.email || '-'}{item.upiId ? ` • ⚡ ${item.upiId}` : ''}
                        </Text>

                        <View style={styles.siteBadgeRow}>
                          <MaterialIcons name="location-on" size={13} color={colors.accent} />
                          <Text style={styles.siteBadgeText}>{siteName}</Text>
                        </View>

                        {/* Financial Row */}
                        <View style={styles.financeRow}>
                          <View style={styles.financePill}>
                            <Text style={styles.financePillLabel}>{t('attendance.ratePerDay')}:</Text>
                            <Text style={styles.financePillVal}>₹{item.dailyWage || 0}</Text>
                          </View>
                          <View style={styles.financePill}>
                            <Text style={styles.financePillLabel}>OT:</Text>
                            <Text style={[styles.financePillVal, { color: colors.accent }]}>
                              ₹{item.overtimeRate !== undefined ? item.overtimeRate : 100}/hr
                            </Text>
                          </View>
                          {item.messCharge ? (
                            <View style={[styles.financePill, { backgroundColor: colors.warningLight }]}>
                              <Text style={[styles.financePillLabel, { color: colors.warningDark }]}>Mess:</Text>
                              <Text style={[styles.financePillVal, { color: colors.warningDark }]}>-₹{item.messCharge}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* View Ledger Affordance */}
                        <View style={styles.viewLedgerRow}>
                          <Text style={styles.viewLedgerText}>{t('attendance.workerAttendanceLedger')}</Text>
                          <MaterialIcons name="chevron-right" size={15} color={colors.accent} />
                        </View>
                      </View>
                    </View>

                    {/* Card Action Strip */}
                    <View style={styles.cardActionsStrip}>
                      <View style={styles.kycStatusRow}>
                        <MaterialIcons name="verified" size={14} color={colors.success} />
                        <Text style={styles.kycStatusText}>{t('common.verified')}</Text>
                      </View>

                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={[styles.actionIconButton, styles.callActionBtn]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleCall(item.phone);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="phone" size={15} color="#16A34A" />
                          <Text style={[styles.actionButtonText, { color: '#16A34A' }]}>{t('common.call')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionIconButton, { marginLeft: 8 }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(item);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="edit" size={15} color={colors.primary} />
                          <Text style={styles.actionButtonText}>{t('common.edit')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionIconButton, { marginLeft: 8 }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="delete-outline" size={15} color={colors.error} />
                          <Text style={[styles.actionButtonText, { color: colors.error }]}>{t('common.delete')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </>
      )}

      {/* 5. ONBOARDING / EDIT FULL SCREEN FORM */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWorker ? t('workers.editWorker') : t('workers.addWorker')}
        subtitle={editingWorker ? t('workers.directorySubtitle') : t('workers.directorySubtitle')}
        submitLabel={editingWorker ? t('common.save') : t('workers.addWorker')}
        onSubmit={handleSubmit}
        loading={loading}
        submitDisabled={
          !formData.name.trim() ||
          !formData.phone.trim() ||
          !formData.dailyWage.trim()
        }
      >
        <Text style={formStyles.sectionHeader}>
          {language === 'hi' ? 'बुनियादी जानकारी' : language === 'bn' ? 'প্রাথমিক তথ্য' : 'Basic Information'}
        </Text>

        <FormField
          label={t('workers.workerName')}
          required
          value={formData.name}
          onChangeText={(val) => setFormData({ ...formData, name: val })}
          placeholder={t('workers.workerNamePlaceholder')}
        />

        <FormField
          label={t('workers.phone')}
          required
          type="phone"
          value={formData.phone}
          onChangeText={(val) => setFormData({ ...formData, phone: val })}
          placeholder={t('workers.phonePlaceholder')}
          helperText={language === 'hi' ? '10-अंकीय मोबाइल नंबर' : language === 'bn' ? '১০-সংখ্যার মোবাইল নম্বর' : '10-digit mobile number'}
        />

        <FormField
          label={`${t('forms.emailAddress')} (${t('common.optional')})`}
          required={false}
          type="email"
          value={formData.email}
          onChangeText={(val) => setFormData({ ...formData, email: val })}
          placeholder="worker@example.com"
          autoCapitalize="none"
        />

        <FormField
          label={t('workers.aadhaarNumber')}
          type="number"
          value={formData.aadhaar}
          onChangeText={(val) => setFormData({ ...formData, aadhaar: val })}
          placeholder={t('workers.aadhaarPlaceholder')}
          helperText={language === 'hi' ? '12-अंकीय आधार संख्या' : language === 'bn' ? '১২-সংখ্যার আধার নম্বর' : '12-digit Aadhaar'}
        />

        <FormField
          label={editingWorker ? `${t('auth.createPassword')} (${t('common.optional')})` : t('auth.createPassword')}
          required={!editingWorker}
          type="password"
          value={formData.password}
          onChangeText={(val) => setFormData({ ...formData, password: val })}
          placeholder={t('auth.passwordPlaceholder')}
        />

        <Text style={formStyles.sectionHeader}>{t('workers.skillLevel')}</Text>

        <FormField
          label={t('workers.skillLevel')}
          type="select"
          value={formData.skillLevel}
          onChangeText={(val) => setFormData({ ...formData, skillLevel: val })}
          selectOptions={skillOptions}
          placeholder={t('workers.skillLevel')}
        />

        <FormField
          label={t('workers.dailyWage')}
          required
          type="number"
          suffix="₹/day"
          value={formData.dailyWage}
          onChangeText={(val) => setFormData({ ...formData, dailyWage: val })}
          placeholder={t('workers.dailyWagePlaceholder')}
        />

        <FormField
          label={`${t('workers.overtimeRate')} (${t('common.optional')})`}
          required={false}
          type="number"
          suffix="₹/hr"
          value={formData.overtimeRate}
          onChangeText={(val) => setFormData({ ...formData, overtimeRate: val })}
          placeholder={t('workers.overtimeRatePlaceholder')}
        />

        <FormField
          label={`${t('workers.messDeduction')} (${t('common.optional')})`}
          type="number"
          suffix="₹/day"
          value={formData.messCharge}
          onChangeText={(val) => setFormData({ ...formData, messCharge: val })}
          placeholder={t('workers.messDeductionPlaceholder')}
        />

        <Text style={formStyles.sectionHeader}>{t('workers.assignedSite')}</Text>

        <FormField
          label={t('workers.assignedSite')}
          type="select"
          value={formData.siteId}
          onChangeText={(val) => setFormData({ ...formData, siteId: val })}
          selectOptions={[
            { label: '-', value: '' },
            ...siteOptions,
          ]}
          placeholder={t('workers.selectSitePlaceholder')}
        />

        <Text style={formStyles.sectionHeader}>{t('workerPortal.bankDetails')}</Text>

        <FormField
          label={t('workers.upiId')}
          value={formData.upiId}
          onChangeText={(val) => setFormData({ ...formData, upiId: val })}
          placeholder={t('workers.upiIdPlaceholder')}
          autoCapitalize="none"
        />

        <FormField
          label={t('workers.bankName')}
          value={formData.bankName}
          onChangeText={(val) => setFormData({ ...formData, bankName: val })}
          placeholder={t('workers.bankName')}
        />

        <FormField
          label={t('workers.bankAccountNumber')}
          type="number"
          value={formData.accountNumber}
          onChangeText={(val) => setFormData({ ...formData, accountNumber: val })}
          placeholder={t('workers.bankAccountNumber')}
        />

        <FormField
          label={t('workers.bankIfscCode')}
          value={formData.ifscCode}
          onChangeText={(val) => setFormData({ ...formData, ifscCode: val })}
          placeholder={t('workers.bankIfscCode')}
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
  callActionBtn: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  cardHeaderCallBtn: {
    marginLeft: 'auto',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewLedgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 2,
  },
  viewLedgerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
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
