const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const questionCore = require('../src/core/legacy/question.js');
const pcm = require('../src/core/legacy/pcm-renderer.js');

const projectRoot = path.resolve(__dirname, '..');
const sampleDir = path.join(projectRoot, 'assets', 'audio', 'piano');
const noteNames = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];

function sampleName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `${noteNames[midi % 12]}${octave}.wav`;
}

function loadBank() {
  const bank = {};
  for (let midi = 55; midi <= 81; midi += 1) {
    const file = path.join(sampleDir, sampleName(midi));
    if (!fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    bank[midi] = pcm.parsePcm16Wav(arrayBuffer);
  }
  return bank;
}

function questionKey(question) {
  const midis = [...(question.midis || [])];
  if (question.harmonic || question.type === 'chord') midis.sort((a, b) => a - b);
  return JSON.stringify({
    type: question.type,
    harmonic: Boolean(question.harmonic),
    midis,
    durs: question.durs || [],
    beats: question.beats || [],
    meter: question.meter || ''
  });
}

const bank = loadBank();
assert.ok(Object.keys(bank).length >= 22, '钢琴采样未完整载入');

for (const type of ['single', 'interval', 'chord', 'rhythm', 'melody']) {
  const set = questionCore.generateSet(type, 10);
  assert.equal(set.length, 10, `${type} 未生成 10 道题`);
  assert.equal(new Set(set.map(questionKey)).size, 10, `${type} 专项题出现重复`);

  for (const question of set) {
    assert.equal(question.type, type, `${type} 返回了错误题型`);
    assert.ok(question.answerText, `${type} 缺少答案文本`);
    if (type === 'melody') {
      assert.equal(question.phraseCount, 4, '旋律题不是四句式');
      assert.equal(question.phrases.length, 4, '旋律题缺少四个乐句规划');
      assert.equal(question.phrases[3].endBar, question.barCount, '第四句没有收束到最后一小节');
      assert.equal(question.phrases[3].cadenceDegree, 0, '第四句没有终止在主音');
      let cursor = 0;
      const barEvents = question.bars.map((bar) => bar.map(() => ({
        midi: question.midis[cursor], duration: question.durs[cursor++]
      })));
      assert.equal(barEvents.length, 8, '2025 旋律题库原题必须保留完整 8 小节');
      assert.equal(cursor, question.durs.length, '旋律小节与扁平时值序列没有完整对应');
      assert.ok(question.sourcePaper > 0, '旋律题缺少原题来源编号');
      barEvents.flat().filter((event) => event.duration > 0).forEach((event) => {
        assert.ok(event.midi >= 55 && event.midi <= 81, `旋律音高超出采样范围：${event.midi}`);
      });
    }
  }

  const rendered = pcm.renderQuestionWav(set[0], bank);
  assert.ok(rendered.duration > 0, `${type} 音频时长无效`);
  assert.equal(Buffer.from(rendered.arrayBuffer).subarray(0, 4).toString('ascii'), 'RIFF');
}

let difficultChordCount = 0;
let invertedChordCount = 0;
const chordSampleCount = 1000;
for (let index = 0; index < chordSampleCount; index += 1) {
  const chord = questionCore.generate('chord');
  if (chord.knowledgeKey.includes(':dim:') || chord.knowledgeKey.includes(':aug:')) difficultChordCount += 1;
  if (chord.inversion > 0) invertedChordCount += 1;
  const mainNotes = pcm
    .buildQuestionTimeline(chord)
    .events.filter((event) => event.type === 'note' && event.start > 1);
  assert.equal(mainNotes.length, 3, '和弦题必须包含三个主和弦音');
  assert.equal(new Set(mainNotes.map((event) => event.start)).size, 1, '和弦音没有同时起音');
}
assert.ok(difficultChordCount / chordSampleCount < 0.3, '专项训练中的增减和弦比例过高');
assert.ok(difficultChordCount / chordSampleCount > 0.08, '专项训练完全丢失了增减和弦考点');
assert.ok(invertedChordCount / chordSampleCount < 0.42, '专项训练中的转位和弦比例过高');
assert.ok(invertedChordCount / chordSampleCount > 0.15, '专项训练完全丢失了转位和弦考点');

const adaptive = questionCore.generateSet('adaptive', 10);
assert.equal(adaptive.length, 10, '智能强化未生成 10 道题');
assert.ok(new Set(adaptive.map((question) => question.type)).size >= 5, '智能强化未覆盖所有基础题型');

console.log('核心冒烟测试通过：题目去重、和弦同时起音与难度比例、四句式旋律和音频渲染均正常。');
