const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {
  aggregatePracticeStats,
  normalizeAnswer,
  normalizeExamResults,
  normalizeExamSession,
  normalizePracticeSession,
  normalizePracticeRecords,
  normalizeWrongRecords,
} = require('../src/core/local-data-normalize.js');

const root = path.resolve(__dirname, '..');
const localData = fs.readFileSync(path.join(root, 'src/services/local-data.ts'), 'utf8');
const practice = fs.readFileSync(path.join(root, 'src/app/practice.tsx'), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
    async multiRemove(keys) { keys.forEach((key) => values.delete(key)); },
  };
}

function loadLocalData(storage) {
  const output = ts.transpileModule(localData, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === '@react-native-async-storage/async-storage') return storage;
    if (id === '@/core/audio-settings') return { DEFAULT_AUDIO_VOLUME: 78, parseStoredVolume: (value, fallback = 78) => Number.isFinite(Number(value)) ? Number(value) : fallback };
    if (id === '@/core/provinces') return { PROVINCES: [] };
    if (id === '../core/local-data-normalize.js') return require('../src/core/local-data-normalize.js');
    throw new Error(`unexpected local-data dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const practiceAst = ts.createSourceFile('practice.tsx', practice, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = practiceAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'PracticeScreen');
const submit = screen?.body?.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'submit');
assert.ok(submit, '练习页必须保留提交处理器');
assert.ok(submit.body.statements.some((node) => ts.isIfStatement(node) && node.expression.getText(practiceAst).includes('submitting.current')), '提交处理器必须直接用提交锁拦截重复提交');

const answer = normalizeAnswer({ pitches: [60, null, '62'], events: null, choiceIndex: -1 });
assert.equal(answer.pitches.length, 3);
assert.equal(answer.pitches[0], 60);
assert.ok(Number.isNaN(answer.pitches[1]));
assert.ok(Number.isNaN(answer.pitches[2]));
assert.deepEqual(answer.events, []);
assert.equal(answer.choiceIndex, null);

const session = normalizeExamSession({
  paper: {
    createdAt: 12,
    provinceLabel: '浙江',
    framework: { title: '旧版试卷', year: '2025' },
    questions: [{ id: 'q1', type: 'single', points: 2 }, null, {}],
  },
  answers: { q1: { pitches: [69] } },
  currentIndex: 99,
}, 100);
assert.ok(session);
assert.equal(session.paper.questions.length, 1);
assert.equal(session.currentIndex, 0);
assert.equal(session.answers.q1.pitches[0], 69);
assert.deepEqual(session.playCounts, {});
assert.deepEqual(session.unlockedIds, []);

assert.deepEqual(normalizeExamSession({ paper: { framework: {}, questions: [] } }), null);
assert.equal(normalizePracticeRecords([null, { id: 'r1', type: 'single', correct: true, createdAt: 1 }]).length, 1);
assert.equal(normalizeWrongRecords([{}, { id: 'w1', knowledgeKey: 'k1', type: 'single', question: {} }]).length, 1);
assert.equal(normalizeExamResults([null, { id: 'e1', provinceLabel: null, score: 'x' }])[0].provinceLabel, '模拟');

// 全题型保留 + 连接题 type 归一化（微信端 services/db.js 覆盖全部题型，iOS 不得再丢弃新题型记录）
const expanded = normalizePracticeRecords([
  { id: 'g1', type: 'group', correct: false, createdAt: 1 },
  { id: 'c1', type: 'intervalConnection', correct: true, createdAt: 2 },
  { id: 'q1', type: 'chordQuality', correct: true, createdAt: 3 },
  { id: 'p1', type: 'chordPitch', correct: false, createdAt: 4 },
  { id: 'x1', type: 'bogus', correct: true, createdAt: 5 },
]);
assert.equal(expanded.length, 4, 'group/connection/chordQuality/chordPitch 记录必须保留，非法 type 丢弃');
assert.equal(expanded.find((record) => record.id === 'c1').type, 'connection', 'intervalConnection 需归一化为 connection');

const now = Date.now();
const stats = aggregatePracticeStats([
  { id: 'a', type: 'single', correct: true, createdAt: now, sessionId: 's1', modeName: '单音' },
  { id: 'b', type: 'single', correct: false, createdAt: now, sessionId: 's1', modeName: '单音' },
  { id: 'c', type: 'rhythm', correct: true, createdAt: now, sessionId: 's2', modeName: '节奏' },
]);
assert.equal(stats.totalQuestions, 3);
assert.equal(stats.accuracy, 67);
assert.equal(stats.todayCount, 3);
assert.equal(stats.streak, 1);
assert.equal(stats.sessions, 2);
assert.equal(stats.byType.single.attempts, 2);
assert.equal(stats.byType.single.accuracy, 50);
assert.equal(stats.byType.rhythm.attempts, 1);
assert.equal(stats.trend7day.length, 7);
assert.equal(stats.trend7day[0].isToday, true);
assert.equal(stats.recent.length, 2);

const emptyPracticeAnswer = { pitches: [], spellings: [], accidentals: [], events: [], meter: '', keySignature: '', quality: '', inversion: '', choiceIndex: null };
const practiceQuestion = { type: 'single', typeName: '单音', answer: [60], answerText: 'C4', hint: '', knowledgeKey: 'single-c4' };
const practiceSession = {
  version: 1,
  mode: 'single',
  questions: [practiceQuestion, { ...practiceQuestion, knowledgeKey: 'single-d4' }],
  snapshots: [
    { answer: { ...emptyPracticeAnswer, pitches: [60, undefined] }, phase: 'feedback', correct: true, playCount: 1, highlights: { 60: 'correct' } },
    { answer: emptyPracticeAnswer, phase: 'ready', correct: false, playCount: 0, highlights: {} },
  ],
  index: 1,
  score: 1,
  sessionId: 'practice-smoke',
  updatedAt: 1,
};
const restoredPracticeSession = normalizePracticeSession(JSON.parse(JSON.stringify(practiceSession)));
assert.ok(restoredPracticeSession, 'JSON 往返后的练习会话必须可恢复');
assert.equal(restoredPracticeSession.snapshots[0].phase, 'feedback', '已答题快照必须保留反馈状态');
assert.equal(restoredPracticeSession.snapshots[0].answer.pitches[0], 60);
assert.ok(Number.isNaN(restoredPracticeSession.snapshots[0].answer.pitches[1]), '序列化后的音高空位必须归一化');
assert.equal(restoredPracticeSession.snapshots[1].phase, 'ready', '未答题快照必须保留准备状态');
assert.equal(normalizePracticeSession({ ...practiceSession, snapshots: [{}] }), null, '不完整快照不得进入练习页');
assert.equal(normalizePracticeSession({ ...practiceSession, snapshots: [{ ...practiceSession.snapshots[0], answer: undefined }] }), null, '缺少答案的近完整快照不得进入练习页');
assert.equal(normalizePracticeSession({ ...practiceSession, snapshots: [{ ...practiceSession.snapshots[0], highlights: { 60: 'invalid' } }] }), null, '含非法高亮状态的近完整快照不得进入练习页');

const storage = memoryStorage();
const local = loadLocalData(storage);
(async () => {
  await local.savePracticeSession(practiceSession);
  assert.equal(JSON.parse(storage.values.get('ios_active_practice_v1')).version, 1, '练习会话必须写入版本化键');
  assert.equal((await local.getActivePracticeSession()).snapshots[1].phase, 'ready', '存储读取必须恢复未答题快照');
  await local.clearActivePracticeSession();
  assert.equal(await local.getActivePracticeSession(), null, '重新开始必须清除活动练习会话');

  const finalized = new Set();
  const firstScore = local.finalizePracticeSubmission(finalized, 0, 0, true);
  const secondScore = local.finalizePracticeSubmission(finalized, 0, firstScore, true);
  assert.equal(firstScore, 1, '首次提交正确答案必须增加分数');
  assert.equal(secondScore, firstScore, '同一题第二次完成不得重复增加分数');

  await local.savePracticeResult(practiceQuestion, false, { sessionId: 'practice-smoke', submissionKey: 'practice-smoke:0' });
  await local.savePracticeResult(practiceQuestion, false, { sessionId: 'practice-smoke', submissionKey: 'practice-smoke:0' });
  assert.equal((await local.getPracticeRecords()).length, 1, '重复提交不得增加练习记录');
  const wrongs = await local.getWrongRecords();
  assert.equal(wrongs.length, 1, '重复提交不得重复写入错题本');
  assert.equal(wrongs[0].errorCount, 1, '重复提交不得增加错题次数');

  console.log('local data smoke passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
