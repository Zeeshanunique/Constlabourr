import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Platform } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectItem, SelectItemText } from '@/components/ui/select';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter } from '@/components/ui/modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

interface Worker {
  id: string;
  name: string;
  phone: string;
  dailyWage: number;
}

interface Site {
  id: string;
  name: string;
}

interface Attendance {
  id: string;
  workerId: string;
  workerName: string;
  date: string;
  status: 'present' | 'absent';
  checkIn?: string;
  checkOut?: string;
}

interface AttendanceTabProps {
  accessToken?: string;
}

export function AttendanceTab({ accessToken }: AttendanceTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSite, setSelectedSite] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    workerId: '',
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present' as 'present' | 'absent',
    checkIn: '',
    checkOut: '',
  });

  useEffect(() => {
    if (token) {
      fetchWorkers();
      fetchSites();
    }
  }, [token]);

  useEffect(() => {
    if (selectedSite) {
      fetchAttendance();
    }
  }, [selectedDate, selectedSite]);

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

  const fetchAttendance = async () => {
    if (!token || !selectedSite) return;
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?siteId=${selectedSite}&date=${dateStr}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const handleSubmit = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark attendance');
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Attendance marked successfully',
      });

      setIsModalOpen(false);
      setFormData({
        workerId: '',
        siteId: '',
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        checkIn: '',
        checkOut: '',
      });
      fetchAttendance();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to mark attendance',
      });
    }
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  return (
    <View style={styles.container}>
      <Box className="p-4 flex-1">
        <VStack space="lg">
          <HStack space="sm">
            <Box className="flex-1">
              <Text size="sm" className="mb-1 text-gray-600" style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>Site</Text>
              <Select selectedValue={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger variant="outline" size="md" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                  <SelectInput placeholder="Select site" style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }} />
                  <SelectIcon className="mr-3" />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {sites.map((site) => (
                      <SelectItem key={site.id} label={site.name} value={site.id}>
                        <SelectItemText>{site.name}</SelectItemText>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </Box>
            <Box className="flex-1">
              <Text size="sm" className="mb-1 text-gray-600" style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>Date</Text>
              <Button variant="outline" action="secondary" onPress={() => setShowDatePicker(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, justifyContent: 'flex-start', paddingHorizontal: 12 }}>
                <MaterialIcons name="calendar-today" size={16} color="#2563eb" />
                <ButtonText style={{ color: '#111827', marginLeft: 8, fontSize: 16 }}>{selectedDate.toLocaleDateString()}</ButtonText>
              </Button>
            </Box>
          </HStack>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}

          <Button onPress={() => setIsModalOpen(true)} style={{ backgroundColor: '#2563eb', borderRadius: 8, height: 44 }}>
            <ButtonText style={{ fontWeight: '600', fontSize: 14 }}>Mark Attendance</ButtonText>
          </Button>

          {selectedSite && (
            <FlatList
              data={attendance}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Card className="p-4 mb-2">
                  <HStack className="justify-between items-center">
                    <VStack className="flex-1">
                      <Text size="md" className="font-medium">{item.workerName}</Text>
                      <HStack className="items-center mt-1" space="sm">
                        {item.status === 'present' ? (
                          <MaterialIcons name="check-circle" size={16} color="#22c55e" />
                        ) : (
                          <MaterialIcons name="cancel" size={16} color="#ef4444" />
                        )}
                        <Text size="sm" className={item.status === 'present' ? 'text-green-600' : 'text-red-600'}>
                          {item.status}
                        </Text>
                      </HStack>
                      {item.checkIn && (
                        <HStack className="items-center mt-1" space="xs">
                          <MaterialIcons name="access-time" size={12} color="#717182" />
                          <Text size="xs" className="text-gray-500">
                            In: {item.checkIn} {item.checkOut && `Out: ${item.checkOut}`}
                          </Text>
                        </HStack>
                      )}
                    </VStack>
                  </HStack>
                </Card>
              )}
              ListEmptyComponent={
                <Box className="p-8 items-center">
                  <Text className="text-gray-400">No attendance records for this date</Text>
                </Box>
              }
            />
          )}
        </VStack>
      </Box>

      {/* Mark Attendance Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
        <ModalBackdrop onPress={() => setIsModalOpen(false)} />
        <ModalContent>
          <ModalHeader>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', flex: 1 }}>
              Mark Attendance
            </Text>
            <ModalCloseButton onPress={() => setIsModalOpen(false)}>
              <MaterialIcons name="close" size={24} color="#717182" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody>
            <ScrollView showsVerticalScrollIndicator={false}>
              <VStack space="lg" style={{ paddingBottom: 10 }}>

                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                      Worker
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Select selectedValue={formData.workerId} onValueChange={(value) => setFormData({ ...formData, workerId: value })}>
                    <SelectTrigger variant="outline" size="md" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                      <SelectInput placeholder="Select worker" style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }} />
                      <SelectIcon className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {workers.map((worker) => (
                          <SelectItem key={worker.id} label={worker.name} value={worker.id}>
                            <SelectItemText>{worker.name}</SelectItemText>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                      Site
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Select selectedValue={formData.siteId} onValueChange={(value) => setFormData({ ...formData, siteId: value })}>
                    <SelectTrigger variant="outline" size="md" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                      <SelectInput placeholder="Select site" style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }} />
                      <SelectIcon className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {sites.map((site) => (
                          <SelectItem key={site.id} label={site.name} value={site.id}>
                            <SelectItemText>{site.name}</SelectItemText>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                      Status
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Select selectedValue={formData.status} onValueChange={(value: 'present' | 'absent') => setFormData({ ...formData, status: value })}>
                    <SelectTrigger variant="outline" size="md" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                      <SelectInput placeholder="Select status" style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }} />
                      <SelectIcon className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        <SelectItem label="Present" value="present">
                          <SelectItemText>Present</SelectItemText>
                        </SelectItem>
                        <SelectItem label="Absent" value="absent">
                          <SelectItemText>Absent</SelectItemText>
                        </SelectItem>
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </FormControl>

                {formData.status === 'present' && (
                  <>
                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                          Check In Time
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input size="md" variant="outline" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                        <InputField
                          value={formData.checkIn}
                          onChangeText={(text) => setFormData({ ...formData, checkIn: text })}
                          placeholder="HH:MM (e.g., 09:00)"
                          placeholderTextColor="#9ca3af"
                          style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }}
                        />
                      </Input>
                    </FormControl>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                          Check Out Time
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input size="md" variant="outline" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                        <InputField
                          value={formData.checkOut}
                          onChangeText={(text) => setFormData({ ...formData, checkOut: text })}
                          placeholder="HH:MM (e.g., 18:00)"
                          placeholderTextColor="#9ca3af"
                          style={{ fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }}
                        />
                      </Input>
                    </FormControl>
                  </>
                )}

              </VStack>
            </ScrollView>
          </ModalBody>
          <ModalFooter>
            <HStack space="md" style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onPress={() => setIsModalOpen(false)}
                style={{ borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', flex: 1 }}
              >
                <ButtonText style={{ color: '#374151', fontWeight: '600' }}>Cancel</ButtonText>
              </Button>
              <Button
                onPress={handleSubmit}
                isDisabled={!formData.workerId || !formData.siteId || !formData.status}
                style={{ backgroundColor: '#2563eb', flex: 1 }}
              >
                <ButtonText style={{ color: '#ffffff', fontWeight: '600' }}>Submit</ButtonText>
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
