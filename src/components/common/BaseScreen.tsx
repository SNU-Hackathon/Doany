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
    <View 
      style={{
        paddingHorizontal: 20,
        paddingTop: headerPadding ? 10 : 4,
        paddingBottom: headerPadding ? 15 : 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left side - Back button or empty space */}
        <View style={{ width: 32 }}>
          {showBackButton && (
            <TouchableOpacity
              onPress={onBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Title */}
        {title && (
          <Text style={{ 
            fontSize: 24, 
            fontWeight: 'bold', 
            color: '#1F2937',
            flex: 1,
            textAlign: 'center'
          }}>
            {title}
          </Text>
        )}

        {/* Right side - Action button or empty space */}
        <View style={{ width: 32, alignItems: 'flex-end' }}>
          {rightAction && (
            <TouchableOpacity 
              onPress={rightAction.onPress}
              style={{ padding: 6, position: 'relative' }}
            >
              <Ionicons
                name={rightAction.icon as any}
                size={24}
                color={rightAction.color || '#1F2937'}
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
