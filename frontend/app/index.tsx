import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthProvider, { useAuth } from '../src/contexts/AuthContext';
import AuthStack from '../src/navigation/AuthStack';
import AppShell from '../src/navigation/AppShell';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A8DFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      {user ? <AppShell /> : <AuthStack />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});