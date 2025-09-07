import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import MockApiService from '../services/mockData';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const screenWidth = Dimensions.get('window').width;

interface EarningsSummary {
  currency: string;
  thisWeek: {
    amount: number;
    jobs: number;
  };
  tipsYtd: number;
  availableBalance: number;
}

interface EarningsSeriesPoint {
  date: string;
  earnings: number;
  tips: number;
}

interface StatementItem {
  id: string;
  weekLabel: string;
  amount: number;
  trips: number;
  status: string;
  payoutDate: string;
}

interface StatementDetail {
  id: string;
  period: { from: string; to: string };
  currency: string;
  gross: number;
  tips: number;
  surge: number;
  adjustments: number;
  fees: number;
  taxWithheld: number;
  net: number;
  jobs: Array<{
    bookingId: string;
    date: string;
    service: string;
    duration: number;
    payout: number;
    tip: number;
  }>;
}

interface PayoutItem {
  id: string;
  date: string;
  amount: number;
  status: string;
  destination: string;
}

interface BankStatus {
  verified: boolean;
  bankLast4: string | null;
}

interface TaxContext {
  status: string;
  availableForms: string[];
  year: number;
}

interface PayoutCalculation {
  fareTotal: number;
  takeRatePercent: number;
  surgeSharePercent: number;
  payout: {
    base: number;
    surgeShare: number;
    bonuses: number;
    total: number;
    currency: string;
  };
}

