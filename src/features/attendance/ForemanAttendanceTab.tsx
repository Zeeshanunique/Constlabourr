import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Box } from '../../components/ui/box';
import { Text } from '../../components/ui/text';
import { AttendanceTab } from './AttendanceTab';
import { useRoute } from '@react-navigation/native';

interface ForemanAttendanceTabProps {
  accessToken?: string;
}

export function ForemanAttendanceTab({ accessToken }: ForemanAttendanceTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;

  return <AttendanceTab accessToken={token} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});
