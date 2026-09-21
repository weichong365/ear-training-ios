import { memo, useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StaffNotation } from '@/components/staff-notation';
import { Btn, hitSlopFor } from '@/constants/button-tokens';
import { Brand, TypeScale } from '@/constants/theme';
import { meterBeatScale, meterCapacity, splitBars, sumDuration, targetTimedEvents } from '@/core/answer-sync';
import type { ExamAnswer, NotationEvent } from '@/core/exam-answer';
import { defaultPitchSpelling, naturalMidiForPitchSpelling } from '@/core/pitch-spelling';
import type { ExamQuestion } from '@/core/provinces';
import { buildStaffGeometry } from '@/core/staff-notation-geometry';
import {
  DEFAULT_STAFF_WIDTH_RPX,
  EMPTY_FONT_SIZE,
  EMPTY_HEIGHT,
  EMPTY_TOP,
  FIXED_BAR_LEFT_COMPACT,
  FIXED_BAR_RIGHT_COMPACT,
  RPX_TO_PT,
  STAFF_HEIGHT_RPX,
  STAFF_SHELL_BORDER,
  STAFF_SHELL_RADIUS,
  type StaffEvent,
} from '@/core/staff-layout';
import { ANSWER_STAFF_HEIGHT, naturalMidiFromStaffSvgY, staffViewBoxWidth } from '@/core/staff-coordinate';

/**
 * 听记谱面（节奏 / 旋律）书写与预览。
 *
 * 绘制全部交给 @/components/staff-notation（小程序 components/staff-notation 的 1:1 移植）：
 * viewBox 用 rpx、画布高 70pt，音符 x 直接取小程序 horizontalLayout 的 centers，
 * 字形尺寸取 Bravura 在 lineGap=15rpx 下的实测裁切盒 —— 与小程序的绝对 rpx 定位一致。
 */

/** 小程序 answer-staff.js 的 closestTarget 容差（单位 rpx） */
const TAP_DX = 42;
const TAP_DY = 20;
/** 可写音域 G3–A5，与小程序 answer-staff.js 的 MIN_STEP/MAX_STEP 一致 */
const MIN_MIDI = 55;
const MAX_MIDI = 81;

const METERS = ['2/4', '3/4', '4/4', '3/8', '6/8'];
const KEYS = [
  { value: 'C', label: 'C 大调' },
  { value: 'G', label: 'G 大调（1♯）' },
  { value: 'F', label: 'F 大调（1♭）' },
  { value: 'a', label: 'a 小调' },
];
export const DURATION_OPTIONS = [
  { value: 3, label: '附点二分' },
  { value: 2, label: '二分' },
  { value: 1.5, label: '附点四分' },
  { value: 1, label: '四分' },
  { value: 0.75, label: '附点八分' },
  { value: 0.5, label: '八分' },
  { value: 0.25, label: '十六分' },
  { value: 1 / 3, label: '三连音' },
];

function roundBeats(value: number) {
  return Math.round(value * 100) / 100;
}

function naturalSpelling(midi: number) {
  return defaultPitchSpelling(midi);
}

function applyKeySignature(midi: number, keySignature: string) {
  const spelling = naturalSpelling(midi);
  if (keySignature === 'G' && spelling.startsWith('F')) return { midi: midi + 1, spelling: spelling.replace('F', 'F#') };
  if (keySignature === 'F' && spelling.startsWith('B')) return { midi: midi - 1, spelling: spelling.replace('B', 'Bb') };
  return { midi, spelling };
}

function writtenMidi(event: NotationEvent) {
  return naturalMidiForPitchSpelling(event.midi, event.spelling);
}

/** 触摸点 → 谱面 rpx 坐标 */
function pressPoint(event: GestureResponderEvent, width: number, height: number, viewBoxWidth: number) {
  const native = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number; offsetY?: number };
  return {
    x: Number(native.locationX ?? native.offsetX ?? width / 2) * viewBoxWidth / Math.max(1, width),
    y: Number(native.locationY ?? native.offsetY ?? height / 2) * STAFF_HEIGHT_RPX / Math.max(1, height),
  };
}

