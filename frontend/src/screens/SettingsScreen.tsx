import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface NotificationPreferences {
  bookingNotifications: boolean;
  promoNotifications: boolean;
  marketingEmails: boolean;
  smsNotifications: boolean;
}

interface GeneralSettings {
  notifications: NotificationPreferences;
  defaultAddress?: string;
  preferredPaymentMethod?: string;
}

const SettingsScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<GeneralSettings>({
    notifications: {
      bookingNotifications: true,
      promoNotifications: true,
      marketingEmails: false,
      smsNotifications: true,
    }
  });

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!user?.token) return;

    try {
      setLoading(true);
      // Mock settings loading - in real app would fetch from API
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSetting = (key: keyof NotificationPreferences, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => {
          // Handle logout
          Alert.alert('Info', 'Logout functionality would be implemented here');
        }}
      ]
    );
  };

  const SettingRow: React.FC<{
    title: string;
    subtitle?: string;
    value?: boolean;
    onPress?: () => void;
    onToggle?: (value: boolean) => void;
    showArrow?: boolean;
    testID?: string;
  }> = ({ title, subtitle, value, onPress, onToggle, showArrow = false, testID }) => (
    <TouchableOpacity 
      style={styles.settingRow} 
      onPress={onPress}
      disabled={!onPress && !onToggle}
      testID={testID}
    >
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.settingAction}>
        {onToggle && (
          <Switch
            value={value || false}
            onValueChange={onToggle}
            trackColor={{ false: '#E5E7EB', true: '#3A8DFF' }}
            thumbColor={value ? '#FFFFFF' : '#F3F4F6'}
          />
        )}
        {showArrow && (
          <Ionicons name="chevron-forward" size={20} color="#6C757D" />
        )}
      </View>
    </TouchableOpacity>
  );

  const getAccountSections = () => {
    if (user?.role === 'customer') {
      return (
        <>
          {/* Addresses Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Addresses</Text>
            <SettingRow
              title="Saved Addresses"
              subtitle="Manage your saved locations"
              onPress={() => Alert.alert('Info', 'Saved addresses would open here')}
              showArrow
            />
            <SettingRow
              title="Default Address"
              subtitle={settings.defaultAddress || "Not set"}
              onPress={() => Alert.alert('Info', 'Default address selection would open here')}
              showArrow
            />
          </View>

          {/* Payment Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <SettingRow
              title="Payment Methods"
              subtitle="Manage your cards and payment options"
              onPress={() => Alert.alert('Info', 'Payment methods would open here')}
              showArrow
            />
            <SettingRow
              title="SHINE Credits"
              subtitle="View and manage your credits"
              onPress={() => Alert.alert('Info', 'Credits management would open here')}
              showArrow
            />
          </View>
        </>
      );
    }

    if (user?.role === 'owner') {
      return (
        <>
          {/* Business Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business</Text>
            <SettingRow
              title="Pricing Rules"
              subtitle="View platform pricing configuration"
              onPress={() => Alert.alert('Info', 'Pricing rules would open here')}
              showArrow
            />
            <SettingRow
              title="Service Areas"
              subtitle="Manage operational zones"
              onPress={() => Alert.alert('Info', 'Service areas would open here')}
              showArrow
            />
            <SettingRow
              title="Partner Management"
              subtitle="Oversee partner operations"
              onPress={() => Alert.alert('Info', 'Partner management would open here')}
              showArrow
            />
          </View>

          {/* Analytics Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analytics</Text>
            <SettingRow
              title="Revenue Reports"
              subtitle="Download detailed revenue reports"
              onPress={() => Alert.alert('Info', 'Revenue reports would open here')}
              showArrow
            />
            <SettingRow
              title="Performance Metrics"
              subtitle="View platform performance data"
              onPress={() => Alert.alert('Info', 'Performance metrics would open here')}
              showArrow
            />
          </View>
        </>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Manage your {user?.role || 'account'} preferences
          </Text>
        </View>

        {/* Role-specific sections */}
        {getAccountSections()}

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <SettingRow
            title="Booking notifications"
            subtitle="Updates about your bookings"
            value={settings.notifications.bookingNotifications}
            onToggle={(value) => updateNotificationSetting('bookingNotifications', value)}
          />
          <SettingRow
            title="Promotional notifications"
            subtitle="Deals and special offers"
            value={settings.notifications.promoNotifications}
            onToggle={(value) => updateNotificationSetting('promoNotifications', value)}
          />
          <SettingRow
            title="SMS notifications"
            subtitle="Urgent updates via text message"
            value={settings.notifications.smsNotifications}
            onToggle={(value) => updateNotificationSetting('smsNotifications', value)}
          />
          <SettingRow
            title="Marketing emails"
            subtitle="Tips, promotions, and updates"
            value={settings.notifications.marketingEmails}
            onToggle={(value) => updateNotificationSetting('marketingEmails', value)}
          />
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <SettingRow
            title="Edit Profile"
            subtitle="Update your personal information"
            onPress={() => Alert.alert('Info', 'Profile editing would open here')}
            showArrow
          />
          <SettingRow
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => Alert.alert('Info', 'Password change would open here')}
            showArrow
          />
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <SettingRow
            title="Help Center"
            subtitle="FAQs and support articles"
            onPress={() => Alert.alert('Info', 'Help center would open here')}
            showArrow
          />
          <SettingRow
            title="Contact Support"
            subtitle="Get help with your account"
            onPress={() => Alert.alert('Info', 'Support contact would open here')}
            showArrow
          />
          <SettingRow
            title="Rate the App"
            subtitle="Share your feedback"
            onPress={() => Alert.alert('Info', 'App rating would open here')}
            showArrow
          />
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <SettingRow
            title="Terms of Service"
            subtitle="User agreement and terms"
            onPress={() => Alert.alert('Info', 'Terms of service would open here')}
            showArrow
          />
          <SettingRow
            title="Privacy Policy"
            subtitle="How we handle your data"
            onPress={() => Alert.alert('Info', 'Privacy policy would open here')}
            showArrow
          />
          <SettingRow
            title="Licenses"
            subtitle="Open source licenses"
            onPress={() => Alert.alert('Info', 'Licenses would open here')}
            showArrow
          />
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <SettingRow
            title="Export Data"
            subtitle="Download your account data"
            onPress={() => Alert.alert('Info', 'Data export would be handled here')}
            showArrow
          />
          <SettingRow
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={() => Alert.alert('Warning', 'Account deletion would be handled here')}
            showArrow
          />
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>SHINE App v1.0.0</Text>
        </View>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    marginHorizontal: 20,
    fontFamily: 'Inter',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  settingAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  versionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
});

export default SettingsScreen;