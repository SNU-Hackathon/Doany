// Minimal type declaration to support React Native Auth persistence import
declare module 'firebase/auth/react-native' {
  import type { Persistence } from 'firebase/auth';
  // AsyncStorage-based persistence for React Native
  export function getReactNativePersistence(storage: any): Persistence;
}


