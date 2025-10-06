// Empty state component for displaying when no data is available
// Provides a consistent UI for empty screens across the app

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = 'alert-circle-outline',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: '#F6F7FB',
      }}
    >
      <Ionicons name={icon} size={64} color="#9CA3AF" />
      
      <Text
        style={{
          fontSize: 20,
          fontWeight: '600',
          color: '#0F172A',
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      
      <Text
        style={{
          fontSize: 16,
          color: '#6B7280',
          marginTop: 8,
          textAlign: 'center',
          lineHeight: 24,
        }}
      >
        {message}
      </Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={{
            marginTop: 24,
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: '#2F6BFF',
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#FFFFFF',
            }}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

