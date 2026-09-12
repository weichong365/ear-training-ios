/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#18201E',
    background: '#F7F7F1',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7F2EE',
    textSecondary: '#75827E',
  },
  dark: {
    text: '#18201E',
    background: '#F7F7F1',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7F2EE',
    textSecondary: '#75827E',
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
  forest: '#1F6F5B',
  forestDeep: '#173D36',
  forestSoft: '#E7F2EE',
  cream: '#F7F7F1',
  ivory: '#FFFFFF',
  ink: '#18201E',
  muted: '#75827E',
  gold: '#F18A62',
  border: '#DEE6E2',
  divider: '#ECF1EE',
  success: '#2E8B6F',
  successSoft: '#E2F2EC',
  warning: '#D79A45',
  warningSoft: '#F7EEDC',
  danger: '#C65D54',
  dangerSoft: '#F8E6E3',
  disabled: '#A7B0AD',
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

export const Shadows = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: Brand.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 7 },
    android: { elevation: 1 },
    web: { boxShadow: '0 3px 7px rgba(20,34,26,0.07)' },
    default: {},
  }) || {},
  raised: Platform.select<ViewStyle>({
    ios: { shadowColor: Brand.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
    android: { elevation: 3 },
    web: { boxShadow: '0 4px 8px rgba(20,34,26,0.12)' },
    default: {},
  }) || {},
  floating: Platform.select<ViewStyle>({
    ios: { shadowColor: Brand.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 7 },
    android: { elevation: 5 },
    web: { boxShadow: '0 3px 7px rgba(20,34,26,0.12)' },
    default: {},
  }) || {},
} as const;
