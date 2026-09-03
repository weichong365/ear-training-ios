import type { PracticeQuestion } from '@/core';

export const PROVINCES = [
  { id: 'guangxi', label: '广西' },
  { id: 'jiangsu', label: '江苏' },
  { id: 'chongqing', label: '重庆' },
  { id: 'gansu', label: '甘肃' },
  { id: 'hebei', label: '河北' },
  { id: 'henan', label: '河南' },
  { id: 'heilongjiang', label: '黑龙江' },
  { id: 'hubei', label: '湖北' },
  { id: 'hunan', label: '湖南' },
  { id: 'jiangxi', label: '江西' },
  { id: 'liaoning', label: '辽宁' },
  { id: 'neimenggu', label: '内蒙古' },
  { id: 'shandong', label: '山东' },
  { id: 'shanxi', label: '山西' },
  { id: 'shaanxi', label: '陕西' },
  { id: 'zhejiang', label: '浙江' },
] as const;

export type ProvinceId = typeof PROVINCES[number]['id'];

/**
 * 各省 → 各 section key → 难度档 tier。
 * 难度定义见 `src/core/legacy/question.js` 的 SINGLE_TIERS / GROUP_TIERS / INTERVAL_TIERS /
 * CHORD_TIERS / RHYTHM_TIERS / MELODY_TIERS / CONNECTION_TIERS。
 * 数据来源：`各省练耳真题/` 答案 PDF 真实特征汇总，详见
 * `练耳统考·题型扩充 08 各省难度映射.md`。
 * 命中规则：`expandedStaffSections` 给每个 section 自动注入 `tier`；section 已显式声明 `tier` 时优先级更高（保留省份自定义能力）。
 * 未命中时回退到默认行为（向后兼容，旧逻辑不变）。
 */