/** practice.js onTimedStaffTap：固定小节布局的可用宽度为 630 − 112 − 8（rpx） */
function barIndexFromX(x: number, barCount: number) {
  const barWidth = (DEFAULT_STAFF_WIDTH_RPX - FIXED_BAR_LEFT_COMPACT - FIXED_BAR_RIGHT_COMPACT) / Math.max(1, barCount);
  return Math.max(0, Math.min(barCount - 1, Math.floor((x - FIXED_BAR_LEFT_COMPACT) / Math.max(1, barWidth))));
}

function decorateSequentialBars(events: NotationEvent[], capacity: number) {
  let sequentialBar = 0;
  let elapsed = 0;
  return events.map((event) => {
    const barIndex = Number.isInteger(event.barIndex) ? Number(event.barIndex) : sequentialBar;
    if (!Number.isInteger(event.barIndex)) {
      elapsed += Math.abs(event.duration);
      if (Math.abs(elapsed - capacity) < 1e-6) {
        sequentialBar += 1;
        elapsed = 0;
      }
    }
    return { ...event, barIndex };
  });
}

type TimedStaffProps = {
  events: NotationEvent[];
  meter: string;
  capacityMeter?: string;
  keySignature: string;
  barOffset: number;
  barCount: number;
  isFinalSystem: boolean;
  disabled?: boolean;
  ink?: boolean;
  tone?: 'red' | 'green' | '';
  emptyText: string;
  /** 小程序 answer-staff 的 width（rpx）；缺省=630（设计宽，不是容器宽） */
  staffWidth?: number;
  onStaffTap?: (barIndex: number, midi: number, spelling: string) => void;
  onEventTap?: (event: NotationEvent) => void;
};

export const TimedAnswerStaff = memo(function TimedAnswerStaff({ events, meter, capacityMeter, keySignature, barOffset, barCount, isFinalSystem, disabled, ink = false, tone = '', emptyText, staffWidth, onStaffTap, onEventTap }: TimedStaffProps) {
  const [layout, setLayout] = useState({ width: 0, height: ANSWER_STAFF_HEIGHT });
  /** 实测容器宽 → viewBox 宽（rpx）；指定 staffWidth 时以它为准（与小程序 style.width 等价） */
  const layoutWidth = staffWidth || DEFAULT_STAFF_WIDTH_RPX;
  const viewBoxWidth = staffWidth || staffViewBoxWidth(layout.width);
  const beamMeter = capacityMeter || meter;

  /** NotationEvent → 小程序 staff-notation 的事件形状；barIndex 归一化到本系统（0/1） */
  const staffEvents: StaffEvent[] = useMemo(() => events.map((item, index) => ({
    midis: [item.midi],
    spellings: item.spelling ? [item.spelling] : [],
    dur: Number(item.duration) || 1,
    rest: Boolean(item.rest),
    barIndex: Number.isInteger(item.barIndex) ? Number(item.barIndex) - barOffset : undefined,
    tieToNext: Boolean(item.tieToNext),
    // 跨系统时上游会显式写 tieFromPrevious；同系统内直接看前一个音是否连出。
    tieFromPrevious: Boolean(item.tieFromPrevious) || (index > 0 && Boolean(events[index - 1].tieToNext)),
  })), [events, barOffset]);

  const geometry = useMemo(() => buildStaffGeometry(staffEvents, {
    width: layoutWidth,
    meter,
    beamMeter,
    keySignature,
    barCount,
  }), [staffEvents, layoutWidth, meter, beamMeter, keySignature, barCount]);

  function tap(event: GestureResponderEvent) {
    if (disabled) return;
    const point = pressPoint(event, layout.width, layout.height, viewBoxWidth);
    const nearest = geometry.targets.reduce<{ target: (typeof geometry.targets)[number] | null; distance: number }>((best, target) => {
      const dx = Math.abs(target.x - point.x);
      const dy = Math.abs(target.y - point.y);
      if (dx > TAP_DX || dy > TAP_DY) return best;
      const distance = dx * dx + dy * dy * 2;
      return distance < best.distance ? { target, distance } : best;
    }, { target: null, distance: Infinity }).target;
    if (nearest) {
      onEventTap?.(events[nearest.eventIndex]);
      return;
    }
    const naturalMidi = naturalMidiFromStaffSvgY(point.y, MIN_MIDI, MAX_MIDI);
    const note = applyKeySignature(naturalMidi, keySignature);
    onStaffTap?.(barOffset + barIndexFromX(point.x, barCount), note.midi, note.spelling);
  }

  return (
    <View style={[styles.staffShell, ink && styles.inkStaff, tone === 'red' && styles.wrongStaff, tone === 'green' && styles.correctStaff, staffWidth ? { width: staffWidth * RPX_TO_PT } : null]}>
      <Pressable
        accessibilityRole={disabled ? 'image' : 'button'}
        accessibilityState={disabled ? undefined : { disabled: false }}
        accessibilityLabel={disabled ? '五线谱谱例' : '两小节五线谱答题区域'}
        disabled={disabled}
        onPress={tap}
        onLayout={(event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout)}
        style={styles.staffTouch}>
        <StaffNotation
          events={staffEvents}
          viewBoxWidth={viewBoxWidth}
          width={layoutWidth}
          meter={meter}
          beamMeter={beamMeter}
          keySignature={keySignature}
          barCount={barCount}
          tone={tone}
          ink={ink}
          last={isFinalSystem}
        />
        {!events.length && <Text pointerEvents="none" style={styles.emptyText}>{emptyText}</Text>}
      </Pressable>
    </View>
  );
});

