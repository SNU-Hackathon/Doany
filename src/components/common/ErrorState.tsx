import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ErrorStateProps {
  title?: string;
  message?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  backgroundColor?: string;
  fullScreen?: boolean;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again later',
  icon = 'alert-circle-outline',
  actionLabel,
  onAction,
  backgroundColor = '#FFFFFF',
  fullScreen = false,
}: ErrorStateProps) {
  const content = (
    <View className="items-center justify-center py-16 px-8">
      <Ionicons name={icon as any} size={64} color="#EF4444" />
      <Text className="text-xl font-bold text-gray-900 mt-4 text-center">
        {title}
      </Text>
      <Text className="text-gray-600 text-center mt-2">{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          className="mt-6 bg-blue-600 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-medium">{actionLabel}</Text>
        </TouchableOpacity>
      )}
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
