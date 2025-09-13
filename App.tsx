// Main App component with single NavigationContainer and conditional auth gate
import 'react-native-gesture-handler'; // ← RNGH 사이드 이펙트 import (가장 위쪽에 두는 게 안전)

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-get-random-values'; // Crypto polyfill
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import './app/globals.css'; // Tailwind CSS

import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigator from './src/navigation/RootNavigator';
import './src/services/network/NetworkService'; // Initialize network service

// Development-only test harness
if (__DEV__) {
  import('./src/services/test/VerificationTestHarness');
  import('./src/services/test/TestCommands');
}

// App navigation component
function AppNavigator() {
  return (
    <NavigationContainer
      onReady={() => console.log('[Navigation] Navigation container ready')}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

// Root App component
export default function App() {
  console.log('[App] App component mounting');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <ErrorBoundary>
          <AuthProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
              <AppNavigator />
            </SafeAreaView>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}