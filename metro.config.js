const { getDefaultConfig } = require('expo/metro-config');

const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: './app/globals.css', // ← 실제 CSS 경로와 파일명(globals.css) 일치시킬 것
});