import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthProvider, { useAuth } from '../src/contexts/AuthContext';
import AuthStack from '../src/navigation/AuthStack';
import AppShell from '../src/navigation/AppShell';

function AppContent() {
  const { user, loading } = useAuth();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    console.log('AppContent: Loading state changed:', loading);
    console.log('AppContent: User state:', user ? 'Logged in' : 'Not logged in');
    
    // Very aggressive timeout - show auth screen after 2 seconds regardless
    const timeout = setTimeout(() => {
      console.log('AppContent: Force timeout - showing auth screen');
      setAppReady(true);
    }, 2000); // 2 second timeout

    if (!loading) {
      console.log('AppContent: Loading finished, showing app');
      setAppReady(true);
      clearTimeout(timeout);
    }

    return () => clearTimeout(timeout);
  }, [loading, user]);

  // Show loading for maximum 2 seconds
  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A8DFF" />
        <Text style={styles.loadingText}>Loading SHINE...</Text>
        <Text style={styles.debugText}>Backend URL configured ✓</Text>
      </View>
    );
  }

  console.log('AppContent: Rendering app shell or auth');
  return (
    <>
      <StatusBar style="auto" />
      {user ? <AppShell /> : <AuthStack />}
    </>
  );
}

export default function App() {
  console.log('App: Starting SHINE application');
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C757D',
  },
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: '#10B981',
  },
});