import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import CheckoutScreen from '../src/screens/CheckoutScreen';

export default function CheckoutRoute() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const handleBack = () => {
    router.back();
  };

  const handleSuccess = (bookingId: string) => {
    // Navigate to booking confirmation or dispatch screen
    console.log('Booking created successfully:', bookingId);
    // For now, navigate back to home
    router.push('/');
  };

  if (!user) {
    return null; // Should not happen due to auth guard
  }

  // Parse checkout data from params if available
  const checkoutData = params.checkoutData ? JSON.parse(params.checkoutData as string) : null;

  if (!checkoutData) {
    // If no checkout data, redirect back
    router.back();
    return null;
  }

  // Only customers can access checkout
  if (user.role !== 'customer') {
    router.back();
    return null;
  }

  return (
    <CheckoutScreen
      checkoutData={checkoutData}
      onSuccess={handleSuccess}
      onBack={handleBack}
    />
  );
}