/**
 * 只读谱例（选择题谱面预览 / 答案谱）。
 * 不给 staffWidth 时按小程序 `answer-staff width="630" bar-count=2` 分行；
 * 给了 staffWidth 就是小程序 exam.wxml 的 `style="width: {{option.staffWidth}}rpx"` 单谱面。
 */
export const NotationStaff = memo(function NotationStaff({ events, meter, keySignature = '', barCount, ink = false, tone = '', staffWidth }: { events: NotationEvent[]; meter: string; keySignature?: string; barCount: number; ink?: boolean; tone?: 'red' | 'green' | ''; staffWidth?: number }) {
  const capacity = meterCapacity(meter, 4);
  const decorated = decorateSequentialBars(events, capacity);

  if (staffWidth) {
    return <TimedAnswerStaff events={decorated} meter={meter} capacityMeter={meter} keySignature={keySignature} barOffset={0} barCount={Math.max(1, barCount)} isFinalSystem disabled ink={ink} tone={tone} emptyText="" staffWidth={staffWidth} />;
  }

  const systems = Math.max(1, Math.ceil(barCount / 2));
  return <View style={{ gap: 7 }}>{Array.from({ length: systems }, (_, systemIndex) => {
    const barOffset = systemIndex * 2;
    const systemBarCount = Math.min(2, barCount - barOffset);
    return <TimedAnswerStaff key={systemIndex} events={decorated.filter((event) => Number(event.barIndex) >= barOffset && Number(event.barIndex) < barOffset + systemBarCount)} meter={systemIndex === 0 ? meter : ''} capacityMeter={meter} keySignature={keySignature} barOffset={barOffset} barCount={systemBarCount} isFinalSystem={systemIndex === systems - 1} disabled ink={ink} tone={tone} emptyText="" />;
  })}</View>;
});

