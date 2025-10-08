import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  backgroundColor?: string;
  fullScreen?: boolean;
}

export default function LoadingState({
  message = 'Loading...',
  size = 'large',
  color = '#3B82F6',
  backgroundColor = '#FFFFFF',
  fullScreen = false,
}: LoadingStateProps) {
  const content = (
    <View className="items-center justify-center py-16">
      <ActivityIndicator size={size} color={color} />
      <Text className="text-gray-600 mt-4 text-center">{message}</Text>
    </View>
  );

  if (fullScreen) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {content}
      </View>
    );
  }

  return content;
}
