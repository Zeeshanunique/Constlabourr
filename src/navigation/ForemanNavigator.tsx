import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ModernForemanDashboard } from '../screens/ForemanDashboard';
import { AttendanceTab } from '../features/attendance/AttendanceTab';
import { ForemanWorkersTab } from '../features/workers/ForemanWorkersTab';
import { MaterialIcons } from '@expo/vector-icons';

export type ForemanTabParamList = {
  Home: { accessToken: string };
  Attendance: { accessToken: string };
  Workers: { accessToken: string };
};

const Tab = createBottomTabNavigator<ForemanTabParamList>();

export function ForemanNavigator({ route }: { route: any }) {
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
        {(props) => <ModernForemanDashboard {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Attendance"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="check-box" size={size} color={color} />,
        }}
      >
        {(props) => <AttendanceTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Workers"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
        }}
      >
        {(props) => <ForemanWorkersTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

