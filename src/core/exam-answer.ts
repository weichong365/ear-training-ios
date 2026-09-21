import type { ExamQuestion } from '@/core/provinces';
import { meterCapacity, sameOrderedMidis, sameUnorderedMidis, splitInputBars, sumDuration, targetTimedEvents, timedExamScore } from './answer-sync.ts';
import { formatPitchSpelling, pitchSpellingParts } from './pitch-spelling.ts';

export type NotationEvent = {
  midi: number;
  duration: number;
  rest?: boolean;
  accidental?: AccidentalMode;
  spelling?: string;
  barIndex?: number;
  inputOrder?: number;
  /** 连至下一音（小程序 `tieToNext`）—— 参与判题签名，见 answer-sync.eventSignature */
  tieToNext?: boolean;
  /** 由前一音连入（小程序 `tieFromPrevious`）—— 跨谱行时只有入弧 */
  tieFromPrevious?: boolean;
};

export type AccidentalMode = 'none' | 'sharp' | 'flat' | 'natural';

export type ExamAnswer = {
  pitches: number[];
  spellings: string[];
  accidentals: AccidentalMode[];
  events: NotationEvent[];
  meter: string;
  keySignature: string;
  quality: string;
  inversion: string;
  choiceIndex: number | null;
};

export type QuestionScore = {
  score: number;
  total: number;
  ratio: number;
  correct: boolean;
};

export function emptyExamAnswer(): ExamAnswer {
  return {
    pitches: [],
    spellings: [],
    accidentals: [],
    events: [],
    meter: '',
    keySignature: '',
    quality: '',
    inversion: '',
    choiceIndex: null,
  };
}

export function targetPitches(question: ExamQuestion) {
  if (question.type === 'intervalConnection' && Array.isArray(question.chords)) {
    return (question.chords as number[][]).flat();
  }
  if (question.type === 'chord') return question.midis || [];
  if (Array.isArray(question.answer) && question.answer.every((value) => typeof value === 'number')) {
    return question.answer as number[];
  }
  return question.midis || [];
}

export function expectedQuality(question: ExamQuestion) {
  if (question.type === 'interval') return String(question.intervalName || '');
  if (question.type === 'chord') return `${String(question.chordName || '')}和弦 · ${String(question.inversionName || '原位')}`;
  return '';
}

export function needsQuality(question: ExamQuestion) {
  const mode = String(question.answerMode || '');
  return Boolean(question.qualityRequired) || mode === 'qualityFill' || mode === 'choiceFill' || mode.includes('quality');
}

export function needsPitch(question: ExamQuestion) {
  if (question.choice) return false;
  const mode = String(question.answerMode || 'staff');
  if (mode === 'qualityFill' || mode === 'choiceFill') return false;
  return !['rhythm', 'melody'].includes(question.type);
}

export function isTimedQuestion(question: ExamQuestion) {
  return question.type === 'rhythm' || question.type === 'melody';
}

export function totalQuestionBeats(question: ExamQuestion) {
  const durations = question.type === 'rhythm' ? question.beats || [] : question.durs || [];
  return durations.reduce((sum, duration) => sum + Math.abs(Number(duration) || 0), 0);
}

export function scoreQuestion(question: ExamQuestion, answer: ExamAnswer): QuestionScore {
  const totalPoints = Number(question.points) || Number(question.examPoints) || 1;
  if (question.choice) {
    const correct = answer.choiceIndex === question.choice.correctIndex;
    return { score: correct ? totalPoints : 0, total: totalPoints, ratio: correct ? 1 : 0, correct };
  }

  if (isTimedQuestion(question)) {
    return timedExamScore(question, answer, totalPoints);
  }

  if (question.type === 'intervalConnection' && Array.isArray(question.chords)) {
    const chords = question.chords as number[][];
    let offset = 0;
    const correctPairs = chords.reduce((count, chord) => {
      const response = answer.pitches.slice(offset, offset + chord.length);
      offset += chord.length;
      return count + (sameUnorderedMidis(response, chord) ? 1 : 0);
    }, 0);
    const ratio = chords.length ? correctPairs / chords.length : 0;
    return { score: totalPoints * ratio, total: totalPoints, ratio, correct: ratio === 1 };
  }

  const pitchCorrect = !needsPitch(question) || (
    Boolean(question.harmonic) || question.type === 'chord'
      ? sameUnorderedMidis(answer.pitches, targetPitches(question))
      : sameOrderedMidis(answer.pitches, targetPitches(question))
  );
  const suppliedQuality = question.type === 'chord' && answer.inversion
    ? `${answer.quality} · ${answer.inversion}`
    : answer.quality;
  const qualityCorrect = !needsQuality(question) || suppliedQuality === expectedQuality(question);
  const correct = pitchCorrect && qualityCorrect;
  return { score: correct ? totalPoints : 0, total: totalPoints, ratio: correct ? 1 : 0, correct };
}

