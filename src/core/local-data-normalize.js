const PRACTICE_TYPES = new Set(['single', 'interval', 'chord', 'rhythm', 'melody']);
const ACCIDENTALS = new Set(['none', 'sharp', 'flat', 'natural']);

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
    if (!record || !text(record.id) || !PRACTICE_TYPES.has(record.type) || typeof record.correct !== 'boolean') return [];
    return [{
      ...record,
      id: record.id,
      type: record.type,
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
    const type = record?.type;
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
        type,
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
    if (!event || !Number.isFinite(event.midi) || !Number.isFinite(event.duration) || Number(event.duration) <= 0) return [];
    return [{
      ...event,
      midi: Number(event.midi),
      duration: Number(event.duration),
      ...(event.rest === true ? { rest: true } : {}),
      ...(ACCIDENTALS.has(event.accidental) ? { accidental: event.accidental } : {}),
      ...(text(event.spelling) ? { spelling: event.spelling } : {}),
      ...(Number.isFinite(event.barIndex) ? { barIndex: Math.max(0, Math.floor(Number(event.barIndex))) } : {}),
      ...(Number.isFinite(event.inputOrder) ? { inputOrder: Math.max(0, Math.floor(Number(event.inputOrder))) } : {}),
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

module.exports = {
  normalizeAnswer,
  normalizeExamResults,
  normalizeExamSession,
  normalizePracticeRecords,
  normalizeWrongRecords,
};
