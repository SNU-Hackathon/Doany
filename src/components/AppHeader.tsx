// Unified header component for all main screens
// Used in: Home, Space, Goals, Group screens

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Image,
    SafeAreaView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface AppHeaderProps {
  // Profile section (for Home screen)
  showProfile?: boolean;
  profileImage?: string;
  userName?: string;
  welcomeMessage?: string;

  // Title section (for Space, Goals, Group screens)
  title?: string;

  // Right action
  showNotification?: boolean;
  onNotificationPress?: () => void;
  rightIcon?: React.ReactNode;

  // Search bar
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  showSearchOptions?: boolean;
  onSearchOptionsPress?: () => void;

  // Action button (e.g., + button in Group screen)
  showActionButton?: boolean;
  actionButtonIcon?: keyof typeof Ionicons.glyphMap;
  onActionButtonPress?: () => void;
  actionButtonColor?: string;
}

export default function AppHeader({
  showProfile = false,
  profileImage,
  userName,
  welcomeMessage = 'Welcome back,',
  title,
  showNotification = true,
  onNotificationPress,
  rightIcon,
  showSearch = false,
  searchPlaceholder = 'search',
  searchValue = '',
  onSearchChange,
  showSearchOptions = false,
  onSearchOptionsPress,
  showActionButton = false,
  actionButtonIcon = 'add',
  onActionButtonPress,
  actionButtonColor = '#4F46E5',
}: AppHeaderProps) {
  return (
    <SafeAreaView className="bg-white border-b border-gray-100">
      <StatusBar barStyle="dark-content" />
      
      {/* Main Header Row */}
      <View className="px-5 pt-3 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          {/* Left: Profile or Title */}
          {showProfile ? (
            <View className="flex-row items-center flex-1">
              <Image
                source={{ uri: profileImage || 'https://i.pravatar.cc/150?img=1' }}
                className="w-12 h-12 rounded-full bg-gray-200 mr-3"
                style={{
                  borderWidth: 1.5,
                  borderColor: 'rgba(0, 0, 0, 0.06)',
                }}
              />
              <View className="flex-1">
                <Text className="text-sm text-gray-500 font-medium">
                  {welcomeMessage}
                </Text>
                <Text className="text-lg font-bold text-gray-900" style={{ letterSpacing: -0.3 }}>
                  {userName || 'User'}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="text-2xl font-bold text-gray-900 flex-1" style={{ letterSpacing: -0.5 }}>
              {title || 'Proovit'}
            </Text>
          )}

          {/* Right: Notification or Action Button */}
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {showActionButton && (
              <TouchableOpacity
                onPress={onActionButtonPress}
                className="w-10 h-10 rounded-full items-center justify-center"
                activeOpacity={0.75}
                style={{
                  backgroundColor: actionButtonColor,
                  shadowColor: actionButtonColor,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                  elevation: 4,
                }}
                accessibilityLabel="Action button"
                accessibilityRole="button"
              >
                <Ionicons name={actionButtonIcon} size={22} color="white" />
              </TouchableOpacity>
            )}

            {rightIcon || (
              showNotification && (
                <TouchableOpacity
                  onPress={onNotificationPress}
                  className="w-10 h-10 rounded-full items-center justify-center bg-gray-50"
                  activeOpacity={0.75}
                  accessibilityLabel="Notifications"
                  accessibilityRole="button"
                >
                  <Ionicons name="notifications-outline" size={22} color="#1F2937" />
                  {/* Notification dot */}
                  <View className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full" />
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View
            className="bg-gray-50 rounded-2xl flex-row items-center px-4 py-3.5"
            style={{
              borderWidth: 0.5,
              borderColor: 'rgba(0, 0, 0, 0.04)',
            }}
          >
            <Ionicons name="search" size={19} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-3 text-base text-gray-900"
              placeholder={searchPlaceholder}
              placeholderTextColor="#9CA3AF"
              value={searchValue}
              onChangeText={onSearchChange}
              accessibilityLabel="Search input"
            />
            {showSearchOptions && (
              <TouchableOpacity
                onPress={onSearchOptionsPress}
                accessibilityLabel="Search options"
                accessibilityRole="button"
              >
                <Ionicons name="options-outline" size={19} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

