// 与 core/index.ts 的 PracticeType 对齐；连接题的题目 type 为 intervalConnection，
// 统一归一化为 connection，保证统计 / 错题本 / 智能强化按同一题型键聚合。
const PRACTICE_TYPES = new Set(['single', 'group', 'interval', 'connection', 'chord', 'chordQuality', 'chordPitch', 'rhythm', 'melody']);
const PRACTICE_MODES = new Set([...PRACTICE_TYPES, 'adaptive']);
const PRACTICE_TYPE_ALIASES = { intervalConnection: 'connection' };
const ACCIDENTALS = new Set(['none', 'sharp', 'flat', 'natural']);
const PRACTICE_PHASES = new Set(['ready', 'answering', 'feedback']);
const HIGHLIGHTS = new Set(['correct', 'wrong', 'std']);

function canonicalType(type) {
  const value = String(type || '');
  return PRACTICE_TYPE_ALIASES[value] || value;
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizePracticeRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = object(entry);
    const type = canonicalType(record && record.type);
    if (!record || !text(record.id) || !PRACTICE_TYPES.has(type) || typeof record.correct !== 'boolean') return [];
    return [{
      ...record,
      id: record.id,
      type,
      correct: record.correct,
      createdAt: number(record.createdAt),
      ...(text(record.sessionId) ? { sessionId: record.sessionId } : {}),
      ...(text(record.modeName) ? { modeName: record.modeName } : {}),
    }];
  });
}

function normalizeWrongRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = object(entry);
    const question = object(record?.question);
    const type = canonicalType(record?.type);
    if (!record || !question || !text(record.id) || !text(record.knowledgeKey) || !PRACTICE_TYPES.has(type)) return [];
    const typeName = text(record.typeName, text(question.typeName, type));
    const answerText = text(record.answerText, text(question.answerText));
    return [{
      ...record,
      id: record.id,
      knowledgeKey: record.knowledgeKey,
      type,
      typeName,
      answerText,
      errorCount: Math.max(1, Math.floor(number(record.errorCount, 1))),
      lastWrongAt: number(record.lastWrongAt),
      question: {
        ...question,
        type: type === 'connection' ? 'intervalConnection' : type,
        typeName,
        answerText,
        knowledgeKey: text(question.knowledgeKey, record.knowledgeKey),
      },
    }];
  });
}

function normalizeAnswer(value) {
  const answer = object(value) || {};
  const pitches = Array.isArray(answer.pitches)
    ? answer.pitches.map((pitch) => Number.isFinite(pitch) ? Number(pitch) : Number.NaN)
    : [];
  const spellings = Array.isArray(answer.spellings) ? answer.spellings.map((item) => text(item)) : [];
  const accidentals = Array.isArray(answer.accidentals)
    ? answer.accidentals.map((item) => ACCIDENTALS.has(item) ? item : 'none')
    : [];
  const events = Array.isArray(answer.events) ? answer.events.flatMap((entry) => {
    const event = object(entry);
    if (!event || !Number.isFinite(event.midi) || !Number.isFinite(event.duration) || Number(event.duration) === 0) return [];
    return [{
      ...event,
      midi: Number(event.midi),
      duration: Number(event.duration),
      ...(event.rest === true || event.duration < 0 ? { rest: true } : {}),
      ...(ACCIDENTALS.has(event.accidental) ? { accidental: event.accidental } : {}),
      ...(text(event.spelling) ? { spelling: event.spelling } : {}),
      ...(Number.isFinite(event.barIndex) ? { barIndex: Math.max(0, Math.floor(Number(event.barIndex))) } : {}),
      ...(Number.isFinite(event.inputOrder) ? { inputOrder: Math.max(0, Math.floor(Number(event.inputOrder))) } : {}),
      // 连音线参与判题签名（answer-sync.eventSignature）⇒ 必须显式保留，
      // 否则重载后 tieToNext 丢失、已答对的节奏题会被重判为错。
      ...(event.tieToNext === true ? { tieToNext: true } : {}),
      ...(event.tieFromPrevious === true ? { tieFromPrevious: true } : {}),
    }];
  }) : [];
  return {
    pitches,
    spellings,
    accidentals,
    events,
    meter: text(answer.meter),
    keySignature: text(answer.keySignature),
    quality: text(answer.quality),
    inversion: text(answer.inversion),
    choiceIndex: Number.isInteger(answer.choiceIndex) && answer.choiceIndex >= 0 ? answer.choiceIndex : null,
  };
}

