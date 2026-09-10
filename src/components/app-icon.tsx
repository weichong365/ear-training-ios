import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { Brand } from '@/constants/theme';

type NavigationIconName = 'headphones' | 'wrongbook' | 'profile' | 'hand';

export type AppIconName = keyof typeof ICONS | NavigationIconName;

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

const NAV_VIEW_BOX = 48;
const NAV_STROKE_WIDTH = 2.6;

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function AppIcon({ name, size = 22, color = Brand.forest, style }: AppIconProps) {
  if (name === 'headphones' || name === 'wrongbook' || name === 'profile' || name === 'hand') {
    return (
      <Svg
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        width={size}
        height={size}
        viewBox={`0 0 ${NAV_VIEW_BOX} ${NAV_VIEW_BOX}`}
        style={[{ width: size, height: size }, style]}>
        <G fill="none" stroke={color} strokeWidth={NAV_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
          {name === 'headphones' && (
            <>
              <Path d="M10 27v-3a14 14 0 0 1 28 0v3" />
              <Rect x={8} y={25} width={8} height={16} rx={3} fill={color} stroke="none" />
              <Rect x={32} y={25} width={8} height={16} rx={3} fill={color} stroke="none" />
            </>
          )}
          {name === 'wrongbook' && (
            <>
              <Rect x={8} y={10} width={32} height={28} rx={4} />
              <Line x1={24} y1={14} x2={24} y2={34} />
            </>
          )}
          {name === 'profile' && (
            <>
              <Circle cx={19} cy={15} r={7} />
              <Path d="M8 39c1-11 5-18 12-18 6 0 10 2 16 7" />
              <Line x1={34} y1={33} x2={41} y2={33} />
              <Line x1={34} y1={39} x2={41} y2={39} />
            </>
          )}
          {name === 'hand' && (
            <>
              <Circle cx={28.7} cy={15.2} r={6.5} />
              <Path d="M17.8 38.8 17.1 29.6C14.6 27 11.8 23.9 10.1 20.9 8.7 18.4 7.8 15.3 8.7 12.7c.4-1.2 1.3-1.9 2.2-1.8 1.3.1 1.7 1.5 2.3 2.9 1.7 3.9 4.3 6.8 7.5 8.8 2.2 1.4 4.6 2.1 7.2 2.1h5.5c2.9 0 5 2.1 4.9 5L37.6 38.8" />
            </>
          )}
        </G>
      </Svg>
    );
  }

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
