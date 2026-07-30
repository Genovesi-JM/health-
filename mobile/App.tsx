import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigation from './src/navigation';
import { LanguageProvider } from './src/i18n/LanguageContext';
import HealthSyncManager from './src/health/HealthSyncManager';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <LanguageProvider>
        <AuthProvider>
          <HealthSyncManager />
          <RootNavigation />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
