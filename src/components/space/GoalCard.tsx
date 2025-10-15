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
      className="bg-white rounded-3xl overflow-hidden mb-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Thumbnail Image */}
      <View className="relative">
        <Image
          source={{ uri: goal.thumbnailUrl }}
          className="w-full h-56"
          resizeMode="cover"
        />
        
        {/* Action Icons Overlay */}
        <View className="absolute top-4 right-4 flex-row" style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={onLike}
            className="bg-white/95 rounded-full p-2.5"
            activeOpacity={0.75}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Ionicons
              name={goal.social.didILike ? 'heart' : 'heart-outline'}
              size={20}
              color={goal.social.didILike ? '#EF4444' : '#374151'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={onBookmark}
            className="bg-white/95 rounded-full p-2.5"
            activeOpacity={0.75}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Ionicons
              name="bookmark-outline"
              size={20}
              color="#374151"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Section */}
      <View className="p-5">
        {/* User Info */}
        <View className="flex-row items-center mb-3.5">
          <Image
            source={{ uri: goal.actor.avatarUrl }}
            className="w-11 h-11 rounded-full bg-gray-200"
            style={{
              borderWidth: 1.5,
              borderColor: 'rgba(0, 0, 0, 0.06)',
            }}
          />
          <View className="flex-1 ml-3">
            <Text className="text-sm font-semibold text-gray-900">
              {goal.actor.displayName || goal.actor.name || 'User'}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {goal.category}
            </Text>
          </View>
          
          <View className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-full">
            <Ionicons name="heart" size={14} color="#4F46E5" />
            <Text className="ml-1.5 text-sm font-bold text-blue-600">
              {goal.social.likes}
            </Text>
          </View>
        </View>

        {/* Goal Title */}
        <Text className="text-base font-bold text-gray-900 mb-3.5 leading-5">
          {goal.title}
        </Text>

        {/* Progress Bar */}
        <View>
          <View className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${progressPercentage}%`,
                backgroundColor: progressPercentage === 100 ? '#10B981' : '#4F46E5',
              }}
            />
          </View>
          
          <View className="flex-row items-center justify-between mt-2.5">
            <Text className="text-xs font-medium text-gray-500">
              {goal.progress.current}/{goal.progress.total} 완료
            </Text>
            {progressPercentage === 100 && (
              <View className="flex-row items-center bg-green-50 px-2 py-1 rounded-full">
                <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                <Text className="text-xs text-green-600 ml-1 font-semibold">완료</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

