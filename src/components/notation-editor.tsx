import { memo, useMemo, useState } from 'react';
import { GestureResponderEvent, Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Line, Text as SvgText } from 'react-native-svg';

import { Brand, Radius, TouchTarget, TypeScale } from '@/constants/theme';
import { MusicAccidental, MusicFlag, MusicNotehead, MusicRest, noteheadHalfWidth } from '@/components/music-glyphs';
import { meterBeatScale, meterCapacity, splitBars, sumDuration, targetTimedEvents } from '@/core/answer-sync';
import type { ExamAnswer, NotationEvent } from '@/core/exam-answer';
import { augmentationDotY, barlineBounds, durationNotation, fitTupletBeamY, ledgerLineYs, noteheadStemStart, STAFF_LINE_YS, STAFF_MIDDLE_LINE_Y, STAFF_STROKE_WIDTH, staffStepFromWrittenMidi, stemDirectionForWrittenMidis, type DurationNotation, type StemDirection } from '@/core/music-notation';
import { accidentalGlyphForKeySignature, defaultPitchSpelling, naturalMidiForPitchSpelling } from '@/core/pitch-spelling';
import type { ExamQuestion } from '@/core/provinces';
import { naturalMidiFromStaffSvgY, staffSvgYFromWrittenMidi } from '@/core/staff-coordinate';

const STAFF_HEIGHT = 96;
const STAFF_CENTER_Y = STAFF_MIDDLE_LINE_Y;
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

function accidentalGlyph(event: NotationEvent, keySignature: string) {
  return accidentalGlyphForKeySignature(event.midi, event.spelling, keySignature);
}

function pressPoint(event: GestureResponderEvent, width: number, height: number) {
  const native = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number; offsetY?: number };
  return {
    x: Number(native.locationX ?? native.offsetX ?? width / 2) * 340 / Math.max(1, width),
    y: Number(native.locationY ?? native.offsetY ?? height / 2) * STAFF_HEIGHT / Math.max(1, height),
  };
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
  disabled?: boolean;
  ink?: boolean;
  tone?: 'red' | 'green' | '';
  emptyText: string;
  onStaffTap?: (barIndex: number, midi: number, spelling: string) => void;
  onEventTap?: (event: NotationEvent) => void;
};

type RenderedNotation = {
  item: NotationEvent;
  index: number;
  beat: number;
  localBar: number;
  x: number;
  y: number;
  written: number;
  notation: DurationNotation;
  direction: StemDirection;
  headHalfWidth: number;
};

type StemLine = { key: string; x: number; y1: number; y2: number };
type BeamLine = { key: string; x1: number; x2: number; y: number };
type FlagMark = { key: string; stemX: number; stemEndY: number; beamCount: number; direction: StemDirection };
type TupletMark = { key: string; x: number; y: number };

