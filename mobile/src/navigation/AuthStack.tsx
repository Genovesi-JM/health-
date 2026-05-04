import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ConsentGateScreen from '../screens/ConsentGateScreen';

export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  ConsentGate: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ConsentGate" component={ConsentGateScreen} />
    </Stack.Navigator>
  );
}
