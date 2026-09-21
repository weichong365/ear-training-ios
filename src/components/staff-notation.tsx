import { memo } from 'react';
import Svg, { G, Line, Path } from 'react-native-svg';

import { MusicAccidental, MusicDot, MusicFlag, MusicGlyph, MusicNotehead, MusicRest, MusicTuplet } from '@/components/music-glyphs';
import { Brand } from '@/constants/theme';
import { buildStaffGeometry, type StaffGeometryOptions } from '@/core/staff-notation-geometry';
import { STAFF_LINE_YS, STAFF_STROKE_WIDTH } from '@/core/music-notation';
import {
  ACCIDENTAL_GAP,
  BEAM_THICKNESS,
  DEFAULT_STAFF_WIDTH_RPX,
  ENDLINE_THICK,
  ENDLINE_THIN,
  ENDLINE_WIDTH,
  LEDGER_WIDTH,
  STAFF_HEIGHT_RPX,
  TIE_STROKE_WIDTH,
  barlineHeight,
  barlineTop,
  headerSymbols,
  type StaffEvent,
} from '@/core/staff-layout';

/**
 * 五线谱绘制 —— `components/staff-notation` 的 1:1 移植（紧凑谱 140rpx）。
 *
 * 这是 App 端**唯一**的谱面绘制出口：答题谱、听记谱面编辑器、谱例预览全部走这里，
 * 几何来自 @/core/staff-notation-geometry（同一份纯函数也供冒烟脚本直接断言）。
 *
 * 所有坐标都是 rpx（1rpx = 0.5pt）：调用方的 viewBox 宽必须是「实测容器宽 pt ÷ 0.5」、
 * 高 140，画布高 70pt ⇒ 1 单位 = 0.5pt，与小程序「绝对 rpx 定位 + 容器 100% 宽」逐像素一致。
 * 颜色仍用 App 自己的品牌色（两端色板本就不同，2026-09-15 令牌对账时已确认保留）。
 */

export type StaffNotationProps = StaffGeometryOptions & {
  events: StaffEvent[];
  /** 实测容器宽（rpx）= 渲染 pt 宽 ÷ 0.5，决定 viewBox 宽度与谱线/小节线长度 */
  viewBoxWidth: number;
  tone?: 'red' | 'green' | '';
  ink?: boolean;
  /** 小程序 symbols-only：只画音符层（叠在已画好的谱面上） */
  symbolsOnly?: boolean;
  /** 小程序 answer-staff 的 last：右缘收双小节线（细 2rpx / 粗 4rpx / 总宽 12rpx） */
  last?: boolean;
  /** 小程序 .answer-correct-overlay-separated 的 translateX(80rpx) */
  offsetX?: number;
  /**
   * 小程序 `.answer-slot` 的分隔虚线 x 坐标（rpx，整壳高）。
   * 放在共享 SVG 根里画，避免调用方再套一层 <Svg>。
   */
  slotDividers?: number[];
};

/** 调性 → 音符/符干/符杠色（小程序 tone 三套素材 → App 直接上色） */
function toneColor(tone: string | undefined, ink: boolean) {
  if (tone === 'green') return Brand.success;
  if (tone === 'red') return Brand.danger;
  return ink ? '#141414' : Brand.ink;
}

