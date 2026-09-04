import { Image } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

/**
 * 手绘图标组件：复刻小程序 app-icon 的纯 CSS 手绘图标。
 * viewBox 48×48，与小程序 size-md（48rpx）一一对应；颜色由 color 传入。
 */
export type HandIconName =
  | 'single-note'
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

export function HandIcon({ name, size = 48, color = '#2e8b57' }: HandIconProps) {
  if (name === 'treble') {
    // 高音谱号复用小程序同款参考图（透明 PNG），保持视觉完全一致
    return (
      <Image
        source={require('../../assets/images/melody-clef-reference.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {name === 'single-note' && (
        <G transform="rotate(-2 24 24)">
          <Ellipse cx={20} cy={37} rx={8.5} ry={5.6} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-14 20 37)" />
          <Line x1={28} y1={20} x2={28} y2={37} stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </G>
      )}
      {name === 'interval' && (
        <G transform="rotate(2 24 24)">
          <Ellipse cx={12} cy={37} rx={5.8} ry={4.4} fill={color} transform="rotate(-14 12 37)" />
          <Line x1={17} y1={18} x2={17} y2={37} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Ellipse cx={37} cy={29} rx={5.8} ry={4.4} fill={color} transform="rotate(-14 37 29)" />
          <Line x1={42} y1={10} x2={42} y2={29} stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </G>
      )}
      {name === 'chord' && (
        <G>
          <Ellipse cx={19} cy={42} rx={8} ry={5} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-14 19 42)" />
          <Ellipse cx={19} cy={33} rx={8} ry={5} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-14 19 33)" />
          <Ellipse cx={19} cy={24} rx={8} ry={5} stroke={color} strokeWidth={SW} fill="none" transform="rotate(-14 19 24)" />
          <Line x1={26.5} y1={12} x2={26.5} y2={42} stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </G>
      )}
      {name === 'rhythm' && (
        <G transform="rotate(-1 24 24)">
          <Line x1={8} y1={8} x2={18} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={18} y1={8} x2={8} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={30} y1={8} x2={40} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={40} y1={8} x2={30} y2={22} stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Line x1={5} y1={40} x2={43} y2={40} stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </G>
      )}
      {name === 'mixed' && (
        <G transform="rotate(-3 24 24)">
          <Rect x={14} y={6} width={20} height={34} rx={2.5} stroke={color} strokeWidth={SW} fill="none" />
          <Path d="M34 6 L34 12 L28 12" stroke={color} strokeWidth={SW} fill="none" strokeLinejoin="round" />
          <Line x1={19} y1={22} x2={29} y2={22} stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
          <Line x1={19} y1={29} x2={29} y2={29} stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
          <Ellipse cx={21} cy={17.5} rx={1.6} ry={1.6} fill={color} transform="rotate(-12 21 17.5)" />
          <Ellipse cx={27} cy={24.5} rx={1.6} ry={1.6} fill={color} transform="rotate(-12 27 24.5)" />
        </G>
      )}
      {name === 'target' && (
        <G>
          <Circle cx={24} cy={24} r={18} stroke={color} strokeWidth={SW} fill="none" />
          <Circle cx={24} cy={24} r={11} stroke={color} strokeWidth={SW} fill="none" />
          <Circle cx={24} cy={24} r={5} stroke={color} strokeWidth={SW} fill="none" />
          <Circle cx={24} cy={24} r={2.3} fill={color} />
          <Line x1={10} y1={24} x2={38} y2={24} stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.48} />
          <Line x1={24} y1={10} x2={24} y2={38} stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.48} />
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
