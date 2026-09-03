const assert = require('node:assert/strict');
const {
  normalizeAnswer,
  normalizeExamResults,
  normalizeExamSession,
  normalizePracticeRecords,
  normalizeWrongRecords,
} = require('../src/core/local-data-normalize.js');

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

console.log('local data smoke passed');
