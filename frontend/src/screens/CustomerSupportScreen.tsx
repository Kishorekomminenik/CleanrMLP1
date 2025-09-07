import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface SupportIssue {
  id: string;
  role: string;
  category: string;
  status: string;
  lastUpdate: string;
}

interface Trip {
  id: string;
  date: string;
  service: string;
  partner: string;
  status: string;
}

export default function CustomerSupportScreen() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [supportIssues, setSupportIssues] = useState<SupportIssue[]>([]);

  // Modal states
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [issueCategory, setIssueCategory] = useState('Payment');
  const [issueDescription, setIssueDescription] = useState('');
  const [issuePhotos, setIssuePhotos] = useState<string[]>([]);
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSupportData();
  }, []);

  const loadSupportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        loadFAQs(),
        loadTrips(),
        loadSupportIssues()
      ]);
    } catch (err) {
      setError('Failed to load support data');
      console.error('Support data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSupportData();
    setRefreshing(false);
  };

  const makeAuthenticatedRequest = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${BACKEND_URL}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  };

  const loadFAQs = async () => {
    const data = await makeAuthenticatedRequest('/support/faqs');
    setFaqs(data.items || []);
  };

  const loadTrips = async () => {
    // Mock trip data - in production, fetch from bookings API
    const mockTrips: Trip[] = [
      {
        id: 'bk_001',
        date: '2024-01-15',
        service: 'House Cleaning',
        partner: 'Sarah Johnson',
        status: 'completed'
      },
      {
        id: 'bk_002',
        date: '2024-01-10',
        service: 'Deep Cleaning',
        partner: 'Mike Chen',
        status: 'completed'
      },
      {
        id: 'bk_003',
        date: '2024-01-05',
        service: 'Apartment Cleaning',
        partner: 'Lisa Brown',
        status: 'completed'
      }
    ];
    setTrips(mockTrips);
  };

  const loadSupportIssues = async () => {
    const data = await makeAuthenticatedRequest('/support/issues');
    setSupportIssues(data.items || []);
  };

  const filteredFAQs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pickImage = async () => {
    if (issuePhotos.length >= 5) {
      Alert.alert('Photo Limit', 'You can upload up to 5 photos per issue.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // In production, upload image and get file ID
      const photoId = `img_${Date.now()}`;
      setIssuePhotos([...issuePhotos, photoId]);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = issuePhotos.filter((_, i) => i !== index);
    setIssuePhotos(newPhotos);
  };

  const submitIssue = async () => {
    if (!issueDescription.trim()) {
      Alert.alert('Missing Information', 'Please provide a description of the issue.');
      return;
    }

    try {
      setSubmittingIssue(true);

      const issueData = {
        bookingId: selectedTrip?.id,
        role: 'customer',
        category: issueCategory,
        description: issueDescription,
        photoIds: issuePhotos
      };

      await makeAuthenticatedRequest('/support/issues', {
        method: 'POST',
        body: JSON.stringify(issueData),
      });

      Alert.alert(
        'Issue Reported',
        'Your issue has been submitted. Our support team will review it and get back to you within 24 hours.',
        [{ text: 'OK', onPress: () => {
          setShowReportIssue(false);
          setSelectedTrip(null);
          setIssueCategory('Payment');
          setIssueDescription('');
          setIssuePhotos([]);
          loadSupportIssues(); // Refresh issues list
        }}]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to submit issue. Please try again.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#EF4444';
      case 'progress': return '#F59E0B';
      case 'closed': return '#10B981';
      default: return '#6C757D';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Loading support...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSupportData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="supCustHeader">
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Support & Help</Text>
          <Text style={styles.headerSubtitle}>Get help with your bookings and account</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar} testID="supCustSearch">
            <Ionicons name="search" size={20} color="#6C757D" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search FAQs"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#6C757D"
            />
          </View>
        </View>

        {/* FAQs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList} testID="supCustFaqList">
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map((faq) => (
                <TouchableOpacity
                  key={faq.id}
                  style={styles.faqItem}
                  onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons
                      name={expandedFaq === faq.id ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#6C757D"
                    />
                  </View>
                  {expandedFaq === faq.id && (
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No FAQs found matching your search.</Text>
            )}
          </View>
        </View>

        {/* Your Trips & Issues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Trips & Issues</Text>
          <View style={styles.tripsList} testID="supCustTripsList">
            {trips.map((trip) => (
              <View key={trip.id} style={styles.tripItem}>
                <View style={styles.tripLeft}>
                  <Text style={styles.tripService}>{trip.service}</Text>
                  <Text style={styles.tripDetails}>
                    {formatDate(trip.date)} • {trip.partner}
                  </Text>
                  <Text style={styles.tripStatus}>{trip.status}</Text>
                </View>
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => {
                    setSelectedTrip(trip);
                    setShowReportIssue(true);
                  }}
                  testID="supReportBtn"
                >
                  <Text style={styles.reportButtonText}>Report Issue</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Open Tickets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Tickets</Text>
          <View style={styles.ticketsList} testID="supCustTicketsList">
            {supportIssues.length > 0 ? (
              supportIssues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  style={styles.ticketItem}
                  testID="supTicketViewBtn"
                >
                  <View style={styles.ticketLeft}>
                    <Text style={styles.ticketId}>#{issue.id.split('_')[1]?.substring(0, 8)}</Text>
                    <Text style={styles.ticketCategory}>{issue.category}</Text>
                    <Text style={styles.ticketDate}>
                      {formatDate(issue.lastUpdate)}
                    </Text>
                  </View>
                  <View style={styles.ticketRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(issue.status) }
                      ]}
                    >
                      <Text style={styles.statusText}>{issue.status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#6C757D" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No open tickets.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Report Issue Modal */}
      <Modal
        visible={showReportIssue}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportIssue(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReportIssue(false)}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Report Issue</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} testID="supReportSheet">
            {selectedTrip && (
              <View style={styles.tripSummary}>
                <Text style={styles.tripSummaryTitle}>Trip Details</Text>
                <Text style={styles.tripSummaryText}>
                  {selectedTrip.service} • {formatDate(selectedTrip.date)}
                </Text>
                <Text style={styles.tripSummaryText}>
                  Partner: {selectedTrip.partner}
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Issue Category</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={issueCategory}
                  onValueChange={setIssueCategory}
                  style={styles.picker}
                  testID="supIssueCategory"
                >
                  <Picker.Item label="Payment" value="Payment" />
                  <Picker.Item label="Service quality" value="Service quality" />
                  <Picker.Item label="Partner behavior" value="Partner behavior" />
                  <Picker.Item label="Other" value="Other" />
                </Picker>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Please describe the issue in detail..."
                value={issueDescription}
                onChangeText={setIssueDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                testID="supIssueDesc"
              />
              <Text style={styles.characterCount}>
                {issueDescription.length}/500 characters
              </Text>
            </View>

            <View style={styles.inputContainer}>  
              <Text style={styles.inputLabel}>Photos (Optional)</Text>
              <TouchableOpacity
                style={styles.photoUploadButton}
                onPress={pickImage}
                testID="supIssuePhotos"
              >
                <Ionicons name="camera" size={24} color="#3A8DFF" />
                <Text style={styles.photoUploadText}>
                  Add Photo ({issuePhotos.length}/5)
                </Text>
              </TouchableOpacity>
              
              {issuePhotos.length > 0 && (
                <View style={styles.photoList}>
                  {issuePhotos.map((photoId, index) => (
                    <View key={photoId} style={styles.photoItem}>
                      <Text style={styles.photoName}>Photo {index + 1}</Text>
                      <TouchableOpacity onPress={() => removePhoto(index)}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submittingIssue && styles.buttonDisabled]}
              onPress={submitIssue}
              disabled={submittingIssue}
              testID="supIssueSubmitBtn"
            >
              {submittingIssue ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Issue</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6C757D',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  faqList: {
    gap: 8,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginRight: 12,
  },
  faqAnswer: {
    marginTop: 12,
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
  },
  tripsList: {
    gap: 12,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
  },
  tripLeft: {
    flex: 1,
  },
  tripService: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  tripDetails: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  tripStatus: {
    fontSize: 12,
    color: '#10B981',
    textTransform: 'capitalize',
  },
  reportButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  reportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  ticketsList: {
    gap: 8,
  },
  ticketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
  },
  ticketLeft: {
    flex: 1,
  },
  ticketId: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  ticketCategory: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  ticketDate: {
    fontSize: 12,
    color: '#6C757D',
  },
  ticketRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    paddingVertical: 32,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  tripSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  tripSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  tripSummaryText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FAFBFC',
  },
  picker: {
    height: 50,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FAFBFC',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'right',
    marginTop: 4,
  },
  photoUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A8DFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  photoUploadText: {
    fontSize: 16,
    color: '#3A8DFF',
    fontWeight: '500',
  },
  photoList: {
    marginTop: 12,
    gap: 8,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  photoName: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  submitButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});