import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppContext } from '../context/AppContext';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '../utils/supabase/info';
import { WorkerAgreementModal } from './WorkerAgreementModal';
import { useRoute } from '@react-navigation/native';

interface LabourDashboardProps {
  accessToken?: string;
}

export function LabourDashboard({ accessToken }: LabourDashboardProps) {
  const context = useContext(AppContext);
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [stats, setStats] = useState({
    totalDays: 0,
    presentDays: 0,
    totalEarnings: 0,
    pendingAdvances: 0,
  });
  const [needsAgreementAcceptance, setNeedsAgreementAcceptance] = useState(false);
  const [checkingAgreement, setCheckingAgreement] = useState(true);

  useEffect(() => {
    if (token) {
      checkAgreementStatus();
      fetchStats();
    }
  }, [token]);

  const checkAgreementStatus = async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/status`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      
      if (data.currentAgreement && data.needsAcceptance) {
        setNeedsAgreementAcceptance(true);
      }
    } catch (error) {
      console.error('Error checking agreement status:', error);
    } finally {
      setCheckingAgreement(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    // Fetch worker stats
    // This is a placeholder - implement based on your API
  };

  const handleAgreementAccepted = () => {
    setNeedsAgreementAcceptance(false);
  };

  if (!context) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Box className="bg-green-600 px-4 py-6 pb-8 shadow-lg">
        <HStack className="justify-between items-center mb-4">
          <HStack className="items-center" space="md">
            <Box className="w-12 h-12 rounded-full justify-center items-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <MaterialIcons name="business" size={24} color="white" />
            </Box>
            <VStack>
              <Text size="md" bold className="text-white">
                ConstLabour
              </Text>
              <Text size="sm" className="text-green-100">
                {context.user?.name}
              </Text>
              <Text size="xs" className="text-green-200">
                Worker
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
          <VStack space="lg">
            {/* Stats Cards */}
            <HStack className="flex-wrap justify-between">
              <Card className="bg-blue-500 rounded-lg p-4 mb-3 w-[48%]">
                <VStack>
                  <Text size="xs" className="text-blue-100 mb-1">
                    Total Days
                  </Text>
                  <Text size="2xl" bold className="text-white">
                    {stats.totalDays}
                  </Text>
                </VStack>
              </Card>
              <Card className="bg-green-500 rounded-lg p-4 mb-3 w-[48%]">
                <VStack>
                  <Text size="xs" className="text-green-100 mb-1">
                    Present Days
                  </Text>
                  <Text size="2xl" bold className="text-white">
                    {stats.presentDays}
                  </Text>
                </VStack>
              </Card>
              <Card className="bg-purple-500 rounded-lg p-4 mb-3 w-[48%]">
                <VStack>
                  <Text size="xs" className="text-purple-100 mb-1">
                    Total Earnings
                  </Text>
                  <Text size="2xl" bold className="text-white">
                    ₹{stats.totalEarnings}
                  </Text>
                </VStack>
              </Card>
              <Card className="bg-orange-500 rounded-lg p-4 mb-3 w-[48%]">
                <VStack>
                  <Text size="xs" className="text-orange-100 mb-1">
                    Pending Advances
                  </Text>
                  <Text size="2xl" bold className="text-white">
                    ₹{stats.pendingAdvances}
                  </Text>
                </VStack>
              </Card>
            </HStack>
          </VStack>
        </Box>
      </ScrollView>

      {needsAgreementAcceptance && token && (
        <WorkerAgreementModal
          accessToken={token}
          onAccepted={handleAgreementAccepted}
        />
      )}
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
