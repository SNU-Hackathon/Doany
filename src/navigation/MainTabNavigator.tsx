// Main tab navigation component - Navigator 완전 제거하고 단순한 화면 렌더링

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import GoalsScreen from '../screens/GoalsScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SpacesScreen from '../screens/SpacesScreen';

type TabType = 'Home' | 'Goals' | 'Space' | 'Profile';

export default function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<TabType>('Home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen />;
      case 'Goals':
        return <GoalsScreen />;
      case 'Space':
        return <SpacesScreen />;
      case 'Profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const getIconName = (tabName: TabType, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (tabName) {
      case 'Home':
        return focused ? 'home' : 'home-outline';
      case 'Goals':
        return focused ? 'checkmark-done' : 'checkmark-done-outline';
      case 'Space':
        return focused ? 'people' : 'people-outline';
      case 'Profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'help-outline';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header - Only show for non-Space tabs */}
      {activeTab !== 'Space' && (
        <View style={{ 
          backgroundColor: '#1E3A8A', 
          height: 60, 
          justifyContent: 'center', 
          alignItems: 'center',
          paddingTop: 10
        }}>
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 18, 
            fontWeight: '600' 
          }}>
            {activeTab}
          </Text>
        </View>
      )}

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
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
      }}>
        {(['Home', 'Goals', 'Space', 'Profile'] as TabType[]).map((tab) => {
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
                size={24}
                color={isActive ? '#1E3A8A' : '#6B7280'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}