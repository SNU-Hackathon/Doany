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
  onPress: () => void;
}

export default function MapPreview({ location, onPress }: MapPreviewProps) {
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);

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

  const mapRegion = useMemo(() => ({
    latitude: center?.latitude ?? 37.5665,
    longitude: center?.longitude ?? 126.9780,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }), [center]);

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
              defaultZoom={16}
               defaultCenter={{ lat: mapRegion.latitude, lng: mapRegion.longitude }}
              style={{ width: '100%', height: '100%' }}
              gestureHandling="none"
              disableDefaultUI
            >
               {center && (
                 <AdvancedMarker 
                   position={{ lat: mapRegion.latitude, lng: mapRegion.longitude }}
                   title={location?.name ?? 'Selected'}
                 />
               )}
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
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          {center && (
            <Marker
              coordinate={{
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              }}
              title={location?.name ?? 'Selected'}
              pinColor="#3B82F6"
            />
          )}
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
