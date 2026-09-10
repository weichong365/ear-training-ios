import { staffSvgYFromWrittenMidi } from './staff-coordinate.ts';

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

export const STAFF_TOP_LINE_Y = 28;
export const STAFF_MIDDLE_LINE_Y = 48;
export const STAFF_BOTTOM_LINE_Y = 68;
export const STAFF_LINE_GAP = 10;
export const STAFF_STEP_GAP = STAFF_LINE_GAP / 2;
export const STAFF_LINE_YS = [28, 38, 48, 58, 68] as const;
export const STAFF_STROKE_WIDTH = 1;

export function noteheadStemX(noteX: number, halfWidth: number, direction: StemDirection, lineGap = STAFF_LINE_GAP) {
  const inset = lineGap * 0.2;
  return noteX + (direction === 'up' ? halfWidth - inset : -halfWidth + inset);
}

export function barlineBounds() {
  return { top: STAFF_LINE_YS[0], bottom: STAFF_LINE_YS[STAFF_LINE_YS.length - 1] };
}

export function noteheadStemStart(noteX: number, noteY: number, halfWidth: number, direction: StemDirection, lineGap = STAFF_LINE_GAP) {
  return { x: noteheadStemX(noteX, halfWidth, direction, lineGap), y: noteY + (direction === 'up' ? 1 : -1) };
}

export function accidentalScale(kind: 'sharp' | 'flat' | 'natural') {
  return kind === 'sharp' ? 0.9 : 1;
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

/** E4 is step 0; every staff line/space advances one diatonic step. */
export function staffStepFromWrittenMidi(writtenMidi: number) {
  return Math.round((STAFF_BOTTOM_LINE_Y - staffSvgYFromWrittenMidi(writtenMidi)) / STAFF_STEP_GAP);
}

/** Ledger lines are required from middle C downward and A5 upward in treble clef. */
export function ledgerLineYs(writtenMidi: number) {
  const step = staffStepFromWrittenMidi(writtenMidi);
  const lines: number[] = [];
  if (step <= -2) {
    for (let ledgerStep = -2; ledgerStep >= step; ledgerStep -= 2) {
      lines.push(STAFF_BOTTOM_LINE_Y - ledgerStep * STAFF_STEP_GAP);
    }
  }
  if (step >= 10) {
    for (let ledgerStep = 10; ledgerStep <= step; ledgerStep += 2) {
      lines.push(STAFF_BOTTOM_LINE_Y - ledgerStep * STAFF_STEP_GAP);
    }
  }
  return lines;
}

/** Third-line notes and higher conventionally take downward stems. */
export function stemDirectionForWrittenMidis(writtenMidis: number[]): StemDirection {
  if (!writtenMidis.length) return 'up';
  const averageStep = writtenMidis.reduce((sum, midi) => sum + staffStepFromWrittenMidi(midi), 0) / writtenMidis.length;
  return averageStep < 4 ? 'up' : 'down';
}

/** Adjacent chord tones (seconds) alternate sides of the stem to avoid overlapping heads. */
export function chordHeadOffsets(writtenMidis: number[], displacement = 8) {
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

/** Accidentals that are vertically close occupy successively farther-left columns. */
export function accidentalColumns(writtenMidis: number[], minimumGap = 12) {
  const columns = writtenMidis.map(() => 0);
  const lastYByColumn: number[] = [];
  writtenMidis
    .map((midi, index) => ({ index, y: staffSvgYFromWrittenMidi(midi) }))
    .sort((left, right) => left.y - right.y)
    .forEach(({ index, y }) => {
      let column = lastYByColumn.findIndex((lastY) => Math.abs(y - lastY) >= minimumGap);
      if (column < 0) column = lastYByColumn.length;
      lastYByColumn[column] = y;
      columns[index] = column;
    });
  return columns;
}

/** A dot beside a line note is moved into the space immediately above it. */
export function augmentationDotY(writtenMidi: number) {
  const y = staffSvgYFromWrittenMidi(writtenMidi);
  return Math.abs(staffStepFromWrittenMidi(writtenMidi)) % 2 === 0 ? y - STAFF_STEP_GAP : y;
}
