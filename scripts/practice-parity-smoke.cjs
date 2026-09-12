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
  'src/core/audio-settings.ts',
];
const source = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const practice = source['src/app/practice.tsx'];
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

assert.match(audioEngine, /const PIANO_NOTE_PLAYBACK_MS = 1850;[\s\S]*?pianoCleanup = setTimeout\([\s\S]*?PIANO_NOTE_PLAYBACK_MS\);/,
  'manual review audio must retain the full 1.85-second sample before cleanup');
assert.match(practice, /async function play\(\) \{[\s\S]*?stopQuestionAudio\(\);[\s\S]*?setHighlights\(\{\}\);/,
  'starting question replay must immediately remove a manual-key highlight');
assert.match(practice, /async function play\(\) \{[\s\S]*?stopQuestionAudio\(\);[\s\S]*?playQuestionAudio\(/,
  'starting question replay must cancel an active or pending manual piano request before question audio begins');
assert.match(practice, /function capturePracticeSnapshot\(\) \{[\s\S]*?snapshotPracticeHighlights\(phase, scoringQuestion, answer, correct, highlights\)[\s\S]*?highlights: snapshotHighlights/,
  'leaving feedback while a manual key is highlighted must persist reconstructed grading colors, not the transient highlight');
assert.match(practice, /<PianoKeyboard\b[^>]*\bdisabled=\{phase !== 'feedback' \|\| playing \|\| preparing\}[^>]*\bonKeyPress=\{phase === 'feedback' \? reviewPianoKey : undefined\}/,
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
assert.ok(timedStaffTags.length >= 3, 'all timed staff render paths must be present');
timedStaffTags.forEach((tag, index) => {
  assert.match(tag, /capacityMeter=\{(?:meter|answer\.meter|String\(question\.meter \|\| ''\))\}/, `timed staff ${index + 1} must receive a layout meter`);
  assert.match(tag, /meter=\{systemIndex === 0 \? (?:meter|answer\.meter|String\(question\.meter \|\| ''\)) : ''\}/, `timed staff ${index + 1} must hide display meter only on continuation systems`);
});

// Exercise production pitch renders and event handlers without a native runtime.
// Only device effects and unrelated timed/piano components are replaced. State
// names come from the AST so adding an earlier hook cannot shift test fixtures.
function pitchHarness() {
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
    '@/components/notation-editor': { NotationEditor: () => null },
    '@/components/piano-keyboard': { PianoKeyboard: () => null },
  };
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
    start(nextMode, question, phase, answer, correct = false) {
      mode = nextMode;
      params = {};
      screenRefs.length = 0;
      state = { practiceLoaded: true, activePracticeSession: { mode, questions: [question], snapshots: [], sessionId: 'test-session' }, phase, answer, correct };
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
  'tapping a coloured review key then navigating away before 1.85 seconds must restore persistent wrong/correct feedback on return',
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
    assert.ok(render.text.includes(phase === 'feedback' ? '结合谱面与键盘复盘' : '先听题，再在五线谱上作答'), `${mode}/${phase}: missing playback instruction`);
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
const firstTouchArea = harness.render().nodes.find((node) => node.props.accessibilityLabel === '五线谱答题区域');
const tap = { nativeEvent: { locationX: 166, locationY: 78 * 122 / 96 } };
firstTouchArea.props.onResponderGrant(tap);
firstTouchArea.props.onResponderRelease(tap);
assert.deepEqual(staffs(harness.render())[0].props.pitches.filter(Number.isFinite), [60], 'tapping an empty padded connection group must write its first note');
for (const y of [68, 58]) {
  const area = harness.render().nodes.find((node) => node.props.accessibilityLabel === '五线谱答题区域');
  const event = { nativeEvent: { locationX: 250, locationY: y * 122 / 96 } };
  area.props.onResponderGrant(event);
  area.props.onResponderRelease(event);
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

// Hand-checked line/space fixtures guard shared geometry before any changes to it.
const coordinates = harness.load('./src/core/staff-coordinate.ts');
for (const [midi, y] of [[60, 78], [64, 68], [65, 63], [71, 48], [77, 28], [81, 18]]) {
  assert.equal(coordinates.staffSvgYFromWrittenMidi(midi), y);
  for (const height of [96, 122]) assert.equal(coordinates.naturalMidiFromStaffTapY(y * height / 96, height), midi);
}

// Timed tests exercise real editor handlers and inspect the emitted SVG. Removing
// prerequisite guards or merging adjacent beat runs must fail these fixtures.
const timedFailures = [];
function timedCheck(name, run) {
  try { run(); } catch (error) { timedFailures.push(`${name}: ${error.message}`); }
}
const timedHarness = pitchHarness();
const { TimedAnswerStaff, NotationStaff } = timedHarness.load('./src/components/notation-editor.tsx');
for (const [meter, duration, count, primaryCount] of [
  ['2/4', 0.5, 4, 2], ['4/4', 0.5, 8, 4], ['3/8', 0.5, 3, 0],
  ['3/8', 0.25, 6, 3], ['6/8', 0.5, 6, 2], ['4/4', 1 / 3, 12, 4],
]) {
  for (const continuation of [false, true]) timedCheck(`${meter}/${duration}/${continuation ? 'continuation' : 'first'} beams`, () => {
    const barOffset = continuation ? 2 : 0;
    const events = Array.from({ length: count * 2 }, (_, index) => ({ midi: 69, duration, barIndex: barOffset + Math.floor(index / count) }));
    const render = timedHarness.renderComponent(TimedAnswerStaff, { events, meter: continuation ? '' : meter, capacityMeter: meter, keySignature: '', barOffset, barCount: 2, isFinalSystem: true, disabled: true, emptyText: '' });
    const primary = render.nodes.filter((node) => node.type === 'Line' && /^beam-\d+$/.test(node.key));
    assert.equal(primary.length, primaryCount * 2, 'beams must stop at each beat and barline');
    assert.equal(render.nodes.filter((node) => node.type === 'SvgText' && node.props.children === '3' && node.props.fontSize === '9').length, duration === 1 / 3 ? 8 : 0, 'each triplet beat needs its own numeral');
    if (continuation) assert.ok(!render.nodes.some((node) => node.type === 'SvgText' && node.props.fontSize === '17'), 'continuation hides only the meter label');
  });
}

timedCheck('rests and secondary beams', () => {
  const events = [0.5, -0.5, 0.5, 0.5, ...Array(8).fill(0.25)].map((duration, index) => ({ midi: 69, duration, rest: duration < 0, barIndex: index < 4 ? 0 : 1 }));
  const render = timedHarness.renderComponent(TimedAnswerStaff, { events, meter: '2/4', capacityMeter: '2/4', keySignature: '', barOffset: 0, barCount: 2, isFinalSystem: true, disabled: true, emptyText: '' });
  assert.equal(render.nodes.filter((node) => node.type === 'Line' && /^beam-\d+$/.test(node.key)).length, 3, 'rests break runs and do not shift subsequent beat groups');
  assert.equal(render.nodes.filter((node) => node.type === 'Line' && /^beam-2-\d+$/.test(node.key)).length, 2, 'secondary beams stop with their primary beat groups');
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
const childText = (node) => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(childText).join('')
  : typeof node === 'object' ? childText(node.props?.children) : String(node);
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
  const render = pianoHarness.renderComponent(PianoKeyboard, { compact, onKeyPress: () => {} });
  const keys = render.nodes.filter((node) => node.type === 'Pressable');
  const styles = keys.map((node) => flattenStyle(node.props.style({ pressed: false })));
  const whites = styles.filter((style) => style.flex === 1);
  const blacks = styles.filter((style) => style.position === 'absolute');
  assert.equal(whites.length, 16, 'all 16 white keys must remain in one visible row');
  assert.equal(blacks.length, 11);
  assert.ok(whites.every((style) => !style.minWidth), 'dense piano keys must retain flexible widths');
  assert.ok(blacks.every((style) => parseFloat(style.left) >= 0 && parseFloat(style.left) + parseFloat(style.width) <= 100), 'black keys must fit inside the keybed');
  const keyboardStyle = render.nodes.map((node) => flattenStyle(node.props.style)).find((style) => style.height && style.padding === 3);
  const keybedHeight = keyboardStyle.height - keyboardStyle.padding * 2;
  const blackHeight = keybedHeight * parseFloat(blacks[0].height) / 100;
  assert.ok(blackHeight >= 44 && keybedHeight - blackHeight - 2 * whites[0].borderWidth >= 44, 'black and exposed white key hit depths must remain at least 44 pt');
}

console.log(`practice parity contract passed (${files.length} source files, ${pitchCases.length} pitch workflows, 12 beam fixtures and 2 timed workflows checked)`);

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
    assert.equal(volume, 0.78);
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
})().catch((error) => { console.error(error); process.exitCode = 1; });
