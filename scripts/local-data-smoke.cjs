const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  aggregatePracticeStats,
  normalizeAnswer,
  normalizeExamResults,
  normalizeExamSession,
  normalizePracticeRecords,
  normalizeWrongRecords,
} = require('../src/core/local-data-normalize.js');

const root = path.resolve(__dirname, '..');
const localData = fs.readFileSync(path.join(root, 'src/services/local-data.ts'), 'utf8');
const practice = fs.readFileSync(path.join(root, 'src/app/practice.tsx'), 'utf8');

assert.match(localData, /const ACTIVE_PRACTICE_KEY = 'ios_active_practice_v1';/, '练习进度必须使用独立的版本化存储键');
for (const operation of ['savePracticeSession', 'getActivePracticeSession', 'clearActivePracticeSession']) {
  assert.match(localData, new RegExp(`export async function ${operation}\\b`), `练习进度必须提供 ${operation}`);
}
assert.match(practice, /questionSnapshots(?:\.current)?\[targetIndex\]/, '恢复时必须按目标题号读取题目快照');
assert.match(practice, /const snapshot = questionSnapshots(?:\.current)?\[targetIndex\]/, '已答题快照必须可恢复');
assert.match(practice, /if \(!snapshot\)[\s\S]*?resetQuestionState\(\)/, '未答题快照必须恢复为空白作答状态');
assert.match(practice, /submitting\.current/, '重复提交必须由提交锁保护');
assert.match(practice, /setScore\(\(value\) => value \+ \(result \? 1 : 0\)\)/, '同一题重复提交不得重复累计分数');
const submitBody = practice.slice(practice.indexOf('async function submit()'), practice.indexOf('function capturePracticeSnapshot()'));
assert.equal((submitBody.match(/savePracticeResult\(/g) || []).length, 1, '每次提交只能保存一条练习记录');
assert.match(localData, /findIndex\(\(item\) => item\.knowledgeKey === question\.knowledgeKey\)/, '错题本必须按知识点更新，不能重复插入');

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

console.log('local data smoke passed');
