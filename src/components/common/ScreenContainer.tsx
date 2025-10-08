import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  View,
} from 'react-native';

interface ScreenContainerProps {
  children: React.ReactNode;
  backgroundColor?: string;
  scrollable?: boolean;
  keyboardAvoidingView?: boolean;
  keyboardVerticalOffset?: number;
  contentPadding?: boolean;
  paddingHorizontal?: number;
  paddingVertical?: number;
  showsVerticalScrollIndicator?: boolean;
  contentContainerStyle?: any;
}

export default function ScreenContainer({
  children,
  backgroundColor = '#FFFFFF',
  scrollable = true,
  keyboardAvoidingView = false,
  keyboardVerticalOffset,
  contentPadding = true,
  paddingHorizontal = 16,
  paddingVertical = 0,
  showsVerticalScrollIndicator = false,
  contentContainerStyle,
}: ScreenContainerProps) {
  const defaultKeyboardOffset = Platform.OS === 'ios' ? 90 : 0;
  const offset = keyboardVerticalOffset ?? defaultKeyboardOffset;

  const Content = () => {
    if (scrollable) {
      return (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            contentPadding && {
              paddingHorizontal,
              paddingVertical,
            },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        >
          {children}
        </ScrollView>
      );
    }

    return (
      <View
        style={[
          { flex: 1 },
          contentPadding && {
            paddingHorizontal,
            paddingVertical,
          },
        ]}
      >
        {children}
      </View>
    );
  };

  const ScreenContent = () => (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <Content />
    </SafeAreaView>
  );

  if (keyboardAvoidingView) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={offset}
      >
        <ScreenContent />
      </KeyboardAvoidingView>
    );
  }

  return <ScreenContent />;
}
