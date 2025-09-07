import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';

interface DispatchStatus {
  state: 'searching' | 'assigned' | 'no_match' | 'cancelled';
  waitMins: number;
  zone: string;
  partner?: {
    id: string;
    name: string;
    rating: number;
    etaMinutes: number;
    distanceKm: number;
  };
}

interface CustomerDispatchScreenProps {
  bookingId: string;
  onAssigned: (partnerId: string) => void;
  onNoMatch: () => void;
  onCancel: () => void;
}

const CustomerDispatchScreen: React.FC<CustomerDispatchScreenProps> = ({
  bookingId,
  onAssigned,
  onNoMatch,
  onCancel
}) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<DispatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [pulseAnimation] = useState(new Animated.Value(1));

  const backendUrl = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    // Start pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Start polling for dispatch status
    const pollInterval = setInterval(pollDispatchStatus, 5000);
    pollDispatchStatus(); // Initial call

    return () => {
      clearInterval(pollInterval);
      pulseLoop.stop();
    };
  }, [bookingId]);

  const pollDispatchStatus = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${backendUrl}/api/dispatch/status/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const data: DispatchStatus = await response.json();
        setStatus(data);
        setLoading(false);

        // Handle state transitions
        if (data.state === 'assigned' && data.partner) {
          setTimeout(() => onAssigned(data.partner!.id), 2000); // Show partner briefly then navigate
        } else if (data.state === 'no_match') {
          setTimeout(() => onNoMatch(), 1000);
        }
      } else {
        console.error('Failed to fetch dispatch status:', response.status);
      }
    } catch (error) {
      console.error('Dispatch status error:', error);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel your booking? Cancellation fees may apply based on timing.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        { 
          text: 'Cancel Booking', 
          style: 'destructive',
          onPress: confirmCancel
        }
      ]
    );
  };

  const confirmCancel = async () => {
    if (!user?.token) return;

    setCancelling(true);
    try {
      const response = await fetch(`${backendUrl}/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Customer requested cancellation'
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        let message = 'Your booking has been cancelled.';
        if (data.fee) {
          message += ` A cancellation fee of $${data.fee.toFixed(2)} will be charged.`;
        } else if (data.refundCredit !== undefined) {
          message += ' No cancellation fee applied.';
        }

        Alert.alert('Booking Cancelled', message, [
          { text: 'OK', onPress: () => onCancel() }
        ]);
      } else if (response.status === 409) {
        Alert.alert('Cannot Cancel', 'Your booking cannot be cancelled as a partner has already been assigned.');
      } else {
        Alert.alert('Error', 'Failed to cancel booking. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel booking. Please try again.');
      console.error('Cancel booking error:', error);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="dispatchCustomerHeader">
          {status?.state === 'assigned' ? 'Pro Found!' : 'Finding your Pro…'}
        </Text>
      </View>

      {/* Map Pulse Animation */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder} testID="dispatchCustomerMapPulse">
          <Animated.View 
            style={[
              styles.pulseCircle,
              {
                transform: [{ scale: pulseAnimation }]
              }
            ]}
          >
            <View style={styles.centerDot} />
          </Animated.View>
          <Text style={styles.mapText}>📍 Your location</Text>
        </View>
      </View>

      {/* Status Information */}
      <View style={styles.statusContainer}>
        {status?.state === 'searching' && (
          <>
            <Text style={styles.waitText} testID="dispatchCustomerWait">
              Estimated wait ~{status.waitMins} min
            </Text>
            <View style={styles.searchList} testID="dispatchCustomerSearchList">
              <Text style={styles.searchItem}>🔍 Searching nearby professionals...</Text>
              <Text style={styles.searchItem}>📍 Zone: {status.zone}</Text>
              <Text style={styles.searchItem}>⏱️ We'll find the best match for you</Text>
            </View>
          </>
        )}

        {status?.state === 'assigned' && status.partner && (
          <View style={styles.partnerCard}>
            <Text style={styles.partnerFound}>✅ Professional Found!</Text>
            <Text style={styles.partnerName}>{status.partner.name}</Text>
            <Text style={styles.partnerDetails}>
              ⭐ {status.partner.rating}/5 • 🚗 {status.partner.distanceKm}km away
            </Text>
            <Text style={styles.partnerEta}>
              Arriving in ~{status.partner.etaMinutes} minutes
            </Text>
          </View>
        )}
      </View>

      {/* Cancellation Policy */}
      {status?.state === 'searching' && (
        <View style={styles.policyCard} testID="dispatchCustomerPolicyCard">
          <Text style={styles.policyTitle}>Cancellation Policy</Text>
          <View style={styles.policyItem}>
            <Text style={styles.policyText}>• Free cancellation within 5 minutes</Text>
          </View>
          <View style={styles.policyItem}>
            <Text style={styles.policyText}>• $5.00 fee for 5-10 minutes</Text>
          </View>
          <View style={styles.policyItem}>
            <Text style={styles.policyText}>• $10.00 fee after 10 minutes</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      {status?.state === 'searching' && (
        <View style={styles.buttonContainer} testID="dispatchCustomerButtons">
          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={cancelling}
            testID="dispatchCancelBtn"
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6C757D',
    marginTop: 16,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  mapPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(58, 141, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  centerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3A8DFF',
  },
  mapText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
  },
  statusContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  waitText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A8DFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  searchList: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  searchItem: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
    lineHeight: 20,
  },
  partnerCard: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  partnerFound: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  partnerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  partnerDetails: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
  },
  partnerEta: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A8DFF',
  },
  policyCard: {
    margin: 24,
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 12,
  },
  policyItem: {
    marginBottom: 4,
  },
  policyText: {
    fontSize: 14,
    color: '#92400E',
  },
  buttonContainer: {
    padding: 24,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CustomerDispatchScreen;