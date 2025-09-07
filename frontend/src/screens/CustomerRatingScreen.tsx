import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';

interface RatingContext {
  bookingId: string;
  total: number;
  currency: string;
  partner: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
  };
  eligibleTipPresets: number[];
  alreadyRated: {
    customer: boolean;
    partner: boolean;
  };
}

interface CustomerRatingScreenProps {
  bookingId: string;
  onComplete: () => void;
  onIssue: () => void;
}

const CustomerRatingScreen: React.FC<CustomerRatingScreenProps> = ({
  bookingId,
  onComplete,
  onIssue
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState<RatingContext | null>(null);
  
  // Rating state
  const [stars, setStars] = useState(0);
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [selectedTip, setSelectedTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [showCustomTip, setShowCustomTip] = useState(false);

  const backendUrl = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  const complimentOptions = [
    'On time',
    'Professional', 
    'Great attention',
    'Eco-friendly',
    'Went above & beyond'
  ];

  useEffect(() => {
    loadRatingContext();
  }, []);

  const loadRatingContext = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${backendUrl}/api/ratings/context/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const data: RatingContext = await response.json();
        setContext(data);
        
        // Check if already rated
        if (data.alreadyRated.customer) {
          Alert.alert(
            'Already Rated',
            'You have already submitted a rating for this service.',
            [{ text: 'OK', onPress: onComplete }]
          );
          return;
        }
      } else {
        Alert.alert('Error', 'Failed to load rating information');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load rating information');
      console.error('Load context error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStarPress = (rating: number) => {
    setStars(rating);
  };

  const handleComplimentToggle = (compliment: string) => {
    if (selectedCompliments.includes(compliment)) {
      setSelectedCompliments(selectedCompliments.filter(c => c !== compliment));
    } else {
      setSelectedCompliments([...selectedCompliments, compliment]);
    }
  };

  const handleTipSelect = (amount: number) => {
    if (amount === -1) {
      // Custom tip
      setShowCustomTip(true);
      setSelectedTip(0);
    } else {
      setSelectedTip(amount);
      setShowCustomTip(false);
      setCustomTip('');
    }
  };

  const getTipAmount = () => {
    if (showCustomTip && customTip) {
      return parseFloat(customTip) || 0;
    }
    return selectedTip;
  };

  const handleSubmit = async () => {
    if (stars === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    if (!context) return;

    setSubmitting(true);
    try {
      const tipAmount = getTipAmount();
      
      const requestData = {
        bookingId: context.bookingId,
        stars,
        compliments: selectedCompliments,
        comment: comment.trim() || undefined,
        tip: {
          amount: tipAmount,
          currency: context.currency
        },
        idempotencyKey: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      const response = await fetch(`${backendUrl}/api/ratings/customer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();
        
        let message = 'Thank you for your feedback!';
        if (tipAmount > 0) {
          message += ` Your tip of $${tipAmount.toFixed(2)} has been processed.`;
        }

        Alert.alert('Rating Submitted', message, [
          { text: 'OK', onPress: onComplete }
        ]);
      } else if (response.status === 402) {
        Alert.alert(
          'Tip Payment Failed',
          'Your rating was saved, but the tip payment failed. Please try again with a different payment method.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Retry', onPress: handleSubmit }
          ]
        );
      } else if (response.status === 409) {
        Alert.alert('Already Rated', 'You have already submitted a rating for this service.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Error', errorData.detail || 'Failed to submit rating');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
      console.error('Submit rating error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer} testID="rateCustStars">
        {[1, 2, 3, 4, 5].map((rating) => (
          <TouchableOpacity
            key={rating}
            style={styles.starButton}
            onPress={() => handleStarPress(rating)}
          >
            <Text style={[
              styles.star,
              { color: rating <= stars ? '#FFD700' : '#E1E5E9' }
            ]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const formatPrice = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A8DFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!context) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load rating information</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRatingContext}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} testID="rateCustHeader">
            How was your clean?
          </Text>
          <Text style={styles.partnerName}>
            Service by {context.partner.name}
          </Text>
        </View>

        {/* Star Rating */}
        <View style={styles.section}>
          {renderStars()}
          {stars > 0 && (
            <Text style={styles.ratingText}>
              {stars === 1 ? 'Poor' : 
               stars === 2 ? 'Fair' : 
               stars === 3 ? 'Good' : 
               stars === 4 ? 'Very Good' : 'Excellent'}
            </Text>
          )}
        </View>

        {/* Compliments */}
        {stars >= 4 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compliments</Text>
            <View style={styles.complimentsContainer} testID="rateCustCompliments">
              {complimentOptions.map((compliment) => (
                <TouchableOpacity
                  key={compliment}
                  style={[
                    styles.complimentChip,
                    selectedCompliments.includes(compliment) && styles.complimentChipSelected
                  ]}
                  onPress={() => handleComplimentToggle(compliment)}
                >
                  <Text style={[
                    styles.complimentText,
                    selectedCompliments.includes(compliment) && styles.complimentTextSelected
                  ]}>
                    {compliment}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Comment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anything to share?</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Tell us about your experience..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            maxLength={500}
            testID="rateCustComment"
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Tip Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a tip (optional)</Text>
          <Text style={styles.tipSubtitle}>
            Service total: {formatPrice(context.total)}
          </Text>
          
          <View style={styles.tipContainer} testID="rateCustTip">
            <View style={styles.tipPresets}>
              {context.eligibleTipPresets.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.tipButton,
                    selectedTip === preset && !showCustomTip && styles.tipButtonSelected
                  ]}
                  onPress={() => handleTipSelect(preset)}
                >
                  <Text style={[
                    styles.tipButtonText,
                    selectedTip === preset && !showCustomTip && styles.tipButtonTextSelected
                  ]}>
                    {preset === 0 ? 'No tip' : formatPrice(preset)}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.tipButton,
                  showCustomTip && styles.tipButtonSelected
                ]}
                onPress={() => handleTipSelect(-1)}
              >
                <Text style={[
                  styles.tipButtonText,
                  showCustomTip && styles.tipButtonTextSelected
                ]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {showCustomTip && (
              <View style={styles.customTipContainer}>
                <Text style={styles.customTipLabel}>Custom tip amount:</Text>
                <TextInput
                  style={styles.customTipInput}
                  placeholder="0.00"
                  value={customTip}
                  onChangeText={setCustomTip}
                  keyboardType="decimal-pad"
                  maxLength={10}
                />
                <Text style={styles.currencySymbol}>$</Text>
              </View>
            )}
          </View>
        </View>

        {/* Issue Link */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.issueLink} onPress={onIssue} testID="rateCustIssueLink">
            <Text style={styles.issueLinkText}>Had an issue? Report it</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.submitButton, (stars === 0 || submitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={stars === 0 || submitting}
          testID="rateCustSubmitBtn"
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  partnerName: {
    fontSize: 16,
    color: '#6C757D',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  starButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  star: {
    fontSize: 40,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A8DFF',
    textAlign: 'center',
  },
  complimentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  complimentChip: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  complimentChipSelected: {
    backgroundColor: '#3A8DFF',
    borderColor: '#3A8DFF',
  },
  complimentText: {
    fontSize: 14,
    color: '#6C757D',
  },
  complimentTextSelected: {
    color: '#FFFFFF',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  charCount: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'right',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E1E5E9',
    marginVertical: 16,
  },
  tipSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 16,
  },
  tipContainer: {
    gap: 16,
  },
  tipPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    minWidth: 80,
    alignItems: 'center',
  },
  tipButtonSelected: {
    backgroundColor: '#3A8DFF',
    borderColor: '#3A8DFF',
  },
  tipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C757D',
  },
  tipButtonTextSelected: {
    color: '#FFFFFF',
  },
  customTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customTipLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
  },
  customTipInput: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 100,
    textAlign: 'right',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#6C757D',
    marginLeft: -24,
    marginRight: 16,
  },
  issueLink: {
    alignItems: 'center',
  },
  issueLinkText: {
    fontSize: 16,
    color: '#DC3545',
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  submitButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CustomerRatingScreen;