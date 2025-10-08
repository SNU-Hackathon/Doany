// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactNative = require('eslint-plugin-react-native');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    plugins: { 'react-native': reactNative },
    rules: {
      // Allow raw text ONLY inside <Text>; everything else must be wrapped.
      'react-native/no-raw-text': ['error', {
        skip: ['Ionicons', 'Icon'] // add your icon components here
      }],
    },
  },
]);
