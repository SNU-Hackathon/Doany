// Profile screen redesigned to match screenshot style
// Clean, modern design with friend system

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
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
  const points = 3900; // TODO: Add points to User type when backend supports it

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Custom Header - 스크린샷과 정확히 일치 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>마이페이지</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="#1F2937" />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* User Card - 스크린샷과 정확히 일치 */}
        <View style={styles.userCard}>
          {/* Top Section: Avatar + Info + D+57 Badge */}
          <View style={styles.topSection}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={32} color="#9CA3AF" />
            </View>

            {/* Name + Greeting + Settings */}
            <View style={styles.nameSection}>
              <Text style={styles.greeting}>안녕하세요!</Text>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>
                  {user.name || 'Lee Seo June'} 님
                </Text>
                <TouchableOpacity style={styles.settingsButton}>
                  <Ionicons name="settings-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* D+57 Badge - 연한 녹색으로 표시 */}
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>D+{streakDays}</Text>
            </View>
          </View>

          {/* Divider Line */}
          <View style={styles.divider} />

          {/* Bottom Section: Points + Level */}
          <View style={styles.bottomSection}>
            {/* Points with P icon */}
            <View style={styles.pointsContainer}>
              <View style={styles.pointsIcon}>
                <Text style={styles.pointsIconText}>P</Text>
              </View>
              <Text style={styles.pointsText}>{points.toLocaleString()}</Text>
            </View>

            {/* Level Badge */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.{level}</Text>
            </View>
          </View>
        </View>

        {/* Menu Items - 스크린샷과 정확히 일치하는 순서와 아이콘 */}
        <View style={styles.menuContainer}>
          {/* Friend Invite - 첫 번째 구분선 위 */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setFriendModalVisible(true)}
          >
            <Ionicons name="person-add-outline" size={20} color="#6B7280" />
            <Text style={styles.menuText}>친구 초대하기</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Divider Line */}
          <View style={styles.menuDivider} />

          {/* Notice */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => Alert.alert('준비중', '공지사항은 곧 추가됩니다!')}
          >
            <Ionicons name="newspaper-outline" size={20} color="#6B7280" />
            <Text style={styles.menuText}>공지사항</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Privacy/Personal Info - 방패 아이콘 */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => Alert.alert('준비중', '개인정보는 곧 추가됩니다!')}
          >
            <Ionicons name="shield-outline" size={20} color="#6B7280" />
            <Text style={styles.menuText}>개인정보</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Language */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => Alert.alert('준비중', '언어 설정은 곧 추가됩니다!')}
          >
            <Ionicons name="language-outline" size={20} color="#6B7280" />
            <Text style={styles.menuText}>Language</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#6B7280" />
            <Text style={styles.menuText}>
              {signingOut ? '로그아웃 중...' : '로그아웃'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Customer Center */}
          <TouchableOpacity 
            style={[styles.menuItem, styles.lastMenuItem]}
            onPress={() => Alert.alert('준비중', '고객센터는 곧 추가됩니다!')}
          >
            <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
            <Text style={styles.menuText}>고객센터</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
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
    </SafeAreaView>
  );
}

// 스크린샷과 정확히 일치하는 스타일
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  notificationButton: {
    position: 'relative',
    padding: 6,
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  nameSection: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginRight: 8,
  },
  settingsButton: {
    padding: 4,
  },
  streakBadge: {
    backgroundColor: '#ECFDF5', // 더 밝은 연한 녹색
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981', // 더 밝은 녹색 텍스트
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B', // 노란색
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  pointsIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  pointsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  levelBadge: {
    backgroundColor: '#FEF3C7', // 연한 노란색
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D97706', // 노란색 텍스트
  },
  menuContainer: {
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 32, // 아이콘 너비 + margin
  },
});
