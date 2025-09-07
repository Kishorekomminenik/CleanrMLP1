import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import PartnerEarningsScreen from '../screens/PartnerEarningsScreen';
import CustomerSupportScreen from '../screens/CustomerSupportScreen';
import PartnerSupportScreen from '../screens/PartnerSupportScreen';
import OwnerSupportScreen from '../screens/OwnerSupportScreen';

const Tab = createBottomTabNavigator();

function CustomerHomeComponent() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.homeHeader}>
        <Text style={styles.homeTitle}>Find Services Near You</Text>
        <View style={styles.searchBar} testID="homeSearchBar">
          <Ionicons name="search" size={20} color="#6C757D" />
          <Text style={styles.searchPlaceholder}>Find services near me</Text>
        </View>
      </View>
      
      <View style={styles.mapPlaceholder} testID="homeMapView">
        <Ionicons name="map" size={48} color="#6C757D" />
        <Text style={styles.mapPlaceholderTitle}>Map View</Text>
        <Text style={styles.mapPlaceholderText}>
          Interactive map with nearby partners will appear here
        </Text>
      </View>

      <TouchableOpacity style={styles.bookNowFab} testID="homeBookNowBtn">
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.bookNowText}>Book Now</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function CustomerBookingsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>My Bookings</Text>
      <Text style={styles.screenSubtitle}>View your service bookings</Text>
    </SafeAreaView>
  );
}

function CustomerFavoritesScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Favorites</Text>
      <Text style={styles.screenSubtitle}>Your favorite service providers</Text>
    </SafeAreaView>
  );
}

function CustomerProfileScreen() {
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Profile</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Partner Screens - Simplified for demo  
function PartnerHomeComponent() {
  const { user } = useAuth();
  const isPending = user?.partner_status === 'pending';
  
  return (
    <SafeAreaView style={styles.screen}>
      {isPending && (
        <View style={styles.pendingBanner} testID="partnerPendingBanner">
          <Ionicons name="warning" size={20} color="#856404" />
          <Text style={styles.pendingBannerText}>
            Verification pending. Online disabled.
          </Text>
        </View>
      )}
      
      <View style={styles.statusCard} testID="partnerStatusCard">
        <Text style={styles.statusTitle}>
          You are {isPending ? 'Offline' : 'Offline'}
        </Text>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isPending && styles.toggleButtonDisabled
          ]}
          disabled={isPending}
          testID="partnerOnlineToggle"
        >
          <Text style={[styles.toggleButtonText, isPending && styles.toggleButtonTextDisabled]}>
            {isPending ? 'Verification Required' : 'Go Online'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.queueSection}>
        <Text style={styles.sectionTitle}>Job Queue</Text>
        <View style={styles.emptyQueue} testID="partnerJobList">
          <Ionicons name="briefcase-outline" size={48} color="#6C757D" />
          <Text style={styles.emptyQueueTitle}>No jobs yet</Text>
          <Text style={styles.emptyQueueText}>
            {isPending 
              ? 'Complete verification to start receiving jobs'
              : 'Go online to start receiving jobs'
            }
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PartnerJobsScreen() {
  const { user } = useAuth();
  const isPending = user?.partner_status === 'pending';

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Jobs</Text>
      {isPending ? (
        <View style={styles.disabledContainer}>
          <Text style={styles.disabledText}>
            Complete verification to start accepting jobs
          </Text>
        </View>
      ) : (
        <Text style={styles.screenSubtitle}>Available jobs will appear here</Text>
      )}
    </SafeAreaView>
  );
}


