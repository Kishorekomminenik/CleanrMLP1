import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Types
interface User {
  id: string;
  email: string;
  username?: string;
  role: 'customer' | 'partner' | 'owner';
  partner_status?: 'pending' | 'verified';
  mfa_enabled: boolean;
  phone?: string;
}

interface SignupData {
  email: string;
  username?: string;
  password: string;
  role: string;
  phone?: string;
  acceptTos: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string, roleHint?: string) => Promise<{ 
    success: boolean; 
    mfa_required?: boolean; 
    user_id?: string;
    dev_mfa_code?: string; 
    error?: string 
  }>;
  register: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  verifyMFA: (userId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordStart: (emailOrPhone: string) => Promise<{ success: boolean; channel?: string; error?: string }>;
  resetPasswordVerify: (emailOrPhone: string, otp: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'auth_token';

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on app start
  useEffect(() => {
    checkExistingToken();
  }, []);

  const checkExistingToken = async () => {
    try {
      console.log('Checking existing token...');
      console.log('Backend URL:', BACKEND_URL);
      
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      console.log('Retrieved token:', token ? 'Token exists' : 'No token found');
      
      if (token) {
        console.log('Verifying token with backend...');
        // Verify token with backend
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('Token verification response status:', response.status);

        if (response.ok) {
          const userData = await response.json();
          console.log('User data retrieved:', userData.email);
          setUser(userData);
        } else {
          // Token is invalid, remove it
          console.log('Token invalid, removing...');
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      } else {
        console.log('No existing token found');
      }
    } catch (error) {
      console.error('Error checking existing token:', error);
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const login = async (identifier: string, password: string, roleHint?: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          identifier: identifier.trim(), 
          password, 
          role_hint: roleHint 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.mfa_required) {
          return { 
            success: true, 
            mfa_required: true, 
            user_id: data.user_id,
            dev_mfa_code: data.dev_mfa_code 
          };
        } else {
          // Regular login success
          await AsyncStorage.setItem(TOKEN_KEY, data.token);
          setUser(data.user);
          return { success: true };
        }
      } else {
        return { success: false, error: data.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (data: SignupData) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email.trim(),
          username: data.username?.trim() || undefined,
          password: data.password,
          role: data.role,
          phone: data.phone?.trim() || undefined,
          accept_tos: data.acceptTos
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem(TOKEN_KEY, responseData.token);
        setUser(responseData.user);
        return { success: true };
      } else {
        return { success: false, error: responseData.detail || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const verifyMFA = async (userId: string, code: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, code }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.token && data.user) {
          await AsyncStorage.setItem(TOKEN_KEY, data.token);
          setUser(data.user);
        }
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'MFA verification failed' };
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const resetPasswordStart = async (emailOrPhone: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/reset/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_or_phone: emailOrPhone.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, channel: data.channel };
      } else {
        return { success: false, error: data.detail || 'Failed to send reset code' };
      }
    } catch (error) {
      console.error('Password reset start error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const resetPasswordVerify = async (emailOrPhone: string, otp: string, newPassword: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/reset/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email_or_phone: emailOrPhone.trim(), 
          otp: otp.trim(), 
          new_password: newPassword 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Password reset failed' };
      }
    } catch (error) {
      console.error('Password reset verify error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const switchRole = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        return { success: false, error: 'No authentication token' };
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/switch-role`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Role switch failed' };
      }
    } catch (error) {
      console.error('Role switch error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    verifyMFA,
    resetPasswordStart,
    resetPasswordVerify,
    logout,
    switchRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}