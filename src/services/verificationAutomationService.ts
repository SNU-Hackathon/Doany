// Verification automation service for handling automatic goal verification

import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { VERIFICATION_DEFAULTS } from '../config/verification';
import { Goal, Location as LocationType, VerificationStatus } from '../types';
import { LocationService } from './locationService';
import { parsePickerExif, validateFreshness, validateGeofence, validateTimeWindow } from './photo/ExifValidator';
import { VerificationService, verifyLocation, verifyPhoto } from './verificationService';

export class VerificationAutomationService {
  private static activeTracking: Map<string, any> = new Map();

  // Start automatic verification for a location-based goal
  static async startLocationVerification(goal: Goal): Promise<void> {
    if (goal.verificationType !== 'location' || !goal.targetLocation) {
      return;
    }

    try {
      // Stop any existing tracking for this goal
      this.stopVerification(goal.id);

      const subscription = await LocationService.startLocationTracking(
        async (currentLocation) => {
          await this.checkLocationGoal(goal, currentLocation);
        },
        {
          timeInterval: 30000, // Check every 30 seconds
          distanceInterval: 50, // Check when moved 50 meters
        }
      );

      if (subscription) {
        this.activeTracking.set(goal.id, {
          type: 'location',
          subscription,
          goal
        });
      }
    } catch (error) {
      console.error('Error starting location verification:', error);
    }
  }

  // Check if location goal is satisfied
  private static async checkLocationGoal(
    goal: Goal, 
    currentLocation: LocationType
  ): Promise<void> {
    if (!goal.targetLocation) return;

    try {
      // Convert TargetLocation to Location for compatibility
      const targetLocationForService = {
        name: goal.targetLocation.name,
        latitude: goal.targetLocation.lat,
        longitude: goal.targetLocation.lng,
        address: goal.targetLocation.address,
        placeId: goal.targetLocation.placeId,
      };
      
      const isAtTarget = await LocationService.isAtTargetLocation(
        targetLocationForService,
        100 // 100 meter radius
      );

      if (isAtTarget) {
        // Check if we should record a verification based on time frame
        const shouldRecord = await this.shouldRecordVerification(goal);
        
        if (shouldRecord) {
          await verifyLocation(goal as any, true);

          // Notify user of successful verification
          Alert.alert(
            'Goal Achieved!',
            `You successfully completed: ${goal.title}`,
            [{ text: 'Great!', style: 'default' }]
          );
        }
      }
    } catch (error) {
      console.error('Error checking location goal:', error);
    }
  }

  // Check if we should record a new verification based on time frame
  private static async shouldRecordVerification(goal: Goal): Promise<boolean> {
    try {
      const latestVerification = await VerificationService.getLatestVerification(goal.id);
      
      if (!latestVerification) {
        return true; // No previous verifications
      }

      const now = new Date();
      const lastVerificationTime = latestVerification.timestamp;
      const timeDiff = now.getTime() - lastVerificationTime.getTime();

      // Check based on goal timeFrame
      switch (goal.timeFrame) {
        case 'daily':
          // Don't record if already verified today
          return !this.isSameDay(now, lastVerificationTime);
        
        case 'weekly':
          // Don't record if already verified this week
          return !this.isSameWeek(now, lastVerificationTime);
        
        case 'monthly':
          // Don't record if already verified this month
          return !this.isSameMonth(now, lastVerificationTime);
        
        default:
          // Default to daily if timeFrame is not recognized
          return !this.isSameDay(now, lastVerificationTime);
      }
    } catch (error) {
      console.error('Error checking verification eligibility:', error);
      return false;
    }
  }

  // Time-based verification (for screen time goals)
  static async performTimeBasedVerification(goal: Goal): Promise<void> {
    // TODO: Implement screen time tracking
    // This would integrate with device screen time APIs
    console.log('Time-based verification not fully implemented yet for goal:', goal.title);
    
    // Placeholder implementation
    Alert.alert(
      'Time Verification',
      'Time-based verification will be implemented with screen time tracking APIs.',
      [{ text: 'OK' }]
    );
  }

