// Group Card component for Group screen
// Displays group information with member count

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

interface Group {
  id?: string;
  name: string;
  iconUrl: string;
  members: number;
  description?: string;
  category?: string;
}

interface GroupCardProps {
  group: Group;
  onPress?: () => void;
}

export default function GroupCard({ group, onPress }: GroupCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="flex-row items-center py-4 px-5 bg-white"
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: '#E5E7EB',
      }}
    >
      {/* Group Icon */}
      <View className="relative">
        <Image
          source={{ uri: group.iconUrl }}
          className="w-14 h-14 rounded-full bg-gray-200"
          resizeMode="cover"
          style={{
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.06)',
          }}
        />
        {group.category && (
          <View
            className="absolute -bottom-0.5 -right-0.5 bg-blue-600 rounded-full w-5 h-5 items-center justify-center"
            style={{
              borderWidth: 1.5,
              borderColor: 'white',
            }}
          >
            <Ionicons name="fitness" size={11} color="white" />
          </View>
        )}
      </View>

      {/* Group Info */}
      <View className="flex-1 ml-4">
        <Text className="text-base font-semibold text-gray-900 mb-1">
          {group.name}
        </Text>
        <Text className="text-sm text-gray-500 font-medium">
          {group.members}명의 멤버
        </Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

