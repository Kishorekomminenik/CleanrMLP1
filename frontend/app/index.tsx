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
    // Set a maximum timeout for loading
    const timeout = setTimeout(() => {
      console.log('App loading timeout, force showing auth screen');
      setAppReady(true);
    }, 3000); // 3 second timeout

    if (!loading) {
      setAppReady(true);
      clearTimeout(timeout);
    }

    return () => clearTimeout(timeout);
  }, [loading]);

  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A8DFF" />
        <Text style={styles.loadingText}>Loading SHINE...</Text>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C757D',
  },
});