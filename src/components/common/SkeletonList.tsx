// Skeleton loading component for displaying loading states
// Shows placeholder cards while data is being fetched

import React from 'react';
import { ScrollView, View } from 'react-native';

interface SkeletonListProps {
  count?: number;
  type?: 'feed' | 'comment';
}

export default function SkeletonList({ count = 3, type = 'feed' }: SkeletonListProps) {
  if (type === 'comment') {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        {Array.from({ length: count }).map((_, index) => (
          <CommentSkeleton key={index} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
      {Array.from({ length: count }).map((_, index) => (
        <FeedCardSkeleton key={index} />
      ))}
    </ScrollView>
  );
}

function FeedCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        margin: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#E5E7EB',
          }}
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <View
            style={{
              width: '40%',
              height: 16,
              backgroundColor: '#E5E7EB',
              borderRadius: 4,
              marginBottom: 6,
            }}
          />
          <View
            style={{
              width: '60%',
              height: 12,
              backgroundColor: '#E5E7EB',
              borderRadius: 4,
            }}
          />
        </View>
      </View>

      {/* Title */}
      <View
        style={{
          width: '80%',
          height: 20,
          backgroundColor: '#E5E7EB',
          borderRadius: 4,
          marginBottom: 8,
        }}
      />

      {/* Caption */}
      <View
        style={{
          width: '100%',
          height: 16,
          backgroundColor: '#E5E7EB',
          borderRadius: 4,
          marginBottom: 4,
        }}
      />
      <View
        style={{
          width: '90%',
          height: 16,
          backgroundColor: '#E5E7EB',
          borderRadius: 4,
          marginBottom: 12,
        }}
      />

      {/* Media */}
      <View
        style={{
          width: '100%',
          height: 200,
          backgroundColor: '#E5E7EB',
          borderRadius: 12,
          marginBottom: 12,
        }}
      />

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              width: 60,
              height: 32,
              backgroundColor: '#E5E7EB',
              borderRadius: 8,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function CommentSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#E5E7EB',
        }}
      />
      <View style={{ flex: 1 }}>
        <View
          style={{
            width: '30%',
            height: 14,
            backgroundColor: '#E5E7EB',
            borderRadius: 4,
            marginBottom: 6,
          }}
        />
        <View
          style={{
            width: '100%',
            height: 16,
            backgroundColor: '#E5E7EB',
            borderRadius: 4,
            marginBottom: 4,
          }}
        />
        <View
          style={{
            width: '80%',
            height: 16,
            backgroundColor: '#E5E7EB',
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}

