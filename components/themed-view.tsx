import { View, type ViewProps } from 'react-native';

import { Colors } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  backgroundColor?: string;
};

export function ThemedView({ style, backgroundColor, ...otherProps }: ThemedViewProps) {
  const bgColor = backgroundColor || Colors.background;

  return <View style={[{ backgroundColor: bgColor }, style]} {...otherProps} />;
}
