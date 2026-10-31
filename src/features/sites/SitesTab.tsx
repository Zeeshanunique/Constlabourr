import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormModal } from '@/components/shared/FormModal';
import { FormField } from '@/components/shared/FormField';
import { formStyles } from '@/components/shared/form-styles';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, shadows, radii } from '@/styles/theme';
import { useTranslation } from '@/i18n';

interface Site {
  id: string;
  name: string;
  address: string;
  startDate?: string;
  endDate?: string;
  foremanId?: string;
  status?: string;
}

interface Foreman {
  id: string;
  name: string;
}

interface SitesTabProps {
  accessToken?: string;
}

export function SitesTab({ accessToken }: SitesTabProps) {
  const route = useRoute();
  const { t, language } = useTranslation();
  const token = accessToken || (route.params as any)?.accessToken;
  const tokenRef = useRef(token);

  useEffect(() => {
    if (token) tokenRef.current = token;
  }, [token]);

  const [sites, setSites] = useState<Site[]>([]);
  const [foremen, setForemen] = useState<Foreman[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    startDate: '',
    endDate: '',
    foremanId: '',
  });

  useEffect(() => {
    if (token) {
      fetchSites();
      fetchForemen();
    }
  }, [token]);

  const fetchSites = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch sites' });
    } finally {
      setLoading(false);
    }
  };

  const fetchForemen = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setForemen(data.foremen || []);
    } catch (error) {
      console.error('Error fetching foremen:', error);
    }
  };

  const handleSubmit = async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    if (!formData.name.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter site project name' });
      return;
    }
    if (!formData.address.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter site location address' });
      return;
    }

    setLoading(true);
    try {
      const siteData = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        foremanId: formData.foremanId || null,
      };

      if (editingSite) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites/${editingSite.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${currentToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(siteData),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update site configuration');
        }
        Toast.show({ type: 'success', text1: 'Site Updated', text2: `${siteData.name} details saved.` });
      } else {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${currentToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(siteData),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to establish construction site');
        }
        Toast.show({ type: 'success', text1: 'Site Established', text2: `${siteData.name} active and geo-locked.` });
      }

      setIsModalOpen(false);
      resetForm();
      fetchSites();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Operation Failed', text2: error.message || 'Operation failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (site: Site) => {
    Alert.alert(
      'Delete Construction Site',
      `Are you sure you want to delete ${site.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites/${site.id}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              if (!response.ok) throw new Error('Failed to delete site');
              Toast.show({ type: 'success', text1: 'Site Deleted', text2: `${site.name} removed.` });
              fetchSites();
            } catch (error: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: error.message });
            }
          },
        },
      ]
    );
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      address: site.address || '',
      startDate: site.startDate || '',
      endDate: site.endDate || '',
      foremanId: site.foremanId || '',
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      startDate: '',
      endDate: '',
      foremanId: '',
    });
    setEditingSite(null);
  };

  const foremanMap = new Map<string, string>();
  foremen.forEach((f) => foremanMap.set(f.id, f.name));

  const foremanOptions = foremen.map((f) => ({ label: f.name, value: f.id }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t('sites.directory')}</Text>
            <Text style={styles.headerSubtitle}>{t('sites.directorySubtitle')}</Text>
          </View>
          <TouchableOpacity
            style={styles.addSiteButton}
            onPress={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="add-location-alt" size={16} color="#FFFFFF" />
            <Text style={styles.addSiteButtonText}>{t('sites.addSite')}</Text>
          </TouchableOpacity>
        </View>

        {/* 2. SITES KPI BENTO STRIP */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('sites.activeSites')}</Text>
            <Text style={styles.kpiValue}>{sites.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('nav.foremen')}</Text>
            <Text style={[styles.kpiValue, { color: colors.accent }]}>
              {sites.filter((s) => s.foremanId).length}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('sites.startDate')}</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {sites.filter((s) => s.startDate).length}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('common.status')}</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{t('common.active')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <FlatList
          data={sites}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchSites}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="location-off" size={48} color={colors.borderDark} />
              <Text style={styles.emptyTitle}>{t('sites.noSitesFound')}</Text>
              <Text style={styles.emptySubtitle}>
                {language === 'hi' ? `"+ ${t('sites.addSite')}" दबाकर अपनी पहली निर्माण साइट दर्ज करें।` :
                 language === 'bn' ? `"+ ${t('sites.addSite')}" ট্যাপ করে আপনার প্রথম নির্মাণ সাইট যোগ করুন।` :
                 `Tap "+ ${t('sites.addSite')}" to register your first construction site.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const foremanName = item.foremanId ? foremanMap.get(item.foremanId) || t('common.active') : '-';

            return (
              <View style={styles.siteCard}>
                <View style={styles.siteCardHeader}>
                  <View style={styles.siteTitleContainer}>
                    <View style={styles.siteIconBox}>
                      <MaterialIcons name="apartment" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.siteName}>{item.name}</Text>
                      <Text style={styles.siteAddress}>📍 {item.address || (language === 'hi' ? 'पता दर्ज नहीं' : language === 'bn' ? 'ঠিকানা নেই' : 'Address pending')}</Text>
                    </View>
                  </View>
                  <View style={styles.activePill}>
                    <View style={styles.greenDot} />
                    <Text style={styles.activePillText}>{t('sites.running').toUpperCase()}</Text>
                  </View>
                </View>

                {/* Foreman & Timeline Row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MaterialIcons name="engineering" size={15} color={colors.accent} />
                    <Text style={styles.metaLabel}>{t('sites.assignedForeman')}: </Text>
                    <Text style={styles.metaVal}>{foremanName}</Text>
                  </View>
                  {item.startDate ? (
                    <View style={styles.metaItem}>
                      <MaterialIcons name="event" size={15} color={colors.textMuted} />
                      <Text style={styles.metaVal}>{item.startDate}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Action Strip */}
                <View style={styles.actionStrip}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
                    <MaterialIcons name="edit" size={15} color={colors.primary} />
                    <Text style={styles.actionBtnText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { marginLeft: 8 }]}
                    onPress={() => handleDelete(item)}
                  >
                    <MaterialIcons name="delete-outline" size={15} color={colors.error} />
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </View>

      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSite ? t('sites.editSite') : t('sites.addSite')}
        subtitle={t('sites.directorySubtitle')}
        submitLabel={editingSite ? t('common.save') : t('sites.addSite')}
        onSubmit={handleSubmit}
        loading={loading}
        submitDisabled={!formData.name.trim() || !formData.address.trim()}
      >
        <Text style={formStyles.sectionHeader}>
          {language === 'hi' ? 'साइट की जानकारी' : language === 'bn' ? 'সাইটের তথ্য' : 'Site Information'}
        </Text>

        <FormField
          label={t('sites.siteName')}
          required
          value={formData.name}
          onChangeText={(val) => setFormData({ ...formData, name: val })}
          placeholder={t('sites.siteNamePlaceholder')}
        />

        <FormField
          label={t('sites.siteAddress')}
          required
          value={formData.address}
          onChangeText={(val) => setFormData({ ...formData, address: val })}
          placeholder={t('sites.siteAddressPlaceholder')}
          helperText={language === 'hi' ? 'भौतिक पता या प्रोजेक्ट लैंडमार्क' : language === 'bn' ? 'ঠিকানা বা প্রকল্পের ল্যান্ডমার্ক' : 'Physical address or project landmark'}
        />

        <Text style={formStyles.sectionHeader}>{t('sites.assignedForeman')}</Text>

        <FormField
          label={t('sites.assignedForeman')}
          type="select"
          value={formData.foremanId}
          onChangeText={(val) => setFormData({ ...formData, foremanId: val })}
          selectOptions={[
            { label: '-', value: '' },
            ...foremanOptions,
          ]}
          placeholder={t('sites.selectForemanPlaceholder')}
        />

        <Text style={formStyles.sectionHeader}>
          {language === 'hi' ? 'परियोजना अनुसूची' : language === 'bn' ? 'প্রকল্প সময়সূচী' : 'Project Schedule'}
        </Text>

        <FormField
          label={t('sites.startDate')}
          type="date"
          value={formData.startDate}
          onChangeText={(val) => setFormData({ ...formData, startDate: val })}
          placeholder={t('sites.startDate')}
        />

        <FormField
          label={t('sites.endDate')}
          type="date"
          value={formData.endDate}
          onChangeText={(val) => setFormData({ ...formData, endDate: val })}
          placeholder={t('sites.endDate')}
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
  addSiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  addSiteButtonText: {
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
  listContent: {
    paddingBottom: 24,
  },
  siteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...shadows.card,
  },
  siteCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  siteTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  siteIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  siteAddress: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.successDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  actionStrip: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 4,
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
