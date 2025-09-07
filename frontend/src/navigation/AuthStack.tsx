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
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
  onHide: () => void;
}

function Toast({ message, type, visible, onHide }: ToastProps) {
  React.useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <View style={[styles.toast, type === 'error' ? styles.toastError : styles.toastSuccess]}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

export default function AuthStack() {
  const { login, register, verifyMFA, resetPasswordStart, resetPasswordVerify } = useAuth();
  
  // UI State
  const [selectedRole, setSelectedRole] = useState<'customer' | 'partner'>('customer');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  
  // Form Data
  const [loginData, setLoginData] = useState({ identifier: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    email: '', 
    username: '', 
    password: '', 
    confirmPassword: '', 
    phone: '',
    acceptTos: false 
  });
  
  // Reset Flow
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'otp' | 'password'>('email');
  const [resetData, setResetData] = useState({ 
    emailOrPhone: '', 
    otp: '', 
    newPassword: '',
    channel: '' 
  });
  
  // MFA Flow
  const [mfaModalVisible, setMfaModalVisible] = useState(false);
  const [mfaData, setMfaData] = useState({ userId: '', code: '', devCode: '' });
  
  // Toast State
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', visible: false });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  // Validation Functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateUsername = (username: string) => {
    if (!username) return true; // Optional field
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
  };

  const validatePassword = (password: string) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{}:;'"<>,.?/]).{8,64}$/;
    return passwordRegex.test(password);
  };

  const validatePhone = (phone: string) => {
    if (!phone) return true; // Optional field
    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    return phoneRegex.test(phone);
  };

  // Auth Handlers
  const handleLogin = async () => {
    if (!loginData.identifier || !loginData.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await login(loginData.identifier, loginData.password, selectedRole);
      if (result.success) {
        if (result.mfa_required) {
          setMfaData({ 
            userId: result.user_id || '', 
            code: '', 
            devCode: result.dev_mfa_code || '' 
          });
          setMfaModalVisible(true);
          showToast(`MFA code required${result.dev_mfa_code ? ` (Dev: ${result.dev_mfa_code})` : ''}`, 'success');
        } else {
          showToast('Login successful!', 'success');
        }
      } else {
        showToast(result.error || 'Login failed', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    // Validation
    if (!signupData.email || !signupData.password || !signupData.confirmPassword) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (!validateEmail(signupData.email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    if (!validateUsername(signupData.username)) {
      showToast('Username must be 3-30 letters/numbers/underscore', 'error');
      return;
    }

    if (!validatePassword(signupData.password)) {
      showToast('Password must be 8-64 chars with uppercase, lowercase, digit, and special character', 'error');
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (!validatePhone(signupData.phone)) {
      showToast('Phone number must be valid E.164 format (e.g., +14155552671)', 'error');
      return;
    }

    if (!signupData.acceptTos) {
      showToast('You must accept the Terms of Service and Privacy Policy', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        email: signupData.email,
        username: signupData.username || undefined,
        password: signupData.password,
        role: selectedRole,
        phone: signupData.phone || undefined,
        acceptTos: signupData.acceptTos
      });

      if (result.success) {
        showToast('Account created successfully!', 'success');
      } else {
        showToast(result.error || 'Registration failed', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMFA = async () => {
    if (!mfaData.code) {
      showToast('Please enter the MFA code', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyMFA(mfaData.userId, mfaData.code);
      if (result.success) {
        showToast('Login successful!', 'success');
        setMfaModalVisible(false);
      } else {
        showToast(result.error || 'MFA verification failed', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetStart = async () => {
    if (!resetData.emailOrPhone) {
      showToast('Please enter your email or phone number', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordStart(resetData.emailOrPhone);
      if (result.success) {
        setResetData(prev => ({ ...prev, channel: result.channel || '' }));
        setResetStep('otp');
        showToast(`OTP sent via ${result.channel}`, 'success');
      } else {
        showToast(result.error || 'Failed to send OTP', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async () => {
    if (!resetData.otp || !resetData.newPassword) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (!validatePassword(resetData.newPassword)) {
      showToast('Password must be 8-64 chars with uppercase, lowercase, digit, and special character', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordVerify(resetData.emailOrPhone, resetData.otp, resetData.newPassword);
      if (result.success) {
        showToast('Password reset successful!', 'success');
        setResetModalVisible(false);
        setResetStep('email');
        setResetData({ emailOrPhone: '', otp: '', newPassword: '', channel: '' });
      } else {
        showToast(result.error || 'Reset verification failed', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header with Logo */}
          <View style={styles.header}>
            <View style={styles.logoContainer} testID="authLogo">
              <Text style={styles.logoText}>SHINE</Text>
            </View>
          </View>

          {/* Role Tabs */}
          <View style={styles.roleTabs} testID="authRoleTabs">
            <TouchableOpacity
              style={[styles.roleTab, selectedRole === 'customer' && styles.roleTabActive]}
              onPress={() => setSelectedRole('customer')}
            >
              <Text style={[styles.roleTabText, selectedRole === 'customer' && styles.roleTabTextActive]}>
                Customer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleTab, selectedRole === 'partner' && styles.roleTabActive]}
              onPress={() => setSelectedRole('partner')}
            >
              <Text style={[styles.roleTabText, selectedRole === 'partner' && styles.roleTabTextActive]}>
                Partner
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auth Mode Tabs */}
          <View style={styles.authTabs} testID="authModeTabs">
            <TouchableOpacity
              style={[styles.authTab, authMode === 'signin' && styles.authTabActive]}
              onPress={() => setAuthMode('signin')}
            >
              <Text style={[styles.authTabText, authMode === 'signin' && styles.authTabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authTab, authMode === 'signup' && styles.authTabActive]}
              onPress={() => setAuthMode('signup')}
            >
              <Text style={[styles.authTabText, authMode === 'signup' && styles.authTabTextActive]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <View style={styles.form}>
            {authMode === 'signin' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email or Username"
                  value={loginData.identifier}
                  onChangeText={(text) => setLoginData(prev => ({ ...prev, identifier: text }))}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  testID="authIdentifierInput"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={loginData.password}
                  onChangeText={(text) => setLoginData(prev => ({ ...prev, password: text }))}
                  secureTextEntry
                  testID="authPasswordInput"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  testID="authPrimaryButton"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Log In</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setResetModalVisible(true)}
                  testID="authForgotLink"
                >
                  <Text style={styles.linkText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setAuthMode('signup')}
                  testID="authSwitchToSignup"
                >
                  <Text style={styles.linkText}>New here? Create Account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={signupData.email}
                  onChangeText={(text) => setSignupData(prev => ({ ...prev, email: text }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="authEmailInput"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Username (optional)"
                  value={signupData.username}
                  onChangeText={(text) => setSignupData(prev => ({ ...prev, username: text }))}
                  autoCapitalize="none"
                  testID="authUsernameInput"
                />
                <Text style={styles.helperText}>3–30 letters/numbers/underscore</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={signupData.password}
                  onChangeText={(text) => setSignupData(prev => ({ ...prev, password: text }))}
                  secureTextEntry
                  testID="authSignupPasswordInput"
                />
                <Text style={styles.helperText}>8–64: upper/lower/digit/special</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={signupData.confirmPassword}
                  onChangeText={(text) => setSignupData(prev => ({ ...prev, confirmPassword: text }))}
                  secureTextEntry
                  testID="authConfirmPasswordInput"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Phone (optional, E.164)"
                  value={signupData.phone}
                  onChangeText={(text) => setSignupData(prev => ({ ...prev, phone: text }))}
                  keyboardType="phone-pad"
                  testID="authPhoneInput"
                />

                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setSignupData(prev => ({ ...prev, acceptTos: !prev.acceptTos }))}
                  testID="authTosCheckbox"
                >
                  <View style={[styles.checkbox, signupData.acceptTos && styles.checkboxChecked]}>
                    {signupData.acceptTos && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxText}>I accept the Terms & Privacy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSignup}
                  disabled={loading}
                  testID="authPrimaryButton"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setAuthMode('signin')}
                  testID="authSwitchToLogin"
                >
                  <Text style={styles.linkText}>Have an account? Sign In</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Reset Password Modal */}
      <Modal
        visible={resetModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setResetModalVisible(false)}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent} testID="authResetSheet">
            {resetStep === 'email' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email or Phone (+countrycode...)"
                  value={resetData.emailOrPhone}
                  onChangeText={(text) => setResetData(prev => ({ ...prev, emailOrPhone: text }))}
                  testID="resetEmailOrPhoneInput"
                />
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleResetStart}
                  disabled={loading}
                  testID="resetSendOtpBtn"
                >
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'otp' && (
              <>
                <Text style={styles.modalDescription}>
                  Enter the OTP sent to your {resetData.channel}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter OTP"
                  value={resetData.otp}
                  onChangeText={(text) => setResetData(prev => ({ ...prev, otp: text }))}
                  keyboardType="number-pad"
                  testID="resetOtpInput"
                />
                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  value={resetData.newPassword}
                  onChangeText={(text) => setResetData(prev => ({ ...prev, newPassword: text }))}
                  secureTextEntry
                  testID="resetNewPasswordInput"
                />
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleResetVerify}
                  disabled={loading}
                  testID="resetVerifyBtn"
                >
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify & Update Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={handleResetStart}
                  testID="resetResendLink"
                >
                  <Text style={styles.linkText}>Resend OTP</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* MFA Modal */}
      <Modal
        visible={mfaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMfaModalVisible(false)}
      >
        <View style={styles.mfaOverlay}>
          <View style={styles.mfaModal} testID="ownerMfaModal">
            <Text style={styles.mfaTitle}>Enter MFA Code</Text>
            <Text style={styles.mfaDescription}>
              Check your device for the 6-digit code
              {mfaData.devCode && ` (Dev: ${mfaData.devCode})`}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              value={mfaData.code}
              onChangeText={(text) => setMfaData(prev => ({ ...prev, code: text }))}
              keyboardType="number-pad"
              maxLength={6}
              testID="mfaCodeInput"
            />
            <View style={styles.mfaActions}>
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleMFA}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setMfaModalVisible(false)}
              >
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay} testID="loadingOverlay">
          <ActivityIndicator size="large" color="#3A8DFF" />
        </View>
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
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
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3A8DFF',
    fontFamily: 'Inter',
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: '#F2F4F7',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6C757D',
  },
  roleTabTextActive: {
    color: '#3A8DFF',
  },
  authTabs: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  authTab: {
    flex: 1,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  authTabActive: {
    borderBottomColor: '#3A8DFF',
  },
  authTabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6C757D',
  },
  authTabTextActive: {
    color: '#3A8DFF',
  },
  form: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#F2F4F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#FAFBFC',
  },
  helperText: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#F2F4F7',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3A8DFF',
    borderColor: '#3A8DFF',
  },
  checkboxText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
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
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
  },
  mfaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mfaModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 24,
    minWidth: 300,
  },
  mfaTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  mfaDescription: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
  },
  mfaActions: {
    gap: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 12,
    zIndex: 1000,
  },
  toastSuccess: {
    backgroundColor: '#10B981',
  },
  toastError: {
    backgroundColor: '#EF4444',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});