import React from 'react';
import { View, ViewProps } from 'react-native';

export const NativeChild = React.forwardRef<View, ViewProps>(
  ({ children, ...rest }, ref) => (
    <View ref={ref} {...rest}>{children}</View>
  )
);
NativeChild.displayName = 'NativeChild';