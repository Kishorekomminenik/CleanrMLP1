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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface TrainingGuide {
  id: string;
  title: string;
  description: string;
  url: string;
}

interface SupportIssue {
  id: string;
  role: string;
  category: string;
  status: string;
  lastUpdate: string;
}

export default function PartnerSupportScreen() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [trainingGuides, setTrainingGuides] = useState<TrainingGuide[]>([]);
  const [disputes, setDisputes] = useState<SupportIssue[]>([]);

  // Modal states
  const [showRaiseDispute, setShowRaiseDispute] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('Payment issue');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

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
        loadTrainingGuides(),
        loadDisputes()
      ]);
    } catch (err) {
      setError('Failed to load support data');
      console.error('Partner support data error:', err);
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

  const loadTrainingGuides = async () => {
    const data = await makeAuthenticatedRequest('/partner/training/guides');
    setTrainingGuides(data.items || []);
  };

  const loadDisputes = async () => {
    const data = await makeAuthenticatedRequest('/support/issues');
    const partnerDisputes = data.items?.filter((issue: SupportIssue) => issue.role === 'partner') || [];
    setDisputes(partnerDisputes);
  };

  const openTrainingGuide = async (guide: TrainingGuide) => {
    try {
      const supported = await Linking.canOpenURL(guide.url);
      if (supported) {
        await Linking.openURL(guide.url);
      } else {
        Alert.alert('Error', 'Unable to open training guide');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open training guide');
    }
  };

  const submitDispute = async () => {
    if (!disputeDescription.trim()) {
      Alert.alert('Missing Information', 'Please provide a description of the dispute.');
      return;
    }

    try {
      setSubmittingDispute(true);

      const disputeData = {
        role: 'partner',
        category: disputeCategory,
        description: disputeDescription,
        photoIds: []
      };

      await makeAuthenticatedRequest('/support/issues', {
        method: 'POST',
        body: JSON.stringify(disputeData),
      });

      Alert.alert(
        'Dispute Submitted',
        'Your dispute has been submitted. Our support team will review it and respond within 48 hours.',
        [{ text: 'OK', onPress: () => {
          setShowRaiseDispute(false);
          setDisputeCategory('Payment issue');
          setDisputeDescription('');
          loadDisputes(); // Refresh disputes list
        }}]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to submit dispute. Please try again.');
    } finally {
      setSubmittingDispute(false);
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
          <Text style={styles.loadingText}>Loading partner support...</Text>
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
    <SafeAreaView style={styles.container} testID="supPartnerHeader">
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Partner Help & Support</Text>
          <Text style={styles.headerSubtitle}>Get help and training resources</Text>
        </View>

        {/* Training & Guides Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training & Guides</Text>
          <View style={styles.guidesList} testID="supPartnerGuides">
            {trainingGuides.map((guide) => (
              <TouchableOpacity
                key={guide.id}
                style={styles.guideItem}
                onPress={() => openTrainingGuide(guide)}
              >
                <View style={styles.guideIcon}>
                  <Ionicons name="book" size={24} color="#3A8DFF" />
                </View>
                <View style={styles.guideContent}>
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <Text style={styles.guideDescription}>{guide.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6C757D" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowRaiseDispute(true)}
            >
              <Ionicons name="flag" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Raise Dispute</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={() => Alert.alert('Contact Support', 'Use the SOS feature during active jobs for immediate help, or raise a dispute for non-urgent issues.')}
            >
              <Ionicons name="help-circle" size={24} color="#3A8DFF" />
              <Text style={[styles.actionButtonText, styles.secondaryActionText]}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Your Disputes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Disputes</Text>
          <View style={styles.disputesList} testID="supPartnerDisputesList">
            {disputes.length > 0 ? (
              disputes.map((dispute) => (
                <TouchableOpacity
                  key={dispute.id}
                  style={styles.disputeItem}
                  testID="supPartnerDisputeBtn"
                >
                  <View style={styles.disputeLeft}>
                    <Text style={styles.disputeId}>#{dispute.id.split('_')[1]?.substring(0, 8)}</Text>
                    <Text style={styles.disputeCategory}>{dispute.category}</Text>
                    <Text style={styles.disputeDate}>
                      {formatDate(dispute.lastUpdate)}
                    </Text>
                  </View>
                  <View style={styles.disputeRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(dispute.status) }
                      ]}
                    >
                      <Text style={styles.statusText}>{dispute.status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#6C757D" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#6C757D" />
                <Text style={styles.emptyText}>No disputes submitted yet.</Text>
                <Text style={styles.emptySubtext}>
                  If you have any issues with ratings or payments, you can raise a dispute.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Helpful Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips for Success</Text>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={styles.tipText}>
                Maintain high service quality to earn better ratings and more job offers.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="chatbubble" size={20} color="#10B981" />
              <Text style={styles.tipText}>
                Communicate clearly with customers before, during, and after service.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="time" size={20} color="#3A8DFF" />
              <Text style={styles.tipText}>
                Be punctual and professional to build trust with customers.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="camera" size={20} color="#8B5CF6" />
              <Text style={styles.tipText}>
                Take before and after photos to document your work quality.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Raise Dispute Modal */}
      <Modal
        visible={showRaiseDispute}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRaiseDispute(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRaiseDispute(false)}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Raise Dispute</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} testID="supDisputeSheet">
            <Text style={styles.modalDescription}>
              Please provide details about your dispute. Our support team will review and respond within 48 hours.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Dispute Category</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={disputeCategory}
                  onValueChange={setDisputeCategory}
                  style={styles.picker}
                  testID="supDisputeCategory"
                >
                  <Picker.Item label="Payment issue" value="Payment issue" />
                  <Picker.Item label="Unfair rating" value="Unfair rating" />
                  <Picker.Item label="Other" value="Other" />
                </Picker>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Please describe your dispute in detail..."
                value={disputeDescription}
                onChangeText={setDisputeDescription}
                multiline
                numberOfLines={6}
                maxLength={1000}
                textAlignVertical="top"
                testID="supDisputeDesc"
              />
              <Text style={styles.characterCount}>
                {disputeDescription.length}/1000 characters
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submittingDispute && styles.buttonDisabled]}
              onPress={submitDispute}
              disabled={submittingDispute}
              testID="supDisputeSubmitBtn"
            >
              {submittingDispute ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Dispute</Text>
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
  guidesList: {
    gap: 12,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
  },
  guideIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  guideContent: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  guideDescription: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  secondaryAction: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionText: {
    color: '#3A8DFF',
  },
  disputesList: {
    gap: 8,
  },
  disputeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
  },
  disputeLeft: {
    flex: 1,
  },
  disputeId: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  disputeCategory: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  disputeDate: {
    fontSize: 12,
    color: '#6C757D',
  },
  disputeRight: {
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 20,
  },
  tipsList: {
    gap: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
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
  modalDescription: {
    fontSize: 16,
    color: '#6C757D',
    lineHeight: 22,
    marginBottom: 24,
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
    minHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'right',
    marginTop: 4,
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