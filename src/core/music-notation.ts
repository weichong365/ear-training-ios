/**
 * 谱面渲染的共用几何与乐理换算。
 *
 * ⚠️ 所有谱线坐标都来自 `@/core/staff-layout`（小程序 staff-layout.js 的 1:1 移植），
 *    单位是 rpx（1rpx = 0.5pt）。本文件只负责「音高 ↔ 谱面坐标」和时值/符干规则，
 *    不再自带任何硬编码的谱线常量。
 */

import {
  STAFF_FIRST_LINE_Y,
  STAFF_LINE_YS,
  STAFF_STEP_GAP,
  barlineHeight,
  barlineTop,
  staffYForStep,
} from './staff-layout.ts';

export { STAFF_LINE_YS, STAFF_STEP_GAP };
export const STAFF_TOP_LINE_Y = STAFF_LINE_YS[0];
export const STAFF_BOTTOM_LINE_Y = STAFF_LINE_YS[STAFF_LINE_YS.length - 1];
export const STAFF_MIDDLE_LINE_Y = STAFF_LINE_YS[2];
/** 谱线 1px = 2rpx；小节线/加线/符干同宽 */
export const STAFF_STROKE_WIDTH = 2;

export type NoteheadKind = 'whole' | 'half' | 'black';
export type RestKind = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
export type StemDirection = 'up' | 'down';

export type DurationNotation = {
  value: number;
  headKind: NoteheadKind;
  restKind: RestKind;
  beamCount: number;
  dotCount: number;
  hasStem: boolean;
  tuplet?: boolean;
};

const NATURAL_SCALE = [0, 2, 4, 5, 7, 9, 11];
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const E4_DIATONIC = 4 * 7 + LETTER_INDEX.E;

/** 记谱音高 → 谱面 y（rpx）。E4 落在第一线（最底）。 */
export function staffSvgYFromWrittenMidi(midi: number) {
  const name = SHARP_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + LETTER_INDEX[name[0]];
  return STAFF_FIRST_LINE_Y - (diatonic - E4_DIATONIC) * STAFF_STEP_GAP;
}

/** 谱面 y（rpx）→ 最近的记谱自然音 MIDI。 */
export function writtenMidiFromStaffSvgY(y: number) {
  const diatonic = E4_DIATONIC + Math.round((STAFF_FIRST_LINE_Y - y) / STAFF_STEP_GAP);
  const octave = Math.floor(diatonic / 7);
  const index = ((diatonic % 7) + 7) % 7;
  return (octave + 1) * 12 + NATURAL_SCALE[index];
}

/** E4 是第 0 级；每条线/间进一级，级数越大音越高、y 越小。 */
export function staffStepFromWrittenMidi(writtenMidi: number) {
  return Math.round((STAFF_FIRST_LINE_Y - staffSvgYFromWrittenMidi(writtenMidi)) / STAFF_STEP_GAP);
}

/** 高音谱表：中音 C 及以下、A5 及以上需要加线。 */
export function ledgerLineYs(writtenMidi: number) {
  const step = staffStepFromWrittenMidi(writtenMidi);
  const lines: number[] = [];
  if (step <= -2) {
    for (let ledgerStep = -2; ledgerStep >= step; ledgerStep -= 2) lines.push(staffYForStep(ledgerStep));
  }
  if (step >= 10) {
    for (let ledgerStep = 10; ledgerStep <= step; ledgerStep += 2) lines.push(staffYForStep(ledgerStep));
  }
  return lines;
}

/** 第三线（step 4）及以上符干朝下。 */
export function stemDirectionForWrittenMidis(writtenMidis: number[]): StemDirection {
  if (!writtenMidis.length) return 'up';
  const averageStep = writtenMidis.reduce((sum, midi) => sum + staffStepFromWrittenMidi(midi), 0) / writtenMidis.length;
  return averageStep < 4 ? 'up' : 'down';
}

/** 相邻音级（二度）的和弦音左右错开，避免符头重叠。 */
export function chordHeadOffsets(writtenMidis: number[], displacement = 12.96) {
  const offsets = writtenMidis.map(() => 0);
  const ordered = writtenMidis
    .map((midi, index) => ({ index, step: staffStepFromWrittenMidi(midi) }))
    .sort((left, right) => left.step - right.step);
  let previousStep: number | null = null;
  let shifted = false;
  ordered.forEach(({ index, step }) => {
    if (previousStep !== null && Math.abs(step - previousStep) === 1) {
      shifted = !shifted;
      offsets[index] = shifted ? displacement : 0;
    } else {
      shifted = false;
    }
    previousStep = step;
  });
  return offsets;
}

/** 线音符旁的附点移到它上方的间里。 */
export function augmentationDotY(writtenMidi: number) {
  const y = staffSvgYFromWrittenMidi(writtenMidi);
  return staffStepFromWrittenMidi(writtenMidi) % 2 === 0 ? y - STAFF_STEP_GAP : y;
}

