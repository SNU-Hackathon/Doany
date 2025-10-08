import * as ExpoLocation from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { TargetLocation } from '../types';

// Platform-specific map imports
let MapView: any;
let Marker: any;

if (Platform.OS === 'web') {
  // Web: use @vis.gl/react-google-maps
  try {
    const { Map, APIProvider, AdvancedMarker } = require('@vis.gl/react-google-maps');
    MapView = Map;
    Marker = AdvancedMarker;
  } catch (error) {
    console.warn('[MapPreview] @vis.gl/react-google-maps not available, using fallback');
    MapView = ({ children, ...props }: any) => <View {...props}>{children}</View>;
    Marker = ({ children }: any) => <View>{children}</View>;
  }
} else {
  // Native: use react-native-maps
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
  } catch (error) {
    console.warn('[MapPreview] react-native-maps not available, using fallback');
    MapView = ({ children, ...props }: any) => <View {...props}>{children}</View>;
    Marker = ({ children }: any) => <View>{children}</View>;
  }
}

interface MapPreviewProps {
  location?: TargetLocation | null;
  markers?: { lat: number; lng: number; title?: string }[];
  interactive?: boolean;
  fitToMarkers?: boolean;
  onPress: () => void;
}

export default function MapPreview({ location, markers = [], interactive = false, fitToMarkers = false, onPress }: MapPreviewProps) {
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [webZoom, setWebZoom] = useState(14);
  const mapRef = React.useRef<any>(null);
  const debugMaps = (process.env.EXPO_PUBLIC_DEBUG_MAPS || '').toLowerCase() === 'true';

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (typeof location?.lat === 'number' && typeof location?.lng === 'number') {
        setCenter({ latitude: location!.lat, longitude: location!.lng });
        return;
      }
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        if (!cancelled) setCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {}
    };
    init();
    return () => { cancelled = true; };
  }, [location?.lat, location?.lng]);

  useEffect(() => {
    if (!debugMaps) return;
    if (Platform.OS === 'android') {
      console.log('[MapPreview] Android maps debug enabled');
      console.log('[MapPreview] Ensure android.config.googleMaps.apiKey is set in app.json/app.config.*');
    }
  }, [debugMaps]);

  const mapRegion = useMemo(() => ({
    latitude: center?.latitude ?? 37.5665,
    longitude: center?.longitude ?? 126.9780,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }), [center]);

  // Fit to markers (avoid resetting when user interacts)
  useEffect(() => {
    if (!markers?.length) return;
    if (Platform.OS === 'web') {
      const lats = markers.map(m => m.lat);
      const lngs = markers.map(m => m.lng);
      const latMin = Math.min(...lats);
      const latMax = Math.max(...lats);
      const lngMin = Math.min(...lngs);
      const lngMax = Math.max(...lngs);
      const cLat = (latMin + latMax) / 2;
      const cLng = (lngMin + lngMax) / 2;
      if (!interactive) setCenter({ latitude: cLat, longitude: cLng });
      const span = Math.max(latMax - latMin, lngMax - lngMin);
      const z = span < 0.01 ? 16 : span < 0.05 ? 14 : span < 0.1 ? 12 : span < 0.5 ? 10 : 8;
      setWebZoom(z);
    } else if (fitToMarkers && mapRef.current) {
      try {
        const coords = markers.map(m => ({ latitude: m.lat, longitude: m.lng }));
        mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
      } catch {}
    }
  }, [markers, fitToMarkers]);

  const MapComponent = useMemo(() => {
       if (Platform.OS === 'web') {
      // Web: use vis.gl with APIProvider
      const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!API_KEY) {
        return (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center', 
            backgroundColor: '#F3F4F6' 
          }}>
            <View style={{ 
              padding: 8, 
              backgroundColor: 'white', 
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#E5E7EB'
            }}>
              <Text style={{ color: '#6B7280', fontSize: 12, textAlign: 'center' }}>
                {location?.name || 'Map Preview'}
              </Text>
            </View>
          </View>
        );
      }

      try {
        const { Map, APIProvider, AdvancedMarker } = require('@vis.gl/react-google-maps');
        return (
          <APIProvider apiKey={API_KEY}>
            <Map
              zoom={webZoom}
              center={{ lat: mapRegion.latitude, lng: mapRegion.longitude }}
              style={{ width: '100%', height: '100%' }}
              gestureHandling={interactive ? 'greedy' : 'none'}
              disableDefaultUI={!interactive}
            >
               {center && !markers.length && (
                 <AdvancedMarker 
                   position={{ lat: mapRegion.latitude, lng: mapRegion.longitude }}
                   title={location?.name ?? 'Selected'}
                 />
               )}
               {!!markers.length && markers.map((m, idx) => (
                 <AdvancedMarker key={`${m.lat}-${m.lng}-${idx}`} position={{ lat: m.lat, lng: m.lng }} title={m.title || 'Result'} />
               ))}
            </Map>
          </APIProvider>
        );
      } catch (error) {
        console.warn('[MapPreview] Web map components not available:', error);
        return (
          <View style={{ 
            flex: 1, 
            backgroundColor: '#F3F4F6', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <View style={{ 
              padding: 8, 
              backgroundColor: 'white', 
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#E5E7EB'
            }}>
              <Text style={{ color: '#6B7280', fontSize: 12, textAlign: 'center' }}>
                {location?.name || 'Map Preview'}
              </Text>
            </View>
          </View>
        );
      }
    } else {
      // Native: use react-native-maps
       return (
        <MapView
          style={{ flex: 1 }}
          region={mapRegion}
          scrollEnabled={interactive}
          zoomEnabled={interactive}
          rotateEnabled={interactive}
          pitchEnabled={interactive}
          showsUserLocation={interactive}
          showsMyLocationButton={interactive}
          toolbarEnabled={false}
          mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
          loadingEnabled
          loadingIndicatorColor="#3B82F6"
          loadingBackgroundColor="#F3F4F6"
          ref={mapRef}
        >
          {center && !markers.length && (
            <Marker
              coordinate={{
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              }}
              title={location?.name ?? 'Selected'}
              pinColor="#3B82F6"
            />
          )}
          {!!markers.length && markers.map((m, idx) => (
            <Marker key={`${m.lat}-${m.lng}-${idx}`}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              title={m.title || 'Result'}
              pinColor="#2563EB"
            />
          ))}
        </MapView>
      );
    }
  }, [location, mapRegion]);

  return (
    <TouchableOpacity 
      onPress={onPress}
      style={{ flex: 1 }}
      activeOpacity={0.8}
    >
      {MapComponent}
      
      {/* Overlay with tap hint */}
      <View style={{
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}>
        <Text style={{ color: 'white', fontSize: 10, fontWeight: '500' }}>
          Tap to edit
        </Text>
      </View>
    </TouchableOpacity>
  );
}
