/**
 * App colors: Yellow, Blue, White theme
 */

import { Platform } from 'react-native';

// Color palette: Yellow, Blue, White
const primaryBlue = '#007AFF'; // Bright blue
const primaryYellow = '#FFD700'; // Gold yellow
const white = '#FFFFFF';
const textColor = '#000000';

export const Colors = {
  text: textColor,
  background: white,
  tint: primaryBlue,
  icon: primaryBlue,
  tabIconDefault: '#999999',
  tabIconSelected: primaryBlue,
  primary: primaryBlue,
  secondary: primaryYellow,
  white: white,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
