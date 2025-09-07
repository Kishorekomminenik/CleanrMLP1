import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Stack } from 'expo-router';
import AuthProvider from '../src/contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="app" />
        <Stack.Screen name="address" />
        <Stack.Screen name="checkout" />
      </Stack>
    </AuthProvider>
  );
}