function validPracticeAnswer(value) {
  const answer = object(value);
  return Boolean(answer && Array.isArray(answer.pitches) && Array.isArray(answer.spellings) && Array.isArray(answer.accidentals) && Array.isArray(answer.events)
    && typeof answer.meter === 'string' && typeof answer.keySignature === 'string' && typeof answer.quality === 'string' && typeof answer.inversion === 'string'
    && (answer.choiceIndex === null || Number.isInteger(answer.choiceIndex)));
}

function normalizePracticeSnapshot(value) {
  const snapshot = object(value);
  if (!snapshot || !validPracticeAnswer(snapshot.answer) || !PRACTICE_PHASES.has(snapshot.phase) || typeof snapshot.correct !== 'boolean' || !Number.isFinite(snapshot.playCount) || Number(snapshot.playCount) < 0 || !object(snapshot.highlights)) return null;
  const highlights = {};
  for (const [midi, highlight] of Object.entries(snapshot.highlights)) {
    if (!Number.isFinite(Number(midi)) || !HIGHLIGHTS.has(highlight)) return null;
    highlights[Number(midi)] = highlight;
  }
  return {
    answer: normalizeAnswer(snapshot.answer),
    phase: snapshot.phase,
    correct: snapshot.correct,
    playCount: Math.floor(Number(snapshot.playCount)),
    highlights,
  };
}

function normalizePracticeSession(value, now = Date.now()) {
  const session = object(value);
  if (!session || session.version !== 1 || !PRACTICE_MODES.has(session.mode) || !text(session.sessionId) || !Array.isArray(session.questions) || !session.questions.length || !Array.isArray(session.snapshots)) return null;
  if (!session.questions.every((question) => object(question) && text(question.type))) return null;
  const snapshots = [];
  for (const snapshot of session.snapshots) {
    if (snapshot == null) {
      snapshots.push(undefined);
      continue;
    }
    const normalized = normalizePracticeSnapshot(snapshot);
    if (!normalized) return null;
    snapshots.push(normalized);
  }
  return {
    version: 1,
    mode: session.mode,
    ...(session.tier === 1 || session.tier === 2 || session.tier === 3 ? { tier: session.tier } : {}),
    questions: session.questions,
    snapshots,
    index: Math.max(0, Math.min(session.questions.length - 1, Math.floor(number(session.index)))),
    score: Math.max(0, Math.floor(number(session.score))),
    sessionId: session.sessionId,
    updatedAt: number(session.updatedAt, now),
  };
}

function normalizeExamSession(value, now = Date.now()) {
  const session = object(value);
  const paper = object(session?.paper);
  const framework = object(paper?.framework);
  if (!session || !paper || !framework || !Array.isArray(paper.questions)) return null;

  const questions = paper.questions.flatMap((entry) => {
    const question = object(entry);
    return question && text(question.id) && text(question.type) ? [question] : [];
  });
  if (!questions.length) return null;

  const savedAnswers = object(session.answers) || {};
  const savedPlayCounts = object(session.playCounts) || {};
  const questionIds = new Set(questions.map((question) => question.id));
  const answers = Object.fromEntries(questions.map((question) => [question.id, normalizeAnswer(savedAnswers[question.id])]));
  const playCounts = Object.fromEntries(questions.flatMap((question) => {
    const count = savedPlayCounts[question.id];
    return Number.isFinite(count) && Number(count) > 0 ? [[question.id, Math.floor(Number(count))]] : [];
  }));
  const unlockedIds = Array.isArray(session.unlockedIds)
    ? [...new Set(session.unlockedIds.filter((id) => typeof id === 'string' && questionIds.has(id)))]
    : [];
  const currentIndex = Math.min(questions.length - 1, Math.max(0, Math.floor(number(session.currentIndex))));

  return {
    ...session,
    paper: {
      ...paper,
      id: text(paper.id, `restored-${number(paper.createdAt, now)}`),
      provinceId: text(paper.provinceId, 'zhejiang'),
      provinceLabel: text(paper.provinceLabel, '模拟'),
      framework: {
        ...framework,
        title: text(framework.title, '未完成模拟卷'),
        year: text(framework.year),
      },
      questions,
      fullScore: number(paper.fullScore, questions.reduce((sum, question) => sum + number(question.points, 1), 0)),
      createdAt: number(paper.createdAt, now),
    },
    answers,
    playCounts,
    unlockedIds,
    currentIndex,
    updatedAt: number(session.updatedAt, number(paper.createdAt, now)),
  };
}