function PartnerProfileScreen() {
  const { logout, switchRole } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  const handleSwitchRole = async () => {
    Alert.alert(
      'Switch to Customer',
      'Do you want to switch to customer mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            const result = await switchRole();
            if (!result.success) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Profile</Text>
      <TouchableOpacity
        style={styles.switchButton}
        onPress={handleSwitchRole}
        testID="partnerSwitchToCustomerBtn"
      >
        <Text style={styles.switchButtonText}>Switch to Customer Mode</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Owner Screens - Simplified for demo
function OwnerHomeComponent() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.homeTitle}>Owner Dashboard</Text>
      
      <View style={styles.ownerTiles} testID="ownerTilesGrid">
        <View style={styles.ownerTile}>
          <Ionicons name="briefcase" size={24} color="#3A8DFF" />
          <Text style={styles.ownerTileNumber}>42</Text>
          <Text style={styles.ownerTileLabel}>Active Jobs</Text>
        </View>
        <View style={styles.ownerTile}>
          <Ionicons name="people" size={24} color="#10B981" />
          <Text style={styles.ownerTileNumber}>18</Text>
          <Text style={styles.ownerTileLabel}>Partners Online</Text>
        </View>
        <View style={styles.ownerTile}>
          <Ionicons name="help-circle" size={24} color="#F59E0B" />
          <Text style={styles.ownerTileNumber}>5</Text>
          <Text style={styles.ownerTileLabel}>Support Tickets</Text>
        </View>
        <View style={styles.ownerTile}>
          <Ionicons name="trending-up" size={24} color="#8B5CF6" />
          <Text style={styles.ownerTileNumber}>$2,450</Text>
          <Text style={styles.ownerTileLabel}>GMV Today</Text>
        </View>
      </View>

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
    </SafeAreaView>
  );
}

function OwnerReportsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Reports</Text>
      <Text style={styles.screenSubtitle}>Business performance reports</Text>
    </SafeAreaView>
  );
}

function OwnerAnalyticsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Analytics</Text>
      <Text style={styles.screenSubtitle}>Detailed business analytics</Text>
    </SafeAreaView>
  );
}

