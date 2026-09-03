import { memo } from 'react';
import { GestureResponderEvent, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Text as SvgText } from 'react-native-svg';

import { MusicNotehead, noteheadHalfWidth } from '@/components/music-glyphs';
import { Brand, TouchTarget, TypeScale } from '@/constants/theme';
import type { AccidentalMode } from '@/core/exam-answer';
import { accidentalColumns, chordHeadOffsets, ledgerLineYs, STAFF_LINE_YS, stemDirectionForWrittenMidis } from '@/core/music-notation';
import { accidentalGlyphForPitch, defaultPitchSpelling, naturalMidiForPitchSpelling } from '@/core/pitch-spelling';
import { ANSWER_STAFF_HEIGHT, staffSvgYFromWrittenMidi } from '@/core/staff-coordinate';

type StaffPreviewProps = {
  midis?: number[];
  harmonic?: boolean;
  compact?: boolean;
  ink?: boolean;
  accidentals?: AccidentalMode[];
  wholeNotes?: boolean;
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
        <Pressable accessibilityRole="radio" accessibilityLabel={`临时记号${option.label}`} accessibilityState={{ selected: value === option.value, disabled }} key={option.value} disabled={disabled} onPress={() => onChange(option.value)} style={[styles.accidentalButton, value === option.value && styles.accidentalActive, disabled && styles.accidentalDisabled]}>
          <Text style={[styles.accidentalText, value === option.value && styles.accidentalTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
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

export const StaffPreview = memo(function StaffPreview({ midis = [], harmonic = false, compact = false, ink = false, accidentals = [], wholeNotes = false, onPressY }: StaffPreviewProps) {
  const source = midis.length ? midis : onPressY ? [] : [64, 67, 69, 67, 72];
  const notes = source.slice(0, compact ? 5 : 10);
  const writtenNotes = notes.map((midi, index) => {
    const suppliedAccidental = accidentals[index];
    const spelling = suppliedAccidental === undefined ? defaultPitchSpelling(midi) : undefined;
    const accidental = suppliedAccidental || 'none';
    return spelling
      ? naturalMidiForPitchSpelling(midi, spelling)
      : accidental === 'sharp' ? midi - 1 : accidental === 'flat' ? midi + 1 : midi;
  });
  const chordOffsets = harmonic ? chordHeadOffsets(writtenNotes) : writtenNotes.map(() => 0);
  const accidentalColumn = accidentalColumns(writtenNotes);
  const noteX = (index: number) => harmonic
    ? 157 + chordOffsets[index]
    : 92 + index * Math.min(27, 188 / Math.max(1, notes.length - 1));
  const noteYs = writtenNotes.map(staffSvgYFromWrittenMidi);
  const previewHeadKind = wholeNotes ? 'whole' : 'black';
  const previewHeadHalfWidth = noteheadHalfWidth(previewHeadKind);
  const harmonicStemDirection = stemDirectionForWrittenMidis(writtenNotes);

  const staff = (
    <View style={[styles.container, ink && styles.inkContainer, compact && styles.compact]} accessibilityLabel="五线谱预览">
      <Svg viewBox="0 0 320 96" preserveAspectRatio="none" width="100%" height="100%">
        {STAFF_LINE_YS.map((y) => (
          <Line key={y} x1="16" x2="308" y1={y} y2={y} stroke={ink ? '#141414' : '#596169'} strokeWidth="1" />
        ))}
        <Line x1="308" x2="308" y1="28" y2="68" stroke={ink ? '#141414' : '#596169'} strokeWidth="1.4" />
        {!wholeNotes && harmonic && notes.length > 0 && (() => {
          const stemX = harmonicStemDirection === 'up'
            ? Math.max(...notes.map((_, index) => noteX(index) + previewHeadHalfWidth))
            : Math.min(...notes.map((_, index) => noteX(index) - previewHeadHalfWidth));
          const topY = Math.min(...noteYs);
          const bottomY = Math.max(...noteYs);
          return <Line x1={stemX} x2={stemX} y1={harmonicStemDirection === 'up' ? topY - 27 : topY} y2={harmonicStemDirection === 'up' ? bottomY : bottomY + 27} stroke={Brand.ink} strokeWidth="1.5" />;
        })()}
        {notes.map((midi, index) => {
          const x = noteX(index);
          const suppliedAccidental = accidentals[index];
          const spelling = suppliedAccidental === undefined ? defaultPitchSpelling(midi) : undefined;
          const accidental = suppliedAccidental || 'none';
          const writtenMidi = writtenNotes[index];
          const y = staffSvgYFromWrittenMidi(writtenMidi);
          const glyph = spelling
            ? accidentalGlyphForPitch(midi, spelling)
            : accidental === 'sharp' ? '♯' : accidental === 'flat' ? '♭' : accidental === 'natural' ? '♮' : '';
          const direction = stemDirectionForWrittenMidis([writtenMidi]);
          const stemX = x + (direction === 'up' ? previewHeadHalfWidth : -previewHeadHalfWidth);
          return (
            <G key={`${midi}-${index}`}>
              {ledgerLineYs(writtenMidi).map((ledgerY) => <Line key={`ledger-${ledgerY}`} x1={x - 11} x2={x + 11} y1={ledgerY} y2={ledgerY} stroke={Brand.ink} strokeWidth="1.2" />)}
              {!wholeNotes && !harmonic && <Line x1={stemX} x2={stemX} y1={direction === 'up' ? y - 27 : y} y2={direction === 'up' ? y : y + 27} stroke={Brand.ink} strokeWidth="1.5" />}
              {!!glyph && <SvgText x={x - 15 - accidentalColumn[index] * 9} y={y + (glyph === '♭' ? 6 : 5)} fontSize={glyph === '♭' ? 18 : 16} fill={Brand.ink}>{glyph}</SvgText>}
              <MusicNotehead x={x} y={y} kind={previewHeadKind} color={Brand.ink} />
            </G>
          );
        })}
      </Svg>
      <Image source={require('../../assets/images/g-clef.png')} resizeMode="contain" style={[styles.clef, compact && styles.compactClef]} />
    </View>
  );

  if (!onPressY) return staff;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="点击五线谱写入音符"
      onPress={(event) => onPressY(resolvePressY(event, compact ? 92 : ANSWER_STAFF_HEIGHT))}>
      {staff}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 122,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5DBE0',
    backgroundColor: '#FFFFFF',
  },
  inkContainer: { borderColor: '#141414' },
  compact: { height: 92 },
  clef: {
    position: 'absolute',
    left: 6,
    top: 12,
    width: 40,
    height: 101,
  },
  compactClef: { top: 8, width: 30, height: 76 },
  accidentalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  accidentalButton: { minWidth: TouchTarget, minHeight: TouchTarget, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory },
  accidentalActive: { borderColor: Brand.forest, backgroundColor: Brand.forest },
  accidentalDisabled: { opacity: 0.45 },
  accidentalText: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  accidentalTextActive: { color: Brand.textOnAccent },
});
