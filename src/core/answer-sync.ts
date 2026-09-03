import type { PracticeQuestion } from '@/core';
import type { ExamAnswer, NotationEvent } from '@/core/exam-answer';

const EPSILON = 1e-6;
export const STANDARD_MIDI = 69;

export function meterCapacity(meter: string, fallback = 4) {
  const [topText, bottomText] = String(meter || '').split('/');
  const top = Number(topText);
  const bottom = Number(bottomText) || 4;
  return Number.isFinite(top) && top > 0 ? top * 4 / bottom : fallback;
}

export function meterBeatScale(meter: string) {
  const bottom = Number(String(meter || '').split('/')[1]) || 4;
  return bottom / 4;
}

export function sumDuration(events: NotationEvent[]) {
  return events.reduce((sum, event) => sum + Math.abs(Number(event.duration) || 0), 0);
}

export function eventSignature(event: NotationEvent) {
  const duration = Math.round(Math.abs(Number(event.duration) || 0) * 1_000_000) / 1_000_000;
  if (event.rest || Number(event.duration) < 0) return `r:${duration}`;
  return `${event.midi}:${duration}`;
}

export function splitBars(events: NotationEvent[], beatsPerBar: number, barCount: number) {
  const bars = Array.from({ length: barCount }, () => [] as NotationEvent[]);
  let barIndex = 0;
  let elapsed = 0;
  for (const event of events) {
    if (barIndex >= barCount) break;
    const duration = Math.abs(Number(event.duration) || 0);
    if (elapsed + duration > beatsPerBar + EPSILON) return bars;
    bars[barIndex].push(event);
    elapsed += duration;
    if (Math.abs(elapsed - beatsPerBar) < EPSILON) {
      barIndex += 1;
      elapsed = 0;
    }
  }
  return bars;
}

export function splitInputBars(events: NotationEvent[], beatsPerBar: number, barCount: number) {
  if (!events.some((event) => Number.isInteger(event.barIndex))) return splitBars(events, beatsPerBar, barCount);
  const bars = Array.from({ length: barCount }, () => [] as NotationEvent[]);
  const durations = Array.from({ length: barCount }, () => 0);
  events.forEach((event) => {
    const barIndex = Number(event.barIndex);
    if (!Number.isInteger(barIndex) || barIndex < 0 || barIndex >= barCount) return;
    const duration = Math.abs(Number(event.duration) || 0);
    if (durations[barIndex] + duration > beatsPerBar + EPSILON) return;
    bars[barIndex].push(event);
    durations[barIndex] += duration;
  });
  return bars;
}

export function sameEventBar(actual: NotationEvent[], expected: NotationEvent[]) {
  return actual.length === expected.length
    && actual.every((event, index) => eventSignature(event) === eventSignature(expected[index]));
}

export function sameOrderedMidis(actual: number[], expected: number[]) {
  return actual.length === expected.length
    && expected.every((midi, index) => Number(actual[index]) === Number(midi));
}

export function sameUnorderedMidis(actual: number[], expected: number[]) {
  const left = actual.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const right = expected.slice().sort((a, b) => a - b);
  return sameOrderedMidis(left, right);
}

export function targetTimedEvents(question: PracticeQuestion): NotationEvent[] {
  const spellings = Array.isArray(question.spellings) ? question.spellings as string[] : [];
  if (question.type === 'rhythm') {
    return (question.beats || []).map((duration) => ({
      midi: STANDARD_MIDI,
      duration,
      rest: duration < 0,
    }));
  }
  return (question.durs || []).map((duration, index) => ({
    midi: Number(question.midis?.[index] ?? STANDARD_MIDI),
    spelling: spellings[index],
    duration,
    rest: duration < 0,
  }));
}

export function basicAnswerCorrect(question: PracticeQuestion, pitches: number[]) {
  const expected = (question.midis || []).map(Number);
  if (question.type === 'single') return sameOrderedMidis([pitches[0]], expected);
  const stacked = question.type === 'chord' || (question.type === 'interval' && Boolean(question.harmonic));
  return stacked ? sameUnorderedMidis(pitches, expected) : sameOrderedMidis(pitches, expected);
}

export type TimedReview = {
  correct: boolean;
  meterCorrect: boolean;
  keyCorrect: boolean;
  correctBars: number;
  barCount: number;
  targetBars: NotationEvent[][];
  actualBars: NotationEvent[][];
};

export function timedAnswerReview(question: PracticeQuestion, answer: ExamAnswer): TimedReview {
  const beatsPerBar = Number(question.beatsPerBar) || meterCapacity(String(question.meter || ''), 4);
  const barCount = Number(question.examBars || question.barCount) || Math.max(1, Math.round(
    sumDuration(targetTimedEvents(question)) / beatsPerBar,
  ));
  const targetBars = splitBars(targetTimedEvents(question), beatsPerBar, barCount);
  const answerCapacity = meterCapacity(answer.meter, beatsPerBar);
  const actualBars = splitInputBars(answer.events, answerCapacity, barCount);
  const correctBars = targetBars.reduce((count, bar, index) => count + (sameEventBar(actualBars[index] || [], bar) ? 1 : 0), 0);
  const meterCorrect = answer.meter === question.meter;
  const keyCorrect = question.type !== 'melody' || answer.keySignature === String(question.keySignature || 'C');
  return {
    correct: correctBars === barCount && meterCorrect && keyCorrect,
    meterCorrect,
    keyCorrect,
    correctBars,
    barCount,
    targetBars,
    actualBars,
  };
}

export function practiceAnswerCorrect(question: PracticeQuestion, answer: ExamAnswer) {
  return question.type === 'rhythm' || question.type === 'melody'
    ? timedAnswerReview(question, answer).correct
    : basicAnswerCorrect(question, answer.pitches);
}

export function timedExamScore(question: PracticeQuestion, answer: ExamAnswer, totalPoints: number) {
  const review = timedAnswerReview(question, answer);
  const setupShare = totalPoints * 0.1;
  let score = review.meterCorrect ? (question.type === 'melody' ? setupShare / 2 : setupShare) : 0;
  if (question.type === 'melody' && review.keyCorrect) score += setupShare / 2;
  score += (totalPoints - setupShare) * review.correctBars / Math.max(1, review.barCount);
  score = Math.round(score * 100) / 100;
  return { score, total: totalPoints, ratio: totalPoints ? score / totalPoints : 0, correct: review.correct };
}

