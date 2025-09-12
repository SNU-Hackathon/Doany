// Main tab navigation component - Navigator 완전 제거하고 단순한 화면 렌더링

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import CalendarScreen from '../screens/CalendarScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';

type TabType = 'MyGoals' | 'Calendar' | 'Profile';

export default function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<TabType>('MyGoals');

  const renderScreen = () => {
    switch (activeTab) {
      case 'MyGoals':
        return <HomeScreen />;
      case 'Calendar':
        return <CalendarScreen />;
      case 'Profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const getIconName = (tabName: TabType, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (tabName) {
      case 'MyGoals':
        return focused ? 'checkmark-done' : 'checkmark-done-outline';
      case 'Calendar':
        return focused ? 'calendar' : 'calendar-outline';
      case 'Profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'help-outline';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ 
        backgroundColor: '#3B82F6', 
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
          {activeTab === 'MyGoals' ? 'My Goals' : activeTab}
        </Text>
      </View>

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
        {(['MyGoals', 'Calendar', 'Profile'] as TabType[]).map((tab) => {
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
                color={isActive ? '#3B82F6' : '#6B7280'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}