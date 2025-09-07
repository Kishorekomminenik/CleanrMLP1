import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface SupportTicket {
  id: string;
  user: string;
  role: string;
  category: string;
  status: string;
  createdAt: string;
  sla: number; // hours
}

interface SupportMetrics {
  open: number;
  avgSlaHours: number;
  escalated: number;
}

export default function OwnerSupportScreen() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'Open' | 'In Progress' | 'Closed'>('Open');
  const [searchQuery, setSearchQuery] = useState('');

  // Error state
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSupportData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tickets, statusFilter, searchQuery]);

  const loadSupportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        loadSupportQueue(),
        loadSupportMetrics()
      ]);
    } catch (err) {
      setError('Failed to load support data');
      console.error('Owner support data error:', err);
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

  const loadSupportQueue = async () => {
    const data = await makeAuthenticatedRequest('/owner/support/queue');
    setTickets(data.tickets || []);
  };

  const loadSupportMetrics = async () => {
    const data = await makeAuthenticatedRequest('/owner/support/metrics');
    setMetrics(data);
  };

  const applyFilters = () => {
    let filtered = [...tickets];

    // Apply status filter
    const statusMap = {
      'Open': 'open',
      'In Progress': 'progress',
      'Closed': 'closed'
    };
    filtered = filtered.filter(ticket => ticket.status === statusMap[statusFilter]);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.id.toLowerCase().includes(query) ||
        ticket.user.toLowerCase().includes(query) ||
        ticket.category.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await makeAuthenticatedRequest(`/support/issues/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          notes: `Status updated by ${user?.email}`
        }),
      });

      // Refresh data after update
      await loadSupportData();
      
      Alert.alert('Success', 'Ticket status updated successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to update ticket status');
    }
  };

  const processRefund = async (ticketId: string) => {
    Alert.alert(
      'Process Refund',
      'Are you sure you want to process a refund for this ticket?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Refund', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Mock refund processing
              await makeAuthenticatedRequest('/billing/refund', {
                method: 'POST',
                body: JSON.stringify({
                  bookingId: 'mock_booking_id',
                  amount: 50.0,
                  reason: 'Customer complaint resolution'
                }),
              });
              
              Alert.alert('Refund Processed', 'Refund has been issued as credit to customer account');
              await updateTicketStatus(ticketId, 'closed');
            } catch (err) {
              Alert.alert('Error', 'Failed to process refund');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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

  const getSlaColor = (sla: number) => {
    if (sla > 24) return '#EF4444'; // Red for >24h
    if (sla > 12) return '#F59E0B'; // Orange for >12h
    return '#10B981'; // Green for <12h
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'customer': return 'person';
      case 'partner': return 'briefcase';
      case 'owner': return 'business';
      default: return 'help-circle';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Loading support queue...</Text>
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
    <SafeAreaView style={styles.container} testID="supOwnerHeader">
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Support Queue</Text>
          <Text style={styles.headerSubtitle}>Monitor and manage customer support tickets</Text>
        </View>

        {/* Metrics Card */}
        {metrics && (
          <View style={styles.metricsCard} testID="supOwnerMetrics">
            <Text style={styles.metricsTitle}>Support Metrics</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metrics.open}</Text>
                <Text style={styles.metricLabel}>Open Tickets</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metrics.avgSlaHours.toFixed(1)}h</Text>
                <Text style={styles.metricLabel}>Avg Response Time</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                  {metrics.escalated}
                </Text>
                <Text style={styles.metricLabel}>Escalated</Text>
              </View>
            </View>
          </View>
        )}

        {/* Filters */}
        <View style={styles.filtersContainer} testID="supOwnerFilters">
          <View style={styles.statusFilters}>
            {(['Open', 'In Progress', 'Closed'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  statusFilter === status && styles.filterButtonActive,
                ]}
                onPress={() => setStatusFilter(status)}
                testID="supFilterStatus"
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    statusFilter === status && styles.filterButtonTextActive,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchBar} testID="supFilterSearch">
              <Ionicons name="search" size={20} color="#6C757D" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search ticket ID or user"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#6C757D"
              />
            </View>
          </View>
        </View>

        {/* Tickets Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Tickets ({filteredTickets.length})
          </Text>
          <View style={styles.ticketsTable} testID="supOwnerTable">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <View key={ticket.id} style={styles.ticketRow}>
                  <View style={styles.ticketHeader}>
                    <View style={styles.ticketInfo}>
                      <View style={styles.ticketId}>
                        <Text style={styles.ticketIdText}>
                          #{ticket.id.split('_')[1]?.substring(0, 8)}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(ticket.status) }
                          ]}
                        >
                          <Text style={styles.statusText}>{ticket.status}</Text>
                        </View>
                      </View>
                      <View style={styles.ticketUser}>
                        <Ionicons 
                          name={getRoleIcon(ticket.role)} 
                          size={16} 
                          color="#6C757D" 
                        />
                        <Text style={styles.ticketUserText}>{ticket.user}</Text>
                      </View>
                    </View>
                    <View style={styles.ticketSla}>
                      <Text 
                        style={[
                          styles.slaText,
                          { color: getSlaColor(ticket.sla) }
                        ]}
                      >
                        {ticket.sla.toFixed(1)}h
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ticketDetails}>
                    <Text style={styles.ticketCategory}>{ticket.category}</Text>
                    <Text style={styles.ticketDate}>
                      {formatDate(ticket.createdAt)}
                    </Text>
                  </View>

                  <View style={styles.ticketActions}>
                    {ticket.status === 'open' && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => updateTicketStatus(ticket.id, 'progress')}
                      >
                        <Text style={styles.actionButtonText}>Take Action</Text>
                      </TouchableOpacity>
                    )}
                    
                    {ticket.status === 'progress' && (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.refundButton]}
                          onPress={() => processRefund(ticket.id)}
                        >
                          <Text style={styles.refundButtonText}>Process Refund</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.closeButton]}
                          onPress={() => updateTicketStatus(ticket.id, 'closed')}
                        >
                          <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                <Text style={styles.emptyText}>No {statusFilter.toLowerCase()} tickets</Text>
                <Text style={styles.emptySubtext}>
                  {statusFilter === 'Open' 
                    ? 'All tickets have been addressed!' 
                    : `No ${statusFilter.toLowerCase()} tickets found.`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
    backgroundColor: '#FFFFFF',
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
  metricsCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  metricsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3A8DFF',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statusFilters: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3A8DFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C757D',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    marginTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  ticketsTable: {
    gap: 12,
  },
  ticketRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketId: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ticketIdText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
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
  ticketUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketUserText: {
    fontSize: 14,
    color: '#6C757D',
  },
  ticketSla: {
    alignItems: 'flex-end',
  },
  slaText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ticketDetails: {
    marginBottom: 16,
  },
  ticketCategory: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
    marginBottom: 4,
  },
  ticketDate: {
    fontSize: 12,
    color: '#6C757D',
  },
  ticketActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  refundButton: {
    backgroundColor: '#F59E0B',
  },
  refundButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#10B981',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
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
});