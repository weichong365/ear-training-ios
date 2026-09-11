import { memo, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line } from 'react-native-svg';

import { Brand, Radius, Shadows, TouchTarget, TypeScale } from '@/constants/theme';
import { MusicAccidental, MusicNotehead } from '@/components/music-glyphs';
import { accidentalColumns, barlineBounds, chordHeadOffsets, ledgerLineYs, STAFF_LINE_YS, STAFF_MIDDLE_LINE_Y, STAFF_STROKE_WIDTH } from '@/core/music-notation';
import { accidentalGlyphForPitch, defaultPitchSpelling, naturalMidiForPitchSpelling } from '@/core/pitch-spelling';
import { naturalMidiFromStaffTapY, staffSvgYFromWrittenMidi } from '@/core/staff-coordinate';

const STAFF_HEIGHT = 122;
const DOUBLE_TAP_MS = 320;
const STAFF_CENTER_Y = STAFF_MIDDLE_LINE_Y * STAFF_HEIGHT / 96;
function naturalSpelling(midi: number) {
  return defaultPitchSpelling(midi);
}

function noteFromY(y: number, keySignature: string) {
  const naturalMidi = naturalMidiFromStaffTapY(y, STAFF_HEIGHT, 55, 81);
  const natural = naturalSpelling(naturalMidi);
  if (keySignature === 'G' && natural.startsWith('F')) return { midi: naturalMidi + 1, spelling: natural.replace('F', 'F#') };
  if (keySignature === 'F' && natural.startsWith('B')) return { midi: naturalMidi - 1, spelling: natural.replace('B', 'Bb') };
  return { midi: naturalMidi, spelling: natural };
}

function writtenMidi(midi: number, spelling?: string) {
  return naturalMidiForPitchSpelling(midi, spelling);
}

function accidentalGlyph(midi: number, spelling?: string) {
  return accidentalGlyphForPitch(midi, spelling);
}

function pressPoint(event: GestureResponderEvent, width: number, height: number) {
  const native = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number; offsetY?: number };
  return {
    x: Number(native.locationX ?? native.offsetX ?? width / 2) * 320 / Math.max(1, width),
    y: Number(native.locationY ?? native.offsetY ?? height / 2) * STAFF_HEIGHT / Math.max(1, height),
  };
}

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
  keySignature?: string;
  emptyText?: string;
  onChange?: (pitches: number[], spellings: string[]) => void;
  onDragChange?: (dragging: boolean) => void;
};

type Target = { index: number; slot: number; x: number; y: number; midi: number; spelling: string };

