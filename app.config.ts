import type { ConfigContext, ExpoConfig } from '@expo/config';
// Programmatic Expo config to inject Android Google Maps API key from env
// This ensures react-native-maps tiles load on Android.

// Keep base settings from app.json to avoid duplication
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appJson = require('./app.json');

export default ({ config }: ConfigContext): ExpoConfig => {
  const base: ExpoConfig = appJson.expo || {};

  const androidMapsApiKey =
    process.env.EXPO_PUBLIC_ANDROID_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    base?.android?.config?.googleMaps?.apiKey ||
    'YOUR_ANDROID_MAPS_API_KEY';

  return {
    ...base,
    // Preserve any runtime-config from Expo as a fallback
    name: base.name || config.name,
    slug: base.slug || config.slug,
    android: {
      ...(base.android || {}),
      config: {
        ...((base.android && (base.android as any).config) || {}),
        googleMaps: {
          apiKey: androidMapsApiKey,
        },
      },
    },
  } as ExpoConfig;
};