function buildStemLayout(notes: RenderedNotation[]) {
  const stems: StemLine[] = [];
  const beams: BeamLine[] = [];
  const flags: FlagMark[] = [];
  const tuplets: TupletMark[] = [];
  const stemLength = 27;
  const tupletGap = 4;
  const tupletHeight = 9;
  const beamThickness = 4;
  let run: RenderedNotation[] = [];

  function stemStart(note: RenderedNotation, direction = note.direction) {
    return noteheadStemStart(note.x, note.y, note.headHalfWidth, direction);
  }

  function addIndependent(note: RenderedNotation) {
    const start = stemStart(note);
    const stemEndY = note.direction === 'up' ? note.y - stemLength : note.y + stemLength;
    stems.push({ key: `stem-${note.index}`, x: start.x, y1: start.y, y2: stemEndY });
    if (note.notation.beamCount) {
      flags.push({ key: `flag-${note.index}`, stemX: start.x, stemEndY, beamCount: note.notation.beamCount, direction: note.direction });
    }
  }

  function flushRun() {
    if (run.length === 1) addIndependent(run[0]);
    if (run.length >= 2) {
      const anchor = run.reduce((best, note) => Math.abs(staffStepFromWrittenMidi(note.written) - 4) > Math.abs(staffStepFromWrittenMidi(best.written) - 4) ? note : best, run[0]);
      const direction = anchor.direction;
      const starts = run.map((note) => stemStart(note, direction));
      let beamY = direction === 'up'
        ? Math.min(...run.map((note) => note.y - stemLength))
        : Math.max(...run.map((note) => note.y + stemLength));
      if (run.some((note) => note.notation.tuplet)) {
        beamY = fitTupletBeamY(beamY, direction, STAFF_HEIGHT, tupletHeight, tupletGap, beamThickness);
      }
      beams.push({ key: `beam-${run[0].index}`, x1: starts[0].x, x2: starts[starts.length - 1].x, y: beamY });
      run.forEach((note, index) => stems.push({
        key: `stem-${note.index}`,
        x: starts[index].x,
        y1: starts[index].y,
        y2: beamY,
      }));

      let subRun: number[] = [];
      const flushSubRun = () => {
        if (!subRun.length) return;
        const secondaryY = beamY + (direction === 'up' ? 5.5 : -5.5);
        if (subRun.length >= 2) {
          beams.push({ key: `beam-2-${run[subRun[0]].index}`, x1: starts[subRun[0]].x, x2: starts[subRun[subRun.length - 1]].x, y: secondaryY });
        } else {
          const position = subRun[0];
          const pointsRight = position === 0;
          beams.push({ key: `beamlet-${run[position].index}`, x1: starts[position].x + (pointsRight ? 0 : -9), x2: starts[position].x + (pointsRight ? 9 : 0), y: secondaryY });
        }
        subRun = [];
      };
      run.forEach((note, index) => {
        if (note.notation.beamCount >= 2) subRun.push(index);
        else flushSubRun();
      });
      flushSubRun();
    }
    run = [];
  }

  notes.forEach((note) => {
    if (note.item.rest || !note.notation.hasStem) {
      flushRun();
      return;
    }
    if (note.notation.beamCount > 0) {
      if (run.length && run[run.length - 1].localBar !== note.localBar) flushRun();
      if (run.length && !!run[run.length - 1].notation.tuplet !== !!note.notation.tuplet) flushRun();
      run.push(note);
      return;
    }
    flushRun();
    addIndependent(note);
  });
  flushRun();

  // 三连音「3」放横梁外侧，x 对齐组内中间音符（与小程序 staff-notation 同步）。
  let tripletGroup: RenderedNotation[] = [];
  const dist = (note: RenderedNotation) => Math.abs(staffStepFromWrittenMidi(note.written) - 4);
  const flushTriplet = () => {
    if (!tripletGroup.length) return;
    const anchor = tripletGroup.reduce((best, note) => (dist(note) > dist(best) ? note : best), tripletGroup[0]);
    const middle = tripletGroup[Math.floor(tripletGroup.length / 2)];
    let y;
    if (anchor.direction === 'up') {
      const beamY = fitTupletBeamY(Math.min(...tripletGroup.map((note) => note.y - stemLength)), 'up', STAFF_HEIGHT, tupletHeight, tupletGap, beamThickness);
      y = beamY - tupletGap;
    } else {
      const beamY = fitTupletBeamY(Math.max(...tripletGroup.map((note) => note.y + stemLength)), 'down', STAFF_HEIGHT, tupletHeight, tupletGap, beamThickness);
      y = beamY + beamThickness + tupletGap + tupletHeight;
    }
    tuplets.push({ key: `tuplet-${tripletGroup[0].index}`, x: middle.x, y });
    tripletGroup = [];
  };
  notes.forEach((note) => {
    const isTuplet = !!note.notation.tuplet && !note.item.rest;
    if (!isTuplet) { flushTriplet(); return; }
    if (tripletGroup.length && note.localBar !== tripletGroup[tripletGroup.length - 1].localBar) flushTriplet();
    tripletGroup.push(note);
  });
  flushTriplet();

  return { stems, beams, flags, tuplets };
}

