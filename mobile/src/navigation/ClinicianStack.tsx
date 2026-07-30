import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DoctorDashboardScreen from '../screens/DoctorDashboardScreen';
import NurseDashboardScreen from '../screens/NurseDashboardScreen';
import ClinicianPatient360Screen from '../screens/ClinicianPatient360Screen';
import { useLanguage } from '../i18n/LanguageContext';

export type ClinicianStackParamList = {
  DoctorDashboard: undefined;
  NurseDashboard: undefined;
  Patient360: { patientId: string };
};

const Stack = createNativeStackNavigator<ClinicianStackParamList>();
const TEAL = '#0d9488';

export default function ClinicianStack({ role }: { role: 'doctor' | 'nurse' }) {
  const { t } = useLanguage();
  return (
    <Stack.Navigator
      initialRouteName={role === 'doctor' ? 'DoctorDashboard' : 'NurseDashboard'}
      screenOptions={{
        headerTintColor: TEAL,
        headerBackTitleVisible: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Stack.Screen
        name="DoctorDashboard"
        component={DoctorDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NurseDashboard"
        component={NurseDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Patient360"
        component={ClinicianPatient360Screen}
        options={{ title: t('clinician.patient360') }}
      />
    </Stack.Navigator>
  );
}

