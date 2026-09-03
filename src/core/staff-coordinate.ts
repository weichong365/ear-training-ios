export const STAFF_VIEWBOX_HEIGHT = 96;
export const ANSWER_STAFF_HEIGHT = 122;

const STAFF_E4_Y = 68;
const STAFF_DIATONIC_STEP = 5;
const NATURAL_SCALE = [0, 2, 4, 5, 7, 9, 11];
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const E4_DIATONIC = 4 * 7 + LETTER_INDEX.E;

/**
 * Convert a written MIDI pitch to the vertical coordinate used by the answer staff.
 * Chromatic MIDI values use the same default sharp spelling as the mini program.
 */
export function staffSvgYFromWrittenMidi(midi: number) {
  const name = SHARP_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + LETTER_INDEX[name[0]];
  return STAFF_E4_Y - (diatonic - E4_DIATONIC) * STAFF_DIATONIC_STEP;
}

/** Convert a coordinate in the 96-unit staff viewBox to a natural MIDI pitch. */
export function naturalMidiFromStaffSvgY(y: number, minimum = 55, maximum = 81) {
  const diatonic = E4_DIATONIC + Math.round((STAFF_E4_Y - y) / STAFF_DIATONIC_STEP);
  const octave = Math.floor(diatonic / 7);
  const index = ((diatonic % 7) + 7) % 7;
  return Math.max(minimum, Math.min(maximum, (octave + 1) * 12 + NATURAL_SCALE[index]));
}

/**
 * Convert the physical tap coordinate into the staff viewBox before resolving pitch.
 * Staff SVGs deliberately use preserveAspectRatio="none", so this conversion remains
 * correct on every screen width and does not inherit SVG letterboxing offsets.
 */
export function naturalMidiFromStaffTapY(y: number, renderedHeight = ANSWER_STAFF_HEIGHT, minimum = 55, maximum = 81) {
  const safeHeight = renderedHeight > 0 ? renderedHeight : ANSWER_STAFF_HEIGHT;
  return naturalMidiFromStaffSvgY(y * STAFF_VIEWBOX_HEIGHT / safeHeight, minimum, maximum);
}
