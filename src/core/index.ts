export type PracticeType =
  | 'single'
  | 'group'
  | 'interval'
  | 'connection'
  | 'chord'
  | 'chordQuality'
  | 'chordPitch'
  | 'rhythm'
  | 'melody';
export type PracticeMode = PracticeType | 'adaptive';

export type PracticeGenerateOptions = {
  tier?: 1 | 2 | 3;
};

export type PracticeProfile = Partial<Record<PracticeType, {
  attempts?: number;
  wrong?: number;
  errorRate?: number;
}>>;

export type PracticeQuestion = {
  type: PracticeType | 'intervalConnection';
  typeName: string;
  midis?: number[];
  durs?: number[];
  beats?: number[];
  bars?: number[][];
  bpm?: number;
  meter?: string;
  meterNumerator?: number;
  meterDenominator?: number;
  beatsPerBar?: number;
  harmonic?: boolean;
  answer: unknown;
  answerText: string;
  hint: string;
  repeatCount?: number;
  knowledgeKey: string;
  [key: string]: unknown;
};

type QuestionModule = {
  generate(type: PracticeType, options?: { tier?: 1 | 2 | 3 }): PracticeQuestion;
  generateSet(type: PracticeType | 'mixed' | 'adaptive', count?: number, profile?: PracticeProfile, options?: { tier?: 1 | 2 | 3 }): PracticeQuestion[];
};

type AnswerModule = {
  judgeQuestion(question: PracticeQuestion, answer: unknown): { correct: boolean; message?: string };
};

// 纯 JS 乐理模块与微信端保持同源；平台 API 均由 React Native 层接管。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const questionCore = require('./legacy/question.js') as QuestionModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const answerCore = require('./legacy/answer.js') as AnswerModule;

export function generateQuestion(type: PracticeType): PracticeQuestion {
  return questionCore.generate(type);
}

export function generateQuestionSet(type: PracticeMode, count = 10, profile: PracticeProfile = {}, options: PracticeGenerateOptions = {}): PracticeQuestion[] {
  return questionCore.generateSet(type, count, profile, options);
}

export function generateMixedExam(): PracticeQuestion[] {
  return questionCore.generateSet('mixed');
}

export function judgeQuestion(question: PracticeQuestion, answer: unknown) {
  return answerCore.judgeQuestion(question, answer);
}
