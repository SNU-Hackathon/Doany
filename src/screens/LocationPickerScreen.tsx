// Location picker screen for selecting target locations

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LocationStore } from '../services/locationStore';
import { getPlaceDetails, reverseGeocode, searchPlaces } from '../services/places';
import { TargetLocation } from '../types';

// Platform-specific map imports
let MapView: any;
let Marker: any;
let Region: any;

if (Platform.OS === 'web') {
  // Web: use @vis.gl/react-google-maps
  try {
    const { Map, APIProvider } = require('@vis.gl/react-google-maps');
    MapView = Map;
    Marker = ({ children, ...props }: any) => children;
    Region = { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  } catch (error) {
    console.warn('[LocationPicker] @vis.gl/react-google-maps not available, using fallback');
    MapView = ({ children, ...props }: any) => <View {...props}>{children}</View>;
    Marker = ({ children }: any) => <View>{children}</View>;
    Region = { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  }
} else {
  // Native: use react-native-maps
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Region = Maps.Region;
  } catch (error) {
    console.warn('[LocationPicker] react-native-maps not available, using fallback');
    MapView = ({ children, ...props }: any) => <View {...props}>{children}</View>;
    Marker = ({ children }: any) => <View>{children}</View>;
    Region = { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  }
}

type LocationPickerScreenProps = {
  route?: {
    params?: {
      returnTo?: string;
    };
  };
};

interface PlacePrediction {
  placeId: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export default function LocationPickerScreen({ route }: LocationPickerScreenProps) {
  const navigation = useNavigation();
  const { returnTo } = route?.params || {};
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<TargetLocation | null>(null);
  const [mapRegion, setMapRegion] = useState<any>({
    latitude: 37.5665,
    longitude: 126.9780,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  
  // Refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const { checkGoogleMapsApiKey } = await import('../services/places');
        if (!checkGoogleMapsApiKey()) {
          Alert.alert(
            'Google Maps API Key Missing',
            'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY environment variable and restart the app.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('[LocationPicker] Failed to check API key:', error);
      }
    };
    
    checkApiKey();
  }, []);

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPredictions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setSearching(true);

    try {
      const results = await searchPlaces(query);
      if (abortControllerRef.current?.signal.aborted) return;
      
      setPredictions(results);
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) return;
      
      console.error('[LocationPicker] Search error:', error);
      if (error instanceof Error && error.message.includes('not authorized')) {
        Alert.alert(
          'API Key Not Authorized',
          'Enable Places API + Billing. Use API restriction = Places API only.'
        );
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setSearching(false);
      }
    }
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  }, [performSearch]);

  // Handle prediction selection
  const handlePredictionSelect = useCallback(async (prediction: PlacePrediction) => {
    setLoading(true);
    try {
      const placeDetails = await getPlaceDetails(prediction.placeId);
      setSelectedLocation(placeDetails);
      
      // Center map on selected location
      setMapRegion({
        latitude: placeDetails.lat,
        longitude: placeDetails.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      setSearchQuery(placeDetails.name);
      setPredictions([]);
    } catch (error) {
      console.error('[LocationPicker] Failed to get place details:', error);
      Alert.alert('Error', 'Failed to get location details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle current location
  const handleUseCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access to use your current location.'
        );
        return;
      }

      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      
      // Try to get address from coordinates
      let address: string | undefined;
      try {
        const result = await reverseGeocode(latitude, longitude);
        address = result || undefined;
      } catch (error) {
        console.log('[LocationPicker] Reverse geocoding failed, using coordinates only');
      }

      const currentLocation: TargetLocation = {
        name: 'Current Location',
        lat: latitude,
        lng: longitude,
        address,
      };

      setSelectedLocation(currentLocation);
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      setSearchQuery('Current Location');
      setPredictions([]);
    } catch (error) {
      console.error('[LocationPicker] Failed to get current location:', error);
      Alert.alert('Error', 'Failed to get your current location. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle location confirmation
  const handleConfirmLocation = useCallback(() => {
    if (!selectedLocation) {
      Alert.alert('No Location Selected', 'Please select a location first.');
      return;
    }

    // Store the selected location in global state
    LocationStore.setLocation(selectedLocation);
    console.log('[LocationPicker] Location stored and returning:', selectedLocation);
    
    // Navigate back
    navigation.goBack();
  }, [selectedLocation, navigation]);

  // Open in external Google Maps
  const handleOpenInGoogleMaps = useCallback(() => {
    if (!selectedLocation) return;

    const { lat, lng, name } = selectedLocation;
    let url: string;

    if (Platform.OS === 'ios') {
      url = `maps://?q=${encodeURIComponent(name)}&ll=${lat},${lng}`;
    } else {
      url = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
    }

    Linking.openURL(url).catch(() => {
      // Fallback to web version
      const webUrl = `https://maps.google.com/?q=${lat},${lng}`;
      Linking.openURL(webUrl);
    });
  }, [selectedLocation]);

  // Render prediction item
  const renderPrediction = useCallback(({ item }: { item: PlacePrediction }) => (
    <TouchableOpacity
      style={{ backgroundColor: 'white', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
      onPress={() => handlePredictionSelect(item)}
    >
      <Text style={{ color: '#1F2937', fontWeight: '500' }}>{item.description}</Text>
    </TouchableOpacity>
  ), [handlePredictionSelect]);

  // Memoized map component
  const MapComponent = useMemo(() => {
    if (Platform.OS === 'web') {
      // Web: use vis.gl with APIProvider
      const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!API_KEY) {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
            <Text style={{ color: '#6B7280', textAlign: 'center' }}>
              Google Maps API key not configured for web
            </Text>
          </View>
        );
      }

      return (
        <View style={{ flex: 1 }}>
          {/* Web map placeholder - in real implementation, wrap with APIProvider */}
          <View style={{ flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', textAlign: 'center' }}>
              Map View (Web)\n{selectedLocation ? `Selected: ${selectedLocation.name}` : 'No location selected'}
            </Text>
            {selectedLocation && (
              <View style={{ marginTop: 16, padding: 12, backgroundColor: 'white', borderRadius: 8 }}>
                <Text style={{ fontWeight: 'bold' }}>Coordinates:</Text>
                <Text>{selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}</Text>
              </View>
            )}
          </View>
        </View>
      );
    } else {
      // Native: use react-native-maps
      return (
        <MapView
          style={{ flex: 1 }}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {selectedLocation && (
            <Marker
              coordinate={{
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lng,
              }}
              title={selectedLocation.name}
              description={selectedLocation.address}
            />
          )}
        </MapView>
      );
    }
  }, [mapRegion, selectedLocation]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#2563EB', padding: 16, paddingTop: 60 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Select Location</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Search Input */}
      <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, color: '#1F2937' }}
            placeholder="Search for a place (e.g., GymBox, Starbucks)"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
          />
          {searching && <ActivityIndicator size="small" color="#3B82F6" />}
        </View>
      </View>

      {/* Current Location Button */}
      <TouchableOpacity
        style={{ margin: 16, backgroundColor: '#10B981', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        onPress={handleUseCurrentLocation}
        disabled={loading}
      >
        <Ionicons name="location" size={20} color="white" />
        <Text style={{ color: 'white', fontWeight: '600', marginLeft: 8 }}>Use Current Location</Text>
        {loading && <ActivityIndicator size="small" color="white" style={{ marginLeft: 8 }} />}
      </TouchableOpacity>

      {/* Search Results */}
      {predictions.length > 0 && (
        <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <FlatList
            data={predictions}
            renderItem={renderPrediction}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={false}
          />
        </View>
      )}

      {/* Map View */}
      <View style={{ flex: 1 }}>
        {MapComponent}
      </View>

      {/* Bottom Sheet - Location Details & Confirm */}
      {selectedLocation && (
        <View style={{ backgroundColor: 'white', padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 4 }}>
              {selectedLocation.name}
            </Text>
            {selectedLocation.address && (
              <Text style={{ color: '#6B7280', marginBottom: 8 }}>{selectedLocation.address}</Text>
            )}
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>
              {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#6B7280', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              onPress={handleOpenInGoogleMaps}
            >
              <Ionicons name="map-outline" size={20} color="white" />
              <Text style={{ color: 'white', fontWeight: '600', marginLeft: 8 }}>Preview in Maps</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#2563EB', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              onPress={handleConfirmLocation}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={{ color: 'white', fontWeight: '600', marginLeft: 8 }}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
