// Main tab navigation component - Navigator 완전 제거하고 단순한 화면 렌더링

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import EvoHomeScreen from '../screens/EvoHomeScreen';
import FeedScreen from '../screens/FeedScreen';
import GoalsScreen from '../screens/GoalsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SpacesScreen from '../screens/SpacesScreen';

type TabType = 'Home' | 'Goals' | 'Space' | 'Feed' | 'Profile';

export default function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<TabType>('Home');
  const { t } = useTranslation();

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <EvoHomeScreen />;
      case 'Goals':
        return <GoalsScreen />;
      case 'Space':
        return <SpacesScreen />;
      case 'Feed':
        return <FeedScreen />;
      case 'Profile':
        return <ProfileScreen />;
      default:
        return <EvoHomeScreen />;
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
      case 'Feed':
        return focused ? 'newspaper' : 'newspaper-outline';
      case 'Profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'help-outline';
    }
  };

  const getTabLabel = (tab: TabType): string => {
    switch (tab) {
      case 'Home':
        return t('nav.home');
      case 'Goals':
        return t('nav.goals');
      case 'Space':
        return t('nav.space');
      case 'Feed':
        return t('nav.feed');
      case 'Profile':
        return t('nav.profile');
      default:
        return tab;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header removed to save space */}

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
        {(['Home', 'Goals', 'Space', 'Feed', 'Profile'] as TabType[]).map((tab) => {
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