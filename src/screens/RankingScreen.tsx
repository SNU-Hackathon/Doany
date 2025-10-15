// Ranking Screen - Monthly leaderboard showing top users by XP
// Displays user's current rank and top performers

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import RankCard from '../components/ranking/RankCard';
import rankingData from '../mocks/ranking.json';

export default function RankingScreen() {
  const navigation = useNavigation();
  const mockRanking = rankingData.rankings;
  const myRank = rankingData.myRank;
  const topThree = mockRanking.slice(0, 3);
  const otherRanks = mockRanking.slice(3);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-3 pb-6 bg-white">
          <View className="flex-row items-center mb-6">
            <TouchableOpacity
              className="mr-3 p-2"
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900 flex-1">
              이 달의 랭킹
            </Text>
            <TouchableOpacity className="p-2" activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* My Rank Card */}
          <View
            className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-5 mb-6"
            style={{
              shadowColor: '#4F46E5',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-semibold text-gray-600 mb-1">
                  My Rank
                </Text>
                <Text className="text-3xl font-bold text-gray-900">
                  #{myRank.rank}
                </Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center bg-white/80 rounded-full px-4 py-2">
                  <Ionicons name="flash" size={18} color="#4F46E5" />
                  <Text className="ml-1 text-base font-bold text-gray-900">
                    {myRank.xp.toLocaleString()} xps
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Top 3 Podium */}
        <View className="px-4 py-6 bg-white mb-4">
          <View className="flex-row items-end justify-center h-64">
            {/* 2nd Place */}
            <View className="flex-1 items-center mb-8">
              <View className="relative">
                <Image
                  source={{ uri: topThree[1].avatarUrl }}
                  className="w-20 h-20 rounded-full bg-gray-200"
                />
                <View className="absolute -bottom-2 self-center bg-gray-300 rounded-full w-8 h-8 items-center justify-center border-2 border-white">
                  <Text className="text-sm font-bold text-gray-700">2</Text>
                </View>
              </View>
              <Text className="text-sm font-semibold text-gray-900 mt-4">
                {topThree[1].name}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                {topThree[1].xp.toLocaleString()} xps
              </Text>
              <View className="bg-gray-200 rounded-t-xl w-full h-32 mt-3" />
            </View>

            {/* 1st Place */}
            <View className="flex-1 items-center">
              <Ionicons
                name="trophy"
                size={32}
                color="#EAB308"
                style={{ marginBottom: 8 }}
              />
              <View className="relative">
                <Image
                  source={{ uri: topThree[0].avatarUrl }}
                  className="w-24 h-24 rounded-full bg-gray-200 border-4 border-yellow-400"
                />
                <View className="absolute -bottom-2 self-center bg-yellow-400 rounded-full w-8 h-8 items-center justify-center border-2 border-white">
                  <Text className="text-sm font-bold text-gray-800">1</Text>
                </View>
              </View>
              <Text className="text-base font-bold text-gray-900 mt-4">
                {topThree[0].name}
              </Text>
              <Text className="text-sm text-gray-600 mt-1">
                {topThree[0].xp.toLocaleString()} xps
              </Text>
              <View className="bg-yellow-400 rounded-t-xl w-full h-40 mt-3" />
            </View>

            {/* 3rd Place */}
            <View className="flex-1 items-center mb-12">
              <View className="relative">
                <Image
                  source={{ uri: topThree[2].avatarUrl }}
                  className="w-20 h-20 rounded-full bg-gray-200"
                />
                <View className="absolute -bottom-2 self-center bg-orange-400 rounded-full w-8 h-8 items-center justify-center border-2 border-white">
                  <Text className="text-sm font-bold text-gray-700">3</Text>
                </View>
              </View>
              <Text className="text-sm font-semibold text-gray-900 mt-4">
                {topThree[2].name}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                {topThree[2].xp.toLocaleString()} xps
              </Text>
              <View className="bg-orange-200 rounded-t-xl w-full h-24 mt-3" />
            </View>
          </View>
        </View>

        {/* Rest of Rankings */}
        <View className="pb-24">
          {otherRanks.map((user) => (
            <RankCard key={user.rank} user={user} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

