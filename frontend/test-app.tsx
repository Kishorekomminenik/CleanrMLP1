import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function TestApp() {
  const testBackendConnection = async () => {
    try {
      const backendUrl = 'https://4d887c9a-9eda-43bf-b7bc-8ea882f55f7b.preview.emergentagent.com';
      console.log('Testing connection to:', backendUrl);
      
      const response = await fetch(`${backendUrl}/api/auth/me`);
      const data = await response.json();
      
      Alert.alert(
        'Backend Test Result', 
        `Status: ${response.status}\nResponse: ${JSON.stringify(data)}`
      );
    } catch (error) {
      Alert.alert('Connection Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>SHINE App - Test Version</Text>
      <Text style={styles.subtitle}>Connection Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={testBackendConnection}>
        <Text style={styles.buttonText}>Test Backend Connection</Text>
      </TouchableOpacity>
      
      <View style={styles.status}>
        <Text style={styles.statusText}>✅ App Loading: SUCCESS</Text>
        <Text style={styles.statusText}>✅ React Native: WORKING</Text>
        <Text style={styles.statusText}>✅ Network: READY TO TEST</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3A8DFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 40,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#10B981',
  },
});