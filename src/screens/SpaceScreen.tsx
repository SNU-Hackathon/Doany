// Space Screen - Community feed for discovering completed goals
// Users can explore, like, and bookmark others' achievements

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import AppHeader from '../components/AppHeader';
import GoalCard from '../components/space/GoalCard';
import { mockFetch } from '../mocks/resolver';

interface SpaceGoal {
  goalId: string;
  title: string;
  thumbnailUrl: string;
  tags: string[];
  category: string;
  visibility: string;
  startAt: number;
  endAt: number;
  completedAt: number;
  actor: {
    actorId: string;
    displayName: string;
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

export default function SpaceScreen() {
  const navigation = useNavigation();
  const [goals, setGoals] = useState<SpaceGoal[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  // Load goals from mock API
  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const res = await mockFetch('GET', '/space/goals');
      const data = await res.json();
      setGoals(data.items || []);
    } catch (error) {
      console.error('[SpaceScreen] Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (goalId: string) => {
    const goal = goals.find(g => g.goalId === goalId);
    if (!goal) return;

    const isCurrentlyLiked = goal.social.didILike;
    const method = isCurrentlyLiked ? 'PATCH' : 'POST'; // PATCH = unlike, POST = like

    try {
      // Optimistic update
      setGoals((prevGoals) =>
        prevGoals.map((g) =>
          g.goalId === goalId
            ? {
                ...g,
                social: {
                  ...g.social,
                  didILike: !isCurrentlyLiked,
                  likes: isCurrentlyLiked ? g.social.likes - 1 : g.social.likes + 1,
                },
              }
            : g
        )
      );

      // Call mock API
      const res = await mockFetch(method, `/space/goals/${goalId}/likes/me`);
      const data = await res.json();
      
      // Update with server response
      if (data.social) {
        setGoals((prevGoals) =>
          prevGoals.map((g) =>
            g.goalId === goalId ? { ...g, social: data.social } : g
          )
        );
      }
    } catch (error) {
      console.error('[SpaceScreen] Failed to toggle like:', error);
      // Revert on error
      setGoals((prevGoals) =>
        prevGoals.map((g) =>
          g.goalId === goalId
            ? {
                ...g,
                social: {
                  ...g.social,
                  didILike: isCurrentlyLiked,
                  likes: isCurrentlyLiked ? g.social.likes + 1 : g.social.likes - 1,
                },
              }
            : g
        )
      );
    }
  };

  const handleBookmark = (goalId: string) => {
    // TODO: Implement bookmark functionality
    console.log('Bookmark goal:', goalId);
  };

  const handleGoalPress = (goalId: string) => {
    // TODO: Navigate to goal detail
    console.log('View goal detail:', goalId);
  };

  const handleRankingPress = () => {
    // @ts-ignore
    navigation.navigate('Ranking');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" />
      
      {/* Unified Header */}
      <AppHeader
        title="성공 둘러보기"
        showNotification={false}
        rightIcon={
          <TouchableOpacity
            onPress={handleRankingPress}
            className="bg-yellow-50 p-2.5 rounded-full"
            activeOpacity={0.75}
            style={{
              shadowColor: '#EAB308',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Ionicons name="trophy" size={22} color="#EAB308" />
          </TouchableOpacity>
        }
        showSearch
        searchPlaceholder="search other's goals!"
        searchValue={searchText}
        onSearchChange={setSearchText}
        showSearchOptions
        onSearchOptionsPress={() => console.log('Search options')}
      />

      {/* Goals Feed */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.goalId}
          renderItem={({ item }) => (
            <GoalCard
              goal={item}
              onPress={() => handleGoalPress(item.goalId)}
              onLike={() => handleLike(item.goalId)}
              onBookmark={() => handleBookmark(item.goalId)}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="planet-outline" size={64} color="#D1D5DB" />
              <Text className="text-xl font-bold text-gray-400 mt-4 text-center">
                아직 완료된 목표가 없습니다
              </Text>
              <Text className="text-gray-400 text-center mt-2 px-8">
                다른 사용자들의 성공을 기다려보세요!
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

