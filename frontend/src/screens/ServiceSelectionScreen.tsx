import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'auth_token';

interface Service {
  code: string;
  name: string;
  basePrice: number;
  defaults: {
    bedrooms?: number;
    bathrooms?: number;
  };
  desc: string;
}

interface Quote {
  quoteId: string;
  price: number;
  durationMinutes: number;
  surge: {
    active: boolean;
    multiplier: number;
  };
  breakdown: Array<{
    label: string;
    amount: number;
  }>;
}

export default function ServiceSelectionScreen() {
  const { user } = useAuth();
  
  // Catalog state
  const [services, setServices] = useState<Service[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  
  // Selection state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [dwellingType, setDwellingType] = useState<string>('House');
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [masters, setMasters] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [timing, setTiming] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  
  // Quote state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  
  // UI state
  const [showIncluded, setShowIncluded] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/services/catalog`);
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
        setCatalogError(null);
      } else {
        setCatalogError('Failed to load services');
      }
    } catch (error) {
      console.error('Error fetching catalog:', error);
      setCatalogError('Network error');
    } finally {
      setCatalogLoading(false);
    }
  };

  const addPhoto = async () => {
    try {
      // In a real app, this would open camera/gallery
      const response = await fetch(`${BACKEND_URL}/api/media/presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentType: 'image/jpeg' }),
      });

      if (response.ok) {
        const data = await response.json();
        setPhotos(prev => [...prev, data.fileId]);
        Alert.alert('Photo Added', `Photo ${data.fileId} added successfully`);
      } else {
        Alert.alert('Error', 'Failed to add photo');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getQuote = async () => {
    if (!selectedService) {
      Alert.alert('Error', 'Please select a service');
      return;
    }

    // Validate photo requirements
    if ((selectedService === 'deep' || selectedService === 'bathroom') && photos.length < 2) {
      Alert.alert('Photos Required', `${selectedService === 'deep' ? 'Deep Clean' : 'Bathroom-only'} requires at least 2 photos`);
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const quoteRequest = {
        serviceType: selectedService,
        dwellingType,
        bedrooms,
        bathrooms,
        masters,
        photoIds: photos,
        when: timing,
        scheduleAt: timing === 'schedule' ? scheduledDate : undefined,
      };

      const response = await fetch(`${BACKEND_URL}/api/pricing/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quoteRequest),
      });

      if (response.ok) {
        const data = await response.json();
        setQuote(data);
        setQuoteError(null);
      } else {
        const errorData = await response.json();
        setQuoteError(errorData.detail || 'Failed to get quote');
      }
    } catch (error) {
      console.error('Error getting quote:', error);
      setQuoteError('Network error');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleContinue = () => {
    if (!quote) {
      Alert.alert('Quote Required', 'Please get a quote before continuing');
      return;
    }

    // In a real app, this would navigate to PAGE-4-ADDRESS
    Alert.alert('Continue', 'Navigate to address & details page (PAGE-4-ADDRESS)');
  };

  const incrementCounter = (type: 'bedrooms' | 'bathrooms' | 'masters') => {
    const maxValues = { bedrooms: 10, bathrooms: 10, masters: 5 };
    
    switch (type) {
      case 'bedrooms':
        if (bedrooms < maxValues.bedrooms) setBedrooms(prev => prev + 1);
        break;
      case 'bathrooms':
        if (bathrooms < maxValues.bathrooms) setBathrooms(prev => prev + 1);
        break;
      case 'masters':
        if (masters < maxValues.masters) setMasters(prev => prev + 1);
        break;
    }
  };

  const decrementCounter = (type: 'bedrooms' | 'bathrooms' | 'masters') => {
    const minValues = { bedrooms: 0, bathrooms: 1, masters: 0 };
    
    switch (type) {
      case 'bedrooms':
        if (bedrooms > minValues.bedrooms) setBedrooms(prev => prev - 1);
        break;
      case 'bathrooms':
        if (bathrooms > minValues.bathrooms) setBathrooms(prev => prev - 1);
        break;
      case 'masters':
        if (masters > minValues.masters) setMasters(prev => prev - 1);
        break;
    }
  };

  const renderServiceCard = (service: Service) => (
    <TouchableOpacity
      key={service.code}
      style={[
        styles.serviceCard,
        selectedService === service.code && styles.serviceCardSelected,
      ]}
      onPress={() => setSelectedService(service.code)}
      testID={`svcCard${service.code.charAt(0).toUpperCase() + service.code.slice(1)}`}
    >
      <Text style={styles.serviceCardTitle}>{service.name}</Text>
      <Text style={styles.serviceCardDesc}>{service.desc}</Text>
      <Text style={styles.serviceCardPrice}>From ${service.basePrice}</Text>
    </TouchableOpacity>
  );

  const renderCounter = (
    label: string,
    value: number,
    type: 'bedrooms' | 'bathrooms' | 'masters',
    testID: string
  ) => (
    <View style={styles.counterContainer} testID={testID}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={styles.counterButton}
          onPress={() => decrementCounter(type)}
        >
          <Ionicons name="remove" size={20} color="#3A8DFF" />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity
          style={styles.counterButton}
          onPress={() => incrementCounter(type)}
        >
          <Ionicons name="add" size={20} color="#3A8DFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (catalogLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (catalogError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Service Unavailable</Text>
          <Text style={styles.errorText}>{catalogError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCatalog}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} testID="svcHeader">
            Choose your cleaning
          </Text>
        </View>

        {/* Service Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.serviceCards} testID="svcCardsRow">
            {services.map(renderServiceCard)}
          </View>
        </View>

        {/* What's Included Expander */}
        {selectedService && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.expanderHeader}
              onPress={() => setShowIncluded(!showIncluded)}
              testID="svcIncludedExpander"
            >
              <Text style={styles.expanderTitle}>What's included?</Text>
              <Ionicons 
                name={showIncluded ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#6C757D" 
              />
            </TouchableOpacity>
            {showIncluded && (
              <View style={styles.expanderContent}>
                <Text style={styles.expanderText}>
                  {services.find(s => s.code === selectedService)?.desc}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Dwelling Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dwelling Type</Text>
          <View style={styles.dwellingTypes} testID="dwellingPicker">
            {['House', 'Apartment', 'Condo', 'Office'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dwellingButton,
                  dwellingType === type && styles.dwellingButtonSelected,
                ]}
                onPress={() => setDwellingType(type)}
              >
                <Text
                  style={[
                    styles.dwellingButtonText,
                    dwellingType === type && styles.dwellingButtonTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Room Counters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rooms</Text>
          <View style={styles.counters} testID="roomsCounters">
            {renderCounter('Bedrooms', bedrooms, 'bedrooms', 'counterBedrooms')}
            {renderCounter('Bathrooms', bathrooms, 'bathrooms', 'counterBathrooms')}
            {renderCounter('Master BR', masters, 'masters', 'counterMasters')}
          </View>
        </View>

        {/* Photos Section */}
        <View style={styles.section} testID="photosSection">
          <Text style={styles.sectionTitle}>Before photos {(selectedService === 'deep' || selectedService === 'bathroom') && '(required)'}</Text>
          {(selectedService === 'deep' || selectedService === 'bathroom') && (
            <Text style={styles.photoInfo}>
              {selectedService === 'deep' ? 'Deep Clean' : 'Bathroom-only'} requires at least 2 photos.
            </Text>
          )}
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={addPhoto}
            testID="photosAddBtn"
          >
            <Ionicons name="camera" size={20} color="#3A8DFF" />
            <Text style={styles.addPhotoText}>Add Photos ({photos.length}/8)</Text>
          </TouchableOpacity>
          
          {photos.length > 0 && (
            <View style={styles.photoGrid} testID="photosGrid">
              {photos.map((photoId, index) => (
                <View key={photoId} style={styles.photoItem}>
                  <Text style={styles.photoId}>{photoId}</Text>
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quote Box */}
        <View style={styles.section}>
          <View style={styles.quoteBox} testID="quoteBox">
            <Text style={styles.quoteTitle}>Your quote</Text>
            
            {quoteLoading && (
              <View style={styles.quoteLoading}>
                <ActivityIndicator color="#3A8DFF" />
                <Text style={styles.quoteLoadingText}>Calculating...</Text>
              </View>
            )}
            
            {quoteError && (
              <View style={styles.quoteError}>
                <Text style={styles.quoteErrorText}>{quoteError}</Text>
                <TouchableOpacity style={styles.retryQuoteButton} onPress={getQuote}>
                  <Text style={styles.retryQuoteText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {quote && !quoteLoading && (
              <View style={styles.quoteDetails}>
                <View style={styles.quotePriceRow}>
                  <Text style={styles.quotePrice} testID="quotePrice">
                    ${quote.price}
                  </Text>
                  {quote.surge.active && (
                    <View style={styles.surgeBadge} testID="quoteSurgeBadge">
                      <Text style={styles.surgeBadgeText}>
                        Surge x{quote.surge.multiplier}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.quoteDuration} testID="quoteDuration">
                  Estimated duration: {Math.round(quote.durationMinutes / 60)}h {quote.durationMinutes % 60}m
                </Text>
                
                {/* Breakdown */}
                <View style={styles.breakdown}>
                  {quote.breakdown.map((item, index) => (
                    <View key={index} style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>{item.label}</Text>
                      <Text style={styles.breakdownAmount}>${item.amount.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.getQuoteButton, quoteLoading && styles.buttonDisabled]}
              onPress={getQuote}
              disabled={quoteLoading}
              testID="getQuoteBtn"
            >
              <Text style={styles.getQuoteButtonText}>
                {quote ? 'Update Quote' : 'Get Quote'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Timing */}
        <View style={styles.section} testID="timingSection">
          <Text style={styles.sectionTitle}>When</Text>
          <View style={styles.timingButtons}>
            <TouchableOpacity
              style={[
                styles.timingButton,
                timing === 'now' && styles.timingButtonSelected,
              ]}
              onPress={() => setTiming('now')}
              testID="timingNowBtn"
            >
              <Text
                style={[
                  styles.timingButtonText,
                  timing === 'now' && styles.timingButtonTextSelected,
                ]}
              >
                Now
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.timingButton,
                timing === 'schedule' && styles.timingButtonSelected,
              ]}
              onPress={() => setTiming('schedule')}
              testID="timingScheduleBtn"
            >
              <Text
                style={[
                  styles.timingButtonText,
                  timing === 'schedule' && styles.timingButtonTextSelected,
                ]}
              >
                Schedule
              </Text>
            </TouchableOpacity>
          </View>
          
          {timing === 'schedule' && (
            <TouchableOpacity
              style={styles.scheduleButton}
              onPress={() => setShowSchedulePicker(true)}
              testID="schedulePicker"
            >
              <Text style={styles.scheduleButtonText}>
                {scheduledDate || 'Select date & time'}
              </Text>
              <Ionicons name="calendar" size={20} color="#6C757D" />
            </TouchableOpacity>
          )}
        </View>

        {/* Continue Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !quote && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!quote}
            testID="serviceContinueBtn"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Schedule Picker Modal */}
      <Modal
        visible={showSchedulePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSchedulePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Schedule Service</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="Enter date & time (e.g., 2025-09-08 14:00)"
              value={scheduledDate}
              onChangeText={setScheduledDate}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSchedulePicker(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => setShowSchedulePicker(false)}
              >
                <Text style={styles.modalButtonTextPrimary}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C757D',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 20,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  serviceCards: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceCardSelected: {
    borderColor: '#3A8DFF',
    backgroundColor: '#F0F8FF',
  },
  serviceCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  serviceCardDesc: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
  },
  serviceCardPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A8DFF',
  },
  expanderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  expanderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  expanderContent: {
    paddingTop: 12,
  },
  expanderText: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
  },
  dwellingTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dwellingButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F2F4F7',
  },
  dwellingButtonSelected: {
    backgroundColor: '#3A8DFF',
    borderColor: '#3A8DFF',
  },
  dwellingButtonText: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  dwellingButtonTextSelected: {
    color: '#FFFFFF',
  },
  counters: {
    gap: 16,
  },
  counterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  counterLabel: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A8DFF',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    minWidth: 30,
    textAlign: 'center',
  },
  photoInfo: {
    fontSize: 14,
    color: '#F59E0B',
    marginBottom: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F2F4F7',
    borderStyle: 'dashed',
    gap: 8,
  },
  addPhotoText: {
    fontSize: 16,
    color: '#3A8DFF',
    fontWeight: '500',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  photoItem: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    padding: 8,
    position: 'relative',
    minWidth: 80,
  },
  photoId: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F2F4F7',
  },
  quoteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  quoteLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  quoteLoadingText: {
    fontSize: 16,
    color: '#6C757D',
  },
  quoteError: {
    paddingVertical: 20,
  },
  quoteErrorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryQuoteButton: {
    alignSelf: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryQuoteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  quoteDetails: {
    marginBottom: 16,
  },
  quotePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  quotePrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3A8DFF',
  },
  surgeBadge: {
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  surgeBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quoteDuration: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 16,
  },
  breakdown: {
    gap: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
  breakdownAmount: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  getQuoteButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  getQuoteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timingButtons: {
    flexDirection: 'row',
    backgroundColor: '#F2F4F7',
    borderRadius: 12,
    padding: 4,
  },
  timingButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timingButtonSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timingButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6C757D',
  },
  timingButtonTextSelected: {
    color: '#3A8DFF',
  },
  scheduleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F2F4F7',
  },
  scheduleButtonText: {
    fontSize: 16,
    color: '#6C757D',
  },
  continueButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  bottomPadding: {
    height: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 24,
    minWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#F2F4F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#3A8DFF',
  },
  modalButtonText: {
    fontSize: 16,
    color: '#6C757D',
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});