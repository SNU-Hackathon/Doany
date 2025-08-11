import React, { useMemo } from 'react';
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
  location: TargetLocation;
  onPress: () => void;
}

export default function MapPreview({ location, onPress }: MapPreviewProps) {
  const mapRegion = useMemo(() => ({
    latitude: location.lat,
    longitude: location.lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }), [location.lat, location.lng]);

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
                {location.name}
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
              defaultCenter={{ lat: location.lat, lng: location.lng }}
              style={{ width: '100%', height: '100%' }}
              gestureHandling="none"
              disableDefaultUI
            >
              <AdvancedMarker 
                position={{ lat: location.lat, lng: location.lng }}
                title={location.name}
              />
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
                {location.name}
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
          <Marker
            coordinate={{
              latitude: location.lat,
              longitude: location.lng,
            }}
            title={location.name}
            pinColor="#3B82F6"
          />
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
