// 验证所有题型在 tier1/2/3 下产出的 MIDI 均落在离线采样库范围 [55, 81]（G3-A5），
// 且用真实采样 bank 渲染整题音频不抛「缺少 MIDI xx 定音采样」。
const q = require('../src/core/legacy/question.js');
const pcm = require('../src/core/legacy/pcm-renderer.js');
const fs = require('fs');
const path = require('path');

const NOTE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const dir = path.join(__dirname, '..', 'assets', 'audio', 'piano');
const bank = {};

function goertzelPower(samples, sampleRate, frequency) {
  const coefficient = 2 * Math.cos(2 * Math.PI * frequency / sampleRate);
  let previous = 0;
  let previous2 = 0;
  for (const sample of samples) {
    const current = sample + coefficient * previous - previous2;
    previous2 = previous;
    previous = current;
  }
  return previous2 * previous2 + previous * previous - coefficient * previous * previous2;
}

function verifySamplePitch(sample, midi, file) {
  const start = Math.round(sample.sampleRate * 0.05);
  const length = Math.min(sample.samples.length - start, Math.round(sample.sampleRate * 1.45));
  const windowed = new Float64Array(length);
  for (let index = 0; index < length; index++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / Math.max(1, length - 1));
    windowed[index] = sample.samples[start + index] * window;
  }
  const expected = 440 * 2 ** ((midi - 69) / 12);
  const step = Math.max(0.25, expected / 1000);
  let strongestFrequency = expected;
  let strongestPower = 0;
  for (let frequency = expected * 0.98; frequency <= expected * 1.02; frequency += step) {
    const power = goertzelPower(windowed, sample.sampleRate, frequency);
    if (power > strongestPower) {
      strongestPower = power;
      strongestFrequency = frequency;
    }
  }
  const cents = 1200 * Math.log2(strongestFrequency / expected);
  const nearbyNoise = [0.91, 0.94, 0.96, 1.04, 1.06, 1.09]
    .map((ratio) => goertzelPower(windowed, sample.sampleRate, expected * ratio));
  const noiseFloor = nearbyNoise.reduce((sum, value) => sum + value, 0) / nearbyNoise.length;
  if (Math.abs(cents) > 18 || strongestPower < noiseFloor * 8) {
    console.error(`采样音高异常 ${path.basename(file)}: 目标 MIDI ${midi}，偏差 ${cents.toFixed(1)} cents`);
    return false;
  }
  return true;
}

for (let m = 55; m <= 81; m++) {
  const file = path.join(dir, `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}.wav`);
  if (!fs.existsSync(file)) { console.error('缺采样文件:', file); process.exit(1); }
  const b = fs.readFileSync(file);
  bank[m] = pcm.parsePcm16Wav(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  if (!verifySamplePitch(bank[m], m, file)) process.exit(1);
}

function midisOf(question) {
  if (!question) return [];
  if (question.type === 'intervalConnection') return question.chords.flat();
  if (question.type === 'melody') {
    // 只检查发声音（durs>0），休止位是占位 midi 不发声、不查采样库。
    return (question.midis || []).filter((_, i) => (question.durs ? question.durs[i] : 1) > 0);
  }
  if (Array.isArray(question.midis)) return question.midis;
  return [];
}

const cases = {
  single: (tier) => [{ key: 'single', count: 5, tier }],
  group: (tier) => [{ key: 'group', count: 5, tier, groupSizes: [3, 4, 5] }],
  interval: (tier) => [{ key: 'interval', count: 10, tier }],
  chord: (tier) => [{ key: 'chord', count: 5, tier }],
  connection: (tier) => [{ key: 'connection', count: 1, intervalCount: 5, tier }],
  melody: (tier) => [{ key: 'melody', count: 5, bars: 8, tier }],
};

let fail = 0;
for (const [type, makeSections] of Object.entries(cases)) {
  for (const tier of [1, 2, 3]) {
    let minMidi = 999, maxMidi = 0, totalNotes = 0, renderFail = 0;
    const rounds = type === 'connection' ? 200 : 60;
    for (let i = 0; i < rounds; i++) {
      const r = q.generateExamFromSections(makeSections(tier));
      const questions = type === 'connection' ? [r.connectionQuestion]
        : type === 'single' ? r.singles
        : type === 'group' ? r.groups
        : type === 'interval' ? r.intervals
        : type === 'chord' ? r.chords
        : r.melodyQuestions;
      for (const question of questions) {
        for (const m of midisOf(question)) {
          if (m < 55 || m > 81) { console.error(`越界 ${type} tier${tier}: MIDI ${m}`); fail++; }
          minMidi = Math.min(minMidi, m);
          maxMidi = Math.max(maxMidi, m);
          totalNotes++;
        }
        try {
          pcm.renderQuestionWav(question, bank);
        } catch (e) {
          console.error(`渲染失败 ${type} tier${tier}:`, e.message);
          fail++; renderFail++;
        }
      }
    }
    console.log(`${type.padEnd(10)} tier${tier}: midi [${minMidi},${maxMidi}] 发声音数${totalNotes} 渲染失败${renderFail}`);
  }
}
console.log(fail === 0
  ? '\n✅ 全部通过：27 个钢琴采样的基频与 MIDI 相符；所有题型所有档 MIDI 均落在 [55,81]（G3-A5），音频渲染无缺采样'
  : `\n❌ 共 ${fail} 处失败`);
process.exit(fail === 0 ? 0 : 1);
