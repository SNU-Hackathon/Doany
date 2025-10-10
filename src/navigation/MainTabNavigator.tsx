// Main tab navigation component
// Updated order: Home (Swipe), Goals, Feed, Profile

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import {
  FeedScreen,
  GoalsScreen,
  ProfileScreen,
  SwipeHomeScreen
} from '../screens';

type TabType = 'Home' | 'Goals' | 'Feed' | 'Profile';

export default function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<TabType>('Home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <SwipeHomeScreen />;
      case 'Goals':
        return <GoalsScreen />;
      case 'Feed':
        return <FeedScreen />;
      case 'Profile':
        return <ProfileScreen />;
      default:
        return <SwipeHomeScreen />;
    }
  };

  const getIconName = (tabName: TabType, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (tabName) {
      case 'Home':
        return focused ? 'heart' : 'heart-outline'; // Swipe/Heart icon for home
      case 'Goals':
        return focused ? 'disc' : 'disc-outline'; // Target/Goal icon
      case 'Feed':
        return focused ? 'people' : 'people-outline'; // People icon for community feed
      case 'Profile':
        return focused ? 'person-circle' : 'person-circle-outline';
      default:
        return 'help-outline';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Screen Content */}
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>

      {/* Custom Tab Bar */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        height: 65,
        paddingBottom: 10,
        paddingTop: 10,
      }}>
        {(['Home', 'Goals', 'Feed', 'Profile'] as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={getIconName(tab, isActive)}
                size={28}
                color={isActive ? '#3B82F6' : '#9CA3AF'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}