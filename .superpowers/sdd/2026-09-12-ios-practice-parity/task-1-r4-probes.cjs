const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const smoke = fs.readFileSync(path.join(root, 'scripts/practice-parity-smoke.cjs'), 'utf8');
const check = new Function('assert', 'ts', smoke.slice(smoke.indexOf('const childrenOf ='), smoke.indexOf('\nassertPracticeStateAndVolume(practice);')) + '\nreturn assertPracticeStateAndVolume;')(assert, ts);
const valid = `
import { View, Text, Pressable } from 'react-native';
const styles = { card: {}, volumeRow: {}, volumeTrack: {}, volumeFill: {} };
export default function PracticeScreen() {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState({});
  const [phase, setPhase] = useState('ready');
  const [correct, setCorrect] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [highlights, setHighlights] = useState({});
  const [volume, setVolume] = useState(78);
  const questionSnapshots = [];
  function capture() { questionSnapshots[index] = { answer, phase, correct, playCount, highlights }; }
  function restorePracticeSnapshot(targetIndex) {
    const snapshot = questionSnapshots[targetIndex];
    if (!snapshot) return;
    setAnswer(snapshot.answer);
    setPhase(snapshot.phase);
    setCorrect(snapshot.correct);
    setPlayCount(snapshot.playCount);
    setHighlights(snapshot.highlights);
    setIndex(targetIndex);
  }
  function previous() { restorePracticeSnapshot(index - 1); }
  function changeVolume(next) { setVolume(next); }
  function play() {}
  const volumeRow = <View style={styles.volumeRow}>
    <Text>音量</Text>
    <Pressable onPress={() => changeVolume(volume - 10)}><Text>-</Text></Pressable>
    <View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: \`\${volume}%\` }]} /></View>
    <Pressable onPress={() => changeVolume(volume + 10)}><Text>+</Text></Pressable>
    <Text>{volume}%</Text>
  </View>;
  return <View>{phase === 'finished' ? <Text>Done</Text> : <View style={styles.card}>
    <Pressable onPress={() => void play()}><Text>Play</Text></Pressable>
    {volumeRow}
    <Pressable onPress={previous}><Text>上一题</Text></Pressable>
  </View>}</View>;
}
`;
const positives = [
  valid,
  valid.replaceAll('questionSnapshots[', 'questionSnapshots.current[').replace('const questionSnapshots = [];', 'const questionSnapshots = useRef([]);'),
  valid.replace('questionSnapshots[index] = { answer, phase, correct, playCount, highlights };', 'const saved = { answer, phase, correct, playCount, highlights }; questionSnapshots[index] = saved;'),
  valid.replaceAll('snapshot', 'savedQuestion'),
  valid.replace('setIndex(targetIndex);', '').replace('restorePracticeSnapshot(index - 1);', 'restorePracticeSnapshot(index - 1); setIndex(index - 1);'),
];
const parsed = (source) => {
  assert.equal(ts.createSourceFile('probe.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length, 0, 'probes must be syntactically valid TSX');
  return source;
};
positives.forEach((source) => check(parsed(source)));
const rowDeclaration = valid.slice(valid.indexOf('  const volumeRow ='), valid.indexOf('  return <View>'));
const mutations = [
  ['unassigned snapshot', 'questionSnapshots[index] = { answer, phase, correct, playCount, highlights };', 'const unused = { answer: questionSnapshots[index], phase, correct, playCount, highlights };'],
  ['wrong capture collection', 'questionSnapshots[index] =', 'otherSnapshots[index] ='],
  ['wrong capture index', 'questionSnapshots[index] =', 'questionSnapshots[index + 1] ='],
  ['mismatched ref access', 'questionSnapshots[index] =', 'questionSnapshots.current[index] ='],
  ['missing index update', 'setIndex(targetIndex);', ''],
  ['wrong index update', 'setIndex(targetIndex);', 'setIndex(targetIndex + 1);'],
  ['wrong previous index', 'restorePracticeSnapshot(index - 1);', 'restorePracticeSnapshot(index + 1);'],
  ['shadowed restore state setter', 'setAnswer(snapshot.answer);', 'const setAnswer = () => {}; setAnswer(snapshot.answer);'],
  ['wrong snapshot binding', 'setAnswer(snapshot.answer);', 'const other = {}; setAnswer(other.answer);'],
  ['conditional initializer', 'const volumeRow = <View', 'const volumeRow = hidden ? null : <View'],
  ['logical initializer', 'const volumeRow = <View', 'const volumeRow = hidden || <View'],
  ['fake view', rowDeclaration, rowDeclaration.replace('<View style={styles.volumeRow}>', '<FakeView style={styles.volumeRow}>').replace('  </View>;', '  </FakeView>;')],
  ['outside lexical scope', rowDeclaration, `function unused() { ${rowDeclaration} }`],
  ['missing decrease control', 'onPress={() => changeVolume(volume - 10)}', 'title="changeVolume(volume - 10)"'],
  ['shadowed handler', '() => changeVolume(volume - 10)', '() => { function changeVolume() {} changeVolume(volume - 10); }'],
  ['shadowed volume', '() => changeVolume(volume - 10)', '(volume) => changeVolume(volume - 10)'],
  ['shadowed View', 'function play() {}', 'function play() {} function View() {}'],
  ['conditional insertion', '{volumeRow}', '{hidden ? null : volumeRow}'],
  ['and insertion', '{volumeRow}', '{hidden && volumeRow}'],
  ['or insertion', '{volumeRow}', '{hidden || volumeRow}'],
  ['nullish insertion', '{volumeRow}', '{hidden ?? volumeRow}'],
  ['duplicate insertion', '{volumeRow}', '{volumeRow}{volumeRow}'],
  ['wrong card', '<View style={styles.card}>', '<View>'],
  ['previous button disconnected', 'onPress={previous}', 'onPress={play}'],
  ['shadowed insertion', '{volumeRow}', '{(() => { const volumeRow = null; return volumeRow; })()}'],
];
for (const field of ['answer', 'phase', 'correct', 'playCount', 'highlights']) {
  mutations.push([`wrong ${field} mapping`, `snapshot.${field}`, `snapshot.${field === 'answer' ? 'phase' : 'answer'}`]);
}
mutations.forEach(([name, before, after]) => {
  assert.ok(valid.includes(before), `probe missing its target: ${name}`);
  const mutated = parsed(valid.replace(before, after));
  assert.throws(() => check(mutated), assert.AssertionError, name);
});
console.log(`practice parity AST probes passed (${positives.length} valid fixtures, ${mutations.length} rejected mutations)`);
