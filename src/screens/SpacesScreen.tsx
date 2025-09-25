import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SpacesScreen() {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  const categories = ['All', 'Health & Fitness', 'Study & Growth'];
  const types = ['All', 'Schedule', 'Frequency', 'Partner'];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-navy px-4 pt-12 pb-4">
        <Text className="text-white text-xl font-semibold mb-4">Spaces</Text>
        
        {/* Search Bar */}
        <View className="bg-white rounded-lg flex-row items-center px-3 py-2 mb-3">
          <Ionicons name="search" size={20} color="#6B7280" />
          <Text className="flex-1 ml-2 text-gray-500">search others goal</Text>
          <TouchableOpacity>
            <Ionicons name="options" size={20} color="#6B7280" />
          </TouchableOpacity>
          <View className="w-2 h-2 bg-orange-400 rounded-full ml-2" />
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Goals Space Title */}
        <View className="py-4">
          <Text className="text-xl font-bold text-gray-900 mb-4">Goals Space</Text>
          
          {/* Category Chips */}
          <View className="mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  className={`mr-3 px-4 py-2 rounded-full ${
                    selectedCategory === category ? 'bg-sunny' : 'bg-gray-200'
                  }`}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text className={`font-medium ${
                    selectedCategory === category ? 'text-gray-900' : 'text-gray-600'
                  }`}>
                    {category}
                  </Text>
                  {category === 'Study & Growth' && (
                    <View className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
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
                  className={`mr-3 px-4 py-2 rounded-full ${
                    selectedType === type ? 'bg-sunny' : 'bg-gray-200'
                  }`}
                  onPress={() => setSelectedType(type)}
                >
                  <Text className={`font-medium ${
                    selectedType === type ? 'text-gray-900' : 'text-gray-600'
                  }`}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* TOP RANKINGS Section */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">TOP RANKINGS</Text>
          
          {/* Partner Goal Cards - Template Structure */}
          {Array.from({ length: 5 }, (_, index) => (
            <View key={index} className="bg-sunny rounded-2xl p-4 mb-3 shadow-sm">
              <View className="flex-row items-center justify-between mb-2">
                <View className="bg-lavender rounded-full px-3 py-1">
                  <Text className="text-white text-xs font-medium">Partner</Text>
                </View>
                <TouchableOpacity>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#374151" />
                </TouchableOpacity>
              </View>
              
              <Text className="text-lg font-semibold text-gray-900 mb-1">
                Sample Goal Title {index + 1}
              </Text>
              <Text className="text-sm text-gray-600 mb-2">
                Sample Name | Partner: Sample Partner
              </Text>
              
              {/* Progress Bar */}
              <View className="bg-gray-200 rounded-full h-2 mb-3">
                <View className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }} />
              </View>
              
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Text className="text-sm font-semibold text-gray-900">100% Completed!!!</Text>
                  <View className="flex-row items-center ml-3">
                    <Ionicons name="heart" size={16} color="#EF4444" />
                    <Text className="text-sm text-gray-600 ml-1">
                      {Math.floor(Math.random() * 10000) + 1000}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-600">
                  Completed on {new Date().toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
