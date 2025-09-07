import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import CustomerAddressScreen from '../src/screens/CustomerAddressScreen';
import PartnerServiceAreaScreen from '../src/screens/PartnerServiceAreaScreen';
import OwnerZonesScreen from '../src/screens/OwnerZonesScreen';

export default function AddressScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const handleBack = () => {
    router.back();
  };

  const handleContinue = (data: any) => {
    // Navigate to checkout/payment screen (PAGE-5-CHECKOUT)
    // For now, just log the data and go back
    console.log('Address data for checkout:', data);
    // TODO: Navigate to checkout screen when implemented
    router.back();
  };

  // Parse service summary from params if available
  const serviceSummary = params.serviceSummary ? JSON.parse(params.serviceSummary as string) : null;

  if (!user) {
    return null; // Should not happen due to auth guard
  }

  // Role-based rendering
  switch (user.role) {
    case 'customer':
      return (
        <CustomerAddressScreen
          serviceSummary={serviceSummary}
          onContinue={handleContinue}
          onBack={handleBack}
        />
      );
    
    case 'partner':
      return (
        <PartnerServiceAreaScreen onBack={handleBack} />
      );
    
    case 'owner':
      return (
        <OwnerZonesScreen onBack={handleBack} />
      );
    
    default:
      return null;
  }
}