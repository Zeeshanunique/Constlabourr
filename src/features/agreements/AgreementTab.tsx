import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Platform } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Card } from '@/components/ui/card';
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter } from '@/components/ui/modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Plus, FileText, Edit2, Trash2, X, Calendar } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

interface Agreement {
  id: string;
  version: number;
  terms: string;
  effectiveDate: string;
  status: 'active' | 'draft';
  acceptances?: number;
}

interface AgreementTabProps {
  accessToken?: string;
}

export function AgreementTab({ accessToken }: AgreementTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    terms: '',
    effectiveDate: new Date(),
  });

  useEffect(() => {
    if (token) {
      fetchAgreements();
    }
  }, [token]);

  const fetchAgreements = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/list`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setAgreements(data.agreements || []);
    } catch (error) {
      console.error('Error fetching agreements:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch agreements',
      });
    }
  };

  const handleSubmit = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const agreementData = {
        terms: formData.terms,
        effectiveDate: formData.effectiveDate.toISOString(),
      };

      if (editingAgreement) {
      const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/${editingAgreement.id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(agreementData),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update agreement');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Agreement updated successfully',
        });
      } else {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/create`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(agreementData),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create agreement');
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Agreement created successfully',
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchAgreements();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to save agreement',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (agreementId: string) => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/${agreementId}/activate`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to activate agreement');
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Agreement activated',
      });
      fetchAgreements();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to activate agreement',
      });
    }
  };

  const handleEdit = (agreement: Agreement) => {
    setEditingAgreement(agreement);
    setFormData({
      terms: agreement.terms,
      effectiveDate: new Date(agreement.effectiveDate),
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      terms: '',
      effectiveDate: new Date(),
    });
    setEditingAgreement(null);
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setFormData({ ...formData, effectiveDate: date });
    }
  };

  return (
    <View style={styles.container}>
      <Box className="p-4 bg-white flex-1">
        <HStack space="sm" className="mb-4">
          <Button className="flex-1" onPress={() => { resetForm(); setIsModalOpen(true); }}>
            <Plus size={20} color="white" />
            <ButtonText>Create Agreement</ButtonText>
        </Button>
        </HStack>

        <FlatList
          data={agreements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card className="p-4 mb-2">
              <VStack space="sm">
                <HStack className="justify-between items-center">
                  <HStack className="items-center" space="sm">
                    <FileText size={16} color="#6366f1" />
                    <Text size="md" className="font-medium">Version {item.version}</Text>
                  </HStack>
                  <Box className={`px-2 py-1 rounded-sm ${item.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Text size="xs" className={item.status === 'active' ? 'text-green-700' : 'text-gray-700'}>
                      {item.status}
                    </Text>
                  </Box>
                </HStack>
                <Text size="sm" className="text-gray-500" numberOfLines={2}>
                  {item.terms}
                </Text>
                <Text size="xs" className="text-gray-400">
                  Effective: {new Date(item.effectiveDate).toLocaleDateString()}
                  {item.acceptances !== undefined && ` • ${item.acceptances} acceptances`}
                </Text>
                <HStack space="sm" className="mt-2">
                  {item.status === 'draft' && (
                    <Button size="sm" action="positive" onPress={() => handleActivate(item.id)}>
                      <ButtonText>Activate</ButtonText>
        </Button>
                  )}
                  <Button size="sm" variant="outline" action="secondary" onPress={() => handleEdit(item)}>
                    <Edit2 size={16} color="#2563eb" />
            </Button>
                </HStack>
              </VStack>
            </Card>
          )}
          ListEmptyComponent={
            <Box className="p-8 items-center">
              <Text className="text-gray-400">No agreements found</Text>
            </Box>
          }
        />
      </Box>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} size="lg">
        <ModalBackdrop onPress={() => { setIsModalOpen(false); resetForm(); }} />
        <ModalContent>
          <ModalHeader>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', flex: 1 }}>
              {editingAgreement ? 'Edit Agreement' : 'Create Agreement'}
            </Text>
            <ModalCloseButton onPress={() => { setIsModalOpen(false); resetForm(); }}>
              <X size={24} color="#717182" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody>
            <ScrollView showsVerticalScrollIndicator={false}>
              <VStack space="lg" style={{ paddingBottom: 10 }}>
                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                      Terms & Conditions
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Textarea size="md" variant="default" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                    <TextareaInput
                      value={formData.terms}
                      onChangeText={(text) => setFormData({ ...formData, terms: text })}
                      placeholder="Enter agreement terms..."
                      placeholderTextColor="#9ca3af"
                      style={{ height: 128, fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top' }}
                    />
                  </Textarea>
                </FormControl>

                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                      Effective Date
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Button variant="outline" action="secondary" onPress={() => setShowDatePicker(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, justifyContent: 'flex-start', paddingHorizontal: 12 }}>
                    <Calendar size={16} color="#2563eb" />
                    <ButtonText style={{ color: '#111827', marginLeft: 8, fontSize: 16 }}>{formData.effectiveDate.toLocaleDateString()}</ButtonText>
                  </Button>
                </FormControl>

                {showDatePicker && (
                  <DateTimePicker
                    value={formData.effectiveDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )}

              </VStack>
            </ScrollView>
          </ModalBody>
          <ModalFooter>
            <HStack space="md" style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onPress={() => { setIsModalOpen(false); resetForm(); }}
                style={{ borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff' }}
              >
                <ButtonText style={{ color: '#374151', fontWeight: '600' }}>Cancel</ButtonText>
              </Button>
              <Button
                onPress={handleSubmit}
                isDisabled={loading || !formData.terms.trim()}
                style={{ backgroundColor: '#2563eb', minWidth: 120 }}
              >
                <ButtonText style={{ color: '#ffffff', fontWeight: '600' }}>
                  {loading ? 'Loading...' : editingAgreement ? 'Update Agreement' : 'Create Agreement'}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});
