import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { ScreenWatermark } from '../components/Watermark';
import MockApiService from '../services/mockData';
import Constants from 'expo-constants';

// Types
interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp: string;
  isDefault: boolean;
}

interface PriceBreakdownItem {
  label: string;
  amount: number;
}

interface PricingQuote {
  fare: {
    subtotal: number;
    surgeMultiplier: number;
    tax: number;
    total: number;
    currency: string;
  };
  breakdown: PriceBreakdownItem[];
  surge: {
    active: boolean;
    reason?: string;
    multiplier?: number;
  };
  estimateId: string;
  pricingEngineVersion: string;
}

interface CheckoutData {
  service: any;
  address: any;
  access: any;
  saveAddress: boolean;
  eta: any;
}

interface CheckoutScreenProps {
  checkoutData: CheckoutData;
  onSuccess: (bookingId: string) => void;
  onBack: () => void;
}

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  checkoutData,
  onSuccess,
  onBack
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [estimateUpdated, setEstimateUpdated] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  
  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  
  // Pricing state
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdownItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [promoCode, setPromoCode] = useState('');
  const [useCredits, setUseCredits] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [creditsApplied, setCreditsApplied] = useState(0);
  
  // Card addition state
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCvc, setNewCardCvc] = useState('');
  const [addingCard, setAddingCard] = useState(false);

  const backendUrl = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  // Fetch pricing quote
  const fetchPricingQuote = async () => {
    if (!user?.token) return;

    try {
      setQuoteLoading(true);
      const url = `${backendUrl}/pricing/quote`;
      
      const quoteRequest = {
        serviceType: checkoutData.service.type || 'Deep Clean',
        dwellingType: checkoutData.service.dwellingType || 'House',
        bedrooms: checkoutData.service.bedrooms || 3,
        bathrooms: checkoutData.service.bathrooms || 2,
        timing: { when: 'now' }, // For surge pricing
        address: checkoutData.address
      };

      let response;
      if (MockApiService.shouldUseMock(url)) {
        response = await MockApiService.fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(quoteRequest)
        });
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(quoteRequest)
        });
      }

      if (response.ok) {
        const quoteData = await response.json();
        setQuote(quoteData);
      } else {
        Alert.alert('Error', 'Failed to get pricing quote');
      }
    } catch (err) {
      console.error('Failed to fetch pricing quote:', err);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setQuoteLoading(false);
    }
  };

  // Initialize quote on mount
  useEffect(() => {
    fetchPricingQuote();
  }, []);

  useEffect(() => {
    loadPaymentMethods();
    calculateInitialPricing();
  }, []);

  const loadPaymentMethods = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${backendUrl}/api/billing/methods`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.methods || []);
        
        // Auto-select default payment method
        const defaultMethod = data.methods?.find((m: PaymentMethod) => m.isDefault);
        if (defaultMethod) {
          setSelectedPaymentMethod(defaultMethod.id);
        }
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    }
  };

  const calculateInitialPricing = () => {
    // Calculate initial pricing from service data
    const service = checkoutData.service;
    const quote = service.quote;
    
    const initialBreakdown = [
      { label: 'Base Service', amount: quote.price * 0.7 },
      { label: 'Rooms', amount: quote.price * 0.2 },
      { label: 'Tax', amount: quote.price * 0.08875 },
      { label: 'Total', amount: quote.price }
    ];
    
    if (quote.surge?.active) {
      initialBreakdown.splice(-2, 0, {
        label: `Surge (${quote.surge.multiplier}x)`,
        amount: quote.price * (quote.surge.multiplier - 1)
      });
    }
    
    setPriceBreakdown(initialBreakdown);
    setTotal(quote.price);
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim() || !user?.token) return;

    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/pricing/promo/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteId: checkoutData.service.quote.quoteId,
          code: promoCode.toUpperCase(),
          useCredits
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPriceBreakdown(data.breakdown);
        setTotal(data.total);
        setPromoApplied(data.promoApplied);
        setCreditsApplied(data.creditsApplied);
        Alert.alert('Success', 'Promo code applied successfully!');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Invalid promo code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to apply promo code');
      console.error('Promo code error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPaymentMethod = async () => {
    if (!newCardNumber || !newCardExpiry || !newCardCvc) {
      Alert.alert('Error', 'Please fill in all card details');
      return;
    }

    setAddingCard(true);
    try {
      // Mock card addition (in real app, would use Stripe Elements)
      const mockPaymentMethodId = `pm_${Date.now()}`;
      
      const response = await fetch(`${backendUrl}/api/billing/methods`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethodId: mockPaymentMethodId
        })
      });

      if (response.ok) {
        // Add to local state
        const newMethod: PaymentMethod = {
          id: mockPaymentMethodId,
          brand: 'visa',
          last4: newCardNumber.slice(-4),
          exp: newCardExpiry,
          isDefault: paymentMethods.length === 0
        };
        
        setPaymentMethods([...paymentMethods, newMethod]);
        setSelectedPaymentMethod(newMethod.id);
        setShowAddCardModal(false);
        
        // Clear form
        setNewCardNumber('');
        setNewCardExpiry('');
        setNewCardCvc('');
        
        Alert.alert('Success', 'Payment method added successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add payment method');
      console.error('Add card error:', error);
    } finally {
      setAddingCard(false);
    }
  };

  const confirmPayment = async () => {
    if (!selectedPaymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    setProcessingPayment(true);
    try {
      // Step 1: Create payment pre-authorization
      const preauthResponse = await fetch(`${backendUrl}/api/billing/preauth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: total,
          currency: 'usd',
          paymentMethodId: selectedPaymentMethod,
          captureStrategy: 'dual'
        })
      });

      if (!preauthResponse.ok) {
        const errorData = await preauthResponse.json();
        if (preauthResponse.status === 402) {
          Alert.alert('Payment Failed', 'Your card was declined. Please try a different payment method.');
          return;
        }
        throw new Error(errorData.detail || 'Payment failed');
      }

      const preauthData = await preauthResponse.json();
      
      // Handle SCA if required
      if (preauthData.requiresAction) {
        // In a real app, would present Stripe SCA flow
        const confirmResponse = await fetch(`${backendUrl}/api/billing/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentIntentId: preauthData.paymentIntentId
          })
        });

        if (!confirmResponse.ok) {
          throw new Error('Payment confirmation failed');
        }
      }

      // Step 2: Create booking
      const bookingResponse = await fetch(`${backendUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteId: checkoutData.service.quote.quoteId,
          service: {
            serviceType: checkoutData.service.serviceType,
            dwellingType: checkoutData.service.dwellingType,
            bedrooms: checkoutData.service.bedrooms,
            bathrooms: checkoutData.service.bathrooms,
            masters: checkoutData.service.masters,
            photoIds: checkoutData.service.photoIds || [],
            addons: [],
            timing: checkoutData.service.timing
          },
          address: checkoutData.address,
          access: checkoutData.access,
          totals: {
            subtotal: total * 0.9,
            tax: total * 0.1,
            total: total,
            currency: 'usd'
          },
          payment: {
            paymentIntentId: preauthData.paymentIntentId
          },
          applyCredits: useCredits,
          promoCode: promoApplied ? promoCode : undefined
        })
      });

      if (!bookingResponse.ok) {
        // If booking fails, attempt to void the pre-auth
        try {
          await fetch(`${backendUrl}/api/billing/void`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${user.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              paymentIntentId: preauthData.paymentIntentId
            })
          });
        } catch (voidError) {
          console.error('Failed to void pre-auth:', voidError);
        }

        const errorData = await bookingResponse.json();
        throw new Error(errorData.detail || 'Booking creation failed');
      }

      const bookingData = await bookingResponse.json();
      
      // Success!
      Alert.alert(
        'Booking Confirmed!',
        `Your booking has been confirmed. Booking ID: ${bookingData.bookingId}`,
        [
          {
            text: 'OK',
            onPress: () => onSuccess(bookingData.bookingId)
          }
        ]
      );

    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong');
      console.error('Payment error:', error);
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatPrice = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getBrandIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      default: return '💳';
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Summary Bar */}
        <View style={styles.summaryBar} testID="chkSummaryBar">
          <Text style={styles.summaryTitle}>Review Your Booking</Text>
          <View style={styles.summaryDetails}>
            <Text style={styles.summaryText}>
              {checkoutData.service.serviceType} • {checkoutData.service.dwellingType}
            </Text>
            <Text style={styles.summaryText}>
              {checkoutData.service.bedrooms} bed, {checkoutData.service.bathrooms} bath
            </Text>
            <Text style={styles.summaryText}>
              {checkoutData.address.line1}, {checkoutData.address.city}
            </Text>
            <Text style={styles.summaryText}>
              {checkoutData.service.timing.when === 'now' ? 'ASAP' : `Scheduled: ${checkoutData.service.timing.scheduleAt}`}
            </Text>
          </View>
        </View>

        {/* Reprice Notice */}
        {estimateUpdated && (
          <View style={styles.repriceNotice} testID="chkRepriceNotice">
            <Text style={styles.repriceNoticeText}>
              Price changed due to updated surge. Please confirm new total.
            </Text>
          </View>
        )}

        {/* Price Breakdown */}
        <View style={styles.card} testID="chkBreakdown">
          <Text testID="chkFareBlock" style={styles.cardTitle}>Fare breakdown (SHINE pricing)</Text>
          {priceBreakdown.map((item, index) => (
            <View key={index} style={[
              styles.priceRow,
              item.label.includes('Surge') && { testID: 'chkSurgeRow' }
            ]}>
              <Text style={[
                styles.priceLabel,
                item.label === 'Total' && styles.priceLabelTotal
              ]}>
                {item.label}
              </Text>
              <Text style={[
                styles.priceAmount,
                item.label === 'Total' && styles.priceAmountTotal,
                item.amount < 0 && styles.priceAmountDiscount
              ]}>
                {formatPrice(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Promo Code */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Promo Code</Text>
          <View style={styles.promoRow} testID="chkPromoRow">
            <TextInput
              style={styles.promoInput}
              placeholder="Enter promo code"
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              testID="chkPromoInput"
            />
            <TouchableOpacity
              style={[styles.promoButton, loading && styles.buttonDisabled]}
              onPress={applyPromoCode}
              disabled={loading}
              testID="chkPromoApplyBtn"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.promoButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Credits Toggle */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.creditsRow}
            onPress={() => setUseCredits(!useCredits)}
            testID="chkUseCredits"
          >
            <View style={[styles.checkbox, useCredits && styles.checkboxChecked]}>
              {useCredits && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.creditsLabel}>
              Use SHINE credits if available ($25.00 available)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment Method */}
        <View style={styles.card} testID="chkPaymentCard">
          <Text style={styles.cardTitle}>Payment Method</Text>
          
          {/* Saved Cards */}
          <View testID="chkSavedCardsList">
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethodItem,
                  selectedPaymentMethod === method.id && styles.paymentMethodSelected
                ]}
                onPress={() => setSelectedPaymentMethod(method.id)}
                testID="chkSavedCardItem"
              >
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodIcon}>{getBrandIcon(method.brand)}</Text>
                  <View>
                    <Text style={styles.paymentMethodBrand}>
                      {method.brand.toUpperCase()} •••• {method.last4}
                    </Text>
                    <Text style={styles.paymentMethodExpiry}>Expires {method.exp}</Text>
                  </View>
                </View>
                {method.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Add Card Button */}
          <TouchableOpacity
            style={styles.addCardButton}
            onPress={() => setShowAddCardModal(true)}
            testID="chkAddCardBtn"
          >
            <Text style={styles.addCardButtonText}>+ Add New Card</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsText} testID="chkTermsText">
            By tapping Confirm, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Cancellation Policy</Text>.
          </Text>
        </View>

        {/* Hold Note */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteText} testID="chkHoldNote">
            💡 You won't be charged yet. We place a hold until your service is completed.
          </Text>
        </View>

        {/* Pricing Disclaimer */}
        <View style={styles.disclaimerContainer}>
          <Text testID="chkPricingDisclaimer" style={styles.disclaimerText}>
            Prices set by SHINE. Final total may vary with surge and add-ons.
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!selectedPaymentMethod || processingPayment) && styles.buttonDisabled
          ]}
          onPress={confirmPayment}
          disabled={!selectedPaymentMethod || processingPayment}
          testID="chkConfirmBtn"
        >
          {processingPayment ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>
              Confirm & Pre-Authorize {formatPrice(total)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Card Modal */}
      <Modal
        visible={showAddCardModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddCardModal(false)}
      >
        <View style={styles.modalContainer} testID="chkAddCardSheet">
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddCardModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Card</Text>
            <View style={styles.modalSpacer} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Card Number</Text>
            <TextInput
              style={styles.input}
              placeholder="1234 5678 9012 3456"
              value={newCardNumber}
              onChangeText={setNewCardNumber}
              keyboardType="numeric"
              maxLength={19}
              testID="chkStripeCardElement"
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Expiry</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/YY"
                  value={newCardExpiry}
                  onChangeText={setNewCardExpiry}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>CVC</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  value={newCardCvc}
                  onChangeText={setNewCardCvc}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveCardButton, addingCard && styles.buttonDisabled]}
              onPress={addPaymentMethod}
              disabled={addingCard}
              testID="chkSaveCardBtn"
            >
              {addingCard ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveCardButtonText}>Save Card</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Processing Overlay */}
      {processingPayment && (
        <View style={styles.processingOverlay} testID="chkProcessingOverlay">
          <View style={styles.processingModal}>
            <ActivityIndicator size="large" color="#3A8DFF" />
            <Text style={styles.processingText}>Processing Payment...</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  summaryBar: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  summaryDetails: {
    gap: 4,
  },
  summaryText: {
    fontSize: 14,
    color: '#6C757D',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
  priceLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  priceAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  priceAmountTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A8DFF',
  },
  priceAmountDiscount: {
    color: '#10B981',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  promoButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditsLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    marginLeft: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E1E5E9',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3A8DFF',
    borderColor: '#3A8DFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentMethodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    marginBottom: 8,
  },
  paymentMethodSelected: {
    borderColor: '#3A8DFF',
    backgroundColor: '#E8F4FD',
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentMethodBrand: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  paymentMethodExpiry: {
    fontSize: 12,
    color: '#6C757D',
  },
  defaultBadge: {
    backgroundColor: '#10B981',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  addCardButton: {
    borderWidth: 1,
    borderColor: '#3A8DFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addCardButtonText: {
    color: '#3A8DFF',
    fontSize: 14,
    fontWeight: '600',
  },
  termsContainer: {
    marginBottom: 16,
  },
  termsText: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: '#3A8DFF',
    textDecorationLine: 'underline',
  },
  noteContainer: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  noteText: {
    fontSize: 12,
    color: '#3A8DFF',
    textAlign: 'center',
  },
  disclaimerContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C757D',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#3A8DFF',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
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
    borderBottomColor: '#F1F3F4',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6C757D',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalSpacer: {
    width: 60,
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveCardButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveCardButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginTop: 16,
  },
});

export default CheckoutScreen;