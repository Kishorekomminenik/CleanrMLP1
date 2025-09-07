import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Types
interface User {
  id: string;
  email: string;
  role: 'customer' | 'partner' | 'owner';
  partner_status?: 'pending' | 'verified';
  mfa_enabled: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; mfa_required?: boolean; dev_mfa_code?: string; error?: string }>;
  register: (email: string, password: string, role: string) => Promise<{ success: boolean; error?: string }>;
  verifyMFA: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
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
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        // Verify token with backend
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Token is invalid, remove it
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      }
    } catch (error) {
      console.error('Error checking existing token:', error);
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.mfa_required) {
          return { success: true, mfa_required: true, dev_mfa_code: data.dev_mfa_code };
        } else {
          // Regular login success
          await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
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

  const register = async (email: string, password: string, role: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const verifyMFA = async (email: string, code: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, mfa_code: code }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'MFA verification failed' };
      }
    } catch (error) {
      console.error('MFA verification error:', error);
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
        await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
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