export const TimedAnswerStaff = memo(function TimedAnswerStaff({ events, meter, capacityMeter, keySignature, barOffset, barCount, disabled, ink = false, tone = '', emptyText, onStaffTap, onEventTap }: TimedStaffProps) {
  const [layout, setLayout] = useState({ width: 340, height: STAFF_HEIGHT });
  const capacity = meterCapacity(capacityMeter || meter, 4);
  const noteStart = 104;
  const barWidth = (330 - noteStart) / Math.max(1, barCount);
  const positioned = useMemo(() => Array.from({ length: barCount }, (_, localBar) => {
    const values = events.filter((item) => Number(item.barIndex) === barOffset + localBar || (!Number.isInteger(item.barIndex) && localBar === 0));
    let beat = 0;
    return values.map((item) => {
      const current = { item, beat, localBar };
      beat += Math.abs(item.duration);
      return current;
    });
  }).flat(), [barCount, barOffset, events]);
  const rendered = useMemo<RenderedNotation[]>(() => positioned.map(({ item, beat, localBar }, index) => {
    const x = noteStart + localBar * barWidth + 13 + beat / capacity * (barWidth - 26);
    const written = writtenMidi(item);
    const notation = durationNotation(item.duration);
    return {
      item,
      index,
      beat,
      localBar,
      x,
      y: staffSvgYFromWrittenMidi(written),
      written,
      notation,
      direction: stemDirectionForWrittenMidis([written]),
      headHalfWidth: noteheadHalfWidth(notation.headKind),
    };
  }), [barWidth, capacity, positioned]);
  const stemLayout = useMemo(() => buildStemLayout(rendered), [rendered]);
  const color = tone === 'green' ? '#2e8b6f' : tone === 'red' ? Brand.danger : ink ? '#141414' : Brand.ink;
  const staffLine = ink ? '#141414' : '#596169';
  const barline = barlineBounds();

  function tap(event: GestureResponderEvent) {
    if (disabled) return;
    const point = pressPoint(event, layout.width, layout.height);
    const localBar = Math.max(0, Math.min(barCount - 1, Math.floor((point.x - noteStart) / barWidth)));
    const nearest = positioned.reduce<{ event: NotationEvent | null; distance: number }>((best, value) => {
      const x = noteStart + value.localBar * barWidth + 13 + value.beat / capacity * (barWidth - 26);
      const y = staffSvgYFromWrittenMidi(writtenMidi(value.item)) * STAFF_HEIGHT / 96;
      const distance = Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2) * 2;
      return Math.abs(point.x - x) < 28 && Math.abs(point.y - y) < 22 && distance < best.distance ? { event: value.item, distance } : best;
    }, { event: null, distance: Infinity }).event;
    if (nearest) return onEventTap?.(nearest);
    const naturalMidi = naturalMidiFromStaffSvgY(point.y * 96 / STAFF_HEIGHT, 55, 81);
    const note = applyKeySignature(naturalMidi, keySignature);
    onStaffTap?.(barOffset + localBar, note.midi, note.spelling);
  }

  return <Pressable accessibilityRole={disabled ? 'image' : 'button'} accessibilityState={disabled ? undefined : { disabled: false }} disabled={disabled} onPress={tap} onLayout={(event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout)} style={[styles.staffShell, ink && styles.inkStaff, tone === 'red' && styles.wrongStaff, tone === 'green' && styles.correctStaff]} accessibilityLabel={disabled ? '五线谱谱例' : '两小节五线谱答题区域'}>
    <Svg viewBox="0 0 340 96" preserveAspectRatio="none" width="100%" height="100%">
      {STAFF_LINE_YS.map((y) => <Line key={y} x1="12" x2="330" y1={y} y2={y} stroke={staffLine} strokeWidth={STAFF_STROKE_WIDTH} />)}
      {keySignature === 'G' && <MusicAccidental x={57} y={staffSvgYFromWrittenMidi(77)} glyph="♯" color={Brand.ink} />}
      {keySignature === 'F' && <MusicAccidental x={57} y={staffSvgYFromWrittenMidi(71)} glyph="♭" color={Brand.ink} />}
      {!!meter && <><SvgText x="82" y={STAFF_LINE_YS[1]} fontSize="17" fontWeight="700" textAnchor="middle" alignmentBaseline="central" fill={Brand.ink}>{meter.split('/')[0]}</SvgText><SvgText x="82" y={STAFF_LINE_YS[3]} fontSize="17" fontWeight="700" textAnchor="middle" alignmentBaseline="central" fill={Brand.ink}>{meter.split('/')[1]}</SvgText></>}
      {Array.from({ length: barCount + 1 }, (_, index) => <Line key={`bar-${index}`} x1={noteStart + index * barWidth} x2={noteStart + index * barWidth} y1={barline.top} y2={barline.bottom} stroke={staffLine} strokeWidth={index === barCount ? 1.5 : STAFF_STROKE_WIDTH} />)}
      {rendered.map(({ item, index, x, y, written, notation }, renderedIndex) => {
        const glyph = accidentalGlyph(item, keySignature);
        return <G key={`${item.inputOrder || index}-${rendered[renderedIndex].localBar}-${rendered[renderedIndex].beat}`}>
          {item.rest ? <>
            <MusicRest x={x} kind={notation.restKind} color={color} />
            {!!notation.dotCount && <Ellipse cx={x + 9} cy={43} rx="1.65" ry="1.65" fill={color} />}
          </> : <>
            {ledgerLineYs(written).map((ledgerY) => <Line key={`ledger-${ledgerY}`} x1={x - 11} x2={x + 11} y1={ledgerY} y2={ledgerY} stroke={color} strokeWidth={STAFF_STROKE_WIDTH} />)}
            {!!glyph && <MusicAccidental x={x - 15} y={y} glyph={glyph} color={color} />}
            <MusicNotehead x={x} y={y} kind={notation.headKind} color={color} />
            {!!notation.dotCount && <Ellipse cx={x + noteheadHalfWidth(notation.headKind) + 5} cy={augmentationDotY(written)} rx="1.65" ry="1.65" fill={color} />}
          </>}
        </G>;
      })}
      {stemLayout.stems.map((stem) => <Line key={stem.key} x1={stem.x} x2={stem.x} y1={stem.y1} y2={stem.y2} stroke={color} strokeWidth="1.5" />)}
      {stemLayout.beams.map((beam) => <Line key={beam.key} x1={beam.x1} x2={beam.x2} y1={beam.y} y2={beam.y} stroke={color} strokeWidth="4" strokeLinecap="butt" />)}
      {stemLayout.flags.map((flag) => <MusicFlag key={flag.key} stemX={flag.stemX} stemEndY={flag.stemEndY} beamCount={flag.beamCount} direction={flag.direction} color={color} />)}
      {stemLayout.tuplets.map((tuplet) => <SvgText key={tuplet.key} x={tuplet.x} y={tuplet.y} fontSize="9" fontStyle="italic" fontWeight="700" textAnchor="middle" fill={color}>3</SvgText>)}
    </Svg>
    <Image source={require('../../assets/images/g-clef.png')} resizeMode="contain" style={styles.timedClef} />
    {!events.length && <Text style={[styles.emptyText, { pointerEvents: 'none' }]}>{emptyText}</Text>}
  </Pressable>;
});

