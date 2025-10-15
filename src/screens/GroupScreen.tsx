// Group Screen - Browse and join community groups
// Displays popular groups and user's joined groups

import { Ionicons } from '@expo/vector-icons';
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
import GroupCard from '../components/group/GroupCard';
import { mockFetch } from '../mocks/resolver';

interface Group {
  id: string;
  name: string;
  iconUrl: string;
  memberNum: number;
  description?: string;
  category?: string;
}

type TabType = '인기' | '내 그룹';

export default function GroupScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('인기');
  const [searchText, setSearchText] = useState('');
  const [popularGroups, setPopularGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Load groups on mount
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      
      // Load popular groups
      const resPopular = await mockFetch('GET', '/groups/all');
      const dataPopular = await resPopular.json();
      setPopularGroups(dataPopular.groups || []);
      
      // Load my groups
      const resMy = await mockFetch('GET', '/groups/my');
      const dataMy = await resMy.json();
      setMyGroups(dataMy.groups || []);
    } catch (error) {
      console.error('[GroupScreen] Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupPress = (groupId: string) => {
    // TODO: Navigate to group detail
    console.log('View group detail:', groupId);
  };

  const handleCreateGroup = () => {
    // TODO: Navigate to create group
    console.log('Create new group');
  };

  const currentGroups = activeTab === '인기' ? popularGroups : myGroups;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Unified Header */}
      <AppHeader
        title="그룹"
        showNotification
        onNotificationPress={() => console.log('Notifications')}
        showSearch
        searchPlaceholder="search groups"
        searchValue={searchText}
        onSearchChange={setSearchText}
        showSearchOptions
        onSearchOptionsPress={() => console.log('Search options')}
        showActionButton
        actionButtonIcon="add"
        onActionButtonPress={handleCreateGroup}
        actionButtonColor="#4F46E5"
      />

      {/* Tabs Container */}
      <View className="bg-white border-b border-gray-100">

        {/* Tab Bar */}
        <View className="flex-row border-b border-gray-200">
          {(['인기', '내 그룹'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className="flex-1 items-center pb-3"
                activeOpacity={0.7}
              >
                <Text
                  className={`text-base font-bold ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {tab}
                </Text>
                {isActive && (
                  <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Groups List */}
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={currentGroups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GroupCard
              group={{
                ...item,
                members: item.memberNum, // Map memberNum to members
              }}
              onPress={() => handleGroupPress(item.id)}
            />
          )}
          contentContainerStyle={{
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="people-outline" size={64} color="#D1D5DB" />
              <Text className="text-xl font-bold text-gray-400 mt-4 text-center">
                {activeTab === '인기' ? '그룹이 없습니다' : '가입한 그룹이 없습니다'}
              </Text>
              <Text className="text-gray-400 text-center mt-2 px-8">
                {activeTab === '인기'
                  ? '새로운 그룹이 생기면 알려드릴게요!'
                  : '그룹에 가입하고 함께 목표를 달성하세요!'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

