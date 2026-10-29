import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ModernForemanDashboard } from '../screens/ForemanDashboard';
import { AttendanceTab } from '../features/attendance/AttendanceTab';
import { ForemanWorkersTab } from '../features/workers/ForemanWorkersTab';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, shadows } from '../styles/theme';

export type ForemanTabParamList = {
  Home: { accessToken: string };
  Attendance: { accessToken: string };
  Workers: { accessToken: string };
  Settings: { accessToken: string };
};

const Tab = createBottomTabNavigator<ForemanTabParamList>();

export function ForemanNavigator({ route }: { route: any }) {
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
        {(props) => <ModernForemanDashboard {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Attendance"
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="assignment-turned-in" size={size} color={color} />,
        }}
      >
        {(props) => <AttendanceTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Workers"
        options={{
          tabBarLabel: 'Site Crew',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="groups" size={size} color={color} />,
        }}
      >
        {(props) => <ForemanWorkersTab {...props} accessToken={accessToken} />}
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


