import * as Location from 'expo-location';
import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import MapPreview from './MapPreview';

type LocationSectionProps = {
  value?: any;
  onChange: (place: any) => void;
};

export default function LocationSection({ value, onChange }: LocationSectionProps) {
  const openLocationPicker = () => {
    // Location picker logic would go here
    // For now, we'll use a simple alert
    Alert.alert('Location Picker', 'Location picker functionality will be implemented here');
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        const currentLocation = {
          name: `${place.name || place.street || 'Current Location'}`,
          address: `${place.street || ''} ${place.city || ''} ${place.region || ''}`.trim(),
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          placeId: `current_${location.coords.latitude}_${location.coords.longitude}`,
        };
        onChange(currentLocation);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  return (
    <View style={{
      backgroundColor: '#fffbeb',
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: '#fcd34d',
      paddingBottom: 24 // CTA와 겹치지 않게 충분한 패딩 추가
    }}>
      <Text style={{ color: '#b45309', marginBottom: 12, fontSize: 14 }}>
        목표 달성을 위한 위치를 선택하세요
      </Text>
      
      {/* Target Location Display */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: '#374151', fontWeight: '600', marginBottom: 8 }}>Target Location</Text>
        {value ? (
          <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#d1d5db' }}>
            <Text style={{ color: '#1f2937', fontWeight: '500' }}>{value.name}</Text>
            {value.address && (
              <Text style={{ color: '#4b5563', fontSize: 14, marginTop: 4 }}>{value.address}</Text>
            )}
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              GPS: {value.latitude?.toFixed(4)}, {value.longitude?.toFixed(4)}
            </Text>
            
            {/* Mini map preview */}
            <TouchableOpacity 
              onPress={openLocationPicker}
              style={{ height: 120, backgroundColor: '#f3f4f6', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}
              activeOpacity={0.8}
            >
              <MapPreview 
                location={value} 
                onPress={openLocationPicker}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={{ color: '#6b7280', fontSize: 14, fontStyle: 'italic' }}>위치가 선택되지 않았습니다</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity 
          onPress={openLocationPicker}
          style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 8, padding: 12 }}
          activeOpacity={0.8}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            위치 선택
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleUseCurrentLocation}
          style={{ flex: 1, backgroundColor: '#059669', borderRadius: 8, padding: 12 }}
          activeOpacity={0.8}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            현재 위치 사용
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