// Read-only compatibility renderer used by the choice-paper preview.  It follows
// the same two-bars-per-system layout as the mini program answer staff.
export const NotationStaff = memo(function NotationStaff({ events, meter, keySignature = '', barCount, ink = false }: { events: NotationEvent[]; meter: string; keySignature?: string; barCount: number; ink?: boolean }) {
  const capacity = meterCapacity(meter, 4);
  const decorated = decorateSequentialBars(events, capacity);
  return <View style={{ gap: 7 }}>{Array.from({ length: Math.max(1, Math.ceil(barCount / 2)) }, (_, systemIndex) => {
    const barOffset = systemIndex * 2;
    const systemBarCount = Math.min(2, barCount - barOffset);
    return <TimedAnswerStaff key={systemIndex} events={decorated.filter((event) => Number(event.barIndex) >= barOffset && Number(event.barIndex) < barOffset + systemBarCount)} meter={systemIndex === 0 ? meter : ''} capacityMeter={meter} keySignature={keySignature} barOffset={barOffset} barCount={systemBarCount} disabled ink={ink} emptyText="" />;
  })}</View>;
});

export function NotationEditor({ question, answer, unlocked, disabled, reviewCorrect, showCorrect, ink = false, onChange }: { question: ExamQuestion; answer: ExamAnswer; unlocked: boolean; disabled?: boolean; reviewCorrect?: boolean; showCorrect?: boolean; ink?: boolean; onChange: (answer: ExamAnswer) => void }) {
  const [duration, setDuration] = useState(1);
  const [rest, setRest] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const isMelody = question.type === 'melody';
  const beatsPerBar = Number(question.beatsPerBar) || meterCapacity(String(question.meter || ''), 4);
  const barCount = Number(question.examBars || question.barCount) || Math.max(1, Math.round(sumDuration(targetTimedEvents(question)) / beatsPerBar));
  const systems = Math.max(1, Math.ceil(barCount / 2));
  const answerCapacity = meterCapacity(answer.meter, beatsPerBar);
  const targetBars = splitBars(targetTimedEvents(question), beatsPerBar, barCount);
  const canEdit = unlocked && !disabled;

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
    const nextEvent: NotationEvent = rest ? { midi: 69, duration: -duration, rest: true, barIndex, inputOrder } : { midi: isMelody ? midi : 69, spelling: isMelody ? spelling : undefined, duration, barIndex, inputOrder };
    setMessage('');
    onChange({ ...answer, events: [...answer.events, nextEvent].sort((left, right) => Number(left.barIndex) - Number(right.barIndex)) });
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

  return <View style={styles.editor}>
    <View style={styles.choiceLine}><Text style={[styles.choiceLabel, ink && styles.choiceLabelInk]}>拍号</Text><View style={styles.options}>{METERS.map((meter) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: answer.meter === meter, disabled: !canEdit }} key={meter} disabled={!canEdit} onPress={() => selectMeter(meter)} style={[styles.choice, ink && styles.choiceInk, answer.meter === meter && (ink ? styles.choiceActiveInk : styles.choiceActive)]}><Text style={[styles.choiceText, ink && styles.choiceTextInk, answer.meter === meter && styles.choiceTextActive]}>{meter}</Text></Pressable>)}</View></View>
    {isMelody && <View style={styles.choiceLine}><Text style={[styles.choiceLabel, ink && styles.choiceLabelInk]}>调号</Text><View style={styles.options}>{KEYS.map((key) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: answer.keySignature === key.value, disabled: !canEdit }} key={key.value} disabled={!canEdit} onPress={() => selectKey(key.value)} style={[styles.choice, styles.keyChoice, ink && styles.choiceInk, answer.keySignature === key.value && (ink ? styles.choiceActiveInk : styles.choiceActive)]}><Text style={[styles.choiceText, ink && styles.choiceTextInk, answer.keySignature === key.value && styles.choiceTextActive]}>{key.label}</Text></Pressable>)}</View></View>}
    {canEdit && <><View style={[styles.durationToolbar, ink && styles.durationToolbarInk]}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationRow}>{DURATION_OPTIONS.map((item) => { const selected = Math.abs(duration - item.value) < 1e-6; return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} key={item.label} onPress={() => setDuration(item.value)} style={[styles.durationChoice, ink && styles.durationChoiceInk, selected && (ink ? styles.choiceActiveInk : styles.choiceActive)]}><Text style={[styles.durationText, ink && styles.durationTextInk, selected && styles.choiceTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rest }} onPress={() => setRest((value) => !value)} style={[styles.restChoice, ink && styles.restChoiceInk, rest && (ink ? styles.restActiveInk : styles.restActive)]}><Text style={[styles.restText, ink && styles.restTextInk, rest && styles.choiceTextActive]}>{rest ? '休止符开启' : '写休止符'}</Text></Pressable></View><View style={styles.helpRow}><Text style={[styles.helpText, ink && styles.helpTextInk]}>选择时值后，依次点击谱面写入</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: !answer.events.length }} onPress={undo} disabled={!answer.events.length} style={[styles.undoButton, ink && styles.undoButtonInk]}><Text style={[styles.undoText, ink && styles.undoTextInk]}>撤销</Text></Pressable></View></>}
    {selectedOrder !== null && canEdit && isMelody && <View style={[styles.accidentalMenu, ink && styles.accidentalMenuInk]}><Text style={[styles.accidentalLabel, ink && styles.choiceLabelInk]}>临时记号</Text>{([['', '无'], ['#', '♯'], ['b', '♭'], ['n', '♮'], ['erase', '擦除']] as const).map(([value, label]) => <Pressable accessibilityRole="button" accessibilityLabel={label === '擦除' ? '擦除所选音符' : `临时记号${label}`} key={label} onPress={() => updateSelected(value)} style={[styles.accidentalButton, ink && styles.accidentalButtonInk]}><Text style={[styles.accidentalText, ink && styles.accidentalTextInk]}>{label}</Text></Pressable>)}</View>}
    {Array.from({ length: systems }, (_, systemIndex) => {
      const barOffset = systemIndex * 2;
      const systemBarCount = Math.min(2, barCount - barOffset);
      const systemEvents = answer.events.filter((event) => Number(event.barIndex) >= barOffset && Number(event.barIndex) < barOffset + systemBarCount);
      const correctEvents = targetBars.slice(barOffset, barOffset + systemBarCount).flatMap((bar, localBar) => bar.map((event, index) => ({ ...event, barIndex: barOffset + localBar, inputOrder: index + 1 })));
      return <View key={systemIndex} style={styles.systemCard}><View style={styles.systemHead}><Text style={[styles.systemLabel, ink && styles.systemLabelInk]}>第 {barOffset + 1}-{barOffset + systemBarCount} 小节</Text><Text style={[styles.systemBeat, ink && styles.systemBeatInk]}>已写 {roundBeats(sumDuration(systemEvents) * meterBeatScale(answer.meter))} 拍</Text></View><TimedAnswerStaff events={systemEvents} meter={systemIndex === 0 ? answer.meter : ''} capacityMeter={answer.meter} keySignature={isMelody ? answer.keySignature : ''} barOffset={barOffset} barCount={systemBarCount} disabled={!canEdit} ink={ink} tone={disabled ? reviewCorrect ? 'green' : 'red' : ''} emptyText={!answer.meter ? '请先选择拍号' : isMelody && !answer.keySignature ? '请先选择调号' : isMelody ? '选择时值后点击音高位置' : '选择时值后点击谱面写入'} onStaffTap={(barIndex, midi, spelling) => append(barIndex, midi, spelling)} onEventTap={(event) => setSelectedOrder(Number(event.inputOrder))} />{showCorrect && !reviewCorrect && <View style={styles.standardBlock}><Text style={styles.standardLabel}>{systemIndex === 0 ? `标准答案：${String(question.meter)}${isMelody ? ` · ${String(question.keyName || question.keySignature)}` : ''}` : '标准答案'}</Text><TimedAnswerStaff events={correctEvents} meter={systemIndex === 0 ? String(question.meter || '') : ''} capacityMeter={String(question.meter || '')} keySignature={isMelody ? String(question.keySignature || 'C') : ''} barOffset={barOffset} barCount={systemBarCount} disabled ink={ink} tone="green" emptyText="" /></View>}</View>;
    })}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  editor: { gap: 12 }, choiceLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, choiceLabel: { width: 42, minHeight: TouchTarget, paddingTop: 13, color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' }, options: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { minWidth: TouchTarget, minHeight: TouchTarget, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1, borderColor: Brand.border, backgroundColor: '#F3F5F2' }, keyChoice: { minWidth: 104 }, choiceActive: { borderColor: Brand.forest, backgroundColor: Brand.forest }, choiceText: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' }, choiceTextActive: { color: Brand.textOnAccent },
  durationToolbar: { flexDirection: 'row', gap: 7, padding: 8, borderRadius: Radius.card, backgroundColor: '#EEE7D8' }, durationRow: { gap: 7, paddingRight: 3 }, durationChoice: { minWidth: 76, height: TouchTarget, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory }, durationText: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' }, restChoice: { width: 86, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1, borderColor: '#DEC476', backgroundColor: Brand.warningSoft }, restActive: { borderColor: Brand.gold, backgroundColor: Brand.gold }, restText: { color: Brand.warning, fontSize: 11, fontWeight: '800' },
  helpRow: { minHeight: TouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 3 }, helpText: { flex: 1, color: Brand.muted, fontSize: TypeScale.caption }, undoButton: { minWidth: 64, minHeight: TouchTarget, marginLeft: 8, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forestSoft }, undoText: { color: Brand.forest, fontSize: TypeScale.caption, fontWeight: '800' }, accidentalMenu: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: 7, borderRadius: Radius.control, backgroundColor: '#F3F5F2' }, accidentalLabel: { marginHorizontal: 4, color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' }, accidentalButton: { minWidth: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forestSoft }, accidentalText: { color: Brand.forest, fontSize: TypeScale.footnote, fontWeight: '800' },
  systemCard: { gap: 8, marginTop: 3 }, systemHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 }, systemLabel: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' }, systemBeat: { color: Brand.muted, fontSize: TypeScale.caption, fontVariant: ['tabular-nums'] }, staffShell: { height: STAFF_HEIGHT, overflow: 'hidden', borderRadius: Radius.control, borderWidth: 1, borderColor: Brand.border, backgroundColor: '#FFFFFF' }, inkStaff: { borderColor: '#141414' }, wrongStaff: { borderColor: '#DDAAA1', backgroundColor: '#FFF9F7' }, correctStaff: { borderColor: '#9FCBB1', backgroundColor: '#F8FFFA' }, emptyText: { position: 'absolute', left: 106, right: 10, top: STAFF_CENTER_Y - 9, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' }, standardBlock: { gap: 7, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#B9DACC', borderStyle: 'dashed' }, standardLabel: { color: Brand.success, fontSize: TypeScale.caption, fontWeight: '800' }, error: { color: Brand.danger, fontSize: TypeScale.footnote, lineHeight: 18 },
  choiceInk: { borderColor: '#141414', backgroundColor: '#FFFFFF' }, choiceActiveInk: { borderColor: '#141414', backgroundColor: '#141414' }, choiceTextInk: { color: '#141414' },
  durationChoiceInk: { borderColor: '#141414', backgroundColor: '#FFFFFF' }, durationTextInk: { color: '#141414' },
  restChoiceInk: { borderColor: '#141414', backgroundColor: '#FFFFFF' }, restActiveInk: { borderColor: '#141414', backgroundColor: '#141414' }, restTextInk: { color: '#141414' },
  undoButtonInk: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#141414' }, undoTextInk: { color: '#141414' },
  accidentalButtonInk: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#141414' }, accidentalTextInk: { color: '#141414' },
  choiceLabelInk: { color: '#141414' }, helpTextInk: { color: '#141414' },
  durationToolbarInk: { backgroundColor: '#F2F2F2' }, accidentalMenuInk: { backgroundColor: '#F2F2F2' },
  systemLabelInk: { color: '#141414' }, systemBeatInk: { color: '#141414' },
  timedClef: { position: 'absolute', left: 4, top: STAFF_CENTER_Y - 82 / 2, width: 36, height: 82 },
});