export function noteheadStemX(noteX: number, halfWidth: number, direction: StemDirection, lineGap: number) {
  const inset = lineGap * 0.2;
  return noteX + (direction === 'up' ? halfWidth - inset : -halfWidth + inset);
}

export function noteheadStemStart(noteX: number, noteY: number, halfWidth: number, direction: StemDirection, lineGap: number) {
  return { x: noteheadStemX(noteX, halfWidth, direction, lineGap), y: noteY + (direction === 'up' ? 1 : -1) };
}

export function barlineBounds() {
  return { top: barlineTop(), bottom: barlineTop() + barlineHeight() };
}

/** 时值以四分音符为单位；3/8 与 6/8 按附点四分音符分组。 */
export function beamGroupAtBeat(elapsed: number, meter: string) {
  const beatSize = meter === '3/8' || meter === '6/8' ? 1.5 : 1;
  return Math.floor((elapsed + 1e-6) / beatSize);
}

export function fitTupletBeamY(beamY: number, direction: StemDirection, staffHeight: number, numberHeight: number, gap: number, beamThickness: number) {
  return direction === 'up'
    ? Math.max(beamY, numberHeight + gap)
    : Math.min(beamY, staffHeight - numberHeight - gap - beamThickness);
}

const DURATION_TABLE: DurationNotation[] = [
  { value: 4, headKind: 'whole', restKind: 'whole', beamCount: 0, dotCount: 0, hasStem: false },
  { value: 3, headKind: 'half', restKind: 'half', beamCount: 0, dotCount: 1, hasStem: true },
  { value: 2, headKind: 'half', restKind: 'half', beamCount: 0, dotCount: 0, hasStem: true },
  { value: 1.5, headKind: 'black', restKind: 'quarter', beamCount: 0, dotCount: 1, hasStem: true },
  { value: 1, headKind: 'black', restKind: 'quarter', beamCount: 0, dotCount: 0, hasStem: true },
  { value: 0.75, headKind: 'black', restKind: 'eighth', beamCount: 1, dotCount: 1, hasStem: true },
  { value: 0.5, headKind: 'black', restKind: 'eighth', beamCount: 1, dotCount: 0, hasStem: true },
  { value: 0.25, headKind: 'black', restKind: 'sixteenth', beamCount: 2, dotCount: 0, hasStem: true },
];

export function durationNotation(duration: number): DurationNotation {
  const value = Math.abs(Number(duration) || 1);
  if (Math.abs(value - 1 / 3) < 1e-6) {
    return { value: 1 / 3, headKind: 'black', restKind: 'eighth', beamCount: 1, dotCount: 0, hasStem: true, tuplet: true };
  }
  return DURATION_TABLE.find((item) => Math.abs(item.value - value) < 1e-6)
    || DURATION_TABLE.reduce((best, item) => Math.abs(item.value - value) < Math.abs(best.value - value) ? item : best);
}

// ===== 钢琴键盘（piano-keyboard.tsx）=====
export type PianoKeyLayout = { midi: number; leftPercent: number; widthPercent: number };

const BLACK_PITCH_CLASSES = [1, 3, 6, 8, 10];

export function pianoWhiteMidis(startMidi = 55, endMidi = 81) {
  const midis: number[] = [];
  for (let midi = startMidi; midi <= endMidi; midi += 1) {
    if (!BLACK_PITCH_CLASSES.includes(((midi % 12) + 12) % 12)) midis.push(midi);
  }
  return midis;
}

function blackKeyLayout(midi: number, leftUnits: number, whiteCount: number): PianoKeyLayout {
  const widthPercent = whiteCount ? 55 / whiteCount : 0;
  return {
    midi,
    leftPercent: whiteCount ? Math.max(0, Math.min(
      (leftUnits / whiteCount) * 100 - widthPercent / 2,
      100 - widthPercent,
    )) : 0,
    widthPercent,
  };
}

export function pianoBlackKeys(startMidi = 55, endMidi = 81): PianoKeyLayout[] {
  const whiteMidis = pianoWhiteMidis(startMidi, endMidi);
  const whiteCount = whiteMidis.length;
  const keys: PianoKeyLayout[] = [];
  let leftUnits = 0;
  for (let midi = startMidi; midi <= endMidi; midi += 1) {
    if (BLACK_PITCH_CLASSES.includes(((midi % 12) + 12) % 12)) {
      keys.push(blackKeyLayout(midi, leftUnits, whiteCount));
    } else {
      leftUnits += 1;
    }
  }
  return keys;
}

/** Return the percentage-positioned black-key layout for the requested range. */
export function pianoKeyLayout(startMidi = 55, endMidi = 81) {
  return pianoBlackKeys(startMidi, endMidi);
}
