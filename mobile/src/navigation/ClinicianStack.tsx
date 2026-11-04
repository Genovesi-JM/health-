import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DoctorDashboardScreen from '../screens/DoctorDashboardScreen';
import DoctorConsultationsScreen from '../screens/DoctorConsultationsScreen';
import DoctorConsultationDetailScreen from '../screens/DoctorConsultationDetailScreen';
import NurseDashboardScreen from '../screens/NurseDashboardScreen';
import ClinicianPatient360Screen from '../screens/ClinicianPatient360Screen';
import { useLanguage } from '../i18n/LanguageContext';

export type ClinicianStackParamList = {
  DoctorDashboard: undefined;
  DoctorConsultations: undefined;
  DoctorConsultationDetail: { consultationId: string; patientName?: string };
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
        headerBackButtonDisplayMode: 'minimal',
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
        name="DoctorConsultations"
        component={DoctorConsultationsScreen}
        options={{ title: 'Consultas atribuídas' }}
      />
      <Stack.Screen
        name="DoctorConsultationDetail"
        component={DoctorConsultationDetailScreen}
        options={{ title: 'Registo da consulta' }}
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
