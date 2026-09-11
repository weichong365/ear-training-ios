// 验证所有题型在 tier1/2/3 下产出的 MIDI 均落在离线采样库范围 [55, 81]（G3-A5），
// 且用真实采样 bank 渲染整题音频不抛「缺少 MIDI xx 定音采样」。
const q = require('../src/core/legacy/question.js');
const pcm = require('../src/core/legacy/pcm-renderer.js');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');

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
  // Refine the local fundamental peak; a coarse FFT/bin grid cannot resolve 0.5 cents.
  // Searching this band avoids selecting a louder second or third piano harmonic.
  let left = strongestFrequency - step;
  let right = strongestFrequency + step;
  for (let iteration = 0; iteration < 32; iteration++) {
    const a = left + (right - left) / 3;
    const b = right - (right - left) / 3;
    if (goertzelPower(windowed, sample.sampleRate, a) < goertzelPower(windowed, sample.sampleRate, b)) left = a;
    else right = b;
  }
  strongestFrequency = (left + right) / 2;
  strongestPower = goertzelPower(windowed, sample.sampleRate, strongestFrequency);
  const cents = 1200 * Math.log2(strongestFrequency / expected);
  const nearbyNoise = [0.91, 0.94, 0.96, 1.04, 1.06, 1.09]
    .map((ratio) => goertzelPower(windowed, sample.sampleRate, expected * ratio));
  const noiseFloor = nearbyNoise.reduce((sum, value) => sum + value, 0) / nearbyNoise.length;
  assert.ok(strongestPower > 0 && strongestPower > noiseFloor * 8,
    `${path.basename(file)}: MIDI ${midi} fundamental not distinguishable from noise`);
  assert.ok(Math.abs(cents) <= 0.5,
    `${path.basename(file)}: MIDI ${midi} tuning ${cents.toFixed(3)} cents exceeds ±0.5 cents`);
  return cents;
}

// A stronger second/third harmonic must not hide a two-cent fundamental error.
function syntheticPiano(midi, cents = 0, fadeSeconds = 0.08) {
  const sampleRate = 16000;
  const frequency = 440 * 2 ** ((midi - 69) / 12 + cents / 1200);
  const samples = Int16Array.from({ length: sampleRate * 1.85 }, (_, index) => {
    const time = index / sampleRate;
    const phase = 2 * Math.PI * frequency * time;
    const fade = fadeSeconds ? Math.min(1, (1.85 - time) / fadeSeconds) : 1;
    return Math.round(20000 * Math.exp(-time) * fade
      * (0.08 * Math.sin(phase) + 0.5 * Math.sin(2 * phase + 0.3) + 0.25 * Math.sin(3 * phase + 0.7)));
  });
  return { sampleRate, samples };
}

for (let midi = 55; midi <= 81; midi++) {
  assert.ok(Math.abs(verifySamplePitch(syntheticPiano(midi), midi, 'synthetic in tune')) < 0.05);
  for (const cents of [-2, 2]) {
    assert.throws(() => verifySamplePitch(syntheticPiano(midi, cents), midi, `synthetic ${cents} cents`),
      /tuning .* exceeds ±0.5 cents/, 'pitch detector must reject a deliberately detuned piano fixture');
  }
}
console.log('Pitch detector self-check passed: 27 harmonic-rich tuned fixtures accepted; 54 detuned fixtures rejected.');

const assetSourcePath = path.join(__dirname, '../src/services/note-assets.ts');
// Execute the real mapping; replace only Metro's WAV loading with resolved file paths.
const mappedPaths = [];
const assets = vm.runInNewContext(`${stripTypeScriptTypes(fs.readFileSync(assetSourcePath, 'utf8')).replace(/^export /gm, '')}\n;({ NOTE_ASSETS, PIANO_NOTE_ASSETS });`, {
  require(relativePath) {
    const file = path.resolve(path.dirname(assetSourcePath), relativePath);
    mappedPaths.push(file);
    return file;
  },
});
assert.equal(Object.keys(assets.NOTE_ASSETS).length, 27, 'exactly 27 MIDI mappings required');
assert.equal(mappedPaths.length, 27, 'each MIDI must require exactly one WAV');
assert.equal(new Set(mappedPaths).size, 27, 'MIDI mappings must use distinct WAVs');
assert.equal(fs.readdirSync(dir).filter((file) => /\.wav$/i.test(file)).length, 27, 'exactly 27 piano WAVs required');

function rms(samples) {
  return Math.sqrt(samples.reduce((sum, value) => sum + (value / 32768) ** 2, 0) / samples.length);
}

