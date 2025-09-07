import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { NavigationService, LogoutService } from '../services/navigationService';

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
  const { user, logout: authLogout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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
    
    // Handle Android back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    // Update navigation service when changes occur
    if (hasUnsavedChanges) {
      NavigationService.markUnsaved('settings');
    } else {
      NavigationService.markSaved('settings');
    }
  }, [hasUnsavedChanges]);

  const handleBackPress = async (): Promise<boolean> => {
    return await NavigationService.handleBackPress('PAGE-18-SETTINGS');
  };

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
    setHasUnsavedChanges(true);
  };

  const saveSettings = async () => {
    if (!user?.token) return;

    try {
      setLoading(true);
      
      // API call to save settings would go here
      console.log('Saving settings:', settings);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHasUnsavedChanges(false);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (err) {
      console.error('Failed to save settings:', err);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Emit telemetry
    console.log('[TELEMETRY] auth.logout.tap', { pageId: 'PAGE-18-SETTINGS', role: user?.role });
    
    const confirmed = await LogoutService.showLogoutConfirmation();
    if (!confirmed) return;

    try {
      setLoading(true);
      
      // Use LogoutService for proper logout flow
      const success = await LogoutService.logout(user?.token || '', undefined);
      
      if (success) {
        // Clear unsaved changes
        setHasUnsavedChanges(false);
        NavigationService.markSaved('settings');
        
        // Use auth context logout (will handle navigation reset)
        await authLogout();
      }
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setLoading(false);
    }
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

    if (user?.role === 'partner') {
      return (
        <>
          {/* Platform Pricing Info */}
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
              subtitle="Set your available hours"
              onPress={() => Alert.alert('Info', 'Working hours settings would open here')}
              showArrow
            />
            <SettingRow
              title="Service Radius"
              subtitle="Set your service area"
              onPress={() => Alert.alert('Info', 'Service radius settings would open here')}
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

        {/* Save Button (if changes) */}
        {hasUnsavedChanges && (
          <View style={styles.saveButtonContainer}>
            <Button
              variant="primary"
              loading={loading}
              disabled={loading}
              onPress={saveSettings}
              testID="btnSaveSettings"
            >
              Save Changes
            </Button>
          </View>
        )}

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            variant="danger"
            loading={loading}
            disabled={loading}
            onPress={handleLogout}
            testID="btnLogout"
          >
            Log out
          </Button>
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
  saveButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  logoutContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
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