export const PROVINCE_TIER_BY_SECTION: Record<ProvinceId | 'national', Record<string, 1 | 2 | 3>> = {
  national:       { single: 3, group: 3, interval: 3, connection: 3, chord: 3, rhythm: 3, melody: 3 },
  guangxi:        { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  jiangsu:        { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  chongqing:      { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  gansu:          { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  hebei:          { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  heilongjiang:   { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  hubei:          { single: 2, group: 2, interval: 2, chord: 2, rhythm: 2, melody: 2 },
  hunan:          { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  jiangxi:        { single: 3, group: 3, interval: 3, connection: 3, chord: 3, rhythm: 3, melody: 3 },
  liaoning:       { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  neimenggu:      { single: 3, group: 3, interval: 3, chordQuality: 3, rhythm: 3, melody: 3 },
  shandong:       { single: 3, group: 3, interval: 3, chordQuality: 3, chordPitch: 3, rhythm: 3, melody: 3 },
  shanxi:         { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  shaanxi:        { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  henan:          { choiceAural: 3, choiceRhythmMelody: 3 },
  zhejiang:       { choice: 3 },
};

export type ExamSection = {
  key: string;
  title: string;
  count: number;
  repeats?: number;
  points?: number | null;
  answerMode?: string;
  items?: ExamSection[];
  [key: string]: unknown;
};

export type ProvinceFramework = {
  id: ProvinceId;
  label: string;
  template: 'staff' | 'choice' | 'jiangsu';
  year: string;
  title: string;
  fullScore: number | null;
  sections: ExamSection[];
  sourceConfirmed: boolean;
  sourceYears: string[];
  variantIndex: number;
};

export type ChoiceOption = {
  label: string;
  text?: string;
  events?: { midis?: number[]; dur?: number; rest?: boolean; barIndex?: number }[];
  meter?: string;
  keySignature?: string;
  barCount?: number;
};

export type ExamQuestion = PracticeQuestion & {
  id: string;
  points: number;
  sectionTitle: string;
  answerMode?: string;
  choice?: {
    correctIndex: number;
    options: ChoiceOption[];
  };
};

export type ProvincePaper = {
  id: string;
  provinceId: ProvinceId;
  provinceLabel: string;
  framework: ProvinceFramework;
  questions: ExamQuestion[];
  fullScore: number;
  createdAt: number;
};

type ProvinceFrameworkModule = {
  getProvinceFramework(id: string, random?: () => number): ProvinceFramework | null;
  PROVINCE_FRAMEWORKS: Record<string, { variants: unknown[] }>;
};

type GeneratedExam = {
  singles: PracticeQuestion[];
  groups: PracticeQuestion[];
  intervals: PracticeQuestion[];
  connectionQuestion: PracticeQuestion | null;
  chords: PracticeQuestion[];
  rhythmQuestions: PracticeQuestion[];
  melodyQuestions: PracticeQuestion[];
};

type ExamQuestionModule = {
  generateExamFromSections(sections: ExamSection[]): GeneratedExam;
};

type ChoiceQuestion = {
  id: string;
  sectionTitle: string;
  title: string;
  repeatCount: number;
  correctIndex: number;
  points: number;
  audio: PracticeQuestion;
  options: ChoiceOption[];
};

type ChoicePaperModule = {
  buildChoicePaper(framework: Record<string, unknown>): { choiceQuestions: ChoiceQuestion[] };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const frameworkCore = require('./legacy/province-frameworks.js') as ProvinceFrameworkModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const questionCore = require('./legacy/question.js') as ExamQuestionModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const choiceCore = require('./legacy/choice-paper.js') as ChoicePaperModule;

function variantRandom(index: number, count: number) {
  return () => Math.max(0, Math.min(0.999999, (index + 0.1) / Math.max(1, count)));
}

export function getProvinceFramework(id: ProvinceId, variantIndex = 0) {
  const sourceId = frameworkCore.PROVINCE_FRAMEWORKS[id] ? id : 'national';
  const count = frameworkCore.PROVINCE_FRAMEWORKS[sourceId]?.variants?.length || 1;
  const resolved = frameworkCore.getProvinceFramework(sourceId, variantRandom(variantIndex, count));
  if (!resolved) throw new Error(`没有找到 ${id} 的试卷框架`);
  if (sourceId === id) return resolved;
  const label = PROVINCES.find((province) => province.id === id)?.label || id;
  return {
    ...resolved,
    id,
    label,
    title: `${label}省音乐类统考模拟训练（全国通用框架）`,
    sourceConfirmed: false,
    sourceYears: [],
  };
}

export function getProvinceVariants(id: ProvinceId) {
  const count = frameworkCore.PROVINCE_FRAMEWORKS[id]?.variants?.length || 1;
  return Array.from({ length: count }, (_, index) => getProvinceFramework(id, index));
}

function expandedStaffSections(sections: ExamSection[], provinceId?: ProvinceId | string) {
  const tierMap = (provinceId && PROVINCE_TIER_BY_SECTION[provinceId as ProvinceId | 'national'])
    || PROVINCE_TIER_BY_SECTION.national;
  return sections.flatMap((section) => {
    if (!section.items?.length || !['group', 'interval'].includes(section.key)) {
      return [{
        ...section,
        sourceSectionKey: section.key,
        sourceSectionTitle: section.title,
        tier: section.tier || tierMap[section.key]
      }];
    }
    return section.items.map((item) => ({
      ...section,
      ...item,
      key: section.key,
      title: item.title || section.title,
      sourceSectionKey: item.key,
      sourceSectionTitle: item.title || section.title,
      items: undefined,
      tier: item.tier || tierMap[item.key] || tierMap[section.key]
    }));
  });
}

function flattenGenerated(generated: GeneratedExam) {
  return [
    ...generated.singles,
    ...generated.groups,
    ...generated.intervals,
    ...(generated.connectionQuestion ? [generated.connectionQuestion] : []),
    ...generated.chords,
    ...generated.rhythmQuestions,
    ...generated.melodyQuestions,
  ];
}

function staffPaper(framework: ProvinceFramework): ExamQuestion[] {
  const sections = expandedStaffSections(framework.sections, framework.id);
  const generated = flattenGenerated(questionCore.generateExamFromSections(sections));
  const sectionOrder = sections.map((section) => String(section.sourceSectionKey || section.key));
  generated.sort((left, right) => {
    const leftKey = String(left.sourceSectionKey || left.examSection || left.type);
    const rightKey = String(right.sourceSectionKey || right.examSection || right.type);
    return sectionOrder.indexOf(leftKey) - sectionOrder.indexOf(rightKey);
  });
  return generated.map((question, index) => ({
    ...question,
    id: `${framework.id}-${framework.year}-${index + 1}`,
    points: Number(question.examPoints) || 1,
    sectionTitle: String(question.sourceSectionTitle || question.typeName),
    answerMode: String(question.answerMode || 'staff'),
  }));
}

function choicePaper(framework: ProvinceFramework): ExamQuestion[] {
  const result = choiceCore.buildChoicePaper({
    ...framework,
    province: framework.label,
    name: framework.title,
  });
  return result.choiceQuestions.map((question) => ({
    ...question.audio,
    id: question.id,
    typeName: question.title,
    sectionTitle: question.sectionTitle,
    points: Number(question.points) || 1,
    repeatCount: question.repeatCount,
    answerMode: 'choice',
    answer: question.correctIndex,
    answerText: question.options[question.correctIndex]?.text || `选项 ${question.options[question.correctIndex]?.label}`,
    choice: {
      correctIndex: question.correctIndex,
      options: question.options,
    },
  }));
}

export function generateProvincePaper(id: ProvinceId, variantIndex = 0): ProvincePaper {
  const framework = getProvinceFramework(id, variantIndex);
  const questions = framework.template === 'choice' ? choicePaper(framework) : staffPaper(framework);
  const calculatedScore = questions.reduce((sum, question) => sum + question.points, 0);
  return {
    id: `${id}-${framework.year}-${Date.now()}`,
    provinceId: id,
    provinceLabel: framework.label,
    framework,
    questions,
    fullScore: Number(framework.fullScore) || calculatedScore,
    createdAt: Date.now(),
  };
}
