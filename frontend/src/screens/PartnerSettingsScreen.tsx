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
  payoutNotifications: boolean;
  marketingEmails: boolean;
  smsNotifications: boolean;
}

interface PartnerSettings {
  availabilityHours: {
    start: string;
    end: string;
  };
  serviceRadius: number;
  autoAcceptBookings: boolean;
  notifications: NotificationPreferences;
}

const PartnerSettingsScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PartnerSettings>({
    availabilityHours: {
      start: '09:00',
      end: '17:00'
    },
    serviceRadius: 15,
    autoAcceptBookings: false,
    notifications: {
      bookingNotifications: true,
      payoutNotifications: true,
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
      // const response = await fetch(`${BACKEND_URL}/api/partner/settings`, {
      //   headers: { 'Authorization': `Bearer ${user.token}` }
      // });
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

  const InfoRow: React.FC<{
    icon: string;
    title: string;
    subtitle: string;
    testID?: string;
  }> = ({ icon, title, subtitle, testID }) => (
    <View style={styles.infoRow} testID={testID}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon as any} size={24} color="#3B82F6" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your partner preferences</Text>
        </View>

        {/* Pricing Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <InfoRow
            icon="information-circle"
            title="Platform Pricing"
            subtitle="Prices are set by SHINE. Your payouts are shown in Earnings."
            testID="setProPricingInfo"
          />
        </View>

        {/* Availability Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <SettingRow
            title="Working Hours"
            subtitle={`${settings.availabilityHours.start} - ${settings.availabilityHours.end}`}
            onPress={() => Alert.alert('Info', 'Working hours settings would open here')}
            showArrow
          />
          <SettingRow
            title="Service Radius"
            subtitle={`${settings.serviceRadius} km`}
            onPress={() => Alert.alert('Info', 'Service radius settings would open here')}
            showArrow
          />
          <SettingRow
            title="Auto-accept bookings"
            subtitle="Automatically accept bookings within your service area"
            value={settings.autoAcceptBookings}
            onToggle={(value) => setSettings(prev => ({ ...prev, autoAcceptBookings: value }))}
          />
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <SettingRow
            title="Booking notifications"
            subtitle="New bookings and updates"
            value={settings.notifications.bookingNotifications}
            onToggle={(value) => updateNotificationSetting('bookingNotifications', value)}
          />
          <SettingRow
            title="Payout notifications"
            subtitle="Payout confirmations and updates"
            value={settings.notifications.payoutNotifications}
            onToggle={(value) => updateNotificationSetting('payoutNotifications', value)}
          />
          <SettingRow
            title="SMS notifications"
            subtitle="Urgent updates via text message"
            value={settings.notifications.smsNotifications}
            onToggle={(value) => updateNotificationSetting('smsNotifications', value)}
          />
          <SettingRow
            title="Marketing emails"
            subtitle="Tips, promotions, and partner updates"
            value={settings.notifications.marketingEmails}
            onToggle={(value) => updateNotificationSetting('marketingEmails', value)}
          />
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <SettingRow
            title="Edit Profile"
            subtitle="Update your bio, photos, and services"
            onPress={() => Alert.alert('Info', 'Profile editing would open here')}
            showArrow
          />
          <SettingRow
            title="Verification Status"
            subtitle="Manage your verification documents"
            onPress={() => Alert.alert('Info', 'Verification status would open here')}
            showArrow
          />
          <SettingRow
            title="Background Check"
            subtitle="View your background check status"
            onPress={() => Alert.alert('Info', 'Background check status would open here')}
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
            title="Partner Training"
            subtitle="Access training materials"
            onPress={() => Alert.alert('Info', 'Training materials would open here')}
            showArrow
          />
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <SettingRow
            title="Terms of Service"
            subtitle="Partner agreement and terms"
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
            title="Tax Information"
            subtitle="1099 forms and tax documents"
            onPress={() => Alert.alert('Info', 'Tax information would open here')}
            showArrow
          />
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <SettingRow
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => Alert.alert('Info', 'Password change would open here')}
            showArrow
          />
          <SettingRow
            title="Delete Account"
            subtitle="Permanently delete your partner account"
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
          <Text style={styles.versionText}>SHINE Partner App v1.0.0</Text>
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
  infoRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 18,
    fontFamily: 'Inter',
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

export default PartnerSettingsScreen;