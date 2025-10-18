// Root navigation component for Doany app with Stack Navigator

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';
import RankingScreen from '../screens/RankingScreen';
import MainTabNavigator from './MainTabNavigator';

export type RootStackParamList = {
  Tabs: undefined;
  LevelMap: undefined;
  Ranking: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  // 시연을 위해 로그인 체크 제거 - 바로 메인 화면으로 이동
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
          name="Ranking" 
          component={RankingScreen}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </View>
  );
}
