/**
 * Simplified theme color hook - always returns light theme colors
 */

import { Colors } from '@/constants/theme';

export function useThemeColor(
  props: { color?: string },
  colorName: keyof typeof Colors
) {
  const colorFromProps = props.color;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[colorName];
  }
}
