const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

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

const practiceAst = ts.createSourceFile('practice.tsx', practice, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const childrenOf = (node) => {
  const children = [];
  const visit = (child) => { children.push(child); ts.forEachChild(child, visit); };
  ts.forEachChild(node, visit);
  return children;
};
const functions = childrenOf(practiceAst).filter((node) => ts.isFunctionDeclaration(node) && node.name);
const namedFunction = (name) => functions.find((node) => node.name.text === name);
const callsIn = (node, name) => childrenOf(node).filter((child) => ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === name);
const textOf = (node) => node ? node.getText(practiceAst) : '';

const previousFunction = namedFunction('previous');
assert.ok(previousFunction, 'previous must be a real function');
assert.ok(!childrenOf(previousFunction).some((node) => ts.isCallExpression(node) && textOf(node.expression) === 'resetQuestionState'), 'previous must not reset the restored snapshot');
const restoreCall = childrenOf(previousFunction).find((node) => ts.isCallExpression(node) && node.arguments.some((arg) => /index\s*-\s*1/.test(textOf(arg))));
assert.ok(restoreCall && ts.isIdentifier(restoreCall.expression), 'previous must call a restore helper with index - 1');
const restoreName = restoreCall.expression.text;
const restoreFunction = namedFunction(restoreName);
assert.ok(restoreFunction, 'previous restore helper must be a real function');
const targetParam = restoreFunction.parameters[0] && restoreFunction.parameters[0].name.getText(practiceAst);
assert.ok(targetParam, 'restore helper must accept a target index');
assert.ok(childrenOf(restoreFunction).some((node) => ts.isElementAccessExpression(node) && textOf(node.argumentExpression).trim() === targetParam), 'restore helper must read a snapshot keyed by target index');
for (const field of ['answer', 'phase', 'correct', 'playCount', 'highlights']) {
  assert.ok(childrenOf(restoreFunction).some((node) => ts.isCallExpression(node) && /^set[A-Z]/.test(textOf(node.expression)) && textOf(node).includes(`snapshot.${field}`)), `restore helper must restore snapshot.${field}`);
}
assert.ok(childrenOf(practiceAst).some((node) => ts.isObjectLiteralExpression(node)
  && ['answer', 'phase', 'correct', 'playCount', 'highlights'].every((field) => node.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(practiceAst) === field))
  && childrenOf(node).some((child) => ts.isElementAccessExpression(child) && /index/.test(textOf(child.argumentExpression)))), 'snapshot capture must store all fields keyed by the current index');

const volumeDeclaration = childrenOf(practiceAst).find((node) => ts.isVariableDeclaration(node) && node.name.getText(practiceAst) === 'volumeRow');
assert.ok(volumeDeclaration && volumeDeclaration.initializer, 'volumeRow must have a render initializer');
const volumeText = textOf(volumeDeclaration.initializer);
for (const marker of ['styles.volumeRow', 'volume%', 'changeVolume(volume -', 'changeVolume(volume +', 'styles.volumeTrack', 'styles.volumeFill']) {
  assert.ok(volumeText.includes(marker), `volumeRow must contain ${marker}`);
}
const volumeUses = childrenOf(practiceAst).filter((node) => ts.isIdentifier(node) && node.text === 'volumeRow' && node !== volumeDeclaration.name);
assert.equal(volumeUses.length, 1, 'volumeRow must have one actual JSX insertion');
const volumeUse = volumeUses[0];
assert.ok(ts.isJsxExpression(volumeUse.parent), 'volumeRow must be inserted as JSX');
let gated = false;
for (let node = volumeUse.parent; node; node = node.parent) {
  if (ts.isConditionalExpression(node) || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) gated = true;
}
assert.equal(gated, false, 'volumeRow JSX insertion must not be conditionally gated');
assert.match(practice, /<PianoKeyboard\b[^>]*\bvolume=\{volume\}[^>]*>/, 'PianoKeyboard must receive stored volume');

const timedStaffTags = notation.match(/<TimedAnswerStaff\b[\s\S]*?\/>/g) || [];
assert.ok(timedStaffTags.length >= 3, 'all timed staff render paths must be present');
timedStaffTags.forEach((tag, index) => {
  assert.match(tag, /capacityMeter=\{(?:meter|answer\.meter|String\(question\.meter \|\| ''\))\}/, `timed staff ${index + 1} must receive a layout meter`);
  assert.match(tag, /meter=\{systemIndex === 0 \? (?:meter|answer\.meter|String\(question\.meter \|\| ''\)) : ''\}/, `timed staff ${index + 1} must hide display meter only on continuation systems`);
});

console.log(`practice parity contract passed (${files.length} source files checked)`);
