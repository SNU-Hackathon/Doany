// Location service for tracking and verification

import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { Location as LocationType } from '../types';

export class LocationService {
  // Request location permissions
  static async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  // Get current location
  static async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to verify location-based goals.'
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        name: 'Current Location'
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get current location');
      return null;
    }
  }

  // Calculate distance between two locations (in meters)
  static calculateDistance(loc1: LocationType, loc2: LocationType): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (loc1.latitude * Math.PI) / 180;
    const φ2 = (loc2.latitude * Math.PI) / 180;
    const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Check if current location is within target area (default: 100 meters)
  static async isAtTargetLocation(
    targetLocation: LocationType, 
    radiusMeters: number = 100
  ): Promise<boolean> {
    try {
      const currentLocation = await this.getCurrentLocation();
      if (!currentLocation) {
        return false;
      }

      const distance = this.calculateDistance(currentLocation, targetLocation);
      return distance <= radiusMeters;
    } catch (error) {
      console.error('Error checking target location:', error);
      return false;
    }
  }

  // Get address from coordinates (reverse geocoding)
  static async getAddressFromCoordinates(
    latitude: number, 
    longitude: number
  ): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        return [
          address.name,
          address.street,
          address.city,
          address.region
        ].filter(Boolean).join(', ');
      }

      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Error getting address:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }

  // Search for places (requires Google Places API or similar)
  static async searchPlaces(query: string): Promise<LocationType[]> {
    // TODO: Implement place search with Google Places API
    // For now, return empty array
    console.log('Place search not implemented yet:', query);
    return [];
  }

  // Watch location changes (for continuous tracking)
  static async startLocationTracking(
    callback: (location: LocationType) => void,
    options?: {
      accuracy?: Location.Accuracy;
      timeInterval?: number;
      distanceInterval?: number;
    }
  ): Promise<Location.LocationSubscription | null> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      return await Location.watchPositionAsync(
        {
          accuracy: options?.accuracy || Location.Accuracy.Balanced,
          timeInterval: options?.timeInterval || 5000, // 5 seconds
          distanceInterval: options?.distanceInterval || 10, // 10 meters
        },
        (location: any) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            name: 'Current Location'
          });
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return null;
    }
  }

  // Stop location tracking
  static stopLocationTracking(subscription: Location.LocationSubscription): void {
    subscription.remove();
  }
}