export const AnswerStaff = memo(function AnswerStaff({
  compact = false,
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
  keySignature = '',
  emptyText = '点击五线谱写入音符',
  onChange,
  onDragChange,
}: AnswerStaffProps) {
  const [menuTarget, setMenuTarget] = useState<number | null>(null);
  const [layout, setLayout] = useState({ width: 320, height: STAFF_HEIGHT });
  const gesture = useRef<{ target: Target | null; slot: number; startY: number; moved: boolean } | null>(null);
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ index: number; time: number } | null>(null);
  const latest = useRef({ pitches, spellings });
  latest.current = { pitches, spellings };

  useEffect(() => () => {
    if (pendingTap.current) clearTimeout(pendingTap.current);
  }, []);

  const noteX = (index: number, values = pitches, valueSpellings = spellings) => {
    if (stacked) {
      const writtenValues = values.map((midi, valueIndex) => writtenMidi(midi, valueSpellings[valueIndex]));
      return 166 + chordHeadOffsets(writtenValues)[index];
    }
    const slot = Math.min(Math.max(0, index), Math.max(0, slots - 1));
    return 76 + ((slot + 0.5) / Math.max(1, slots)) * 224;
  };
  const targets: Target[] = pitches.flatMap((midi, index) => Number.isFinite(midi) ? [{
    index,
    slot: stacked ? 0 : index,
    x: noteX(index),
    y: staffSvgYFromWrittenMidi(writtenMidi(midi, spellings[index])) * STAFF_HEIGHT / 96,
    midi,
    spelling: spellings[index] || defaultPitchSpelling(midi),
  }] : []);

  function closestTarget(x: number, y: number) {
    return targets.reduce<{ target: Target | null; distance: number }>((best, target) => {
      const dx = Math.abs(target.x - x);
      const dy = Math.abs(target.y - y);
      if (dx > 42 || dy > 24) return best;
      const value = dx * dx + dy * dy * 2;
      return value < best.distance ? { target, distance: value } : best;
    }, { target: null, distance: Infinity }).target;
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
    const note = noteFromY(y, keySignature);
    if (stacked) {
      const existing = latest.current.pitches.indexOf(note.midi);
      if (existing >= 0) return erase(existing);
      if (latest.current.pitches.filter(Number.isFinite).length >= maxStack) return;
      onChange?.([...latest.current.pitches, note.midi], [...latest.current.spellings, note.spelling]);
      return;
    }
    replaceNote(Math.max(0, slot), note.midi, note.spelling);
  }

  function onGrant(event: GestureResponderEvent) {
    if (disabled) return;
    setMenuTarget(null);
    const point = pressPoint(event, layout.width, layout.height);
    const slot = stacked ? 0 : Math.max(0, Math.min(slots - 1, Math.floor((point.x - 76) / (224 / Math.max(1, slots)))));
    const precise = closestTarget(point.x, point.y);
    const region = !stacked && slots > 1 ? targets.find((target) => target.slot === slot) || null : null;
    gesture.current = { target: precise || region, slot, startY: point.y, moved: false };
  }

  function onMove(event: GestureResponderEvent) {
    const current = gesture.current;
    if (!current?.target || disabled) return;
    const point = pressPoint(event, layout.width, layout.height);
    if (Math.abs(point.y - current.startY) < 4) return;
    if (!current.moved) onDragChange?.(true);
    current.moved = true;
    const note = noteFromY(point.y, keySignature);
    replaceNote(current.target.index, note.midi, note.spelling);
  }

  function onRelease(event: GestureResponderEvent) {
    const current = gesture.current;
    gesture.current = null;
    onDragChange?.(false);
    if (!current || disabled || current.moved) return;
    const point = pressPoint(event, layout.width, layout.height);
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
      setMenuTarget(target.index);
      pendingTap.current = null;
    }, DOUBLE_TAP_MS);
  }

  function onTerminate() {
    gesture.current = null;
    onDragChange?.(false);
  }

  function chooseAccidental(value: '' | '#' | 'b' | 'n') {
    if (menuTarget === null || disabled) return;
    const midi = latest.current.pitches[menuTarget];
    const naturalMidi = naturalMidiForPitchSpelling(midi, latest.current.spellings[menuTarget]);
    const base = naturalSpelling(naturalMidi);
    const offset = value === '#' ? 1 : value === 'b' ? -1 : 0;
    replaceNote(menuTarget, naturalMidi + offset, value ? base.replace(/^([A-G])/, `$1${value}`) : base);
    setMenuTarget(null);
  }

  const activeColor = tone === 'green' ? '#2e8b6f' : tone === 'red' ? Brand.danger : ink ? '#141414' : Brand.ink;
  const barline = barlineBounds();
  const renderNotes = (values: number[], valueSpellings: string[], color: string, offset = 0) => {
    const writtenValues = values.map((midi, index) => writtenMidi(midi, valueSpellings[index]));
    const accidentalColumn = accidentalColumns(writtenValues);
    return values.map((midi, index) => {
    if (!Number.isFinite(midi)) return null;
    const spelling = valueSpellings[index];
    const written = writtenValues[index];
    const x = noteX(index, values, valueSpellings) + offset;
    const y = staffSvgYFromWrittenMidi(written);
    const glyph = accidentalGlyph(midi, spelling);
    return <G key={`${color}-${midi}-${index}`}>
      {ledgerLineYs(written).map((ledgerY) => <Line key={`ledger-${ledgerY}`} x1={x - 11} x2={x + 11} y1={ledgerY} y2={ledgerY} stroke={color} strokeWidth={STAFF_STROKE_WIDTH} />)}
      {!!glyph && <MusicAccidental x={x - 15 - accidentalColumn[index] * 9} y={y} glyph={glyph} color={color} />}
      <MusicNotehead x={x} y={y} kind="whole" color={color} />
    </G>;
    });
  };

  return (
    <View style={[styles.shell, ink && styles.inkShell, tone === 'red' && styles.wrongShell, tone === 'green' && styles.correctShell]}>
      <View
        style={[styles.touchArea, compact && styles.compactTouchArea]}
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
        <Svg viewBox="0 0 320 96" preserveAspectRatio="none" width="100%" height="100%">
          {STAFF_LINE_YS.map((y) => <Line key={y} x1="16" x2="308" y1={y} y2={y} stroke={ink ? '#141414' : '#596169'} strokeWidth={STAFF_STROKE_WIDTH} />)}
          {Array.from({ length: Math.max(1, slots) - 1 }, (_, index) => (
            <Line key={`slot-${index}`} x1={76 + (index + 1) * 224 / Math.max(1, slots)} x2={76 + (index + 1) * 224 / Math.max(1, slots)} y1="28" y2="68" stroke="#D6D9DF" strokeDasharray="3 3" />
          ))}
          <Line key="final-bar-thin" x1="304" x2="304" y1={barline.top} y2={barline.bottom} stroke={ink ? '#141414' : '#596169'} strokeWidth={STAFF_STROKE_WIDTH} />
          <Line key="final-bar-thick" x1="308" x2="308" y1={barline.top} y2={barline.bottom} stroke={ink ? '#141414' : '#596169'} strokeWidth="3" />
          {renderNotes(pitches, spellings, activeColor)}
          {showCorrect && renderNotes(correctPitches, correctSpellings, '#2e8b6f', stacked ? 38 : 30)}
        </Svg>
        <Image source={require('../../assets/images/g-clef.png')} resizeMode="contain" style={[styles.clef, compact && styles.compactClef]} />
        {!pitches.some(Number.isFinite) && <Text style={[styles.emptyText, compact && styles.compactEmptyText, { pointerEvents: 'none' }]}>{emptyText}</Text>}
      </View>
      {menuTarget !== null && !disabled && (
        <View style={styles.menu}>
          <Text style={styles.menuLabel}>临时记号</Text>
          {([['', '无'], ['#', '♯'], ['b', '♭'], ['n', '♮']] as const).map(([value, label]) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`临时记号${label}`} key={label} onPress={() => chooseAccidental(value)} style={styles.menuButton}><Text style={styles.menuButtonText}>{label}</Text></Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: { overflow: 'visible', borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: '#FFFFFF' },
  inkShell: { borderColor: '#141414' },
  touchArea: { height: STAFF_HEIGHT, overflow: 'hidden', borderRadius: Radius.card },
  compactTouchArea: { height: 96 },
  wrongShell: { borderColor: '#E5B5AA', backgroundColor: '#FFF9F7' },
  correctShell: { borderColor: '#A9D4BB', backgroundColor: '#F8FFFA' },
  clef: { position: 'absolute', left: 6, top: STAFF_CENTER_Y - 101 / 2, width: 40, height: 101 },
  compactClef: { top: STAFF_MIDDLE_LINE_Y - 82 / 2, width: 36, height: 82 },
  emptyText: { position: 'absolute', left: 78, right: 18, top: STAFF_CENTER_Y - 9, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  compactEmptyText: { top: STAFF_MIDDLE_LINE_Y - 9 },
  menu: { position: 'absolute', zIndex: 5, top: -59, right: 8, flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6, borderRadius: Radius.control, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border, ...Shadows.floating },
  menuLabel: { marginHorizontal: 4, color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  menuButton: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forestSoft },
  menuButtonText: { color: Brand.forest, fontSize: 15, fontWeight: '800' },
});
