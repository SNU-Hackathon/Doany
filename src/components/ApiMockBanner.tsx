/**
 * API Mock Mode Banner
 * 
 * Shows a banner at the top of the screen when USE_API_MOCKS=true.
 * Helps developers know they're using mock data instead of live API.
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { isMockMode } from '../config/api';

interface ApiMockBannerProps {
  /** Optional callback when banner is pressed */
  onPress?: () => void;
}

export default function ApiMockBanner({ onPress }: ApiMockBannerProps) {
  // Only show in mock mode
  if (!isMockMode()) {
    return null;
  }

  const BannerContent = (
    <View className="bg-yellow-500 px-4 py-2 flex-row items-center justify-center">
      <Text className="text-yellow-900 text-xs font-semibold mr-2">
        🎭 MOCK MODE
      </Text>
      <Text className="text-yellow-900 text-xs">
        Using local JSON responses
      </Text>
      {onPress && (
        <Text className="text-yellow-900 text-xs ml-2 underline">
          Tap for details
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {BannerContent}
      </TouchableOpacity>
    );
  }

  return BannerContent;
}

/**
 * Compact inline badge for mock mode
 */
export function ApiMockBadge() {
  if (!isMockMode()) {
    return null;
  }

  return (
    <View className="bg-yellow-500 px-2 py-1 rounded">
      <Text className="text-yellow-900 text-xs font-semibold">
        🎭 Mock
      </Text>
    </View>
  );
}

