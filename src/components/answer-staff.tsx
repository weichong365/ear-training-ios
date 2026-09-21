import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { StaffNotation } from '@/components/staff-notation';
import { Btn } from '@/constants/button-tokens';
import { Brand, Shadows, TypeScale } from '@/constants/theme';
import { defaultPitchSpelling, naturalMidiForPitchSpelling } from '@/core/pitch-spelling';
import { buildStaffGeometry } from '@/core/staff-notation-geometry';
import {
  DEFAULT_STAFF_WIDTH_RPX,
  EMPTY_FONT_SIZE,
  EMPTY_HEIGHT,
  EMPTY_TOP,
  RPX_TO_PT,
  STAFF_HEIGHT_RPX,
  STAFF_SHELL_BORDER,
  STAFF_SHELL_RADIUS,
  type StaffEvent,
} from '@/core/staff-layout';
import { ANSWER_STAFF_HEIGHT, naturalMidiFromStaffSvgY, staffViewBoxWidth } from '@/core/staff-coordinate';

/**
 * 五线谱答题区域 —— 绘制与标注逻辑全部交给 @/components/staff-notation
 * （小程序 components/staff-notation 的 1:1 移植），本文件只保留命中/拖动/临时记号浮层。
 *   · viewBox 用 rpx（0 0 实测宽 140），画布高 70pt ⇒ 1 单位 = 0.5pt；
 *   · 命中容差 42/20rpx、分栏 58rpx、正确谱面右移 80rpx，全部照搬小程序 answer-staff.js/wxss；
 *   · 调号已含的升降号不重复标注、被调号改变的自然音画还原号（在 staff-notation 内统一处理）。
 */

const DOUBLE_TAP_MS = 320;
/** 可写音域 G3–A5，与小程序 answer-staff.js 的 MIN_STEP/MAX_STEP 一致 */
const MIN_MIDI = 55;
const MAX_MIDI = 81;
/** .answer-hit-layer left: 58rpx —— 分栏命中区的基准点 */
const SLOT_HIT_LEFT = 58;
/** .answer-correct-overlay-separated translateX(80rpx) */
const SEPARATE_CORRECT_DX = 80;
/** closestTarget 容差（rpx）：固定双小节谱面里符头左侧可能被小节线/临时记号占用 */
const TAP_DX = 42;
const TAP_DY = 20;
/** 浮层菜单实测宽（rpx），首帧给个保守值 */
const MENU_FALLBACK_WIDTH_RPX = 156;

/** @deprecated 小程序答题谱只有 140rpx 一种尺寸；保留 prop 仅为兼容既有调用。 */
type AnswerStaffProps = {
  compact?: boolean;
  pitches: number[];
  spellings?: string[];
  slots?: number;
  stacked?: boolean;
  maxStack?: number;
  disabled?: boolean;
  ink?: boolean;
  tone?: 'red' | 'green' | '';
  correctPitches?: number[];
  correctSpellings?: string[];
  showCorrect?: boolean;
  /** 小程序 separate-correct：正确谱面整体右移 80rpx（和弦/和声音程用） */
  separateCorrect?: boolean;
  /** 结束时画双小节线（小程序 .endline，answer-staff 的 last） */
  last?: boolean;
  keySignature?: string;
  meter?: string;
  barCount?: number;
  emptyText?: string;
  onChange?: (pitches: number[], spellings: string[]) => void;
  onDragChange?: (dragging: boolean) => void;
};

