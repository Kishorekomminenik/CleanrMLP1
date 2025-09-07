import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Types
interface TopSearchTerm {
  term: string;
  count: number;
}

interface TopFavoritePartner {
  partnerId: string;
  count: number;
}

interface DiscoveryAnalytics {
  topSearches: TopSearchTerm[];
  topFavorites: TopFavoritePartner[];
}

const OwnerDiscoveryScreen: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<DiscoveryAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Fetch discovery analytics
  const fetchAnalytics = useCallback(async (isRefresh: boolean = false) => {
    if (!user?.token) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(
        `${BACKEND_URL}/api/analytics/discovery`,
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
        setAnalytics(data);
        setError(null);

        // Telemetry
        console.log('Telemetry: discovery.analytics.view', { 
          role: 'owner',
          topSearchesCount: data.topSearches?.length || 0,
          topFavoritesCount: data.topFavorites?.length || 0
        });
      } else if (response.status === 403) {
        setError('Access denied. Owner access required.');
      } else {
        setError('Failed to load analytics data');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, BACKEND_URL]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    fetchAnalytics(true);
  }, [fetchAnalytics]);

  // Load analytics on mount
  useEffect(() => {
    if (user?.role === 'owner') {
      fetchAnalytics(false);
    }
  }, [user?.role, fetchAnalytics]);

  // Helper function to get partner name from ID (mock)
  const getPartnerName = (partnerId: string): string => {
    const partnerNames: { [key: string]: string } = {
      'pa_101': 'Sparkle Pros',
      'pa_102': 'Shiny Homes',
      'pa_103': 'GreenThumb Lawn Care',
      'pa_104': 'Paws & Walk',
      'pa_105': 'Beauty At Home',
    };
    return partnerNames[partnerId] || partnerId;
  };

  // Render chart bar (simple horizontal bar chart)
  const renderChartBar = (label: string, value: number, maxValue: number, color: string) => {
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - 80; // Account for padding
    const barWidth = maxValue > 0 ? (value / maxValue) * chartWidth * 0.7 : 0;

    return (
      <View key={label} style={styles.chartBar}>
        <View style={styles.chartBarInfo}>
          <Text style={styles.chartBarLabel}>{label}</Text>
          <Text style={styles.chartBarValue}>{value}</Text>
        </View>
        <View style={styles.chartBarContainer}>
          <View 
            style={[
              styles.chartBarFill, 
              { backgroundColor: color, width: barWidth }
            ]} 
          />
        </View>
      </View>
    );
  };

  if (user?.role !== 'owner') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Ionicons name="lock-closed" size={64} color="#EF4444" />
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            This section is only available to owners.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !analytics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading discovery analytics...</Text>
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
        <View testID="discOwnerHeader" style={styles.header}>
          <Text style={styles.title}>Discovery Analytics</Text>
          <Text style={styles.subtitle}>Search trends and partner popularity</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Analytics Content */}
        {analytics && (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <Ionicons name="search" size={24} color="#3B82F6" />
                <Text style={styles.summaryNumber}>{analytics.topSearches.length}</Text>
                <Text style={styles.summaryLabel}>Search Terms</Text>
              </View>
              
              <View style={styles.summaryCard}>
                <Ionicons name="heart" size={24} color="#EF4444" />
                <Text style={styles.summaryNumber}>{analytics.topFavorites.length}</Text>
                <Text style={styles.summaryLabel}>Top Partners</Text>
              </View>
              
              <View style={styles.summaryCard}>
                <Ionicons name="trending-up" size={24} color="#10B981" />
                <Text style={styles.summaryNumber}>
                  {analytics.topSearches.reduce((sum, item) => sum + item.count, 0)}
                </Text>
                <Text style={styles.summaryLabel}>Total Searches</Text>
              </View>
            </View>

            {/* Top Searches Chart */}
            <View testID="discOwnerSearchChart" style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                <Ionicons name="bar-chart" size={20} color="#8B5CF6" /> Top Searches
              </Text>
              
              {analytics.topSearches.length > 0 ? (
                <View style={styles.chart}>
                  {analytics.topSearches.slice(0, 8).map((item) => {
                    const maxCount = Math.max(...analytics.topSearches.map(s => s.count));
                    return renderChartBar(item.term, item.count, maxCount, '#3B82F6');
                  })}
                </View>
              ) : (
                <View style={styles.emptyChart}>
                  <Text style={styles.emptyChartText}>No search data available</Text>
                </View>
              )}
            </View>

            {/* Top Favorites Chart */}
            <View testID="discOwnerFavChart" style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                <Ionicons name="heart" size={20} color="#EF4444" /> Most Favorited Partners
              </Text>
              
              {analytics.topFavorites.length > 0 ? (
                <View style={styles.chart}>
                  {analytics.topFavorites.slice(0, 8).map((item) => {
                    const maxCount = Math.max(...analytics.topFavorites.map(f => f.count));
                    const partnerName = getPartnerName(item.partnerId);
                    return renderChartBar(partnerName, item.count, maxCount, '#EF4444');
                  })}
                </View>
              ) : (
                <View style={styles.emptyChart}>
                  <Text style={styles.emptyChartText}>No favorites data available</Text>
                </View>
              )}
            </View>

            {/* Search Terms Table */}
            <View testID="discOwnerSearchTable" style={styles.tableContainer}>
              <Text style={styles.tableTitle}>Search Terms Log</Text>
              
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.termColumn]}>Term</Text>
                  <Text style={[styles.tableHeaderText, styles.countColumn]}>Count</Text>
                  <Text style={[styles.tableHeaderText, styles.trendColumn]}>Trend</Text>
                </View>
                
                {analytics.topSearches.map((item, index) => (
                  <View key={item.term} style={styles.tableRow}>
                    <Text style={[styles.tableRowText, styles.termColumn]}>{item.term}</Text>
                    <Text style={[styles.tableRowText, styles.countColumn]}>{item.count}</Text>
                    <View style={[styles.trendColumn, styles.trendCell]}>
                      <Ionicons 
                        name={index < 3 ? "trending-up" : "trending-down"} 
                        size={16} 
                        color={index < 3 ? "#10B981" : "#EF4444"} 
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Insights Section */}
            <View style={styles.insightsContainer}>
              <Text style={styles.insightsTitle}>
                <Ionicons name="bulb" size={20} color="#F59E0B" /> Insights
              </Text>
              
              <View style={styles.insightsList}>
                <View style={styles.insightItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.insightText}>
                    "cleaning" is the most popular search term ({analytics.topSearches[0]?.count || 0} searches)
                  </Text>
                </View>
                
                <View style={styles.insightItem}>
                  <Ionicons name="heart" size={20} color="#EF4444" />
                  <Text style={styles.insightText}>
                    {getPartnerName(analytics.topFavorites[0]?.partnerId || '')} is the most favorited partner
                  </Text>
                </View>
                
                <View style={styles.insightItem}>
                  <Ionicons name="trending-up" size={20} color="#3B82F6" />
                  <Text style={styles.insightText}>
                    Service discovery is growing with {analytics.topSearches.length} unique search terms
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
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
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    fontFamily: 'Inter',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  chartContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  chart: {
    gap: 12,
  },
  chartBar: {
    marginBottom: 8,
  },
  chartBarInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chartBarLabel: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  chartBarValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  chartBarContainer: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyChart: {
    padding: 40,
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter',
  },
  tableContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
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
  tableRowText: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  termColumn: {
    flex: 2,
  },
  countColumn: {
    flex: 1,
    textAlign: 'center',
  },
  trendColumn: {
    flex: 1,
    textAlign: 'center',
  },
  trendCell: {
    alignItems: 'center',
  },
  insightsContainer: {
    margin: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    padding: 20,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
});

export default OwnerDiscoveryScreen;