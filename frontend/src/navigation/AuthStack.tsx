import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useController, useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}

interface MFAForm {
  code: string;
}

export default function AuthStack() {
  const { login, register, verifyMFA } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState<{ required: boolean; email: string; devCode?: string }>({
    required: false,
    email: '',
  });

  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>({
    defaultValues: { role: 'customer' },
  });
  const mfaForm = useForm<MFAForm>();

  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result.success) {
        if (result.mfa_required) {
          setMfaStep({
            required: true,
            email: data.email,
            devCode: result.dev_mfa_code,
          });
          Alert.alert(
            'MFA Required',
            `Enter the 6-digit code${result.dev_mfa_code ? ` (Dev: ${result.dev_mfa_code})` : ''}`
          );
        }
      } else {
        Alert.alert('Login Failed', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    if (data.password !== data.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await register(data.email, data.password, data.role);
      if (!result.success) {
        Alert.alert('Registration Failed', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleMFA = async (data: MFAForm) => {
    setLoading(true);
    try {
      const result = await verifyMFA(mfaStep.email, data.code);
      if (!result.success) {
        Alert.alert('MFA Failed', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (mfaStep.required) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <View style={styles.form}>
            <Text style={styles.title}>Enter MFA Code</Text>
            <Text style={styles.subtitle}>
              Check your phone for the 6-digit code
              {mfaStep.devCode && ` (Dev: ${mfaStep.devCode})`}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              value={mfaForm.watch('code')}
              onChangeText={(text) => mfaForm.setValue('code', text)}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={mfaForm.handleSubmit(handleMFA)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setMfaStep({ required: false, email: '' })}
            >
              <Text style={styles.linkText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.form}>
            <Text style={styles.title}>
              {isLogin ? 'Welcome to SHINE' : 'Join SHINE'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Sign in to continue' : 'Create your account'}
            </Text>

            {isLogin ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={loginForm.watch('email')}
                  onChangeText={(text) => loginForm.setValue('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={loginForm.watch('password')}
                  onChangeText={(text) => loginForm.setValue('password', text)}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={loginForm.handleSubmit(handleLogin)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={registerForm.watch('email')}
                  onChangeText={(text) => registerForm.setValue('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={registerForm.watch('password')}
                  onChangeText={(text) => registerForm.setValue('password', text)}
                  secureTextEntry
                />

                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={registerForm.watch('confirmPassword')}
                  onChangeText={(text) => registerForm.setValue('confirmPassword', text)}
                  secureTextEntry
                />

                <View style={styles.roleContainer}>
                  <Text style={styles.roleLabel}>I want to be a:</Text>
                  <View style={styles.roleButtons}>
                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        registerForm.watch('role') === 'customer' && styles.roleButtonActive,
                      ]}
                      onPress={() => registerForm.setValue('role', 'customer')}
                    >
                      <Text
                        style={[
                          styles.roleButtonText,
                          registerForm.watch('role') === 'customer' && styles.roleButtonTextActive,
                        ]}
                      >
                        Customer
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        registerForm.watch('role') === 'partner' && styles.roleButtonActive,
                      ]}
                      onPress={() => registerForm.setValue('role', 'partner')}
                    >
                      <Text
                        style={[
                          styles.roleButtonText,
                          registerForm.watch('role') === 'partner' && styles.roleButtonTextActive,
                        ]}
                      >
                        Partner
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={registerForm.handleSubmit(handleRegister)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.linkText}>
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#6C757D',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  button: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    padding: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#3A8DFF',
    fontSize: 14,
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: '#3A8DFF',
    backgroundColor: '#F0F8FF',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C757D',
  },
  roleButtonTextActive: {
    color: '#3A8DFF',
  },
});