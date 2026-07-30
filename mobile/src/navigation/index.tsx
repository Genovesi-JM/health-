import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import { View, ActivityIndicator } from 'react-native';
import ProfessionalVerificationScreen from '../screens/ProfessionalVerificationScreen';
import api from '../services/api';
import ClinicianStack from './ClinicianStack';

function ClinicianRoot({ role }: { role: string }) {
  const [credentialStatus, setCredentialStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/v1/credentials/me')
      .then(response => setCredentialStatus(response.data.status))
      .catch(() => setCredentialStatus('draft'));
  }, []);

  if (credentialStatus === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }
  if ((role === 'doctor' || role === 'nurse') && credentialStatus === 'verified') {
    return <ClinicianStack role={role} />;
  }
  return <ProfessionalVerificationScreen onVerified={() => setCredentialStatus('verified')} />;
}

export default function RootNavigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdfb' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        user.role === 'doctor' || user.role === 'nurse'
          ? <ClinicianRoot role={user.role} />
          : <AppStack />
      ) : <AuthStack />}
    </NavigationContainer>
  );
}