export function answerIsStarted(answer: ExamAnswer) {
  return Boolean(
    answer.pitches.length ||
    answer.accidentals?.length ||
    answer.events.length ||
    answer.meter ||
    answer.keySignature ||
    answer.quality ||
    answer.inversion ||
    answer.choiceIndex !== null
  );
}

export function answerIsComplete(question: ExamQuestion, answer: ExamAnswer) {
  if (question.choice) return answer.choiceIndex !== null;
  if (isTimedQuestion(question)) {
    if (!answer.meter || (question.type === 'melody' && !answer.keySignature)) return false;
    const targetBeats = Number(question.beatsPerBar) || meterCapacity(String(question.meter || ''), 4);
    const barCount = Number(question.examBars || question.barCount) || Math.max(1, Math.round(sumDuration(targetTimedEvents(question)) / targetBeats));
    const answerBeats = meterCapacity(answer.meter, targetBeats);
    return splitInputBars(answer.events, answerBeats, barCount).every((bar) => Math.abs(sumDuration(bar) - answerBeats) < 1e-6);
  }
  const targetCount = targetPitches(question).length;
  const pitchReady = !needsPitch(question) || (
    answer.pitches.length === targetCount
    && Array.from(answer.pitches).every(Number.isFinite)
  );
  const qualityReady = !needsQuality(question) || (question.type === 'chord'
    ? Boolean(answer.quality && (answer.inversion || answer.quality.includes(' · ')))
    : Boolean(answer.quality));
  return pitchReady && qualityReady;
}

function pitchName(midi: number, accidental: AccidentalMode = 'none', spelling?: string) {
  if (spelling) return formatPitchSpelling(midi, spelling);
  const symbol = accidental === 'sharp' ? '#' : accidental === 'flat' ? 'b' : accidental === 'natural' ? 'n' : '';
  if (!symbol) return formatPitchSpelling(midi);
  const naturalMidi = accidental === 'sharp' ? midi - 1 : accidental === 'flat' ? midi + 1 : midi;
  const natural = pitchSpellingParts(naturalMidi);
  return formatPitchSpelling(midi, `${natural.letter}${symbol}${natural.octave}`);
}

export function formatExamAnswer(question: ExamQuestion, answer: ExamAnswer) {
  if (!answerIsStarted(answer)) return '未作答';
  if (question.choice && answer.choiceIndex !== null) {
    const option = question.choice.options[answer.choiceIndex];
    return option?.text || `选项 ${option?.label || answer.choiceIndex + 1}`;
  }
  if (isTimedQuestion(question)) {
    const header = [answer.meter, question.type === 'melody' ? answer.keySignature : ''].filter(Boolean).join(' · ');
    return `${header ? `${header} · ` : ''}见谱面`;
  }
  const parts: string[] = [];
  if (answer.pitches.length) {
    parts.push(answer.pitches.flatMap((midi, index) => Number.isFinite(midi) ? [pitchName(midi, answer.accidentals[index], answer.spellings[index])] : []).join(' '));
  }
  if (answer.quality) parts.push(question.type === 'chord' && answer.inversion
    ? `${answer.quality} · ${answer.inversion}`
    : answer.quality);
  return parts.join(' · ') || '未作答';
}

export function formatCorrectAnswer(question: ExamQuestion) {
  if (question.choice) {
    const option = question.choice.options[question.choice.correctIndex];
    return option?.text || `选项 ${option?.label || question.choice.correctIndex + 1}`;
  }
  if (isTimedQuestion(question)) return '见绿色谱面';
  const parts: string[] = [];
  if (needsPitch(question)) parts.push(question.answerText || '见绿色谱面');
  if (needsQuality(question)) parts.push(expectedQuality(question));
  return parts.filter(Boolean).join(' · ') || question.answerText || '见绿色谱面';
}

export const INTERVAL_QUALITIES = [
  '小二度', '大二度', '小三度', '大三度', '纯四度', '增四度',
  '纯五度', '小六度', '大六度', '小七度', '大七度', '纯八度',
];

export const CHORD_QUALITY_NAMES = ['大三和弦', '小三和弦', '增三和弦', '减三和弦'];
export const CHORD_INVERSIONS = ['原位', '第一转位', '第二转位'];
export const CHORD_QUALITIES = CHORD_QUALITY_NAMES
  .flatMap((quality) => CHORD_INVERSIONS.map((inversion) => `${quality} · ${inversion}`));
