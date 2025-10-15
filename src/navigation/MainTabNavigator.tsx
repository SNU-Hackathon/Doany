// Main tab navigation component with Liquid Glass UI
// Updated order: Home, Space, Goals, Group, Profile

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

type TabType = 'Home' | 'Space' | 'Goals' | 'Group' | 'Profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<TabType>('Home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen />;
      case 'Space':
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
      case 'Space':
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

  const getTabColor = (tabName: TabType, focused: boolean): string => {
    if (focused) {
      switch (tabName) {
        case 'Home':
          return '#1E3A8A'; // Navy blue for home
        case 'Space':
          return '#4F46E5'; // Indigo for space
        case 'Goals':
          return '#4ECDC4'; // Teal for goals
        case 'Group':
          return '#8B5CF6'; // Purple for groups
        case 'Profile':
          return '#10B981'; // Emerald for profile
        default:
          return '#9CA3AF';
      }
    }
    return '#9CA3AF'; // Gray for inactive
  };

  return (
    <View style={styles.container}>
      {/* Screen Content */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Liquid Glass Tab Bar */}
      <View style={styles.tabBarContainer}>
        <BlurView
          intensity={80}
          tint="light"
          style={styles.tabBar}
        >
          <View style={styles.tabBarInner}>
            {(['Home', 'Space', 'Goals', 'Group', 'Profile'] as TabType[]).map((tab) => {
              const isActive = activeTab === tab;
              const tabColor = getTabColor(tab, isActive);
              
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabItem,
                    isActive && styles.activeTabItem,
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    {/* Icon with liquid glass effect */}
                    <View style={[
                      styles.iconContainer,
                      isActive && styles.activeIconContainer,
                      { 
                        backgroundColor: isActive ? `${tabColor}20` : 'rgba(156, 163, 175, 0.1)',
                        borderColor: isActive ? `${tabColor}30` : 'rgba(156, 163, 175, 0.2)',
                      }
                    ]}>
                      <Ionicons
                        name={getIconName(tab, isActive)}
                        size={22}
                        color={tabColor}
                        style={styles.tabIcon}
                      />
                    </View>
                    
                    {/* Text with liquid glass effect */}
                    <View style={[
                      styles.textContainer,
                      isActive && styles.activeTextContainer,
                      { 
                        backgroundColor: isActive ? `${tabColor}15` : 'rgba(156, 163, 175, 0.05)',
                        borderColor: isActive ? `${tabColor}25` : 'rgba(156, 163, 175, 0.1)',
                      }
                    ]}>
                      <Text style={[
                        styles.tabText,
                        { color: tabColor }
                      ]}>
                        {tab}
                      </Text>
                    </View>
                  </View>
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
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 12,
  },
  tabBar: {
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeTabItem: {
    // Active state styling handled by inner elements
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    // Subtle liquid glass effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  activeIconContainer: {
    // Enhanced shadow for active state
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  tabIcon: {
    // Icon styling
  },
  textContainer: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    // Subtle liquid glass effect for text
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  activeTextContainer: {
    // Enhanced shadow for active text
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
    // Subtle text shadow for liquid glass effect
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 0.5,
  },
});