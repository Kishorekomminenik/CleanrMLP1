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
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

// Types
interface BookingListItem {
  bookingId: string;
  dateTime: string;
  serviceType: string;
  addressShort: string;
  status: string;
  price: number;
  currency: string;
  surge?: boolean;
  promoApplied?: boolean;
  creditsUsed?: boolean;
}

interface BookingDetail {
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
  partner?: {
    id: string;
    name: string;
    rating: number;
    badges: string[];
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
  policy: {
    cancellable: boolean;
    windowMins: number;
    fee: number;
    refundCreditEligible: boolean;
  };
}

type TabType = 'Upcoming' | 'In-Progress' | 'Past';

const CustomerBookingsScreen: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('Upcoming');
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Map tab to API status
  const getStatusFilter = (tab: TabType): string => {
    switch (tab) {
      case 'Upcoming':
        return 'upcoming';
      case 'In-Progress':
        return 'in_progress';
      case 'Past':
        return 'past';
      default:
        return 'upcoming';
    }
  };

  // Fetch bookings list
  const fetchBookings = useCallback(async (tabFilter: TabType, pageNum: number = 1, isRefresh: boolean = false) => {
    if (!user?.token) return;

    const status = getStatusFilter(tabFilter);
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      const response = await fetch(
        `${BACKEND_URL}/api/bookings/customer?status=${status}&page=${pageNum}&size=20`,
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
          setBookings(data.items || []);
        } else {
          setBookings(prev => [...prev, ...(data.items || [])]);
        }
        
        setHasNextPage(!!data.nextPage);
        setPage(pageNum);
        setError(null);

        // Telemetry
        console.log('Telemetry: bookings.list.load', { role: 'customer', statusFilter: status, count: data.items?.length || 0 });
      } else {
        setError('Failed to load bookings');
      }
    } catch (err) {
      setError('Network error occurred');
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, BACKEND_URL]);

  // Fetch booking detail
  const fetchBookingDetail = useCallback(async (bookingId: string) => {
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
        setSelectedBooking(detail);
        setShowDetailSheet(true);

        // Telemetry
        console.log('Telemetry: bookings.detail.view', { role: 'customer', bookingId });
      } else {
        Alert.alert('Error', 'Failed to load booking details');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    }
  }, [user?.token, BACKEND_URL]);

  // Load more bookings (infinite scroll)
  const loadMore = useCallback(() => {
    if (hasNextPage && !loading && !refreshing) {
      fetchBookings(activeTab, page + 1, false);
    }
  }, [hasNextPage, loading, refreshing, activeTab, page, fetchBookings]);

  // Refresh bookings
  const onRefresh = useCallback(() => {
    fetchBookings(activeTab, 1, true);
  }, [activeTab, fetchBookings]);

  // Change tab
  const onTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setBookings([]);
    fetchBookings(tab, 1, false);
    
    // Telemetry
    console.log('Telemetry: bookings.view', { role: 'customer', tab: tab.toLowerCase() });
  }, [fetchBookings]);

  // Handle cancel booking
  const handleCancelBooking = useCallback(async () => {
    if (!selectedBooking || !user?.token) return;

    setCanceling(true);
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/bookings/${selectedBooking.bookingId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'Customer requested cancellation'
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setShowCancelModal(false);
        setShowDetailSheet(false);
        
        // Show success message
        const feeMessage = result.fee ? `Cancellation fee: $${result.fee}` : '';
        const refundMessage = result.refundCredit ? `Refund credit: $${result.refundCredit}` : '';
        const message = [feeMessage, refundMessage].filter(Boolean).join('\n') || 'Booking cancelled successfully';
        
        Alert.alert('Booking Cancelled', message);
        
        // Refresh bookings
        onRefresh();

        // Telemetry
        console.log('Telemetry: bookings.cancel.success', { 
          role: 'customer', 
          bookingId: selectedBooking.bookingId,
          fee: result.fee,
          refundCredit: result.refundCredit
        });
      } else if (response.status === 409) {
        const errorData = await response.json();
        Alert.alert('Cannot Cancel', errorData.detail || 'Booking cannot be cancelled at this time');
      } else {
        Alert.alert('Error', 'Failed to cancel booking');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setCanceling(false);
    }
  }, [selectedBooking, user?.token, BACKEND_URL, onRefresh]);

  // Handle track booking (navigate to PAGE-7)
  const handleTrackBooking = useCallback(() => {
    if (!selectedBooking) return;
    
    // Telemetry
    console.log('Telemetry: bookings.track.tap', { 
      role: 'customer', 
      bookingId: selectedBooking.bookingId 
    });
    
    // Navigate to PAGE-7 (Live Job tracking)
    // This would typically use navigation
    Alert.alert('Track Booking', 'This would navigate to the live job tracking screen');
    setShowDetailSheet(false);
  }, [selectedBooking]);

  // Handle rebook (navigate to PAGE-3)
  const handleRebook = useCallback(() => {
    if (!selectedBooking) return;
    
    // Telemetry
    console.log('Telemetry: bookings.rebook.tap', { 
      role: 'customer', 
      bookingId: selectedBooking.bookingId 
    });
    
    // Navigate to PAGE-3 with safe prefill (no access notes/door codes)
    const safeConfig = {
      serviceType: selectedBooking.service.serviceType,
      dwellingType: selectedBooking.service.dwellingType,
      bedrooms: selectedBooking.service.bedrooms,
      bathrooms: selectedBooking.service.bathrooms,
      masters: selectedBooking.service.masters,
      addons: selectedBooking.service.addons,
    };
    
    Alert.alert('Rebook', `This would navigate to service selection with prefill: ${JSON.stringify(safeConfig, null, 2)}`);
    setShowDetailSheet(false);
  }, [selectedBooking]);

  // Handle invoice download
  const handleDownloadInvoice = useCallback(async () => {
    if (!selectedBooking || !user?.token) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/bookings/${selectedBooking.bookingId}/invoice`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        // Open PDF in browser
        if (result.url) {
          Linking.openURL(result.url);
          
          // Telemetry
          console.log('Telemetry: bookings.invoice.download', { 
            role: 'customer', 
            bookingId: selectedBooking.bookingId 
          });
        }
      } else {
        Alert.alert('Error', 'Failed to generate invoice');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    }
  }, [selectedBooking, user?.token, BACKEND_URL]);

  // Initialize data
  useEffect(() => {
    if (user?.token) {
      fetchBookings(activeTab, 1, false);
    }
  }, [user?.token, fetchBookings, activeTab]);

  // Render booking item
  const renderBookingItem = ({ item }: { item: BookingListItem }) => (
    <TouchableOpacity
      testID="bkCustViewBtn"
      style={styles.bookingCard}
      onPress={() => fetchBookingDetail(item.bookingId)}
    >
      <View style={styles.bookingHeader}>
        <Text style={styles.serviceType}>{item.serviceType}</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <Text style={styles.addressText}>{item.addressShort}</Text>
      <Text style={styles.dateText}>
        {new Date(item.dateTime).toLocaleDateString()} at {new Date(item.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      
      <View style={styles.bookingFooter}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>${item.price.toFixed(2)} {item.currency}</Text>
          <View style={styles.badges}>
            {item.surge && <Text style={styles.surgeBadge}>SURGE</Text>}
            {item.promoApplied && <Text style={styles.promoBadge}>PROMO</Text>}
            {item.creditsUsed && <Text style={styles.creditsBadge}>CREDITS</Text>}
          </View>
        </View>
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
      <Text style={styles.emptyText}>No bookings yet.</Text>
      <TouchableOpacity style={styles.emptyCTA}>
        <Text style={styles.emptyCTAText}>Book Now</Text>
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
        <Text style={styles.title}>Your Trips</Text>
      </View>

      {/* Tabs */}
      <View testID="bkCustTabs" style={styles.tabContainer}>
        {(['Upcoming', 'In-Progress', 'Past'] as TabType[]).map((tab) => (
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

      {/* Bookings List */}
      <FlatList
        testID="bkCustList"
        data={bookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.bookingId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={loading ? renderSkeleton : renderEmptyState}
        ListFooterComponent={
          loading && bookings.length > 0 ? (
            <ActivityIndicator style={styles.loadingFooter} />
          ) : null
        }
      />

      {/* Booking Detail Sheet */}
      <Modal
        visible={showDetailSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailSheet(false)}
      >
        {selectedBooking && (
          <SafeAreaView style={styles.modalContainer}>
            <ScrollView testID="bkCustDetailSheet" style={styles.detailSheet}>
              {/* Header */}
              <View style={styles.detailHeader}>
                <TouchableOpacity
                  onPress={() => setShowDetailSheet(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
                <Text style={styles.detailTitle}>Booking Detail</Text>
                <View />
              </View>

              {/* Summary Block */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockTitle}>Summary</Text>
                <Text style={styles.bookingId}>ID: {selectedBooking.bookingId}</Text>
                <Text style={styles.detailServiceType}>{selectedBooking.service.serviceType}</Text>
                <Text style={styles.detailText}>
                  {selectedBooking.service.dwellingType} • {selectedBooking.service.bedrooms} bed • {selectedBooking.service.bathrooms} bath
                </Text>
                {selectedBooking.service.addons.length > 0 && (
                  <Text style={styles.addonsText}>
                    Add-ons: {selectedBooking.service.addons.join(', ')}
                  </Text>
                )}
              </View>

              {/* Address Block */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockTitle}>Address</Text>
                <Text style={styles.addressText}>
                  {selectedBooking.address.line1}
                </Text>
                <Text style={styles.addressText}>
                  {selectedBooking.address.city}, {selectedBooking.address.postalCode}
                </Text>
                <TouchableOpacity testID="bkOpenMapsBtn" style={styles.mapsButton}>
                  <Text style={styles.mapsButtonText}>Open in Maps</Text>
                </TouchableOpacity>
              </View>

              {/* Partner Block */}
              {selectedBooking.partner && (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockTitle}>Partner</Text>
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName}>{selectedBooking.partner.name}</Text>
                    <Text style={styles.partnerRating}>★ {selectedBooking.partner.rating}</Text>
                  </View>
                  <View style={styles.partnerBadges}>
                    {selectedBooking.partner.badges.map((badge, index) => (
                      <View key={index} style={styles.badge}>
                        <Text style={styles.badgeText}>{badge}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.contactButtons}>
                    <TouchableOpacity testID="bkChatBtn" style={styles.contactButton}>
                      <Text style={styles.contactButtonText}>Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="bkCallBtn" style={styles.contactButton}>
                      <Text style={styles.contactButtonText}>Call</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Timeline Block */}
              <View testID="bkTimeline" style={styles.detailBlock}>
                <Text style={styles.blockTitle}>Timeline</Text>
                {selectedBooking.timeline.map((event, index) => (
                  <View key={index} style={styles.timelineItem}>
                    <Text style={styles.timelineTime}>
                      {new Date(event.ts).toLocaleString()}
                    </Text>
                    <Text style={styles.timelineLabel}>{event.label}</Text>
                  </View>
                ))}
              </View>

              {/* Photos Block */}
              {(selectedBooking.photos.before.length > 0 || selectedBooking.photos.after.length > 0) && (
                <View testID="bkPhotos" style={styles.detailBlock}>
                  <Text style={styles.blockTitle}>Before/After Photos</Text>
                  {selectedBooking.photos.before.length > 0 && (
                    <View>
                      <Text style={styles.photosSubtitle}>Before</Text>
                      <View style={styles.photosContainer}>
                        {selectedBooking.photos.before.map((url, index) => (
                          <Image key={index} source={{ uri: url }} style={styles.photo} />
                        ))}
                      </View>
                    </View>
                  )}
                  {selectedBooking.photos.after.length > 0 && (
                    <View>
                      <Text style={styles.photosSubtitle}>After</Text>
                      <View style={styles.photosContainer}>
                        {selectedBooking.photos.after.map((url, index) => (
                          <Image key={index} source={{ uri: url }} style={styles.photo} />
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Receipt Block */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockTitle}>Receipt</Text>
                {selectedBooking.receipt.breakdown.map((item, index) => (
                  <View key={index} style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{item.label}</Text>
                    <Text style={styles.receiptAmount}>${item.amount.toFixed(2)}</Text>
                  </View>
                ))}
                {selectedBooking.receipt.tax > 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Tax</Text>
                    <Text style={styles.receiptAmount}>${selectedBooking.receipt.tax.toFixed(2)}</Text>
                  </View>
                )}
                {selectedBooking.receipt.promo < 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Promo</Text>
                    <Text style={styles.receiptAmount}>${selectedBooking.receipt.promo.toFixed(2)}</Text>
                  </View>
                )}
                {selectedBooking.receipt.credits < 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Credits</Text>
                    <Text style={styles.receiptAmount}>${selectedBooking.receipt.credits.toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.receiptTotal}>
                  <Text style={styles.receiptTotalLabel}>Total</Text>
                  <Text style={styles.receiptTotalAmount}>
                    ${selectedBooking.receipt.total.toFixed(2)} {selectedBooking.receipt.currency}
                  </Text>
                </View>
                
                {/* Invoice Download */}
                {selectedBooking.status === 'completed' && (
                  <TouchableOpacity testID="bkInvoiceBtn" style={styles.invoiceButton} onPress={handleDownloadInvoice}>
                    <Text style={styles.invoiceButtonText}>Download Invoice (PDF)</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Actions */}
              <View testID="bkCustActions" style={styles.actionsContainer}>
                {/* Track Button */}
                {['assigned', 'enroute', 'arrived', 'in_progress'].includes(selectedBooking.status) && (
                  <TouchableOpacity testID="bkTrackBtn" style={styles.primaryButton} onPress={handleTrackBooking}>
                    <Text style={styles.primaryButtonText}>Track</Text>
                  </TouchableOpacity>
                )}

                {/* Cancel Button */}
                {selectedBooking.policy.cancellable && (
                  <TouchableOpacity 
                    testID="bkCancelBtn" 
                    style={styles.secondaryButton} 
                    onPress={() => setShowCancelModal(true)}
                    disabled={isOffline}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}

                {/* Rebook Button */}
                {['completed', 'cancelled'].includes(selectedBooking.status) && (
                  <TouchableOpacity 
                    testID="bkRebookBtn" 
                    style={styles.secondaryButton} 
                    onPress={handleRebook}
                    disabled={isOffline}
                  >
                    <Text style={styles.secondaryButtonText}>Rebook</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        visible={showCancelModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View testID="bkCancelModal" style={styles.cancelModal}>
            <Text style={styles.cancelTitle}>Cancel Booking</Text>
            
            {selectedBooking && (
              <>
                <Text style={styles.cancelText}>
                  Are you sure you want to cancel this booking?
                </Text>
                
                <View style={styles.policyContainer}>
                  <Text style={styles.policyTitle}>Cancellation Policy</Text>
                  <Text style={styles.policyText}>
                    • Cancellation window: {selectedBooking.policy.windowMins} minutes
                  </Text>
                  {selectedBooking.policy.fee > 0 && (
                    <Text style={styles.policyText}>
                      • Cancellation fee: ${selectedBooking.policy.fee.toFixed(2)}
                    </Text>
                  )}
                  {selectedBooking.policy.refundCreditEligible && (
                    <Text style={styles.policyText}>
                      • Eligible for refund credit
                    </Text>
                  )}
                </View>

                <View style={styles.cancelActions}>
                  <TouchableOpacity 
                    testID="bkCancelBackBtn"
                    style={styles.cancelBackButton} 
                    onPress={() => setShowCancelModal(false)}
                  >
                    <Text style={styles.cancelBackText}>Go Back</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    testID="bkCancelConfirmBtn"
                    style={styles.cancelConfirmButton} 
                    onPress={handleCancelBooking}
                    disabled={canceling}
                  >
                    {canceling ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.cancelConfirmText}>Confirm Cancel</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Helper function for status badge styles
const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'scheduled':
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
    backgroundColor: '#3A8DFF',
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
    backgroundColor: '#3A8DFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  bookingCard: {
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
  bookingHeader: {
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
  dateText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  badges: {
    flexDirection: 'row',
    marginTop: 4,
  },
  surgeBadge: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    fontFamily: 'Inter',
  },
  promoBadge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    fontFamily: 'Inter',
  },
  creditsBadge: {
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
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
    backgroundColor: '#3A8DFF',
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
    color: '#3A8DFF',
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
    fontFamily: 'Inter',
  },
  mapsButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  mapsButtonText: {
    color: '#3A8DFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  partnerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  partnerRating: {
    fontSize: 14,
    color: '#F59E0B',
    fontFamily: 'Inter',
  },
  partnerBadges: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    backgroundColor: '#3A8DFF',
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
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptLabel: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  receiptAmount: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  receiptTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
  },
  receiptTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  receiptTotalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  invoiceButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  invoiceButtonText: {
    color: '#3A8DFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  actionsContainer: {
    padding: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3A8DFF',
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
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  cancelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  cancelText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  policyContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  policyText: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  cancelActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBackButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelBackText: {
    color: '#6C757D',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cancelConfirmButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default CustomerBookingsScreen;