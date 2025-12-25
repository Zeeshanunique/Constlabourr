import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Modal, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '../../components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectItem, SelectItemText } from '@/components/ui/select';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '../utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

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
    setLoading(true);
    try {
      const foremanData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        siteId: formData.siteId || null,
      };

      if (editingForeman) {
        if (formData.password) {
          foremanData.password = formData.password;
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
          const error = await response.json();
          throw new Error(error.error || 'Failed to update foreman');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Foreman updated successfully',
        });
      } else {
        if (!formData.password) {
          throw new Error('Password is required');
        }
        foremanData.password = formData.password;

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
          const error = await response.json();
          throw new Error(error.error || 'Failed to create foreman');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Foreman created successfully',
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchForemen();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to save foreman',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (foreman: Foreman) => {
    Alert.alert(
      'Delete Foreman',
      `Are you sure you want to delete ${foreman.name}?`,
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
                text2: 'Foreman deleted successfully',
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
        {/* Search and Add */}
        <View style={styles.searchAddContainer}>
          <Input size="md" variant="outline" style={styles.searchWrapper}>
            <MaterialIcons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
            <InputField
              placeholder="Search foremen..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
              placeholderTextColor="#9ca3af"
            />
          </Input>
          <Button
            onPress={() => { resetForm(); setIsModalOpen(true); }}
            style={styles.addButton}
          >
            <MaterialIcons name="add" size={20} color="#ffffff" />
            <ButtonText style={styles.addButtonText}>Add Foreman</ButtonText>
          </Button>
        </View>

        {/* Foremen List */}
        <FlatList
          data={filteredForemen}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.foremanCard}>
              <View style={styles.foremanCardContent}>
                <View style={styles.foremanAvatar}>
                  <MaterialIcons name="supervisor-account" size={32} color="#9333ea" />
                </View>
                <View style={styles.foremanInfo}>
                  <Text style={styles.foremanName}>{item.name}</Text>
                  <View style={styles.foremanDetailRow}>
                    <MaterialIcons name="phone" size={16} color="#6b7280" />
                    <Text style={styles.foremanDetail}>{item.phone}</Text>
                  </View>
                  {item.siteName && (
                    <View style={styles.foremanDetailRow}>
                      <MaterialIcons name="place" size={16} color="#6b7280" />
                      <Text style={styles.foremanDetail}>{item.siteName}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.foremanActions}>
                  <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                    <MaterialIcons name="edit" size={20} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                    <MaterialIcons name="delete" size={20} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No foremen found</Text>
            </View>
          }
        />
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
                  {editingForeman ? 'Edit Foreman' : 'Add Foreman'}
                </Text>
                <TouchableOpacity
                  onPress={() => { setIsModalOpen(false); resetForm(); }}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <MaterialIcons name="close" size={24} color="#717182" />
                </TouchableOpacity>
              </View>

              <VStack space="lg">
                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>Name</FormControlLabelText>
                  </FormControlLabel>
                  <Input size="md" variant="outline">
                    <InputField
                      value={formData.name}
                      onChangeText={(text) => setFormData({ ...formData, name: text })}
                      placeholder="Foreman name"
                    />
                  </Input>
                </FormControl>

                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>Email</FormControlLabelText>
                  </FormControlLabel>
                  <Input size="md" variant="outline">
                    <InputField
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      placeholder="foreman@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </Input>
                </FormControl>

                {!editingForeman && (
                  <FormControl isRequired>
                    <FormControlLabel>
                      <FormControlLabelText>Password</FormControlLabelText>
                    </FormControlLabel>
                    <Input size="md" variant="outline">
                      <InputField
                        value={formData.password}
                        onChangeText={(text) => setFormData({ ...formData, password: text })}
                        placeholder="Password"
                        secureTextEntry
                      />
                    </Input>
                  </FormControl>
                )}

                {editingForeman && (
                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>New Password (optional)</FormControlLabelText>
                    </FormControlLabel>
                    <Input size="md" variant="outline">
                      <InputField
                        value={formData.password}
                        onChangeText={(text) => setFormData({ ...formData, password: text })}
                        placeholder="Leave blank to keep current"
                        secureTextEntry
                      />
                    </Input>
                  </FormControl>
                )}

                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>Phone</FormControlLabelText>
                  </FormControlLabel>
                  <Input size="md" variant="outline">
                    <InputField
                      value={formData.phone}
                      onChangeText={(text) => setFormData({ ...formData, phone: text })}
                      placeholder="Phone number"
                      keyboardType="phone-pad"
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Site</FormControlLabelText>
                  </FormControlLabel>
                  <Select selectedValue={formData.siteId} onValueChange={(value) => setFormData({ ...formData, siteId: value })}>
                    <SelectTrigger variant="outline" size="md">
                      <SelectInput placeholder="Select site" />
                      <SelectIcon />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        <SelectItem label="None" value="">
                          <SelectItemText>None</SelectItemText>
                        </SelectItem>
                        {sites.map((site) => (
                          <SelectItem key={site.id} label={site.name} value={site.id}>
                            <SelectItemText>{site.name}</SelectItemText>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </FormControl>

                <Button onPress={handleSubmit} size="lg" className="mt-4" isDisabled={loading}>
                  {loading ? (
                    <ButtonText>Loading...</ButtonText>
                  ) : (
                    <ButtonText>{editingForeman ? 'Update Foreman' : 'Create Foreman'}</ButtonText>
                  )}
                </Button>
              </VStack>
            </ScrollView>
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
  content: {
    flex: 1,
    padding: 20,
  },
  searchAddContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  searchWrapper: {
    flex: 1,
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
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  foremanCard: {
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
  foremanCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  foremanAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foremanInfo: {
    flex: 1,
    gap: 6,
  },
  foremanName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  foremanDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  foremanDetail: {
    fontSize: 14,
    color: '#6b7280',
  },
  foremanActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
});
