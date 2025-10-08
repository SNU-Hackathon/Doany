// Feed screen - Community space for discovering and engaging with others' goals
// Renamed from SpacesScreen to align with new navigation structure

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BaseScreen } from '../components';

export default function FeedScreen() {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  const categories = ['All', '공부 & 성장', '운동 & 건강', '수면'];
  const types = ['All', 'Schedule', 'Frequency', 'Milestone'];

  return (
    <BaseScreen
      title="피드"
      rightAction={{
        icon: 'notifications-outline',
        onPress: () => {},
      }}
      contentPadding={false}
    >
      {/* Search Bar */}
      <View className="px-4 mb-4">
        <View className="bg-gray-50 rounded-xl flex-row items-center px-4 py-3">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <Text className="flex-1 ml-2 text-gray-400 text-sm">search others goal</Text>
          <TouchableOpacity>
            <Ionicons name="options-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="px-4">
        {/* Category Chips */}
        <View className="mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                className={`mr-3 px-5 py-2 rounded-full ${
                  selectedCategory === category ? 'bg-blue-600' : 'bg-gray-100'
                }`}
                onPress={() => setSelectedCategory(category)}
              >
                <Text className={`font-bold text-sm ${
                  selectedCategory === category ? 'text-white' : 'text-gray-600'
                }`}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Type Chips */}
        <View className="mb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {types.map((type) => (
              <TouchableOpacity
                key={type}
                className={`mr-3 px-5 py-2 rounded-full ${
                  selectedType === type ? 'bg-blue-600' : 'bg-gray-100'
                }`}
                onPress={() => setSelectedType(type)}
              >
                <Text className={`font-bold text-sm ${
                  selectedType === type ? 'text-white' : 'text-gray-600'
                }`}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Goals Space Section */}
        <View className="py-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">Goals Space</Text>
          
          {/* Empty state - will be populated with community goals */}
          <View className="items-center justify-center py-16">
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text className="text-xl font-bold text-gray-400 mt-4 text-center">
              커뮤니티 목표
            </Text>
            <Text className="text-gray-400 text-center mt-2 px-8">
              다른 사용자들의 목표를 탐색하고 함께 성장하세요!
            </Text>
          </View>
        </View>
      </View>
    </BaseScreen>
  );
}
