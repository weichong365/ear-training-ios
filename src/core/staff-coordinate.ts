/**
 * 五线谱 viewBox 与触摸坐标换算。
 *
 * viewBox 用 **rpx**（与小程序同坐标系）：宽 = 实际渲染 pt 宽 × 2、高 = 140rpx，
 * 画布高 70pt ⇒ 1 单位 = 0.5pt，两端逐像素一致。
 */

import { DEFAULT_STAFF_WIDTH_RPX, RPX_TO_PT, STAFF_HEIGHT_RPX } from './staff-layout.ts';
import { staffSvgYFromWrittenMidi, writtenMidiFromStaffSvgY } from './music-notation.ts';

export { staffSvgYFromWrittenMidi, writtenMidiFromStaffSvgY };

/** viewBox 高度（rpx） */
export const STAFF_VIEWBOX_HEIGHT = STAFF_HEIGHT_RPX;
/** 首次布局前的默认 viewBox 宽度（小程序 answer-staff 的 width prop） */
export const STAFF_VIEWBOX_WIDTH = DEFAULT_STAFF_WIDTH_RPX;
/** 画布渲染高度（pt）= 140rpx × 0.5 */
export const ANSWER_STAFF_HEIGHT = STAFF_HEIGHT_RPX * RPX_TO_PT;

/** 实际渲染宽度（pt）→ viewBox 宽度（rpx） */
export function staffViewBoxWidth(renderedWidth: number) {
  if (!(renderedWidth > 0)) return STAFF_VIEWBOX_WIDTH;
  return Math.round(renderedWidth / RPX_TO_PT * 2) / 2;
}

/** 谱面 y（rpx）→ 最近的记谱自然音 MIDI。 */
export function naturalMidiFromStaffSvgY(y: number, minimum = 55, maximum = 81) {
  const midi = writtenMidiFromStaffSvgY(y);
  return Math.max(minimum, Math.min(maximum, midi));
}

/**
 * 物理触摸点 → 谱面音高。
 * 谱面 SVG 刻意使用 preserveAspectRatio="none"，此换算在任何屏宽下都成立，
 * 且不继承 SVG 的 letterbox 偏移。
 */
export function naturalMidiFromStaffTapY(y: number, renderedHeight = ANSWER_STAFF_HEIGHT, minimum = 55, maximum = 81) {
  const safeHeight = renderedHeight > 0 ? renderedHeight : ANSWER_STAFF_HEIGHT;
  return naturalMidiFromStaffSvgY(y * STAFF_VIEWBOX_HEIGHT / safeHeight, minimum, maximum);
}
