// Profile screen redesigned to match screenshot style
// Clean, modern design with friend system

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { BaseScreen } from '../components';
import { useAuth } from '../hooks/useAuth';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [friendCode, setFriendCode] = useState('');

  const handleSignOut = async () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  const handleAddFriend = () => {
    if (!friendCode.trim()) {
      Alert.alert('오류', '친구 코드를 입력해주세요');
      return;
    }
    
    // TODO: Implement friend add functionality
    Alert.alert('준비중', '친구 추가 기능은 곧 추가됩니다!');
    setFriendModalVisible(false);
    setFriendCode('');
  };

  if (!user) {
    return null;
  }

  // Calculate streak days (dummy data for now)
  const streakDays = 57;
  const level = 3;
  const points = user.points || 3900;

  return (
    <BaseScreen
      title="마이페이지"
      rightAction={{
        icon: 'notifications-outline',
        onPress: () => {},
      }}
      contentPadding={false}
    >

        {/* User Card */}
        <View className="mx-4 mb-6 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          {/* Top Section: Avatar + Info + Level */}
          <View className="flex-row items-start mb-4">
            {/* Avatar */}
            <View className="bg-gray-100 rounded-full w-16 h-16 items-center justify-center mr-4">
              <Ionicons name="person" size={32} color="#9CA3AF" />
            </View>

            {/* Name + Greeting */}
            <View className="flex-1">
              <Text className="text-sm text-gray-600 mb-1">안녕하세요!</Text>
              <View className="flex-row items-center">
                <Text className="text-xl font-bold text-gray-900 mr-2">
                  {user.displayName || 'Lee Seo June'} 님
                </Text>
                <TouchableOpacity>
                  <Ionicons name="settings-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Streak Badge */}
            <View className="bg-yellow-100 rounded-full px-3 py-1">
              <Text className="text-yellow-600 font-bold text-sm">D+{streakDays}</Text>
            </View>
          </View>

          {/* Divider */}
          <View className="border-t border-gray-100 my-4" />

          {/* Stats Section */}
          <View className="flex-row items-center justify-between">
            {/* Points */}
            <View className="flex-row items-center">
              <View className="bg-yellow-400 rounded-full w-10 h-10 items-center justify-center mr-2">
                <Text className="font-bold text-white text-sm">P</Text>
              </View>
              <Text className="text-xl font-bold text-gray-900">{points.toLocaleString()}</Text>
            </View>

            {/* Level */}
            <View className="bg-yellow-100 rounded-full px-4 py-2">
              <Text className="text-yellow-600 font-bold">Lv.{level}</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View className="px-4">
          {/* Friend Invite */}
          <TouchableOpacity 
            className="flex-row items-center py-4 border-b border-gray-100"
            onPress={() => setFriendModalVisible(true)}
          >
            <Ionicons name="person-add-outline" size={20} color="#6B7280" />
            <Text className="flex-1 ml-3 text-base text-gray-900 font-medium">친구 초대하기</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Notice */}
          <TouchableOpacity 
            className="flex-row items-center py-4 border-b border-gray-100"
            onPress={() => Alert.alert('준비중', '공지사항은 곧 추가됩니다!')}
          >
            <Ionicons name="megaphone-outline" size={20} color="#6B7280" />
            <Text className="flex-1 ml-3 text-base text-gray-900 font-medium">공지사항</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Developer Info */}
          <TouchableOpacity 
            className="flex-row items-center py-4 border-b border-gray-100"
            onPress={() => Alert.alert('준비중', '개인정보는 곧 추가됩니다!')}
          >
            <Ionicons name="call-outline" size={20} color="#6B7280" />
            <Text className="flex-1 ml-3 text-base text-gray-900 font-medium">개인정보</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Language */}
          <TouchableOpacity 
            className="flex-row items-center py-4 border-b border-gray-100"
            onPress={() => Alert.alert('준비중', '언어 설정은 곧 추가됩니다!')}
          >
            <Ionicons name="language-outline" size={20} color="#6B7280" />
            <Text className="flex-1 ml-3 text-base text-gray-900 font-medium">Language</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity 
            className="flex-row items-center py-4 border-b border-gray-100"
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#6B7280" />
            <Text className="flex-1 ml-3 text-base text-gray-900 font-medium">
              {signingOut ? '로그아웃 중...' : '로그아웃'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Customer Center */}
          <TouchableOpacity 
            className="flex-row items-center py-4"
            onPress={() => Alert.alert('준비중', '고객센터는 곧 추가됩니다!')}
          >
            <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
            <Text className="flex-1 ml-3 text-base text-gray-900 font-medium">고객센터</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

      {/* Friend Add Modal */}
      <Modal
        visible={friendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFriendModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 400,
            }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A' }}>
                친구 추가
              </Text>
              <TouchableOpacity onPress={() => setFriendModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text className="text-sm text-gray-600 mb-4">
              친구의 코드를 입력하여 함께 목표를 달성하세요!
            </Text>

            {/* Input */}
            <TextInput
              value={friendCode}
              onChangeText={setFriendCode}
              placeholder="친구 코드 입력"
              placeholderTextColor="#9CA3AF"
              className="bg-gray-50 rounded-xl px-4 py-3 mb-6 text-base"
            />

            {/* My Code Section */}
            <View className="bg-blue-50 rounded-xl p-4 mb-6">
              <Text className="text-xs text-gray-600 mb-1">내 코드</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-gray-900">{user.id.substring(0, 8).toUpperCase()}</Text>
                <TouchableOpacity 
                  className="bg-blue-600 rounded-lg px-4 py-2"
                  onPress={() => {
                    // TODO: Copy to clipboard
                    Alert.alert('복사됨', '코드가 복사되었습니다!');
                  }}
                >
                  <Text className="text-white font-bold text-sm">복사</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setFriendModalVisible(false)}
                className="flex-1 bg-gray-100 rounded-xl py-3"
              >
                <Text className="text-center text-gray-700 font-bold">취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddFriend}
                className="flex-1 bg-blue-600 rounded-xl py-3"
              >
                <Text className="text-center text-white font-bold">추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </BaseScreen>
  );
}
