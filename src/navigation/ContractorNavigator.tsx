import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ModernContractorDashboard } from '../components/ModernContractorDashboard';
import { WorkersTab } from '../components/WorkersTab';
import { ForemenTab } from '../components/ForemenTab';
import { SitesTab } from '../components/SitesTab';
import { ForemanAttendanceTab } from '../components/ForemanAttendanceTab';
import { BulkAttendanceTab } from '../components/BulkAttendanceTab';
import { PayrollTab } from '../components/PayrollTab';
import { ReportsTab } from '../components/ReportsTab';
import { AgreementTab } from '../components/AgreementTab';
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

export function ContractorNavigator({ accessToken }: { accessToken: string }) {
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
        component={ModernContractorDashboard}
        initialParams={{ accessToken }}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Workers"
        component={WorkersTab}
        initialParams={{ accessToken }}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Foremen"
        component={ForemenTab}
        initialParams={{ accessToken }}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="supervisor-account" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Sites"
        component={SitesTab}
        initialParams={{ accessToken }}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="place" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Attendance"
        component={BulkAttendanceTab}
        initialParams={{ accessToken }}
        options={{
          tabBarLabel: 'Attend',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="check-box" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Payroll"
        component={PayrollTab}
        initialParams={{ accessToken }}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="attach-money" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
