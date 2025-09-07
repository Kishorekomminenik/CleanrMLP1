import React from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import AppShell from '../src/navigation/AppShell';

export default function MainApp() {
  const { user } = useAuth();

  if (!user) {
    return null; // Should not happen due to auth guard
  }

  return <AppShell />;
}