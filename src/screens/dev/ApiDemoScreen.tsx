/**
 * API v1.3 Demo Screen
 * 
 * Demonstrates the new DoAny API integration with mock data.
 * Shows goals, feed, swipe, and system endpoints in action.
 * 
 * This is a development screen - not part of the main navigation.
 * Access via: navigation.navigate('ApiDemo')
 */

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { getHealth } from '../../api/system';
import { getMe } from '../../api/users';
import { apiConfig } from '../../config/api';
import { useFeedGoals } from '../../hooks/useFeed';
import { useMyGoals } from '../../hooks/useGoals';
import { useSwipeProofs } from '../../hooks/useSwipe';

export default function ApiDemoScreen() {
  const [activeTab, setActiveTab] = useState<'goals' | 'feed' | 'swipe'>('goals');
  const [systemStatus, setSystemStatus] = useState<string>('');

  // Fetch data using hooks
  const goals = useMyGoals({ page: 1, pageSize: 10 });
  const feed = useFeedGoals({ page: 1, pageSize: 10 });
  const swipeProofs = useSwipeProofs({ page: 1, pageSize: 5 });

  const checkSystemHealth = async () => {
    try {
      const health = await getHealth();
      Alert.alert('System Health', JSON.stringify(health, null, 2));
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  };

  const checkUserProfile = async () => {
    try {
      const user = await getMe();
      Alert.alert('User Profile', JSON.stringify(user, null, 2));
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header with API Status */}
      <View className="bg-blue-600 px-4 pt-12 pb-4">
        <Text className="text-white text-2xl font-bold mb-2">
          DoAny API v1.3 Demo
        </Text>
        <View className="bg-white/20 rounded-lg p-3 mb-2">
          <Text className="text-white text-xs font-semibold mb-1">
            API Base URL:
          </Text>
          <Text className="text-white text-xs">{apiConfig.baseURL}</Text>
        </View>
        <View className="flex-row gap-2">
          <View className={`flex-1 rounded-lg p-2 ${apiConfig.useMocks ? 'bg-yellow-500' : 'bg-green-500'}`}>
            <Text className="text-white text-xs font-semibold">
              {apiConfig.useMocks ? '🎭 Mock Mode' : '🌐 Live API'}
            </Text>
          </View>
          <View className="flex-1 bg-white/20 rounded-lg p-2">
            <Text className="text-white text-xs font-semibold">
              Vote Mode: {apiConfig.votePathMode}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View className="flex-row px-4 py-3 bg-gray-50 border-b border-gray-200">
        <TouchableOpacity
          className="flex-1 bg-blue-100 rounded-lg p-3 mr-2"
          onPress={checkSystemHealth}
        >
          <Text className="text-blue-700 text-xs font-semibold text-center">
            Health Check
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-purple-100 rounded-lg p-3"
          onPress={checkUserProfile}
        >
          <Text className="text-purple-700 text-xs font-semibold text-center">
            User Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200">
        {(['goals', 'feed', 'swipe'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-3 ${activeTab === tab ? 'border-b-2 border-blue-600' : ''}`}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === tab ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView className="flex-1">
        {activeTab === 'goals' && (
          <GoalsTab
            data={goals.data}
            isLoading={goals.isLoading}
            error={goals.error}
            refetch={goals.refetch}
          />
        )}
        {activeTab === 'feed' && (
          <FeedTab
            data={feed.data}
            isLoading={feed.isLoading}
            error={feed.error}
            refetch={feed.refetch}
          />
        )}
        {activeTab === 'swipe' && (
          <SwipeTab
            data={swipeProofs.data}
            isLoading={swipeProofs.isLoading}
            error={swipeProofs.error}
            refetch={swipeProofs.refetch}
          />
        )}
      </ScrollView>
    </View>
  );
}

// Goals Tab Component
function GoalsTab({ data, isLoading, error, refetch }: any) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-gray-500 mt-4">Loading goals...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-20 px-4">
        <Text className="text-red-600 text-center mb-4">
          Error: {error.message}
        </Text>
        <TouchableOpacity
          className="bg-blue-600 px-6 py-3 rounded-lg"
          onPress={refetch}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="p-4">
      <Text className="text-sm text-gray-500 mb-4">
        {data?.total || 0} goals · Page {data?.page || 1}
      </Text>
      {data?.items?.map((goal: any) => (
        <View key={goal.goalId} className="bg-white rounded-xl p-4 mb-3 border border-gray-200">
          <Text className="text-lg font-bold mb-1">{goal.title}</Text>
          {goal.description && (
            <Text className="text-gray-600 text-sm mb-2">{goal.description}</Text>
          )}
          <View className="flex-row flex-wrap gap-2 mb-2">
            {goal.tags?.map((tag: string) => (
              <View key={tag} className="bg-blue-100 px-2 py-1 rounded">
                <Text className="text-blue-700 text-xs">#{tag}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">
              {goal.state} · {goal.visibility}
            </Text>
            <Text className="text-xs text-gray-500">❤️ {goal.likes || 0}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Feed Tab Component
function FeedTab({ data, isLoading, error, refetch }: any) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-gray-500 mt-4">Loading feed...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-20 px-4">
        <Text className="text-red-600 text-center mb-4">
          Error: {error.message}
        </Text>
        <TouchableOpacity
          className="bg-blue-600 px-6 py-3 rounded-lg"
          onPress={refetch}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="p-4">
      <Text className="text-sm text-gray-500 mb-4">
        {data?.total || 0} posts · Page {data?.page || 1}
      </Text>
      {data?.items?.map((item: any) => (
        <View key={item.goalId} className="bg-white rounded-xl p-4 mb-3 border border-gray-200">
          <View className="flex-row items-center mb-2">
            <View className="bg-blue-500 w-8 h-8 rounded-full items-center justify-center mr-2">
              <Text className="text-white font-bold text-xs">
                {item.userName?.[0] || 'U'}
              </Text>
            </View>
            <Text className="text-sm font-semibold">{item.userName || 'Anonymous'}</Text>
          </View>
          <Text className="text-lg font-bold mb-1">{item.title}</Text>
          <View className="flex-row justify-between items-center mt-2">
            <Text className="text-xs text-gray-500">
              ❤️ {item.likes} {item.didILike ? '(You liked)' : ''}
            </Text>
            <Text className="text-xs text-gray-500">{item.state}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Swipe Tab Component
function SwipeTab({ data, isLoading, error, refetch }: any) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-gray-500 mt-4">Loading proofs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-20 px-4">
        <Text className="text-red-600 text-center mb-4">
          Error: {error.message}
        </Text>
        <TouchableOpacity
          className="bg-blue-600 px-6 py-3 rounded-lg"
          onPress={refetch}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="p-4">
      <Text className="text-sm text-gray-500 mb-4">
        {data?.length || 0} proofs to review
      </Text>
      {data?.map((proof: any) => (
        <View key={proof.proofId} className="bg-white rounded-xl p-4 mb-3 border border-gray-200">
          <View className="flex-row items-center mb-2">
            <View className="bg-purple-500 w-8 h-8 rounded-full items-center justify-center mr-2">
              <Text className="text-white font-bold text-xs">
                {proof.userName?.[0] || 'U'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold">{proof.userName || 'Anonymous'}</Text>
              <Text className="text-xs text-gray-500">{proof.goalTitle || 'Goal'}</Text>
            </View>
          </View>
          <View className="bg-gray-100 rounded-lg p-3 mb-2">
            <Text className="text-xs text-gray-500">Proof URL:</Text>
            <Text className="text-xs text-gray-700" numberOfLines={1}>{proof.url}</Text>
          </View>
          {proof.description && (
            <Text className="text-sm text-gray-600 mb-2">{proof.description}</Text>
          )}
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">
              ✅ {proof.votes?.yes || 0} · ❌ {proof.votes?.no || 0}
            </Text>
            <Text className="text-xs text-gray-500">{proof.type}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

