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

// App navigation component
function AppNavigator() {
  return (
    <NavigationContainer>
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