export function NotationEditor({ question, answer, unlocked, disabled, reviewCorrect, showCorrect, ink = false, onChange }: { question: ExamQuestion; answer: ExamAnswer; unlocked: boolean; disabled?: boolean; reviewCorrect?: boolean; showCorrect?: boolean; ink?: boolean; onChange: (answer: ExamAnswer) => void }) {
  const [duration, setDuration] = useState(1);
  const [rest, setRest] = useState(false);
  /** 小程序 practice.js 的 inputTie：只对节奏题开放，与休止符互斥 */
  const [tie, setTie] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const isMelody = question.type === 'melody';
  const beatsPerBar = Number(question.beatsPerBar) || meterCapacity(String(question.meter || ''), 4);
  const barCount = Number(question.examBars || question.barCount) || Math.max(1, Math.round(sumDuration(targetTimedEvents(question)) / beatsPerBar));
  const systems = Math.max(1, Math.ceil(barCount / 2));
  const answerCapacity = meterCapacity(answer.meter, beatsPerBar);
  const targetBars = splitBars(targetTimedEvents(question), beatsPerBar, barCount);
  const canEdit = unlocked && !disabled;
  const emptyText = !unlocked && !disabled ? '播放题目后开始作答'
    : !answer.meter ? '请先选择拍号' : isMelody && !answer.keySignature ? '请先选择调号'
      : isMelody ? '选择时值后点击音高位置' : '选择时值后点击谱面写入';

  function selectMeter(meter: string) {
    if (!canEdit || meter === answer.meter) return;
    setMessage(answer.events.length ? '拍号已更改，原有谱面已清空' : '');
    onChange({ ...answer, meter, events: [] });
  }
  function selectKey(keySignature: string) {
    if (!canEdit || keySignature === answer.keySignature) return;
    setMessage(answer.events.length ? '调号已更改，原有谱面已清空' : '');
    onChange({ ...answer, keySignature, events: [] });
  }
  function append(barIndex: number, midi: number, spelling: string) {
    if (!canEdit || !answer.meter || (isMelody && !answer.keySignature)) {
      setMessage(!answer.meter ? '请先选择拍号' : '请先选择调号');
      return;
    }
    const barDuration = sumDuration(answer.events.filter((item) => item.barIndex === barIndex));
    const remaining = answerCapacity - barDuration;
    if (duration > remaining + 1e-6) {
      setMessage(`当前小节只剩 ${roundBeats(remaining * meterBeatScale(answer.meter))} 拍`);
      return;
    }
    const inputOrder = Math.max(0, ...answer.events.map((item) => Number(item.inputOrder) || 0)) + 1;
    const nextEvent: NotationEvent = rest
      ? { midi: 69, duration: -duration, rest: true, barIndex, inputOrder }
      : {
        midi: isMelody ? midi : 69,
        spelling: isMelody ? spelling : undefined,
        duration,
        barIndex,
        inputOrder,
        // 小程序：只有节奏题会把 inputTie 写进事件；旋律题的谱面无连音线输入
        ...(isMelody ? {} : { tieToNext: tie }),
      };
    setMessage('');
    onChange({ ...answer, events: [...answer.events, nextEvent].sort((left, right) => Number(left.barIndex) - Number(right.barIndex)) });
  }

  /** 小程序 onToggleRest：开休止符就自动关掉连音线（两者互斥） */
  function toggleRest() {
    setRest((value) => {
      if (!value) setTie(false);
      return !value;
    });
  }

  /** 小程序 onToggleTie：开连音线就自动关掉休止符 */
  function toggleTie() {
    setTie((value) => {
      if (!value) setRest(false);
      return !value;
    });
  }
  function updateSelected(accidental: '' | '#' | 'b' | 'n' | 'erase') {
    if (selectedOrder === null) return;
    const index = answer.events.findIndex((event) => event.inputOrder === selectedOrder);
    if (index < 0) return;
    const events = answer.events.slice();
    if (accidental === 'erase') events.splice(index, 1);
    else {
      const event = events[index];
      const written = writtenMidi(event);
      const spelling = naturalSpelling(written);
      const note = accidental === '' ? applyKeySignature(written, answer.keySignature) : {
        midi: written + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0),
        spelling: spelling.replace(/^([A-G])/, `$1${accidental}`),
      };
      events[index] = { ...event, ...note };
    }
    setSelectedOrder(null);
    onChange({ ...answer, events });
  }
  function undo() {
    const latest = answer.events.reduce((best, event) => Number(event.inputOrder) > Number(best?.inputOrder || -1) ? event : best, null as NotationEvent | null);
    if (latest) onChange({ ...answer, events: answer.events.filter((event) => event !== latest) });
  }

  /** 跨谱行连音：上一音落在本系统之外时，把 tieFromPrevious 显式补到本系统首音 */
  const timedAnswerEvents = answer.events.map((event, index) => (
    index > 0 && answer.events[index - 1].tieToNext ? { ...event, tieFromPrevious: true } : event
  ));

  return <View style={styles.editor}>
    <View style={styles.choiceLine}><Text style={[styles.choiceLabel, ink && styles.choiceLabelInk]}>拍号</Text><View style={styles.options}>{METERS.map((meter) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: answer.meter === meter, disabled: !canEdit }} key={meter} disabled={!canEdit} onPress={() => selectMeter(meter)} style={[styles.choice, ink && styles.choiceInk, answer.meter === meter && (ink ? styles.choiceActiveInk : styles.choiceActive)]}><Text style={[styles.choiceText, ink && styles.choiceTextInk, answer.meter === meter && styles.choiceTextActive]}>{meter}</Text></Pressable>)}</View></View>
    {isMelody && <View style={styles.choiceLine}><Text style={[styles.choiceLabel, ink && styles.choiceLabelInk]}>调号</Text><View style={styles.options}>{KEYS.map((key) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: answer.keySignature === key.value, disabled: !canEdit }} key={key.value} disabled={!canEdit} onPress={() => selectKey(key.value)} style={[styles.choice, styles.keyChoice, ink && styles.choiceInk, answer.keySignature === key.value && (ink ? styles.choiceActiveInk : styles.choiceActive)]}><Text style={[styles.choiceText, ink && styles.choiceTextInk, answer.keySignature === key.value && styles.choiceTextActive]}>{key.label}</Text></Pressable>)}</View></View>}
    {canEdit && <><View style={[styles.durationToolbar, ink && styles.durationToolbarInk]}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationRow}>{DURATION_OPTIONS.map((item) => { const selected = Math.abs(duration - item.value) < 1e-6; return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} key={item.label} onPress={() => setDuration(item.value)} style={[styles.durationChoice, ink && styles.durationChoiceInk, selected && (ink ? styles.choiceActiveInk : styles.choiceActive)]}><Text style={[styles.durationText, ink && styles.durationTextInk, selected && styles.choiceTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rest }} onPress={toggleRest} style={[styles.restChoice, ink && styles.restChoiceInk, rest && (ink ? styles.restActiveInk : styles.restActive)]}><Text style={[styles.restText, ink && styles.restTextInk, rest && styles.choiceTextActive]}>{rest ? '休止符开启' : '写休止符'}</Text></Pressable>{!isMelody && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: tie }} onPress={toggleTie} style={[styles.restChoice, ink && styles.restChoiceInk, tie && (ink ? styles.restActiveInk : styles.restActive)]}><Text style={[styles.restText, ink && styles.restTextInk, tie && styles.choiceTextActive]}>{tie ? '连音线开启' : '写连音线'}</Text></Pressable>}</View><View style={styles.helpRow}><Text style={[styles.helpText, ink && styles.helpTextInk]}>选择时值后，依次点击谱面写入</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: !answer.events.length }} hitSlop={hitSlopFor(Btn.practice.undoLink.minHeight)} onPress={undo} disabled={!answer.events.length} style={[styles.undoButton, ink && styles.undoButtonInk]}><Text style={[styles.undoText, ink && styles.undoTextInk]}>撤销</Text></Pressable></View></>}
    {selectedOrder !== null && canEdit && isMelody && <View style={[styles.accidentalMenu, ink && styles.accidentalMenuInk]}><Text style={[styles.accidentalLabel, ink && styles.choiceLabelInk]}>临时记号</Text>{([['', '无'], ['#', '♯'], ['b', '♭'], ['n', '♮'], ['erase', '擦除']] as const).map(([value, label]) => <Pressable accessibilityRole="button" accessibilityLabel={label === '擦除' ? '擦除所选音符' : `临时记号${label}`} key={label} onPress={() => updateSelected(value)} style={[styles.accidentalButton, ink && styles.accidentalButtonInk]}><Text style={[styles.accidentalText, ink && styles.accidentalTextInk]}>{label}</Text></Pressable>)}</View>}
    {Array.from({ length: systems }, (_, systemIndex) => {
      const barOffset = systemIndex * 2;
      const systemBarCount = Math.min(2, barCount - barOffset);
      const systemEvents = timedAnswerEvents.filter((event) => Number(event.barIndex) >= barOffset && Number(event.barIndex) < barOffset + systemBarCount);
      const correctEvents = targetBars.slice(barOffset, barOffset + systemBarCount).flatMap((bar, localBar) => bar.map((event, index) => ({ ...event, barIndex: barOffset + localBar, inputOrder: index + 1 })));
      return <View key={systemIndex} style={styles.systemCard}><View style={styles.systemHead}><Text style={[styles.systemLabel, ink && styles.systemLabelInk]}>第 {barOffset + 1}-{barOffset + systemBarCount} 小节</Text><Text style={[styles.systemBeat, ink && styles.systemBeatInk]}>已写 {roundBeats(sumDuration(systemEvents) * meterBeatScale(answer.meter))} 拍</Text></View><TimedAnswerStaff events={systemEvents} meter={systemIndex === 0 ? answer.meter : ''} capacityMeter={answer.meter} keySignature={isMelody ? answer.keySignature : ''} barOffset={barOffset} barCount={systemBarCount} isFinalSystem={systemIndex === systems - 1} disabled={!canEdit || !answer.meter || (isMelody && !answer.keySignature)} ink={ink} tone={disabled ? reviewCorrect ? 'green' : 'red' : ''} emptyText={emptyText} onStaffTap={(barIndex, midi, spelling) => append(barIndex, midi, spelling)} onEventTap={(event) => setSelectedOrder(Number(event.inputOrder))} />{showCorrect && !reviewCorrect && <View style={styles.standardBlock}><Text style={styles.standardLabel}>{systemIndex === 0 ? `标准答案：${String(question.meter)}${isMelody ? ` · ${String(question.keyName || question.keySignature)}` : ''}` : '标准答案'}</Text><TimedAnswerStaff events={correctEvents} meter={systemIndex === 0 ? String(question.meter || '') : ''} capacityMeter={String(question.meter || '')} keySignature={isMelody ? String(question.keySignature || 'C') : ''} barOffset={barOffset} barCount={systemBarCount} isFinalSystem={systemIndex === systems - 1} disabled ink={ink} tone="green" emptyText="" /></View>}</View>;
    })}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  editor: { gap: 12 }, /** 小程序 .choice-line（margin 12rpx 2rpx）/ .choice-pills（gap 8rpx） */
  choiceLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, /** 小程序 .choice-label（width 68rpx / padding-top 9rpx / 20rpx） */
  choiceLabel: { width: 34, paddingTop: 4.5, color: Brand.muted, fontSize: Btn.practice.choicePill.fontSize, fontWeight: '700' }, options: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  /** 小程序 .choice-pill（min-width 70rpx / 8 13rpx / 13rpx / 20rpx）—— 芯片仅隔 4rpx，不加 hitSlop 以免抢邻键 */
  choice: { ...Btn.practice.choicePill, alignItems: 'center', justifyContent: 'center', borderColor: Brand.border, backgroundColor: '#F3F5F2' }, /** 小程序 .key-pill min-width 148rpx */
  keyChoice: { minWidth: Btn.practice.keyPill.minWidth }, choiceActive: { borderColor: Brand.forest, backgroundColor: Brand.forest }, choiceText: { color: Brand.muted, fontSize: Btn.practice.choicePill.fontSize, fontWeight: '700' }, choiceTextActive: { color: Brand.textOnAccent },
  /** 小程序 .duration-toolbar（gap 10rpx / padding 10rpx / 17rpx）+ .duration-row（gap 8rpx） */
  durationToolbar: { flexDirection: 'row', ...Btn.practice.durationToolbar, backgroundColor: '#EEE7D8' }, durationRow: { gap: 4, paddingRight: 4 }, /** 小程序 .duration-pill（min-width 96rpx / height 52rpx / 0 11rpx / 13rpx / 19rpx） */
  durationChoice: { ...Btn.practice.durationPill, alignItems: 'center', justifyContent: 'center', borderColor: Brand.border, backgroundColor: Brand.ivory }, durationText: { color: Brand.muted, fontSize: Btn.practice.durationPill.fontSize, fontWeight: '700' },
  /** 小程序 .rest-pill（112 × 52rpx / 13rpx / 18rpx） */
  restChoice: { ...Btn.practice.restPill, alignItems: 'center', justifyContent: 'center', borderColor: '#DEC476', backgroundColor: Brand.warningSoft }, restActive: { borderColor: Brand.gold, backgroundColor: Brand.gold }, restText: { color: Brand.warning, fontSize: Btn.practice.restPill.fontSize, fontWeight: '800' },
  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 3 }, /** 小程序 .timed-help 19rpx */ helpText: { flex: 1, color: Brand.muted, fontSize: 9.5 }, /** 小程序 .undo-link（8 13rpx / 13rpx / 20rpx），右侧独立无邻键 → 补满 44pt */ undoButton: { ...Btn.practice.undoLink, alignItems: 'center', justifyContent: 'center', marginLeft: 8, backgroundColor: Brand.forestSoft }, undoText: { color: Brand.forest, fontSize: Btn.practice.undoLink.fontSize, fontWeight: '800' },
  /** 小程序的临时记号只有谱面字形浮层，没有带文字的记号行 → 就近取 .duration-toolbar 容器盒 + .choice-pill 芯片盒 */
  accidentalMenu: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', ...Btn.practice.durationToolbar, backgroundColor: '#F3F5F2' }, accidentalLabel: { marginHorizontal: 4, color: Brand.muted, fontSize: Btn.practice.choicePill.fontSize, fontWeight: '700' }, accidentalButton: { ...Btn.practice.choicePill, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.forestSoft }, accidentalText: { color: Brand.forest, fontSize: Btn.practice.choicePill.fontSize, fontWeight: '800' },
  systemCard: { gap: 8, marginTop: 3 }, systemHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 }, systemLabel: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' }, systemBeat: { color: Brand.muted, fontSize: TypeScale.caption, fontVariant: ['tabular-nums'] },
  /** 小程序 .answer-staff-shell：height 140rpx / border 1rpx / radius 12rpx（1:1 → 70pt / 0.5pt / 6pt） */
  staffShell: { height: ANSWER_STAFF_HEIGHT, overflow: 'hidden', borderWidth: STAFF_SHELL_BORDER * RPX_TO_PT, borderRadius: STAFF_SHELL_RADIUS, borderColor: Brand.border, backgroundColor: '#FFFFFF' },
  /** 命中层 = 壳体内容盒（壳宽 − 2×1rpx），viewBox 用它换算 ⇒ 1 单位恒等于 0.5pt */
  staffTouch: { height: ANSWER_STAFF_HEIGHT, borderRadius: STAFF_SHELL_RADIUS, overflow: 'hidden' },
  inkStaff: { borderColor: '#141414' }, wrongStaff: { borderColor: '#DDAAA1', backgroundColor: '#FFF9F7' }, correctStaff: { borderColor: '#9FCBB1', backgroundColor: '#F8FFFA' },
  /** 小程序 .staff-notation .empty：left/right 0、top 31rpx、height 60rpx、font-size 20rpx，文字在其中居中 */
  emptyText: { position: 'absolute', left: 0, right: 0, top: EMPTY_TOP * RPX_TO_PT, height: EMPTY_HEIGHT * RPX_TO_PT, color: Brand.muted, fontSize: EMPTY_FONT_SIZE * RPX_TO_PT, lineHeight: EMPTY_HEIGHT * RPX_TO_PT, textAlign: 'center' },
  standardBlock: { gap: 7, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#B9DACC', borderStyle: 'dashed' }, standardLabel: { color: Brand.success, fontSize: TypeScale.caption, fontWeight: '800' }, error: { color: Brand.danger, fontSize: TypeScale.footnote, lineHeight: 18 },
  choiceInk: { borderColor: '#141414', backgroundColor: '#FFFFFF' }, choiceActiveInk: { borderColor: '#141414', backgroundColor: '#141414' }, choiceTextInk: { color: '#141414' },
  durationChoiceInk: { borderColor: '#141414', backgroundColor: '#FFFFFF' }, durationTextInk: { color: '#141414' },
  restChoiceInk: { borderColor: '#141414', backgroundColor: '#FFFFFF' }, restActiveInk: { borderColor: '#141414', backgroundColor: '#141414' }, restTextInk: { color: '#141414' },
  undoButtonInk: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#141414' }, undoTextInk: { color: '#141414' },
  accidentalButtonInk: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#141414' }, accidentalTextInk: { color: '#141414' },
  choiceLabelInk: { color: '#141414' }, helpTextInk: { color: '#141414' },
  durationToolbarInk: { backgroundColor: '#F2F2F2' }, accidentalMenuInk: { backgroundColor: '#F2F2F2' },
  systemLabelInk: { color: '#141414' }, systemBeatInk: { color: '#141414' },
});
