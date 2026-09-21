import { memo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { StaffNotation } from '@/components/staff-notation';
import { Btn } from '@/constants/button-tokens';
import { Brand } from '@/constants/theme';
import type { AccidentalMode } from '@/core/exam-answer';
import { defaultPitchSpelling } from '@/core/pitch-spelling';
import {
  DEFAULT_STAFF_WIDTH_RPX,
  RPX_TO_PT,
  STAFF_SHELL_BORDER,
  STAFF_SHELL_RADIUS,
  type StaffEvent,
} from '@/core/staff-layout';
import { ANSWER_STAFF_HEIGHT, staffViewBoxWidth } from '@/core/staff-coordinate';

/**
 * 谱例预览 —— 与小程序的 `<answer-staff>`（`exam.wxml` 的选择题谱面）同源：
 * 同一套 rpx 几何、同一批 Bravura 字形、同一份「调号已含的升降号不重复标注」规则。
 * 容器高 140rpx = 70pt，viewBox 用 rpx ⇒ 1 单位 = 0.5pt，与小程序逐像素一致。
 */

type StaffPreviewProps = {
  /** 小程序形状的事件（midis/dur/rest/barIndex）；给了它就不再从 midis 反推 */
  events?: StaffEvent[];
  midis?: number[];
  spellings?: string[];
  /** 纵向叠写（和弦 / 和声音程） */
  harmonic?: boolean;
  meter?: string;
  keySignature?: string;
  barCount?: number;
  /** 小程序 exam.wxml `style="width: {{option.staffWidth}}rpx"` */
  staffWidth?: number;
  ink?: boolean;
  tone?: 'red' | 'green' | '';
  accidentals?: AccidentalMode[];
  /** true → 全音符（无符干）；false → 四分音符（带符干） */
  wholeNotes?: boolean;
  /** @deprecated 小程序答题谱只有 140rpx 一种尺寸；保留 prop 仅为兼容既有调用 */
  compact?: boolean;
  onPressY?: (y: number) => void;
};

const ACCIDENTAL_OPTIONS: { value: AccidentalMode; label: string }[] = [
  { value: 'none', label: '无记号' },
  { value: 'sharp', label: '♯ 升号' },
  { value: 'flat', label: '♭ 降号' },
  { value: 'natural', label: '♮ 还原号' },
];

export function applyAccidental(midi: number, accidental: AccidentalMode) {
  if (accidental === 'sharp') return midi + 1;
  if (accidental === 'flat') return midi - 1;
  return midi;
}

export function AccidentalPicker({ value, disabled, onChange }: { value: AccidentalMode; disabled?: boolean; onChange: (value: AccidentalMode) => void }) {
  return (
    <View style={styles.accidentalWrap} accessibilityLabel="临时记号选择">
      {ACCIDENTAL_OPTIONS.map((option) => (
        <Pressable accessibilityRole="radio" accessibilityLabel={`临时记号${option.label}`} accessibilityState={{ selected: value === option.value, disabled }} hitSlop={Btn.staff.accidentalHitSlop} key={option.value} disabled={disabled} onPress={() => onChange(option.value)} style={[styles.accidentalButton, value === option.value && styles.accidentalActive, disabled && styles.accidentalDisabled]}>
          <Text style={[styles.accidentalText, value === option.value && styles.accidentalTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** 把「谱位自然音 + 记号」拼成拼写串（'C#5' / 'Bb4' / 'Fn4'）。 */
function spelled(writtenMidi: number, acc: '#' | 'b' | 'n') {
  return defaultPitchSpelling(writtenMidi).replace(/^([A-G])([#bn]?)/, `$1${acc}`);
}

/**
 * midis + 可选临时记号 → 小程序形状的事件。
 * 记号的语义与旧实现一致：显式 'sharp'/'flat' 时符头落在自然音位、另画记号；
 * 未显式给出记号时用默认拼写（黑键自带 ♯），交给 staffAccidental 决定是否落笔。
 */
function previewEvents(midis: number[], spellings: string[], accidentals: AccidentalMode[], harmonic: boolean, wholeNotes: boolean): StaffEvent[] {
  const notes = midis.filter((midi) => Number.isFinite(midi)).slice(0, 10);
  if (!notes.length) return [];
  const pitched = notes.map((midi, index) => {
    if (spellings[index]) return { midi, spelling: spellings[index] };
    const accidental = accidentals[index] || 'none';
    if (accidental === 'sharp') return { midi, spelling: spelled(midi - 1, '#') };
    if (accidental === 'flat') return { midi, spelling: spelled(midi + 1, 'b') };
    if (accidental === 'natural') return { midi, spelling: spelled(midi, 'n') };
    return { midi, spelling: defaultPitchSpelling(midi) };
  });
  if (harmonic) {
    return [{ midis: pitched.map((note) => note.midi), spellings: pitched.map((note) => note.spelling), dur: 4, rest: false }];
  }
  const dur = wholeNotes ? 4 : 1;
  return pitched.map((note) => ({ midis: [note.midi], spellings: [note.spelling], dur, rest: false }));
}

function resolvePressY(event: GestureResponderEvent, height: number) {
  const nativeEvent = event.nativeEvent as typeof event.nativeEvent & {
    clientY?: number;
    offsetY?: number;
  };
  const directY = Number(nativeEvent.locationY ?? nativeEvent.offsetY);
  if (Number.isFinite(directY)) return Math.max(0, Math.min(height, directY));

  const webTarget = event.currentTarget as unknown as {
    getBoundingClientRect?: () => { top: number };
  };
  const targetRect = webTarget.getBoundingClientRect?.();
  const clientY = Number(nativeEvent.clientY);
  if (targetRect && Number.isFinite(clientY)) {
    return Math.max(0, Math.min(height, clientY - targetRect.top));
  }

  // 部分 Web/自动化事件不提供局部坐标；宁可落在谱面中线，也不能写入 NaN。
  return height / 2;
}

export const StaffPreview = memo(function StaffPreview({ events, midis = [], spellings = [], harmonic = false, meter = '', keySignature = '', barCount = 0, staffWidth, ink = false, tone = '', accidentals = [], wholeNotes = false, onPressY }: StaffPreviewProps) {
  const [measured, setMeasured] = useState(0);
  const staffEvents = events || previewEvents(midis, spellings, accidentals, harmonic, wholeNotes);
  /** 布局宽度（rpx）=小程序 answer-staff 的 width prop；实测宽度只在没指定时兜底 */
  const layoutWidth = staffWidth || DEFAULT_STAFF_WIDTH_RPX;
  const viewBoxWidth = staffWidth || staffViewBoxWidth(measured);

  const staff = (
    <View style={[styles.container, ink && styles.inkContainer, staffWidth ? { width: staffWidth * RPX_TO_PT } : null]}>
      <View style={styles.touchArea} onLayout={(event: LayoutChangeEvent) => setMeasured(event.nativeEvent.layout.width)}>
        <StaffNotation events={staffEvents} viewBoxWidth={viewBoxWidth} width={layoutWidth} meter={meter} beamMeter={meter} keySignature={keySignature} barCount={barCount} tone={tone} ink={ink} />
      </View>
    </View>
  );

  if (!onPressY) return staff;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="点击五线谱写入音符"
      onPress={(event) => onPressY(resolvePressY(event, ANSWER_STAFF_HEIGHT))}>
      {staff}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  /** 小程序 .answer-staff-shell：140rpx / 1rpx 描边 / 12rpx 圆角 */
  container: {
    height: ANSWER_STAFF_HEIGHT,
    overflow: 'hidden',
    borderRadius: STAFF_SHELL_RADIUS,
    borderWidth: STAFF_SHELL_BORDER * RPX_TO_PT,
    borderColor: '#D9DDE8',
    backgroundColor: '#FFFFFF',
  },
  inkContainer: { borderColor: '#141414' },
  touchArea: { height: ANSWER_STAFF_HEIGHT, borderRadius: STAFF_SHELL_RADIUS, overflow: 'hidden' },
  accidentalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  /**
   * 小程序只有谱面上的浮层菜单（.accidental-choice 46 × 34rpx，纯字形），
   * 没有这种带文字的独立选择行 —— 就近取练习页 .choice-pill 的文字芯片盒。
   */
  accidentalButton: { ...Btn.practice.choicePill, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.ivory, borderColor: Brand.border },
  accidentalActive: { borderColor: Brand.forest, backgroundColor: Brand.forest },
  accidentalDisabled: { opacity: 0.45 },
  accidentalText: { color: Brand.muted, fontSize: Btn.practice.choicePill.fontSize, fontWeight: '700' },
  accidentalTextActive: { color: Brand.textOnAccent },
});
