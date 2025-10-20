// Main tab navigation component with Apple Liquid Glass UI
// Updated order: Home, Space, Goals, Group, Profile
// Design philosophy: Simplicity is the ultimate sophistication - Steve Jobs

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  GoalsScreen,
  GroupScreen,
  ProfileScreen,
  SpaceScreen,
} from '../screens';
import HomeScreen from '../screens/HomeScreen';

type TabType = 'Home' | 'space' | 'Goals' | 'Group' | 'Profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<TabType>('Home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen />;
      case 'space':
        return <SpaceScreen />;
      case 'Goals':
        return <GoalsScreen />;
      case 'Group':
        return <GroupScreen />;
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
      case 'space':
        return focused ? 'planet' : 'planet-outline';
      case 'Goals':
        return focused ? 'disc' : 'disc-outline';
      case 'Group':
        return focused ? 'people' : 'people-outline';
      case 'Profile':
        return focused ? 'person-circle' : 'person-circle-outline';
      default:
        return 'help-outline';
    }
  };

  return (
    <View style={styles.container}>
      {/* Screen Content */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Apple Liquid Glass Tab Bar - exactly like screenshot */}
      <View style={styles.tabBarWrapper}>
        <BlurView
          intensity={95}
          tint="light"
          style={styles.tabBar}
        >
          {/* Tab Bar Content */}
          <View style={styles.tabBarInner}>
            {(['Home', 'space', 'Goals', 'Group', 'Profile'] as TabType[]).map((tab) => {
              const isActive = activeTab === tab;
              
              return (
                <TouchableOpacity
                  key={tab}
                  style={styles.tabItem}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.6}
                >
                  {/* Icon - clean and simple */}
                  <Ionicons
                    name={getIconName(tab, isActive)}
                    size={28}
                    color={isActive ? '#3B82F6' : '#9CA3AF'}
                    style={{ marginBottom: 4 }}
                  />
                  
                  {/* Label */}
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isActive ? '#3B82F6' : '#9CA3AF' }
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  tabBar: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    // Subtle shadow for depth - Apple style
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    // Glass border effect
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  homeIndicatorContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#000000',
  },
});
