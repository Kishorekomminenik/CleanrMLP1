import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Types
interface SearchResultItem {
  partnerId: string;
  partnerName: string;
  rating: number;
  badges: string[];
  serviceTypes: string[];
  distanceKm: number;
  fromPrice: number;
  surge: boolean;
  fav: boolean;
}

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
  fareCards: FareCard[];
  recentReviews: PartnerReview[];
  status: string;
}

type ServiceFilter = 'All' | 'Cleaning' | 'Lawn' | 'Snow' | 'Dog Walk' | 'Beauty' | 'Baby Care';
type SortOption = 'relevance' | 'rating' | 'distance';

const CustomerDiscoveryScreen: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ServiceFilter>('All');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerProfile | null>(null);
  const [showPartnerSheet, setShowPartnerSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  const serviceFilters: ServiceFilter[] = ['All', 'Cleaning', 'Lawn', 'Snow', 'Dog Walk', 'Beauty', 'Baby Care'];

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Perform search
  const performSearch = useCallback(async (
    query: string = searchQuery,
    filter: ServiceFilter = selectedFilter,
    sort: SortOption = sortBy,
    pageNum: number = 1,
    isRefresh: boolean = false
  ) => {
    if (!user?.token) return;

    // Skip search if query is too short (but allow empty for browsing)
    if (query.length > 0 && query.length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      const params = new URLSearchParams({
        q: query,
        filter: filter,
        page: pageNum.toString(),
        size: '20',
        sort: sort,
        // Use default location for demo (San Francisco)
        lat: '37.7749',
        lng: '-122.4194',
        radiusKm: '25'
      });

      const response = await fetch(
        `${BACKEND_URL}/api/discovery/search?${params}`,
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
          setSearchResults(data.items || []);
        } else {
          setSearchResults(prev => [...prev, ...(data.items || [])]);
        }
        
        setHasNextPage(!!data.nextPage);
        setPage(pageNum);
        setError(null);

        // Telemetry
        console.log('Telemetry: discovery.search', { 
          role: 'customer', 
          query, 
          filter, 
          sort,
          results: data.items?.length || 0 
        });
      } else if (response.status === 400) {
        const errorData = await response.json();
        setError(errorData.detail || 'Invalid search parameters');
      } else {
        setError('Failed to load search results');
      }
    } catch (err) {
      setError('Network error occurred');
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, BACKEND_URL, searchQuery, selectedFilter, sortBy]);

  // Debounced search handler
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      setPage(1);
      performSearch(text, selectedFilter, sortBy, 1, false);
    }, 250);

    setSearchTimeout(timeout);
  }, [selectedFilter, sortBy, performSearch, searchTimeout]);

  // Filter change handler
  const handleFilterChange = useCallback((filter: ServiceFilter) => {
    setSelectedFilter(filter);
    setPage(1);
    performSearch(searchQuery, filter, sortBy, 1, false);
  }, [searchQuery, sortBy, performSearch]);

  // Sort change handler
  const handleSortChange = useCallback((sort: SortOption) => {
    setSortBy(sort);
    setPage(1);
    performSearch(searchQuery, selectedFilter, sort, 1, false);
  }, [searchQuery, selectedFilter, performSearch]);

  // Load more results
  const loadMore = useCallback(() => {
    if (hasNextPage && !loading && !refreshing) {
      performSearch(searchQuery, selectedFilter, sortBy, page + 1, false);
    }
  }, [hasNextPage, loading, refreshing, searchQuery, selectedFilter, sortBy, page, performSearch]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    performSearch(searchQuery, selectedFilter, sortBy, 1, true);
  }, [searchQuery, selectedFilter, sortBy, performSearch]);

  // Fetch partner profile
  const fetchPartnerProfile = useCallback(async (partnerId: string) => {
    if (!user?.token) return;

    try {
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
        setSelectedPartner(profile);
        setShowPartnerSheet(true);

        // Telemetry
        console.log('Telemetry: discovery.partner.profile.open', { 
          role: 'customer', 
          partnerId 
        });
      } else {
        Alert.alert('Error', 'Failed to load partner profile');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    }
  }, [user?.token, BACKEND_URL]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (partnerId: string, currentFav: boolean) => {
    if (!user?.token || isOffline) return;

    // Optimistic update
    const newFavState = !currentFav;
    const newFavorites = new Set(favorites);
    if (newFavState) {
      newFavorites.add(partnerId);
    } else {
      newFavorites.delete(partnerId);
    }
    setFavorites(newFavorites);

    // Update search results
    setSearchResults(prev => prev.map(item => 
      item.partnerId === partnerId ? { ...item, fav: newFavState } : item
    ));

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/favorites/${partnerId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fav: newFavState })
        }
      );

      if (!response.ok) {
        // Rollback optimistic update
        const rollbackFavorites = new Set(favorites);
        if (currentFav) {
          rollbackFavorites.add(partnerId);
        } else {
          rollbackFavorites.delete(partnerId);
        }
        setFavorites(rollbackFavorites);
        
        setSearchResults(prev => prev.map(item => 
          item.partnerId === partnerId ? { ...item, fav: currentFav } : item
        ));

        if (response.status === 400) {
          Alert.alert('Error', 'Maximum 200 favorites allowed');
        } else {
          Alert.alert('Error', 'Failed to update favorite');
        }
      } else {
        // Telemetry
        console.log('Telemetry: discovery.favorite.toggle', { 
          role: 'customer', 
          partnerId, 
          favState: newFavState 
        });
      }
    } catch (err) {
      // Rollback on network error
      const rollbackFavorites = new Set(favorites);
      if (currentFav) {
        rollbackFavorites.add(partnerId);
      } else {
        rollbackFavorites.delete(partnerId);
      }
      setFavorites(rollbackFavorites);
      
      setSearchResults(prev => prev.map(item => 
        item.partnerId === partnerId ? { ...item, fav: currentFav } : item
      ));
      
      Alert.alert('Error', 'Network error occurred');
    }
  }, [user?.token, BACKEND_URL, isOffline, favorites]);

  // Handle book now
  const handleBookNow = useCallback((partnerId: string, preferredService?: string) => {
    if (!selectedPartner) return;

    // Check if partner is verified
    if (selectedPartner.status !== 'verified') {
      Alert.alert('Partner Not Available', 'This partner is not yet verified and cannot accept bookings.');
      return;
    }

    // Telemetry
    console.log('Telemetry: discovery.book.tap', { 
      role: 'customer', 
      partnerId,
      preferredServiceType: preferredService 
    });

    // Navigate to PAGE-3 with partner info
    const handoffPayload = {
      partnerId,
      preferredServiceType: preferredService,
      source: 'discovery'
    };
    
    Alert.alert('Book Now', `This would navigate to PAGE-3 with payload: ${JSON.stringify(handoffPayload, null, 2)}`);
    setShowPartnerSheet(false);
  }, [selectedPartner]);

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user?.token) return;

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/favorites`,
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
          setFavorites(new Set(data.items || []));
        }
      } catch (err) {
        console.log('Failed to load favorites');
      }
    };

    loadFavorites();
  }, [user?.token, BACKEND_URL]);

  // Initial search
  useEffect(() => {
    if (user?.token) {
      performSearch('', 'All', 'relevance', 1, false);
    }
  }, [user?.token]);

  // Render search result item
  const renderSearchItem = ({ item }: { item: SearchResultItem }) => (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={styles.partnerInfo}>
          <Text style={styles.partnerName}>{item.partnerName}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.rating}>{item.rating}</Text>
            <Text style={styles.distance}> • {item.distanceKm} km</Text>
          </View>
        </View>
        
        <TouchableOpacity
          testID="discFavToggle"
          onPress={() => toggleFavorite(item.partnerId, item.fav)}
          style={styles.favoriteButton}
        >
          <Ionicons 
            name={item.fav ? "heart" : "heart-outline"} 
            size={24} 
            color={item.fav ? "#EF4444" : "#6C757D"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.badges}>
        {item.badges.map((badge, index) => (
          <View key={index} style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ))}
        {/* Surge Chip */}
        {item.surge && (
          <View testID="discSurgeChip" style={styles.surgeChip}>
            <Text style={styles.surgeChipText}>Surge</Text>
          </View>
        )}
      </View>

      <Text style={styles.serviceTypes}>
        {item.serviceTypes.join(', ')}
      </Text>

      <View style={styles.resultFooter}>
        <Text testID="discItemFromPrice" style={styles.fromPrice}>
          From ${item.fromPrice.toFixed(0)}
        </Text>
        <TouchableOpacity
          testID="discViewProfileBtn"
          style={styles.viewProfileButton}
          onPress={() => fetchPartnerProfile(item.partnerId)}
        >
          <Text style={styles.viewProfileText}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color="#6C757D" />
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptyText}>
        Try adjusting your search terms or filters
      </Text>
    </View>
  );

  // Render loading skeleton
  const renderSkeleton = () => (
    <View style={styles.skeleton}>
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLineShort} />
      <View style={styles.skeletonLine} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>You're offline. Search disabled.</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6C757D" />
          <TextInput
            testID="discSearchBar"
            style={styles.searchInput}
            placeholder="Search for services or pros"
            placeholderTextColor="#6C757D"
            value={searchQuery}
            onChangeText={handleSearchChange}
            editable={!isOffline}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={20} color="#6C757D" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <ScrollView 
        testID="discFilters"
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {serviceFilters.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterButtonActive
            ]}
            onPress={() => handleFilterChange(filter)}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === filter && styles.filterButtonTextActive
            ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {(['relevance', 'rating', 'distance'] as SortOption[]).map((sort) => (
          <TouchableOpacity
            key={sort}
            style={[
              styles.sortButton,
              sortBy === sort && styles.sortButtonActive
            ]}
            onPress={() => handleSortChange(sort)}
          >
            <Text style={[
              styles.sortButtonText,
              sortBy === sort && styles.sortButtonTextActive
            ]}>
              {sort}
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

      {/* Pricing Disclaimer */}
      <View style={styles.disclaimerContainer}>
        <Text testID="discDisclaimer" style={styles.disclaimerText}>
          💡 Prices set by SHINE. Final total may vary with surge and add-ons.
        </Text>
      </View>

      {/* Results List */}
      <FlatList
        testID="discResultsList"
        data={searchResults}
        renderItem={renderSearchItem}
        keyExtractor={(item) => item.partnerId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={loading ? renderSkeleton : renderEmptyState}
        ListFooterComponent={
          loading && searchResults.length > 0 ? (
            <ActivityIndicator style={styles.loadingFooter} />
          ) : null
        }
        style={styles.resultsList}
      />

      {/* Partner Profile Sheet */}
      <Modal
        visible={showPartnerSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPartnerSheet(false)}
      >
        {selectedPartner && (
          <SafeAreaView style={styles.modalContainer}>
            <ScrollView testID="discPartnerSheet" style={styles.partnerSheet}>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <TouchableOpacity
                  onPress={() => setShowPartnerSheet(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Partner Profile</Text>
                <View />
              </View>

              {/* Profile Header */}
              <View style={styles.profileHeader}>
                <Text style={styles.profileName}>{selectedPartner.name}</Text>
                <View style={styles.profileRating}>
                  <Ionicons name="star" size={20} color="#F59E0B" />
                  <Text style={styles.profileRatingText}>{selectedPartner.rating}</Text>
                </View>
                <View style={styles.profileBadges}>
                  {selectedPartner.badges.map((badge, index) => (
                    <View key={index} style={styles.profileBadge}>
                      <Text style={styles.profileBadgeText}>{badge}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Bio */}
              <View style={styles.profileSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{selectedPartner.description}</Text>
              </View>

              {/* Photo Gallery */}
              {selectedPartner.photos.length > 0 && (
                <View style={styles.profileSection}>
                  <Text style={styles.sectionTitle}>Gallery</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.gallery}>
                      {selectedPartner.photos.map((photo, index) => (
                        <Image key={index} source={{ uri: photo }} style={styles.galleryImage} />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Services Offered */}
              <View style={styles.profileSection}>
                <Text style={styles.sectionTitle}>Services</Text>
                {selectedPartner.fareCards && selectedPartner.fareCards.length > 0 ? (
                  selectedPartner.fareCards.map((fareCard, index) => (
                    <View key={index} style={styles.serviceItem}>
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>{fareCard.serviceType}</Text>
                        <Text style={styles.serviceDuration}>{fareCard.duration} minutes</Text>
                      </View>
                      <Text style={styles.servicePrice}>From ${fareCard.fromPrice}</Text>
                    </View>
                  ))
                ) : (
                  selectedPartner.services.map((service, index) => (
                    <View key={index} style={styles.serviceItem}>
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>{service.serviceType}</Text>
                        <Text style={styles.serviceDuration}>{service.duration} minutes</Text>
                      </View>
                      <Text style={styles.servicePrice}>Contact for pricing</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Recent Reviews */}
              {selectedPartner.recentReviews.length > 0 && (
                <View style={styles.profileSection}>
                  <Text style={styles.sectionTitle}>Recent Reviews</Text>
                  {selectedPartner.recentReviews.map((review, index) => (
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

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  testID="discFavBtn"
                  style={styles.favoriteActionButton}
                  onPress={() => toggleFavorite(selectedPartner.partnerId, favorites.has(selectedPartner.partnerId))}
                >
                  <Ionicons 
                    name={favorites.has(selectedPartner.partnerId) ? "heart" : "heart-outline"} 
                    size={20} 
                    color="#6C757D" 
                  />
                  <Text style={styles.favoriteActionText}>
                    {favorites.has(selectedPartner.partnerId) ? 'Favorited' : 'Favorite'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="discBookNowBtn"
                  style={[
                    styles.bookNowButton,
                    selectedPartner.status !== 'verified' && styles.bookNowButtonDisabled
                  ]}
                  onPress={() => handleBookNow(selectedPartner.partnerId)}
                  disabled={selectedPartner.status !== 'verified'}
                >
                  <Text style={styles.bookNowText}>
                    {selectedPartner.status === 'verified' ? 'Book Now' : 'Not Available'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filtersContent: {
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#3A8DFF',
    borderColor: '#3A8DFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  sortLabel: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  sortButtonActive: {
    backgroundColor: '#3A8DFF',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  sortButtonTextActive: {
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
  resultsList: {
    flex: 1,
  },
  resultCard: {
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
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 4,
    fontFamily: 'Inter',
  },
  distance: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  favoriteButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 6,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  surgeChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  surgeChipText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  serviceTypes: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fromPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  viewProfileButton: {
    backgroundColor: '#3A8DFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  viewProfileText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  loadingFooter: {
    padding: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  partnerSheet: {
    flex: 1,
  },
  sheetHeader: {
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
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
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
    gap: 8,
  },
  profileBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  profileBadgeText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
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
  actionsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  favoriteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    minHeight: 44,
  },
  favoriteActionText: {
    color: '#6C757D',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  bookNowButton: {
    flex: 2,
    backgroundColor: '#3A8DFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  bookNowButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  bookNowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  disclaimerContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
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
});

export default CustomerDiscoveryScreen;