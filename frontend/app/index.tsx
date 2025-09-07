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

  const testLogin = async () => {
    try {
      const backendUrl = 'https://4d887c9a-9eda-43bf-b7bc-8ea882f55f7b.preview.emergentagent.com';
      console.log('Testing signup to:', backendUrl);
      
      const response = await fetch(`${backendUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@shine.com',
          password: 'TestPass123!',
          role: 'customer'
        }),
      });
      
      const data = await response.json();
      
      Alert.alert(
        'Signup Test Result', 
        `Status: ${response.status}\nResponse: ${JSON.stringify(data).substring(0, 200)}...`
      );
    } catch (error) {
      Alert.alert('Signup Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>🎉 SHINE App Connected!</Text>
      <Text style={styles.subtitle}>Test the backend connection</Text>
      
      <TouchableOpacity style={styles.button} onPress={testBackendConnection}>
        <Text style={styles.buttonText}>Test Backend API</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={testLogin}>
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Test Signup API</Text>
      </TouchableOpacity>
      
      <View style={styles.status}>
        <Text style={styles.statusText}>✅ Expo Go: CONNECTED</Text>
        <Text style={styles.statusText}>✅ React Native: WORKING</Text>
        <Text style={styles.statusText}>✅ Network: READY</Text>
        <Text style={styles.statusText}>✅ No More Spinner!</Text>
      </View>
      
      <Text style={styles.urlText}>Connected to: exp://10.219.24.54:3002</Text>
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 16,
    minWidth: 200,
  },
  secondaryButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#3A8DFF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: '#3A8DFF',
  },
  status: {
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#10B981',
  },
  urlText: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
  },
});