type Target = { index: number; slot: number; x: number; y: number; midi: number; spelling: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export const AnswerStaff = memo(function AnswerStaff({
  pitches,
  spellings = [],
  slots = 1,
  stacked = false,
  maxStack = 1,
  disabled = false,
  ink = false,
  tone = '',
  correctPitches = [],
  correctSpellings = [],
  showCorrect = false,
  separateCorrect = false,
  last = false,
  keySignature = '',
  meter = '',
  barCount = 0,
  emptyText = '点击五线谱写入音符',
  onChange,
  onDragChange,
}: AnswerStaffProps) {
  const [menuTarget, setMenuTarget] = useState<{ index: number; x: number; y: number } | null>(null);
  const [menuWidth, setMenuWidth] = useState(MENU_FALLBACK_WIDTH_RPX);
  const [layout, setLayout] = useState({ width: 0, height: ANSWER_STAFF_HEIGHT });
  const gesture = useRef<{ target: Target | null; slot: number; startY: number; moved: boolean } | null>(null);
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ index: number; time: number } | null>(null);
  const latest = useRef({ pitches, spellings });
  latest.current = { pitches, spellings };

  useEffect(() => () => {
    if (pendingTap.current) clearTimeout(pendingTap.current);
  }, []);

  /** 实际容器宽 → viewBox 宽（rpx）。与小程序「绝对 rpx 定位 + 容器 100% 宽」等价。 */
  const viewBoxWidth = staffViewBoxWidth(layout.width);

  /** 参与排布的事件：NaN 槽位不参与，但保留原槽位号（小程序 sequenceEvents） */
  const events: StaffEvent[] = useMemo(() => {
    const filled = pitches
      .map((midi, index) => ({ midi, index }))
      .filter((item) => isFiniteNumber(item.midi));
    if (stacked) return filled.length ? [{ midis: filled.map((item) => item.midi), dur: 4, inputSlot: 0 }] : [];
    return filled.map((item) => ({ midis: [item.midi], dur: 4, inputSlot: item.index }));
  }, [pitches, stacked]);

  /** 正确谱面：小程序 answer-staff 的 correct-events 叠层（symbols-only + 可选右移 80rpx） */
  const correctEvents: StaffEvent[] = useMemo(() => {
    const filled = correctPitches
      .map((midi, index) => ({ midi, index }))
      .filter((item) => isFiniteNumber(item.midi));
    if (stacked) {
      return filled.length
        ? [{ midis: filled.map((item) => item.midi), spellings: filled.map((item) => correctSpellings[item.index] || ''), dur: 4, inputSlot: 0 }]
        : [];
    }
    return filled.map((item) => ({
      midis: [item.midi],
      spellings: correctSpellings[item.index] ? [correctSpellings[item.index]] : [],
      dur: 4,
      inputSlot: item.index,
    }));
  }, [correctPitches, correctSpellings, stacked]);

  /**
   * 几何单源：音符中心 / 临时记号 / 加线 / 命中锚点全部来自 staff-notation 的 rpx 布局，
   * 与小程序 answer-staff.js hitTargets(horizontal.centers + dx) 逐值一致。
   */
  const geometry = useMemo(
    () => buildStaffGeometry(events, { width: DEFAULT_STAFF_WIDTH_RPX, meter, beamMeter: meter, keySignature, barCount, answerSlots: stacked ? 1 : slots }),
    [events, keySignature, meter, barCount, slots, stacked],
  );

  /** NaN 槽位不参与排布，但保留原槽位号（小程序 sequenceEvents 的 inputSlot） */
  const filledSlots = useMemo(
    () => pitches.map((midi, index) => ({ midi, index })).filter((item) => isFiniteNumber(item.midi)),
    [pitches],
  );

  const targets: Target[] = geometry.targets.map((target) => {
    const entry = stacked ? filledSlots[target.noteIndex] : filledSlots[target.eventIndex];
    const index = entry ? entry.index : target.noteIndex;
    return {
      index,
      slot: stacked ? 0 : index,
      x: target.x,
      y: target.y,
      midi: target.midi,
      spelling: spellings[index] || target.spelling || defaultPitchSpelling(target.midi),
    };
  });

  function viewBoxPoint(event: GestureResponderEvent, width: number, height: number) {
    const native = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number; offsetY?: number };
    return {
      x: Number(native.locationX ?? native.offsetX ?? width / 2) * viewBoxWidth / Math.max(1, width),
      y: Number(native.locationY ?? native.offsetY ?? height / 2) * STAFF_HEIGHT_RPX / Math.max(1, height),
    };
  }

  function slotFromX(x: number) {
    const span = (viewBoxWidth - SLOT_HIT_LEFT) / Math.max(1, slots);
    return Math.max(0, Math.min(slots - 1, Math.floor((x - SLOT_HIT_LEFT) / Math.max(1, span))));
  }

  function closestTarget(x: number, y: number) {
    return targets.reduce<{ target: Target | null; distance: number }>((best, target) => {
      const dx = Math.abs(target.x - x);
      const dy = Math.abs(target.y - y);
      if (dx > TAP_DX || dy > TAP_DY) return best;
      const value = dx * dx + dy * dy * 2;
      return value < best.distance ? { target, distance: value } : best;
    }, { target: null, distance: Infinity }).target;
  }

  function noteFromY(y: number) {
    const naturalMidi = naturalMidiFromStaffSvgY(y, MIN_MIDI, MAX_MIDI);
    const natural = defaultPitchSpelling(naturalMidi);
    if (keySignature === 'G' && natural.startsWith('F')) return { midi: naturalMidi + 1, spelling: natural.replace('F', 'F#') };
    if (keySignature === 'F' && natural.startsWith('B')) return { midi: naturalMidi - 1, spelling: natural.replace('B', 'Bb') };
    return { midi: naturalMidi, spelling: natural };
  }

  function replaceNote(index: number, midi: number, spelling: string) {
    const nextPitches = latest.current.pitches.slice();
    const nextSpellings = latest.current.spellings.slice();
    nextPitches[index] = midi;
    nextSpellings[index] = spelling;
    onChange?.(nextPitches, nextSpellings);
  }

  function erase(index: number) {
    if (stacked) {
      onChange?.(latest.current.pitches.filter((_, itemIndex) => itemIndex !== index), latest.current.spellings.filter((_, itemIndex) => itemIndex !== index));
      return;
    }
    const nextPitches = latest.current.pitches.slice();
    const nextSpellings = latest.current.spellings.slice();
    delete nextPitches[index];
    delete nextSpellings[index];
    onChange?.(nextPitches, nextSpellings);
  }

  function write(slot: number, y: number) {
    const note = noteFromY(y);
    if (stacked) {
      const existing = latest.current.pitches.indexOf(note.midi);
      if (existing >= 0) return erase(existing);
      if (latest.current.pitches.filter(isFiniteNumber).length >= maxStack) return;
      const filled = latest.current.pitches.flatMap((midi, index) => (isFiniteNumber(midi)
        ? [{ midi, spelling: latest.current.spellings[index] || defaultPitchSpelling(midi) }] : []));
      onChange?.([...filled.map((value) => value.midi), note.midi], [...filled.map((value) => value.spelling), note.spelling]);
      return;
    }
    replaceNote(Math.max(0, slot), note.midi, note.spelling);
  }

  function onGrant(event: GestureResponderEvent) {
    if (disabled) return;
    setMenuTarget(null);
    const point = viewBoxPoint(event, layout.width, layout.height);
    const slot = stacked ? 0 : slotFromX(point.x);
    const precise = closestTarget(point.x, point.y);
    const region = !stacked && slots > 1 ? targets.find((target) => target.slot === slot) || null : null;
    gesture.current = { target: precise || region, slot, startY: point.y, moved: false };
  }

  function onMove(event: GestureResponderEvent) {
    const current = gesture.current;
    if (!current?.target || disabled) return;
    const point = viewBoxPoint(event, layout.width, layout.height);
    if (Math.abs(point.y - current.startY) < 4) return;
    if (!current.moved) onDragChange?.(true);
    current.moved = true;
    const note = noteFromY(point.y);
    replaceNote(current.target.index, note.midi, note.spelling);
  }

  function onRelease(event: GestureResponderEvent) {
    const current = gesture.current;
    gesture.current = null;
    onDragChange?.(false);
    if (!current || disabled || current.moved) return;
    const point = viewBoxPoint(event, layout.width, layout.height);
    const target = closestTarget(point.x, point.y);
    if (!target) return write(current.slot, point.y);
    const now = Date.now();
    if (lastTap.current?.index === target.index && now - lastTap.current.time <= DOUBLE_TAP_MS) {
      if (pendingTap.current) clearTimeout(pendingTap.current);
      pendingTap.current = null;
      lastTap.current = null;
      setMenuTarget(null);
      erase(target.index);
      return;
    }
    lastTap.current = { index: target.index, time: now };
    if (pendingTap.current) clearTimeout(pendingTap.current);
    pendingTap.current = setTimeout(() => {
      setMenuTarget({ index: target.index, x: target.x, y: target.y });
      pendingTap.current = null;
    }, DOUBLE_TAP_MS);
  }

  function onTerminate() {
    gesture.current = null;
    onDragChange?.(false);
  }

  function chooseAccidental(value: '' | '#' | 'b' | 'n') {
    if (!menuTarget || disabled) return;
    const midi = latest.current.pitches[menuTarget.index];
    const naturalMidi = naturalMidiForPitchSpelling(midi, latest.current.spellings[menuTarget.index]);
    const base = defaultPitchSpelling(naturalMidi);
    const offset = value === '#' ? 1 : value === 'b' ? -1 : 0;
    replaceNote(menuTarget.index, naturalMidi + offset, value ? base.replace(/^([A-G])/, `$1${value}`) : base);
    setMenuTarget(null);
  }

  /** 小程序 .answer-slot 的分隔虚线：整壳高、2rpx、容器等分 */
  const slotDividers = Array.from({ length: Math.max(0, slots - 1) }, (_, index) => (
    SLOT_HIT_LEFT + (index + 1) * (viewBoxWidth - SLOT_HIT_LEFT) / Math.max(1, slots)
  ));

  const menuLeft = menuTarget
    ? Math.max(60, Math.min(viewBoxWidth - menuWidth, menuTarget.x - menuWidth / 2)) * RPX_TO_PT
    : 0;
  const menuTop = menuTarget
    ? Math.max(4, Math.min(48, menuTarget.y > 48 ? menuTarget.y - 46 : menuTarget.y + 12)) * RPX_TO_PT
    : 0;

  return (
    <View style={[styles.shell, ink && styles.inkShell, tone === 'red' && styles.wrongShell, tone === 'green' && styles.correctShell]}>
      <View
        style={styles.touchArea}
        onLayout={(event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminationRequest={() => false}
        onResponderTerminate={onTerminate}
        accessibilityRole={disabled ? 'image' : 'button'}
        accessibilityState={disabled ? undefined : { disabled: false }}
        accessibilityLabel={disabled ? '五线谱谱面' : '五线谱答题区域'}>
        {/* 谱号/调号/拍号/谱线/小节线 + 考生答案：与小程序 staff-notation 逐值同源 */}
        <StaffNotation
          events={events}
          viewBoxWidth={viewBoxWidth}
          width={DEFAULT_STAFF_WIDTH_RPX}
          meter={meter}
          beamMeter={meter}
          keySignature={keySignature}
          barCount={barCount}
          answerSlots={stacked ? 1 : slots}
          tone={tone}
          ink={ink}
          last={last}
          slotDividers={disabled ? [] : slotDividers}
        />
        {/* 正确谱面叠层：symbols-only（只画音符层）+ 和弦/和声音程右移 80rpx */}
        {showCorrect && (
          <StaffNotation
            events={correctEvents}
            viewBoxWidth={viewBoxWidth}
            width={DEFAULT_STAFF_WIDTH_RPX}
            meter={meter}
            beamMeter={meter}
            keySignature={keySignature}
            barCount={barCount}
            answerSlots={stacked ? 1 : slots}
            tone="green"
            symbolsOnly
            offsetX={separateCorrect ? SEPARATE_CORRECT_DX : 0}
          />
        )}
        {!pitches.some(isFiniteNumber) && <Text pointerEvents="none" style={styles.emptyText}>{emptyText}</Text>}
      </View>
      {menuTarget && !disabled && (
        <View onLayout={(event: LayoutChangeEvent) => setMenuWidth(event.nativeEvent.layout.width / RPX_TO_PT)} style={[styles.menu, { left: menuLeft, top: menuTop }]}>
          <Text style={styles.menuLabel}>临时记号</Text>
          {([['', '无'], ['b', '♭'], ['n', '♮'], ['#', '♯']] as const).map(([value, label]) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`临时记号${label}`} hitSlop={Btn.staff.accidentalHitSlop} key={label} onPress={() => chooseAccidental(value)} style={styles.menuButton}><Text style={styles.menuButtonText}>{label}</Text></Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  /** 小程序 .answer-staff-shell：1rpx solid #d9dde8 / radius 12rpx（1:1 → 0.5pt / 6pt） */
  shell: { overflow: 'visible', borderRadius: STAFF_SHELL_RADIUS, borderWidth: STAFF_SHELL_BORDER * RPX_TO_PT, borderColor: '#D9DDE8', backgroundColor: '#FFFFFF' },
  inkShell: { borderColor: '#141414' },
  wrongShell: { borderColor: '#D76B77', backgroundColor: '#FFFAFA' },
  correctShell: { borderColor: '#55A891', backgroundColor: '#FBFFFD' },
  /** 命中层 = 壳体内容盒（壳宽 − 2×1rpx）：viewBox 由它换算 ⇒ 1 单位恒等于 0.5pt */
  touchArea: { height: ANSWER_STAFF_HEIGHT, overflow: 'hidden', borderRadius: STAFF_SHELL_RADIUS },
  // 小程序 .staff-notation .empty：left/right 0、top 31rpx、height 60rpx、font-size 20rpx
  emptyText: { position: 'absolute', left: 0, right: 0, top: EMPTY_TOP * RPX_TO_PT, height: EMPTY_HEIGHT * RPX_TO_PT, color: Brand.muted, fontSize: EMPTY_FONT_SIZE * RPX_TO_PT, lineHeight: EMPTY_HEIGHT * RPX_TO_PT, textAlign: 'center', pointerEvents: 'none' },
  // 小程序 .accidental-menu（44rpx 高 / padding 4rpx / gap 4rpx / 10rpx / 1rpx 描边）
  menu: { position: 'absolute', zIndex: 5, flexDirection: 'row', alignItems: 'center', ...Btn.staff.accidentalMenu, backgroundColor: Brand.ivory, borderColor: Brand.border, borderWidth: Btn.staff.accidentalMenu.borderWidth, ...Shadows.floating },
  /** 小程序浮层没有标题；App 保留「临时记号」标签做可读性，行高小于芯片高，不撑高菜单 */
  menuLabel: { marginHorizontal: 4, color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  // 小程序 .accidental-choice（46 × 34rpx / 7rpx）
  menuButton: { ...Btn.staff.accidentalChoice, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.forestSoft },
  menuButtonText: { color: Brand.forest, ...Btn.staff.accidentalGlyph, fontWeight: '800' },
});