  // Manual verification trigger
  static async performManualVerification(
    goal: Goal, 
    success: boolean,
    screenshot?: Blob
  ): Promise<void> {
    try {
      const status: VerificationStatus = success ? 'success' : 'fail';
      const currentLocation = await LocationService.getCurrentLocation();
      
      await VerificationService.createVerification(
        goal.id,
        goal.userId,
        status,
        currentLocation || undefined,
        screenshot
      );

      Alert.alert(
        success ? 'Success Recorded!' : 'Attempt Recorded',
        success 
          ? `Great job completing: ${goal.title}!`
          : `Don't give up! Try again with: ${goal.title}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error performing manual verification:', error);
      Alert.alert('Error', 'Failed to record verification');
    }
  }

  // Photo-based verification using camera
  static async performPhotoVerification(goal: Goal): Promise<void> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission', 'Camera permission is required for photo verification.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ 
        quality: 0.8, 
        exif: true, 
        base64: false 
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const asset = result.assets[0];
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();

      // Extract EXIF and perform validation
      const exif = parsePickerExif(asset.exif || undefined);
      
      // Get time window from goal (if available)
      const now = Date.now();
      const windowStart = now - (30 * 60 * 1000); // 30 min ago default
      const windowEnd = now + (30 * 60 * 1000);   // 30 min from now default
      
      // Get target location from goal
      const targetLocation = goal.targetLocation ? 
        { lat: goal.targetLocation.lat, lng: goal.targetLocation.lng } : 
        undefined;
      
      // Validate EXIF data
      const timeValid = validateTimeWindow(exif.timestampMs, windowStart, windowEnd, VERIFICATION_DEFAULTS.timeToleranceMinutes);
      const locValid = targetLocation ? validateGeofence(exif.location, targetLocation, VERIFICATION_DEFAULTS.geofenceRadiusMeters) : true;
      const freshValid = validateFreshness(exif.timestampMs, VERIFICATION_DEFAULTS.photoFreshnessMaxMinutes);
      
      console.log(`[PhotoVerification] timeValid=${timeValid} locValid=${locValid} freshValid=${freshValid} ts=${exif.timestampMs}`);
      
      // Create enriched photo signals
      const photoSignals = {
        present: true,
        exif: { 
          timestampMs: exif.timestampMs, 
          location: exif.location, 
          deviceModel: exif.deviceModel 
        },
        validationResult: { 
          timeValid, 
          locationValid: locValid, 
          freshnessValid: freshValid 
        }
      };

      await verifyPhoto(goal as any, blob, photoSignals);

      Alert.alert('Uploaded', 'Photo verification uploaded.');
    } catch (error) {
      console.error('[VerificationAutomationService] Photo verification failed', error);
      Alert.alert('Error', 'Photo verification failed.');
    }
  }

  // Stop verification for a specific goal
  static stopVerification(goalId: string): void {
    const tracking = this.activeTracking.get(goalId);
    if (tracking) {
      if (tracking.type === 'location' && tracking.subscription) {
        LocationService.stopLocationTracking(tracking.subscription);
      }
      this.activeTracking.delete(goalId);
    }
  }

  // Stop all active verifications
  static stopAllVerifications(): void {
    const goalIds = Array.from(this.activeTracking.keys());
    goalIds.forEach(goalId => {
      this.stopVerification(goalId);
    });
  }

  // Get active tracking status
  static isTrackingGoal(goalId: string): boolean {
    return this.activeTracking.has(goalId);
  }

  // Utility functions for date comparison
  private static isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  private static isSameWeek(date1: Date, date2: Date): boolean {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const startOfWeek1 = new Date(date1.getTime() - (date1.getDay() * 24 * 60 * 60 * 1000));
    const startOfWeek2 = new Date(date2.getTime() - (date2.getDay() * 24 * 60 * 60 * 1000));
    return Math.abs(startOfWeek1.getTime() - startOfWeek2.getTime()) < oneWeek;
  }

  private static isSameMonth(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() && 
           date1.getMonth() === date2.getMonth();
  }
}
