import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { FormModal } from '@/components/shared/FormModal';
import { FormField } from '@/components/shared/FormField';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { theme } from '@/styles/theme';

interface Foreman {
  id: string;
  name: string;
  email: string;
  phone: string;
  siteId?: string;
  siteName?: string;
}

interface Site {
  id: string;
  name: string;
}

interface ForemenTabProps {
  accessToken?: string;
}

export function ForemenTab({ accessToken }: ForemenTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [foremen, setForemen] = useState<Foreman[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingForeman, setEditingForeman] = useState<Foreman | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    siteId: '',
  });

  useEffect(() => {
    if (token) {
      fetchForemen();
      fetchSites();
    }
  }, [token]);

  const fetchForemen = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setForemen(data.foremen || []);
    } catch (error) {
      console.error('Error fetching foremen:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch foremen',
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

    if (!formData.name.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter foreman full name' });
      return;
    }
    const cleanPhone = formData.phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 10-digit mobile number' });
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid official email address' });
      return;
    }
    if (!editingForeman && (!formData.password || formData.password.length < 6)) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    try {
      const foremanData: any = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: cleanPhone,
        siteId: formData.siteId || null,
      };

      if (editingForeman) {
        if (formData.password && formData.password.trim().length >= 6) {
          foremanData.password = formData.password.trim();
        }
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen/${editingForeman.id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(foremanData),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Failed to update foreman profile');
        }

        Toast.show({
          type: 'success',
          text1: 'Foreman Updated',
          text2: `${foremanData.name} details saved.`,
        });
      } else {
        foremanData.password = formData.password.trim();

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(foremanData),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Failed to create foreman supervisor');
        }

        Toast.show({
          type: 'success',
          text1: 'Foreman Enrolled',
          text2: `${foremanData.name} supervisor account created.`,
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchForemen();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Operation Failed',
        text2: error.message || 'Failed to save foreman',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (foreman: Foreman) => {
    Alert.alert(
      'Delete Foreman',
      `Are you sure you want to delete supervisor ${foreman.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen/${foreman.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` },
                }
              );

              if (!response.ok) {
                throw new Error('Failed to delete foreman');
              }

              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Foreman removed successfully',
              });
              fetchForemen();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to delete foreman',
              });
            }
          },
        },
      ]
    );
  };

  const handleEdit = (foreman: Foreman) => {
    setEditingForeman(foreman);
    setFormData({
      name: foreman.name,
      email: foreman.email,
      password: '',
      phone: foreman.phone,
      siteId: foreman.siteId || '',
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      siteId: '',
    });
    setEditingForeman(null);
  };

  const filteredForemen = foremen.filter(foreman =>
    foreman.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    foreman.phone.includes(searchTerm) ||
    foreman.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Header & KPI Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Site Supervisors</Text>
            <Text style={styles.headerSubtitle}>Manage foremen and site supervisory assignments</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{foremen.length} Active</Text>
          </View>
        </View>

        {/* Search and Add */}
        <View style={styles.searchAddContainer}>
          <Input size="md" variant="outline" style={styles.searchWrapper}>
            <MaterialIcons name="search" size={20} color={theme.colors.slate[400]} style={styles.searchIcon} />
            <InputField
              placeholder="Search by name, phone or email..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
              placeholderTextColor={theme.colors.slate[400]}
            />
          </Input>
          <TouchableOpacity
            onPress={() => { resetForm(); setIsModalOpen(true); }}
            style={styles.addButton}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add-alt-1" size={18} color="#ffffff" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Foremen List */}
        <FlatList
          data={filteredForemen}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.foremanCard}>
              <View style={styles.foremanCardContent}>
                <View style={styles.foremanAvatar}>
                  <MaterialIcons name="engineering" size={26} color={theme.colors.safetyOrange} />
                </View>
                <View style={styles.foremanInfo}>
                  <View style={styles.foremanNameRow}>
                    <Text style={styles.foremanName}>{item.name}</Text>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>SUPERVISOR</Text>
                    </View>
                  </View>

                  <View style={styles.foremanDetailRow}>
                    <TouchableOpacity 
                      style={styles.phoneTag}
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="phone" size={13} color={theme.colors.slate[600]} />
                      <Text style={styles.foremanDetail}>{item.phone}</Text>
                    </TouchableOpacity>
                    {item.email ? (
                      <View style={styles.emailTag}>
                        <MaterialIcons name="mail-outline" size={13} color={theme.colors.slate[500]} />
                        <Text style={styles.foremanDetail} numberOfLines={1}>{item.email}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.siteBadgeRow}>
                    <MaterialIcons 
                      name={item.siteName ? "business" : "warning-amber"} 
                      size={14} 
                      color={item.siteName ? theme.colors.emerald[600] : theme.colors.amber[600]} 
                    />
                    <Text 
                      style={[
                        styles.siteBadgeText, 
                        { color: item.siteName ? theme.colors.emerald[700] : theme.colors.amber[700] }
                      ]}
                    >
                      {item.siteName ? `Assigned: ${item.siteName}` : 'Unassigned to any site'}
                    </Text>
                  </View>
                </View>

                <View style={styles.foremanActions}>
                  <TouchableOpacity 
                    onPress={() => handleEdit(item)} 
                    style={styles.actionButton}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="edit" size={18} color={theme.colors.slate[700]} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleDelete(item)} 
                    style={[styles.actionButton, styles.deleteButton]}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="delete-outline" size={18} color={theme.colors.red[600]} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons name="engineering" size={40} color={theme.colors.slate[400]} />
              </View>
              <Text style={styles.emptyText}>No Foremen Found</Text>
              <Text style={styles.emptySubtext}>
                {searchTerm ? 'No supervisor matched your search keywords.' : 'Add your first site foreman to delegate worker attendance and tracking.'}
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setIsModalOpen(true); }}
                style={styles.emptyCta}
                activeOpacity={0.85}
              >
                <MaterialIcons name="person-add" size={18} color="#ffffff" />
                <Text style={styles.emptyCtaText}>Add First Foreman</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      {/* Add/Edit Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={editingForeman ? 'Edit Foreman Profile' : 'Register New Foreman'}
        subtitle={editingForeman ? 'Update supervisory assignment or credentials' : 'Create login credentials and link to an active jobsite'}
        onSubmit={handleSubmit}
        submitLabel={editingForeman ? 'Update Foreman' : 'Create Account'}
        loading={loading}
        submitDisabled={
          !formData.name.trim() ||
          formData.phone.trim().length < 10 ||
          !formData.email.trim() ||
          !formData.email.includes('@') ||
          (!editingForeman && (!formData.password || formData.password.length < 6))
        }
      >
        <FormField
          label="Full Name"
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="e.g. Rajesh Kumar"
          required
          type="text"
        />

        <FormField
          label="Mobile Phone Number"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="e.g. 9876543210"
          required
          type="phone"
        />

        <FormField
          label="Email Address"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="e.g. rajesh@foreman.com"
          required
          type="email"
        />

        {!editingForeman && (
          <FormField
            label="Initial Account Password"
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            placeholder="Minimum 6 characters"
            required
            type="password"
          />
        )}

        {editingForeman && (
          <FormField
            label="Reset Password (optional)"
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            placeholder="Leave blank to keep current password"
            type="password"
          />
        )}

        <FormField
          label="Assign to Active Site"
          value={formData.siteId}
          onValueChange={(value) => setFormData({ ...formData, siteId: value })}
          placeholder="Select an active jobsite"
          type="select"
          selectOptions={[
            { label: 'Unassigned (Floating Supervisor)', value: '' },
            ...sites.map((site) => ({ label: site.name, value: site.id })),
          ]}
        />
      </FormModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  countBadge: {
    backgroundColor: theme.colors.slate[900],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchAddContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.slate[900],
    paddingVertical: 8,
  },
  addButton: {
    backgroundColor: theme.colors.safetyOrange,
    borderRadius: theme.radii.md,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    ...theme.shadows.sm,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 24,
  },
  foremanCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  foremanCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  foremanAvatar: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.safetyOrangeLight,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foremanInfo: {
    flex: 1,
    gap: 6,
  },
  foremanNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  foremanName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.slate[900],
  },
  roleTag: {
    backgroundColor: theme.colors.slate[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.slate[200],
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.slate[700],
    letterSpacing: 0.5,
  },
  foremanDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  phoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  foremanDetail: {
    fontSize: 12,
    color: theme.colors.slate[600],
    fontWeight: '500',
  },
  siteBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  siteBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  foremanActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.slate[200],
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
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
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.slate[900],
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.slate[500],
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 20,
  },
  emptyCta: {
    backgroundColor: theme.colors.safetyOrange,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...theme.shadows.sm,
  },
  emptyCtaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
