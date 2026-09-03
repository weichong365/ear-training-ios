/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1B1B1B',
    background: '#F4EAD5',
    backgroundElement: '#FFFAF0',
    backgroundSelected: '#DCEFE3',
    textSecondary: '#69766E',
  },
  dark: {
    text: '#1B1B1B',
    background: '#F4EAD5',
    backgroundElement: '#FFFAF0',
    backgroundSelected: '#DCEFE3',
    textSecondary: '#69766E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Brand = {
  forest: '#1D6B4D',
  forestDeep: '#103C2B',
  forestSoft: '#DCEDE3',
  cream: '#F6F0E3',
  ivory: '#FFFDF7',
  ink: '#1B211D',
  muted: '#5F6F65',
  gold: '#B78922',
  border: '#D4DED7',
  divider: '#E4E9E4',
  success: '#237A57',
  successSoft: '#E2F1E8',
  warning: '#8A671E',
  warningSoft: '#FBF0CF',
  danger: '#B84F4A',
  dangerSoft: '#F8E7E3',
  disabled: '#A8B6AD',
  textOnAccent: '#FFFFFF',
  textOnAccentMuted: 'rgba(255,255,255,.74)',
  overlay: 'rgba(16,30,22,.68)',
  shadow: '#14221A',
} as const;

export const TypeScale = {
  caption: 12,
  footnote: 13,
  subheadline: 15,
  body: 17,
  headline: 17,
  title3: 20,
  title2: 22,
  title1: 28,
} as const;

export const Radius = {
  control: 12,
  card: 16,
  hero: 20,
} as const;

export const TouchTarget = 44;
