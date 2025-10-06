// Root navigation component for Doany app with Stack Navigator

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';
import { useAuth } from '../hooks/useAuth';
import AuthScreen from '../screens/AuthScreen';
import LevelMapScreen from '../screens/LevelMapScreen';
import MainTabNavigator from './MainTabNavigator';

export type RootStackParamList = {
  Tabs: undefined;
  LevelMap: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <AuthScreen />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <OfflineBanner />
      {/* @ts-ignore - TypeScript version mismatch with navigation types */}
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' }
        }}
      >
        <Stack.Screen 
          name="Tabs" 
          component={MainTabNavigator}
        />
        <Stack.Screen 
          name="LevelMap" 
          component={LevelMapScreen}
          options={{ 
            presentation: 'card',
            animation: 'slide_from_right'
          }} 
        />
      </Stack.Navigator>
    </View>
  );
}
