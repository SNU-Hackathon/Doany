import * as Location from 'expo-location';
import React, { useState } from 'react';
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

type LocationSectionProps = {
  value?: any;
  onChange: (place: any) => void;
};

export default function LocationSection({ value, onChange }: LocationSectionProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [manualLocation, setManualLocation] = useState('');

  const openLocationPicker = () => {
    setIsSearchOpen(true); // 내부 모달/스크린 열기
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
              GPS: {value?.latitude != null && value?.longitude != null
                ? `${Number(value.latitude).toFixed(4)}, ${Number(value.longitude).toFixed(4)}`
                : 'Not set'}
            </Text>
            
            {/* Location info */}
            <View style={{ height: 120, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>📍 {value.name}</Text>
              {value.address && (
                <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4, textAlign: 'center' }}>{value.address}</Text>
              )}
            </View>
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
      
      {/* Location Search Modal */}
      {isSearchOpen && (
        Platform.OS === 'web' ? (
          // Web fallback - simple text input
          <View style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 1000
          }}>
            <View style={{ 
              backgroundColor: 'white', 
              padding: 20, 
              borderRadius: 8, 
              width: '90%', 
              maxWidth: 400 
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                위치 입력
              </Text>
              <TextInput
                style={{ 
                  borderWidth: 1, 
                  borderColor: '#d1d5db', 
                  borderRadius: 8, 
                  padding: 12, 
                  marginBottom: 16 
                }}
                placeholder="위치 이름을 입력하세요"
                value={manualLocation}
                onChangeText={setManualLocation}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setIsSearchOpen(false)}
                  style={{ flex: 1, backgroundColor: '#6b7280', padding: 12, borderRadius: 8 }}
                >
                  <Text style={{ color: 'white', textAlign: 'center' }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (manualLocation.trim()) {
                      const loc = { 
                        lat: 37.5665, // Default Seoul coordinates
                        lng: 126.9780,
                        name: manualLocation.trim(),
                        address: manualLocation.trim()
                      };
                      onChange?.(loc);
                      setManualLocation('');
                      setIsSearchOpen(false);
                    }
                  }}
                  style={{ flex: 1, backgroundColor: '#2563eb', padding: 12, borderRadius: 8 }}
                >
                  <Text style={{ color: 'white', textAlign: 'center' }}>확인</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          // Native fallback - show message that LocationSearch is not available
          <View style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 1000
          }}>
            <View style={{ 
              backgroundColor: 'white', 
              padding: 20, 
              borderRadius: 8, 
              width: '90%', 
              maxWidth: 400 
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                위치 선택
              </Text>
              <Text style={{ color: '#666', marginBottom: 16 }}>
                위치 검색 기능이 현재 사용할 수 없습니다. 현재 위치를 사용하거나 수동으로 입력해주세요.
              </Text>
              <TouchableOpacity
                onPress={() => setIsSearchOpen(false)}
                style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 8 }}
              >
                <Text style={{ color: 'white', textAlign: 'center' }}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      )}
    </View>
  );
}
