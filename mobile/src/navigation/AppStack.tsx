import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import PatientProfileScreen from '../screens/PatientProfileScreen';
import ReadingsScreen from '../screens/ReadingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BookConsultationScreen from '../screens/BookConsultationScreen';
import PrescriptionRequestScreen from '../screens/PrescriptionRequestScreen';
import FamilyScreen from '../screens/FamilyScreen';
import ConsentGateScreen from '../screens/ConsentGateScreen';
import TriageScreen from '../screens/TriageScreen';
import { useLanguage } from '../i18n/LanguageContext';

export type AppStackParamList = {
  HomeTabs: undefined;
  BookConsultation: undefined;
  PrescriptionRequest: undefined;
  Family: undefined;
  ConsentGate: undefined;
  Readings: undefined;
  Notifications: undefined;
  Triage: undefined;
};

export type TabParamList = {
  Home: undefined;
  Profile: undefined;
  Readings: undefined;
  Notifications: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

const TEAL = '#0d9488';

function HomeTabs() {
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: TEAL,
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            Home: focused ? 'home' : 'home-outline',
            Profile: focused ? 'person' : 'person-outline',
            Readings: focused ? 'pulse' : 'pulse-outline',
            Notifications: focused ? 'notifications' : 'notifications-outline',
            Settings: focused ? 'settings' : 'settings-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('nav.home') }} />
      <Tab.Screen name="Profile" component={PatientProfileScreen} options={{ title: t('nav.profile') }} />
      <Tab.Screen name="Readings" component={ReadingsScreen} options={{ title: t('nav.readings') }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('nav.notifications') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings') }} />
    </Tab.Navigator>
  );
}

export default function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeTabs" component={HomeTabs} options={{ headerShown: false }} />
      <Stack.Screen name="BookConsultation" component={BookConsultationScreen}
        options={{ title: 'Marcar Consulta', headerTintColor: TEAL }} />
      <Stack.Screen name="PrescriptionRequest" component={PrescriptionRequestScreen}
        options={{ title: 'Pedir Receita', headerTintColor: TEAL }} />
      <Stack.Screen name="Family" component={FamilyScreen}
        options={{ title: 'Família', headerTintColor: TEAL }} />
      <Stack.Screen name="ConsentGate" component={ConsentGateScreen}
        options={{ title: 'Consentimentos', headerTintColor: TEAL }} />
      <Stack.Screen name="Triage" component={TriageScreen}
        options={{ title: 'Orientação de saúde', headerTintColor: TEAL }} />
    </Stack.Navigator>
  );
}
