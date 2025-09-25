import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  // Mock user data - these should be dynamic based on user's actual progress
  const userData = {
    name: 'Lee Seo June',
    dayWithKangaroo: 57,
    kangarooLevel: 3,
    progressPercentage: 75,
    streak: 13,
    badges: [
      { type: 'medal', earned: true },
      { type: 'crown', earned: true },
      { type: 'heart', earned: true },
      { type: 'level1', earned: true },
      { type: 'level2', earned: true }
    ]
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Navy Header Section */}
      <View className="bg-navy px-4 pt-12 pb-4">
        <View className="flex-row items-center mb-4">
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=50' }}
            className="w-12 h-12 rounded-full mr-3"
          />
          <View className="flex-1">
            <Text className="text-blue-200 text-base">Good Morning</Text>
            <Text className="text-white text-xl font-bold">{userData.name}</Text>
            <Text className="text-blue-200 text-sm">Day {userData.dayWithKangaroo} with your Kangaroo!</Text>
          </View>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Achievement Banner */}
        <TouchableOpacity className="bg-sunny rounded-2xl p-4 mb-6 mt-4">
          <Text className="text-gray-900 text-lg font-semibold mb-2">
            Achieve more goals and make the kangaroo jump higher!
          </Text>
          <Text className="text-gray-700 text-sm">
            achieve more goals...
          </Text>
        </TouchableOpacity>

        {/* Mascot Section */}
        <View className="bg-white rounded-2xl p-6 mb-6 items-center">
          {/* Badges Section */}
          <View className="absolute top-4 left-4">
            <Text className="text-orange-500 font-semibold mb-2">your badge</Text>
            <View className="flex-row flex-wrap">
              {userData.badges.map((badge, index) => (
                <View key={index} className="mr-2 mb-2">
                  {badge.type === 'medal' && (
                    <View className="w-10 h-10 bg-orange-500 rounded-full items-center justify-center">
                      <Ionicons name="medal" size={20} color="white" />
                    </View>
                  )}
                  {badge.type === 'crown' && (
                    <View className="w-10 h-10 bg-yellow-400 rounded-full items-center justify-center">
                      <Text className="text-white text-xs font-bold">⭐</Text>
                    </View>
                  )}
                  {badge.type === 'heart' && (
                    <View className="w-10 h-10 bg-red-400 rounded-full items-center justify-center">
                      <Ionicons name="heart" size={16} color="white" />
                    </View>
                  )}
                  {badge.type === 'level1' && (
                    <View className="bg-yellow-600 rounded-full px-2 py-1">
                      <Text className="text-white text-xs font-bold">LV 1</Text>
                    </View>
                  )}
                  {badge.type === 'level2' && (
                    <View className="bg-purple-600 rounded-full px-2 py-1">
                      <Text className="text-white text-xs font-bold">LV 2</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Kangaroo Mascot Area */}
          <View className="items-center mt-8">
            <Text className="text-xl font-bold text-gray-900 mb-4">LV. {userData.kangarooLevel} Kangaroo</Text>
            
            {/* Placeholder for kangaroo image and environment */}
            <View className="w-64 h-48 bg-green-100 rounded-2xl items-center justify-center mb-4 relative">
              {/* Trees/Environment */}
              <View className="absolute right-4 top-4">
                <View className="w-12 h-16 bg-green-500 rounded-full" />
                <View className="w-8 h-12 bg-green-600 rounded-full absolute top-2 left-2" />
              </View>
              
              {/* Kangaroo placeholder */}
              <View className="items-center">
                <View className="w-16 h-20 bg-orange-400 rounded-full items-center justify-center">
                  <Text className="text-white font-bold">🦘</Text>
                </View>
                <Text className="text-gray-600 text-sm mt-2">Kangaroo</Text>
              </View>
              
              {/* Ground */}
              <View className="absolute bottom-0 left-0 right-0 h-8 bg-green-300 rounded-b-2xl" />
            </View>

            {/* Progress Bar */}
            <View className="w-full mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="bg-navy rounded-full w-8 h-8 items-center justify-center">
                  <Text className="text-white text-xs font-bold">LV. {userData.kangarooLevel}</Text>
                </View>
                <View className="flex-1 mx-3 bg-gray-200 rounded-full h-3">
                  <View 
                    className="bg-sunny h-3 rounded-full" 
                    style={{ width: `${userData.progressPercentage}%` }}
                  />
                </View>
                <View className="flex-row items-center">
                  <Text className="text-orange-500 font-bold text-lg">{userData.progressPercentage}%</Text>
                  <Ionicons name="star" size={20} color="#F59E0B" className="ml-1" />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Streak Section */}
        <View className="bg-white rounded-2xl p-4 mb-6">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="flame" size={24} color="#F97316" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">{userData.streak}-Day Streak!</Text>
              <View className="flex-row items-center">
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
                <Text className="text-orange-500 font-medium ml-1">
                  1 more day to unlock your ⭐ Badge!
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}