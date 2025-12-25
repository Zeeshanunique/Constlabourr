import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ContractorNavigator } from './ContractorNavigator';
import { ForemanDashboard } from '../components/ForemanDashboard';
import { LabourDashboard } from '../components/LabourDashboard';
import { ReportsTab } from '../components/ReportsTab';
import { AgreementTab } from '../components/AgreementTab';
import { UserRole } from '../context/AppContext';

export type AppStackParamList = {
  Contractor: { accessToken: string };
  Foreman: { accessToken: string };
  Labour: { accessToken: string };
  Reports: { accessToken: string };
  Agreements: { accessToken: string };
};

const Stack = createStackNavigator<AppStackParamList>();

export function AppNavigator({ role, accessToken }: { role: UserRole; accessToken: string }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {role === 'contractor' && (
        <>
          <Stack.Screen name="Contractor" component={ContractorNavigator} initialParams={{ accessToken }} />
          <Stack.Screen name="Reports" component={ReportsTab} initialParams={{ accessToken }} />
          <Stack.Screen name="Agreements" component={AgreementTab} initialParams={{ accessToken }} />
        </>
      )}
      {role === 'foreman' && (
        <Stack.Screen name="Foreman" component={ForemanDashboard} initialParams={{ accessToken }} />
      )}
      {role === 'labour' && (
        <Stack.Screen name="Labour" component={LabourDashboard} initialParams={{ accessToken }} />
      )}
    </Stack.Navigator>
  );
}

