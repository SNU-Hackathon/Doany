// Goal Card component for Space screen
// Displays completed community goals with engagement features

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

interface SpaceGoal {
  goalId: string;
  title: string;
  thumbnailUrl: string;
  tags: string[];
  category: string;
  actor: {
    actorId?: string;
    displayName?: string;
    name?: string;
    avatarUrl: string;
  };
  social: {
    likes: number;
    comments: number;
    didILike: boolean;
  };
  progress: {
    current: number;
    total: number;
  };
}

interface GoalCardProps {
  goal: SpaceGoal;
  onPress?: () => void;
  onLike?: () => void;
  onBookmark?: () => void;
}

export default function GoalCard({ goal, onPress, onLike, onBookmark }: GoalCardProps) {
  const progressPercentage = (goal.progress.current / goal.progress.total) * 100;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.96}
      className="bg-white rounded-2xl overflow-hidden flex-1"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Thumbnail Image */}
      <View className="relative">
        <Image
          source={{ uri: goal.thumbnailUrl }}
          className="w-full"
          style={{ height: 140, aspectRatio: 1 }}
          resizeMode="cover"
        />
        
        {/* Action Icons Overlay */}
        <View className="absolute top-2 right-2 flex-row" style={{ gap: 6 }}>
          <TouchableOpacity
            onPress={onLike}
            className="bg-white/95 rounded-full p-1.5"
            activeOpacity={0.75}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Ionicons
              name={goal.social.didILike ? 'heart' : 'heart-outline'}
              size={16}
              color={goal.social.didILike ? '#EF4444' : '#374151'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={onBookmark}
            className="bg-white/95 rounded-full p-1.5"
            activeOpacity={0.75}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Ionicons
              name="bookmark-outline"
              size={16}
              color="#374151"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Section */}
      <View className="p-3">
        {/* User Info - Compact */}
        <View className="flex-row items-center mb-2">
          <Image
            source={{ uri: goal.actor.avatarUrl }}
            className="w-7 h-7 rounded-full bg-gray-200"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(0, 0, 0, 0.06)',
            }}
          />
          <View className="flex-1 ml-2">
            <Text className="text-xs font-semibold text-gray-900" numberOfLines={1}>
              {goal.actor.displayName || goal.actor.name || 'User'}
            </Text>
          </View>
          
          <View className="flex-row items-center bg-blue-50 px-2 py-0.5 rounded-full">
            <Ionicons name="heart" size={11} color="#4F46E5" />
            <Text className="ml-1 text-xs font-bold text-blue-600">
              {goal.social.likes}
            </Text>
          </View>
        </View>

        {/* Goal Title - Compact */}
        <Text className="text-sm font-bold text-gray-900 mb-2 leading-4" numberOfLines={2}>
          {goal.title}
        </Text>

        {/* Progress Bar - Compact */}
        <View>
          <View className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${progressPercentage}%`,
                backgroundColor: progressPercentage === 100 ? '#10B981' : '#4F46E5',
              }}
            />
          </View>
          
          <View className="flex-row items-center justify-between mt-1.5">
            <Text className="text-xs font-medium text-gray-500">
              {goal.progress.current}/{goal.progress.total}
            </Text>
            {progressPercentage === 100 && (
              <View className="flex-row items-center bg-green-50 px-1.5 py-0.5 rounded-full">
                <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                <Text className="text-xs text-green-600 ml-0.5 font-semibold">완료</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

