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
  assert.ok(!callsIn(previous).some((node) => same(node.expression, namedFunction('resetQuestionState')?.name)), 'previous must not reset the restored snapshot');
  const restoreCall = directCalls(previous).find((node) => previousIndex(node.arguments[0])
    && symbol(node.expression)?.valueDeclaration && ts.isFunctionDeclaration(symbol(node.expression).valueDeclaration));
  assert.ok(restoreCall, 'previous must call a restore helper with the current index - 1');
  const restore = symbol(restoreCall.expression).valueDeclaration;
  const target = restore.parameters[0]?.name;
  const snapshot = restore.body.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations])
    .find((node) => node.initializer && ts.isElementAccessExpression(node.initializer)
      && collection(node.initializer.expression) && same(node.initializer.argumentExpression, target));
  assert.ok(snapshot, 'restore helper must bind the snapshot from questionSnapshots at the target index');
  for (const [field, setter] of Object.entries({ answer: 'setAnswer', phase: 'setPhase', correct: 'setCorrect', playCount: 'setPlayCount', highlights: 'setHighlights' })) {
    assert.ok(directCalls(restore).some((node) => same(node.expression, binding(setter)) && node.arguments.length === 1
      && ts.isPropertyAccessExpression(node.arguments[0]) && same(node.arguments[0].expression, snapshot.name)
      && node.arguments[0].name.text === field), `restore helper must call ${setter}(snapshot.${field})`);
  }
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
  assert.ok(card.children.slice(0, card.children.indexOf(insertion)).some((node) => isNative(node, 'Pressable')
    && pressCalls(node).some((call) => same(call.expression, namedFunction('play')?.name))), 'volumeRow must follow the play control in the practice card');
}

assertPracticeStateAndVolume(practice);
assert.match(practice, /<PianoKeyboard\b[^>]*\bvolume=\{volume\}[^>]*>/, 'PianoKeyboard must receive stored volume');

const timedStaffTags = notation.match(/<TimedAnswerStaff\b[\s\S]*?\/>/g) || [];
assert.ok(timedStaffTags.length >= 3, 'all timed staff render paths must be present');
timedStaffTags.forEach((tag, index) => {
  assert.match(tag, /capacityMeter=\{(?:meter|answer\.meter|String\(question\.meter \|\| ''\))\}/, `timed staff ${index + 1} must receive a layout meter`);
  assert.match(tag, /meter=\{systemIndex === 0 \? (?:meter|answer\.meter|String\(question\.meter \|\| ''\)) : ''\}/, `timed staff ${index + 1} must hide display meter only on continuation systems`);
});

console.log(`practice parity contract passed (${files.length} source files checked)`);
