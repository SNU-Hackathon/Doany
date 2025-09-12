// Main App component with single NavigationContainer and conditional auth gate

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-get-random-values'; // Crypto polyfill
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import './app/globals.css'; // Tailwind CSS

import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import AuthScreen from './src/screens/AuthScreen';
import GoalDetailScreen from './src/screens/GoalDetailScreen';
import { RootStackParamList } from './src/types';

const Stack = createStackNavigator<RootStackParamList>();

// Splash screen with inline styling
function SplashScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading...</Text>
    </View>
  );
}

// Stable component definitions outside of App body
function AuthStack() {
  console.log('[App] Rendering AuthStack');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={AuthScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  console.log('[App] Rendering MainStack');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen 
        name="GoalDetail" 
        component={GoalDetailScreen}
        options={{ headerShown: true, title: 'Goal Details' }}
      />
    </Stack.Navigator>
  );
}

// App navigation gate - the core logic
function AppNavigator() {
  const { user, loading } = useAuth();

  // Debug navigation state
  React.useEffect(() => {
    console.log('[App] Navigation state changed:', {
      hasUser: !!user,
      userEmail: user?.email,
      loading,
      shouldRender: user ? 'MainStack' : 'AuthStack'
    });
  }, [user, loading]);

  if (loading) {
    console.log('[App] Showing splash screen - loading:', loading);
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        {user ? <MainStack /> : <AuthStack />}
      </View>
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