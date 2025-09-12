// Root navigation component for Doany app - Stack Navigator 완전 제거

import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';
import { useAuth } from '../hooks/useAuth';
import AuthScreen from '../screens/AuthScreen';
import MainTabNavigator from './MainTabNavigator';

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

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      {user ? (
        // User is signed in - MainTabNavigator만 렌더링
        <MainTabNavigator />
      ) : (
        // User is NOT signed in - AuthScreen만 렌더링
        <AuthScreen />
      )}
    </View>
  );
}
