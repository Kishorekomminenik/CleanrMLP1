import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList
} from 'react-native';

interface ZoneData {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  trend: 'up' | 'down' | 'stable';
}

interface OwnerZonesScreenProps {
  onBack: () => void;
}

const OwnerZonesScreen: React.FC<OwnerZonesScreenProps> = ({ onBack }) => {
  // Mock zone data
  const topZones: ZoneData[] = [
    { id: '1', name: 'Downtown SF', bookings: 156, revenue: 12450, trend: 'up' },
    { id: '2', name: 'Mission District', bookings: 134, revenue: 10720, trend: 'up' },
    { id: '3', name: 'SOMA', bookings: 98, revenue: 7840, trend: 'stable' },
    { id: '4', name: 'Castro', bookings: 76, revenue: 6080, trend: 'down' },
    { id: '5', name: 'Nob Hill', bookings: 65, revenue: 5200, trend: 'up' },
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return '#10B981';
      case 'down': return '#EF4444';
      default: return '#6C757D';
    }
  };

  const renderZoneItem = ({ item }: { item: ZoneData }) => (
    <View style={styles.zoneItem}>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneName}>{item.name}</Text>
        <View style={styles.trendContainer}>
          <Text style={styles.trendIcon}>{getTrendIcon(item.trend)}</Text>
        </View>
      </View>
      <View style={styles.zoneStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.bookings}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>${item.revenue.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.trendText, { color: getTrendColor(item.trend) }]}>
            {item.trend === 'up' ? '+12%' : item.trend === 'down' ? '-8%' : '0%'}
          </Text>
          <Text style={styles.statLabel}>Trend</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} testID="ownerZonesHeader">
            Zones Overview (Read-only)
          </Text>
          <Text style={styles.headerSubtitle}>
            Geographic performance analytics and insights
          </Text>
        </View>

        {/* Heatmap Placeholder */}
        <View style={styles.mapContainer} testID="ownerZonesMap">
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>🔥</Text>
            <Text style={styles.mapPlaceholderTitle}>Booking Heatmap</Text>
            <Text style={styles.mapPlaceholderSubtitle}>
              Visual representation of booking density across service areas
            </Text>
          </View>
        </View>

        {/* Overview Stats */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>This Month Overview</Text>
          <View style={styles.overviewStats}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>529</Text>
              <Text style={styles.overviewLabel}>Total Bookings</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>$42.3K</Text>
              <Text style={styles.overviewLabel}>Total Revenue</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>5</Text>
              <Text style={styles.overviewLabel}>Active Zones</Text>
            </View>
          </View>
        </View>

        {/* Top Zones List */}
        <View style={styles.zonesSection}>
          <Text style={styles.sectionTitle}>Top Performing Zones</Text>
          <View style={styles.zonesList} testID="ownerZonesList">
            <FlatList
              data={topZones}
              renderItem={renderZoneItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>

        {/* Insights Card */}
        <View style={styles.insightsCard}>
          <Text style={styles.insightsTitle}>📊 Key Insights</Text>
          <View style={styles.insightsList}>
            <Text style={styles.insightItem}>
              • Downtown SF is your highest performing zone with 25% month-over-month growth
            </Text>
            <Text style={styles.insightItem}>
              • Mission District shows strong weekend demand patterns
            </Text>
            <Text style={styles.insightItem}>
              • Castro area has 15% higher repeat customer rate
            </Text>
            <Text style={styles.insightItem}>
              • Consider expanding partner availability in SOMA during peak hours
            </Text>
          </View>
        </View>

        {/* Future Features */}
        <View style={styles.futureCard}>
          <Text style={styles.futureTitle}>Advanced Analytics Coming Soon</Text>
          <View style={styles.futureList}>
            <Text style={styles.futureItem}>• Real-time demand heatmaps</Text>
            <Text style={styles.futureItem}>• Predictive zone analytics</Text>
            <Text style={styles.futureItem}>• Partner density optimization</Text>
            <Text style={styles.futureItem}>• Seasonal trend analysis</Text>
            <Text style={styles.futureItem}>• Custom zone definitions</Text>
          </View>
        </View>
      </ScrollView>

      {/* Back Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6C757D',
  },
  mapContainer: {
    marginBottom: 24,
  },
  mapPlaceholder: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  mapPlaceholderText: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  mapPlaceholderSubtitle: {
    fontSize: 14,
    color: '#A16207',
    textAlign: 'center',
    lineHeight: 20,
  },
  overviewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewItem: {
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3A8DFF',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
  },
  zonesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  zonesList: {
    gap: 12,
  },
  zoneItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    fontSize: 16,
  },
  zoneStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6C757D',
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  insightsCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A8DFF',
    marginBottom: 12,
  },
  insightsList: {
    gap: 8,
  },
  insightItem: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 18,
  },
  futureCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  futureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 12,
  },
  futureList: {
    gap: 8,
  },
  futureItem: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 18,
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  backButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default OwnerZonesScreen;