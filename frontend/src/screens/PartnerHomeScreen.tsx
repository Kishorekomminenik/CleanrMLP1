import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'auth_token';

interface Job {
  jobId: string;
  service: string;
  eta: number;
}

interface PartnerDashboard {
  status: 'online' | 'offline';
  verification: 'pending' | 'verified';
  queue: Job[];
}

export default function PartnerHomeScreen() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/partner/home`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load dashboard');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setError('Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleAvailability = async () => {
    if (!dashboard) return;

    if (dashboard.verification === 'pending') {
      Alert.alert('Verification Required', 'Complete your profile verification to go online');
      return;
    }

    setToggleLoading(true);
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const newStatus = dashboard.status === 'online' ? 'offline' : 'online';

      const response = await fetch(`${BACKEND_URL}/api/partner/availability`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setDashboard(prev => prev ? { ...prev, status: newStatus } : null);
        Alert.alert('Status Updated', `You are now ${newStatus}`);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
      Alert.alert('Error', 'Network error');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchDashboard();
  };

  const handleQuickAction = (action: string) => {
    Alert.alert(action, `${action} feature coming soon!`);
  };

  const renderJobItem = ({ item }: { item: Job }) => (
    <View style={styles.jobItem}>
      <View style={styles.jobInfo}>
        <Text style={styles.jobService}>{item.service}</Text>
        <Text style={styles.jobId}>Job #{item.jobId}</Text>
      </View>
      <View style={styles.jobEta}>
        <Ionicons name="time-outline" size={16} color="#6C757D" />
        <Text style={styles.jobEtaText}>{item.eta} min</Text>
      </View>
    </View>
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

  if (!dashboard) {
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

  const isPending = dashboard.verification === 'pending';
  const isOnline = dashboard.status === 'online';

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[]}
        renderItem={() => null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <>
            {/* Pending Banner */}
            {isPending && (
              <View style={styles.pendingBanner} testID="partnerPendingBanner">
                <Ionicons name="warning" size={20} color="#856404" />
                <Text style={styles.pendingBannerText}>
                  Verification pending. Online disabled.
                </Text>
              </View>
            )}

            {/* Status Card */}
            <View style={styles.statusCard} testID="partnerStatusCard">
              <View style={styles.statusHeader}>
                <Text style={styles.statusTitle}>
                  You are {isOnline ? 'Online' : 'Offline'}
                </Text>
                <View style={[
                  styles.statusIndicator,
                  isOnline ? styles.statusOnline : styles.statusOffline
                ]} />
              </View>
              <Text style={styles.statusSubtitle}>
                {isOnline 
                  ? 'Ready to receive jobs' 
                  : isPending 
                    ? 'Complete verification to go online'
                    : 'Tap to go online and start earning'
                }
              </Text>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  isPending && styles.toggleButtonDisabled,
                  isOnline && styles.toggleButtonOnline
                ]}
                onPress={toggleAvailability}
                disabled={isPending || toggleLoading}
                testID="partnerOnlineToggle"
              >
                {toggleLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons 
                      name={isOnline ? 'pause' : 'play'} 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.toggleButtonText}>
                      {isPending ? 'Verification Required' : isOnline ? 'Go Offline' : 'Go Online'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Job Queue */}
            <View style={styles.queueSection}>
              <Text style={styles.sectionTitle}>Job Queue</Text>
              <View style={styles.queueContainer} testID="partnerJobList">
                {dashboard.queue.length === 0 ? (
                  <View style={styles.emptyQueue}>
                    <Ionicons name="briefcase-outline" size={48} color="#6C757D" />
                    <Text style={styles.emptyQueueTitle}>No jobs yet</Text>
                    <Text style={styles.emptyQueueText}>
                      {isPending 
                        ? 'Complete verification to start receiving jobs'
                        : isOnline
                          ? 'Jobs will appear here when customers book'
                          : 'Go online to start receiving jobs'
                      }
                    </Text>
                  </View>
                ) : (
                  dashboard.queue.map((job) => (
                    <View key={job.jobId} style={styles.jobItem}>
                      <View style={styles.jobInfo}>
                        <Text style={styles.jobService}>{job.service}</Text>
                        <Text style={styles.jobId}>Job #{job.jobId}</Text>
                      </View>
                      <View style={styles.jobEta}>
                        <Ionicons name="time-outline" size={16} color="#6C757D" />
                        <Text style={styles.jobEtaText}>{job.eta} min</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActions} testID="partnerQuickActions">
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => handleQuickAction('Training')}
                >
                  <Ionicons name="school-outline" size={24} color="#3A8DFF" />
                  <Text style={styles.quickActionText}>Training</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => handleQuickAction('Earnings')}
                >
                  <Ionicons name="wallet-outline" size={24} color="#3A8DFF" />
                  <Text style={styles.quickActionText}>Earnings</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
      />
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFE69C',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  pendingBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  statusCard: {
    backgroundColor: '#F8F9FA',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusOnline: {
    backgroundColor: '#10B981',
  },
  statusOffline: {
    backgroundColor: '#6C757D',
  },
  statusSubtitle: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 20,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  toggleButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  toggleButtonOnline: {
    backgroundColor: '#EF4444',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  queueSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  queueContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  emptyQueue: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyQueueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyQueueText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 22,
  },
  jobItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  jobInfo: {
    flex: 1,
  },
  jobService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  jobId: {
    fontSize: 14,
    color: '#6C757D',
  },
  jobEta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobEtaText: {
    fontSize: 14,
    color: '#6C757D',
  },
  quickActionsSection: {
    margin: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F4F7',
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A8DFF',
    marginTop: 8,
  },
});