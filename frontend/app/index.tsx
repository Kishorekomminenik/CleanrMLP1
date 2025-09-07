import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useEffect } from 'react';

export default function RootIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is authenticated, redirect to main app
        router.replace('/app');
      } else {
        // User is not authenticated, redirect to auth screen
        router.replace('/auth');
      }
    }
  }, [user, loading, router]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3A8DFF" />
      </View>
    );
  }

  // This should never render due to useEffect redirects
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});