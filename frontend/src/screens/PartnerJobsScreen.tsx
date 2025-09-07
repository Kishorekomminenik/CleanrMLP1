import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

// Types
interface JobListItem {
  bookingId: string;
  time: string;
  serviceType: string;
  distanceKm: number;
  addressShort: string;
  status: string;
  payout: number;
  currency: string;
}

interface JobDetail {
  bookingId: string;
  status: string;
  service: {
    serviceType: string;
    dwellingType: string;
    bedrooms: number;
    bathrooms: number;
    masters: number;
    addons: string[];
  };
  address: {
    line1: string;
    city: string;
    postalCode: string;
    lat: number;
    lng: number;
  };
  customer?: {
    id: string;
    firstNameInitial: string;
    rating: number;
  };
  timeline: Array<{
    ts: string;
    event: string;
    label: string;
  }>;
  photos: {
    before: string[];
    after: string[];
  };
  receipt: {
    breakdown: Array<{
      label: string;
      amount: number;
    }>;
    tax: number;
    promo: number;
    credits: number;
    total: number;
    currency: string;
  };
}

type TabType = 'Today' | 'Upcoming' | 'Completed';

const PartnerJobsScreen: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('Today');
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Map tab to API status
  const getStatusFilter = (tab: TabType): string => {
    switch (tab) {
      case 'Today':
        return 'today';
      case 'Upcoming':
        return 'upcoming';
      case 'Completed':
        return 'completed';
      default:
        return 'today';
    }
  };

  // Fetch jobs list
  const fetchJobs = useCallback(async (tabFilter: TabType, pageNum: number = 1, isRefresh: boolean = false) => {
    if (!user?.token) return;

    const status = getStatusFilter(tabFilter);
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      const response = await fetch(
        `${BACKEND_URL}/api/bookings/partner?status=${status}&page=${pageNum}&size=20`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (pageNum === 1 || isRefresh) {
          setJobs(data.items || []);
        } else {
          setJobs(prev => [...prev, ...(data.items || [])]);
        }
        
        setHasNextPage(!!data.nextPage);
        setPage(pageNum);
        setError(null);

        // Telemetry
        console.log('Telemetry: bookings.list.load', { role: 'partner', statusFilter: status, count: data.items?.length || 0 });
      } else {
        setError('Failed to load jobs');
      }
    } catch (err) {
      setError('Network error occurred');
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, BACKEND_URL]);

  // Fetch job detail
  const fetchJobDetail = useCallback(async (bookingId: string) => {
    if (!user?.token) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/bookings/${bookingId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const detail = await response.json();
        setSelectedJob(detail);
        setShowDetailSheet(true);

        // Telemetry
        console.log('Telemetry: bookings.detail.view', { role: 'partner', bookingId });
      } else {
        Alert.alert('Error', 'Failed to load job details');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    }
  }, [user?.token, BACKEND_URL]);

  // Load more jobs (infinite scroll)
  const loadMore = useCallback(() => {
    if (hasNextPage && !loading && !refreshing) {
      fetchJobs(activeTab, page + 1, false);
    }
  }, [hasNextPage, loading, refreshing, activeTab, page, fetchJobs]);

  // Refresh jobs
  const onRefresh = useCallback(() => {
    fetchJobs(activeTab, 1, true);
  }, [activeTab, fetchJobs]);

  // Change tab
  const onTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setJobs([]);
    fetchJobs(tab, 1, false);
    
    // Telemetry
    console.log('Telemetry: bookings.view', { role: 'partner', tab: tab.toLowerCase() });
  }, [fetchJobs]);

  // Handle navigate to job
  const handleNavigate = useCallback(() => {
    if (!selectedJob) return;
    
    // This would typically open navigation app with coordinates
    const { lat, lng } = selectedJob.address;
    Alert.alert('Navigate', `This would open navigation to coordinates: ${lat}, ${lng}`);
    setShowDetailSheet(false);
  }, [selectedJob]);

  // Handle go to live job (navigate to PAGE-7)
  const handleGoToLiveJob = useCallback(() => {
    if (!selectedJob) return;
    
    // Navigate to PAGE-7 (Live Job tracking)
    Alert.alert('Go to Live Job', 'This would navigate to the live job tracking screen');
    setShowDetailSheet(false);
  }, [selectedJob]);

  // Handle chat with customer
  const handleChat = useCallback(() => {
    if (!selectedJob) return;
    
    // This would open chat interface from PAGE-7
    Alert.alert('Chat', 'This would open chat with the customer');
  }, [selectedJob]);

  // Handle call customer
  const handleCall = useCallback(() => {
    if (!selectedJob) return;
    
    // This would initiate masked call from PAGE-7
    Alert.alert('Call', 'This would initiate a call with the customer');
  }, [selectedJob]);

  // Check if contact actions should be shown
  const shouldShowContact = (status: string): boolean => {
    return ['assigned', 'enroute', 'arrived', 'in_progress'].includes(status);
  };

  // Initialize data
  useEffect(() => {
    if (user?.token) {
      fetchJobs(activeTab, 1, false);
    }
  }, [user?.token, fetchJobs, activeTab]);

  // Render job item
  const renderJobItem = ({ item }: { item: JobListItem }) => (
    <TouchableOpacity
      testID="bkParOpenBtn"
      style={styles.jobCard}
      onPress={() => fetchJobDetail(item.bookingId)}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.serviceType}>{item.serviceType}</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <Text style={styles.addressText}>{item.addressShort}</Text>
      <Text style={styles.distanceText}>{item.distanceKm} km away</Text>
      <Text style={styles.timeText}>
        {new Date(item.time).toLocaleDateString()} at {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      
      <View style={styles.jobFooter}>
        <Text style={styles.payoutText}>
          ${item.payout.toFixed(2)} {item.currency}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Render loading skeleton
  const renderSkeleton = () => (
    <View style={styles.skeleton}>
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLineShort} />
      <View style={styles.skeletonLine} />
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>Nothing here yet.</Text>
      <TouchableOpacity style={styles.emptyCTA}>
        <Text style={styles.emptyCTAText}>Go Online</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>You're offline. Showing cached data.</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Jobs</Text>
      </View>

      {/* Tabs */}
      <View testID="bkParTabs" style={styles.tabContainer}>
        {(['Today', 'Upcoming', 'Completed'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => onTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Jobs List */}
      <FlatList
        testID="bkParList"
        data={jobs}
        renderItem={renderJobItem}
        keyExtractor={(item) => item.bookingId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={loading ? renderSkeleton : renderEmptyState}
        ListFooterComponent={
          loading && jobs.length > 0 ? (
            <ActivityIndicator style={styles.loadingFooter} />
          ) : null
        }
      />

      {/* Job Detail Sheet */}
      <Modal
        visible={showDetailSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailSheet(false)}
      >
        {selectedJob && (
          <SafeAreaView style={styles.modalContainer}>
            <ScrollView testID="bkParDetailSheet" style={styles.detailSheet}>
              {/* Header */}
              <View style={styles.detailHeader}>
                <TouchableOpacity
                  onPress={() => setShowDetailSheet(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
                <Text style={styles.detailTitle}>Job Detail</Text>
                <View />
              </View>

              {/* Summary Block */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockTitle}>Summary</Text>
                <Text style={styles.bookingId}>ID: {selectedJob.bookingId}</Text>
                <Text style={styles.detailServiceType}>{selectedJob.service.serviceType}</Text>
                <Text style={styles.detailText}>
                  {selectedJob.service.dwellingType} • {selectedJob.service.bedrooms} bed • {selectedJob.service.bathrooms} bath
                </Text>
                {selectedJob.service.addons.length > 0 && (
                  <Text style={styles.addonsText}>
                    Add-ons: {selectedJob.service.addons.join(', ')}
                  </Text>
                )}
                
                {/* Partner Payout */}
                <View style={styles.payoutContainer}>
                  <Text style={styles.payoutLabel}>Your Payout</Text>
                  <Text style={styles.payoutAmount}>
                    ${(selectedJob.receipt.total * 0.8).toFixed(2)} {selectedJob.receipt.currency}
                  </Text>
                </View>
              </View>

              {/* Address Block */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockTitle}>Address</Text>
                <Text style={styles.addressText}>
                  {selectedJob.address.line1}
                </Text>
                <Text style={styles.addressText}>
                  {selectedJob.address.city}, {selectedJob.address.postalCode}
                </Text>
                <TouchableOpacity 
                  testID="bkParNavigateBtn" 
                  style={styles.navigateButton}
                  onPress={handleNavigate}
                  disabled={isOffline}
                >
                  <Text style={styles.navigateButtonText}>Navigate</Text>
                </TouchableOpacity>
              </View>

              {/* Customer Block */}
              {selectedJob.customer && (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockTitle}>Customer</Text>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>{selectedJob.customer.firstNameInitial}.</Text>
                    <Text style={styles.customerRating}>★ {selectedJob.customer.rating}</Text>
                  </View>
                  
                  {/* Contact Actions (only when assigned or in progress) */}
                  {shouldShowContact(selectedJob.status) && (
                    <View style={styles.contactButtons}>
                      <TouchableOpacity 
                        testID="bkParChatBtn" 
                        style={styles.contactButton}
                        onPress={handleChat}
                        disabled={isOffline}
                      >
                        <Text style={styles.contactButtonText}>Chat</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        testID="bkParCallBtn" 
                        style={styles.contactButton}
                        onPress={handleCall}
                        disabled={isOffline}
                      >
                        <Text style={styles.contactButtonText}>Call</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Timeline Block */}
              <View testID="bkParTimeline" style={styles.detailBlock}>
                <Text style={styles.blockTitle}>Timeline</Text>
                {selectedJob.timeline.map((event, index) => (
                  <View key={index} style={styles.timelineItem}>
                    <Text style={styles.timelineTime}>
                      {new Date(event.ts).toLocaleString()}
                    </Text>
                    <Text style={styles.timelineLabel}>{event.label}</Text>
                  </View>
                ))}
              </View>

              {/* Photos Block */}
              {(selectedJob.photos.before.length > 0 || selectedJob.photos.after.length > 0) && (
                <View testID="bkParPhotos" style={styles.detailBlock}>
                  <Text style={styles.blockTitle}>Before/After Photos</Text>
                  {selectedJob.photos.before.length > 0 && (
                    <View>
                      <Text style={styles.photosSubtitle}>Before</Text>
                      <View style={styles.photosContainer}>
                        {selectedJob.photos.before.map((url, index) => (
                          <Image key={index} source={{ uri: url }} style={styles.photo} />
                        ))}
                      </View>
                    </View>
                  )}
                  {selectedJob.photos.after.length > 0 && (
                    <View>
                      <Text style={styles.photosSubtitle}>After</Text>
                      <View style={styles.photosContainer}>
                        {selectedJob.photos.after.map((url, index) => (
                          <Image key={index} source={{ uri: url }} style={styles.photo} />
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Actions */}
              <View testID="bkParActions" style={styles.actionsContainer}>
                {/* Go to Live Job Button */}
                {!['completed', 'cancelled'].includes(selectedJob.status) && (
                  <TouchableOpacity 
                    testID="bkParTrackBtn" 
                    style={styles.primaryButton} 
                    onPress={handleGoToLiveJob}
                    disabled={isOffline}
                  >
                    <Text style={styles.primaryButtonText}>Go to Live Job</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
};

// Helper function for status badge styles
const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'assigned':
      return { backgroundColor: '#3A8DFF' };
    case 'in_progress':
      return { backgroundColor: '#10B981' };
    case 'completed':
      return { backgroundColor: '#6C757D' };
    case 'cancelled':
      return { backgroundColor: '#EF4444' };
    default:
      return { backgroundColor: '#6C757D' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    alignItems: 'center',
  },
  offlineText: {
    color: '#92400E',
    fontSize: 14,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#10B981', // Partner color (green)
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    marginBottom: 10,
    fontFamily: 'Inter',
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  statusBadge: {
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
  addressText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  distanceText: {
    fontSize: 14,
    color: '#10B981',
    marginBottom: 4,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  timeText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  skeleton: {
    padding: 16,
    margin: 16,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonLineShort: {
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    width: '60%',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  emptyCTA: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyCTAText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  loadingFooter: {
    padding: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailSheet: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  closeText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  detailBlock: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  bookingId: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  detailServiceType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  detailText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  addonsText: {
    fontSize: 14,
    color: '#6C757D',
    fontStyle: 'italic',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  payoutContainer: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    fontFamily: 'Inter',
  },
  payoutAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  navigateButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  customerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  customerRating: {
    fontSize: 14,
    color: '#F59E0B',
    fontFamily: 'Inter',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  timelineItem: {
    marginBottom: 12,
  },
  timelineTime: {
    fontSize: 12,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  timelineLabel: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  photosSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  photosContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  actionsContainer: {
    padding: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default PartnerJobsScreen;