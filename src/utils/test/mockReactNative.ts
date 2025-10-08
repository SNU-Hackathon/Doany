// Mock React Native for testing
export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const FlatList = 'FlatList';
export const ScrollView = 'ScrollView';
export const Alert = {
  alert: jest.fn(),
};
export const Platform = {
  OS: 'ios',
};
export const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 667 })),
};

export default {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
};
