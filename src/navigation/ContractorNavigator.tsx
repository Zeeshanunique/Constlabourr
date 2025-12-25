import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ModernContractorDashboard } from '../screens/ContractorDashboard';
import { WorkersTab } from '../features/workers/WorkersTab';
import { ForemenTab } from '../features/workers/ForemenTab';
import { SitesTab } from '../features/sites/SitesTab';
import { BulkAttendanceTab } from '../features/attendance/BulkAttendanceTab';
import { PayrollTab } from '../features/payroll/PayrollTab';
import { MaterialIcons, FontAwesome5, Ionicons, Feather } from '@expo/vector-icons';

export type ContractorTabParamList = {
  Home: { accessToken: string };
  Workers: { accessToken: string };
  Foremen: { accessToken: string };
  Sites: { accessToken: string };
  Attendance: { accessToken: string };
  Payroll: { accessToken: string };
};

const Tab = createBottomTabNavigator<ContractorTabParamList>();

export function ContractorNavigator({ route }: { route: any }) {
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
        {(props) => <ModernContractorDashboard {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Workers"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
        }}
      >
        {(props) => <WorkersTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Foremen"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="supervisor-account" size={size} color={color} />,
        }}
      >
        {(props) => <ForemenTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Sites"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="place" size={size} color={color} />,
        }}
      >
        {(props) => <SitesTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Attendance"
        options={{
          tabBarLabel: 'Attend',
          tabBarIcon: ({ color, size}) => <MaterialIcons name="check-box" size={size} color={color} />,
        }}
      >
        {(props) => <BulkAttendanceTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Payroll"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="attach-money" size={size} color={color} />,
        }}
      >
        {(props) => <PayrollTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
