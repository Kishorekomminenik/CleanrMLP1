import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

// Types
interface BookingTableItem {
  bookingId: string;
  created: string;
  status: string;
  service: string;
  zone: string;
  partner: string;
  total: number;
  currency: string;
}

type StatusFilter = 'all' | 'assigned' | 'enroute' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_match';
type ServiceFilter = 'All' | 'Cleaning' | 'Lawn' | 'Snow' | 'Dog Walk' | 'Beauty' | 'Baby Care';

const OwnerBookingsScreen: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingTableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Mock data for owner bookings (in a real app, this would come from API)
  const generateMockBookings = useCallback((): BookingTableItem[] => {
    const services = ['Deep Clean', 'Standard Clean', 'Bathroom Only', 'Move-out Clean', 'Lawn Mowing', 'Snow Removal'];
    const statuses = ['assigned', 'enroute', 'arrived', 'in_progress', 'completed', 'cancelled'];
    const zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];
    const partners = ['Sarah J.', 'Mike T.', 'Anna K.', 'David L.', 'Lisa M.'];
    
    const mockBookings: BookingTableItem[] = [];
    
    for (let i = 0; i < 25; i++) {
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 30));
      
      mockBookings.push({
        bookingId: `bk_${1000 + i}`,
        created: createdDate.toISOString(),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        service: services[Math.floor(Math.random() * services.length)],
        zone: zones[Math.floor(Math.random() * zones.length)],
        partner: Math.random() > 0.3 ? partners[Math.floor(Math.random() * partners.length)] : '-',
        total: Math.floor(Math.random() * 200) + 50,
        currency: 'USD',
      });
    }
    
    return mockBookings.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }, []);

  // Filter bookings based on current filters
  const filterBookings = useCallback((bookings: BookingTableItem[]): BookingTableItem[] => {
    let filtered = [...bookings];
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }
    
    // Service filter
    if (serviceFilter !== 'All') {
      const serviceMap: { [key: string]: string[] } = {
        'Cleaning': ['Deep Clean', 'Standard Clean', 'Bathroom Only', 'Move-out Clean'],
        'Lawn': ['Lawn Mowing'],
        'Snow': ['Snow Removal'],
        'Dog Walk': ['Dog Walking'],
        'Beauty': ['Beauty Service'],
        'Baby Care': ['Baby Care'],
      };
      
      const serviceTypes = serviceMap[serviceFilter] || [];
      filtered = filtered.filter(booking => serviceTypes.includes(booking.service));
    }
    
    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(booking => new Date(booking.created) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(booking => new Date(booking.created) <= end);
    }
    
    return filtered;
  }, [statusFilter, serviceFilter, startDate, endDate]);

  // Fetch bookings data
  const fetchBookings = useCallback(async (isRefresh: boolean = false) => {
    if (!user?.token) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // In a real app, this would be an API call to get owner bookings
      // For now, we'll use mock data
      const mockData = generateMockBookings();
      setBookings(mockData);
      setError(null);

      // Telemetry
      console.log('Telemetry: bookings.view', { role: 'owner', statusFilter, serviceFilter });
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, generateMockBookings, statusFilter, serviceFilter]);

  // Refresh bookings
  const onRefresh = useCallback(() => {
    fetchBookings(true);
  }, [fetchBookings]);

  // Apply filters
  const applyFilters = useCallback(() => {
    // Telemetry for filter changes
    console.log('Telemetry: bookings.filter.apply', { 
      role: 'owner', 
      statusFilter, 
      serviceFilter, 
      hasDateRange: !!(startDate || endDate) 
    });
    
    // In a real app, this would trigger a new API call with filters
    // For now, we just re-filter the existing data
    fetchBookings(false);
  }, [statusFilter, serviceFilter, startDate, endDate, fetchBookings]);

  // Initialize data
  useEffect(() => {
    if (user?.token) {
      fetchBookings(false);
    }
  }, [user?.token, fetchBookings]);

  // Get filtered bookings
  const filteredBookings = filterBookings(bookings);

  // Render table header
  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderText, styles.bookingIdColumn]}>ID</Text>
      <Text style={[styles.tableHeaderText, styles.createdColumn]}>Created</Text>
      <Text style={[styles.tableHeaderText, styles.statusColumn]}>Status</Text>
      <Text style={[styles.tableHeaderText, styles.serviceColumn]}>Service</Text>
      <Text style={[styles.tableHeaderText, styles.zoneColumn]}>Zone</Text>
      <Text style={[styles.tableHeaderText, styles.partnerColumn]}>Partner</Text>
      <Text style={[styles.tableHeaderText, styles.totalColumn]}>Total</Text>
    </View>
  );

  // Render table row
  const renderTableRow = (booking: BookingTableItem, index: number) => (
    <View key={booking.bookingId} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
      <Text style={[styles.tableRowText, styles.bookingIdColumn]} numberOfLines={1}>
        {booking.bookingId}
      </Text>
      <Text style={[styles.tableRowText, styles.createdColumn]} numberOfLines={1}>
        {new Date(booking.created).toLocaleDateString()}
      </Text>
      <View style={[styles.statusColumn, styles.statusCell]}>
        <View style={[styles.statusIndicator, getStatusColor(booking.status)]}>
          <Text style={styles.statusText}>{booking.status}</Text>
        </View>
      </View>
      <Text style={[styles.tableRowText, styles.serviceColumn]} numberOfLines={1}>
        {booking.service}
      </Text>
      <Text style={[styles.tableRowText, styles.zoneColumn]} numberOfLines={1}>
        {booking.zone}
      </Text>
      <Text style={[styles.tableRowText, styles.partnerColumn]} numberOfLines={1}>
        {booking.partner}
      </Text>
      <Text style={[styles.tableRowText, styles.totalColumn]} numberOfLines={1}>
        ${booking.total}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View testID="bkOwnerHeader" style={styles.header}>
        <Text style={styles.title}>Bookings (Read-only)</Text>
        <Text style={styles.subtitle}>System-wide booking overview</Text>
      </View>

      {/* Filters */}
      <View testID="bkOwnerFilters" style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {/* Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterButtonsRow}>
              {(['all', 'assigned', 'in_progress', 'completed', 'cancelled'] as StatusFilter[]).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterButton,
                    statusFilter === status && styles.filterButtonActive
                  ]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    statusFilter === status && styles.filterButtonTextActive
                  ]}>
                    {status === 'all' ? 'All' : status.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Service Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Service</Text>
            <View style={styles.filterButtonsRow}>
              {(['All', 'Cleaning', 'Lawn', 'Snow'] as ServiceFilter[]).map((service) => (
                <TouchableOpacity
                  key={service}
                  style={[
                    styles.filterButton,
                    serviceFilter === service && styles.filterButtonActive
                  ]}
                  onPress={() => setServiceFilter(service)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    serviceFilter === service && styles.filterButtonTextActive
                  ]}>
                    {service}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date Range Filter */}
          <View testID="bkOwnerDateRange" style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Date Range</Text>
            <View style={styles.dateRangeContainer}>
              <TextInput
                style={styles.dateInput}
                placeholder="Start Date"
                value={startDate}
                onChangeText={setStartDate}
                placeholderTextColor="#6C757D"
              />
              <TextInput
                style={styles.dateInput}
                placeholder="End Date"
                value={endDate}
                onChangeText={setEndDate}
                placeholderTextColor="#6C757D"
              />
            </View>
          </View>
        </ScrollView>

        {/* Apply Filters Button */}
        <TouchableOpacity style={styles.applyFiltersButton} onPress={applyFilters}>
          <Text style={styles.applyFiltersText}>Apply Filters</Text>
        </TouchableOpacity>
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

      {/* Results Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          Showing {filteredBookings.length} of {bookings.length} bookings
        </Text>
      </View>

      {/* Bookings Table */}
      <ScrollView
        style={styles.tableContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : (
          <View testID="bkOwnerTable" style={styles.table}>
            {renderTableHeader()}
            {filteredBookings.length > 0 ? (
              filteredBookings.map((booking, index) => renderTableRow(booking, index))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No bookings match your filters</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper function for status colors
const getStatusColor = (status: string) => {
  switch (status) {
    case 'assigned':
      return { backgroundColor: '#3A8DFF' };
    case 'enroute':
      return { backgroundColor: '#F59E0B' };
    case 'arrived':
      return { backgroundColor: '#10B981' };
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
  filtersContainer: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersScroll: {
    marginBottom: 12,
  },
  filterGroup: {
    marginRight: 24,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C757D',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: 'Inter',
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 32,
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    minWidth: 80,
    minHeight: 32,
    fontFamily: 'Inter',
  },
  applyFiltersButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
  },
  applyFiltersText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
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
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  summaryContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: 12,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  tableContainer: {
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
  table: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C757D',
    textTransform: 'uppercase',
    fontFamily: 'Inter',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#FAFBFC',
  },
  tableRowText: {
    fontSize: 12,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  // Column widths
  bookingIdColumn: {
    width: 80,
  },
  createdColumn: {
    width: 70,
  },
  statusColumn: {
    width: 90,
  },
  serviceColumn: {
    width: 80,
  },
  zoneColumn: {
    width: 60,
  },
  partnerColumn: {
    width: 70,
  },
  totalColumn: {
    width: 50,
    textAlign: 'right',
  },
  statusCell: {
    justifyContent: 'center',
  },
  statusIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Inter',
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
    fontFamily: 'Inter',
  },
});

export default OwnerBookingsScreen;