function verifySampleQuality(sample, file) {
  const { samples, sampleRate } = sample;
  const duration = samples.length / sampleRate;
  const checks = [
    [Math.abs(duration - 1.85) <= 0.01 + Number.EPSILON, `duration ${duration.toFixed(5)}s; expected 1.85 ±0.01s`],
    [samples.every(Number.isFinite), 'PCM contains non-finite values'],
    [Math.abs(samples.reduce((sum, value) => sum + value / 32768, 0) / samples.length) <= 0.005, 'DC offset exceeds 0.5% full scale'],
    [samples.every((value) => value > -32768 && value < 32767), 'PCM clips at full scale'],
  ];
  const tail = samples.slice(-Math.round(sampleRate * 0.08));
  const quarter = Math.round(sampleRate * 0.02);
  const firstRms = rms(tail.slice(0, quarter));
  const finalRms = rms(tail.slice(-quarter));
  // Compare 20 ms RMS blocks rather than individual oscillating piano samples.
  // A tail already below -60 dBFS is silent; otherwise require at least 12 dB decay.
  checks.push([finalRms <= Math.max(0.001, firstRms * 0.25),
    `final 80ms fade: last 20ms RMS ${finalRms.toFixed(6)}, first 20ms ${firstRms.toFixed(6)}`]);
  checks.push([Math.abs(samples.at(-1)) <= 2 && Math.abs(samples.at(-1) - samples.at(-2)) <= 2,
    `abrupt terminal step: final PCM values ${samples.at(-2)}, ${samples.at(-1)} (limit 2 LSB)`]);
  const peak = samples.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  const envelopeWindow = Math.round(sampleRate * 0.01);
  // Anchor overlapping RMS windows to sustained silence, not a quiet waveform phase.
  // A smooth descent loses energy in its final 10ms relative to the final 20ms.
  let silenceStart = samples.length;
  while (silenceStart > samples.length - tail.length && Math.abs(samples[silenceStart - 1]) <= 2) silenceStart--;
  if (silenceStart < samples.length) {
    const near = rms(samples.slice(silenceStart - envelopeWindow, silenceStart)) * 32768;
    const wide = rms(samples.slice(silenceStart - 2 * envelopeWindow, silenceStart)) * 32768;
    const step = Math.abs(samples[silenceStart - 1] - samples[silenceStart]);
    // Also preserve a significant discontinuity during an otherwise smooth fade.
    const collapsed = near > Math.max(2, peak * 0.001) && near > wide * 0.7;
    checks.push([!collapsed && step <= Math.max(4, peak * 0.0015),
      `abrupt tail transition at ${(silenceStart / sampleRate).toFixed(5)}s: last 10/20ms RMS ${near.toFixed(1)}/${wide.toFixed(1)} LSB, step ${step} LSB`]);
  }
  return checks.filter(([passed]) => !passed).map(([, message]) => `${path.basename(file)}: ${message}`);
}

const qualityFixture = syntheticPiano(69);
assert.deepEqual(verifySampleQuality(qualityFixture, 'synthetic clean'), []);
const unfadedFixture = { ...qualityFixture, samples: qualityFixture.samples.slice() };
unfadedFixture.samples.fill(655, -1280);
assert.ok(verifySampleQuality(unfadedFixture, 'synthetic no fade').some((error) => error.includes('final 80ms fade')));
const abruptFixture = { ...qualityFixture, samples: qualityFixture.samples.slice() };
abruptFixture.samples[abruptFixture.samples.length - 1] = 100;
assert.ok(verifySampleQuality(abruptFixture, 'synthetic abrupt end').some((error) => error.includes('abrupt terminal step')));
const paddedCutoffFixture = syntheticPiano(69, 0, 0);
paddedCutoffFixture.samples.fill(0, -320);
assert.equal(Math.abs(paddedCutoffFixture.samples.at(-321)), 647, 'reproduce the reported 647-LSB cutoff');
assert.ok(verifySampleQuality(paddedCutoffFixture, 'synthetic padded cutoff').some((error) => error.includes('abrupt tail transition')),
  'an abrupt cutoff followed by 20ms silence must not pass the fade contract');
paddedCutoffFixture.samples[paddedCutoffFixture.samples.length - 321] = 3000;
assert.ok(verifySampleQuality(paddedCutoffFixture, 'synthetic 3000-LSB cutoff').some((error) => error.includes('abrupt tail transition')));
const phaseCutoffFixture = syntheticPiano(55, 0, 0);
phaseCutoffFixture.samples.fill(0, 28689);
assert.equal(Math.abs(phaseCutoffFixture.samples[28688]), 335, 'reproduce the reported phase-offset cutoff');
assert.ok(verifySampleQuality(phaseCutoffFixture, 'synthetic phase-offset cutoff').some((error) => error.includes('abrupt tail transition')),
  'a sudden energy drop must fail even when the last waveform sample is below 25% of local RMS');
