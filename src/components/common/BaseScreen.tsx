import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface BaseScreenProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightAction?: {
    icon: string;
    onPress: () => void;
    color?: string;
  };
  backgroundColor?: string;
  scrollable?: boolean;
  keyboardAvoidingView?: boolean;
  contentPadding?: boolean;
  headerPadding?: boolean;
}

export default function BaseScreen({
  children,
  title,
  showBackButton = false,
  onBackPress,
  rightAction,
  backgroundColor = '#FFFFFF',
  scrollable = true,
  keyboardAvoidingView = false,
  contentPadding = true,
  headerPadding = true,
}: BaseScreenProps) {
  const Header = () => (
    <View className={`px-4 ${headerPadding ? 'pt-14 pb-4' : 'pt-4 pb-2'}`}>
      <View className="flex-row items-center justify-between">
        {/* Left side - Back button or empty space */}
        <View className="w-8">
          {showBackButton && (
            <TouchableOpacity
              onPress={onBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Title */}
        {title && (
          <Text className="text-2xl font-bold text-gray-900 flex-1 text-center">
            {title}
          </Text>
        )}

        {/* Right side - Action button or empty space */}
        <View className="w-8 items-end">
          {rightAction && (
            <TouchableOpacity onPress={rightAction.onPress}>
              <Ionicons
                name={rightAction.icon as any}
                size={28}
                color={rightAction.color || '#3B82F6'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const Content = () => {
    if (scrollable) {
      return (
        <ScrollView
          className={`flex-1 ${contentPadding ? 'px-4' : ''}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {children}
        </ScrollView>
      );
    }

    return (
      <View className={`flex-1 ${contentPadding ? 'px-4' : ''}`}>
        {children}
      </View>
    );
  };

  const ScreenContent = () => (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <Header />
      <Content />
    </SafeAreaView>
  );

  if (keyboardAvoidingView) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScreenContent />
      </KeyboardAvoidingView>
    );
  }

  return <ScreenContent />;
}
