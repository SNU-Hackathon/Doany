import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ScreenHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightAction?: {
    icon: string;
    onPress: () => void;
    color?: string;
  };
  leftAction?: {
    icon: string;
    onPress: () => void;
    color?: string;
  };
  backgroundColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
  paddingHorizontal?: number;
  borderBottom?: boolean;
}

export default function ScreenHeader({
  title,
  showBackButton = false,
  onBackPress,
  rightAction,
  leftAction,
  backgroundColor = '#FFFFFF',
  paddingTop = 56,
  paddingBottom = 16,
  paddingHorizontal = 16,
  borderBottom = false,
}: ScreenHeaderProps) {
  return (
    <View
      style={{
        backgroundColor,
        paddingTop,
        paddingBottom,
        paddingHorizontal,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...(borderBottom && {
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }),
      }}
    >
      {/* Left side */}
      <View className="flex-row items-center">
        {showBackButton && (
          <TouchableOpacity
            onPress={onBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="mr-3"
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
        )}
        
        {leftAction && (
          <TouchableOpacity onPress={leftAction.onPress} className="mr-3">
            <Ionicons
              name={leftAction.icon as any}
              size={24}
              color={leftAction.color || '#0F172A'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Center - Title */}
      {title && (
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: '#0F172A',
            flex: 1,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
      )}

      {/* Right side */}
      <View className="flex-row items-center">
        {rightAction && (
          <TouchableOpacity onPress={rightAction.onPress}>
            <Ionicons
              name={rightAction.icon as any}
              size={28}
              color={rightAction.color || '#3B82F6'}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
