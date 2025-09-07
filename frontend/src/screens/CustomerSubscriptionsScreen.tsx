import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Types
interface SubscriptionPlan {
  id: string;
  serviceType: string;
  frequency: string;
  nextScheduled: string;
  fareTotal: number;
  currency: string;
  status: string;
}

interface FarePreview {
  total: number;
  currency: string;
  surgeMultiplier: number;
  discount: number;
  discountPercent: number;
}

interface CreatePlanRequest {
  serviceType: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  address: any;
  timing: {
    dayOfWeek: number;
    timeSlot: string;
  };
  pricingSource: 'platform';
}

const CustomerSubscriptionsScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionPlan[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [farePreview, setFarePreview] = useState<FarePreview | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [selectedService, setSelectedService] = useState<string>('Cleaning');
  const [selectedFrequency, setSelectedFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [selectedDay, setSelectedDay] = useState<number>(1); // Monday
  const [selectedTime, setSelectedTime] = useState<string>('09:00');

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  const serviceTypes = ['Cleaning', 'Lawn Care', 'Dog Walking'];
  const frequencies = [
    { key: 'weekly', label: 'Weekly', discount: 15 },
    { key: 'biweekly', label: 'Bi-weekly', discount: 10 },
    { key: 'monthly', label: 'Monthly', discount: 5 },
  ];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

  // Load subscriptions
  const loadSubscriptions = useCallback(async (isRefresh: boolean = false) => {
    if (!user?.token) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(`${BACKEND_URL}/api/subscriptions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.items || []);
      } else {
        Alert.alert('Error', 'Failed to load subscriptions');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, BACKEND_URL]);

  // Get fare preview
  const getFarePreview = useCallback(async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/pricing/quote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType: selectedService,
          dwellingType: 'apartment',
          bedrooms: 2,
          bathrooms: 1,
          timing: { when: 'scheduled' },
          subscription: {
            frequency: selectedFrequency,
            applyDiscount: true
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const frequencyData = frequencies.find(f => f.key === selectedFrequency);
        const discount = frequencyData ? frequencyData.discount : 0;
        
        setFarePreview({
          total: data.total,
          currency: data.currency,
          surgeMultiplier: data.surge?.active ? data.surge.multiplier : 1,
          discount: data.total * (discount / 100),
          discountPercent: discount
        });
      }
    } catch (err) {
      console.error('Failed to get fare preview:', err);
    }
  }, [user?.token, BACKEND_URL, selectedService, selectedFrequency]);

  // Create subscription
  const createSubscription = async () => {
    if (!user?.token) return;

    try {
      setCreating(true);
      
      const response = await fetch(`${BACKEND_URL}/api/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType: selectedService,
          frequency: selectedFrequency,
          address: {
            line1: '123 Demo Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105'
          },
          timing: {
            dayOfWeek: selectedDay,
            timeSlot: selectedTime
          },
          pricingSource: 'platform'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', 'Subscription created successfully!');
        setShowCreateModal(false);
        loadSubscriptions();
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to create subscription');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setCreating(false);
    }
  };

  // Update preview when form changes
  useEffect(() => {
    if (showCreateModal) {
      getFarePreview();
    }
  }, [selectedService, selectedFrequency, showCreateModal, getFarePreview]);

  // Load data on mount
  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const onRefresh = useCallback(() => {
    loadSubscriptions(true);
  }, [loadSubscriptions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading && subscriptions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Loading subscriptions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Subscriptions</Text>
          <Text style={styles.subtitle}>Recurring services with discounts</Text>
        </View>

        {/* Pricing Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <View style={styles.infoContent}>
            <Text testID="subPricingInfo" style={styles.infoTitle}>
              Price auto-calculated by SHINE pricing
            </Text>
            <Text style={styles.infoText}>
              Save up to 15% with weekly subscriptions. All prices calculated by our platform.
            </Text>
          </View>
        </View>

        {/* Active Subscriptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Subscriptions</Text>
          
          {subscriptions.length > 0 ? (
            subscriptions.map((subscription) => (
              <View key={subscription.id} style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Text style={styles.subscriptionService}>{subscription.serviceType}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{subscription.status}</Text>
                  </View>
                </View>
                <Text style={styles.subscriptionFrequency}>
                  {subscription.frequency} • Next: {subscription.nextScheduled}
                </Text>
                <View style={styles.subscriptionFooter}>
                  <Text style={styles.subscriptionPrice}>
                    {formatCurrency(subscription.fareTotal)}
                  </Text>
                  <TouchableOpacity style={styles.manageButton}>
                    <Text style={styles.manageButtonText}>Manage</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#6C757D" />
              <Text style={styles.emptyTitle}>No subscriptions yet</Text>
              <Text style={styles.emptyText}>
                Create a subscription to save on recurring services
              </Text>
            </View>
          )}
        </View>

        {/* Create Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>Create Subscription</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Create Subscription Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Subscription</Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Service Type */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Service</Text>
              <View style={styles.optionsGrid}>
                {serviceTypes.map((service) => (
                  <TouchableOpacity
                    key={service}
                    style={[
                      styles.optionButton,
                      selectedService === service && styles.optionButtonActive
                    ]}
                    onPress={() => setSelectedService(service)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedService === service && styles.optionTextActive
                    ]}>
                      {service}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Frequency */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Frequency</Text>
              <View style={styles.optionsGrid}>
                {frequencies.map((freq) => (
                  <TouchableOpacity
                    key={freq.key}
                    style={[
                      styles.frequencyButton,
                      selectedFrequency === freq.key && styles.optionButtonActive
                    ]}
                    onPress={() => setSelectedFrequency(freq.key as any)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedFrequency === freq.key && styles.optionTextActive
                    ]}>
                      {freq.label}
                    </Text>
                    <Text style={[
                      styles.discountText,
                      selectedFrequency === freq.key && styles.discountTextActive
                    ]}>
                      Save {freq.discount}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Schedule */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Schedule</Text>
              <View style={styles.scheduleRow}>
                <View style={styles.scheduleItem}>
                  <Text style={styles.scheduleLabel}>Day</Text>
                  <TouchableOpacity style={styles.scheduleButton}>
                    <Text style={styles.scheduleButtonText}>{dayNames[selectedDay]}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.scheduleItem}>
                  <Text style={styles.scheduleLabel}>Time</Text>
                  <TouchableOpacity style={styles.scheduleButton}>
                    <Text style={styles.scheduleButtonText}>{selectedTime}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Fare Preview */}
            {farePreview && (
              <View style={styles.farePreviewContainer}>
                <Text style={styles.farePreviewTitle}>Estimated Pricing</Text>
                <View testID="subFarePreview" style={styles.farePreview}>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Base fare</Text>
                    <Text style={styles.fareAmount}>
                      {formatCurrency(farePreview.total + farePreview.discount)}
                    </Text>
                  </View>
                  {farePreview.discountPercent > 0 && (
                    <View style={styles.fareRow}>
                      <Text style={styles.fareLabel}>
                        {frequencies.find(f => f.key === selectedFrequency)?.label} discount ({farePreview.discountPercent}%)
                      </Text>
                      <Text style={styles.fareDiscount}>
                        -{formatCurrency(farePreview.discount)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.fareRow, styles.fareTotal]}>
                    <Text style={styles.fareTotalLabel}>Total per visit</Text>
                    <Text style={styles.fareTotalAmount}>
                      {formatCurrency(farePreview.total)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.fareNote}>
                  Estimated total (discount included). Final price may vary with surge.
                </Text>
              </View>
            )}

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createSubscriptionButton, creating && styles.buttonDisabled]}
              onPress={createSubscription}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createSubscriptionButtonText}>Create Subscription</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  subscriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionService: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  statusBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  subscriptionFrequency: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  subscriptionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  manageButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageButtonText: {
    color: '#3A8DFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  emptyText: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  buttonContainer: {
    padding: 16,
  },
  createButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  modalSpacer: {
    width: 60,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  optionsGrid: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#3A8DFF',
    borderColor: '#3A8DFF',
  },
  optionText: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  frequencyButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  discountText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  discountTextActive: {
    color: '#FFFFFF',
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scheduleItem: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  scheduleButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  scheduleButtonText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  farePreviewContainer: {
    marginBottom: 24,
  },
  farePreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  farePreview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  fareAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  fareDiscount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  fareTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
  },
  fareTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  fareTotalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A8DFF',
    fontFamily: 'Inter',
  },
  fareNote: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  createSubscriptionButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  createSubscriptionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CustomerSubscriptionsScreen;