function OwnerSettingsScreen() {
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Settings</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export default function AppShell() {
  const { user } = useAuth();

  if (!user) return null;

  const getTabBarIcon = (name: string, focused: boolean) => {
    let iconName: keyof typeof Ionicons.glyphMap;

    if (user.role === 'customer') {
      switch (name) {
        case 'Home':
          iconName = focused ? 'home' : 'home-outline';
          break;
        case 'Bookings':
          iconName = focused ? 'list' : 'list-outline';
          break;
        case 'Favorites':
          iconName = focused ? 'heart' : 'heart-outline';
          break;
        case 'Support':
          iconName = focused ? 'help-circle' : 'help-circle-outline';
          break;
        case 'Profile':
          iconName = focused ? 'person' : 'person-outline';
          break;
        default:
          iconName = 'home';
      }
    } else if (user.role === 'partner') {
      switch (name) {
        case 'Home':
          iconName = focused ? 'grid' : 'grid-outline';
          break;
        case 'Jobs':
          iconName = focused ? 'clipboard' : 'clipboard-outline';
          break;
        case 'Earnings':
          iconName = focused ? 'wallet' : 'wallet-outline';
          break;
        case 'Support':
          iconName = focused ? 'help-circle' : 'help-circle-outline';
          break;
        case 'Profile':
          iconName = focused ? 'person' : 'person-outline';
          break;
        default:
          iconName = 'grid';
      }
    } else {
      // owner
      switch (name) {
        case 'Home':
          iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          break;
        case 'Reports':
          iconName = focused ? 'flag' : 'flag-outline';
          break;
        case 'Analytics':
          iconName = focused ? 'analytics' : 'analytics-outline';
          break;
        case 'Support':
          iconName = focused ? 'help-circle' : 'help-circle-outline';
          break;
        case 'Settings':
          iconName = focused ? 'settings' : 'settings-outline';
          break;
        default:
          iconName = 'bar-chart';
      }
    }

    return (
      <Ionicons
        name={iconName}
        size={24}
        color={focused ? '#3A8DFF' : '#6C757D'}
      />
    );
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => getTabBarIcon(route.name, focused),
        tabBarActiveTintColor: '#3A8DFF',
        tabBarInactiveTintColor: '#6C757D',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          paddingTop: 8,
          paddingBottom: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
      testID="globalBottomNav"
    >
        {user.role === 'customer' && (
          <>
            <Tab.Screen
              name="Home"
              component={CustomerHomeComponent}
              options={{ tabBarTestID: 'tabCustomerHome' }}
            />
            <Tab.Screen
              name="Bookings"
              component={CustomerBookingsScreen}
              options={{ tabBarTestID: 'tabCustomerBookings' }}
            />
            <Tab.Screen
              name="Favorites"
              component={CustomerFavoritesScreen}
              options={{ tabBarTestID: 'tabCustomerFavorites' }}
            />
            <Tab.Screen
              name="Support"
              component={CustomerSupportScreen}
              options={{ tabBarTestID: 'tabCustomerSupport' }}
            />
            <Tab.Screen
              name="Profile"  
              component={CustomerProfileScreen}
              options={{ tabBarTestID: 'tabCustomerProfile' }}
            />
          </>
        )}

        {user.role === 'partner' && (
          <>
            <Tab.Screen
              name="Home"
              component={PartnerHomeComponent}
              options={{ tabBarTestID: 'tabPartnerHome' }}
            />
            <Tab.Screen
              name="Jobs"
              component={PartnerJobsScreen}
              options={{ tabBarTestID: 'tabPartnerJobs' }}
            />
            <Tab.Screen
              name="Earnings"
              component={PartnerEarningsScreen}
              options={{ tabBarTestID: 'tabPartnerEarnings' }}
            />
            <Tab.Screen
              name="Support"
              component={PartnerSupportScreen}
              options={{ tabBarTestID: 'tabPartnerSupport' }}
            />
            <Tab.Screen
              name="Profile"
              component={PartnerProfileScreen}
              options={{ tabBarTestID: 'tabPartnerProfile' }}
            />
          </>
        )}

        {user.role === 'owner' && (
          <>
            <Tab.Screen
              name="Home"
              component={OwnerHomeComponent}
              options={{ tabBarTestID: 'tabOwnerHome' }}
            />
            <Tab.Screen  
              name="Reports"
              component={OwnerReportsScreen}
              options={{ tabBarTestID: 'tabOwnerReports' }}
            />
            <Tab.Screen
              name="Analytics"
              component={OwnerAnalyticsScreen}
              options={{ tabBarTestID: 'tabOwnerAnalytics' }}
            />
            <Tab.Screen
              name="Support"
              component={OwnerSupportScreen}
              options={{ tabBarTestID: 'tabOwnerSupport' }}
            />
            <Tab.Screen
              name="Settings"
              component={OwnerSettingsScreen}
              options={{ tabBarTestID: 'tabOwnerSettings' }}
            />
          </>
        )}
      </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 24,
  },
  pendingBanner: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFE69C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  pendingBannerText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  toggleCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  toggleButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 150,
    alignItems: 'center',
  },
  toggleButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButtonTextDisabled: {
    color: '#6C757D',
  },
  disabledContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  disabledText: {
    color: '#6C757D',
    fontSize: 16,
    textAlign: 'center',
  },
  ownerTiles: {
    flexDirection: 'row',
    gap: 16,
  },
  ownerTile: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  ownerTileNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3A8DFF',
    marginBottom: 8,
  },
  ownerTileLabel: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
  },
  switchButton: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  switchButtonText: {
    color: '#3A8DFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#DC3545',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // New styles for home screens
  homeHeader: {
    padding: 16,
  },
  homeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#6C757D',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    margin: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    borderWidth: 2,
    borderColor: '#F2F4F7',
    borderStyle: 'dashed',
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C757D',
    marginTop: 12,
    marginBottom: 8,
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 22,
  },
  bookNowFab: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    backgroundColor: '#3A8DFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  bookNowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusCard: {
    backgroundColor: '#F8F9FA',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  queueSection: {
    margin: 16,
  },
  emptyQueue: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
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
  chartSection: {
    margin: 16,
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
});