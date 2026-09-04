import type { PracticeQuestion, PracticeType } from '@/core';

export type ProvinceRegion = '华北' | '东北' | '华东' | '中南' | '西南' | '西北';

export const PROVINCES = [
  // 华北
  { id: 'beijing', label: '北京', region: '华北' as const },
  { id: 'tianjin', label: '天津', region: '华北' as const },
  { id: 'hebei', label: '河北', region: '华北' as const },
  { id: 'shanxi', label: '山西', region: '华北' as const },
  { id: 'neimenggu', label: '内蒙古', region: '华北' as const },
  // 东北
  { id: 'liaoning', label: '辽宁', region: '东北' as const },
  { id: 'jilin', label: '吉林', region: '东北' as const },
  { id: 'heilongjiang', label: '黑龙江', region: '东北' as const },
  // 华东
  { id: 'shanghai', label: '上海', region: '华东' as const },
  { id: 'jiangsu', label: '江苏', region: '华东' as const },
  { id: 'zhejiang', label: '浙江', region: '华东' as const },
  { id: 'anhui', label: '安徽', region: '华东' as const },
  { id: 'fujian', label: '福建', region: '华东' as const },
  { id: 'jiangxi', label: '江西', region: '华东' as const },
  { id: 'shandong', label: '山东', region: '华东' as const },
  // 中南
  { id: 'henan', label: '河南', region: '中南' as const },
  { id: 'hubei', label: '湖北', region: '中南' as const },
  { id: 'hunan', label: '湖南', region: '中南' as const },
  { id: 'guangdong', label: '广东', region: '中南' as const },
  { id: 'guangxi', label: '广西', region: '中南' as const },
  { id: 'hainan', label: '海南', region: '中南' as const },
  // 西南
  { id: 'chongqing', label: '重庆', region: '西南' as const },
  { id: 'sichuan', label: '四川', region: '西南' as const },
  { id: 'guizhou', label: '贵州', region: '西南' as const },
  { id: 'yunnan', label: '云南', region: '西南' as const },
  { id: 'xizang', label: '西藏', region: '西南' as const },
  // 西北
  { id: 'shaanxi', label: '陕西', region: '西北' as const },
  { id: 'gansu', label: '甘肃', region: '西北' as const },
  { id: 'qinghai', label: '青海', region: '西北' as const },
  { id: 'ningxia', label: '宁夏', region: '西北' as const },
  { id: 'xinjiang', label: '新疆', region: '西北' as const },
] as const;

export type ProvinceId = typeof PROVINCES[number]['id'];

/** 拥有专属真题框架的省份 id（与 legacy/province-frameworks.js 的 key 对齐，不含 national）。 */
export const DEDICATED_PROVINCE_IDS = [
  'guangxi', 'jiangsu', 'chongqing', 'gansu', 'hebei', 'henan', 'heilongjiang',
  'hubei', 'hunan', 'jiangxi', 'liaoning', 'neimenggu', 'shandong', 'shanxi',
  'shaanxi', 'zhejiang',
] as const;

/**
 * 各省 → 各 section key → 难度档 tier。
 * 难度定义见 `src/core/legacy/question.js` 的 SINGLE_TIERS / GROUP_TIERS / INTERVAL_TIERS /
 * CHORD_TIERS / RHYTHM_TIERS / MELODY_TIERS / CONNECTION_TIERS。
 * 数据来源：`各省练耳真题/` 答案 PDF 真实特征汇总，详见
 * `练耳统考·题型扩充 08 各省难度映射.md`。
 * 命中规则：`expandedStaffSections` 给每个 section 自动注入 `tier`；section 已显式声明 `tier` 时优先级更高（保留省份自定义能力）。
 * 未命中时回退到默认行为（向后兼容，旧逻辑不变）。
 */