export const StaffNotation = memo(function StaffNotation({
  events,
  viewBoxWidth,
  width = DEFAULT_STAFF_WIDTH_RPX,
  meter = '',
  beamMeter = '',
  keySignature = '',
  barCount = 0,
  answerSlots = 0,
  tone = '',
  ink = false,
  symbolsOnly = false,
  last = false,
  offsetX = 0,
  slotDividers = [],
}: StaffNotationProps) {
  const geometry = buildStaffGeometry(events, { width, meter, beamMeter, keySignature, barCount, answerSlots });
  const header = headerSymbols(keySignature, meter);
  const lineColor = ink ? '#141414' : '#596169';
  const color = toneColor(tone, ink);
  const barTop = barlineTop();
  const barBottom = barTop + barlineHeight();

  const content = (
    <>
      {!symbolsOnly && (
        <>
          <MusicGlyph name={header.clefGlyph.name} box={header.clefGlyph} color={lineColor} />
          {!!header.keyGlyph && <MusicGlyph name={header.keyGlyph.name} box={header.keyGlyph} color={lineColor} />}
          {header.meterGlyphs.map((glyph) => (
            <MusicGlyph key={glyph.key} name={glyph.name} box={glyph} color={lineColor} />
          ))}
          {STAFF_LINE_YS.map((y) => (
            <Line key={`line-${y}`} x1={0} x2={viewBoxWidth} y1={y} y2={y} stroke={lineColor} strokeWidth={STAFF_STROKE_WIDTH} />
          ))}
          {geometry.bars.map((x) => (
            <Line key={`bar-${x}`} x1={x} x2={x} y1={barTop} y2={barBottom} stroke={lineColor} strokeWidth={STAFF_STROKE_WIDTH} />
          ))}
        </>
      )}

      {geometry.heads.map((head) => (
        <G key={head.key}>
          {head.ledgerYs.map((ledgerY) => (
            <Line key={`lg-${head.key}-${ledgerY}`} x1={head.ledgerX} x2={head.ledgerX + LEDGER_WIDTH} y1={ledgerY} y2={ledgerY} stroke={color} strokeWidth={STAFF_STROKE_WIDTH} />
          ))}
          {!!head.acc && <MusicAccidental acc={head.acc} rightEdgeX={head.headLeft - ACCIDENTAL_GAP} centerY={head.centerY} color={color} />}
          <MusicNotehead x={head.centerX} y={head.centerY} kind={head.headKind} color={color} />
        </G>
      ))}

      {geometry.rests.map((rest) => (
        <MusicRest key={rest.key} x={rest.centerX} kind={rest.kind} color={color} />
      ))}

      {/*
        连音线：小程序 `.tie` 是 `border-bottom: 2rpx + border-radius: 0 0 50% 50%`，
        即弧的两端落在盒中线、弧顶落在盒底 —— 等价于「以弦中点为中心的下半椭圆」，
        用 SVG 椭圆弧 rx=width/2 / ry=height/2 / sweep=0 精确复刻。
        ⚠️ 位置严格跟着小程序 wxml：rests → ties → stems → beams → flags → dots → tuplets。
      */}
      {geometry.ties.map((tie) => (
        <Path
          key={tie.key}
          d={`M ${tie.left} ${tie.top + tie.height / 2} A ${tie.width / 2} ${tie.height / 2} 0 0 0 ${tie.left + tie.width} ${tie.top + tie.height / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={TIE_STROKE_WIDTH}
        />
      ))}

      {geometry.stems.map((stem) => (
        <Line key={stem.key} x1={stem.x} x2={stem.x} y1={stem.y1} y2={stem.y2} stroke={color} strokeWidth={STAFF_STROKE_WIDTH} />
      ))}

      {geometry.beams.map((beam) => (
        <Line key={beam.key} x1={beam.x1} x2={beam.x2} y1={beam.y} y2={beam.y} stroke={color} strokeWidth={BEAM_THICKNESS} strokeLinecap="butt" />
      ))}

      {geometry.flags.map((flag) => (
        <MusicFlag key={flag.key} stemX={flag.stemX} stemEndY={flag.stemEndY} beamCount={flag.beamCount} direction={flag.direction} color={color} />
      ))}

      {geometry.dots.map((dot) => (
        <MusicDot key={dot.key} noteRightX={dot.noteRightX} centerY={dot.centerY} color={color} />
      ))}

      {geometry.tuplets.map((tuplet) => (
        <MusicTuplet key={tuplet.key} x={tuplet.x} top={tuplet.top} color={color} />
      ))}

      {/* 小程序 .answer-slot 的分隔虚线：整壳高、2rpx、容器等分 */}
      {slotDividers.map((x) => (
        <Line key={`slot-${x}`} x1={x} x2={x} y1={0} y2={STAFF_HEIGHT_RPX} stroke="rgba(72,65,199,0.32)" strokeWidth={2} strokeDasharray="4 4" />
      ))}

      {/* 结束线：小程序 answer-staff 的 .endline（右缘与壳体内容盒右缘对齐） */}
      {last && (
        <>
          <Line key="endline-thin" x1={viewBoxWidth - ENDLINE_WIDTH + ENDLINE_THIN / 2} x2={viewBoxWidth - ENDLINE_WIDTH + ENDLINE_THIN / 2} y1={barTop} y2={barBottom} stroke={lineColor} strokeWidth={ENDLINE_THIN} />
          <Line key="endline-thick" x1={viewBoxWidth - ENDLINE_THICK / 2} x2={viewBoxWidth - ENDLINE_THICK / 2} y1={barTop} y2={barBottom} stroke={lineColor} strokeWidth={ENDLINE_THICK} />
        </>
      )}
    </>
  );

  return (
    <Svg viewBox={`0 0 ${viewBoxWidth} ${STAFF_HEIGHT_RPX}`} preserveAspectRatio="none" width="100%" height="100%">
      {offsetX ? <G transform={`translate(${offsetX} 0)`}>{content}</G> : content}
    </Svg>
  );
});
