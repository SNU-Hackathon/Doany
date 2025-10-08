import { VERIFICATION_DEFAULTS } from '../../config/verification';

export interface ExifData {
  timestampMs?: number;
  location?: { lat: number; lng: number };
  deviceModel?: string;
}

// expo-image-picker provides EXIF keys like: Exif.GPSLatitude, Exif.GPSLongitude, DateTimeOriginal, Model, etc.
export function parsePickerExif(exif?: Record<string, any>): ExifData {
  if (!exif) return {};
  const lat = exif.GPSLatitude ?? exif.gpsLatitude ?? exif['GPSLatitude'];
  const lng = exif.GPSLongitude ?? exif.gpsLongitude ?? exif['GPSLongitude'];
  const model = exif.Model ?? exif.model;

  // DateTimeOriginal like "2025:09:13 09:07:15"
  const dto = exif.DateTimeOriginal ?? exif.DateTime ?? exif.DateTimeDigitized;
  const tsMs = dto ? Date.parse(dto.replace(/:/, '-').replace(/:/, '-')) || undefined : undefined;

  return {
    timestampMs: Number.isFinite(tsMs) ? tsMs : undefined,
    location: (typeof lat === 'number' && typeof lng === 'number') ? { lat, lng } : undefined,
    deviceModel: model
  };
}

export function validateTimeWindow(exifTs: number | undefined, windowStart: number, windowEnd: number, tolMin = VERIFICATION_DEFAULTS.timeToleranceMinutes) {
  if (!exifTs) return false;
  const tolMs = tolMin * 60 * 1000;
  return exifTs + tolMs >= windowStart && exifTs - tolMs <= windowEnd;
}

export function validateFreshness(exifTs: number | undefined, maxAgeMin = VERIFICATION_DEFAULTS.photoFreshnessMaxMinutes) {
  if (!exifTs) return false;
  const ageMs = Date.now() - exifTs;
  return ageMs >= 0 && ageMs <= maxAgeMin * 60 * 1000;
}

export function distanceMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const lat1 = a.lat * Math.PI/180;
  const lat2 = b.lat * Math.PI/180;
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function validateGeofence(exifLoc: {lat:number;lng:number} | undefined, target: {lat:number;lng:number}, radiusM = VERIFICATION_DEFAULTS.geofenceRadiusMeters) {
  if (!exifLoc) return false;
  return distanceMeters(exifLoc, target) <= radiusM;
}
