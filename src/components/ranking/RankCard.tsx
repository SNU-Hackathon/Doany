// Rank Card component for Ranking screen
// Displays user ranking with XP

import React from 'react';
import { Image, Text, View } from 'react-native';

interface RankingUser {
  rank: number;
  name: string;
  xp: number;
  avatarUrl: string;
}

interface RankCardProps {
  user: RankingUser;
  isTopThree?: boolean;
}

export default function RankCard({ user, isTopThree = false }: RankCardProps) {
  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-400';
    if (rank === 2) return 'bg-gray-300';
    if (rank === 3) return 'bg-orange-400';
    return 'bg-gray-100';
  };

  const getRankTextColor = (rank: number) => {
    if (rank <= 3) return 'text-gray-800';
    return 'text-gray-500';
  };

  if (isTopThree) {
    return null; // Top 3 are displayed separately in podium
  }

  return (
    <View
      className="flex-row items-center py-4 px-5 bg-white rounded-2xl mb-3 mx-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Rank Badge */}
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${getRankBadgeColor(user.rank)}`}
      >
        <Text className={`text-base font-bold ${getRankTextColor(user.rank)}`}>
          {user.rank}
        </Text>
      </View>

      {/* User Avatar */}
      <Image
        source={{ uri: user.avatarUrl }}
        className="w-12 h-12 rounded-full ml-4 bg-gray-200"
      />

      {/* User Info */}
      <View className="flex-1 ml-4">
        <Text className="text-base font-semibold text-gray-900">
          {user.name}
        </Text>
      </View>

      {/* XP */}
      <Text className="text-sm font-bold text-gray-400">
        {user.xp.toLocaleString()} xps
      </Text>
    </View>
  );
}

