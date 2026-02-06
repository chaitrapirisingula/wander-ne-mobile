/**
 * App colors: Wander Nebraska theme (muted golden yellow, dark navy blue)
 */

import { Platform } from "react-native";

// Wander Nebraska brand colors from logo
const wanderYellow = "#E5C76B"; // Muted golden yellow (state fill)
const wanderNavy = "#0047AB"; // Blue (path/arrows)
const white = "#FFFFFF";
const textColor = "#000000";

export const Colors = {
  text: textColor,
  background: white,
  tint: wanderNavy,
  icon: wanderNavy,
  tabIconDefault: "rgba(255,255,255,0.6)",
  tabIconSelected: wanderYellow,
  primary: wanderNavy,
  secondary: wanderYellow,
  header: wanderYellow,
  footer: wanderNavy,
  white: white,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
