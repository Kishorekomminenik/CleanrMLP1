import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'auth_token';

interface OwnerTiles {
  activeJobs: number;
  partnersOnline: number;
  supportOpen: number;
  gmvToday: number;
}

interface TileData {
  title: string;
  value: number;
  icon: string;
  color: string;
  format?: 'number' | 'currency';
}

export default function OwnerHomeScreen() {
  const [tiles, setTiles] = useState<OwnerTiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTiles();
  }, []);

  const fetchTiles = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/owner/tiles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTiles(data);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load dashboard');
      }
    } catch (error) {
      console.error('Error fetching tiles:', error);
      setError('Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTiles();
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchTiles();
  };

  const handleTilePress = (tileTitle: string) => {
    // In production, these would navigate to detailed reports
    console.log(`Tile pressed: ${tileTitle}`);
  };

  const formatValue = (value: number, format?: 'number' | 'currency'): string => {
    if (format === 'currency') {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const renderTile = (tile: TileData) => (
    <TouchableOpacity
      key={tile.title}
      style={styles.tile}
      onPress={() => handleTilePress(tile.title)}
      activeOpacity={0.7}
    >
      <View style={styles.tileHeader}>
        <Ionicons name={tile.icon as any} size={24} color={tile.color} />
      </View>
      <Text style={styles.tileValue}>
        {formatValue(tile.value, tile.format)}
      </Text>
      <Text style={styles.tileTitle}>{tile.title}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!tiles) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>No dashboard data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tileData: TileData[] = [
    {
      title: 'Active Jobs',
      value: tiles.activeJobs,
      icon: 'briefcase',
      color: '#3A8DFF',
    },
    {
      title: 'Partners Online',
      value: tiles.partnersOnline,
      icon: 'people',
      color: '#10B981',
    },
    {
      title: 'Support Tickets',
      value: tiles.supportOpen,
      icon: 'help-circle',
      color: '#F59E0B',
    },
    {
      title: 'GMV Today',
      value: tiles.gmvToday,
      icon: 'trending-up',
      color: '#8B5CF6',
      format: 'currency',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Owner Dashboard</Text>
          <Text style={styles.headerSubtitle}>Real-time platform overview</Text>
        </View>

        {/* Tiles Grid */}
        <View style={styles.tilesGrid} testID="ownerTilesGrid">
          {tileData.map(renderTile)}
        </View>

        {/* Chart Stub */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Bookings (7d)</Text>
          <View style={styles.chartStub} testID="ownerBookingsChart">
            <Ionicons name="bar-chart" size={48} color="#6C757D" />
            <Text style={styles.chartStubTitle}>Chart Coming Soon</Text>
            <Text style={styles.chartStubText}>
              Detailed booking analytics will be available here
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsSection}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.quickStats}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>98.5%</Text>
              <Text style={styles.quickStatLabel}>Uptime</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>4.8</Text>
              <Text style={styles.quickStatLabel}>Avg Rating</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>12m</Text>
              <Text style={styles.quickStatLabel}>Avg Response</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6C757D',
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  tile: {
    width: '47%',
    backgroundColor: '#F2F4F7',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  tileHeader: {
    marginBottom: 12,
  },
  tileValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  tileTitle: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    fontWeight: '500',
  },
  chartSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  chartStub: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F2F4F7',
    borderStyle: 'dashed',
  },
  chartStubTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C757D',
    marginTop: 16,
    marginBottom: 8,
  },
  chartStubText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 22,
  },
  quickStatsSection: {
    margin: 16,
    marginBottom: 32,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A8DFF',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
});