import React, { useContext } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { AppContext } from '../context/AppContext';
import { MaterialIcons } from '@expo/vector-icons';
import { AttendanceTab } from './AttendanceTab';
import { useRoute } from '@react-navigation/native';

interface ForemanDashboardProps {
  accessToken?: string;
}

export function ForemanDashboard({ accessToken }: ForemanDashboardProps) {
  const context = useContext(AppContext);
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;

  if (!context) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Box className="bg-purple-600 px-4 py-6 pb-8 shadow-lg">
        <HStack className="justify-between items-center mb-4">
          <HStack className="items-center" space="md">
            <Box className="w-12 h-12 rounded-full justify-center items-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <MaterialIcons name="business" size={24} color="white" />
            </Box>
            <VStack>
              <Text size="md" bold className="text-white">
                ConstLabour
              </Text>
              <Text size="sm" className="text-purple-100">
                {context.user?.name}
              </Text>
              <Text size="xs" className="text-purple-200">
                Foreman
              </Text>
            </VStack>
          </HStack>
          <Button variant="outline" size="sm" action="secondary" onPress={context.logout}>
            <MaterialIcons name="logout" size={16} color="white" />
          </Button>
        </HStack>
      </Box>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <Box className="p-4">
          <AttendanceTab accessToken={token!} />
        </Box>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
});