function normalizeExamResults(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const result = object(entry);
    if (!result || !text(result.id)) return [];
    return [{
      ...result,
      id: result.id,
      ...(text(result.paperId) ? { paperId: result.paperId } : {}),
      provinceId: text(result.provinceId, 'unknown'),
      provinceLabel: text(result.provinceLabel, '模拟'),
      frameworkTitle: text(result.frameworkTitle, '模拟考试'),
      score: Math.max(0, number(result.score)),
      total: Math.max(0, number(result.total)),
      correctCount: Math.max(0, Math.floor(number(result.correctCount))),
      questionCount: Math.max(0, Math.floor(number(result.questionCount))),
      createdAt: number(result.createdAt),
    }];
  });
}

/**
 * 练习统计聚合。与微信端 services/db.js 的 aggregate() 对齐，
 * 输入为「每题一条」的 PracticeRecord[]，输出首页 / 统计页所需的全部聚合字段。
 */
function aggregatePracticeStats(records) {
  const list = Array.isArray(records) ? records : [];
  const totalQuestions = list.length;
  const totalCorrect = list.filter((record) => record && record.correct === true).length;
  const overallAccuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const dateKey = (t) => {
    const d = new Date(Number(t));
    if (!Number.isFinite(d.getTime())) return null;
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  // 每日聚合
  const dailyMap = new Map();
  list.forEach((record) => {
    const key = dateKey(record.createdAt);
    if (!key) return;
    const cur = dailyMap.get(key) || { total: 0, correct: 0 };
    cur.total += 1;
    if (record.correct === true) cur.correct += 1;
    dailyMap.set(key, cur);
  });

  // 题型聚合
  const byType = {};
  list.forEach((record) => {
    const type = record.type || 'unknown';
    const target = byType[type] || { attempts: 0, correct: 0, wrong: 0 };
    target.attempts += 1;
    if (record.correct === true) target.correct += 1;
    target.wrong = target.attempts - target.correct;
    byType[type] = target;
  });
  Object.keys(byType).forEach((type) => {
    const item = byType[type];
    item.accuracy = item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0;
    item.errorRate = 100 - item.accuracy;
  });

  // 近 7 天每日正确率（今天为 index 6）
  const trend7day = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabels = ['一', '二', '三', '四', '五', '六', '今'];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - i));
    const key = dateKey(day.getTime());
    const d = dailyMap.get(key) || { total: 0, correct: 0 };
    trend7day.push({
      label: dayLabels[i],
      total: d.total,
      correct: d.correct,
      accuracy: d.total ? Math.round((d.correct / d.total) * 100) : 0,
      isToday: i === 6,
    });
  }
  const todayCount = trend7day[0].total;
  const todayAccuracy = trend7day[0].accuracy;

  // 连续练习天数（今天没记录不算断）
  const practiceDays = new Set();
  list.forEach((record) => {
    const key = dateKey(record.createdAt);
    if (key) practiceDays.add(key);
  });
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = dateKey(day.getTime());
    if (practiceDays.has(key)) streak += 1;
    else if (i === 0) continue;
    else break;
  }

  // 整体正确率趋势：整体 vs 前 6 天（不含今天）
  let prevTotal = 0;
  let prevCorrect = 0;
  for (let i = 0; i < trend7day.length - 1; i++) {
    prevTotal += trend7day[i].total;
    prevCorrect += trend7day[i].correct;
  }
  const prevAccuracy = prevTotal ? Math.round((prevCorrect / prevTotal) * 100) : null;
  const accuracyTrend = prevAccuracy === null ? null : overallAccuracy - prevAccuracy;

  // 会话数：按 sessionId（无 sessionId 时按记录 id）去重
  const sessionBuckets = new Map();
  list.forEach((record) => {
    const key = record.sessionId || record.id || '';
    if (!key) return;
    const bucket = sessionBuckets.get(key) || [];
    bucket.push(record);
    sessionBuckets.set(key, bucket);
  });
  const sessions = sessionBuckets.size;

  // 最近练习（按会话聚合）
  const recent = Array.from(sessionBuckets.values()).map((bucket) => {
    const correct = bucket.filter((record) => record.correct === true).length;
    return {
      id: bucket[0].sessionId || bucket[0].id,
      modeName: bucket[0].modeName || bucket[0].type,
      createdAt: Math.max(...bucket.map((record) => record.createdAt)),
      total: bucket.length,
      correct,
      accuracy: Math.round((correct / bucket.length) * 100),
    };
  }).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

  return {
    sessions,
    totalQuestions,
    accuracy: overallAccuracy,
    accuracyTrend,
    streak,
    trend7day,
    todayCount,
    todayAccuracy,
    byType,
    wrongByType: byType,
    recent,
  };
}

module.exports = {
  aggregatePracticeStats,
  normalizeAnswer,
  normalizeExamResults,
  normalizeExamSession,
  normalizePracticeSession,
  normalizePracticeRecords,
  normalizeWrongRecords,
};
