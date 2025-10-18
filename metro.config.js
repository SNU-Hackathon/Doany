const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Web-specific configuration
config.resolver = {
  ...config.resolver,
  resolverMainFields: ['sbmodern', 'react-native', 'browser', 'main'],
  sourceExts: [...(config.resolver?.sourceExts || []), 'mjs'],
  platforms: ['ios', 'android', 'web'],
};

module.exports = withNativeWind(config, {
  input: './app/globals.css',
});