import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { FormModal } from '@/components/shared/FormModal';
import { FormField } from '@/components/shared/FormField';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

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
  const token = accessToken || (route.params as any)?.accessToken;
  const tokenRef = useRef(token);
  
  // Update tokenRef whenever token changes
  useEffect(() => {
    if (token) {
      tokenRef.current = token;
    }
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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch sites',
      });
    }
  };

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
    }
  };

  const handleSubmit = async () => {
    const currentToken = tokenRef.current;
    
    if (!currentToken) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Authentication token not found. Please log in again.',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const siteData = {
        name: formData.name,
        address: formData.address,
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
              'Authorization': `Bearer ${currentToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(siteData),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update site');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Site updated successfully',
        });
      } else {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(siteData),
          }
        );
        
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to create site');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Site created successfully',
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchSites();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to save site',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (site: Site) => {
    Alert.alert(
      'Delete Site',
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
                  headers: { 'Authorization': `Bearer ${token}` },
                }
              );

              if (!response.ok) {
                throw new Error('Failed to delete site');
              }

              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Site deleted successfully',
              });
              fetchSites();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to delete site',
              });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Sites</Text>
            <Text style={styles.headerSubtitle}>Manage your construction sites</Text>
          </View>
          <Button
            onPress={() => { 
              resetForm(); 
              setIsModalOpen(true);
            }}
            style={styles.addButton}
          >
            <MaterialIcons name="add" size={20} color="#ffffff" />
            <ButtonText style={styles.addButtonText}>Add Site</ButtonText>
          </Button>
        </View>

        {/* Sites List */}
        <FlatList
          data={sites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.siteCard}>
              <View style={styles.siteCardHeader}>
                <View style={styles.siteInfo}>
                  <Text style={styles.siteName}>{item.name}</Text>
                  <View style={styles.siteLocation}>
                    <MaterialIcons name="place" size={16} color="#6b7280" />
                    <Text style={styles.siteLocationText}>
                      {item.address || 'No address'}
                    </Text>
                  </View>
                </View>
                <View style={styles.siteHeaderRight}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>active</Text>
                  </View>
                  <View style={styles.siteActions}>
                    <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                      <MaterialIcons name="edit" size={20} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                      <MaterialIcons name="delete" size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.siteCardFooter}>
                <MaterialIcons name="calendar-today" size={16} color="#6b7280" />
                <Text style={styles.siteDate}>Started: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="place" size={64} color="#d1d5db" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>No sites found</Text>
              <Text style={styles.emptySubtext}>Add your first site to get started</Text>
            </View>
          }
        />
      </View>

      {/* Add/Edit Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => { 
          setIsModalOpen(false); 
          resetForm(); 
        }}
        title={editingSite ? 'Edit Site' : 'Add New Site'}
        subtitle={editingSite ? 'Update site information' : 'Create a new construction site'}
        onSubmit={handleSubmit}
        submitLabel={editingSite ? 'Update Site' : 'Create Site'}
        loading={loading}
        submitDisabled={!formData.name.trim() || !formData.address.trim()}
      >
        <FormField
          label="Site Name"
                      value={formData.name}
                      onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="e.g., Sunrise Apartments"
          required
          type="text"
        />

        <FormField
          label="Address"
                      value={formData.address}
                      onChangeText={(text) => setFormData({ ...formData, address: text })}
          placeholder="Full site address"
          required
          type="text"
        />

        <FormField
          label="Start Date"
          value={formData.startDate}
          onChangeText={(text) => setFormData({ ...formData, startDate: text })}
          placeholder="Select start date"
          type="date"
        />

        <FormField
          label="End Date"
          value={formData.endDate}
          onChangeText={(text) => setFormData({ ...formData, endDate: text })}
          placeholder="Select end date (optional)"
          type="date"
        />

        <FormField
          label="Assign Foreman"
          value={formData.foremanId}
          onValueChange={(value) => setFormData({ ...formData, foremanId: value })}
          placeholder="Select a foreman"
          type="select"
          selectOptions={[
            { label: 'None', value: '' },
            ...foremen.map((f) => ({ label: f.name, value: f.id }))
          ]}
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
  listContent: {
    paddingBottom: 20,
  },
  siteCard: {
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
  siteCardHeader: {
    marginBottom: 12,
  },
  siteInfo: {
    marginBottom: 8,
  },
  siteName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  siteLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  siteLocationText: {
    fontSize: 14,
    color: '#6b7280',
  },
  siteHeaderRight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  siteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  siteCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  siteDate: {
    fontSize: 13,
    color: '#6b7280',
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
