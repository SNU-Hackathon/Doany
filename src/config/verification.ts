export const VERIFICATION_DEFAULTS = {
  timeToleranceMinutes: 10,          // ±10 min
  geofenceRadiusMeters: 100,         // default 100m
  photoFreshnessMaxMinutes: 30,      // photo must be taken within last 30 min (when used as standalone evidence)
  timezone: 'Asia/Seoul' as const,
};
