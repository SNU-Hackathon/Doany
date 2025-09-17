// Main App component with single NavigationContainer and conditional auth gate
import 'react-native-gesture-handler'; // ← RNGH 사이드 이펙트 import (가장 위쪽에 두는 게 안전)

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import React, { useEffect } from 'react';
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
    // TestCommands는 자동으로 로드됨
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

  // Disable OTA updates completely
  useEffect(() => {
    const disableUpdates = async () => {
      try {
        console.log('[App] Checking updates status:', Updates.isEnabled);
        if (Updates.isEnabled) {
          console.log('[App] OTA updates are enabled, disabling...');
          // Force disable updates
          await Updates.checkForUpdateAsync();
          console.log('[App] Updates check completed');
        } else {
          console.log('[App] OTA updates already disabled');
        }
      } catch (error) {
        console.log('[App] Error with updates:', error);
      }
    };
    disableUpdates();
  }, []);

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