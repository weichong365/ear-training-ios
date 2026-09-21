import { Path, Text as SvgText } from 'react-native-svg';

import { MUSIC_GLYPH_PATHS } from '@/core/music-glyph-paths';
import type { NoteheadKind, RestKind, StemDirection } from '@/core/music-notation';
import {
  LEDGER_WIDTH,
  STAFF_LINE_GAP,
  STAFF_LINE_TOP,
  TUPLET_BASELINE_RATIO,
  TUPLET_FONT_SIZE,
  type GlyphBox,
  type GlyphName,
  accidentalBox,
  dotBox,
  flagBox,
  glyphSize,
  noteheadBox,
  noteheadHalfWidth as noteheadHalfWidthOf,
  restBox,
  restWidth,
} from '@/core/staff-layout';

/**
 * 谱面字形渲染 —— 全部使用 Bravura（SMuFL）轮廓，摆放公式来自 @/core/staff-layout，
 * 与小程序的 <image src="/assets/smufl/*.svg" mode="scaleToFill" style="left/top/width/height">
 * 逐值等价。颜色由 App 侧直接上色（小程序需要 smufl-red / smufl-green 三套素材）。
 *
 * ⚠️ 坐标一律 **rpx**（1rpx = 0.5pt）。调用方的 viewBox 必须是 rpx，见 @/core/staff-coordinate。
 */

export function MusicGlyph({ name, box, color }: { name: GlyphName; box: GlyphBox; color: string }) {
  return (
    <Path
      d={MUSIC_GLYPH_PATHS[name]}
      fill={color}
      transform={`translate(${box.left} ${box.top}) scale(${box.width / glyphSize(name).width})`}
    />
  );
}

/**
 * 符头：`x` 是**音符中心**（等价小程序 headInfos 的 center）。
 * 小程序内部传的是黑符头列左缘，两者算出的 bbox 左缘逐值相同 —— 见 noteheadBox 注释。
 */
export function MusicNotehead({ x, y, kind, color }: { x: number; y: number; kind: NoteheadKind; color: string }) {
  const box = noteheadBox(kind, x, y, STAFF_LINE_GAP);
  return <MusicGlyph name={box.name} box={box} color={color} />;
}

export function noteheadHalfWidth(kind: NoteheadKind) {
  return noteheadHalfWidthOf(kind, STAFF_LINE_GAP);
}

export function noteheadWidth(kind: NoteheadKind) {
  return noteheadHalfWidthOf(kind, STAFF_LINE_GAP) * 2;
}

/** 休止符：`x` 是**音符中心**（内部按黑符头列宽折算成左缘，与小程序一致）。 */
export function MusicRest({ x, kind, color }: { x: number; kind: RestKind; color: string }) {
  const box = restBox(kind, x - noteheadWidth('black') / 2, STAFF_LINE_TOP, STAFF_LINE_GAP, noteheadWidth('black'));
  return <MusicGlyph name={box.name} box={box} color={color} />;
}

/** 休止符字形宽（rpx），休止符附点要用它算右缘。 */
export function musicRestWidth(kind: RestKind) {
  return restWidth(kind, STAFF_LINE_GAP);
}

/** 附点：小程序 dotGlyph(noteRight + lineGap*0.25, dotCenterY)。 */
export function MusicDot({ noteRightX, centerY, color }: { noteRightX: number; centerY: number; color: string }) {
  const box = dotBox(noteRightX + STAFF_LINE_GAP * 0.25, centerY, STAFF_LINE_GAP);
  return <MusicGlyph name={box.name} box={box} color={color} />;
}

/**
 * 临时记号：`rightEdgeX` 是**右缘锚点**（小程序 accidentalSymbol(acc, rightEdge)）。
 * 调用方传「符头 bbox 左缘 − accidentalGap」。
 */
export function MusicAccidental({ acc, rightEdgeX, centerY, color }: { acc: string; rightEdgeX: number; centerY: number; color: string }) {
  const box = accidentalBox(acc, rightEdgeX, centerY, STAFF_LINE_GAP);
  return box ? <MusicGlyph name={box.name} box={box} color={color} /> : null;
}

/** 独立符尾：锚点为符干末端（小程序 flagGlyph）。 */
export function MusicFlag({ stemX, stemEndY, beamCount, direction, color }: { stemX: number; stemEndY: number; beamCount: number; direction: StemDirection; color: string }) {
  const box = flagBox(beamCount, direction === 'up', stemX, stemEndY, STAFF_LINE_GAP);
  return <MusicGlyph name={box.name} box={box} color={color} />;
}

/**
 * 三连音「3」：小程序 `.tuplet-number`（width 18rpx / margin-left −9rpx /
 * font-size·line-height 18rpx / text-align center）在 `top` 处铺一个文本框；
 * SVG <Text y> 是基线，用 0.85em 近似 Georgia 斜体数字在 18rpx 行高内的基线位置。
 */
export function MusicTuplet({ x, top, color }: { x: number; top: number; color: string }) {
  return (
    <SvgText
      x={x}
      y={top + TUPLET_FONT_SIZE * TUPLET_BASELINE_RATIO}
      fontSize={TUPLET_FONT_SIZE}
      fontStyle="italic"
      fontWeight="700"
      fontFamily="Georgia"
      textAnchor="middle"
      fill={color}>
      3
    </SvgText>
  );
}

/** 加线横向范围：宽 31.2rpx（.staff-compact .ledger），以符头中心对称。 */
export function musicLedgerBounds(noteX: number) {
  return { x1: noteX - LEDGER_WIDTH / 2, x2: noteX + LEDGER_WIDTH / 2 };
}
