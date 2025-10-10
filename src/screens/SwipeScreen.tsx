import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SwipeProofItem } from '../api/types';
import { BaseScreen, LoadingState } from '../components';
import { useAuth } from '../hooks/useAuth';
import { useSwipeProofs, useVoteMutation } from '../hooks/useSwipe';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Swipe Card Component
const SwipeCard = React.memo(({ 
  proof, 
  onVote 
}: { 
  proof: SwipeProofItem; 
  onVote: (proofId: string, vote: 'yes' | 'no') => void;
}) => {
  const handleVoteYes = useCallback(() => {
    onVote(proof.proofId, 'yes');
  }, [proof.proofId, onVote]);

  const handleVoteNo = useCallback(() => {
    onVote(proof.proofId, 'no');
  }, [proof.proofId, onVote]);

  return (
    <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
      {/* Header: User info */}
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
          <Text className="text-blue-600 font-bold text-lg">
            {proof.userName?.charAt(0) || 'U'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">{proof.userName}</Text>
          <Text className="text-sm text-gray-500">{proof.goalTitle}</Text>
        </View>
      </View>

      {/* Image */}
      <View className="bg-gray-100 rounded-xl mb-3 overflow-hidden">
        <Image
          source={{ uri: proof.url }}
          style={{ 
            width: '100%', 
            height: 200,
            resizeMode: 'cover'
          }}
          defaultSource={{ uri: 'https://via.placeholder.com/300x200?text=Loading...' }}
        />
      </View>

      {/* Description */}
      <Text className="text-gray-700 mb-3 leading-5">
        {proof.description}
      </Text>

      {/* Vote stats */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Ionicons name="thumbs-up-outline" size={16} color="#10B981" />
          <Text className="text-sm text-green-600 ml-1 mr-4">
            {proof.votes.yes}
          </Text>
          <Ionicons name="thumbs-down-outline" size={16} color="#EF4444" />
          <Text className="text-sm text-red-600 ml-1">
            {proof.votes.no}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">
          {new Date(proof.createdAt).toLocaleDateString('ko-KR')}
        </Text>
      </View>

      {/* Vote buttons */}
      <View className="flex-row space-x-3">
        <TouchableOpacity
          className="flex-1 bg-green-100 py-3 rounded-xl flex-row items-center justify-center"
          onPress={handleVoteYes}
        >
          <Ionicons name="checkmark" size={20} color="#059669" />
          <Text className="text-green-700 font-semibold ml-2">인정</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          className="flex-1 bg-red-100 py-3 rounded-xl flex-row items-center justify-center"
          onPress={handleVoteNo}
        >
          <Ionicons name="close" size={20} color="#DC2626" />
          <Text className="text-red-700 font-semibold ml-2">부정</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function SwipeScreen() {
  const { user } = useAuth();
  
  // Use new swipe API
  const { 
    data: swipeProofs, 
    isLoading: loading, 
    error, 
    refetch 
  } = useSwipeProofs({ page: 1, pageSize: 10 });
  
  const { vote, isLoading: voting } = useVoteMutation();
  const [refreshing, setRefreshing] = useState(false);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Handle voting
  const handleVote = useCallback(async (proofId: string, voteValue: 'yes' | 'no') => {
    try {
      await vote({
        proofId,
        body: {
          vote: voteValue,
          serveId: `serve-${Date.now()}`,
        },
      });
      // Refresh after voting
      await refetch();
    } catch (error) {
      console.error('[SWIPE:vote:error]', error);
    }
  }, [vote, refetch]);

  // Render item for FlatList
  const renderItem = useCallback(({ item }: { item: SwipeProofItem }) => (
    <SwipeCard proof={item} onVote={handleVote} />
  ), [handleVote]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: SwipeProofItem) => item.proofId, []);

  if (loading) {
    return (
      <BaseScreen title="Swipe">
        <LoadingState />
      </BaseScreen>
    );
  }

  if (error) {
    return (
      <BaseScreen title="Swipe">
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text className="text-lg font-semibold text-gray-900 mt-4 mb-2">
            오류가 발생했습니다
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            스와이프 데이터를 불러올 수 없습니다.
            {'\n'}잠시 후 다시 시도해보세요.
          </Text>
          <TouchableOpacity
            className="bg-blue-600 px-6 py-3 rounded-lg"
            onPress={() => refetch()}
          >
            <Text className="text-white font-semibold">다시 시도</Text>
          </TouchableOpacity>
        </View>
      </BaseScreen>
    );
  }

  if (!swipeProofs || swipeProofs.length === 0) {
    return (
      <BaseScreen title="Swipe">
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons name="images-outline" size={64} color="#9CA3AF" />
          <Text className="text-lg font-semibold text-gray-900 mt-4 mb-2">
            스와이프할 사진이 없습니다
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            다른 사용자들이 목표 달성을 인증한 사진이 없습니다.
            {'\n'}잠시 후 다시 시도해보세요.
          </Text>
          <TouchableOpacity
            className="bg-blue-600 px-6 py-3 rounded-lg"
            onPress={() => refetch()}
          >
            <Text className="text-white font-semibold">새로고침</Text>
          </TouchableOpacity>
        </View>
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title="Swipe">
      <View className="flex-1 px-4">
        <Text className="text-lg font-bold text-gray-900 mb-4 mt-2">
          다른 사용자들의 목표 달성 인증
        </Text>
        
        <FlatList
          data={swipeProofs}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </BaseScreen>
  );
}