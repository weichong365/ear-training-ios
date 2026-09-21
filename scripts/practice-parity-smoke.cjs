const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const files = [
  'src/app/practice.tsx',
  'src/app/exam-paper.tsx',
  'src/components/answer-staff.tsx',
  'src/components/notation-editor.tsx',
  'src/components/piano-keyboard.tsx',
  'src/services/audio-engine.ts',
  'src/core/audio-settings.ts',
];
const source = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const practice = source['src/app/practice.tsx'];
const examPaper = source['src/app/exam-paper.tsx'];
const notation = source['src/components/notation-editor.tsx'];
const audioSettings = source['src/core/audio-settings.ts'];
const audioEngine = source['src/services/audio-engine.ts'];
const piano = source['src/components/piano-keyboard.tsx'];
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

const childrenOf = (node) => {
  const children = [];
  const visit = (child) => { children.push(child); ts.forEachChild(child, visit); };
  ts.forEachChild(node, visit);
  return children;
};
function assertSharedRouteConsumers(routeName, routeSource, expected) {
  const ast = ts.createSourceFile(routeName, routeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map(ast.statements.filter(ts.isImportDeclaration).map((node) => [
    node.moduleSpecifier.text,
    new Set(node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
      ? node.importClause.namedBindings.elements.map((element) => element.name.text) : []),
  ]));
  const jsxNames = new Set(childrenOf(ast).flatMap((node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
    return opening && ts.isIdentifier(opening.tagName) ? [opening.tagName.text] : [];
  }));
  for (const [moduleName, componentName] of expected) {
    assert.ok(imports.get(moduleName)?.has(componentName), `${routeName} must import shared ${componentName}`);
    assert.ok(jsxNames.has(componentName), `${routeName} must render shared ${componentName} in its route tree`);
  }
  assert.ok(!imports.has('react-native-svg'), `${routeName} must not import route-local SVG geometry`);
  for (const geometryTag of ['Svg', 'G', 'Line', 'Path', 'Ellipse', 'Circle']) {
    assert.ok(!jsxNames.has(geometryTag), `${routeName} must not render route-local ${geometryTag} geometry`);
  }
}

assertSharedRouteConsumers('practice.tsx', practice, [
  ['@/components/answer-staff', 'AnswerStaff'],
  ['@/components/notation-editor', 'NotationEditor'],
  ['@/components/piano-keyboard', 'PianoKeyboard'],
]);
assertSharedRouteConsumers('exam-paper.tsx', examPaper, [
  ['@/components/answer-staff', 'AnswerStaff'],
  ['@/components/staff-preview', 'StaffPreview'],
  ['@/components/notation-editor', 'NotationEditor'],
]);
// 三处谱面共用同一个绘制出口：路由本身不再 import 谱面几何，只消费共享组件。
const sharedStaffConsumers = {
  'src/components/answer-staff.tsx': '答题谱',
  'src/components/notation-editor.tsx': '听记谱面编辑器',
  'src/components/staff-preview.tsx': '谱例预览',
};
for (const [file, label] of Object.entries(sharedStaffConsumers)) {
  assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /from '@\/components\/staff-notation'/, `${label}（${file}）没有走共享谱面绘制出口`);
}
function assertPracticeStateAndVolume(practice) {
  // Bind this one source file; dependency types are not needed for lexical identity.
  const practiceAst = ts.createSourceFile('practice.tsx', practice, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const options = { noLib: true, noResolve: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => name === practiceAst.fileName ? practiceAst : undefined;
  const checker = ts.createProgram([practiceAst.fileName], options, host).getTypeChecker();
  const symbol = (node) => node && checker.getSymbolAtLocation(node);
  const same = (node, binding) => !!symbol(binding) && symbol(node) === symbol(binding);
  const unwrap = (node) => node && ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const screen = practiceAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'PracticeScreen');
  assert.ok(screen?.body, 'PracticeScreen must be a real component');
  const declarations = screen.body.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations]);
  const binding = (name) => declarations.flatMap((node) => [node.name, ...childrenOf(node.name)]).find((node) => ts.isIdentifier(node) && node.text === name);
  const namedFunction = (name) => screen.body.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const callsIn = (node) => childrenOf(node).filter(ts.isCallExpression);
  const directCalls = (fn) => fn.body.statements.filter(ts.isExpressionStatement).map((node) => unwrap(node.expression)).filter(ts.isCallExpression);
  const index = binding('index');
  const snapshots = binding('questionSnapshots');
  const previousIndex = (node, base = index) => node && ts.isBinaryExpression(unwrap(node))
    && unwrap(node).operatorToken.kind === ts.SyntaxKind.MinusToken && same(unwrap(node).left, base)
    && ts.isNumericLiteral(unwrap(node).right) && unwrap(node).right.text === '1';
  const collection = (node) => same(node, snapshots) ? 'direct'
    : node && ts.isPropertyAccessExpression(node) && node.name.text === 'current' && same(node.expression, snapshots) ? 'ref' : undefined;
  const previous = namedFunction('previous');
  assert.ok(previous, 'previous must be a real component handler');
  const restoreCall = directCalls(previous).find((node) => previousIndex(node.arguments[0])
    && symbol(node.expression)?.valueDeclaration && ts.isFunctionDeclaration(symbol(node.expression).valueDeclaration));
  assert.ok(restoreCall, 'previous must call a restore helper with the current index - 1');
  const restore = symbol(restoreCall.expression).valueDeclaration;
  const target = restore.parameters[0]?.name;
  const snapshot = restore.body.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations])
    .find((node) => node.initializer && ts.isElementAccessExpression(node.initializer)
      && collection(node.initializer.expression) && same(node.initializer.argumentExpression, target));
  assert.ok(snapshot, 'restore helper must bind the snapshot from questionSnapshots at the target index');
  const stateSetters = { answer: 'setAnswer', phase: 'setPhase', correct: 'setCorrect', playCount: 'setPlayCount', highlights: 'setHighlights' };
  const restoreWrites = Object.entries(stateSetters).map(([field, setter]) => {
    const write = directCalls(restore).find((node) => same(node.expression, binding(setter)) && node.arguments.length === 1
      && ts.isPropertyAccessExpression(node.arguments[0]) && same(node.arguments[0].expression, snapshot.name)
      && node.arguments[0].name.text === field);
    assert.ok(write, `restore helper must call ${setter}(snapshot.${field})`);
    assert.ok(!callsIn(restore).some((node) => node.pos >= write.end && same(node.expression, binding(setter))), `restore helper must not overwrite restored ${field}`);
    return write;
  });
  const reset = namedFunction('resetQuestionState')?.name;
  assert.ok(!callsIn(restore).some((node) => node.pos >= Math.min(...restoreWrites.map((write) => write.end))
    && same(node.expression, reset)), 'restore helper must not reset restored snapshot state');
  assert.ok(!callsIn(previous).some((node) => node.pos >= restoreCall.end
    && [reset, ...Object.values(stateSetters).map(binding)].some((setter) => same(node.expression, setter))), 'previous must not reset or overwrite state after restoration');
  assert.ok(directCalls(restore).some((node) => same(node.expression, binding('setIndex')) && same(node.arguments[0], target))
    || directCalls(previous).some((node) => same(node.expression, binding('setIndex')) && previousIndex(node.arguments[0])), 'previous must update the current index to the restored previous index');
  assert.ok(childrenOf(screen).some((node) => {
    if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken
      || !ts.isElementAccessExpression(node.left) || !same(node.left.argumentExpression, index)
      || collection(node.left.expression) !== collection(snapshot.initializer.expression)) return false;
    let value = unwrap(node.right);
    if (value && ts.isIdentifier(value)) value = unwrap(symbol(value)?.valueDeclaration?.initializer);
    return value && ts.isObjectLiteralExpression(value)
      && ['answer', 'phase', 'correct', 'playCount', 'highlights'].every((field) => value.properties.some((property) =>
        (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && property.name.getText(practiceAst) === field));
  }), 'snapshot capture must assign all fields to the same questionSnapshots collection at the current index');

  const nativeImport = practiceAst.statements.find((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'react-native');
  const nativeBinding = (name) => nativeImport?.importClause?.namedBindings?.elements.find((node) => (node.propertyName || node.name).text === name)?.name;
  const opening = (node) => ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
  const isNative = (node, name) => !!opening(node) && same(opening(node).tagName, nativeBinding(name));
  const attribute = (node, name) => opening(node)?.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.text === name)?.initializer;
  const expression = (node, name) => { const value = attribute(node, name); return value && ts.isJsxExpression(value) ? unwrap(value.expression) : undefined; };
  const styles = practiceAst.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations]).find((node) => node.name.getText(practiceAst) === 'styles')?.name;
  const styled = (node, name) => {
    const value = expression(node, 'style');
    return !!value && [value, ...childrenOf(value)].some((child) => ts.isPropertyAccessExpression(child) && same(child.expression, styles) && child.name.text === name);
  };
  const pressCalls = (node) => {
    const handler = expression(node, 'onPress');
    if (!handler || !ts.isArrowFunction(handler)) return [];
    if (ts.isBlock(handler.body)) return directCalls(handler);
    const body = ts.isVoidExpression(handler.body) ? handler.body.expression : unwrap(handler.body);
    return ts.isCallExpression(body) ? [body] : [];
  };
  assert.ok(childrenOf(screen).some((node) => isNative(node, 'Pressable') && same(expression(node, 'onPress'), previous.name)
    && node.children?.some((child) => isNative(child, 'Text') && child.children.some((text) => ts.isJsxText(text) && text.text.includes('上一题')))), '上一题 Pressable must use the previous handler');
  const volumeDeclaration = declarations.find((node) => node.name.getText(practiceAst) === 'volumeRow');
  const row = unwrap(volumeDeclaration?.initializer);
  assert.ok(row && isNative(row, 'View') && ts.isJsxElement(row) && styled(row, 'volumeRow'), 'volumeRow must unconditionally initialize a real volume View in PracticeScreen');
  assert.ok(volumeDeclaration.parent.flags & ts.NodeFlags.Const, 'volumeRow must keep its concrete initializer');
  for (const operator of [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken]) {
    assert.ok(row.children.some((node) => isNative(node, 'Pressable') && pressCalls(node).some((call) => {
      const amount = call.arguments[0];
      return same(call.expression, namedFunction('changeVolume')?.name) && amount && ts.isBinaryExpression(amount)
        && amount.operatorToken.kind === operator && same(amount.left, binding('volume'))
        && ts.isNumericLiteral(amount.right) && Number(amount.right.text) > 0;
    })), 'volumeRow must contain real decrease/increase Pressables wired to stored volume and changeVolume');
  }
  assert.ok(row.children.some((node) => isNative(node, 'Text') && node.children?.some((child) => ts.isJsxText(child) && child.text.includes('音量'))), 'volumeRow must render its label');
  assert.ok(row.children.some((node) => isNative(node, 'Text')
    && node.children?.some((child) => ts.isJsxExpression(child) && same(child.expression, binding('volume')))
    && node.children.some((child) => ts.isJsxText(child) && child.text.trim() === '%')), 'volumeRow must display the stored volume percentage');
  assert.ok(row.children.some((node) => isNative(node, 'View') && styled(node, 'volumeTrack')
    && node.children?.some((child) => isNative(child, 'View') && styled(child, 'volumeFill')
      && childrenOf(expression(child, 'style')).some((part) => ts.isPropertyAssignment(part) && part.name.getText(practiceAst) === 'width'
        && ts.isTemplateExpression(part.initializer) && part.initializer.head.text === '' && part.initializer.templateSpans.length === 1
        && same(part.initializer.templateSpans[0].expression, binding('volume')) && part.initializer.templateSpans[0].literal.text === '%'))), 'volume track fill must use the stored volume percentage');
  const volumeUses = childrenOf(practiceAst).filter((node) => ts.isIdentifier(node) && node !== volumeDeclaration.name && same(node, volumeDeclaration.name));
  assert.equal(volumeUses.length, 1, 'volumeRow must have exactly one bound JSX insertion');
  const insertion = volumeUses[0].parent;
  const card = insertion.parent;
  assert.ok(ts.isJsxExpression(insertion) && insertion.expression === volumeUses[0]
    && isNative(card, 'View') && styled(card, 'card') && card.children.includes(insertion), 'volumeRow must be a direct ungated child of the practice card');
  const screenReturn = screen.body.statements.find((node) => ts.isReturnStatement(node) && node.expression);
  assert.ok(screenReturn && childrenOf(screenReturn).includes(card), 'volumeRow practice card must be rendered by the component');
  let finishedSwitches = 0;
  for (let child = card, parent = card.parent; parent !== screenReturn; child = parent, parent = parent.parent) {
    if (ts.isConditionalExpression(parent)) {
      const condition = unwrap(parent.condition);
      assert.ok(++finishedSwitches === 1 && ts.isBinaryExpression(condition)
        && condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        && same(unwrap(condition.left), binding('phase')) && ts.isStringLiteral(unwrap(condition.right))
        && unwrap(condition.right).text === 'finished' && child === parent.whenFalse,
      'volumeRow ancestry must only use the finished/practice page switch');
    } else {
      assert.ok(ts.isJsxElement(parent) || ts.isJsxFragment(parent) || ts.isJsxExpression(parent) || ts.isParenthesizedExpression(parent),
        'volumeRow practice card must not have an additional render gate');
    }
  }
  assert.ok(card.children.slice(0, card.children.indexOf(insertion)).some((node) => isNative(node, 'Pressable')
    && pressCalls(node).some((call) => same(call.expression, namedFunction('play')?.name))), 'volumeRow must follow the play control in the practice card');
}

