// Main tab navigation component for authenticated users

import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { Suspense } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MainTabParamList } from '../types';

// Lazy load screens for better performance
const HomeScreen = React.lazy(() => import('../screens/HomeScreen'));
const CalendarScreen = React.lazy(() => import('../screens/CalendarScreen'));
const ProfileScreen = React.lazy(() => import('../screens/ProfileScreen'));

// Loading component for lazy-loaded screens
const ScreenLoader = ({ name }: { name: string }) => {
  console.time(`[Navigation] ${name} Screen Load`);
  
  React.useEffect(() => {
    return () => {
      console.timeEnd(`[Navigation] ${name} Screen Load`);
    };
  }, [name]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={{ color: '#6B7280', marginTop: 16 }}>Loading {name}...</Text>
    </View>
  );
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarShowLabel: false, // Hide all text labels
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          const size = 24; // Consistent icon size

          if (route.name === 'MyGoals') {
            iconName = focused ? 'checkmark-done' : 'checkmark-done-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,           // Move to very bottom (no gap)
          height: 70,          // Increase height slightly for better safe area handling
          paddingTop: 8,
          paddingBottom: 20,   // More bottom padding for safe area
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb', // gray-200
          backgroundColor: '#ffffff',
          borderRadius: 0,     // keep no rounded corners
          elevation: 12,
        },
        tabBarItemStyle: {
          paddingVertical: 8, // Comfortable hit area
        },
        headerStyle: {
          backgroundColor: '#3B82F6',
          height: 56, // Much thinner header (h-14 = 56px)
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600', // semibold
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="MyGoals" 
        options={{
          title: 'My Goals',
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoader name="My Goals" />}>
            <HomeScreen />
          </Suspense>
        )}
      </Tab.Screen>
      
      <Tab.Screen 
        name="Calendar" 
        options={{
          title: 'Calendar',
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoader name="Calendar" />}>
            <CalendarScreen />
          </Suspense>
        )}
      </Tab.Screen>
      
      <Tab.Screen 
        name="Profile" 
        options={{
          title: 'Profile',
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoader name="Profile" />}>
            <ProfileScreen />
          </Suspense>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
