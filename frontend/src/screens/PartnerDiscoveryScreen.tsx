import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Types
interface PartnerService {
  serviceType: string;
  duration: number;
}

interface FareCard {
  serviceType: string;
  fromPrice: number;
  duration: number;
}

interface PartnerReview {
  customerName: string;
  rating: number;
  comment: string;
}

interface PartnerProfile {
  partnerId: string;
  name: string;
  rating: number;
  badges: string[];
  description: string;
  photos: string[];
  services: PartnerService[];
  recentReviews: PartnerReview[];
  status: string;
}

const PartnerDiscoveryScreen: React.FC = () => {
  const { user } = useAuth();
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Fetch partner's own profile preview
  const fetchPartnerProfile = useCallback(async (isRefresh: boolean = false) => {
    if (!user?.token || !user?.id) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // For demo purposes, we'll use a mock partner ID
      // In a real app, this would be the current user's partner ID
      const partnerId = user.role === 'partner' ? user.id : 'pa_101';

      const response = await fetch(
        `${BACKEND_URL}/api/partners/${partnerId}/profile`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const profile = await response.json();
        setPartnerProfile(profile);
        setError(null);
      } else {
        setError('Failed to load your profile');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, user?.id, user?.role, BACKEND_URL]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    fetchPartnerProfile(true);
  }, [fetchPartnerProfile]);

  // Load profile on mount
  useEffect(() => {
    fetchPartnerProfile(false);
  }, [fetchPartnerProfile]);

  if (loading && !partnerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
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
          <Text style={styles.title}>Your Discovery Profile</Text>
          <Text style={styles.subtitle}>How customers see you in search</Text>
        </View>

        {/* Info Box */}
        <View testID="discPartnerPreviewNote" style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Profile Preview</Text>
            <Text style={styles.infoText}>
              This is how your profile appears to customers when they search for services.
              To update your profile, contact support.
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Profile Content */}
        {partnerProfile && (
          <View testID="discPartnerPreviewSheet" style={styles.profileContainer}>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <Text style={styles.profileName}>{partnerProfile.name}</Text>
              <View style={styles.profileRating}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.profileRatingText}>{partnerProfile.rating}</Text>
              </View>
              <View style={styles.profileBadges}>
                {partnerProfile.badges.map((badge, index) => (
                  <View key={index} style={[styles.profileBadge, getStatusBadgeStyle(badge)]}>
                    <Text style={styles.profileBadgeText}>{badge}</Text>
                  </View>
                ))}
              </View>
              
              {/* Status Indicator */}
              <View style={[styles.statusIndicator, getStatusIndicatorStyle(partnerProfile.status)]}>
                <Text style={styles.statusText}>
                  Status: {partnerProfile.status === 'verified' ? 'Verified' : 'Pending Verification'}
                </Text>
              </View>
            </View>

            {/* Bio Section */}
            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{partnerProfile.description}</Text>
            </View>

            {/* Photo Gallery */}
            {partnerProfile.photos.length > 0 && (
              <View style={styles.profileSection}>
                <Text style={styles.sectionTitle}>Gallery</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.gallery}>
                    {partnerProfile.photos.map((photo, index) => (
                      <Image key={index} source={{ uri: photo }} style={styles.galleryImage} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Services Offered */}
            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>Services You Offer</Text>
              {partnerProfile.services.map((service, index) => (
                <View key={index} style={styles.serviceItem}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.serviceType}</Text>
                    <Text style={styles.serviceDuration}>{service.duration} minutes</Text>
                  </View>
                  <Text style={styles.servicePrice}>${service.price}</Text>
                </View>
              ))}
            </View>

            {/* Recent Reviews */}
            {partnerProfile.recentReviews.length > 0 && (
              <View style={styles.profileSection}>
                <Text style={styles.sectionTitle}>Recent Reviews</Text>
                {partnerProfile.recentReviews.map((review, index) => (
                  <View key={index} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewerName}>{review.customerName}</Text>
                      <View style={styles.reviewRating}>
                        <Ionicons name="star" size={14} color="#F59E0B" />
                        <Text style={styles.reviewRatingText}>{review.rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Discovery Tips */}
            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>Tips to Improve Your Visibility</Text>
              <View style={styles.tipsList}>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.tipText}>Keep your profile photos updated</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.tipText}>Maintain high ratings with quality service</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.tipText}>Respond quickly to booking requests</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.tipText}>Complete verification process</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper function for status badge styles
const getStatusBadgeStyle = (badge: string) => {
  switch (badge.toLowerCase()) {
    case 'verified':
      return { backgroundColor: '#10B981' };
    case 'eco':
      return { backgroundColor: '#059669' };
    case 'seasonal':
      return { backgroundColor: '#F59E0B' };
    case 'insured':
      return { backgroundColor: '#3B82F6' };
    case 'pending':
      return { backgroundColor: '#F59E0B' };
    default:
      return { backgroundColor: '#6B7280' };
  }
};

// Helper function for status indicator styles
const getStatusIndicatorStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'verified':
      return { backgroundColor: '#D1FAE5' };
    case 'pending':
      return { backgroundColor: '#FEF3C7' };
    default:
      return { backgroundColor: '#F3F4F6' };
  }
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
  infoBox: {
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
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    fontFamily: 'Inter',
  },
  profileContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  profileRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileRatingText: {
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 4,
    fontFamily: 'Inter',
  },
  profileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  profileBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  profileBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    fontFamily: 'Inter',
  },
  profileSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  bioText: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  gallery: {
    flexDirection: 'row',
    gap: 12,
  },
  galleryImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  serviceDuration: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewRatingText: {
    fontSize: 12,
    color: '#1F2937',
    marginLeft: 2,
    fontFamily: 'Inter',
  },
  reviewComment: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
});

export default PartnerDiscoveryScreen;