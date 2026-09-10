import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

/**
 * 手绘图标组件：复刻小程序 app-icon 的纯 CSS 手绘图标。
 * viewBox 48×48，与小程序 size-md（48rpx）一一对应；颜色由 color 传入。
 */
export type HandIconName =
  | 'single-note'
  | 'triplet'
  | 'interval'
  | 'chord'
  | 'rhythm'
  | 'treble'
  | 'mixed'
  | 'target'
  | 'book'
  | 'stats'
  | 'info';

type HandIconProps = {
  name: HandIconName;
  size?: number;
  color?: string;
};

const SW = 1.7; // 描边宽度（对应 CSS 2.5~3rpx 的手绘笔触）

export function HandIcon({ name, size = 48, color = '#2e8b6f' }: HandIconProps) {
  if (name === 'treble') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <G fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M27 43c-7 0-10-5-8-10 2-5 10-6 14-2 4 4 1 11-5 11-7 0-11-8-8-16 3-10 13-15 12-21-1-4-5-2-6 2-2 7 4 14 7 21" />
          <Line x1="27" y1="13" x2="27" y2="43" />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {name === 'single-note' && (
        <G transform="rotate(-2 24 24)">
          <Ellipse cx={20} cy={36} rx={8} ry={5} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-14 20 36)" />
          <Line x1={27.5} y1={12} x2={27.5} y2={36} stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </G>
      )}
      {name === 'triplet' && (
        <G fill={color} stroke={color} strokeWidth={SW} strokeLinecap="round">
          <Ellipse cx={11.5} cy={35} rx={4.5} ry={3.6} transform="rotate(-14 11.5 35)" />
          <Line x1={15} y1={16} x2={15} y2={35} />
          <Ellipse cx={24} cy={29} rx={5} ry={3.6} transform="rotate(-14 24 29)" />
          <Line x1={28.5} y1={10} x2={28.5} y2={29} />
          <Ellipse cx={36.5} cy={35} rx={4.5} ry={3.6} transform="rotate(-14 36.5 35)" />
          <Line x1={40.5} y1={16} x2={40.5} y2={35} />
        </G>
      )}
      {name === 'interval' && (
        <G>
          <Ellipse cx={12} cy={37} rx={5.8} ry={4.4} fill={color} transform="rotate(-14 12 37)" />
          <Line x1={17} y1={17} x2={17} y2={37} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Ellipse cx={36} cy={29} rx={5.8} ry={4.4} fill={color} transform="rotate(-14 36 29)" />
          <Line x1={41} y1={9} x2={41} y2={29} stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </G>
      )}
      {name === 'chord' && (
        <G>
          <Ellipse cx={24} cy={15} rx={8} ry={5} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-8 24 15)" />
          <Ellipse cx={24} cy={24} rx={8} ry={5} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-8 24 24)" />
          <Ellipse cx={24} cy={33} rx={8} ry={5} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-8 24 33)" />
        </G>
      )}
      {name === 'rhythm' && (
        <G transform="rotate(-1 24 24)">
          <Line x1={8} y1={8} x2={18} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={18} y1={8} x2={8} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={30} y1={8} x2={40} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={40} y1={8} x2={30} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={8} y1={40} x2={40} y2={40} stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </G>
      )}
      {name === 'mixed' && (
        <G>
          <Rect x={14} y={7} width={20} height={34} rx={2.5} stroke={color} strokeWidth={SW} fill="none" />
          <Path d="M34 7 L34 13 L28 13" stroke={color} strokeWidth={SW} fill="none" strokeLinejoin="round" />
          <Line x1={19} y1={22} x2={29} y2={22} stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
          <Line x1={19} y1={29} x2={29} y2={29} stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
          <Ellipse cx={21} cy={17.5} rx={1.6} ry={1.6} fill={color} transform="rotate(-12 21 17.5)" />
          <Ellipse cx={27} cy={24.5} rx={1.6} ry={1.6} fill={color} transform="rotate(-12 27 24.5)" />
        </G>
      )}
      {name === 'target' && (
        <G>
          <Circle cx={24} cy={24} r={17} stroke={color} strokeWidth={SW} fill="none" />
          <Circle cx={24} cy={24} r={11} stroke={color} strokeWidth={SW} fill="none" />
          <Circle cx={24} cy={24} r={5} stroke={color} strokeWidth={SW} fill="none" />
          <Line x1={21} y1={24} x2={27} y2={24} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <Line x1={24} y1={21} x2={24} y2={27} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        </G>
      )}
      {name === 'book' && (
        <G transform="rotate(-3 24 24)">
          <Rect x={12} y={8} width={24} height={32} rx={3} stroke={color} strokeWidth={SW} fill="none" />
          <Line x1={18} y1={19} x2={30} y2={19} stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.58} />
          <Line x1={18} y1={27} x2={30} y2={27} stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.58} />
          <Path d="M11 16 a4 4 0 0 1 0 -8" stroke={color} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <Path d="M11 26 a4 4 0 0 1 0 -8" stroke={color} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <Path d="M11 36 a4 4 0 0 1 0 -8" stroke={color} strokeWidth={SW} fill="none" strokeLinecap="round" />
        </G>
      )}
      {name === 'stats' && (
        <G>
          <Path d="M12 40 L12 8 M12 40 L38 40" stroke={color} strokeWidth={SW} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x={17} y={28} width={6} height={12} rx={2} fill={color} opacity={0.52} transform="rotate(-1 20 34)" />
          <Rect x={26} y={21} width={6} height={19} rx={2} fill={color} opacity={0.75} transform="rotate(-1 29 30)" />
          <Rect x={35} y={13} width={6} height={27} rx={2} fill={color} transform="rotate(-1 38 26)" />
        </G>
      )}
      {name === 'info' && (
        <G>
          <Circle cx={24} cy={24} r={18} stroke={color} strokeWidth={SW} fill="none" />
          <Circle cx={24} cy={15} r={2.4} fill={color} />
          <Line x1={24} y1={21} x2={24} y2={34} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      )}
    </Svg>
  );
}
