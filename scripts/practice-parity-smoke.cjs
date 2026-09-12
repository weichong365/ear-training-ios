const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  'src/app/practice.tsx',
  'src/components/answer-staff.tsx',
  'src/components/notation-editor.tsx',
  'src/components/piano-keyboard.tsx',
  'src/services/audio-engine.ts',
];
const source = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const practice = source['src/app/practice.tsx'];
const notation = source['src/components/notation-editor.tsx'];
const renderedPaths = Object.values(source)
  .map((value) => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))
  .flatMap((value) => [
    ...(value.match(/<Text\b[\s\S]*?<\/Text>/g) || []),
    ...(value.match(/<[A-Z][A-Za-z]+\b[^>]*\baccessibility(?:Label|Hint)=(?:"[^"]*"|'[^']*')[^>]*>/g) || []),
  ])
  .join('\n');

const requiredPracticeContracts = [
  "type Phase = 'ready' | 'answering' | 'feedback' | 'finished'",
  '上一题', '回放答案', '下一题', '剩余 ', '音量',
  '播放题目后开始作答', '提交答案并解锁键盘',
  '正确答案：', '你的答案：', '复盘钢琴',
];

for (const contract of requiredPracticeContracts) {
  assert.ok(practice.includes(contract), `practice parity marker missing: ${contract}`);
}

for (const forbidden of ['audioDiagnostic', 'operateAudio', 'jsapi', 'access denied']) {
  assert.ok(!renderedPaths.includes(forbidden), `forbidden rendered audio/debug text present: ${forbidden}`);
}

assert.match(practice, /function restorePracticeSnapshot\s*\(\s*snapshot[\s\S]*?setAnswer\(snapshot\.answer\)[\s\S]*?setPhase\(snapshot\.phase\)[\s\S]*?setCorrect\(snapshot\.correct\)[\s\S]*?setPlayCount\(snapshot\.playCount\)[\s\S]*?setHighlights\(snapshot\.highlights\)/, 'snapshot helper must restore answer, phase, correct, playCount, and highlights');
assert.match(practice, /function previous\s*\([\s\S]*?const previousSnapshot = questionSnapshots\[index - 1\][\s\S]*?restorePracticeSnapshot\(previousSnapshot\)[\s\S]*?setIndex\(\(value\) => value - 1\)/, 'previous-question handler must look up and restore the prior indexed snapshot');
assert.match(practice, /<Pressable\b[^>]*onPress=\{previous\}[^>]*>[\s\S]*?上一题[\s\S]*?<\/Pressable>/, '上一题 must be an actionable control wired to previous()');
assert.match(practice, /const volumeRow\s*=\s*<View[\s\S]*?styles\.volumeRow/, 'volume controls must be defined as one named render value');
assert.match(practice, /<\/Pressable>\s*\{volumeRow\}/, 'named volume row must be inserted unconditionally after the play control');
assert.match(practice, /<PianoKeyboard\b[^>]*\bvolume=\{volume\}[^>]*>/, 'PianoKeyboard must receive stored volume');

const timedStaffTags = notation.match(/<TimedAnswerStaff\b[\s\S]*?\/>/g) || [];
assert.ok(timedStaffTags.length >= 3, 'all timed staff render paths must be present');
timedStaffTags.forEach((tag, index) => {
  assert.match(tag, /capacityMeter=\{(?:meter|answer\.meter|String\(question\.meter \|\| ''\))\}/, `timed staff ${index + 1} must receive a layout meter`);
  assert.match(tag, /meter=\{systemIndex === 0 \? (?:meter|answer\.meter|String\(question\.meter \|\| ''\)) : ''\}/, `timed staff ${index + 1} must hide display meter only on continuation systems`);
});

console.log(`practice parity contract passed (${files.length} source files checked)`);
