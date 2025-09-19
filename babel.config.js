module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      'nativewind/babel'
    ],
    plugins: [
      'react-native-reanimated/plugin', // must be last (Reanimated v4+)
    ]
  };
};