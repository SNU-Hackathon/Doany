import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

// Tailwind-like utility styles for React Native
const tw = StyleSheet.create({
  // Flexbox
  'flex-1': { flex: 1 },
  'flex-row': { flexDirection: 'row' },
  'flex-col': { flexDirection: 'column' },
  'items-center': { alignItems: 'center' },
  'justify-center': { justifyContent: 'center' },
  'justify-between': { justifyContent: 'space-between' },
  'justify-around': { justifyContent: 'space-around' },

  // Background Colors
  'bg-white': { backgroundColor: '#ffffff' },
  'bg-gray-50': { backgroundColor: '#f9fafb' },
  'bg-gray-100': { backgroundColor: '#f3f4f6' },
  'bg-blue-100': { backgroundColor: '#dbeafe' },
  'bg-blue-600': { backgroundColor: '#2563eb' },
  'bg-green-600': { backgroundColor: '#059669' },
  'bg-orange-600': { backgroundColor: '#ea580c' },

  // Text Colors
  'text-white': { color: '#ffffff' },
  'text-gray-600': { color: '#4b5563' },
  'text-gray-700': { color: '#374151' },
  'text-gray-800': { color: '#1f2937' },
  'text-blue-600': { color: '#2563eb' },
  'text-green-600': { color: '#059669' },
  'text-orange-600': { color: '#ea580c' },

  // Padding
  'p-2': { padding: 8 },
  'p-4': { padding: 16 },
  'p-6': { padding: 24 },
  'px-4': { paddingHorizontal: 16 },
  'py-2': { paddingVertical: 8 },
  'py-3': { paddingVertical: 12 },

  // Margin
  'm-2': { margin: 8 },
  'm-4': { margin: 16 },
  'mb-2': { marginBottom: 8 },
  'mb-3': { marginBottom: 12 },
  'mb-4': { marginBottom: 16 },
  'mb-6': { marginBottom: 24 },
  'mt-1': { marginTop: 4 },
  'mt-4': { marginTop: 16 },

  // Borders
  'rounded-lg': { borderRadius: 8 },
  'rounded-full': { borderRadius: 9999 },
  'border': { borderWidth: 1 },
  'border-gray-300': { borderColor: '#d1d5db' },

  // Shadows
  'shadow-sm': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },

  // Typography
  'text-sm': { fontSize: 14 },
  'text-base': { fontSize: 16 },
  'text-lg': { fontSize: 18 },
  'text-xl': { fontSize: 20 },
  'text-2xl': { fontSize: 24 },
  'font-bold': { fontWeight: 'bold' },
  'font-semibold': { fontWeight: '600' },

  // Width/Height
  'w-20': { width: 80 },
  'h-20': { height: 80 },
  'w-full': { width: '100%' },
});

// Helper function to combine styles like Tailwind classes
export const cn = (...classNames: (keyof typeof tw | ViewStyle | TextStyle | undefined)[]): (ViewStyle | TextStyle)[] => {
  return classNames
    .filter(Boolean)
    .map(className => {
      if (typeof className === 'string') {
        return tw[className] || {};
      }
      return className || {};
    });
};

export default tw;
