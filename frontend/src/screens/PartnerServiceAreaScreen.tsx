import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from 'react-native';

interface PartnerServiceAreaScreenProps {
  onBack: () => void;
}

const PartnerServiceAreaScreen: React.FC<PartnerServiceAreaScreenProps> = ({ onBack }) => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} testID="partnerAreaHeader">
            Service Area (Read-only)
          </Text>
          <Text style={styles.headerSubtitle}>
            Configure your service area settings in future updates
          </Text>
        </View>

        {/* Map Placeholder */}
        <View style={styles.mapContainer} testID="partnerAreaMap">
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>🗺️</Text>
            <Text style={styles.mapPlaceholderTitle}>Service Area Map</Text>
            <Text style={styles.mapPlaceholderSubtitle}>
              Your service radius and coverage area will be displayed here
            </Text>
          </View>
        </View>

        {/* Service Area Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Current Service Settings</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Max travel distance:</Text>
            <Text style={styles.infoValue}>10 km</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Service areas:</Text>
            <Text style={styles.infoValue}>Primary zone only</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Coverage type:</Text>
            <Text style={styles.infoValue}>Circular radius</Text>
          </View>
          
          <View style={styles.note}>
            <Text style={styles.noteText} testID="partnerAreaNote">
              📍 MVP default: 10km radius from your location. Advanced zone customization coming in future updates.
            </Text>
          </View>
        </View>

        {/* Future Features */}
        <View style={styles.futureCard}>
          <Text style={styles.futureTitle}>Coming Soon</Text>
          <View style={styles.futureList}>
            <Text style={styles.futureItem}>• Custom service zones</Text>
            <Text style={styles.futureItem}>• Pricing by distance</Text>
            <Text style={styles.futureItem}>• Peak hour areas</Text>
            <Text style={styles.futureItem}>• Exclude specific neighborhoods</Text>
            <Text style={styles.futureItem}>• Travel time optimization</Text>
          </View>
        </View>
      </ScrollView>

      {/* Back Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back to Profile</Text>
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
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderStyle: 'dashed',
  },
  mapPlaceholderText: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  mapPlaceholderSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  note: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#3A8DFF',
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

export default PartnerServiceAreaScreen;