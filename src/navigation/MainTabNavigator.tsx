// Main tab navigation component with Liquid Glass UI
// Updated order: Home (Swipe), Goals, Feed, Profile

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  FeedScreen,
  GoalsScreen,
  ProfileScreen,
  SwipeHomeScreen
} from '../screens';

type TabType = 'Home' | 'Goals' | 'Feed' | 'Profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
        return focused ? 'heart' : 'heart-outline';
      case 'Goals':
        return focused ? 'disc' : 'disc-outline';
      case 'Feed':
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
          return '#FF6B6B'; // Coral red for heart
        case 'Goals':
          return '#4ECDC4'; // Teal for goals
        case 'Feed':
          return '#45B7D1'; // Blue for feed
        case 'Profile':
          return '#96CEB4'; // Mint green for profile
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
            {(['Home', 'Goals', 'Feed', 'Profile'] as TabType[]).map((tab) => {
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
                        size={24}
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 20,
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
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeTabItem: {
    // Active state styling handled by inner elements
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    // Liquid glass effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  activeIconContainer: {
    // Enhanced shadow for active state
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tabIcon: {
    // Icon styling
  },
  textContainer: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // Liquid glass effect for text
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  activeTextContainer: {
    // Enhanced shadow for active text
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    // Text shadow for liquid glass effect
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});