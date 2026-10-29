import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ModernLabourDashboard } from '../screens/LabourDashboard';
import { WorkerAttendanceTab } from '../features/attendance/WorkerAttendanceTab';
import { WorkerProfileTab } from '../features/profile/WorkerProfileTab';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, shadows } from '../styles/theme';

export type LabourTabParamList = {
  Home: { accessToken: string };
  Attendance: { accessToken: string };
  Profile: { accessToken: string };
  Settings: { accessToken: string };
};

const Tab = createBottomTabNavigator<LabourTabParamList>();

export function LabourNavigator({ route }: { route: any }) {
  const accessToken = route.params?.accessToken;
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
          ...shadows.dock,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      >
        {(props) => <ModernLabourDashboard {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Attendance"
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="calendar-month" size={size} color={color} />,
        }}
      >
        {(props) => <WorkerAttendanceTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Wage Slip',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="badge" size={size} color={color} />,
        }}
      >
        {(props) => <WorkerProfileTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}