assertPracticeStateAndVolume(practice);
assert.match(practice, /<PianoKeyboard\b[^>]*\bvolume=\{volume\}[^>]*>/, 'PianoKeyboard must receive stored volume');

assert.match(audioSettings, /export function normalizeAudioVolume\(volume: number\)\s*\{\s*return parseStoredVolume\(volume\) \/ 100;\s*\}/,
  'audio settings must provide one persisted-volume to playback-volume conversion');
assert.match(practice, /const playbackVolume = normalizeAudioVolume\(volume\);/,
  'PracticeScreen must normalize its stored volume once');
assert.match(practice, /playQuestionAudio\(question, \{[\s\S]*?volume: playbackVolume,/,
  'question playback must use the normalized stored volume');
assert.match(practice, /playPianoNote\(midi, playbackVolume(?:,|\))/,
  'review piano playback must use the normalized stored volume');
assert.match(practice, /const stopPlayback = useCallback\(\(\) => \{[\s\S]*?clearTimeout\(standardTimer\.current\)[\s\S]*?stopQuestionAudio\(\);[\s\S]*?setPlaying\(false\);[\s\S]*?setPreparing\(false\);[\s\S]*?setHighlights\(\{\}\);/,
  'playback cleanup must clear timers, active audio, state, and highlights');
assert.match(practice, /AppState\.addEventListener\('change', \(state\) => \{\s*if \(state !== 'active'\) stopPlayback\(\);/,
  'background interruption must use the shared playback cleanup');
assert.match(practice, /useFocusEffect\(useCallback\(\(\) => \(\) => \{ stopPlayback\(\); \}, \[stopPlayback\]\)\);/,
  'navigation blur must stop active playback');
assert.match(practice, /onInterrupted: \(\) => \{\s*if \(request !== playRequest\.current\) return;\s*stopPlayback\(\);\s*\}/,
  'interrupted question playback must use the shared cleanup');
assert.match(practice, /const reportAudioFailure = useCallback\(\(error\?: Error\) => \{\s*if \(__DEV__\) console\.warn\('音频播放失败', error\);\s*setMessage\('音频暂时无法播放，请重试'\);/,
  'raw audio diagnostics must be development-only while users receive a short retry message');
assert.ok(!practice.includes('setMessage(error.message)'), 'raw platform audio errors must never be rendered');
assert.match(practice, /const autoPlayTimer = useRef<ReturnType<typeof setTimeout> \| null>\(null\);/,
  'next-question autoplay must have lifecycle-owned timer storage');
assert.match(practice, /const stopPlayback = useCallback\(\(\) => \{[\s\S]*?if \(autoPlayTimer\.current\) clearTimeout\(autoPlayTimer\.current\);\s*autoPlayTimer\.current = null;/,
  'background and blur cleanup must clear a pending next-question autoplay');
assert.match(practice, /function next\(\) \{[\s\S]*?setAutoPlay\(true\);/,
  'next must schedule the follow-up autoplay path');
assert.match(practice, /if \(!autoPlay \|\| phase !== 'ready'\) return;\s*autoPlayTimer\.current = setTimeout\([\s\S]*?return \(\) => \{[\s\S]*?autoPlayTimer\.current = null;/,
  'the next-then-background path must retain and release its autoplay timer');

assert.match(audioEngine, /const PIANO_NOTE_PLAYBACK_MS = 4000;[\s\S]*?pianoCleanup = setTimeout\([\s\S]*?PIANO_NOTE_PLAYBACK_MS\);/,
  'manual review audio must retain the full 4-second sample before cleanup');
assert.match(practice, /async function play\(\) \{[\s\S]*?stopQuestionAudio\(\);[\s\S]*?setHighlights\(\{\}\);/,
  'starting question replay must immediately remove a manual-key highlight');
assert.match(practice, /async function play\(\) \{[\s\S]*?stopQuestionAudio\(\);[\s\S]*?playQuestionAudio\(/,
  'starting question replay must cancel an active or pending manual piano request before question audio begins');
assert.match(practice, /function capturePracticeSnapshot\(\) \{[\s\S]*?snapshotPracticeHighlights\(phase, scoringQuestion, answer, correct, highlights\)[\s\S]*?highlights: snapshotHighlights/,
  'leaving feedback while a manual key is highlighted must persist reconstructed grading colors, not the transient highlight');
assert.match(practice, /const keyboardUnavailable = phase !== 'feedback' \|\| playing \|\| preparing;[\s\S]*?<PianoKeyboard\b[^>]*\bdisabled=\{keyboardUnavailable\}[^>]*\bonKeyPress=\{phase === 'feedback' \? reviewPianoKey : undefined\}/,
  'review piano must unlock only after feedback and stay disabled while question audio is preparing or playing');
assert.ok(!/\buse(?:State|Ref)\b/.test(piano),
  'PianoKeyboard must remain stateless while the practice screen owns review behavior');
assert.match(practice, /accessibilityLabel="复盘钢琴待解锁，提交答案后解锁"/,
  'locked review piano must expose its unlock instruction to assistive technology');
assert.match(practice, /phase === 'feedback' \? '已解锁' : '待解锁'/,
  'review piano must announce its unlocked feedback state');
assert.match(practice, /\{wrongId \? '返回错题复盘' : '返回首页'\}/,
  'completion return must remain aware of wrongbook origin');
assert.match(practice, /\{wrongId \? '再练一次' : '再来一组'\}/,
  'completion must offer the correct context-aware repeat action');
assert.match(practice, /const accuracy = questions\.length \? Math\.round\(score \/ questions\.length \* 100\) : 0;/,
  'completion must calculate one stable accuracy from finalized question scores');
assert.match(practice, /共 \{questions\.length\} 题，答对 \{score\} 题/,
  'completion must render its total and correct-answer counts');

const timedStaffTags = notation.match(/<TimedAnswerStaff\b[\s\S]*?\/>/g) || [];
assert.ok(timedStaffTags.length >= 4, 'all timed staff render paths must be present');
timedStaffTags.forEach((tag, index) => {
  assert.match(tag, /capacityMeter=\{(?:meter|answer\.meter|String\(question\.meter \|\| ''\))\}/, `timed staff ${index + 1} must receive a layout meter`);
});
// 多系统分行必须只在首系统显示拍号；单系统（staffWidth 选择题宽谱）本来就只有一个系统，
// 可以直接传 meter —— 这是小程序 exam.wxml 单谱面的等价写法。
const continuationMeters = timedStaffTags.filter((tag) => /meter=\{systemIndex === 0 \? (?:meter|answer\.meter|String\(question\.meter \|\| ''\)) : ''\}/.test(tag));
assert.ok(continuationMeters.length >= 3, '每一条分行谱表都必须只在首系统显示拍号');
const singleSystemMeters = timedStaffTags.filter((tag) => /\bmeter=\{meter\}/.test(tag));
assert.equal(singleSystemMeters.length, 1, '只有单系统谱面可以直接传拍号，且只允许一处');
assert.ok(singleSystemMeters[0].includes('staffWidth'), '单系统谱面必须是给了 staffWidth 的那条分支');

// Exercise production pitch renders and event handlers without a native runtime.
// Only device effects and unrelated timed/piano components are replaced. State
// names come from the AST so adding an earlier hook cannot shift test fixtures.
function pitchHarness({ realNotation = false, realPiano = false } = {}) {
  const ast = ts.createSourceFile('practice.tsx', practice, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stateNames = childrenOf(ast).filter((node) => ts.isVariableDeclaration(node)
    && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer)
    && node.initializer.expression.getText(ast) === 'useState').map((node) => node.name.elements[0].name.text);
  let state = {}, mode = 'single', params = {}, screenStateIndex = null;
  let effects = null, screenRefIndex = null;
  const screenRefs = [];
  const componentState = [];
  let componentStateIndex = null;
  const hooks = {
    ...require('react'), memo: (component) => component, useEffect: (effect) => { effects?.push(effect); },
    useMemo: (factory) => factory(), useCallback: (fn) => fn,
    useRef: (value) => {
      if (screenRefIndex === null) return { current: value };
      const index = screenRefIndex++;
      return screenRefs[index] ??= { current: value };
    },
    useState: (initial) => {
      if (componentStateIndex !== null) {
        const index = componentStateIndex++;
        if (!(index in componentState)) componentState[index] = typeof initial === 'function' ? initial() : initial;
        return [componentState[index], (next) => { componentState[index] = typeof next === 'function' ? next(componentState[index]) : next; }];
      }
      const name = screenStateIndex === null ? null : stateNames[screenStateIndex++];
      const value = name && Object.hasOwn(state, name) ? state[name] : typeof initial === 'function' ? initial() : initial;
      if (name) state[name] = value;
      return [value, (next) => { if (name) state[name] = typeof next === 'function' ? next(state[name]) : next; }];
    },
  };
  const mocks = {
    react: hooks,
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'Image', 'Pressable', 'ScrollView', 'Text', 'View'].map((name) => [name, name])),
      StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios ?? values.default },
      AppState: { addEventListener: () => ({ remove() {} }) }, AccessibilityInfo: { announceForAccessibility() {} } },
    'react-native-svg': { __esModule: true, default: 'Svg', G: 'G', Line: 'Line', Path: 'Path', Text: 'SvgText', Ellipse: 'Ellipse' },
    'expo-router': { useLocalSearchParams: () => ({ type: mode, ...params }), useFocusEffect: (effect) => { effects?.push(effect); } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'expo-haptics': { selectionAsync: () => Promise.resolve(), notificationAsync: () => Promise.resolve(), NotificationFeedbackType: { Success: 'success', Error: 'error' } },
    '@/services/audio-engine': {}, '@/services/local-data': {}, '@/global.css': {},
    '@/components/app-icon': { AppIcon: () => null },
  };
  if (!realNotation) mocks['@/components/notation-editor'] = { NotationEditor: () => null };
  if (!realPiano) mocks['@/components/piano-keyboard'] = { PianoKeyboard: () => null };
  const cache = new Map();
  function load(request, from = root) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    if (!request.startsWith('.') && !request.startsWith('@/')) return require(request);
    const base = request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : path.resolve(from, request);
    const file = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    assert.ok(file, `test module not found: ${request}`);
    if (file.endsWith('.png')) return file;
    if (file.endsWith('.js')) return require(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', '__DEV__', compiled)((name) => load(name, path.dirname(file)), module, module.exports, false);
    return module.exports;
  }
  const Screen = load('./src/app/practice.tsx').default;
  function nodes(value) {
    if (value == null || typeof value === 'boolean') return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (typeof value !== 'object') return [value];
    if (typeof value.type === 'function') return [value, ...nodes(value.type(value.props))];
    return [value, ...nodes(value.props?.children)];
  }
  return {
    load,
    mocks,
    runEffects() { const pending = effects; effects = null; return pending?.map((effect) => effect()); },
    renderComponent(Component, props, captureEffects = false) {
      effects = captureEffects ? [] : null;
      componentStateIndex = 0;
      const tree = Component(props);
      componentStateIndex = null;
      const rendered = nodes(tree);
      return { nodes: rendered.filter((node) => typeof node === 'object'), text: rendered.filter((node) => typeof node === 'string' || typeof node === 'number').join('') };
    },
    start(nextMode, question, phase, answer, correct = false, stateOverrides = {}) {
      mode = nextMode;
      params = {};
      screenRefs.length = 0;
      state = { practiceLoaded: true, activePracticeSession: { mode, questions: [question], snapshots: [], sessionId: 'test-session' }, phase, answer, correct, ...stateOverrides };
    },
    openReview(nextParams) {
      params = nextParams;
      mode = nextParams.type;
      state = {};
      screenRefs.length = 0;
    },
    render(captureEffects = false) {
      effects = captureEffects ? [] : null;
      screenStateIndex = 0;
      screenRefIndex = 0;
      const tree = Screen();
      screenStateIndex = null;
      screenRefIndex = null;
      const rendered = nodes(tree);
      return {
        nodes: rendered.filter((node) => typeof node === 'object'),
        text: rendered.filter((node) => typeof node === 'string' || typeof node === 'number').join(''),
      };
    },
  };
}

const harness = pitchHarness();
const { emptyExamAnswer, answerIsComplete } = harness.load('./src/core/exam-answer.ts');
const { snapshotPracticeHighlights } = harness.load('./src/app/practice.tsx');
assert.equal(typeof snapshotPracticeHighlights, 'function', 'practice feedback snapshots must expose the stable-highlight reconstruction used by navigation');
assert.deepEqual(
  snapshotPracticeHighlights('feedback', { type: 'single', midis: [61] }, { ...emptyExamAnswer(), pitches: [60] }, false, { 60: 'play', 61: 'correct' }),
  { 60: 'wrong', 61: 'correct' },
  'tapping a coloured review key then navigating away before 4 seconds must restore persistent wrong/correct feedback on return',
);
const questionCore = require('../src/core/legacy/question.js');
const originalRandom = Math.random;
let seed = 246813579;
let pitchCases, adaptivePitches;
try {
  Math.random = () => { seed = seed * 1664525 + 1013904223 >>> 0; return seed / 0x100000000; };
  pitchCases = ['single', 'group', 'interval', 'chord', 'chordQuality', 'chordPitch', 'connection']
    .map((mode) => ({ mode, question: questionCore.generate(mode), qualityOnly: mode === 'chordQuality' }));
  adaptivePitches = questionCore.generateSet('adaptive', 15).filter((question) => !['rhythm', 'melody'].includes(question.type));
} finally {
  Math.random = originalRandom;
}
assert.ok(adaptivePitches.length > 0, 'adaptive set must include pitch questions');
pitchCases.push(...adaptivePitches.map((question) => ({ mode: 'adaptive', question, qualityOnly: question.answerMode === 'qualityFill' })));
const submitButton = (render) => render.nodes.find((node) => node.type === 'Pressable' && node.props.accessibilityRole === 'button' && !node.props.accessibilityLabel && node.props.accessibilityState?.disabled !== undefined);
const staffs = (render) => render.nodes.filter((node) => node.type?.name === 'AnswerStaff');
const { ANSWER_STAFF_HEIGHT, STAFF_VIEWBOX_HEIGHT } = harness.load('./src/core/staff-coordinate.ts');
const staffTouchArea = (render) => render.nodes.find((node) => node.props.accessibilityLabel === '五线谱答题区域' || node.props.accessibilityLabel === '五线谱谱面');
/**
 * 先触发一次 onLayout：真实设备上 viewBox 宽由实测容器宽算出来，
 * 不先布局的话 layout.width 还是 0，横向坐标会退化成无意义的值。
 * 之后再取一次新渲染的节点做手势 —— 同一渲染内的节点才共享同一份 ref。
 */
function layoutStaffTouchArea(render, width = 375) {
  const area = staffTouchArea(render);
  assert.ok(area, 'missing staff touch area');
  area.props.onLayout({ nativeEvent: { layout: { width, height: ANSWER_STAFF_HEIGHT } } });
  return harness.render();
}
/** 谱面 rpx 坐标 → 屏幕 pt（画布高 70pt / viewBox 高 140rpx） */
const ptFromStaffRpx = (rpx) => rpx * ANSWER_STAFF_HEIGHT / STAFF_VIEWBOX_HEIGHT;
function tapStaff(render, xPt, yRpx) {
  const area = staffTouchArea(render);
  const event = { nativeEvent: { locationX: xPt, locationY: ptFromStaffRpx(yRpx) } };
  area.props.onResponderGrant(event);
  area.props.onResponderRelease(event);
}
// 播放按钮只保留标题一行：引导语与复盘副标题都不得出现在按钮上。
// 2026-09-20：用户在截图里要求去掉「结合谱面与键盘复盘」⇒ 两端同时移除，
// 断言方向随之反转，防止被无意加回来。
const miniProgramPractice = fs.readFileSync(
  path.resolve(root, '..', 'pages', 'practice', 'practice.wxml'), 'utf8');
assert.ok(!miniProgramPractice.includes('先听题，再在五线谱上作答'),
  '小程序 practice.wxml 不应再出现「先听题，再在五线谱上作答」');
assert.ok(!miniProgramPractice.includes('结合谱面与键盘复盘'),
  '小程序 practice.wxml 不应再出现「结合谱面与键盘复盘」');
assert.ok(!practice.includes('先听题，再在五线谱上作答'),
  'iOS practice.tsx 不应再出现「先听题，再在五线谱上作答」');
assert.ok(!practice.includes('结合谱面与键盘复盘'),
  'iOS practice.tsx 不应再出现「结合谱面与键盘复盘」');

for (const { mode, question, qualityOnly } of pitchCases) {
  const readyAnswer = { ...emptyExamAnswer(), pitches: question.type === 'intervalConnection' ? question.chords.flat() : question.midis,
    quality: qualityOnly ? '大三和弦' : '', inversion: qualityOnly ? '原位' : '' };
  for (const phase of ['ready', 'answering', 'feedback']) {
    const answer = phase === 'feedback' ? readyAnswer : emptyExamAnswer();
    harness.start(mode, question, phase, answer);
    const render = harness.render();
    const noun = question.type === 'single' ? '单音' : question.type === 'chord' ? '和弦' : question.groupSize ? '音组' : '音程';
    assert.ok(render.nodes.some((node) => node.type === 'Text' && typeof node.props.children === 'string' && node.props.children.includes('听到的') && node.props.children.includes(noun)), `${mode}/${phase}: missing answer title/noun`);
    assert.ok(render.text.includes(qualityOnly ? '先选性质（大/小/增/减三和弦），再选转位。' : '按住音符可上下拖动'), `${mode}/${phase}: missing answer instruction`);
    // 播放按钮只剩一行：ready/answering 不许再出现「先听题，再在五线谱上作答」，
    // 复盘阶段也不许出现「结合谱面与键盘复盘」。两个方向都钉住，防止被无意加回来。
    assert.ok(!render.text.includes('先听题，再在五线谱上作答'), `${mode}/${phase}: playback instruction must stay removed`);
    assert.ok(!render.text.includes('结合谱面与键盘复盘'), `${mode}/${phase}: feedback playback instruction must stay removed`);
    assert.ok(render.text.includes(phase === 'feedback' ? '键盘已解锁，可自由弹奏核对音高' : '提交谱面答案后自动解锁'), `${mode}/${phase}: missing keyboard instruction`);
    if (phase !== 'feedback') {
      const prompt = phase === 'ready' ? '播放题目后开始作答' : qualityOnly ? '请选择和弦性质与转位' : question.type === 'intervalConnection' ? '点击五线谱写入两个音' : '点击五线谱写入答案';
      assert.ok(render.text.includes(prompt), `${mode}/${phase}: missing empty prompt`);
      assert.equal(submitButton(render)?.props.disabled, true, `${mode}/${phase}: empty answer must disable submit`);
    } else {
      assert.ok(render.text.includes('正确答案：') && render.text.includes('你的答案：'), `${mode}: missing feedback summaries`);
      assert.ok(render.nodes.some((node) => node.props.accessibilityLabel === '批改结果：错误'), `${mode}: missing teacher mark`);
    }
    if (qualityOnly) assert.deepEqual(render.nodes.filter((node) => node.type === 'Text' && ['和弦性质', '转位'].includes(node.props.children)).map((node) => node.props.children).slice(-2), ['和弦性质', '转位'], 'quality controls must appear before inversion controls');
  }
  harness.start(mode, question, 'answering', readyAnswer);
  assert.equal(submitButton(harness.render())?.props.disabled, false, `${mode}: fully filled answer must enable submit`);
  if (!qualityOnly && question.type !== 'intervalConnection') {
    const staff = staffs(harness.render())[0];
    assert.equal(staff.props.stacked, question.type === 'chord' || Boolean(question.harmonic), `${mode}: wrong stacking`);
    assert.equal(staff.props.stacked ? staff.props.maxStack : staff.props.slots, question.midis.length, `${mode}: wrong pitch capacity`);
  }
}

const connection = { type: 'intervalConnection', typeName: '和声音程连接', chords: [[60, 64], [62, 69]], answerText: 'C4 E4 → D4 A4' };
harness.start('connection', connection, 'answering', emptyExamAnswer());
staffs(harness.render())[1].props.onChange([62, 69], ['D4', 'A4']);
assert.doesNotThrow(() => harness.render(), 'unfilled connection groups must render after a later group is filled');
assert.equal(submitButton(harness.render()).props.disabled, true, 'last group alone cannot enable submit');
staffs(harness.render())[0].props.onChange([60], ['C4']);
assert.equal(submitButton(harness.render()).props.disabled, true, 'one missing group slot cannot enable submit');
staffs(harness.render())[0].props.onChange([60, 64], ['C4', 'E4']);
assert.equal(submitButton(harness.render()).props.disabled, false, 'all connection group slots enable submit');
staffs(harness.render())[0].props.onChange([64], ['E4']);
assert.equal(submitButton(harness.render()).props.disabled, true, 'erasing a group note disables submit again');
assert.deepEqual(staffs(harness.render())[1].props.pitches, [62, 69], 'editing one connection group must preserve later groups');
assert.equal(answerIsComplete(connection, { ...emptyExamAnswer(), pitches: [, 64, 62, 69] }), false, 'a sparse missing slot cannot count as complete');

// Use the real staff responder to fill a previously empty group, not just its
// parent onChange callback: fixed flat-array padding must not swallow new notes.
harness.start('connection', connection, 'answering', emptyExamAnswer());
staffs(harness.render())[1].props.onChange([62, 69], ['D4', 'A4']);
// 落点用谱面 rpx 坐标表达：中央 C 在 y=106（下加一线），E4 在 y=91（第一线），G4 在 y=76。
// 横向取 250pt ⇒ 500rpx，离已写音符的锚点（约 344rpx）超过 42rpx 命中半径，
// 必须走「按 y 写新音」而不是「弹出临时记号菜单」。
let tapRender = layoutStaffTouchArea(harness.render());
tapStaff(tapRender, 250, 106);
assert.deepEqual(staffs(harness.render())[0].props.pitches.filter(Number.isFinite), [60], 'tapping an empty padded connection group must write its first note');
for (const y of [91, 76]) {
  tapStaff(layoutStaffTouchArea(harness.render()), 250, y);
}
assert.deepEqual(staffs(harness.render())[0].props.pitches, [60, 64], 'connection staff writes the second note and enforces its two-note stack limit');
assert.deepEqual(staffs(harness.render())[0].props.spellings, ['C4', 'E4'], 'stack insertion preserves spelling alignment');
assert.equal(submitButton(harness.render()).props.disabled, false, 'real staff gestures can complete every connection slot');

const qualityQuestion = pitchCases.find(({ mode }) => mode === 'chordQuality').question;
harness.start('chordQuality', qualityQuestion, 'answering', emptyExamAnswer());
let qualityChoices = harness.render().nodes.filter((node) => node.props.accessibilityRole === 'radio');
qualityChoices[0].props.onPress();
assert.equal(submitButton(harness.render()).props.disabled, true, 'quality alone cannot enable submit');
assert.ok(harness.render().text.includes('请选择转位'), 'quality selection must prompt for the remaining inversion');
qualityChoices = harness.render().nodes.filter((node) => node.props.accessibilityRole === 'radio');
qualityChoices[4].props.onPress();
assert.equal(submitButton(harness.render()).props.disabled, false, 'quality and inversion enable submit');

const flatQuestion = { type: 'single', typeName: '单音听记', midis: [61], spellings: ['Db4'], answerText: 'D♭4' };
for (const correct of [false, true]) {
  harness.start('single', flatQuestion, 'feedback', { ...emptyExamAnswer(), pitches: [correct ? 61 : 60], spellings: [correct ? 'Db4' : 'C4'] }, correct);
  const render = harness.render();
  assert.ok(render.text.includes(`正确答案：D♭4你的答案：${correct ? 'D♭4' : 'C4'}`), 'feedback must include actual spelled correct/user answers');
  assert.ok(render.nodes.some((node) => node.props.accessibilityLabel === `批改结果：${correct ? '正确' : '错误'}`), 'teacher mark must reflect the grade');
  assert.equal(staffs(render)[0].props.showCorrect, !correct, 'only a wrong answer needs the correct overlay');
}
harness.start('group', { type: 'interval', typeName: '旋律音组', groupSize: 3, noteCount: 3, midis: [60, 64, 67] }, 'answering', { ...emptyExamAnswer(), pitches: [null, 64, 67] });
assert.doesNotThrow(() => harness.render(), 'restored null pitch slots must render');
assert.equal(submitButton(harness.render()).props.disabled, true, 'restored null pitch slots are incomplete');

// Route-level practice fixtures render the real shared staff and piano modules.
// Removing a shared route consumer or weakening its phase/audio gate must fail here.
const sharedPractice = pitchHarness({ realNotation: true, realPiano: true });
const { AnswerStaff: SharedAnswerStaff } = sharedPractice.load('./src/components/answer-staff.tsx');
const { NotationEditor: SharedNotationEditor, TimedAnswerStaff: SharedTimedAnswerStaff } = sharedPractice.load('./src/components/notation-editor.tsx');
const { PianoKeyboard: SharedPianoKeyboard } = sharedPractice.load('./src/components/piano-keyboard.tsx');
const sharedSingle = { id: 'practice-single', type: 'single', typeName: '单音听记', midis: [60], spellings: ['C4'], answer: [60], answerText: 'C4', repeatCount: 3 };
const sharedAnswer = { ...emptyExamAnswer(), pitches: [60], spellings: ['C4'] };
const sharedWrongAnswer = { ...emptyExamAnswer(), pitches: [62], spellings: ['D4'] };
const sharedComponent = (render, Component) => render.nodes.find((node) => node.type === Component);
const pianoKeys = (render) => render.nodes.filter((node) => node.type === 'Pressable' && /^钢琴键 /.test(node.props.accessibilityLabel || ''));
const pianoAccessibilityWrapper = (render, keyboard) => render.nodes.find((node) => node.type === 'View'
  && (Array.isArray(node.props.children) ? node.props.children : [node.props.children]).includes(keyboard));

for (const phase of ['ready', 'answering']) {
  sharedPractice.start('single', sharedSingle, phase, phase === 'ready' ? emptyExamAnswer() : sharedAnswer);
  const render = sharedPractice.render();
  assert.equal(sharedComponent(render, SharedAnswerStaff).props.disabled, phase !== 'answering', `${phase}: shared answer staff must follow the practice edit phase`);
  const keyboard = sharedComponent(render, SharedPianoKeyboard);
  assert.equal(keyboard.props.disabled, true, `${phase}: review piano must remain locked`);
  assert.equal(keyboard.props.onKeyPress, undefined, `${phase}: locked review piano must not expose a press handler`);
  assert.equal(pianoKeys(render).length, 0, `${phase}: locked review piano must not expose focusable keys`);
  const accessibilityWrapper = pianoAccessibilityWrapper(render, keyboard);
  assert.deepEqual([accessibilityWrapper.props['aria-hidden'], accessibilityWrapper.props.accessibilityElementsHidden, accessibilityWrapper.props.importantForAccessibility],
    [true, true, 'no-hide-descendants'], `${phase}: locked review piano must hide descendants from accessibility focus`);
}

for (const [correct, answer, tone, showCorrect] of [[true, sharedAnswer, 'green', false], [false, sharedWrongAnswer, 'red', true]]) {
  sharedPractice.start('single', sharedSingle, 'feedback', answer, correct, { highlights: correct ? { 60: 'correct' } : { 60: 'correct', 62: 'wrong' } });
  const render = sharedPractice.render();
  const staff = sharedComponent(render, SharedAnswerStaff);
  assert.deepEqual([staff.props.disabled, staff.props.tone, staff.props.showCorrect], [true, tone, showCorrect], `${correct ? 'correct' : 'wrong'} feedback must use the shared read-only answer staff state`);
  const keyboard = sharedComponent(render, SharedPianoKeyboard);
  assert.equal(keyboard.props.disabled, false, 'idle feedback must unlock the shared review piano');
  assert.equal(typeof keyboard.props.onKeyPress, 'function', 'unlocked feedback must wire the review piano handler');
  assert.equal(pianoKeys(render).length, 27, 'unlocked feedback must expose every G3–A5 key as a focusable control');
  assert.ok(pianoKeys(render).every((key) => key.props.disabled === false && key.props.accessibilityState?.disabled === false), 'idle unlocked review keys must be pressable');
  const accessibilityWrapper = pianoAccessibilityWrapper(render, keyboard);
  assert.deepEqual([accessibilityWrapper.props['aria-hidden'], accessibilityWrapper.props.accessibilityElementsHidden, accessibilityWrapper.props.importantForAccessibility],
    [false, false, 'auto'], 'idle feedback must restore every review key to accessibility focus');
}

for (const audioState of ['playing', 'preparing']) {
  sharedPractice.start('single', sharedSingle, 'feedback', sharedWrongAnswer, false, { [audioState]: true });
  const render = sharedPractice.render();
  const keyboard = sharedComponent(render, SharedPianoKeyboard);
  assert.equal(keyboard.props.disabled, true, `feedback piano must disable while ${audioState}`);
  assert.equal(typeof keyboard.props.onKeyPress, 'function', `feedback piano keeps its handler while ${audioState} but gates every key`);
  assert.ok(pianoKeys(render).every((key) => key.props.disabled === true && key.props.accessibilityState?.disabled === true), `every unlocked review key must disable while ${audioState}`);
  const accessibilityWrapper = pianoAccessibilityWrapper(render, keyboard);
  assert.deepEqual([accessibilityWrapper.props['aria-hidden'], accessibilityWrapper.props.accessibilityElementsHidden, accessibilityWrapper.props.importantForAccessibility],
    [true, true, 'no-hide-descendants'], `feedback review keys must leave accessibility focus while ${audioState}`);
}

const timedPracticeQuestion = { id: 'practice-rhythm', type: 'rhythm', typeName: '节奏听记', meter: '6/8', beatsPerBar: 3, barCount: 3, beats: Array(18).fill(0.5), repeatCount: 3 };
const timedPracticeAnswer = { ...emptyExamAnswer(), meter: '6/8', events: Array.from({ length: 18 }, (_, index) => ({ midi: 69, duration: 0.5, barIndex: Math.floor(index / 6) })) };
timedPracticeAnswer.events[0] = { ...timedPracticeAnswer.events[0], duration: -0.5, rest: true };
sharedPractice.start('rhythm', timedPracticeQuestion, 'feedback', timedPracticeAnswer, false);
const timedPracticeFeedback = sharedPractice.render();
assert.ok(sharedComponent(timedPracticeFeedback, SharedNotationEditor), 'timed practice feedback must render the shared notation editor');
const timedPracticeRows = timedPracticeFeedback.nodes.filter((node) => node.type === SharedTimedAnswerStaff);
assert.deepEqual(timedPracticeRows.map((row) => row.props.tone), ['red', 'green', 'red', 'green'], 'wrong timed practice feedback must render paired user and standard shared staffs');
assert.deepEqual(timedPracticeRows.map((row) => row.props.meter), ['6/8', '6/8', '', ''], 'timed practice continuation rows must hide only the displayed meter');
assert.ok(timedPracticeRows.every((row) => row.props.capacityMeter === '6/8' && row.props.disabled), 'timed practice feedback rows must preserve layout meter and read-only state');

sharedPractice.start('single', sharedSingle, 'finished', sharedAnswer, true);
const finishedPractice = sharedPractice.render();
assert.ok(finishedPractice.text.includes('本组训练完成'), 'finished practice must render its completion state');
assert.ok(!sharedComponent(finishedPractice, SharedAnswerStaff) && !sharedComponent(finishedPractice, SharedPianoKeyboard), 'finished practice must remove answer and piano interaction surfaces');

// Hand-checked line/space fixtures guard the shared native geometry contract.
// ⚠️ 单位是 rpx（1rpx = 0.5pt）：lineTop 30 / lineGap 15 / 第一线 E4 = 91。
// 逐值来源：components/staff-layout.js（小程序），跨端对账见 scripts/staff-parity-smoke.cjs。
const geometry = harness.load('./src/core/music-notation.ts');
const layout = harness.load('./src/core/staff-layout.ts');
assert.deepEqual(geometry.STAFF_LINE_YS, [31, 46, 61, 76, 91]);
assert.equal(geometry.staffSvgYFromWrittenMidi(64), 91);
assert.deepEqual(geometry.ledgerLineYs(60), [106]);
assert.deepEqual(geometry.ledgerLineYs(57), [106, 121]);
assert.deepEqual(geometry.barlineBounds(), { top: 31, bottom: 91 });
assert.equal(geometry.writtenMidiFromStaffSvgY(geometry.staffSvgYFromWrittenMidi(69)), 69);
assert.equal(geometry.pianoWhiteMidis(55, 81).length, 16);
assert.equal(geometry.pianoBlackKeys(55, 81).length, 11);
assert.equal(layout.RPX_TO_PT, 0.5, '1rpx 必须等于 0.5pt');
assert.equal(layout.DEFAULT_STAFF_WIDTH_RPX, 630, '答题谱必须使用小程序 answer-staff 的 width=630');
assert.equal(layout.STAFF_HEIGHT_RPX, 140, '谱面内容高必须是 140rpx');
assert.equal(layout.STAFF_LINE_GAP, 15, '谱线间距必须是 15rpx');
assert.equal(layout.STAFF_STEP_GAP, 7.5, '相邻音级必须是 7.5rpx');

const naturalWrittenMidis = [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];
naturalWrittenMidis.forEach((midi) => {
  assert.equal(geometry.writtenMidiFromStaffSvgY(geometry.staffSvgYFromWrittenMidi(midi)), midi,
    `natural written pitch must round-trip: ${midi}`);
});
assert.equal(geometry.STAFF_LINE_YS[1] - geometry.STAFF_LINE_YS[0], 15, 'staff lines must use equal spacing');
assert.equal(geometry.ledgerLineYs(57)[1] - geometry.ledgerLineYs(57)[0], 15, 'ledger lines must use staff spacing');
assert.equal(geometry.STAFF_STROKE_WIDTH, 2, 'ledger and staff strokes must share the 2rpx width');
for (const [meter, elapsed, expected] of [
  ['2/4', [0, 0.5, 1, 1.5], [0, 0, 1, 1]],
  ['4/4', [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 0, 1, 1, 2, 2, 3, 3]],
  ['3/8', [0, 0.25, 0.5, 0.75, 1, 1.25], [0, 0, 0, 0, 0, 0]],
  ['6/8', [0, 0.5, 1, 1.5, 2, 2.5], [0, 0, 0, 1, 1, 1]],
]) {
  assert.deepEqual(elapsed.map((beat) => geometry.beamGroupAtBeat(beat, meter)), expected,
    `${meter} beams must group within beats`);
}

// ⚠️ 单位是 rpx：E4 第一线 = 91、第三线(B4) = 61、顶线(F5) = 31，相邻音级 7.5rpx。
// 「物理点击 y(pt)」= 谱面 y(rpx) × 画布高 ÷ 140，换算必须与画布高无关。
const coordinates = harness.load('./src/core/staff-coordinate.ts');
assert.equal(coordinates.STAFF_VIEWBOX_HEIGHT, 140, 'viewBox 高必须是 140rpx');
assert.equal(coordinates.STAFF_VIEWBOX_WIDTH, 630, '首帧 viewBox 宽必须是 answer-staff 的 width=630');
assert.equal(coordinates.ANSWER_STAFF_HEIGHT, 70, '画布渲染高必须是 140rpx × 0.5pt = 70pt');
assert.equal(coordinates.staffViewBoxWidth(375), 750, '375pt 容器 → 750rpx viewBox');
assert.equal(coordinates.staffViewBoxWidth(0), 630, '未测到宽度时必须回落到设计宽 630rpx');
for (const [midi, y] of [[60, 106], [64, 91], [65, 83.5], [71, 61], [77, 31], [81, 16]]) {
  assert.equal(coordinates.staffSvgYFromWrittenMidi(midi), y, `记谱 y 必须是 ${y}rpx`);
  for (const height of [coordinates.ANSWER_STAFF_HEIGHT, 122]) {
    assert.equal(
      coordinates.naturalMidiFromStaffTapY(y * height / coordinates.STAFF_VIEWBOX_HEIGHT, height),
      midi,
      `${height}pt 画布上点击 y=${y}rpx 必须还原文 ${midi}`,
    );
  }
}

// A renderer-local offset must not make an editable staff disagree with the
// read-only preview. These fixtures inspect the real component trees so a
// duplicated line, accidental, ledger, stem, clef or prompt anchor is caught.
//
// 期望值一律取自共享几何（@/core/staff-layout + headerSymbols + buildStaffGeometry），
// 不重复硬编码第二份像素 —— 几何单源一改，这里不会虚假失败；但任何「调用方私加偏移」
// 都会被抓住。几何本身与小程序 layout() 的逐值对账见 scripts/staff-parity-smoke.cjs。
const rendererHarness = pitchHarness();
const { AnswerStaff } = rendererHarness.load('./src/components/answer-staff.tsx');
const { StaffPreview } = rendererHarness.load('./src/components/staff-preview.tsx');
const flattenRendererStyle = (style) => Array.isArray(style)
  ? Object.assign({}, ...style.filter(Boolean).map(flattenRendererStyle))
  : style || {};
/** 未触发 onLayout 时的 viewBox 宽 = 小程序 answer-staff 的 width 设计宽（rpx） */
const VIEWBOX_WIDTH_RPX = layout.DEFAULT_STAFF_WIDTH_RPX;
const lineNodes = (render) => render.nodes.filter((node) => node.type === 'Line');
const staffLineNodes = (render) => lineNodes(render)
  .filter((node) => Number(node.props.x1) === 0 && Number(node.props.x2) === VIEWBOX_WIDTH_RPX);
const barlineNodes = (render) => lineNodes(render).filter((node) => /^bar-/.test(node.key));
const stemNodes = (render) => lineNodes(render).filter((node) => /^s-\d+$/.test(node.key));
const beamNodes = (render, prefix) => lineNodes(render).filter((node) => new RegExp(`^${prefix}-\\d+$`).test(node.key));
const ledgerNodes = (render) => lineNodes(render).filter((node) => node.props.y1 === node.props.y2
  && Math.abs(Number(node.props.x2) - Number(node.props.x1) - layout.LEDGER_WIDTH) < 0.001);
const nodeNamed = (render, name) => render.nodes.filter((node) => node.type?.name === name);
/**
 * 谱头字形（谱号 / 调号 / 拍号）—— 唯一标识方式是「绘制顺序在第一个音符之前」，
 * 因为音符、临时记号、休止符、符尾、附点也都走同一个 MusicGlyph 出口。
 */
const headerGlyphNodes = (render) => {
  const firstNote = render.nodes.findIndex((node) => node.type?.name === 'MusicNotehead' || node.type?.name === 'MusicRest');
  return render.nodes.slice(0, firstNote < 0 ? render.nodes.length : firstNote)
    .filter((node) => node.type?.name === 'MusicGlyph');
};
const noteheadNodes = (render) => nodeNamed(render, 'MusicNotehead');
const accidentalNodes = (render) => nodeNamed(render, 'MusicAccidental');
const restNodes = (render) => nodeNamed(render, 'MusicRest');
const flagNodes = (render) => nodeNamed(render, 'MusicFlag');
const dotNodes = (render) => nodeNamed(render, 'MusicDot');
const tupletNodes = (render) => nodeNamed(render, 'MusicTuplet');
/** 共享谱面必须只有一个 <Svg> 根（调用方不得再套自己的 SVG 坐标层） */
const staffRoot = (render) => {
  const roots = render.nodes.filter((node) => node.type === 'Svg');
  assert.equal(roots.length, 1, '谱面必须只由一个共享 <Svg> 根绘制');
  return roots[0];
};

const wholeMidis = [65, 64, 81, 60]; // 第一间、第一线、上加线、下加线
const wholeSpellings = ['F4', 'E4', 'A5', 'C4'];
const answerWhole = rendererHarness.renderComponent(AnswerStaff, {
  pitches: wholeMidis, spellings: wholeSpellings, slots: 4, disabled: true, emptyText: '',
});
const previewWhole = rendererHarness.renderComponent(StaffPreview, { midis: wholeMidis, wholeNotes: true });
for (const [name, render] of [['AnswerStaff', answerWhole], ['StaffPreview', previewWhole]]) {
  const svg = staffRoot(render);
  // viewBox 用 rpx（小程序坐标系）：宽 = 实测容器宽 ÷ 0.5，高 140 ⇒ 1 单位恒等于 0.5pt。
  assert.equal(svg.props.viewBox, `0 0 ${VIEWBOX_WIDTH_RPX} ${layout.STAFF_HEIGHT_RPX}`,
    `${name} 必须以 rpx 为 viewBox 单位（宽 630 / 高 140）`);
  assert.equal(svg.props.preserveAspectRatio, 'none',
    `${name} 必须用 preserveAspectRatio="none"，否则窄容器下 1 单位 ≠ 0.5pt`);
  assert.equal(staffLineNodes(render).length, 5, `${name} 必须恰好画出五条谱线`);
  assert.deepEqual(staffLineNodes(render).map((line) => line.props.y1), geometry.STAFF_LINE_YS,
    `${name} 谱线必须落在 31/46/61/76/91rpx`);
  assert.ok(staffLineNodes(render).every((line) => line.props.strokeWidth === geometry.STAFF_STROKE_WIDTH),
    `${name} 谱线必须与加线/小节线同宽 2rpx`);

  const heads = noteheadNodes(render);
  assert.deepEqual(heads.map((head) => [head.props.kind, head.props.y]),
    [['whole', 83.5], ['whole', 91], ['whole', 16], ['whole', 106]],
    `${name} 全音符必须逐值落在间/线/上下加线上（rpx）`);
  assert.ok(Math.abs(layout.noteheadBox('whole', 0, 0).width - 25.32) < 0.001,
    '空心全音符列宽必须是 Bravura 在 15rpx 谱距下的 25.32rpx');

  const ledgers = ledgerNodes(render);
  assert.deepEqual(ledgers.map((line) => line.props.y1), [16, 106],
    `${name} 上加线/下加线必须各画一条（16rpx / 106rpx）`);
  ledgers.forEach((line) => {
    const center = (Number(line.props.x1) + Number(line.props.x2)) / 2;
    assert.ok(heads.some((head) => Math.abs(head.props.x - center) < 0.01),
      `${name} 加线必须以符头中心为轴（宽 ${layout.LEDGER_WIDTH}rpx）`);
  });
  assert.ok(ledgers.every((line) => line.props.strokeWidth === geometry.STAFF_STROKE_WIDTH),
    `${name} 加线必须与谱线同宽`);
  assert.deepEqual(barlineNodes(render), [], `${name} 固定答题区域不画小节线`);
  assert.deepEqual(restNodes(render), [], `${name} 这两个样例里没有休止符`);

  // 谱号必须逐值等于 headerSymbols（锚点在 G4 线 = 第二线）。
  const header = layout.headerSymbols('', '');
  assert.deepEqual(headerGlyphNodes(render).map((node) => [node.props.name, node.props.box]), [['clef', header.clefGlyph]],
    `${name} 谱号必须逐值取自 headerSymbols`);
  assert.deepEqual(
    [header.clefGlyph.left, Math.round(header.clefGlyph.top * 100) / 100, Math.round(header.clefGlyph.width * 100) / 100, Math.round(header.clefGlyph.height * 100) / 100],
    [4, 10.12, 40.26, 105.36],
    `${name} 谱号盒必须是 671×1756 字体单位按 15rpx/250 折算出来的 40.26×105.36rpx`,
  );
  assert.equal(layout.staffYForStep(2), 76, '谱号锚点（G4）必须落在第二线 76rpx');
}
// 可写答题谱与只读谱例必须共用同一套谱面壳（谱线 + 谱头）：任何渲染器局部偏移都会在这里暴露。
assert.deepEqual(
  headerGlyphNodes(answerWhole).map((node) => node.props.box),
  headerGlyphNodes(previewWhole).map((node) => node.props.box),
  '答题谱与只读谱例的谱头字形必须逐值相同（同一条 rpx 几何）',
);
assert.deepEqual(
  staffLineNodes(answerWhole).map((line) => line.props.y1),
  staffLineNodes(previewWhole).map((line) => line.props.y1),
  '答题谱与只读谱例的谱线必须完全重合',
);
assert.deepEqual(
  noteheadNodes(answerWhole).map((head) => head.props.y),
  noteheadNodes(previewWhole).map((head) => head.props.y),
  '同一批音在答题谱与只读谱例上的谱位必须一致',
);

const answerChord = rendererHarness.renderComponent(AnswerStaff, {
  pitches: [61, 63], spellings: ['C#4', 'D#4'], stacked: true, disabled: true,
});
const previewChord = rendererHarness.renderComponent(StaffPreview, { midis: [61, 63], harmonic: true, wholeNotes: true });
for (const [name, render] of [['AnswerStaff', answerChord], ['StaffPreview', previewChord]]) {
  const heads = noteheadNodes(render).sort((left, right) => left.props.x - right.props.x);
  const accidentals = accidentalNodes(render).sort((left, right) => left.props.rightEdgeX - right.props.rightEdgeX);
  assert.equal(heads.length, 2, `${name} 和声音程必须有 2 个符头`);
  assert.deepEqual(accidentals.map((node) => node.props.acc), ['#', '#'], `${name} 必须画出两个升号`);
  // 二度错位：第二个符头右移 SECOND_HEAD_DX，临时记号必须跟着走（否则会压住符头）。
  assert.ok(Math.abs((heads[1].props.x - heads[0].props.x) - layout.SECOND_HEAD_DX) < 0.001,
    `${name} 二度和弦必须左右错开 ${layout.SECOND_HEAD_DX}rpx`);
  heads.forEach((head, index) => {
    const { left } = layout.noteheadBox(head.props.kind, head.props.x, head.props.y);
    assert.ok(Math.abs(accidentals[index].props.rightEdgeX - (left - layout.ACCIDENTAL_GAP)) < 0.001,
      `${name} 临时记号右缘必须落在符头 bbox 左缘 − ${layout.ACCIDENTAL_GAP}rpx`);
    assert.equal(accidentals[index].props.centerY, head.props.y, `${name} 临时记号必须与符头同高`);
  });
  assert.ok(Math.abs((accidentals[1].props.rightEdgeX - accidentals[0].props.rightEdgeX) - layout.SECOND_HEAD_DX) < 0.001,
    `${name} 两个升号必须各占一列（列距 ${layout.SECOND_HEAD_DX}rpx），不能叠在同一列`);
}

const stemRenders = [
  [rendererHarness.renderComponent(StaffPreview, { midis: [60, 81] }), 2],
  // ⚠️ 和声模式（harmonic）在小程序里恒为全音符（dur 4，无符干），要测和弦共用符干
  //    必须显式给事件形状。
  [rendererHarness.renderComponent(StaffPreview, { events: [{ midis: [60, 64], spellings: ['C4', 'E4'], dur: 1 }] }), 1],
  [rendererHarness.renderComponent(StaffPreview, { midis: [60, 64], harmonic: true }), 0],
];
stemRenders.forEach(([render, expectedStemCount]) => {
  const heads = noteheadNodes(render);
  const stems = stemNodes(render);
  assert.equal(stems.length, expectedStemCount, '预览必须保留每个孤立符干或和弦共用符干');
  stems.forEach((stem) => {
    const x1 = Number(stem.props.x1);
    const y1 = Number(stem.props.y1);
    const y2 = Number(stem.props.y2);
    assert.equal(Number(stem.props.x2), x1, '符干必须垂直');
    assert.ok(Math.abs(Math.abs(y2 - y1) - layout.STEM_LENGTH) < 0.01, `符干长度必须是 ${layout.STEM_LENGTH}rpx`);
    const attached = heads.filter((candidate) => {
      const { left, width } = layout.noteheadBox(candidate.props.kind, candidate.props.x, candidate.props.y);
      const inset = layout.STAFF_LINE_GAP * 0.2;
      return x1 >= left + inset - 1e-6 && x1 <= left + width - inset + 1e-6;
    });
    assert.ok(attached.length, '符干必须从符头内部起笔（不能贴边或落到隔壁符头）');
    assert.ok(attached.some((head) => Math.abs(head.props.y - y1) < 1e-6 || Math.abs(head.props.y - y2) < 1e-6),
      '符干必须有一端落在同组某个符头的中心高度上（和弦取最高/最低音）');
  });
  assert.deepEqual(beamNodes(render, 'b'), [], '四分音符不得生成连符杠');
});

const emptyAnswer = rendererHarness.renderComponent(AnswerStaff, {
  pitches: [], disabled: true, emptyText: '播放题目后开始作答',
});
const prompt = emptyAnswer.nodes.find((node) => node.type === 'Text' && node.props.children === '播放题目后开始作答');
const promptStyle = flattenRendererStyle(prompt.props.style);
// 小程序 .staff-notation .empty：left/right 0、top 31rpx、height 60rpx、font-size 20rpx。
assert.equal(promptStyle.left, 0, '空态提示必须与壳体同宽（left: 0）');
assert.equal(promptStyle.right, 0, '空态提示必须与壳体同宽（right: 0）');
assert.equal(promptStyle.textAlign, 'center', '空态提示必须水平居中');
assert.equal(promptStyle.top, layout.EMPTY_TOP * layout.RPX_TO_PT, '空态提示上缘必须是 31rpx → 15.5pt');
assert.equal(promptStyle.height, layout.EMPTY_HEIGHT * layout.RPX_TO_PT, '空态提示盒高必须是 60rpx → 30pt');
assert.equal(promptStyle.fontSize, layout.EMPTY_FONT_SIZE * layout.RPX_TO_PT, '空态提示字号必须是 20rpx → 10pt（≥ 9pt 底线）');
assert.equal(layout.EMPTY_TOP + layout.EMPTY_HEIGHT / 2, layout.emptyTextCenterY(), '空态提示必须垂直居中于第三线（61rpx）');

// Timed tests exercise real editor handlers and inspect the emitted SVG. Removing
// prerequisite guards or merging adjacent beat runs must fail these fixtures.
const timedFailures = [];
function timedCheck(name, run) {
  try { run(); } catch (error) { timedFailures.push(`${name}: ${error.message}`); }
}
const timedHarness = pitchHarness();
const { TimedAnswerStaff, NotationStaff } = timedHarness.load('./src/components/notation-editor.tsx');
const timedLineNodes = (render) => render.nodes.filter((node) => node.type === 'Line');
const timedBeams = (render, prefix) => timedLineNodes(render).filter((node) => new RegExp(`^${prefix}-\\d+$`).test(node.key));
const timedNamed = (render, name) => render.nodes.filter((node) => node.type?.name === name);
/** 谱头字形 = 出现在第一个音符之前的 MusicGlyph（音符/记号/休止符共用同一个出口） */
const timedHeaderGlyphs = (render) => {
  const firstNote = render.nodes.findIndex((node) => node.type?.name === 'MusicNotehead' || node.type?.name === 'MusicRest');
  return render.nodes.slice(0, firstNote < 0 ? render.nodes.length : firstNote)
    .filter((node) => node.type?.name === 'MusicGlyph');
};
const timedGlyphNames = (render) => timedHeaderGlyphs(render).map((node) => node.props.name);
for (const [meter, duration, count, primaryCount] of [
  ['2/4', 0.5, 4, 2], ['4/4', 0.5, 8, 4],
  ['3/8', 0.25, 6, 1], ['6/8', 0.5, 6, 2],
]) {
  for (const continuation of [false, true]) timedCheck(`${meter}/${duration}/${continuation ? 'continuation' : 'first'} beams`, () => {
    const barOffset = continuation ? 2 : 0;
    const events = Array.from({ length: count * 2 }, (_, index) => ({ midi: 69, duration, barIndex: barOffset + Math.floor(index / count) }));
    const render = timedHarness.renderComponent(TimedAnswerStaff, { events, meter: continuation ? '' : meter, capacityMeter: meter, keySignature: '', barOffset, barCount: 2, isFinalSystem: true, disabled: true, emptyText: '' });
    assert.equal(timedBeams(render, 'b').length, primaryCount * 2, '连符杠必须在每个拍组与小节线处断组');
    assert.equal(timedNamed(render, 'MusicTuplet').length, 0, '普通拍组不得画三连音「3」');
    // 拍号现在是 Bravura 字形（小程序 <image> + staff-glyph-metrics），不再是 SVG 文本。
    const names = timedGlyphNames(render);
    assert.ok(names.includes('clef'), '谱号在任何一行都必须画出');
    assert.equal(names.filter((name) => name.startsWith('time')).length, continuation ? 0 : 2,
      '续行必须只隐藏拍号字形（小程序 meter 传空串）');
  });
}

for (const [meter, count, expectedDuration, expectedByLine] of [
  ['3/8', 3, 1, {
    first: { groups: 1, tuplets: 1, tupletX: 227.89, endpoints: [[130.85, 339.63]] },
    continuation: { groups: 1, tuplets: 1, tupletX: 203, endpoints: [[98.85, 321.85]] },
  }],
  ['4/4', 12, 4, {
    first: { groups: 4, tuplets: 1, tupletX: 371, endpoints: [[124.85, 211.85], [250.85, 337.85], [376.85, 463.85], [502.85, 589.85]] },
    continuation: { groups: 4, tuplets: 1, tupletX: 357, endpoints: [[92.85, 185.85], [227.85, 320.85], [362.85, 455.85], [497.85, 590.85]] },
  }],
  ['6/8', 9, 3, {
    first: { groups: 2, tuplets: 1, tupletX: 351, endpoints: [[124.85, 359.85], [414.85, 591.85]] },
    continuation: { groups: 2, tuplets: 1, tupletX: 335, endpoints: [[92.85, 343.85], [402.85, 591.85]] },
  }],
]) {
  for (const continuation of [false, true]) timedCheck(`${meter} ${meter === '3/8' ? 'partial' : 'complete'} tuplet ${continuation ? 'continuation' : 'first'} groups`, () => {
    const barOffset = continuation ? 2 : 0;
    const events = Array.from({ length: count }, () => ({ midi: 69, duration: 1 / 3, barIndex: barOffset }));
    assert.equal(events.reduce((sum, event) => sum + event.duration, 0), expectedDuration, '三连音样例必须保留其字面记谱时长');
    const render = timedHarness.renderComponent(TimedAnswerStaff, { events, meter: continuation ? '' : meter, capacityMeter: meter, keySignature: '', barOffset, barCount: 1, isFinalSystem: true, disabled: true, emptyText: '' });
    const flags = timedNamed(render, 'MusicFlag');
    const tuplets = timedNamed(render, 'MusicTuplet');
    const rounded = (value) => Math.round(Number(value) * 1000) / 1000;
    const groups = [
      ...timedBeams(render, 'b').map((beam) => [rounded(beam.props.x1), rounded(beam.props.x2)]),
      ...flags.map((flag) => [rounded(flag.props.stemX), rounded(flag.props.stemX)]),
    ].sort((left, right) => left[0] - right[0]);
    const expected = expectedByLine[continuation ? 'continuation' : 'first'];
    assert.equal(groups.length, expected.groups, `${meter} 必须按拍组切分连符杠`);
    // ⚠️ 小程序 flushTriplet 只按「idx 连续」分组，**不**按拍组：12 个连续三连音只有 1 个「3」。
    assert.equal(tuplets.length, expected.tuplets, `${meter} 必须按「连续 idx」而不是按拍组计数「3」`);
    assert.deepEqual(groups, expected.endpoints, `${meter} 符杠端点必须唯一确定组内成员`);
    assert.equal(rounded(tuplets[0].props.x), expected.tupletX, `${meter} 「3」必须压在本组中间那个音上`);
  });
}

timedCheck('header and notation anchors', () => {
  const base = { events: [], meter: '4/4', capacityMeter: '4/4', barOffset: 0, barCount: 2, isFinalSystem: true, disabled: true, emptyText: '' };
  for (const keySignature of ['G', 'F']) {
    const render = timedHarness.renderComponent(TimedAnswerStaff, { ...base, keySignature });
    const header = layout.headerSymbols(keySignature, '4/4');
    // 谱号 / 调号 / 拍号必须逐值等于 headerSymbols，不得有渲染器局部偏移。
    assert.deepEqual(timedHeaderGlyphs(render).map((node) => [node.props.name, node.props.box]), [
      ['clef', header.clefGlyph],
      [header.keyGlyph.name, header.keyGlyph],
      ...header.meterGlyphs.map((glyph) => [glyph.name, glyph]),
    ], `${keySignature} 调的谱号/调号/拍号字形必须逐值取自 headerSymbols`);
    assert.deepEqual(header.meterGlyphs.map((glyph) => Math.round(glyph.top * 100) / 100), [30.94, 60.94],
      '拍号数字必须锚在第二线(46rpx)/第四线(76rpx)上，不得压线或漂移');
    assert.deepEqual(header.meterGlyphs.map((glyph) => glyph.left), [74.6, 74.6],
      '拍号数字必须共用一个 35rpx 时间列（左侧让位给调号）');
  }
  const gKey = layout.headerSymbols('G', '4/4').keyGlyph;
  assert.deepEqual([gKey.left, Math.round(gKey.top * 100) / 100], [47, 12.1],
    'G 调升号左缘必须 47rpx、锚点落在顶线(31rpx)，尺寸按 sharp ×0.9 收一档');
  const fKey = layout.headerSymbols('F', '4/4').keyGlyph;
  assert.deepEqual([fKey.left, Math.round(fKey.top * 100) / 100], [48, 34.66],
    'F 调降号左缘必须 48rpx、锚点落在第三线(61rpx)');

  const dots = timedHarness.renderComponent(TimedAnswerStaff, {
    ...base, meter: '2/4', capacityMeter: '2/4', keySignature: '',
    events: [{ midi: 64, duration: 0.75, barIndex: 0 }, { midi: 69, duration: -0.75, rest: true, barIndex: 0 }],
  });
  const rest = timedNamed(dots, 'MusicRest')[0];
  assert.deepEqual([rest.props.x, rest.props.kind], [329, 'eighth'],
    '休止符必须保持时间位置（rpx）与 SMuFL 字形');
  assert.deepEqual(
    timedNamed(dots, 'MusicDot').map((node) => [Math.round(node.props.noteRightX * 100) / 100, node.props.centerY]),
    [[157.85, 83.5], [336.41, 53.5]],
    '音符附点与休止符附点必须共用同一套行/间锚点（rpx）',
  );
  const isolated = timedHarness.renderComponent(TimedAnswerStaff, {
    ...base, meter: '2/4', capacityMeter: '2/4', keySignature: '',
    events: [{ midi: 64, duration: 1, barIndex: 0 }, { midi: 69, duration: 0.5, barIndex: 0 }, { midi: 69, duration: -0.5, rest: true, barIndex: 0 }],
  });
  assert.deepEqual(timedLineNodes(isolated).filter((node) => /^s-\d+$/.test(node.key))
    .map((node) => [node.props.x1, node.props.y1, node.props.y2]),
  [[154.85, 45.64, 91], [244.85, 23.14, 68.5]], '孤立符干必须从符头内部起笔并保持 45.36rpx 长度');
  const flag = timedNamed(isolated, 'MusicFlag');
  assert.equal(flag.length, 1, '只有八分音符需要独立符尾（四分音符不得挂符尾）');
  assert.deepEqual([flag[0].props.stemX, flag[0].props.stemEndY, flag[0].props.beamCount, flag[0].props.direction],
    [244.85, 23.14, 1, 'up'], '独立符尾必须挂在符干末端');
  assert.deepEqual(timedBeams(isolated, 'b'), [], '孤立音符不得生成连符杠');
});

timedCheck('barline and final-bar bounds', () => {
  const props = { events: [], meter: '', capacityMeter: '6/8', keySignature: '', barOffset: 2, barCount: 2, disabled: true, emptyText: '' };
  const continuation = timedHarness.renderComponent(TimedAnswerStaff, { ...props, isFinalSystem: false });
  assert.deepEqual(timedGlyphNames(continuation), ['clef'], '续行必须只画谱号，不画拍号字形');
  const bars = continuation.nodes.filter((node) => /^bar-/.test(node.key));
  // 空谱面固定两小节：小程序 FIXED_BAR_LEFT_COMPACT 112 / FIXED_BAR_RIGHT_COMPACT 8 → 小节线 367rpx。
  assert.deepEqual(bars.map((node) => [node.props.x1, node.props.y1, node.props.y2]), [[367, 31, 91]],
    '小节线必须落在 horizontalLayout 的小节边界上，且与谱线首/末线同高（31/91rpx）');
  assert.ok(!continuation.nodes.some((node) => /^endline-/.test(node.key)),
    '非末行不得画结束线（小程序 answer-staff 只在 last 时给 .endline）');

  const final = timedHarness.renderComponent(TimedAnswerStaff, { ...props, isFinalSystem: true });
  const endlines = final.nodes.filter((node) => /^endline-/.test(node.key));
  assert.deepEqual(endlines.map((node) => [node.props.x1, node.props.y1, node.props.y2, node.props.strokeWidth]), [
    [VIEWBOX_WIDTH_RPX - layout.ENDLINE_WIDTH + layout.ENDLINE_THIN / 2, 31, 91, layout.ENDLINE_THIN],
    [VIEWBOX_WIDTH_RPX - layout.ENDLINE_THICK / 2, 31, 91, layout.ENDLINE_THICK],
  ], '结束线必须是「细 2rpx + 粗 4rpx、总宽 12rpx」双线，且与普通小节线同高');
});

timedCheck('rests and secondary beams', () => {
  const events = [0.5, -0.5, 0.5, 0.5, ...Array(8).fill(0.25)].map((duration, index) => ({ midi: 69, duration, rest: duration < 0, barIndex: index < 4 ? 0 : 1 }));
  const render = timedHarness.renderComponent(TimedAnswerStaff, { events, meter: '2/4', capacityMeter: '2/4', keySignature: '', barOffset: 0, barCount: 2, isFinalSystem: true, disabled: true, emptyText: '' });
  assert.equal(timedBeams(render, 'b').length, 3, '休止符必须断开连符杠，且不影响后续拍组的小节归属');
  assert.equal(timedBeams(render, 'b2').length, 2, '次级符杠必须与主符杠同组（四音一组各一条）');
  assert.equal(timedBeams(render, 'bl').length, 0, '四音一组不应退化成短杠 beamlet');
  assert.equal(timedNamed(render, 'MusicRest').length, 1, '这条谱面只应有一个休止符');

  const downward = timedHarness.renderComponent(TimedAnswerStaff, {
    events: [{ midi: 72, duration: 0.5, barIndex: 0 }, { midi: 72, duration: 0.25, barIndex: 0 }],
    meter: '2/4', capacityMeter: '2/4', keySignature: '', barOffset: 0, barCount: 1,
    isFinalSystem: true, disabled: true, emptyText: '',
  });
  const primary = timedBeams(downward, 'b')[0];
  const secondary = timedBeams(downward, 'b2')[0] || timedBeams(downward, 'bl')[0];
  assert.ok(primary && secondary, '朝下的符干必须同时画出主符杠与次级符杠');
  assert.ok(secondary.props.y1 < primary.props.y1,
    '谱线以下的朝下符干，次级符杠必须在主符杠上方（BEAM_GAP 朝内收）');
});

timedCheck('read-only preview systems', () => {
  const render = timedHarness.renderComponent(NotationStaff, { events: Array.from({ length: 18 }, () => ({ midi: 69, duration: 0.5 })), meter: '6/8', barCount: 3 });
  const rows = render.nodes.filter((node) => node.type?.name === 'TimedAnswerStaff');
  assert.deepEqual(rows.map((row) => [row.props.barOffset, row.props.barCount, row.props.events.length, row.props.meter, row.props.capacityMeter, row.props.isFinalSystem]), [[0, 2, 12, '6/8', '6/8', false], [2, 1, 6, '', '6/8', true]], 'sequential preview events preserve the final partial system and continuation meter');
});

for (const type of ['rhythm', 'melody']) timedCheck(`${type} editing workflow`, () => {
  const editorHarness = pitchHarness();
  const { NotationEditor } = editorHarness.load('./src/components/notation-editor.tsx');
  const question = { type, meter: '6/8', beatsPerBar: 3, barCount: 4, keySignature: 'G', beats: Array(24).fill(0.5), durs: Array(24).fill(0.5), midis: Array(24).fill(69) };
  let answer = emptyExamAnswer();
  const render = (props = {}) => editorHarness.renderComponent(NotationEditor, { question, answer, unlocked: true, onChange: (next) => { answer = next; }, ...props });
  const staffRows = (value) => value.nodes.filter((node) => node.type?.name === 'TimedAnswerStaff');
  const button = (label) => render().nodes.find((node) => node.type === 'Pressable' && node.props.children?.props?.children === label);
  const ready = render({ unlocked: false });
  assert.ok(ready.text.includes('播放题目后开始作答'), 'ready staff must prompt playback before setup');
  assert.ok(!ready.text.includes('撤销'), 'ready phase must not expose editing tools');
  assert.ok(ready.nodes.filter((node) => node.props.accessibilityRole === 'radio').every((node) => node.props.disabled), 'ready setup controls are disabled');
  assert.ok(staffRows(render()).every((node) => node.props.disabled), 'missing meter must disable writing');
  staffRows(render())[0].props.onStaffTap(0, 60, 'C4');
  assert.deepEqual(answer.events, [], 'missing prerequisites cannot write events');
  button('6/8').props.onPress();
  if (type === 'melody') {
    assert.ok(staffRows(render()).every((node) => node.props.disabled), 'melody also requires key selection');
    assert.ok(render().text.includes('请先选择调号'));
    button('G 大调（1♯）').props.onPress();
  }
  assert.ok(staffRows(render()).every((node) => !node.props.disabled), 'complete setup enables writing');
  const choices = render().nodes.filter((node) => node.props.accessibilityRole === 'radio').map((node) => node.props.children.props.children);
  assert.ok(choices.indexOf('6/8') < choices.indexOf('附点二分'), 'meter comes before duration');
  if (type === 'melody') assert.ok(choices.indexOf('G 大调（1♯）') < choices.indexOf('附点二分'), 'key comes before duration');
  button('八分').props.onPress();
  staffRows(render())[1].props.onStaffTap(2, 60, 'C4');
  const entered = structuredClone(answer.events);
  button('十六分').props.onPress();
  assert.deepEqual(answer.events, entered, 'duration selection preserves entered notes');
  staffRows(render())[0].props.onStaffTap(0, 64, 'E4');
  assert.deepEqual(answer.events.map((event) => [event.barIndex, event.duration]), [[0, 0.25], [2, 0.5]], 'new notes use the selected duration while preserving earlier bars');
  button('撤销').props.onPress();
  assert.deepEqual(answer.events, entered, 'undo removes last input, not the last item in bar order');
  button('写休止符').props.onPress();
  staffRows(render())[0].props.onStaffTap(0, 64, 'E4');
  assert.equal(answer.events[0].rest, true);
  assert.equal(answer.events[0].duration, -0.25);
  if (type === 'rhythm') {
    // 小程序 practice.js：inputTie 只对节奏题开放，且与休止符互斥。
    assert.ok(button('休止符开启'), '开启休止符后必须显示开启态');
    button('写连音线').props.onPress();
    assert.ok(button('连音线开启'), '开启连音线后必须显示开启态');
    assert.ok(button('写休止符'), '开连音线必须自动把休止符关掉（两者互斥）');
    button('四分').props.onPress();
    staffRows(render())[0].props.onStaffTap(0, 67, 'G4');
    // ⚠️ events 是「按小节排序」的，最后写入的那条不一定是数组末位 —— 与 undo() 同口径取 inputOrder 最大者。
    const latest = answer.events.reduce((best, event) => Number(event.inputOrder) > Number(best.inputOrder) ? event : best, answer.events[0]);
    assert.equal(latest.tieToNext, true, '开启连音线后写入的音必须带 tieToNext');
    assert.equal(latest.rest, undefined, '连音线与休止符不能同时生效');
  } else {
    assert.ok(!button('写连音线'), '旋律题不得暴露连音线输入（小程序只对节奏题开放 inputTie）');
    assert.ok(!answer.events.some((event) => event.tieToNext), '旋律题的事件不得带连音线');
  }
  const comparison = render({ unlocked: false, disabled: true, showCorrect: true, reviewCorrect: false });
  const rows = staffRows(comparison);
  assert.deepEqual(rows.map((row) => [row.props.barOffset, row.props.barCount, row.props.isFinalSystem]), [[0, 2, false], [0, 2, false], [2, 2, true], [2, 2, true]], 'user and correct rows share two-measure system boundaries');
  assert.deepEqual(rows.map((row) => row.props.meter), ['6/8', '6/8', '', '']);
  assert.ok(rows.every((row) => row.props.capacityMeter === '6/8' && row.props.disabled), 'every feedback row retains its layout meter and is read-only');
  assert.equal(rows[1].props.events.length, 12);
  assert.equal(rows[3].props.events.length, 12);
  assert.deepEqual(rows.map((row) => row.props.tone), ['red', 'green', 'red', 'green']);
  assert.ok(!comparison.text.includes('撤销'), 'feedback hides editing tools');
  assert.deepEqual(staffRows(render({ unlocked: false, disabled: true, showCorrect: true, reviewCorrect: true })).map((row) => row.props.tone), ['green', 'green'], 'correct feedback shows only the green user systems');
  answer = { ...answer, meter: '3/8' };
  const wrongMeterRows = staffRows(render({ unlocked: false, disabled: true, showCorrect: true, reviewCorrect: false }));
  assert.deepEqual(wrongMeterRows.map((row) => row.props.capacityMeter), ['3/8', '6/8', '3/8', '6/8'], 'incorrect user meter must not change standard-answer layout or disappear on continuation');
});
assert.deepEqual(timedFailures, [], 'timed notation parity failures');

const pianoHarness = pitchHarness();
const { PianoKeyboard } = pianoHarness.load('./src/components/piano-keyboard.tsx');
const announcements = [];
pianoHarness.mocks['react-native'].AccessibilityInfo.announceForAccessibility = (text) => announcements.push(text);
const flattenStyle = (style) => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flattenStyle)) : style || {};
// 键盘面按小程序 .keyboard 的底色定位；padding 会随小程序 5rpx 令牌变化，不能当特征值用。
const isKeyboardSurface = (style) => Boolean(style.height) && String(style.backgroundColor).toUpperCase() === '#0C0D10';
const childText = (node) => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(childText).join('')
  : typeof node === 'object' ? childText(node.props?.children) : String(node);
const descendantNodes = (node) => {
  const values = [];
  const visit = (value) => {
    if (value == null || typeof value === 'boolean') return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== 'object') return;
    values.push(value);
    visit(value.props?.children);
  };
  visit(node?.props?.children);
  return values;
};

// Removing the explicit range would silently fall back to a component default,
// while changing the lock structure would regress mini-program parity.
harness.start('single', { type: 'single', typeName: '单音听记', midis: [60], answer: [60] }, 'ready', emptyExamAnswer());
const lockedReview = harness.render();
const lockedKeyboard = lockedReview.nodes.find((node) => node.type === harness.mocks['@/components/piano-keyboard'].PianoKeyboard);
assert.equal(lockedKeyboard.props.startMidi, 55, 'practice must explicitly keep the review piano at G3');
assert.equal(lockedKeyboard.props.endMidi, 81, 'practice must explicitly keep the review piano at A5');
assert.equal(lockedKeyboard.props.disabled, true, 'practice must disable the review piano before feedback');
const lockCover = lockedReview.nodes.find((node) => node.props.accessibilityLabel === '复盘钢琴待解锁，提交答案后解锁');
assert.ok(lockCover, 'locked review piano must expose the complete unlock instruction');
const lockCoverStyle = flattenStyle(lockCover.props.style);
assert.equal(lockCoverStyle.alignItems, 'center');
assert.equal(lockCoverStyle.justifyContent, 'center');
const pianoSurfaceStyle = pianoHarness.renderComponent(PianoKeyboard, {}).nodes.map((node) => flattenStyle(node.props.style))
  .find(isKeyboardSurface);
assert.deepEqual(
  { top: lockCoverStyle.top, height: lockCoverStyle.height, bottom: lockCoverStyle.bottom },
  { top: 0, height: pianoSurfaceStyle.height, bottom: undefined },
  'lock cover must match the piano surface instead of stretching through the legend',
);
const lockStage = lockedReview.nodes.find((node) => node.type === 'View'
  && (Array.isArray(node.props.children) ? node.props.children : [node.props.children]).includes(lockCover));
assert.deepEqual(
  { position: flattenStyle(lockStage?.props.style).position, overflow: flattenStyle(lockStage?.props.style).overflow },
  { position: 'relative', overflow: 'hidden' },
  'review piano and lock cover must share one clipped stage',
);
const lockViews = descendantNodes(lockCover).filter((node) => node.type === 'View');
const lockTile = lockViews.find((node) => {
  const style = flattenStyle(node.props.style);
  return style.width === style.height && style.width >= 44 && String(style.backgroundColor).startsWith('rgba(');
});
assert.ok(lockTile, 'lock artwork must sit in a centered translucent tile');
assert.ok(descendantNodes(lockTile).some((node) => {
  const style = flattenStyle(node.props.style);
  return node.type === 'View' && style.width > style.height && style.height > 0 && style.borderRadius >= style.height / 2;
}), 'lock artwork must include a horizontal capsule keyhole');

for (const [highlight, mark, label] of [['correct', '✓', '正确音'], ['wrong', '×', '错误音'], ['play', '▶', '正在播放'], ['std', '●', '标准音']]) {
  const render = pianoHarness.renderComponent(PianoKeyboard, { highlights: { 60: highlight, 61: highlight }, onKeyPress: () => {} }, true);
  pianoHarness.runEffects();
  for (const pitch of ['C4', 'C♯4']) {
    const key = render.nodes.find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === `钢琴键 ${pitch}`);
    assert.ok(childText(key.props.children).includes(mark), `${pitch} ${label} must have a visible non-color marker`);
    assert.equal(key.props.accessibilityValue?.text, label, `${pitch} must announce its current highlight meaning when focused`);
  }
  assert.ok(announcements.at(-1)?.includes(`C4，${label}`), 'changed piano feedback must request an iOS screen-reader announcement');
  assert.ok(render.text.includes(`${mark} ${label}`), 'visible piano markers need an understandable legend');
}
const announcementCount = announcements.length;
pianoHarness.renderComponent(PianoKeyboard, { disabled: true, highlights: { 60: 'play' }, onKeyPress: () => {} }, true);
pianoHarness.runEffects();
assert.equal(announcements.length, announcementCount, 'locked or question-playing piano must not interrupt audio with review announcements');
pianoHarness.renderComponent(PianoKeyboard, { onKeyPress: () => {} }, true);
pianoHarness.runEffects();
assert.equal(announcements.at(-1), '播放结束', 'clearing the last playing key must expose an audible end state');
for (const compact of [false, true]) {
  const render = pianoHarness.renderComponent(PianoKeyboard, { startMidi: 55, endMidi: 81, compact, onKeyPress: () => {} });
  const keys = render.nodes.filter((node) => node.type === 'Pressable');
  const styles = keys.map((node) => flattenStyle(node.props.style({ pressed: false })));
  const whites = styles.filter((style) => style.flex === 1);
  const blacks = styles.filter((style) => style.position === 'absolute');
  assert.equal(whites.length, 16, 'all 16 white keys must remain in one visible row');
  assert.equal(blacks.length, 11);
  assert.ok(whites.every((style) => !style.minWidth), 'dense piano keys must retain flexible widths');
  assert.ok(blacks.every((style) => parseFloat(style.left) >= 0 && parseFloat(style.left) + parseFloat(style.width) <= 100), 'black keys must fit inside the keybed');
  const keyboardStyle = render.nodes.map((node) => flattenStyle(node.props.style)).find(isKeyboardSurface);
  assert.equal(keyboardStyle.width, '100%', 'the G3–A5 keyboard must fit the available 320-point stage without horizontal scrolling');
  const keybedWidth = 320 - keyboardStyle.padding * 2;
  assert.ok(blacks.every((style) => (parseFloat(style.left) + parseFloat(style.width)) * keybedWidth / 100 <= keybedWidth),
    'percentage-positioned black keys must not overflow a 320-point keybed');
  const whiteNodes = keys.filter((node) => flattenStyle(node.props.style({ pressed: false })).flex === 1);
  assert.deepEqual(whiteNodes.map((node) => childText(node.props.children)),
    ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'],
    'all white keys must keep their bottom pitch labels');
  assert.ok(whiteNodes.every((node) => {
    const face = node.props.children;
    const style = flattenStyle(face.props.style);
    return style.justifyContent === 'flex-end' && style.paddingBottom > 0;
  }), 'white-key labels must remain aligned to the bottom edge');
  const keybedHeight = keyboardStyle.height - keyboardStyle.padding * 2;
  const blackHeight = keybedHeight * parseFloat(blacks[0].height) / 100;
  assert.ok(blackHeight >= 44 && keybedHeight - blackHeight - 2 * whites[0].borderWidth >= 44, 'black and exposed white key hit depths must remain at least 44 pt');
}

console.log(`practice parity contract passed (${files.length} source files, ${pitchCases.length} pitch workflows, 14 beam fixtures, 6 staff-anchor fixtures and 2 timed editing workflows checked)`);

async function flushAsyncEffects() {
  for (let count = 0; count < 12; count += 1) await Promise.resolve();
}

(async () => {
  const flow = pitchHarness();
  const values = new Map();
  flow.mocks['@react-native-async-storage/async-storage'] = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
  const local = flow.load('./src/services/local-data.ts');
  Object.assign(flow.mocks['@/services/local-data'], local);
  flow.mocks['@/services/audio-engine'].stopQuestionAudio = () => {};
  let playback;
  flow.mocks['@/services/audio-engine'].playQuestionAudio = async (_question, options) => { playback = options; return true; };
  let route;
  flow.mocks['expo-router'].router = { push: (next) => { route = next; } };
  const question = { type: 'intervalConnection', typeName: '和声音程连接', chords: [[60, 64], [62, 69]],
    answer: [[60, 64], [62, 69]], answerText: 'C4 E4 → D4 A4', knowledgeKey: 'connection-flow' };
  flow.start('connection', question, 'answering', { ...emptyExamAnswer(), pitches: [60, 65, 62, 69] });
  const findButton = (render, label) => render.nodes.find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === label);
  submitButton(flow.render()).props.onPress();
  await flushAsyncEffects();
  assert.equal((await local.getWrongRecords()).length, 1, 'submitting an incorrect connection must save it');

  const Wrongbook = flow.load('./src/app/(tabs)/wrongbook.tsx').default;
  const wrongbook = (captureEffects = false) => flow.renderComponent(Wrongbook, {}, captureEffects);
  wrongbook(true);
  flow.runEffects();
  await flushAsyncEffects();
  const group = findButton(wrongbook(), '和声音程连接，1 个错题');
  assert.ok(group, 'the saved connection must appear as an accessible wrongbook group');
  group.props.onPress();
  findButton(wrongbook(), 'C4 E4 → D4 A4，错误 1 次，开始强化').props.onPress();
  assert.equal(route.pathname, '/practice');
  assert.equal(route.params.type, 'connection');
  assert.equal(route.params.wrongId, (await local.getWrongRecords())[0].id);
  flow.openReview(route.params);
  flow.render(true);
  flow.runEffects();
  await flushAsyncEffects();
  let review = flow.render();
  assert.ok(review.text.includes('第 1 组 · 叠写两个音') && review.text.includes('第 2 组 · 叠写两个音'), 'the wrongbook route must load the original connection groups');
  findButton(review, '播放题目').props.onPress();
  await flushAsyncEffects();
  // Simulate playback completion after the start promise settles.
  playback.onFinish();
  review = flow.render();
  const staffs = review.nodes.filter((node) => node.type?.name === 'AnswerStaff');
  staffs[0].props.onChange([64, 60], ['E4', 'C4']);
  staffs[1].props.onChange([69, 62], ['A4', 'D4']);
  assert.equal(submitButton(flow.render()).props.disabled, false, 'both recovered groups must be editable and complete');
  submitButton(flow.render()).props.onPress();
  await flushAsyncEffects();
  assert.equal((await local.getPracticeRecords())[0].correct, true, 'retry must retain unordered-within-group scoring');
  findButton(flow.render(), '查看结果').props.onPress();
  await flushAsyncEffects();
  assert.equal((await local.getWrongRecords()).length, 0, 'a correctly retried connection is removed on completion');
  console.log('wrongbook flow passed: incorrect connection → stored group → original question retry → correct completion');

  const manual = pitchHarness();
  let noteLifecycle, settleNote;
  manual.mocks['@/services/audio-engine'].playPianoNote = (midi, volume, options) => {
    assert.equal(midi, 62);
    // 音量默认值引用 audio-settings 常量，不写死数字 —— 改默认音量时不用回来改测试。
    assert.equal(volume, Number(/DEFAULT_AUDIO_VOLUME\s*=\s*(\d+)/.exec(audioSettings)[1]) / 100);
    noteLifecycle = options;
    return new Promise((resolve) => { settleNote = resolve; });
  };
  manual.start('single', { type: 'single', midis: [60], answer: [60] }, 'feedback', { ...emptyExamAnswer(), pitches: [62] });
  const keyboard = () => manual.render().nodes.find((node) => node.type === manual.mocks['@/components/piano-keyboard'].PianoKeyboard);
  keyboard().props.onKeyPress(62);
  assert.notEqual(keyboard().props.highlights[62], 'play', 'a loading manual note must not start its visual lifetime early');
  noteLifecycle.onStart();
  settleNote('started');
  await flushAsyncEffects();
  assert.equal(keyboard().props.highlights[62], 'play', 'native start must activate the manual key');
  noteLifecycle.onFinish();
  assert.deepEqual(keyboard().props.highlights, { 60: 'correct', 62: 'wrong' }, 'audio end must restore grading highlights');
  keyboard().props.onKeyPress(62);
  settleNote('failed');
  await flushAsyncEffects();
  assert.deepEqual(keyboard().props.highlights, { 60: 'correct', 62: 'wrong' }, 'failed loading must leave grading intact without a playing key');
  assert.ok(manual.render().text.includes('音频暂时无法播放，请重试'), 'an actual manual playback failure must show the safe retry prompt');
  console.log('manual piano UI lifecycle passed: delayed start, audio end and failure');

  const playbackRace = pitchHarness();
  const pendingStarts = [];
  const pendingOptions = [];
  playbackRace.mocks['@/services/audio-engine'].stopQuestionAudio = () => {};
  playbackRace.mocks['@/services/audio-engine'].playQuestionAudio = (_question, options) => new Promise((resolve) => {
    pendingStarts.push(resolve);
    pendingOptions.push(options);
  });
  playbackRace.start('single', { type: 'single', typeName: '单音听记', midis: [60], answer: [60], repeatCount: 3 }, 'ready', emptyExamAnswer());
  const playButton = (render) => render.nodes.find((node) => node.type === 'Pressable' && ['播放题目', '再听一遍', '回放正确答案', '音频播放中'].includes(node.props.accessibilityLabel));
  playButton(playbackRace.render()).props.onPress();
  assert.equal(playButton(playbackRace.render()).props.disabled, true, 'the first pending playback must disable its button');
  pendingOptions[0].onInterrupted();
  playButton(playbackRace.render()).props.onPress();
  assert.equal(playButton(playbackRace.render()).props.disabled, true, 'the replacement pending playback must disable its button');
  pendingStarts[0](false);
  await flushAsyncEffects();
  assert.equal(playButton(playbackRace.render()).props.disabled, true, 'a stale playback result must not clear the replacement request preparing state');

  const failedSave = pitchHarness();
  failedSave.mocks['@/services/audio-engine'].stopQuestionAudio = () => {};
  Object.assign(failedSave.mocks['@/services/local-data'], {
    savePracticeResult: async () => { throw new Error('disk full'); },
    finalizePracticeSubmission: (_completed, _index, score, correct) => score + (correct ? 1 : 0),
    clearActivePracticeSession: async () => {},
  });
  failedSave.start('single', { type: 'single', typeName: '单音听记', midis: [60], answer: [60] }, 'answering', { ...emptyExamAnswer(), pitches: [62] });
  submitButton(failedSave.render()).props.onPress();
  await flushAsyncEffects();
  failedSave.render().nodes.find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '查看结果').props.onPress();
  const failedResult = failedSave.render();
  assert.ok(!failedResult.text.includes('1 道错题已收入错题复盘'), 'a failed local write must not be reported as saved');
  assert.ok(failedResult.text.includes('1 道错题未能保存，请返回后重试'), 'completion must retain an actionable local-save failure summary');

  // Render the whole mock-exam route with the real shared staff components.
  // The storage/audio seams stay mocked because they are the platform boundaries,
  // while ready, playing, answering, feedback and submitted trees remain real.
  const exam = pitchHarness();
  const realNotation = exam.load('./src/components/notation-editor.tsx');
  const { AnswerStaff: ExamAnswerStaff } = exam.load('./src/components/answer-staff.tsx');
  const { StaffPreview: ExamStaffPreview } = exam.load('./src/components/staff-preview.tsx');
  exam.mocks['@/components/notation-editor'] = realNotation;
  exam.mocks['expo-router'].router = { replace() {} };
  let confirmExam;
  exam.mocks['react-native'].Alert = { alert: (_title, _message, actions) => { confirmExam = actions[1].onPress; } };
  let resolveExamPlayback, examPlaybackOptions;
  exam.mocks['@/services/audio-engine'] = {
    stopQuestionAudio() {},
    playQuestionAudio: (_question, options) => {
      examPlaybackOptions = options;
      return new Promise((resolve) => { resolveExamPlayback = resolve; });
    },
  };
  const choiceTimedEvents = Array.from({ length: 18 }, () => ({ midis: [69], dur: 0.5 }));
  const examQuestions = [
    { id: 'exam-ready', type: 'single', typeName: '单音听记', sectionTitle: '一、音高', points: 2, midis: [60], spellings: ['C4'], answerText: 'C4', repeatCount: 3 },
    { id: 'exam-correct', type: 'single', typeName: '单音听记', sectionTitle: '一、音高', points: 2, midis: [64], spellings: ['E4'], answerText: 'E4', repeatCount: 3 },
    { id: 'exam-wrong', type: 'single', typeName: '单音听记', sectionTitle: '一、音高', points: 2, midis: [81], spellings: ['A5'], answerText: 'A5', repeatCount: 3 },
    { id: 'exam-choice', type: 'single', typeName: '谱例选择', sectionTitle: '二、选择', points: 2, repeatCount: 3, choice: { correctIndex: 0, options: [
      { label: 'A', events: [{ midis: [64], dur: 1 }] },
      { label: 'B', events: choiceTimedEvents, meter: '6/8', barCount: 3 },
    ] } },
    { id: 'exam-rhythm', type: 'rhythm', typeName: '节奏听记', sectionTitle: '三、节奏', points: 6, meter: '6/8', beatsPerBar: 3, barCount: 3, examBars: 3, beats: Array(18).fill(0.5), repeatCount: 3 },
  ];
  const completeTimedAnswer = { ...emptyExamAnswer(), meter: '6/8', events: Array.from({ length: 18 }, (_, index) => ({ midi: 69, duration: 0.5, barIndex: Math.floor(index / 6) })) };
  completeTimedAnswer.events[0] = { ...completeTimedAnswer.events[0], duration: -0.5, rest: true };
  let examSession = {
    paper: { id: 'paper-flow', provinceId: 'zhejiang', provinceLabel: '浙江', framework: { title: '集成测试卷', year: '2026' }, questions: examQuestions, fullScore: 14, createdAt: 1 },
    answers: {
      'exam-ready': emptyExamAnswer(),
      'exam-correct': { ...emptyExamAnswer(), pitches: [64], spellings: ['E4'] },
      'exam-wrong': { ...emptyExamAnswer(), pitches: [79], spellings: ['G5'] },
      'exam-choice': { ...emptyExamAnswer(), choiceIndex: 0 },
      'exam-rhythm': completeTimedAnswer,
    },
    playCounts: {},
    unlockedIds: ['exam-correct', 'exam-wrong', 'exam-choice', 'exam-rhythm'],
    currentIndex: 0,
    updatedAt: 1,
  };
  let savedExamResult;
  exam.mocks['@/services/local-data'] = {
    getActiveExamSession: async () => examSession,
    getAudioVolume: async () => 78,
    saveExamSession: async (next) => { examSession = next; },
    saveExamResult: async (result) => { savedExamResult = result; },
    clearActiveExamSession: async () => {},
  };
  const ExamPaperScreen = exam.load('./src/app/exam-paper.tsx').default;
  assert.ok(exam.renderComponent(ExamPaperScreen, {}, true).text.includes('正在恢复试卷'), 'mock-exam route must begin in its ready/loading state');
  exam.runEffects();
  await flushAsyncEffects();
  const renderExam = () => exam.renderComponent(ExamPaperScreen, {});
  let examRender = renderExam();
  const examComponents = (Component) => examRender.nodes.filter((node) => node.type === Component);
  assert.equal(examComponents(ExamAnswerStaff).length, 3, 'mock exam must render basic user answers through shared AnswerStaff');
  // 小程序 exam.wxml：选择题的**每个**选项都是一条 <answer-staff>，所以两个选项 = 两条 StaffPreview。
  const choiceStaffs = examComponents(ExamStaffPreview);
  assert.equal(choiceStaffs.length, 2, 'mock exam must render every choice option through the shared StaffPreview');
  assert.deepEqual(choiceStaffs.map((staff) => staff.props.meter), ['', '6/8'], '选项谱面必须各自保留拍号（A 无拍号 / B 6/8）');
  assert.ok(choiceStaffs.every((staff) => staff.props.events.length > 0), '选项谱面必须原样收到选项事件，不得被拆成单音');
  // 路由里已不存在 NotationStaff（旧只读包装，当前无消费方）：小程序只有一种 answer-staff ——
  // 选择题的每个选项 → StaffPreview，听记题 → NotationEditor，内部再出共享 TimedAnswerStaff。
  assert.equal(examComponents(realNotation.NotationStaff).length, 0, '路由不得再引用已退休的 NotationStaff 只读包装');
  assert.equal(examComponents(realNotation.NotationEditor).length, 1, 'mock exam must render timed user answers through shared NotationEditor');
  assert.equal(examComponents(realNotation.TimedAnswerStaff).length, 2, '节奏听记 3 小节 → 2 个系统行，每行一个共享 TimedAnswerStaff');
  assert.ok(examRender.nodes.some((node) => node.type === 'Svg'), 'shared mock-exam consumers must reach real native SVG staff output');
  assert.equal(examComponents(ExamAnswerStaff)[0].props.disabled, true, 'unplayed mock-exam question must keep its shared answer staff locked');
  assert.ok(examComponents(ExamAnswerStaff).slice(1).every((staff) => staff.props.disabled === false), 'previously unlocked mock-exam answers must remain editable before submission');

  examRender.nodes.find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '播放本题').props.onPress();
  examRender = renderExam();
  assert.ok(examRender.nodes.some((node) => node.props.accessibilityLabel === '正在准备音频' && node.props.disabled), 'mock-exam playing flow must expose a disabled preparing control');
  resolveExamPlayback(true);
  await flushAsyncEffects();
  examRender = renderExam();
  assert.ok(examRender.nodes.some((node) => node.props.accessibilityLabel === '正在播放' && node.props.disabled), 'mock-exam playing flow must expose a disabled active-audio control');
  assert.equal(examRender.nodes.filter((node) => node.type === ExamAnswerStaff)[0].props.disabled, false, 'audio start must unlock the shared user-answer staff');
  examPlaybackOptions.onFinish();
  examRender = renderExam();
  examRender.nodes.filter((node) => node.type === ExamAnswerStaff)[0].props.onChange([60], ['C4']);
  examRender = renderExam();
  assert.deepEqual(examRender.nodes.filter((node) => node.type === ExamAnswerStaff)[0].props.pitches, [60], 'unlocked shared answer staff must update the mock-exam session');

  const submitExam = examRender.nodes.find((node) => node.type === 'Pressable' && childText(node.props.children) === '交 卷');
  submitExam.props.onPress();
  assert.equal(typeof confirmExam, 'function', 'mock-exam finish control must reach the confirmation boundary');
  await confirmExam();
  examRender = renderExam();
  assert.ok(examRender.text.includes('已完成交卷') && examRender.text.includes('标准答案已显示在原卷面'), 'submitted mock exam must render its finished state');
  assert.deepEqual({ questionCount: savedExamResult.questionCount, fullScore: savedExamResult.total }, { questionCount: 5, fullScore: 14 }, 'mock-exam completion must retain the original paper scope');
  const feedbackStaffs = examRender.nodes.filter((node) => node.type === ExamAnswerStaff);
  const correctFeedbackStaff = feedbackStaffs.find((staff) => staff.props.correctPitches[0] === 64);
  const wrongFeedbackStaff = feedbackStaffs.find((staff) => staff.props.correctPitches[0] === 81);
  assert.deepEqual([correctFeedbackStaff.props.disabled, correctFeedbackStaff.props.tone, correctFeedbackStaff.props.showCorrect], [true, 'green', false], 'correct mock-exam feedback must use the shared green user staff only');
  assert.deepEqual([wrongFeedbackStaff.props.disabled, wrongFeedbackStaff.props.tone, wrongFeedbackStaff.props.showCorrect], [true, 'red', true], 'wrong mock-exam feedback must use paired shared user and correct staffs');
  const timedExamFeedbackRows = examRender.nodes.filter((node) => node.type === realNotation.TimedAnswerStaff && node.props.tone);
  assert.deepEqual(timedExamFeedbackRows.map((row) => row.props.tone), ['red', 'green', 'red', 'green'], 'wrong timed mock-exam feedback must render paired shared user and standard staffs');
  assert.deepEqual(timedExamFeedbackRows.map((row) => row.props.meter), ['6/8', '6/8', '', ''], 'mock-exam continuation feedback must hide only the displayed meter');
  assert.ok(timedExamFeedbackRows.every((row) => row.props.capacityMeter === '6/8' && row.props.disabled), 'mock-exam standard-answer rows must preserve layout meter and read-only state');
  console.log('shared route flow passed: practice + wrong-answer retry + mock exam + choice/user/standard answers');
})().catch((error) => { console.error(error); process.exitCode = 1; });
