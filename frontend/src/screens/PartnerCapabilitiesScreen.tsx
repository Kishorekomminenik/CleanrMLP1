import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'auth_token';

interface Service {
  id: string;
  label: string;
  description: string;
}

export default function PartnerCapabilitiesScreen() {
  const { user } = useAuth();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const services: Service[] = [
    {
      id: 'basic',
      label: 'Basic Clean',
      description: 'Standard tidy & surfaces - dusting, vacuuming, basic bathroom and kitchen clean',
    },
    {
      id: 'deep',
      label: 'Deep Clean',
      description: 'Detailed clean incl. baseboards - comprehensive cleaning including inside appliances',
    },
    {
      id: 'bathroom',
      label: 'Bathroom-only',
      description: 'Bathrooms only - thorough cleaning of all bathroom fixtures and surfaces',
    },
  ];

  useEffect(() => {
    // In a real app, this would load current capabilities from the API
    // For now, we'll start with empty selection
  }, []);

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const saveCapabilities = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        setSaving(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/partner/capabilities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          servicesOffered: selectedServices,
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Success', 
          'Your service capabilities have been updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // In a real app, this would navigate back to partner profile
                console.log('Navigate back to partner profile');
              },
            },
          ]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to save capabilities');
      }
    } catch (error) {
      console.error('Error saving capabilities:', error);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  const renderServiceToggle = (service: Service) => {
    const isSelected = selectedServices.includes(service.id);
    
    return (
      <TouchableOpacity
        key={service.id}
        style={[
          styles.serviceToggle,
          isSelected && styles.serviceToggleSelected,
        ]}
        onPress={() => toggleService(service.id)}
        testID={`capToggle${service.label.replace(/[^a-zA-Z]/g, '')}`}
      >
        <View style={styles.serviceToggleContent}>
          <View style={styles.serviceToggleInfo}>
            <Text style={[
              styles.serviceToggleLabel,
              isSelected && styles.serviceToggleLabelSelected,
            ]}>
              {service.label}
            </Text>
            <Text style={styles.serviceToggleDescription}>
              {service.description}
            </Text>
          </View>
          <View style={[
            styles.toggleSwitch,
            isSelected && styles.toggleSwitchSelected,
          ]}>
            <View style={[
              styles.toggleIndicator,
              isSelected && styles.toggleIndicatorSelected,
            ]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="capHeader">
          Service Capabilities
        </Text>
        <Text style={styles.headerSubtitle}>
          Choose which cleaning services you offer. This helps us match you with the right jobs.
        </Text>
      </View>

      {/* Service Toggles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Services you offer</Text>
        <View style={styles.toggleList} testID="capToggleList">
          {services.map(renderServiceToggle)}
        </View>
      </View>

      {/* Selection Summary */}
      {selectedServices.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Selected Services ({selectedServices.length})</Text>
          <View style={styles.selectedTags}>
            {selectedServices.map(serviceId => {
              const service = services.find(s => s.id === serviceId);
              return service ? (
                <View key={serviceId} style={styles.selectedTag}>
                  <Text style={styles.selectedTagText}>{service.label}</Text>
                </View>
              ) : null;
            })}
          </View>
        </View>
      )}

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            selectedServices.length === 0 && styles.saveButtonDisabled,
            saving && styles.saveButtonLoading,
          ]}
          onPress={saveCapabilities}
          disabled={selectedServices.length === 0 || saving}
          testID="capSaveBtn"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>
                Save Capabilities
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        {selectedServices.length === 0 && (
          <Text style={styles.saveHint}>
            Select at least one service to save your capabilities
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6C757D',
    lineHeight: 22,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  toggleList: {
    gap: 12,
  },
  serviceToggle: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceToggleSelected: {
    borderColor: '#3A8DFF',
    backgroundColor: '#F0F8FF',
  },
  serviceToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceToggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  serviceToggleLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  serviceToggleLabelSelected: {
    color: '#3A8DFF',
  },
  serviceToggleDescription: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 18,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    padding: 3,
    justifyContent: 'center',
  },
  toggleSwitchSelected: {
    backgroundColor: '#3A8DFF',
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleIndicatorSelected: {
    transform: [{ translateX: 20 }],
  },
  summary: {
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A8DFF',
    marginBottom: 12,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTag: {
    backgroundColor: '#3A8DFF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedTagText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    marginTop: 'auto',
  },
  saveButton: {
    backgroundColor: '#3A8DFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  saveButtonLoading: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveHint: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 12,
  },
});