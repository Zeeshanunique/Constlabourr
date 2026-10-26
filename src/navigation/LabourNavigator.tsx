import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ModernLabourDashboard } from '../screens/LabourDashboard';
import { WorkerAttendanceTab } from '../features/attendance/WorkerAttendanceTab';
import { WorkerProfileTab } from '../features/profile/WorkerProfileTab';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MaterialIcons } from '@expo/vector-icons';

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
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#717182',
        tabBarStyle: {
          paddingBottom: 5,
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      >
        {(props) => <ModernLabourDashboard {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Attendance"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="calendar-today" size={size} color={color} />,
        }}
      >
        {(props) => <WorkerAttendanceTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
        }}
      >
        {(props) => <WorkerProfileTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}


