import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ModernContractorDashboard } from '../screens/ContractorDashboard';
import { WorkersTab } from '../features/workers/WorkersTab';
import { ForemenTab } from '../features/workers/ForemenTab';
import { SitesTab } from '../features/sites/SitesTab';
import { AttendanceTab } from '../features/attendance/AttendanceTab';
import { PayrollTab } from '../features/payroll/PayrollTab';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, shadows } from '../styles/theme';
import { useTranslation } from '../i18n';

export type ContractorTabParamList = {
  Home: { accessToken: string };
  Attendance: { accessToken: string };
  Workers: { accessToken: string };
  Sites: { accessToken: string };
  Payroll: { accessToken: string };
  Foremen: { accessToken: string };
  Settings: { accessToken: string };
};

const Tab = createBottomTabNavigator<ContractorTabParamList>();

export function ContractorNavigator({ route }: { route: any }) {
  const accessToken = route.params?.accessToken;
  const { t } = useTranslation();
  
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
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      >
        {(props) => <ModernContractorDashboard {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Attendance"
        options={{
          tabBarLabel: t('nav.attendance'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="assignment-turned-in" size={size} color={color} />,
        }}
      >
        {(props) => <AttendanceTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Workers"
        options={{
          tabBarLabel: t('nav.workers'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="groups" size={size} color={color} />,
        }}
      >
        {(props) => <WorkersTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Sites"
        options={{
          tabBarLabel: t('nav.sites'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="location-city" size={size} color={color} />,
        }}
      >
        {(props) => <SitesTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Payroll"
        options={{
          tabBarLabel: t('nav.payroll'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="payments" size={size} color={color} />,
        }}
      >
        {(props) => <PayrollTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Foremen"
        options={{
          tabBarLabel: t('nav.foremen'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="engineering" size={size} color={color} />,
        }}
      >
        {(props) => <ForemenTab {...props} accessToken={accessToken} />}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('nav.settings'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
