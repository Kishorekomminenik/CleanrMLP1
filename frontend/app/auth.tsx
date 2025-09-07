import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const router = useRouter();
  
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<'customer' | 'partner' | 'owner'>('customer');
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTos, setAcceptTos] = useState(true);
  const [mfaCode, setMfaCode] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);
    
    try {
      if (mode === 'login') {
        const result = await login(email, password, role);
        
        if (result.success) {
          if (result.mfa_required) {
            setMfaUserId(result.user_id!);
            setShowMFA(true);
            Alert.alert('MFA Required', `Enter the 6-digit code${result.dev_mfa_code ? '. Dev code: ' + result.dev_mfa_code : ''}`);
          } else {
            // Login successful, router will handle redirect
            router.replace('/app');
          }
        } else {
          Alert.alert('Login Failed', result.error || 'Unknown error');
        }
      } else {
        // Signup
        const result = await register({
          email,
          username: username || undefined,
          password,
          role,
          phone: phone || undefined,
          acceptTos,
        });
        
        if (result.success) {
          // Signup successful, router will handle redirect
          router.replace('/app');
        } else {
          Alert.alert('Signup Failed', result.error || 'Unknown error');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMFASubmit = async () => {
    if (!mfaCode || loading) return;

    setLoading(true);
    
    try {
      const { verifyMFA } = useAuth();
      const result = await verifyMFA(mfaUserId, mfaCode);
      
      if (result.success) {
        setShowMFA(false);
        router.replace('/app');
      } else {
        Alert.alert('MFA Failed', result.error || 'Invalid code');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (roleType: string) => {
    switch (roleType) {
      case 'customer':
        return '#3A8DFF';
      case 'partner':
        return '#10B981';
      case 'owner':
        return '#8B5CF6';
      default:
        return '#6C757D';
    }
  };

  if (showMFA) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.authCard}>
          <Text style={styles.title}>Two-Factor Authentication</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to your device</Text>
          
          <TextInput
            style={styles.input}
            placeholder="000000"
            value={mfaCode}
            onChangeText={setMfaCode}
            keyboardType="numeric"
            maxLength={6}
            textAlign="center"
            fontSize={24}
          />
          
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleMFASubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Verify Code</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setShowMFA(false)}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>SHINE</Text>
          <Text style={styles.appSubtitle}>Professional Service Platform</Text>
        </View>

        <View style={styles.authCard}>
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>
                Login
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Role Selection */}
          <View style={styles.roleSelector}>
            {(['customer', 'partner', 'owner'] as const).map((roleType) => (
              <TouchableOpacity
                key={roleType}
                style={[
                  styles.roleButton,
                  role === roleType && {
                    backgroundColor: getRoleColor(roleType),
                  },
                ]}
                onPress={() => setRole(roleType)}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === roleType && styles.roleButtonTextActive,
                  ]}
                >
                  {roleType.charAt(0).toUpperCase() + roleType.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Username (optional)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {mode === 'signup' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <View style={styles.checkboxContainer}>
                  <Switch
                    value={acceptTos}
                    onValueChange={setAcceptTos}
                    trackColor={{ false: '#E0E0E0', true: '#3A8DFF' }}
                    thumbColor={acceptTos ? '#FFFFFF' : '#f4f3f4'}
                  />
                  <Text style={styles.checkboxLabel}>
                    I accept the Terms of Service and Privacy Policy
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3A8DFF',
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#6C757D',
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: '#3A8DFF',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C757D',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FAFBFC',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#6C757D',
  },
  submitButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#3A8DFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
  },
});