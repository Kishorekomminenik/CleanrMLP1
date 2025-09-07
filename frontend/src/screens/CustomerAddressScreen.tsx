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
  Switch,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import Constants from 'expo-constants';

// Types
interface ServiceSummary {
  serviceType: string;
  dwellingType: string;
  bedrooms: number;
  bathrooms: number;
  masters: number;
  timing: {
    when: 'now' | 'schedule';
    scheduleAt?: string;
  };
  quote: {
    quoteId: string;
    price: number;
    durationMinutes: number;
    surge?: {
      active: boolean;
      multiplier: number;
    };
  };
}

interface Address {
  id?: string;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
}

interface AutocompleteCandidate {
  placeId: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
}

interface ETAPreview {
  window: string;
  distanceKm: number;
}

interface CustomerAddressScreenProps {
  serviceSummary: ServiceSummary;
  onContinue: (data: any) => void;
  onBack: () => void;
}

const CustomerAddressScreen: React.FC<CustomerAddressScreenProps> = ({
  serviceSummary,
  onContinue,
  onBack
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteCandidate[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [etaPreview, setEtaPreview] = useState<ETAPreview | null>(null);
  const [loadingETA, setLoadingETA] = useState(false);

  // Address form state
  const [address, setAddress] = useState<Address>({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA',
    lat: 0,
    lng: 0
  });

  // Access details state
  const [entranceType, setEntranceType] = useState<string>('Front Desk');
  const [accessNotes, setAccessNotes] = useState('');
  const [preferences, setPreferences] = useState({
    hasPets: false,
    ecoProducts: false,
    contactless: false
  });
  const [saveToProfile, setSaveToProfile] = useState(false);

  const backendUrl = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    loadSavedAddresses();
  }, []);

  const loadSavedAddresses = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${backendUrl}/api/addresses`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSavedAddresses(data.addresses || []);
      }
    } catch (error) {
      console.error('Failed to load saved addresses:', error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 3) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/places/autocomplete?q=${encodeURIComponent(query)}`);
      
      if (response.ok) {
        const data = await response.json();
        setAutocompleteResults(data.candidates || []);
        setShowAutocomplete(true);
      }
    } catch (error) {
      console.error('Autocomplete failed:', error);
    }
  };

  const selectAddress = (selectedAddress: Address | AutocompleteCandidate) => {
    setAddress({
      line1: selectedAddress.line1,
      line2: selectedAddress.line2 || '',
      city: selectedAddress.city,
      state: selectedAddress.state,
      postalCode: selectedAddress.postalCode,
      country: selectedAddress.country,
      lat: selectedAddress.lat,
      lng: selectedAddress.lng
    });
    setSearchQuery('');
    setShowAutocomplete(false);
    loadETAPreview(selectedAddress.lat, selectedAddress.lng);
  };

  const loadETAPreview = async (lat: number, lng: number) => {
    if (!lat || !lng) return;

    setLoadingETA(true);
    try {
      const response = await fetch(`${backendUrl}/api/eta/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lat,
          lng,
          timing: serviceSummary.timing
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEtaPreview(data);
      }
    } catch (error) {
      console.error('ETA preview failed:', error);
    } finally {
      setLoadingETA(false);
    }
  };

  const saveAddress = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch(`${backendUrl}/api/addresses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          label: address.line1, // Default label
          ...address
        })
      });

      if (response.ok) {
        Alert.alert('Success', 'Address saved to your profile');
        loadSavedAddresses();
      } else if (response.status === 409) {
        Alert.alert('Info', 'This address is already saved in your profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save address');
      console.error('Save address failed:', error);
    }
  };

  const handleContinue = async () => {
    // Validate required fields
    if (!address.line1 || !address.city || !address.state || !address.postalCode) {
      Alert.alert('Error', 'Please fill in all required address fields');
      return;
    }

    if (!address.lat || !address.lng) {
      Alert.alert('Error', 'Please select an address from search or move the map pin');
      return;
    }

    setLoading(true);

    try {
      // Save address if requested
      if (saveToProfile) {
        await saveAddress();
      }

      // Prepare data for next screen
      const addressData = {
        service: serviceSummary,
        address,
        access: {
          entranceType,
          notes: accessNotes,
          hasPets: preferences.hasPets,
          ecoProducts: preferences.ecoProducts,
          contactless: preferences.contactless
        },
        saveAddress: saveToProfile,
        eta: etaPreview
      };

      onContinue(addressData);
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('Continue failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Service Summary */}
        <View style={styles.summaryCard} testID="addrServiceSummary">
          <Text style={styles.summaryTitle}>Service Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service:</Text>
            <Text style={styles.summaryValue}>{serviceSummary.serviceType}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rooms:</Text>
            <Text style={styles.summaryValue}>
              {serviceSummary.bedrooms} bed, {serviceSummary.bathrooms} bath
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration:</Text>
            <Text style={styles.summaryValue}>{formatDuration(serviceSummary.quote.durationMinutes)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price:</Text>
            <Text style={[styles.summaryValue, styles.price]}>{formatPrice(serviceSummary.quote.price)}</Text>
            {serviceSummary.quote.surge?.active && (
              <View style={styles.surgeBadge}>
                <Text style={styles.surgeText}>Surge {serviceSummary.quote.surge.multiplier}x</Text>
              </View>
            )}
          </View>
        </View>

        {/* Address Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search address"
            value={searchQuery}
            onChangeText={handleSearch}
            testID="addrSearchBar"
          />
          <Text style={styles.helper}>Street, city, or postal code</Text>
        </View>

        {/* Autocomplete Results */}
        {showAutocomplete && autocompleteResults.length > 0 && (
          <View style={styles.autocompleteContainer}>
            {autocompleteResults.map((candidate) => (
              <TouchableOpacity
                key={candidate.placeId}
                style={styles.autocompleteItem}
                onPress={() => selectAddress(candidate)}
              >
                <Text style={styles.autocompleteLabel}>{candidate.label}</Text>
                <Text style={styles.autocompleteDetail}>{candidate.city}, {candidate.state}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Saved Addresses */}
        {savedAddresses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <View testID="addrSavedList">
              {savedAddresses.map((savedAddr) => (
                <TouchableOpacity
                  key={savedAddr.id}
                  style={styles.savedAddressItem}
                  onPress={() => selectAddress(savedAddr)}
                  testID="addrSavedItem"
                >
                  <Text style={styles.savedAddressLabel}>{savedAddr.label || savedAddr.line1}</Text>
                  <Text style={styles.savedAddressDetail}>
                    {savedAddr.line1}, {savedAddr.city}, {savedAddr.state}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Address Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address Details</Text>
          <View style={styles.form} testID="addrForm">
            <TextInput
              style={styles.input}
              placeholder="Address line 1"
              value={address.line1}
              onChangeText={(text) => setAddress({...address, line1: text})}
              testID="addrLine1"
            />
            <TextInput
              style={styles.input}
              placeholder="Address line 2 (optional)"
              value={address.line2}
              onChangeText={(text) => setAddress({...address, line2: text})}
              testID="addrLine2"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="City"
                value={address.city}
                onChangeText={(text) => setAddress({...address, city: text})}
                testID="addrCity"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="State"
                value={address.state}
                onChangeText={(text) => setAddress({...address, state: text})}
                testID="addrState"
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Postal Code"
                value={address.postalCode}
                onChangeText={(text) => setAddress({...address, postalCode: text})}
                testID="addrPostal"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Country"
                value={address.country}
                onChangeText={(text) => setAddress({...address, country: text})}
                testID="addrCountry"
              />
            </View>
          </View>
        </View>

        {/* Entrance Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entrance Type</Text>
          <View style={styles.segmentedControl} testID="addrEntranceType">
            {['Front Desk', 'Door Code', 'Meet Outside', 'Other'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.segmentButton,
                  entranceType === type && styles.segmentButtonActive
                ]}
                onPress={() => setEntranceType(type)}
              >
                <Text style={[
                  styles.segmentText,
                  entranceType === type && styles.segmentTextActive
                ]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Access Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Access Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Access codes, parking instructions, pets, etc."
            value={accessNotes}
            onChangeText={setAccessNotes}
            multiline
            numberOfLines={4}
            maxLength={500}
            testID="addrAccessNotes"
          />
          <Text style={styles.charCount}>{accessNotes.length}/500</Text>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View testID="addrPrefs">
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>I have pets</Text>
              <Switch
                value={preferences.hasPets}
                onValueChange={(value) => setPreferences({...preferences, hasPets: value})}
                testID="prefHasPets"
              />
            </View>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Prefer eco-friendly products</Text>
              <Switch
                value={preferences.ecoProducts}
                onValueChange={(value) => setPreferences({...preferences, ecoProducts: value})}
                testID="prefEcoProducts"
              />
            </View>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Contactless service</Text>
              <Switch
                value={preferences.contactless}
                onValueChange={(value) => setPreferences({...preferences, contactless: value})}
                testID="prefContactless"
              />
            </View>
          </View>
        </View>

        {/* ETA Preview */}
        {etaPreview && (
          <View style={styles.etaCard} testID="addrEtaCard">
            <Text style={styles.etaTitle}>ETA Preview</Text>
            {loadingETA ? (
              <ActivityIndicator size="small" color="#3A8DFF" />
            ) : (
              <>
                <Text style={styles.etaWindow}>{etaPreview.window}</Text>
                <Text style={styles.etaDistance}>{etaPreview.distanceKm}km away</Text>
              </>
            )}
          </View>
        )}

        {/* Save Address Option */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setSaveToProfile(!saveToProfile)}
            testID="addrSaveToProfile"
          >
            <View style={[styles.checkbox, saveToProfile && styles.checkboxChecked]}>
              {saveToProfile && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Save this address to my profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer} testID="addrButtons">
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          testID="addrBackBtn"
        >
          <Text style={styles.backButtonText}>Back</Text>  
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
          testID="addrContinueBtn"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
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
  summaryCard: {
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A8DFF',
  },
  surgeBadge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  surgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  helper: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 4,
  },
  autocompleteContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    marginBottom: 16,
  },
  autocompleteItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  autocompleteLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  autocompleteDetail: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 2,
  },
  savedAddressItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  savedAddressLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  savedAddressDetail: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 2,
  },
  form: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'right',
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#3A8DFF',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C757D',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  etaCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  etaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A8DFF',
    marginBottom: 8,
  },
  etaWindow: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  etaDistance: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E1E5E9',
    borderRadius: 4,
    marginRight: 12,
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
  checkboxLabel: {
    fontSize: 16,
    color: '#1A1A1A',
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
  continueButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#3A8DFF',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CustomerAddressScreen;