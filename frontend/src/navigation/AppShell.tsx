import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const Tab = createBottomTabNavigator();

// Customer Screens - using actual home screen
const CustomerHomeComponent = CustomerHomeScreen;

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

// Partner Screens - using actual home screen
const PartnerHomeComponent = PartnerHomeScreen;

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

function PartnerEarningsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.screenTitle}>Earnings</Text>
      <Text style={styles.screenSubtitle}>Track your earnings and payments</Text>
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

// Owner Screens - using actual home screen
const OwnerHomeComponent = OwnerHomeScreen;

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
});