export const PROVINCE_TIER_BY_SECTION: Partial<Record<ProvinceId | 'national', Record<string, 1 | 2 | 3>>> = {
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
  choiceGroups?: { key: string; title?: string; items?: ExamSection[] }[];
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

/** 省份是否拥有专属真题框架（否则回退到全国通用模板 national）。 */
export function hasDedicatedFramework(id: string): boolean {
  return Boolean(id) && Boolean(frameworkCore.PROVINCE_FRAMEWORKS[id]);
}

/** 解析实际取题用的框架 id；无专属框架时回退 national。 */
export function resolveFrameworkId(id: string): string {
  return frameworkCore.PROVINCE_FRAMEWORKS[id] ? id : 'national';
}

/** 省份 label 查询；未知 id 原样返回。 */
export function getProvinceLabel(id: string): string {
  return PROVINCES.find((province) => province.id === id)?.label || String(id || '');
}

function expandedStaffSections(sections: ExamSection[], provinceId?: ProvinceId | string) {
  const tierMap = (provinceId && PROVINCE_TIER_BY_SECTION[provinceId as ProvinceId | 'national'])
    || PROVINCE_TIER_BY_SECTION.national
    || {};
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

/** 专项练习模块（由省份真题框架推导）。type 即出题器题型 key。 */
export type ProvincePracticeModule = {
  type: PracticeType;
  name: string;
  desc: string;
  tier: 1 | 2 | 3;
  icon: string;
  tone: 'mint' | 'accent' | 'coral' | 'amber';
  answerMode: string;
  qualityRequired?: boolean;
};

/** 通用专项模块展示文案；按省份框架命中的 section 依次取用。 */
const PRACTICE_MODULE_META: Record<string, { name: string; desc: string; icon: string; tone: 'mint' | 'accent' | 'coral' | 'amber'; answerMode: string; qualityRequired?: boolean }> = {
  single:       { name: '单音听辨', desc: '听单音，写出音高', icon: 'single-note', tone: 'mint', answerMode: 'staff' },
  group:        { name: '旋律音组', desc: '听三/四/五音组，按顺序写音高', icon: 'interval', tone: 'accent', answerMode: 'staff' },
  interval:     { name: '音程听辨', desc: '听旋律/和声音程，写出两个音', icon: 'interval', tone: 'accent', answerMode: 'staff' },
  connection:   { name: '和声音程连接', desc: '连续五个和声音程，逐组写音高', icon: 'interval', tone: 'coral', answerMode: 'staff' },
  chord:        { name: '和弦听辨', desc: '听和弦，写出音高与性质', icon: 'chord', tone: 'coral', answerMode: 'staff' },
  chordQuality: { name: '和弦性质', desc: '听和弦，只写性质', icon: 'chord', tone: 'coral', answerMode: 'qualityFill', qualityRequired: true },
  chordPitch:   { name: '和弦音高', desc: '听和弦，只写音高', icon: 'chord', tone: 'coral', answerMode: 'staff' },
  rhythm:       { name: '节奏听辨', desc: '听节奏，写出节奏谱', icon: 'rhythm', tone: 'amber', answerMode: 'rhythmStaff' },
  melody:       { name: '旋律听辨', desc: '听旋律，写出旋律谱', icon: 'treble', tone: 'accent', answerMode: 'melodyStaff' },
};

/** 真题 section/item key → 专项模块 key；choice 省份的细分选择题归并到对应技能模块。 */
const SECTION_TO_MODULE: Record<string, string> = {
  single: 'single',
  group: 'group',
  interval: 'interval',
  connection: 'connection',
  chord: 'chord',
  chordQuality: 'chordQuality',
  chordPitch: 'chordPitch',
  rhythm: 'rhythm',
  melody: 'melody',
  // 河南选择题细分项
  melodicIntervalPitch: 'interval',
  melodicIntervalQuality: 'interval',
  harmonicIntervalPitch: 'interval',
  harmonicIntervalQuality: 'interval',
  // 浙江选择题细分项（调式/音阶类无对应技能模块，跳过）
  noteGroup1: 'group',
  noteGroup2: 'group',
  intervalQuality: 'interval',
  intervalPitch: 'interval',
  rhythmPattern: 'rhythm',
  rhythmMeter: 'rhythm',
  rhythmOrder: 'rhythm',
  missingRhythmBar: 'rhythm',
  melodyMeter: 'melody',
  missingMelodyBar: 'melody',
  melodyOrder: 'melody',
};

/**
 * 从省份真题框架推导「专项练习」模块列表：
 * - staff 省份按 sections 顺序取题型，去重后生成模块；
 * - choice 省份（河南/浙江）按 choiceGroups 的 items 归并到技能模块。
 * tier 取自 PROVINCE_TIER_BY_SECTION，未命中回退到 3（冲刺档）。
 */
export function getProvincePracticeModules(id: ProvinceId): ProvincePracticeModule[] {
  const frameworks = getProvinceVariants(id);
  const tierMap = PROVINCE_TIER_BY_SECTION[id] || PROVINCE_TIER_BY_SECTION.national || {};
  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (sourceKey: string) => {
    const moduleKey = SECTION_TO_MODULE[sourceKey];
    if (!moduleKey || seen.has(moduleKey)) return;
    seen.add(moduleKey);
    ordered.push(moduleKey);
  };

  frameworks.forEach((framework) => {
    if (framework.template === 'choice' && framework.choiceGroups?.length) {
      framework.choiceGroups.forEach((group) => (group.items || []).forEach((item) => push(String(item.key))));
    } else {
      framework.sections.forEach((section) => push(String(section.key)));
    }
  });

  return ordered.map((key) => {
    const meta = PRACTICE_MODULE_META[key];
    const tier = Number(tierMap[key]) === 1 || Number(tierMap[key]) === 2 ? Number(tierMap[key]) as 1 | 2 : 3;
    return {
      type: key as PracticeType,
      name: meta.name,
      desc: meta.desc,
      icon: meta.icon,
      tone: meta.tone,
      answerMode: meta.answerMode,
      qualityRequired: meta.qualityRequired,
      tier,
    };
  });
}
