import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PracticeProfile, PracticeQuestion, PracticeType } from '@/core';
import { DEFAULT_AUDIO_VOLUME, parseStoredVolume } from '@/core/audio-settings';
import type { ExamAnswer } from '@/core/exam-answer';
import type { ProvincePaper } from '@/core/provinces';

type LocalDataNormalizer = {
  normalizePracticeRecords(value: unknown): PracticeRecord[];
  normalizeWrongRecords(value: unknown): WrongRecord[];
  normalizeExamSession(value: unknown): ExamSession | null;
  normalizeExamResults(value: unknown): ExamResultRecord[];
};

// 纯函数兼容层同时供 Node 回归脚本执行；不额外引入运行时依赖。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const normalizeLocalData = require('../core/local-data-normalize.js') as LocalDataNormalizer;

const RECORDS_KEY = 'ios_practice_records_v1';
const WRONGS_KEY = 'ios_wrong_questions_v1';
const ACTIVE_EXAM_KEY = 'ios_active_exam_v1';
const EXAM_RESULTS_KEY = 'ios_exam_results_v1';
const AUDIO_VOLUME_KEY = 'audio_volume';
let examSaveQueue: Promise<void> = Promise.resolve();

export type PracticeRecord = {
  id: string;
  type: PracticeType;
  correct: boolean;
  createdAt: number;
  sessionId?: string;
  modeName?: string;
};

export type WrongRecord = {
  id: string;
  knowledgeKey: string;
  type: PracticeType;
  typeName: string;
  answerText: string;
  errorCount: number;
  lastWrongAt: number;
  question: PracticeQuestion;
};

export type ExamSession = {
  paper: ProvincePaper;
  answers: Record<string, ExamAnswer>;
  playCounts: Record<string, number>;
  unlockedIds: string[];
  currentIndex: number;
  updatedAt: number;
};

export type ExamResultRecord = {
  id: string;
  paperId?: string;
  provinceId: string;
  provinceLabel: string;
  frameworkTitle: string;
  score: number;
  total: number;
  correctCount: number;
  questionCount: number;
  createdAt: number;
};

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function savePracticeResult(question: PracticeQuestion, correct: boolean, context: { sessionId?: string; modeName?: string } = {}) {
  const now = Date.now();
  const records = await readList<PracticeRecord>(RECORDS_KEY);
  records.unshift({
    id: `r_${now}_${Math.random().toString(36).slice(2, 7)}`,
    type: question.type as PracticeType,
    correct,
    createdAt: now,
    sessionId: context.sessionId,
    modeName: context.modeName,
  });
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, 1000)));

  if (!correct && question.type !== 'intervalConnection') {
    const wrongs = await readList<WrongRecord>(WRONGS_KEY);
    const index = wrongs.findIndex((item) => item.knowledgeKey === question.knowledgeKey);
    if (index >= 0) {
      wrongs[index] = {
        ...wrongs[index],
        question,
        answerText: question.answerText,
        errorCount: wrongs[index].errorCount + 1,
        lastWrongAt: now,
      };
      wrongs.unshift(wrongs.splice(index, 1)[0]);
    } else {
      wrongs.unshift({
        id: `w_${now}_${Math.random().toString(36).slice(2, 7)}`,
        knowledgeKey: question.knowledgeKey,
        type: question.type as PracticeType,
        typeName: question.typeName,
        answerText: question.answerText,
        errorCount: 1,
        lastWrongAt: now,
        question,
      });
    }
    await AsyncStorage.setItem(WRONGS_KEY, JSON.stringify(wrongs.slice(0, 300)));
  }
}

export async function getPracticeRecords() {
  return normalizeLocalData.normalizePracticeRecords(await readList<unknown>(RECORDS_KEY));
}

export async function getAudioVolume() {
  try {
    return parseStoredVolume(await AsyncStorage.getItem(AUDIO_VOLUME_KEY), DEFAULT_AUDIO_VOLUME);
  } catch {
    return DEFAULT_AUDIO_VOLUME;
  }
}

export async function saveAudioVolume(volume: number) {
  const normalized = parseStoredVolume(volume);
  await AsyncStorage.setItem(AUDIO_VOLUME_KEY, String(normalized));
  return normalized;
}

export async function getPracticeProfile(): Promise<PracticeProfile> {
  const records = await getPracticeRecords();
  const profile: PracticeProfile = {};
  records.forEach((record) => {
    const current = profile[record.type] || { attempts: 0, wrong: 0 };
    current.attempts = (current.attempts || 0) + 1;
    current.wrong = (current.wrong || 0) + (record.correct ? 0 : 1);
    profile[record.type] = current;
  });
  Object.values(profile).forEach((item) => {
    if (item?.attempts) item.errorRate = (Number(item.wrong) || 0) / item.attempts * 100;
  });
  return profile;
}

export async function getWrongRecords() {
  return normalizeLocalData.normalizeWrongRecords(await readList<unknown>(WRONGS_KEY));
}

export async function removeWrongRecord(id: string) {
  const wrongs = await readList<WrongRecord>(WRONGS_KEY);
  await AsyncStorage.setItem(WRONGS_KEY, JSON.stringify(wrongs.filter((item) => item.id !== id)));
}

export async function saveExamSession(session: ExamSession) {
  const payload = JSON.stringify({ ...session, updatedAt: Date.now() });
  examSaveQueue = examSaveQueue.catch(() => undefined).then(() => AsyncStorage.setItem(ACTIVE_EXAM_KEY, payload));
  await examSaveQueue;
}

export async function getActiveExamSession() {
  await examSaveQueue.catch(() => undefined);
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_EXAM_KEY);
    if (!raw) return null;
    return normalizeLocalData.normalizeExamSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearActiveExamSession() {
  // 等待仍在排队的自动保存完成，避免交卷清除后旧进度又被异步写回。
  await examSaveQueue.catch(() => undefined);
  await AsyncStorage.removeItem(ACTIVE_EXAM_KEY);
}

export async function saveExamResult(result: Omit<ExamResultRecord, 'id' | 'createdAt'>) {
  const results = await readList<ExamResultRecord>(EXAM_RESULTS_KEY);
  const now = Date.now();
  const next = result.paperId ? results.filter((item) => item.paperId !== result.paperId) : results;
  next.unshift({ ...result, id: `e_${now}_${Math.random().toString(36).slice(2, 7)}`, createdAt: now });
  await AsyncStorage.setItem(EXAM_RESULTS_KEY, JSON.stringify(next.slice(0, 100)));
}

export async function getExamResults() {
  return normalizeLocalData.normalizeExamResults(await readList<unknown>(EXAM_RESULTS_KEY));
}

export async function clearLocalPracticeData() {
  await examSaveQueue.catch(() => undefined);
  await AsyncStorage.multiRemove([RECORDS_KEY, WRONGS_KEY, ACTIVE_EXAM_KEY, EXAM_RESULTS_KEY]);
}
