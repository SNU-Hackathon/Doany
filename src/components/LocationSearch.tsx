// Import crypto polyfill for React Native
import 'react-native-get-random-values';

import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Location } from '../types';

interface LocationSearchProps {
  onLocationSelect: (location: Location) => void;
  placeholder?: string;
  currentLocation?: Location | null;
}

interface PlacesPrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export default function LocationSearch({ 
  onLocationSelect, 
  placeholder = "Search for a location...",
  currentLocation = null
}: LocationSearchProps) {
  // Performance tracking
  console.time('[LocationSearch] Component Mount');
  
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<PlacesPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<ExpoLocation.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs for cleanup and debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Validate props and API key
  if (!onLocationSelect || typeof onLocationSelect !== 'function') {
    console.error('[LocationSearch] onLocationSelect prop is required and must be a function');
    return (
      <View className="bg-red-100 rounded-lg p-4 border border-red-300">
        <Text className="text-red-600 text-center">LocationSearch configuration error</Text>
      </View>
    );
  }

  if (!googleMapsApiKey || googleMapsApiKey === 'your-google-maps-api-key-here') {
    return (
      <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <Text className="text-yellow-700 text-sm font-semibold mb-1">⚠️ Google Places API Key Missing</Text>
        <Text className="text-yellow-600 text-xs mb-2">
          Location search requires a valid Google Maps API key with Places API enabled.
        </Text>
        <Text className="text-gray-600 text-xs">You can still enter location names manually.</Text>
      </View>
    );
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      console.timeEnd('[LocationSearch] Component Mount');
    };
  }, []);

  // Request location permission on mount
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        console.time('[LocationSearch] Location Permission');
        console.log('[LocationSearch] Requesting location permission...');
        
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          setLocationPermission(true);
          console.log('[LocationSearch] Permission granted, getting current location...');
          
          const location = await ExpoLocation.getCurrentPositionAsync({
            accuracy: ExpoLocation.Accuracy.Balanced,
          });
          
          if (mountedRef.current) {
            setUserLocation(location);
            console.log('[LocationSearch] Current location obtained:', {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              accuracy: location.coords.accuracy
            });
          }
        } else {
          console.log('[LocationSearch] Location permission denied');
        }
        
        console.timeEnd('[LocationSearch] Location Permission');
      } catch (error) {
        console.error('[LocationSearch] Location initialization error:', error);
        if (mountedRef.current) {
          setError('Could not access current location');
        }
      }
    };

    initializeLocation();
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback((text: string) => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear results if text is empty
    if (!text.trim()) {
      setPredictions([]);
      setShowSuggestions(false);
      setError(null);
      return;
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      searchPlaces(text.trim());
    }, 350); // 350ms debounce
  }, []);

  // Google Places Autocomplete API call
  const searchPlaces = async (input: string) => {
    if (!input || !mountedRef.current) return;

    console.time(`[LocationSearch] Places Search: "${input}"`);
    
    try {
      setLoading(true);
      setError(null);

      // Create new AbortController
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Build API URL
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.set('input', input);
      url.searchParams.set('key', googleMapsApiKey);
      url.searchParams.set('types', 'establishment|geocode');
      url.searchParams.set('language', 'en');
      
      // Add location bias if available
      if (userLocation) {
        const { latitude, longitude } = userLocation.coords;
        url.searchParams.set('location', `${latitude},${longitude}`);
        url.searchParams.set('radius', '50000'); // 50km radius
      }

      console.log('[LocationSearch] Making Places API request:', url.toString().replace(googleMapsApiKey, 'API_KEY_HIDDEN'));

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!mountedRef.current) return;

      // Enhanced error logging
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LocationSearch] Places API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('Content-Type'),
          body: errorText.substring(0, 200),
        });

        // Handle specific authorization errors
        if (response.status === 403 || errorText.includes('API key not authorized')) {
          throw new Error(`API authorization failed. Please check:\n1. Places API is enabled\n2. Billing is active\n3. API key restrictions are correct`);
        }

        throw new Error(`Places API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 'OK' && data.predictions) {
        setPredictions(data.predictions);
        setShowSuggestions(true);
        console.log(`[LocationSearch] Found ${data.predictions.length} predictions`);
      } else if (data.status === 'ZERO_RESULTS') {
        setPredictions([]);
        setShowSuggestions(true);
        console.log('[LocationSearch] No results found');
      } else {
        console.error('[LocationSearch] Places API returned error:', data);
        throw new Error(data.error_message || `Places API status: ${data.status}`);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[LocationSearch] Search request aborted');
        return;
      }

      console.error('[LocationSearch] Search error:', error);
      
      if (mountedRef.current) {
        setError(error.message || 'Failed to search places');
        setPredictions([]);
        setShowSuggestions(false);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      console.timeEnd(`[LocationSearch] Places Search: "${input}"`);
    }
  };

  // Fetch place details
  const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
    console.time(`[LocationSearch] Place Details: ${placeId}`);
    
    try {
      setLoading(true);

      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('key', googleMapsApiKey);
      url.searchParams.set('fields', 'place_id,name,formatted_address,geometry');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LocationSearch] Place Details API Error:', {
          status: response.status,
          body: errorText.substring(0, 200),
        });
        throw new Error(`Place details error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        console.log('[LocationSearch] Place details fetched successfully');
        return data.result;
      } else {
        console.error('[LocationSearch] Place details API error:', data);
        throw new Error(data.error_message || `Details API status: ${data.status}`);
      }

    } catch (error: any) {
      console.error('[LocationSearch] Place details fetch error:', error);
      throw error;
    } finally {
      setLoading(false);
      console.timeEnd(`[LocationSearch] Place Details: ${placeId}`);
    }
  };

  // Handle place selection
  const handlePlaceSelect = async (prediction: PlacesPrediction) => {
    console.time('[LocationSearch] Place Selection');
    
    try {
      Keyboard.dismiss();
      setShowSuggestions(false);
      setSearchText(prediction.description);

      const details = await fetchPlaceDetails(prediction.place_id);
      
      if (details && mountedRef.current) {
        const location: Location = {
          name: details.name || prediction.structured_formatting.main_text,
          placeId: details.place_id,
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
          address: details.formatted_address,
        };

        console.log('[LocationSearch] Selected location:', location);
        onLocationSelect(location);
      }

    } catch (error: any) {
      console.error('[LocationSearch] Place selection error:', error);
      Alert.alert(
        'Location Error',
        'Could not get details for this location. Please try another one.',
        [{ text: 'OK' }]
      );
    } finally {
      console.timeEnd('[LocationSearch] Place Selection');
    }
  };

  // Handle current location selection
  const handleUseCurrentLocation = async () => {
    if (!userLocation) return;

    console.time('[LocationSearch] Current Location Selection');
    
    try {
      setLoading(true);
      
      const { latitude, longitude } = userLocation.coords;
      
      const location: Location = {
        name: 'Current Location',
        latitude,
        longitude,
        placeId: undefined,
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      };

      console.log('[LocationSearch] Using current location:', location);
      onLocationSelect(location);
      setSearchText('Current Location');
      setShowSuggestions(false);

    } catch (error) {
      console.error('[LocationSearch] Current location selection error:', error);
      Alert.alert('Error', 'Could not use current location');
    } finally {
      setLoading(false);
      console.timeEnd('[LocationSearch] Current Location Selection');
    }
  };

  // Handle text input change
  const handleTextChange = (text: string) => {
    setSearchText(text);
    debouncedSearch(text);
  };

  // Render prediction item
  const renderPrediction = ({ item }: { item: PlacesPrediction }) => (
    <TouchableOpacity
      className="flex-row items-center py-3 px-4 border-b border-gray-100"
      onPress={() => handlePlaceSelect(item)}
      activeOpacity={0.7}
    >
      <Ionicons name="location-outline" size={20} color="#6B7280" className="mr-3" />
      <View className="flex-1">
        <Text className="text-gray-900 font-medium">{item.structured_formatting.main_text}</Text>
        {item.structured_formatting.secondary_text && (
          <Text className="text-gray-500 text-sm">{item.structured_formatting.secondary_text}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render header component for FlatList
  const renderHeader = () => (
    <View className="bg-white">
      {/* Search Input */}
      <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-gray-200">
        <Ionicons name="search" size={20} color="#6B7280" />
        <TextInput
          className="flex-1 ml-3 text-gray-900"
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={searchText}
          onChangeText={handleTextChange}
          onFocus={() => setShowSuggestions(searchText.length > 0)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && (
          <ActivityIndicator size="small" color="#6B7280" />
        )}
      </View>

      {/* Use Current Location Button */}
      {locationPermission && userLocation && !showSuggestions && (
        <TouchableOpacity
          className="flex-row items-center py-3 px-4 bg-blue-50 rounded-lg mb-2"
          onPress={handleUseCurrentLocation}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={20} color="#3B82F6" />
          <Text className="ml-3 text-blue-600 font-medium">Use Current Location</Text>
        </TouchableOpacity>
      )}

      {/* Error Display */}
      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
          <Text className="text-red-700 text-sm font-semibold mb-1">⚠️ Location Search Error</Text>
          <Text className="text-red-600 text-xs">{error}</Text>
        </View>
      )}

      {/* Current Selection Display */}
      {currentLocation && (
        <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
          <Text className="text-green-700 text-sm font-semibold mb-1">✓ Selected Location</Text>
          <Text className="text-green-600 text-sm">{currentLocation.name}</Text>
          {currentLocation.address && (
            <Text className="text-green-500 text-xs">{currentLocation.address}</Text>
          )}
        </View>
      )}

      {/* Suggestions Header */}
      {showSuggestions && predictions.length > 0 && (
        <Text className="text-gray-600 text-sm font-medium mb-2">Suggestions:</Text>
      )}

      {/* No Results */}
      {showSuggestions && predictions.length === 0 && searchText.length > 0 && !loading && (
        <View className="py-4 px-4">
          <Text className="text-gray-500 text-center">No locations found for "{searchText}"</Text>
          <Text className="text-gray-400 text-xs text-center mt-1">Try a different search term</Text>
        </View>
      )}
    </View>
  );

  return (
    <View className="bg-white">
      {/* Use FlatList to avoid VirtualizedList nesting warning */}
      <FlatList
        data={showSuggestions ? predictions : []}
        renderItem={renderPrediction}
        keyExtractor={(item) => item.place_id}
        ListHeaderComponent={renderHeader}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews={true}
        style={{ maxHeight: 400 }} // Limit height to prevent excessive scrolling
      />
    </View>
  );
}