const ongoingFadeCutoff = syntheticPiano(55);
ongoingFadeCutoff.samples.fill(0, 29321);
assert.equal(ongoingFadeCutoff.samples[29320], 178);
const shortSineFade = syntheticPiano(59, 0, 0);
for (let index = 28960; index < shortSineFade.samples.length; index++) {
  shortSineFade.samples[index] = Math.round(shortSineFade.samples[index]
    * Math.sin(Math.max(0, (29280 - index) / 320) * Math.PI / 2));
}
assert.deepEqual({
  ongoingFadeCutoffRejected: verifySampleQuality(ongoingFadeCutoff, 'ongoing fade cutoff').some((error) => error.includes('abrupt tail transition')),
  shortSineFadeErrors: verifySampleQuality(shortSineFade, 'short sine fade'),
}, { ongoingFadeCutoffRejected: true, shortSineFadeErrors: [] }, 'reject a cut during fading while accepting a smooth 20ms sine fade');
for (let midi = 55; midi <= 81; midi++) {
  for (const fadeMs of [20, 60]) {
    for (const curve of [(remaining) => remaining ** 2, (remaining) => remaining, (remaining) => Math.sin(remaining * Math.PI / 2)]) {
      const smoothFixture = syntheticPiano(midi, 0, 0);
      const cutoff = smoothFixture.samples.length - 320;
      const fadeFrames = fadeMs * smoothFixture.sampleRate / 1000;
      for (let index = cutoff - fadeFrames; index < smoothFixture.samples.length; index++) {
        smoothFixture.samples[index] = Math.round(smoothFixture.samples[index] * curve(Math.max(0, (cutoff - index) / fadeFrames)));
      }
      assert.deepEqual(verifySampleQuality(smoothFixture, `synthetic smooth MIDI ${midi}`), []);
    }
  }
  const quietFixture = syntheticPiano(midi, 0, 0);
  for (let index = 24000; index < quietFixture.samples.length; index++) {
    quietFixture.samples[index] = Math.round(quietFixture.samples[index] * Math.exp(-50 * (index / quietFixture.sampleRate - 1.5)));
  }
  assert.deepEqual(verifySampleQuality(quietFixture, `synthetic quiet MIDI ${midi}`), []);
}
for (const midi of [55, 69, 81]) {
  for (const fading of [false, true]) {
    for (let phase = 0; phase < 16; phase++) {
      const fixture = syntheticPiano(midi, 0, fading ? 0.08 : 0);
      const period = fixture.sampleRate / (440 * 2 ** ((midi - 69) / 12));
      fixture.samples.fill(0, (fading ? 29321 : 28689) + Math.round(phase * period / 16));
      assert.ok(verifySampleQuality(fixture, `synthetic phase ${phase} MIDI ${midi}`).some((error) => error.includes('abrupt tail transition')));
    }
  }
}
console.log('Fade self-check passed: 162 smooth fades and 27 quiet tails accepted; 96 phased/fading cutoffs, reported 178/335/647/3000-LSB cutoffs, missing fade and abrupt endpoint rejected.');

const qualityFailures = [];

for (let m = 55; m <= 81; m++) {
  const file = path.join(dir, `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}.wav`);
  assert.equal(assets.NOTE_ASSETS[m], file, `MIDI ${m} must map to its own WAV`);
  assert.equal(assets.PIANO_NOTE_ASSETS[m], file, `review MIDI ${m} must use the same WAV`);
  if (!fs.existsSync(file)) { console.error('缺采样文件:', file); process.exit(1); }
  const b = fs.readFileSync(file);
  assert.equal(b.readUInt32LE(4) + 8, b.length, `${path.basename(file)}: RIFF size mismatch`);
  bank[m] = pcm.parsePcm16Wav(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  qualityFailures.push(...verifySampleQuality(bank[m], file));
  try { verifySamplePitch(bank[m], m, file); }
  catch (error) { qualityFailures.push(error.message); }
}
if (qualityFailures.length) {
  console.error(qualityFailures.join('\n'));
  console.error(`Piano sample contract failed: ${qualityFailures.length} violations.`);
  process.exit(1);
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
const originalRandom = Math.random;
let seed = 246813579;
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
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
  ? '\n✅ 全部通过：27 个钢琴采样满足映射、时长、淡出及 ±0.5 cents 音准；所有题型所有档 MIDI 均落在 [55,81]（G3-A5），音频渲染无缺采样'
  : `\n❌ 共 ${fail} 处失败`);
Math.random = originalRandom;
process.exit(fail === 0 ? 0 : 1);
