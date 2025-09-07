import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Partner {
  id: string;
  lat: number;
  lng: number;
  rating: number;
  badges: string[];
}

interface SurgeData {
  active: boolean;
  multiplier: number;
}

export default function CustomerHomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [surgeData, setSurgeData] = useState<SurgeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (location) {
      fetchNearbyPartners();
      fetchSurgeStatus();
    }
  }, [location]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Please enable location services to find nearby partners',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Location.enableNetworkProviderAsync() }
          ]
        );
        // Use fallback location (city center)
        setLocation({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);
      setLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setError('Failed to get location');
      setLoading(false);
    }
  };

  const fetchNearbyPartners = async () => {
    if (!location) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/partners/nearby?lat=${location.coords.latitude}&lng=${location.coords.longitude}&radius_km=5`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPartners(data.partners || []);
      } else {
        setError('Failed to load nearby partners');
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      setError('Network error');
    }
  };

  const fetchSurgeStatus = async () => {
    if (!location) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/pricing/surge?lat=${location.coords.latitude}&lng=${location.coords.longitude}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSurgeData(data);
      }
    } catch (error) {
      console.error('Error fetching surge data:', error);
    }
  };

  const handleBookNow = () => {
    Alert.alert('Book Now', 'Service selection coming soon!');
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    requestLocationPermission();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A8DFF" />
          <Text style={styles.loadingText}>Finding your location...</Text>
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

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color="#6C757D" />
          <Text style={styles.errorTitle}>Location Required</Text>
          <Text style={styles.errorText}>Please enable location services to find nearby partners</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar} testID="homeSearchBar">
          <Ionicons name="search" size={20} color="#6C757D" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find services near me"
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#6C757D"
          />
        </View>
      </View>

      {/* Surge Banner */}
      {surgeData?.active && (
        <View style={styles.surgeBanner} testID="homeSurgeBanner">
          <Ionicons name="trending-up" size={20} color="#FF6B35" />
          <Text style={styles.surgeBannerText}>
            Surge Pricing x{surgeData.multiplier} - High demand in your area
          </Text>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          onMapReady={() => setMapLoading(false)}
          testID="homeMapView"
        >
          {/* User Location */}
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
            pinColor="#3A8DFF"
          />

          {/* Partner Markers */}
          {partners.map((partner) => (
            <Marker
              key={partner.id}
              coordinate={{
                latitude: partner.lat,
                longitude: partner.lng,
              }}
              title={`Partner ${partner.id}`}
              description={`Rating: ${partner.rating} ⭐ | ${partner.badges.join(', ')}`}
              pinColor="#10B981"
            />
          ))}
        </MapView>

        {/* Map Loading Overlay */}
        {mapLoading && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator size="large" color="#3A8DFF" />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        )}

        {/* No Partners Message */}
        {!mapLoading && partners.length === 0 && (
          <View style={styles.noPartnersOverlay}>
            <Ionicons name="people-outline" size={48} color="#6C757D" />
            <Text style={styles.noPartnersTitle}>No Partners Nearby</Text>
            <Text style={styles.noPartnersText}>
              We're expanding to your area soon! Try searching in a different location.
            </Text>
          </View>
        )}
      </View>

      {/* Book Now FAB */}
      <TouchableOpacity
        style={styles.bookNowFab}
        onPress={handleBookNow}
        testID="homeBookNowBtn"
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.bookNowText}>Book Now</Text>
      </TouchableOpacity>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  surgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  surgeBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6C757D',
  },
  noPartnersOverlay: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noPartnersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 12,
    marginBottom: 8,
  },
  noPartnersText: {
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
});