export default function PartnerEarningsScreen() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [seriesData, setSeriesData] = useState<EarningsSeriesPoint[]>([]);
  const [statements, setStatements] = useState<StatementItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [payoutCalc, setPayoutCalc] = useState<PayoutCalculation | null>(null);
  const [bankStatus, setBankStatus] = useState<BankStatus | null>(null);
  const [taxContext, setTaxContext] = useState<TaxContext | null>(null);
  
  // UI states
  const [selectedRange, setSelectedRange] = useState<'Week' | 'Month' | 'Custom'>('Week');
  const [showStatementDetail, setShowStatementDetail] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<StatementDetail | null>(null);
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [processingPayout, setProcessingPayout] = useState(false);
  
  // Error states
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'partner') {
      loadEarningsData();
    }
  }, [user]);

  const loadEarningsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        loadSummary(),
        loadSeries(),
        loadStatements(),
        loadPayouts(),
        loadBankStatus(),
        loadTaxContext()
      ]);
    } catch (err) {
      setError('Failed to load earnings data');
      console.error('Earnings data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEarningsData();
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

  const loadSummary = async () => {
    const data = await makeAuthenticatedRequest('/partner/earnings/summary');
    setSummary(data);
  };

  const loadSeries = async () => {
    const data = await makeAuthenticatedRequest('/partner/earnings/series');
    setSeriesData(data.points || []);
  };

  const loadStatements = async () => {
    const data = await makeAuthenticatedRequest('/partner/earnings/statements');
    setStatements(data.items || []);
  };

  const loadPayouts = async () => {
    const data = await makeAuthenticatedRequest('/partner/payouts');
    setPayouts(data.items || []);
  };

  const loadBankStatus = async () => {
    const data = await makeAuthenticatedRequest('/partner/bank/status');
    setBankStatus(data);
  };

  const loadTaxContext = async () => {
    const data = await makeAuthenticatedRequest('/partner/tax/context');
    setTaxContext(data);
  };

  const loadStatementDetail = async (statementId: string) => {
    try {
      const data = await makeAuthenticatedRequest(`/partner/earnings/statements/${statementId}`);
      setSelectedStatement(data);
      setShowStatementDetail(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load statement details');
    }
  };

  const handleInstantPayout = async () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amount = parseFloat(cashoutAmount);
    if (amount > (summary?.availableBalance || 0)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    try {
      setProcessingPayout(true);
      
      const response = await makeAuthenticatedRequest('/partner/payouts/instant', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          currency: 'usd',
          idempotencyKey: `cashout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }),
      });

      Alert.alert(
        'Payout Initiated',
        `$${amount.toFixed(2)} is being transferred to your bank account. Fee: $${response.fee.toFixed(2)}`,
        [{ text: 'OK', onPress: () => {
          setShowCashout(false);
          setCashoutAmount('');
          loadEarningsData(); // Refresh data
        }}]
      );
    } catch (err: any) {
      let errorMessage = 'Payout failed. Please try again.';
      
      if (err.message.includes('409')) {
        errorMessage = 'Bank account not verified. Please complete bank setup first.';
      } else if (err.message.includes('402')) {
        errorMessage = 'Payout failed. Please contact support for large amount transfers.';
      }
      
      Alert.alert('Payout Failed', errorMessage);
    } finally {
      setProcessingPayout(false);
    }
  };

  const handleBankOnboarding = async () => {
    try {
      const response = await makeAuthenticatedRequest('/partner/bank/onboard', {
        method: 'POST',
        body: JSON.stringify({
          returnUrl: 'shine://earnings'
        }),
      });
      
      await WebBrowser.openBrowserAsync(response.url);
      
      // Refresh bank status after potential onboarding
      setTimeout(() => {
        loadBankStatus();
      }, 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to start bank onboarding');
    }
  };

  const handleTaxUpdate = async () => {
    try {
      const response = await makeAuthenticatedRequest('/partner/tax/onboard', {
        method: 'POST',
        body: JSON.stringify({
          returnUrl: 'shine://earnings'
        }),
      });
      
      await WebBrowser.openBrowserAsync(response.url);
      
      // Refresh tax context after potential update
      setTimeout(() => {
        loadTaxContext();
      }, 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to start tax setup');
    }
  };

  const downloadStatementPdf = async (statementId: string) => {
    try {
      const response = await makeAuthenticatedRequest(`/partner/earnings/statements/${statementId}/pdf`);
      await WebBrowser.openBrowserAsync(response.url);
    } catch (err) {
      Alert.alert('Error', 'Failed to download statement');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadEarningsData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Prepare chart data
  const chartData = {
    labels: seriesData.slice(-6).map(point => formatDate(point.date)),
    datasets: [
      {
        data: seriesData.slice(-6).map(point => point.earnings),
        color: (opacity = 1) => `rgba(58, 141, 255, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: seriesData.slice(-6).map(point => point.tips),
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Earnings', 'Tips'],
  };

  return (
    <SafeAreaView style={styles.container} testID="earnHeader">
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Earnings</Text>
          <Text style={styles.headerSubtitle}>Track your earnings and payments</Text>
        </View>

        {/* Summary Tiles */}
        <View style={styles.summaryTiles} testID="earnSummaryTiles">
          <View style={styles.summaryTile} testID="tileThisWeek">
            <Text style={styles.tileLabel}>This week</Text>
            <Text style={styles.tileAmount}>
              {formatCurrency(summary?.thisWeek.amount || 0)}
            </Text>
            <Text style={styles.tileSub}>
              {summary?.thisWeek.jobs || 0} jobs
            </Text>
          </View>
          
          <View style={styles.summaryTile} testID="tileTips">
            <Text style={styles.tileLabel}>Tips</Text>
            <Text style={styles.tileAmount}>
              {formatCurrency(summary?.tipsYtd || 0)}
            </Text>
            <Text style={styles.tileSub}>YTD</Text>
          </View>
          
          <View style={styles.summaryTile} testID="tileBalance">
            <Text style={styles.tileLabel}>Available balance</Text>
            <Text style={styles.tileAmount}>
              {formatCurrency(summary?.availableBalance || 0)}
            </Text>
          </View>
        </View>

        {/* Payout Rate Info */}
        <View style={styles.payoutInfoContainer}>
          <View style={styles.payoutInfoRow} testID="earnPayoutRateRow">
            <Text style={styles.payoutInfoLabel}>Payout Rate</Text>
            <Text style={styles.payoutInfoValue}>75% of fare</Text>
          </View>
          <View style={styles.payoutInfoRow} testID="earnSurgeShareRow">
            <Text style={styles.payoutInfoLabel}>Surge Share</Text>
            <Text style={styles.payoutInfoValue}>75% of surge premium</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow} testID="earnFilters">
          {(['Week', 'Month', 'Custom'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.filterButton,
                selectedRange === range && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedRange(range)}
              testID={`filterRange${range}`}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedRange === range && styles.filterButtonTextActive,
                ]}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View style={styles.chartContainer} testID="earnChart">
          <Text style={styles.sectionTitle}>Earnings over time</Text>
          {seriesData.length > 0 ? (
            <LineChart
              data={chartData}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(58, 141, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(108, 117, 125, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>No data available</Text>
            </View>
          )}
        </View>

        {/* Payout Card */}
        <View style={styles.card} testID="payoutsCard">
          <Text style={styles.cardTitle}>Payouts</Text>
          <Text style={styles.cardRow}>
            Next scheduled payout: Weekly → Bank {bankStatus?.bankLast4 ? `****${bankStatus.bankLast4}` : 'Not set'}
          </Text>
          <Text style={styles.cardRow}>
            Instant payout fee: 1.5% (min $0.50)
          </Text>
          
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!bankStatus?.verified || (summary?.availableBalance || 0) <= 0) && styles.buttonDisabled
              ]}
              onPress={() => setShowCashout(true)}
              disabled={!bankStatus?.verified || (summary?.availableBalance || 0) <= 0}
              testID="cashoutNowBtn"
            >
              <Text style={styles.primaryButtonText}>Cash out now</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBankOnboarding}
              testID="manageBankBtn"
            >
              <Text style={styles.secondaryButtonText}>
                {bankStatus?.verified ? 'Manage bank account' : 'Set up bank account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statements List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statements (Weekly)</Text>
          <View style={styles.list} testID="earnStatementsList">
            {statements.length > 0 ? (
              statements.map((statement) => (
                <TouchableOpacity
                  key={statement.id}
                  style={styles.listItem}
                  onPress={() => loadStatementDetail(statement.id)}
                  testID="statementViewBtn"
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>{statement.weekLabel}</Text>
                    <Text style={styles.listItemSubtitle}>
                      {statement.trips} trips • {statement.status}
                    </Text>
                  </View>
                  <View style={styles.listItemRight}>
                    <Text style={styles.listItemAmount}>
                      {formatCurrency(statement.amount)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#6C757D" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No statements yet.</Text>
            )}
          </View>
        </View>

        {/* Payout History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout History</Text>
          <View style={styles.list} testID="payoutHistoryList">
            {payouts.length > 0 ? (
              payouts.map((payout) => (
                <View key={payout.id} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>
                      {formatDate(payout.date)}
                    </Text>
                    <Text style={styles.listItemSubtitle}>
                      {payout.destination} • {payout.status}
                    </Text>
                  </View>
                  <Text style={styles.listItemAmount}>
                    {formatCurrency(payout.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No payouts yet.</Text>
            )}
          </View>
        </View>

        {/* Tax Card */}
        <View style={styles.card} testID="taxCard">
          <Text style={styles.cardTitle}>Taxes</Text>
          <Text style={styles.cardRow}>
            Tax profile: {taxContext?.status || 'Unknown'}
          </Text>
          <Text style={styles.cardRow}>
            Forms: {taxContext?.availableForms.join(', ') || 'None'}
          </Text>
          
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleTaxUpdate}
              testID="taxUpdateBtn"
            >
              <Text style={styles.secondaryButtonText}>Update tax info</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Cash Out Modal */}
      <Modal
        visible={showCashout}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCashout(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCashout(false)}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Cash Out</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Available balance: {formatCurrency(summary?.availableBalance || 0)}
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Amount to cash out</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  value={cashoutAmount}
                  onChangeText={setCashoutAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <Text style={styles.feeNote}>
              Fee: 1.5% (minimum $0.50)
            </Text>
            
            <TouchableOpacity
              style={[styles.primaryButton, processingPayout && styles.buttonDisabled]}
              onPress={handleInstantPayout}
              disabled={processingPayout}
            >
              {processingPayout ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Cash Out Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Statement Detail Modal */}
      <Modal
        visible={showStatementDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStatementDetail(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowStatementDetail(false)}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Statement Details</Text>
            <TouchableOpacity
              onPress={() => selectedStatement && downloadStatementPdf(selectedStatement.id)}
              testID="statementDownloadBtn"
            >
              <Ionicons name="download" size={24} color="#3A8DFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {selectedStatement && (
              <>
                <View style={styles.statementSummary}>
                  <Text style={styles.statementPeriod}>
                    {formatDate(selectedStatement.period.from)} - {formatDate(selectedStatement.period.to)}
                  </Text>
                  
                  <View style={styles.statementRow}>
                    <Text style={styles.statementLabel}>Gross earnings</Text>
                    <Text style={styles.statementAmount}>
                      {formatCurrency(selectedStatement.gross)}
                    </Text>
                  </View>
                  
                  <View style={styles.statementRow}>
                    <Text style={styles.statementLabel}>Tips</Text>
                    <Text style={styles.statementAmount}>
                      {formatCurrency(selectedStatement.tips)}
                    </Text>
                  </View>
                  
                  <View style={styles.statementRow}>
                    <Text style={styles.statementLabel}>Platform fee</Text>
                    <Text style={styles.statementAmount}>
                      -{formatCurrency(selectedStatement.fees)}
                    </Text>
                  </View>
                  
                  <View style={styles.statementRow}>
                    <Text style={styles.statementLabel}>Tax withheld</Text>
                    <Text style={styles.statementAmount}>
                      -{formatCurrency(selectedStatement.taxWithheld)}
                    </Text>
                  </View>
                  
                  <View style={[styles.statementRow, styles.statementTotal]}>
                    <Text style={styles.statementTotalLabel}>Net earnings</Text>
                    <Text style={styles.statementTotalAmount}>
                      {formatCurrency(selectedStatement.net)}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.jobsTitle}>Jobs ({selectedStatement.jobs.length})</Text>
                {selectedStatement.jobs.map((job, index) => (
                  <View key={job.bookingId} style={styles.jobItem}>
                    <View style={styles.jobLeft}>
                      <Text style={styles.jobService}>{job.service}</Text>
                      <Text style={styles.jobDate}>
                        {formatDate(job.date)} • {job.duration}min
                      </Text>
                    </View>
                    <View style={styles.jobRight}>
                      <Text style={styles.jobPayout}>
                        {formatCurrency(job.payout)}
                      </Text>
                      {job.tip > 0 && (
                        <Text style={styles.jobTip}>
                          +{formatCurrency(job.tip)} tip
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
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
  summaryTiles: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  tileLabel: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
  },
  tileAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  tileSub: {
    fontSize: 12,
    color: '#6C757D',
  },
  payoutInfoContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  payoutInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  payoutInfoLabel: {
    fontSize: 14,
    color: '#1E40AF',
    fontFamily: 'Inter',
  },
  payoutInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    fontFamily: 'Inter',
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  filterButtonActive: {
    backgroundColor: '#3A8DFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  chartContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartPlaceholder: {
    height: 220,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 16,
    color: '#6C757D',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  cardRow: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#3A8DFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  list: {
    gap: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  listItemLeft: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#6C757D',
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptyText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    paddingVertical: 32,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#1a1a1a',
    paddingVertical: 16,
  },
  feeNote: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
  },
  statementSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statementPeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  statementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statementLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
  statementAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  statementTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
    marginTop: 8,
  },
  statementTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statementTotalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  jobsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  jobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 8,
  },
  jobLeft: {
    flex: 1,
  },
  jobService: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  jobDate: {
    fontSize: 14,
    color: '#6C757D',
  },
  jobRight: {
    alignItems: 'flex-end',
  },
  jobPayout: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  jobTip: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
});