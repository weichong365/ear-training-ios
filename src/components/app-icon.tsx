import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { Brand } from '@/constants/theme';

export type AppIconName = keyof typeof ICONS;

const ICONS = {
  info: ['info.circle', 'info'],
  single: ['music.note', 'music_note'],
  interval: ['waveform.path', 'graphic_eq'],
  chord: ['pianokeys', 'piano'],
  melody: ['music.note.list', 'library_music'],
  rhythm: ['music.quarternote.3', 'music_note'],
  exam: ['doc.text', 'quiz'],
  adaptive: ['target', 'target'],
  wrongbook: ['checklist', 'fact_check'],
  stats: ['chart.bar', 'analytics'],
  chevronLeft: ['chevron.left', 'chevron_left'],
  chevronRight: ['chevron.right', 'chevron_right'],
  chevronUp: ['chevron.up', 'keyboard_arrow_up'],
  chevronDown: ['chevron.down', 'keyboard_arrow_down'],
  check: ['checkmark.circle.fill', 'check_circle'],
  play: ['play.fill', 'play_arrow'],
  pause: ['pause.fill', 'pause'],
  lock: ['lock.fill', 'lock'],
  trophy: ['trophy.fill', 'trophy'],
  replay: ['arrow.counterclockwise', 'refresh'],
  delete: ['trash', 'delete'],
  plus: ['plus', 'add'],
  minus: ['minus', 'remove'],
  more: ['ellipsis', 'more_horiz'],
  message: ['bubble.left.and.bubble.right.fill', 'forum'],
} as const satisfies Record<string, readonly [SFSymbol, AndroidSymbol]>;

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function AppIcon({ name, size = 22, color = Brand.forest, style }: AppIconProps) {
  const [ios, material] = ICONS[name];
  return (
    <SymbolView
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={{ ios, android: material, web: material }}
      size={size}
      tintColor={color}
      weight="semibold"
      style={[{ width: size, height: size }, style]}
    />
  );
}
