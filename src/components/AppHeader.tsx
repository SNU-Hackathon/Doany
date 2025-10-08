import React from 'react';
import { Text, View } from 'react-native';

export default function AppHeader({ title }: { title: string }) {
  return (
    <View className="w-full bg-[#2563eb] h-14 justify-center items-center"> 
      {/* h-14 ~ 56px: thinner than before; adjust if needed */}
      <Text className="text-white text-lg font-semibold">{title}</Text>
    </View>
  );
}
