// Root navigation component for Doany app

import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';
import { useAuth } from '../hooks/useAuth';
import { AuthScreen, GoalDetailScreen, LocationPickerScreen } from '../screens';
import { RootStackParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();

// Lazy load MainTabNavigator to avoid loading all screens at once
const MainTabNavigator = React.lazy(() => import('./MainTabNavigator'));

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is signed in
          <>
            <Stack.Screen name="Main">
              {() => (
                <React.Suspense fallback={
                  <View className="flex-1 justify-center items-center bg-gray-50">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="mt-4 text-gray-600">Loading...</Text>
                  </View>
                }>
                  <MainTabNavigator />
                </React.Suspense>
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="GoalDetail" 
              component={GoalDetailScreen}
              options={{
                headerShown: true,
                title: 'Goal Details',
                headerStyle: {
                  backgroundColor: '#3B82F6',
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen 
              name="LocationPicker" 
              component={LocationPickerScreen}
              options={{
                headerShown: true,
                title: 'Choose Location',
                headerStyle: {
                  backgroundColor: '#3B82F6',
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
          </>
        ) : (
          // User is NOT signed in
          <Stack.Screen 
            name="Auth" 
            component={AuthScreen} 
          />
        )}
      </Stack.Navigator>
    </View>
  );
}
