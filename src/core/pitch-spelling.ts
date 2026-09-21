const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export type PitchSpellingParts = {
  letter: string;
  accidental: string;
  octave: number;
};

function positiveMod(value: number, base: number) {
  return ((value % base) + base) % base;
}

/** Default chromatic spelling used by the mini program: every black key is sharp. */
export function defaultPitchSpelling(midi: number) {
  const name = SHARP_NAMES[positiveMod(midi, 12)];
  return `${name}${Math.floor(midi / 12) - 1}`;
}

export function pitchSpellingParts(midi: number, preferred?: string): PitchSpellingParts {
  const match = preferred?.match(/^([A-G])([#bn]?)(-?\d+)$/);
  if (match) return { letter: match[1], accidental: match[2], octave: Number(match[3]) };

  const fallback = defaultPitchSpelling(midi).match(/^([A-G])([#]?)(-?\d+)$/)!;
  return { letter: fallback[1], accidental: fallback[2], octave: Number(fallback[3]) };
}

/** MIDI of the natural staff position, before applying the accidental. */
export function naturalMidiForPitchSpelling(midi: number, preferred?: string) {
  const parts = pitchSpellingParts(midi, preferred);
  return (parts.octave + 1) * 12 + PITCH_CLASSES[parts.letter];
}

export function accidentalGlyphForPitch(midi: number, preferred?: string) {
  const accidental = pitchSpellingParts(midi, preferred).accidental;
  return accidental === '#' ? '♯' : accidental === 'b' ? '♭' : accidental === 'n' ? '♮' : '';
}

/**
 * 谱面标注口径（小程序 staff-notation.js）：
 *   - 调号已含的升/降号不重复标注（G 大调的 F 不画 ♯）；
 *   - 被调号改变的自然音须显示还原号（G 大调里写 F♮）；
 *   - 其余按记谱本身。
 */
export function staffAccidental(midi: number, preferred: string | undefined, keySignature: string): '' | '#' | 'b' | 'n' {
  const parts = pitchSpellingParts(midi, preferred);
  const keyAccidental = keySignature === 'G' && parts.letter === 'F' ? '#'
    : keySignature === 'F' && parts.letter === 'B' ? 'b' : '';
  if (parts.accidental === keyAccidental) return '';
  if (!parts.accidental && keyAccidental) return 'n';
  return parts.accidental as '' | '#' | 'b' | 'n';
}

/** Hide accidentals already supplied by the key signature; keep explicit naturals. */
export function accidentalGlyphForKeySignature(midi: number, preferred: string | undefined, keySignature: string) {
  const parts = pitchSpellingParts(midi, preferred);
  if ((keySignature === 'G' && parts.letter === 'F' && parts.accidental === '#')
    || (keySignature === 'F' && parts.letter === 'B' && parts.accidental === 'b')) return '';
  return accidentalGlyphForPitch(midi, preferred);
}

export function formatPitchSpelling(midi: number, preferred?: string) {
  const parts = pitchSpellingParts(midi, preferred);
  const accidental = parts.accidental === '#' ? '♯' : parts.accidental === 'b' ? '♭' : parts.accidental === 'n' ? '♮' : '';
  return `${parts.letter}${accidental}${parts.octave}`;
}
