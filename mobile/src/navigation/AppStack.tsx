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

export type AppStackParamList = {
  HomeTabs: undefined;
  BookConsultation: undefined;
  PrescriptionRequest: undefined;
  Family: undefined;
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={PatientProfileScreen} />
      <Tab.Screen name="Readings" component={ReadingsScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeTabs" component={HomeTabs} options={{ headerShown: false }} />
      <Stack.Screen name="BookConsultation" component={BookConsultationScreen}
        options={{ title: 'Book Consultation', headerTintColor: TEAL }} />
      <Stack.Screen name="PrescriptionRequest" component={PrescriptionRequestScreen}
        options={{ title: 'Request Prescription', headerTintColor: TEAL }} />
      <Stack.Screen name="Family" component={FamilyScreen}
        options={{ title: 'Family Members', headerTintColor: TEAL }} />
    </Stack.Navigator>
  );
}
