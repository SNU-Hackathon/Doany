// Import crypto polyfill for React Native
import 'react-native-get-random-values';

import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { LatLng, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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
  // Debug: Track which component is being executed
  console.log('[LocationSearch] Component loaded successfully');
  
  // Performance tracking
  console.time('[LocationSearch] Component Mount');
  
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<PlacesPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<ExpoLocation.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState<boolean>(true);
  const [showSuggestions, setShowSuggestions] = useState(false);

  type PlaceResult = {
    placeId: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distanceMeters?: number;
    rating?: number;
    userRatingsTotal?: number;
    openNow?: boolean;
  };

  // Generate UUID for session token (React Native compatible)
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const [sessionToken, setSessionToken] = useState<string>(generateUUID());
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isPinMode, setIsPinMode] = useState(false);
  const [centerLatLng, setCenterLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<PlaceResult | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastSearchMode, setLastSearchMode] = useState<'nearby' | 'text' | null>(null);
  const [lastSearchCenter, setLastSearchCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Refs for cleanup and debouncing
  const mountedRef = useRef(true);
  const flatListRef = useRef<FlatList<any> | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const markerRefs = useRef<Map<string, any>>(new Map());

  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const allowEnterSearch = (process.env.EXPO_PUBLIC_ALLOW_ENTER_SEARCH || '').toLowerCase() === 'true';
  const debugKeyboardLogs = (process.env.EXPO_PUBLIC_DEBUG_KEYBOARD || '').toLowerCase() === 'true';
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  if (debugKeyboardLogs) {
    console.log('[LocationSearch] Render count =', renderCountRef.current);
  }

  // API key helpers: unify sentinel checks and masking
  const API_KEY_SENTINELS = useMemo(() => [
    'YOUR_ANDROID_MAPS_API_KEY',
    'your-google-maps-api-key-here',
    'your_google_maps_api_key_here'
  ], []);

  const isApiKeyConfigured = useCallback((key?: string | null) => {
    if (!key) return false;
    return !API_KEY_SENTINELS.includes(key);
  }, [API_KEY_SENTINELS]);

  const maskApiKey = useCallback((key?: string | null) => {
    if (!key) return '';
    return key.length <= 8 ? 'API_KEY_HIDDEN' : `${key.slice(0, 4)}****${key.slice(-4)}`;
  }, []);

  // Abort controllers to cancel in-flight requests
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Validate Google Maps API key
  useEffect(() => {
    if (!isApiKeyConfigured(googleMapsApiKey)) {
      console.error('[LocationSearch] Google Maps API key is missing or invalid');
      setError('Google Maps API key not configured. Please check your environment variables.');
    } else {
      console.log('[LocationSearch] Google Maps API key is configured');
      setError(null);
    }
  }, [googleMapsApiKey, isApiKeyConfigured]);

  // Debug map rendering on Android
  useEffect(() => {
    if (results.length > 0 || isPinMode) {
      console.log('[LocationSearch] Map should be visible. Results:', results.length, 'Pin mode:', isPinMode);
      // Force map refresh on Android
      setTimeout(() => {
        if (mapRef.current) {
          console.log('[LocationSearch] Forcing map refresh for Android compatibility');
        }
      }, 1000);
    }
  }, [results.length, isPinMode]);

  function getLanguageAndCountry(): { language: string; country?: string } {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
    const [lang, region] = locale.split('-');
    const language = lang || 'en';
    const country = region?.toLowerCase();
    return { language, country };
  }

  const languageParams = useMemo(() => {
    const { language, country } = getLanguageAndCountry();
    const isKR = country === 'kr' || language === 'ko';
    return { language: language || 'en', components: isKR ? 'country:kr' : undefined };
  }, []);

  // Validate props and API key
  if (!onLocationSelect || typeof onLocationSelect !== 'function') {
    console.error('[LocationSearch] onLocationSelect prop is required and must be a function');
    return (
      <View className="bg-red-100 rounded-lg p-4 border border-red-300">
        <Text className="text-red-600 text-center">LocationSearch configuration error</Text>
      </View>
    );
  }

  if (!isApiKeyConfigured(googleMapsApiKey)) {
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
      console.timeEnd('[LocationSearch] Component Mount');
      try { autocompleteAbortRef.current?.abort(); } catch {}
      try { searchAbortRef.current?.abort(); } catch {}
    };
  }, []);

  // Request location permission on mount
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        console.time('[LocationSearch] Location Permission');
        console.log('[LocationSearch] Requesting location permission...');
        
        // Check device services first to avoid throwing
        const services = await ExpoLocation.hasServicesEnabledAsync();
        setLocationServicesEnabled(services);
        if (!services) {
          console.warn('[LocationSearch] Location services disabled at OS level');
        }

        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          setLocationPermission(true);
          console.log('[LocationSearch] Permission granted, getting current location...');
          
          let location = null as ExpoLocation.LocationObject | null;
          try {
            location = await ExpoLocation.getCurrentPositionAsync({
              accuracy: ExpoLocation.Accuracy.Balanced,
            });
          } catch (e) {
            console.warn('[LocationSearch] getCurrentPosition failed, trying last known position');
            try {
              const last = await ExpoLocation.getLastKnownPositionAsync();
              if (last) location = last as any;
            } catch {}
          }
          
          if (mountedRef.current) {
            if (location) {
              setUserLocation(location);
              console.log('[LocationSearch] Current location obtained:', {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                accuracy: location.coords.accuracy
              });
            } else {
              console.log('[LocationSearch] No current or last known location available');
            }
          }
        } else {
          console.log('[LocationSearch] Location permission denied');
        }
        
        console.timeEnd('[LocationSearch] Location Permission');
      } catch (error) {
        console.error('[LocationSearch] Location initialization error:', error);
        // Do not surface as a fatal error; fall back to default center
      }
    };

    initializeLocation();
  }, []);

  // Google Places Autocomplete (refined params)
  const fetchAutocomplete = async (input: string) => {
    if (!input || !mountedRef.current) return;

    console.time(`[LocationSearch] Places Search: "${input}"`);
    
    try {
      setLoading(true);
      setError(null);

      // Abort previous request and create new controller
      try { autocompleteAbortRef.current?.abort(); } catch {}
      const abortController = new AbortController();
      autocompleteAbortRef.current = abortController;
      const signal = abortController.signal;

      // Build API URL
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.set('input', input);
      url.searchParams.set('key', googleMapsApiKey as string);
      url.searchParams.set('types', 'establishment');
      url.searchParams.set('language', languageParams.language);
      if (languageParams.components) url.searchParams.set('components', languageParams.components);
      if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);
      
      // Add location bias if available
      if (userLocation) {
        const { latitude, longitude } = userLocation.coords;
        url.searchParams.set('location', `${latitude},${longitude}`);
        url.searchParams.set('radius', '50000');
        url.searchParams.set('origin', `${latitude},${longitude}`);
      }

      console.log('[LocationSearch] Making Places API request:', url.toString().replace(String(googleMapsApiKey), maskApiKey(googleMapsApiKey)));

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

  // Execute actual search via Places API with smart branching
  // Strategy: Use Nearby Search (rankby=distance) when user location available for better distance ranking
  // Fallback to Text Search (radius-based) when no user location for broader coverage
  const executeSearch = useCallback(async () => {
    if (!searchText.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setShowSuggestions(false);

      const hasUserLocation = !!userLocation;
      let url: URL;
      let parsed: PlaceResult[] = [];
      let mode: 'nearby' | 'text' = 'text';
      let center: { lat: number; lng: number } = { lat: 37.5665, lng: 126.9780 };

      if (hasUserLocation) {
        // Use Nearby Search when user location is available (better for distance ranking)
        // Places API: /place/nearbysearch/json with rankby=distance + keyword
        const { latitude, longitude } = userLocation!.coords;
        url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
        url.searchParams.set('location', `${latitude},${longitude}`);
        url.searchParams.set('rankby', 'distance');
        url.searchParams.set('keyword', searchText.trim());
        // widen results: avoid over-filtering types; rely on keyword
        
        console.log('[LocationSearch] Using Nearby Search with rankby=distance for user location');
        mode = 'nearby';
        center = { lat: latitude, lng: longitude };
      } else {
        // Use Text Search when no user location (fallback with radius)
        // Places API: /place/textsearch/json with query + radius
        url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        url.searchParams.set('query', searchText.trim());
        // Provide default center with radius to avoid API warnings
        const defaultLat = 37.5665;
        const defaultLng = 126.9780;
        url.searchParams.set('location', `${defaultLat},${defaultLng}`);
        // larger radius for more results, server still returns up to 20 per page
        url.searchParams.set('radius', '50000');
        
        console.log('[LocationSearch] Using Text Search with radius fallback (no user location)');
        mode = 'text';
        center = { lat: defaultLat, lng: defaultLng };
      }

      // Common parameters for both APIs
      url.searchParams.set('key', googleMapsApiKey as string);
      url.searchParams.set('language', languageParams.language);

      // Abort previous search request, then issue new one
      try { searchAbortRef.current?.abort(); } catch {}
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      console.log('[LocationSearch] Search URL:', url.toString().replace(String(googleMapsApiKey), maskApiKey(googleMapsApiKey)));
      const resp = await fetch(url.toString(), { signal: ctrl.signal });
      const data = await resp.json();
      
      if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
        console.error('[LocationSearch] Places API error:', data.status, data.error_message);
        throw new Error(data.error_message || `Places API error: ${data.status}`);
      }
      if (data.status !== 'OK') {
        console.warn('[LocationSearch] Places API unexpected status:', data.status, data.error_message);
        throw new Error(data.error_message || `Places API status: ${data.status}`);
      }

      // Parse results with API-specific field mapping
      parsed = (data.results || []).map((r: any) => ({
        placeId: r.place_id,
        name: r.name,
        // Nearby Search uses 'vicinity', Text Search uses 'formatted_address'
        address: hasUserLocation ? r.vicinity : r.formatted_address,
        latitude: r.geometry?.location?.lat,
        longitude: r.geometry?.location?.lng,
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total,
        openNow: r.opening_hours?.open_now,
      }));

      // Calculate distances and sort by distance
      if (hasUserLocation) {
        const { latitude: lat0, longitude: lng0 } = userLocation!.coords;
        console.log('[LocationSearch] Calculating distances from user location:', lat0, lng0);
        parsed = parsed
          .map((p) => {
            const distance = haversineDistanceMeters(lat0, lng0, p.latitude, p.longitude);
            console.log(`[LocationSearch] Distance to ${p.name}: ${distance}m`);
            return {
              ...p,
              distanceMeters: distance
            };
          })
          .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
      } else {
        // If no user location, still calculate distances from a default center (Seoul)
        const defaultLat = 37.5665;
        const defaultLng = 126.9780;
        console.log('[LocationSearch] Calculating distances from default center (Seoul):', defaultLat, defaultLng);
        parsed = parsed
          .map((p) => {
            const distance = haversineDistanceMeters(defaultLat, defaultLng, p.latitude, p.longitude);
            console.log(`[LocationSearch] Distance to ${p.name}: ${distance}m`);
            return {
              ...p,
              distanceMeters: distance
            };
          })
          .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
      }

      console.log('[LocationSearch] Final parsed results with distances:', parsed.map(p => ({ name: p.name, distance: p.distanceMeters })));

      setResults(parsed);
      setSelectedPlaceId(parsed[0]?.placeId || null);
      setNextPageToken(data.next_page_token || null);
      setLastSearchMode(mode);
      setLastSearchCenter(center);

      // Clear marker refs before adding new ones
      markerRefs.current.clear();

      // Fit to markers on map with a slight delay to ensure markers are rendered
      setTimeout(() => {
        if (parsed.length > 0) {
          fitToResults(parsed);
        }
      }, 100);
    } catch (e: any) {
      console.error('[LocationSearch] executeSearch error:', e);
      setError(e?.message || 'Failed to load results');
      // Fallback: show autocomplete suggestions if present
      if (predictions.length > 0) setShowSuggestions(true);
    } finally {
      setLoading(false);
      setSessionToken(generateUUID());
    }
  }, [searchText, googleMapsApiKey, languageParams, userLocation, predictions.length]);

  // Load next page when scrolled near the end
  const loadMoreResults = useCallback(async () => {
    if (!nextPageToken || isFetchingMore || !lastSearchMode) return;
    setIsFetchingMore(true);
    try {
      // Google next_page_token takes a moment to activate
      let attempts = 0;
      let data: any = null;
      while (attempts < 3) {
        const url = new URL(`https://maps.googleapis.com/maps/api/place/${lastSearchMode === 'nearby' ? 'nearbysearch' : 'textsearch'}/json`);
        url.searchParams.set('pagetoken', nextPageToken);
        url.searchParams.set('key', googleMapsApiKey as string);
        url.searchParams.set('language', languageParams.language);
        const resp = await fetch(url.toString());
        data = await resp.json();
        if (data.status === 'INVALID_REQUEST' && (data.error_message || '').toLowerCase().includes('next_page_token')) {
          await new Promise((r) => setTimeout(r, 1200));
          attempts++;
          continue;
        }
        break;
      }

      if (!data || data.status !== 'OK') {
        console.warn('[LocationSearch] Pagination stopped. Status:', data?.status);
        setNextPageToken(null);
        return;
      }

      const more: PlaceResult[] = (data.results || []).map((r: any) => ({
        placeId: r.place_id,
        name: r.name,
        address: lastSearchMode === 'nearby' ? r.vicinity : r.formatted_address,
        latitude: r.geometry?.location?.lat,
        longitude: r.geometry?.location?.lng,
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total,
        openNow: r.opening_hours?.open_now,
      }));

      const baseLat = lastSearchCenter?.lat ?? 37.5665;
      const baseLng = lastSearchCenter?.lng ?? 126.9780;
      const augmented = more.map((p) => ({
        ...p,
        distanceMeters: haversineDistanceMeters(baseLat, baseLng, p.latitude, p.longitude),
      }));
      // Deduplicate by placeId when appending pages
      setResults((prev) => {
        const seen = new Set(prev.map((x) => x.placeId));
        const merged = [...prev];
        for (const item of augmented) if (!seen.has(item.placeId)) merged.push(item);
        return merged;
      });
      setNextPageToken(data.next_page_token || null);
    } catch (e) {
      console.error('[LocationSearch] loadMoreResults error:', e);
    } finally {
      setIsFetchingMore(false);
    }
  }, [nextPageToken, isFetchingMore, lastSearchMode, googleMapsApiKey, languageParams.language, lastSearchCenter]);

  function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const fitToResults = useCallback((list?: PlaceResult[]) => {
    const src = list || results;
    if (!mapRef.current || !src || src.length === 0) return;
    try {
      const coords = src.map((r) => ({ latitude: r.latitude, longitude: r.longitude }));
      (mapRef.current as any).fitToCoordinates(coords, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    } catch {}
  }, [results]);

  const onMarkerPress = useCallback((placeId: string, coord: LatLng) => {
    setSelectedPlaceId(placeId);
    // Try scroll to item in list
    const idx = results.findIndex((r) => r.placeId === placeId);
    if (idx >= 0 && flatListRef.current) {
      try { (flatListRef.current as any).scrollToIndex({ index: idx, animated: true }); } catch {}
    }
    // Animate camera
    try { (mapRef.current as any)?.animateToRegion({ latitude: coord.latitude, longitude: coord.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 300); } catch {}
    // Show callout if ref exists
    const mRef = markerRefs.current.get(placeId);
    try { (mRef as any)?.showCallout?.(); } catch {}
  }, [results]);

  // Clean up marker refs when results change
  useEffect(() => {
    markerRefs.current.clear();
  }, [results]);

  // Set initial center when pin mode is activated
  useEffect(() => {
    if (isPinMode && mapRef.current) {
      // Get current map center or use user location as fallback
      const currentLat = userLocation?.coords.latitude || 37.5665;
      const currentLng = userLocation?.coords.longitude || 126.9780;
      setCenterLatLng({ lat: currentLat, lng: currentLng });
    }
  }, [isPinMode, userLocation]);

  const onItemPress = useCallback((placeId: string) => {
    const item = results.find((r) => r.placeId === placeId);
    if (!item) return;
    onMarkerPress(placeId, { latitude: item.latitude, longitude: item.longitude });
  }, [results, onMarkerPress]);

  // Clear all search history and markers
  const clearAllSearchData = useCallback(() => {
    setSearchText('');
    setPredictions([]);
    setResults([]);
    setShowSuggestions(false);
    setSelectedPlaceId(null);
    setSessionToken(generateUUID());
    setError(null);
    // Clear marker refs
    markerRefs.current.clear();
  }, []);

  const confirmPlace = useCallback(async (placeId: string) => {
    try {
      setLoading(true);
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('fields', 'place_id,name,formatted_address,geometry');
      url.searchParams.set('key', googleMapsApiKey as string);
      url.searchParams.set('language', languageParams.language);
      if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (data.status !== 'OK') throw new Error(data.error_message || data.status);
      const d = data.result;
      
      // Register the selected location
      onLocationSelect({
        name: d.name,
        placeId: d.place_id,
        latitude: d.geometry.location.lat,
        longitude: d.geometry.location.lng,
        address: d.formatted_address,
      });
      setSelectedMarker({
        placeId: d.place_id,
        name: d.name,
        address: d.formatted_address,
        latitude: d.geometry.location.lat,
        longitude: d.geometry.location.lng,
      });
      
      // Clear search data after successful selection
      clearAllSearchData();
    } catch (e: any) {
      console.error('[LocationSearch] confirmPlace error:', e);
      Alert.alert('Error', 'Failed to confirm this place. Try again.');
    } finally {
      setLoading(false);
    }
  }, [googleMapsApiKey, languageParams, sessionToken, onLocationSelect, clearAllSearchData]);

  const togglePinMode = useCallback(() => {
    setIsPinMode((prev) => !prev);
  }, []);

  const confirmCenterPin = useCallback(async () => {
    if (!centerLatLng) return;
    try {
      setLoading(true);
      const { lat, lng } = centerLatLng;
      const res = await ExpoLocation.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const addr = res && res[0] ? [res[0].name, res[0].street, res[0].city, res[0].region, res[0].country].filter(Boolean).join(' ') : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      onLocationSelect({ name: 'Dropped Pin', placeId: undefined, latitude: lat, longitude: lng, address: addr });
      setSelectedMarker({
        placeId: 'dropped-pin',
        name: 'Dropped Pin',
        address: addr,
        latitude: lat,
        longitude: lng,
      } as any);
      try {
        (mapRef.current as any)?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 300);
      } catch {}
      setIsPinMode(false);
    } catch (e) {
      Alert.alert('Error', 'Could not register this location.');
    } finally {
      setLoading(false);
    }
  }, [centerLatLng, onLocationSelect]);

  // Fetch place details
  const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
    console.time(`[LocationSearch] Place Details: ${placeId}`);
    
    try {
      setLoading(true);

      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('key', googleMapsApiKey as string);
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
        
        // Enhanced UX: Immediately show selected place as a result and fit map
        const placeResult: PlaceResult = {
          placeId: details.place_id,
          name: details.name || prediction.structured_formatting.main_text,
          address: details.formatted_address,
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
          distanceMeters: userLocation ? haversineDistanceMeters(
            userLocation.coords.latitude,
            userLocation.coords.longitude,
            details.geometry.location.lat,
            details.geometry.location.lng
          ) : undefined,
        };
        
        // Set as single result and fit map immediately
        setResults([placeResult]);
        setSelectedPlaceId(placeResult.placeId);
        setSelectedMarker(placeResult);
        
        // Fit map to the selected location with slight delay for rendering
        setTimeout(() => {
          fitToResults([placeResult]);
        }, 50);
        
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
      setSessionToken(generateUUID());
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
      setSelectedMarker({
        placeId: 'current-location',
        name: location.name,
        address: location.address || undefined as any,
        latitude,
        longitude,
      } as any);
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

  // Handle text input change - no automatic search
  const handleTextChange = (text: string) => {
    // Only update text. Do not toggle suggestions/results or dismiss keyboard while typing
    setSearchText(text);
  };

  const clearSearch = useCallback(() => {
    setSearchText('');
    setPredictions([]);
    setResults([]);
    setShowSuggestions(false);
    setSelectedPlaceId(null);
    setSessionToken(generateUUID());
    setError(null);
    // Clear marker refs
    markerRefs.current.clear();
  }, []);

  // Render prediction item
  const renderPrediction = ({ item }: { item: PlacesPrediction }) => (
    <TouchableOpacity
      className="flex-row items-center py-3 px-4 border-b border-gray-100"
      onPress={() => handlePlaceSelect(item)}
      activeOpacity={0.7}
    >
      <Ionicons name="location-outline" size={20} color="#6B7280" style={{ marginRight: 12 }} />
      <View className="flex-1">
        <Text className="text-gray-900 font-medium">{item.structured_formatting.main_text}</Text>
        {item.structured_formatting.secondary_text && (
          <Text className="text-gray-500 text-sm">{item.structured_formatting.secondary_text}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const distanceLabel = (m?: number) => {
    if (m === undefined || m === null) return "—";
    if (m < 1000) return `${Math.round(m)}`;
    return `${(m / 1000).toFixed(1)}`;
  };

  const renderResult = ({ item }: { item: PlaceResult }) => (
    <TouchableOpacity
      className="flex-row items-center py-3 px-4 border-b border-gray-100"
      onPress={() => onItemPress(item.placeId)}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      {/* Distance column - fixed width 80px for better visibility */}
      <View className="w-20 items-center justify-center">
        <Text className="text-base font-bold text-gray-900">{distanceLabel(item.distanceMeters)}</Text>
        <Text className="text-xs text-gray-500">
          {item.distanceMeters !== undefined && item.distanceMeters !== null ? (item.distanceMeters < 1000 ? 'm' : 'km') : ''}
        </Text>
      </View>
      
      {/* Location icon */}
      <Ionicons name="location" size={20} color={selectedPlaceId === item.placeId ? '#059669' : '#6B7280'} style={{ marginHorizontal: 12 }} />
      
      {/* Main content */}
      <View className="flex-1">
        <Text className="text-gray-900 font-semibold" numberOfLines={1}>{item.name}</Text>
        <Text className="text-gray-500 text-sm" numberOfLines={1}>{item.address}</Text>
        <View className="flex-row items-center mt-1">
          {item.rating !== undefined && (
            <View className="px-2 py-0.5 bg-yellow-100 rounded mr-2">
              <Text className="text-yellow-700 text-xs">★ {item.rating} ({item.userRatingsTotal || 0})</Text>
            </View>
          )}
          {item.openNow !== undefined && (
            <View className={`px-2 py-0.5 rounded ${item.openNow ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Text className={`${item.openNow ? 'text-green-700' : 'text-gray-600'} text-xs`}>{item.openNow ? 'Open now' : 'Closed'}</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        className="ml-2 px-3 py-2 bg-blue-600 rounded"
        onPress={() => confirmPlace(item.placeId)}
        accessibilityRole="button"
      >
        <Text className="text-white text-xs font-semibold">Select</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Render header component for FlatList (memoized to avoid re-mounting input)
  const renderHeader = useCallback(() => (
    <View className="bg-white">
      {/* Search row */}
      <View className="flex-row items-center mb-2">
        <View className="flex-1 flex-row items-center bg-gray-50 rounded-lg px-3 h-11 border border-gray-200">
          {/* Search Button */}
          <TouchableOpacity 
            onPress={() => {
              if (searchText.trim()) {
                // Trigger full search (paginated) when button is pressed
                Keyboard.dismiss();
                executeSearch();
              }
            }}
            accessibilityRole="button" 
            className="pr-2"
          >
            <Ionicons name="search" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <TextInput
            className="flex-1 ml-2 text-gray-900"
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={handleTextChange}
            onSubmitEditing={() => {
              if (!allowEnterSearch) return;
              if (searchText.trim()) {
                Keyboard.dismiss();
                executeSearch();
              }
            }}
            blurOnSubmit={false}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={{ paddingVertical: 0 }}
            onFocus={() => { if (debugKeyboardLogs) console.log('[LocationSearch] TextInput onFocus'); }}
            onBlur={() => { if (debugKeyboardLogs) console.log('[LocationSearch] TextInput onBlur'); }}
            onKeyPress={(e: any) => {
              // Guard: ignore Enter during IME composing to avoid premature submit/blur
              if (debugKeyboardLogs) console.log('[LocationSearch] onKeyPress', e.nativeEvent.key);
              if ((e.nativeEvent as any).isComposing && e.nativeEvent.key === 'Enter') {
                e.preventDefault?.();
              }
            }}
          />
          {searchText.length > 0 && !loading && (
            <TouchableOpacity 
              onPress={clearSearch} 
              accessibilityRole="button" 
              className="pl-2"
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          {loading && (
            <ActivityIndicator size="small" color="#3B82F6" className="ml-2" />
          )}
        </View>
        <TouchableOpacity
          className={`ml-2 px-3 h-11 rounded-lg flex-row items-center ${isPinMode ? 'bg-green-600' : 'bg-green-100'}`}
          onPress={togglePinMode}
          accessibilityRole="switch"
        >
          <Ionicons name="add" size={18} color={isPinMode ? '#FFFFFF' : '#047857'} />
          <Text className={`ml-1 text-sm font-semibold ${isPinMode ? 'text-white' : 'text-green-700'}`}>Pin</Text>
        </TouchableOpacity>
      </View>

      {/* Permission banner */}
      {(!locationPermission || !locationServicesEnabled) && (
        <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
          <Text className="text-yellow-700 text-xs">
            {locationServicesEnabled
              ? 'Location permission needed for accurate distance calculation. Using Seoul as reference point.'
              : 'Location services are disabled. Enable GPS to use your current location. Using Seoul as reference point.'}
          </Text>
          {!locationServicesEnabled && (
            <TouchableOpacity
              className="mt-2 px-2 py-1 bg-yellow-200 rounded"
              onPress={() => Linking.openSettings?.()}
            >
              <Text className="text-yellow-800 text-xs font-semibold">Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <Text className="text-red-800 font-medium mb-2">Configuration Error</Text>
          <Text className="text-red-700 text-sm">{error}</Text>
          <Text className="text-red-600 text-xs mt-2">
            Please check your .env file and ensure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set correctly.
          </Text>
        </View>
      )}

      {/* Search Input */}

      {/* Current Selection Display */}
      {currentLocation && (
        <TouchableOpacity
          className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2"
          activeOpacity={0.9}
          onPress={() => {
            const lat = currentLocation.latitude;
            const lng = currentLocation.longitude;
            // Drop/update selected marker and move camera
            setSelectedMarker({
              placeId: currentLocation.placeId || 'selected',
              name: currentLocation.name,
              address: currentLocation.address || '',
              latitude: lat,
              longitude: lng,
            } as any);
            try {
              (mapRef.current as any)?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 300);
            } catch {}
          }}
        >
          <Text className="text-green-700 text-sm font-semibold mb-1">✓ Selected Location</Text>
          <Text className="text-green-600 text-sm">{currentLocation.name}</Text>
          {currentLocation.address && (
            <Text className="text-green-500 text-xs">{currentLocation.address}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Map section for results, selected marker, or initial user location view */}
      {(results.length > 0 || isPinMode || !!userLocation || !!selectedMarker) && (
        <View className="rounded-xl overflow-hidden border border-gray-200 mb-2" style={{ height: 240, width: '100%' }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            // Android-specific settings
            showsBuildings={true}
            showsTraffic={false}
            showsIndoors={true}
            initialRegion={{
              latitude: userLocation?.coords.latitude || 37.5665,
              longitude: userLocation?.coords.longitude || 126.9780,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            onRegionChangeComplete={(region: any) => {
              if (isPinMode) setCenterLatLng({ lat: region.latitude, lng: region.longitude });
            }}
            onPress={() => {
              // Only close suggestions and dismiss keyboard (UX improvement)
              // Don't clear search results - user might want to keep them visible
              // Previous behavior: clearAllSearchData() was too aggressive
              setShowSuggestions(false);
              Keyboard.dismiss();
            }}
            showsUserLocation={locationPermission}
            onMapReady={() => {
              console.log('[LocationSearch] Map is ready and rendered');
            }}
          >
            {results.map((r) => (
              <Marker
                key={r.placeId}
                coordinate={{ latitude: r.latitude, longitude: r.longitude }}
                title={r.name}
                description={r.address}
                pinColor={selectedPlaceId === r.placeId ? '#059669' : '#2563EB'}
                ref={(ref: any) => { if (ref) markerRefs.current.set(r.placeId, ref); }}
                onPress={() => onMarkerPress(r.placeId, { latitude: r.latitude, longitude: r.longitude })}
              />
            ))}
            {selectedMarker && (
              <Marker
                key={`selected-${selectedMarker.placeId || 'custom'}`}
                coordinate={{ latitude: selectedMarker.latitude, longitude: selectedMarker.longitude }}
                title={selectedMarker.name}
                description={selectedMarker.address}
                pinColor={'#059669'}
              />
            )}
          </MapView>
          
          {/* Map loading indicator */}
          <View className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1">
            <Text className="text-xs text-gray-600">🗺️ Map View</Text>
          </View>
          
          {/* Fit-to-bounds button */}
          {(results.length > 0 || !!selectedMarker) && (
            <TouchableOpacity
              onPress={() => fitToResults()}
              className="absolute right-3 top-3 bg-white/90 rounded-full px-3 py-2 border border-gray-200"
            >
              <Text className="text-gray-700 text-xs font-semibold">↙↗ Fit</Text>
            </TouchableOpacity>
          )}
          {/* Crosshair overlay for Pin mode */}
          {isPinMode && (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 24, height: 24, borderWidth: 2, borderColor: '#10B981', borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.1)' }} />
            </View>
          )}
        </View>
      )}

      {/* Pin mode confirmation */}
      {isPinMode && (
        <TouchableOpacity
          className="mb-2 bg-green-600 rounded-lg py-3"
          onPress={confirmCenterPin}
        >
          <Text className="text-white text-center font-semibold">Register this location</Text>
        </TouchableOpacity>
      )}

      {/* Suggestions Header - Only show when search button was pressed */}
      {showSuggestions && predictions.length > 0 && (
        <Text className="text-gray-600 text-sm font-medium mb-2">
          Search Results ({predictions.length})
        </Text>
      )}

      {/* Results Header - Only show when full search was executed */}
      {!showSuggestions && results.length > 0 && (
        <Text className="text-gray-700 text-sm font-semibold mb-2">
          Full Search Results ({results.length})
        </Text>
      )}

      {/* No Results */}
      {!showSuggestions && results.length === 0 && searchText.length > 0 && !loading && (
        <View className="py-4 px-4">
          <Text className="text-gray-500 text-center">No results for "{searchText}"</Text>
          <Text className="text-gray-400 text-xs text-center mt-1">Try another keyword</Text>
        </View>
      )}
    </View>
  ), [placeholder, searchText, allowEnterSearch, handleTextChange, debugKeyboardLogs]);

  return (
    <View className="bg-white">
      {renderHeader()}
      {/* Results list only: map/input stay fixed above */}
      {showSuggestions ? (
        <FlatList<PlacesPrediction>
          ref={flatListRef as any}
          data={predictions}
          renderItem={renderPrediction}
          keyExtractor={(item: any) => item.place_id}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews={false}
          style={{ maxHeight: 700 }}
          onEndReachedThreshold={0.5}
          onEndReached={loadMoreResults}
        />
      ) : (
        <FlatList<PlaceResult>
          ref={flatListRef as any}
          data={results}
          renderItem={renderResult}
          keyExtractor={(item: any) => item.placeId}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews={false}
          style={{ maxHeight: 700 }}
          onEndReachedThreshold={0.5}
          onEndReached={loadMoreResults}
        />
      )}
    </View>
  );
}