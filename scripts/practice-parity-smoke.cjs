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
const allSource = Object.values(source).join('\n');

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
  assert.ok(!allSource.includes(forbidden), `forbidden audio/debug text present: ${forbidden}`);
}

assert.match(practice, /<PianoKeyboard[\s\S]*volume=\{volume\}/, 'PianoKeyboard must receive stored volume');
assert.match(notation, /meter=\{systemIndex === 0 \? meter : ''\}[\s\S]*capacityMeter=\{meter\}/, 'read-only continuation systems must retain the layout meter');
assert.match(notation, /meter=\{systemIndex === 0 \? answer\.meter : ''\}[\s\S]*capacityMeter=\{answer\.meter\}/, 'editable continuation systems must retain the layout meter');

console.log(`practice parity contract passed (${files.length} source files checked)`);
