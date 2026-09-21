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

// ⚠️ 合成器与包内采样同规格：44.1kHz / 4.00 秒（16kHz/1.82s 是旧版，已因"装不下 4 秒"被换掉）。
//
// 下面所有 fixture 的几何一律**按秒换算**，不要再写死帧号。旧版把 16kHz 的帧号硬编码了进来
// （320 帧 = 20ms、28960/29280 = 淡出区间、24000 帧 = 1.5s、28689/29321 = 切点），
// 换采样率后全部失真：320 帧在 44.1kHz 下只有 7.3ms；而
// `exp(-50 * (index / 44100 - 1.5))` 在 index=24000 时算出 exp(+47.8)，直接把 fixture 变成噪声。
// 下面的秒数逐一对应旧帧号，语义保持不变（旧帧号 → 秒 → 新帧号）：
//   320            → 0.020000 → 882      （20ms 静音 / 20ms 淡出）
//   911（总 29600 帧）→ 0.056938 → 2511     （原 28689，零交叉切点）
//   279（总 29600 帧）→ 0.017438 → 769      （原 29321，淡出中途切点）
//   24000          → 1.500000 → 66150    （静音尾巴的衰减起点）
const SAMPLE_RATE = 44100;
const SAMPLE_SECONDS = 4.0;
const TAIL_SECONDS = 0.08;                 // 与 verifySampleQuality 里的尾巴窗口一致
const CUT_SECONDS = 0.02;                  // 硬切之后的静音长度 / 平滑淡出长度
const PHASE_CUT_SECONDS = 0.056938;        // 距结尾，原版 28689
const FADE_CUT_SECONDS = 0.017438;         // 距结尾，原版 29321
const TAIL_FRAMES = Math.round(SAMPLE_RATE * TAIL_SECONDS);
const CUT_FRAMES = Math.round(SAMPLE_RATE * CUT_SECONDS);
const framesAt = (seconds) => Math.round(SAMPLE_RATE * seconds);

// A stronger second/third harmonic must not hide a two-cent fundamental error.
function syntheticPiano(midi, cents = 0, fadeSeconds = 0.08) {
  const frequency = 440 * 2 ** ((midi - 69) / 12 + cents / 1200);
  const samples = Int16Array.from({ length: framesAt(SAMPLE_SECONDS) }, (_, index) => {
    const time = index / SAMPLE_RATE;
    const phase = 2 * Math.PI * frequency * time;
    const fade = fadeSeconds ? Math.min(1, (SAMPLE_SECONDS - time) / fadeSeconds) : 1;
    return Math.round(20000 * Math.exp(-time) * fade
      * (0.08 * Math.sin(phase) + 0.5 * Math.sin(2 * phase + 0.3) + 0.25 * Math.sin(3 * phase + 0.7)));
  });
  return { sampleRate: SAMPLE_RATE, samples };
}

const peakOf = (samples) => samples.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
// verifySampleQuality 的台阶阈值。fixture 的切点残余必须与之拉开差距，
// 否则用例只是靠几 LSB 的余量通过，验证不了判据本身。
const stepLimitOf = (samples) => Math.max(4, peakOf(samples) * 0.0015);

// 在目标秒数附近挑切点帧：'high' 取 |样本| 最大（残余明显高于阈值，台阶判据也活着），
// 'low' 取 |样本| 最小（贴在零交叉上，只剩能量塌陷这一条路）。
function pickCut(samples, targetSeconds, spanSeconds, mode) {
  const center = Math.min(samples.length - 1, Math.max(1, framesAt(targetSeconds)));
  const span = Math.max(1, framesAt(spanSeconds));
  let best = center;
  for (let index = Math.max(1, center - span); index <= Math.min(samples.length - 1, center + span); index++) {
    const better = mode === 'low'
      ? Math.abs(samples[index]) < Math.abs(samples[best])
      : Math.abs(samples[index]) > Math.abs(samples[best]);
    if (better) best = index;
  }
  return best;
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
    [duration >= 3.99 && duration <= 4.01, `duration ${duration.toFixed(5)}s; expected 3.99~4.01s (包内 4.00s)`],
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
unfadedFixture.samples.fill(655, -TAIL_FRAMES);
assert.ok(verifySampleQuality(unfadedFixture, 'synthetic no fade').some((error) => error.includes('final 80ms fade')));
const abruptFixture = { ...qualityFixture, samples: qualityFixture.samples.slice() };
abruptFixture.samples[abruptFixture.samples.length - 1] = 100;
assert.ok(verifySampleQuality(abruptFixture, 'synthetic abrupt end').some((error) => error.includes('abrupt terminal step')));

// 硬切 + 20ms 静音：切点残余明显高于台阶阈值，两条判据（台阶 / 能量塌陷）都应成立。
// （原用例锚定的是真实文件里 647 LSB 的断口；那个数值由旧波形几何决定，换规格后必然改变，
//   所以这里改判"残余必须与阈值拉开倍数"，而不是钉死一个具体 LSB 值。）
const paddedCutoffFixture = syntheticPiano(69, 0, 0);
const paddedCut = pickCut(paddedCutoffFixture.samples, SAMPLE_SECONDS - CUT_SECONDS, 0.005, 'high');
paddedCutoffFixture.samples.fill(0, paddedCut);
assert.ok(paddedCutoffFixture.samples.length - paddedCut < TAIL_FRAMES,
  'padded cutoff fixture 的静音段必须整段落在 80ms 尾巴窗口内');
const paddedStep = Math.abs(paddedCutoffFixture.samples[paddedCut - 1]);
assert.ok(paddedStep > stepLimitOf(paddedCutoffFixture.samples) * 5,
  `padded cutoff fixture 的切点残余只有 ${paddedStep} LSB，不足以同时验证台阶判据`);
assert.ok(verifySampleQuality(paddedCutoffFixture, 'synthetic padded cutoff').some((error) => error.includes('abrupt tail transition')),
  'an abrupt cutoff followed by 20ms silence must not pass the fade contract');
paddedCutoffFixture.samples[paddedCut - 1] = 3000;
assert.ok(verifySampleQuality(paddedCutoffFixture, 'synthetic 3000-LSB cutoff').some((error) => error.includes('abrupt tail transition')));

// 切点落在零交叉上：末样本低于台阶阈值，"台阶"判据失灵，只剩能量塌陷能判——
// 这正是要证明判据互相独立的地方（原用例锚定 335 LSB，但 335 其实高于台阶阈值，
// 钉在零交叉上才真正兑现"末样本很小也要被判出来"这句话）。
const phaseCutoffFixture = syntheticPiano(55, 0, 0);
const phaseCut = pickCut(phaseCutoffFixture.samples, SAMPLE_SECONDS - PHASE_CUT_SECONDS, 0.005, 'low');
phaseCutoffFixture.samples.fill(0, phaseCut);
const phaseStep = Math.abs(phaseCutoffFixture.samples[phaseCut - 1]);
assert.ok(phaseStep <= stepLimitOf(phaseCutoffFixture.samples),
  `phase-offset fixture 的末样本 ${phaseStep} LSB 必须低于台阶阈值，才能验证能量塌陷这条独立判据`);
assert.ok(verifySampleQuality(phaseCutoffFixture, 'synthetic phase-offset cutoff').some((error) => error.includes('abrupt tail transition')),
  'a sudden energy drop must fail even when the last waveform sample is below 25% of local RMS');

// 切在 80ms 自然淡出的中途：淡出没走完就归零，同样必须被拒（原用例锚定 178 LSB）。
const ongoingFadeCutoff = syntheticPiano(55);
const ongoingCut = pickCut(ongoingFadeCutoff.samples, SAMPLE_SECONDS - FADE_CUT_SECONDS, 0.005, 'high');
ongoingFadeCutoff.samples.fill(0, ongoingCut);
const ongoingStep = Math.abs(ongoingFadeCutoff.samples[ongoingCut - 1]);
assert.ok(ongoingStep > stepLimitOf(ongoingFadeCutoff.samples),
  `ongoing fade cutoff fixture 的切点残余只有 ${ongoingStep} LSB，不足以触发台阶判据`);

// 平滑的 20ms 正弦淡出 + 静音：合法收尾，作为对照必须被接受。
const shortSineFade = syntheticPiano(59, 0, 0);
const sineFadeEnd = shortSineFade.samples.length - CUT_FRAMES;
for (let index = sineFadeEnd - CUT_FRAMES; index < shortSineFade.samples.length; index++) {
  shortSineFade.samples[index] = Math.round(shortSineFade.samples[index]
    * Math.sin(Math.max(0, (sineFadeEnd - index) / CUT_FRAMES) * Math.PI / 2));
}
assert.deepEqual({
  ongoingFadeCutoffRejected: verifySampleQuality(ongoingFadeCutoff, 'ongoing fade cutoff').some((error) => error.includes('abrupt tail transition')),
  shortSineFadeErrors: verifySampleQuality(shortSineFade, 'short sine fade'),
}, { ongoingFadeCutoffRejected: true, shortSineFadeErrors: [] }, 'reject a cut during fading while accepting a smooth 20ms sine fade');
for (let midi = 55; midi <= 81; midi++) {
  for (const fadeMs of [20, 60]) {
    for (const curve of [(remaining) => remaining ** 2, (remaining) => remaining, (remaining) => Math.sin(remaining * Math.PI / 2)]) {
      const smoothFixture = syntheticPiano(midi, 0, 0);
      const cutoff = smoothFixture.samples.length - CUT_FRAMES;
      const fadeFrames = fadeMs * smoothFixture.sampleRate / 1000;
      for (let index = cutoff - fadeFrames; index < smoothFixture.samples.length; index++) {
        smoothFixture.samples[index] = Math.round(smoothFixture.samples[index] * curve(Math.max(0, (cutoff - index) / fadeFrames)));
      }
      assert.deepEqual(verifySampleQuality(smoothFixture, `synthetic smooth MIDI ${midi}`), []);
    }
  }
  const quietFixture = syntheticPiano(midi, 0, 0);
  for (let index = framesAt(1.5); index < quietFixture.samples.length; index++) {
    quietFixture.samples[index] = Math.round(quietFixture.samples[index] * Math.exp(-50 * (index / quietFixture.sampleRate - 1.5)));
  }
  assert.deepEqual(verifySampleQuality(quietFixture, `synthetic quiet MIDI ${midi}`), []);
}
for (const midi of [55, 69, 81]) {
  for (const fading of [false, true]) {
    for (let phase = 0; phase < 16; phase++) {
      const fixture = syntheticPiano(midi, 0, fading ? 0.08 : 0);
      const period = fixture.sampleRate / (440 * 2 ** ((midi - 69) / 12));
      // 逐相位扫一个周期：任意波形相位上的硬切都要被判出来（残余最小可到 0 LSB，全靠能量塌陷）。
      const cut = fixture.samples.length
        - framesAt(fading ? FADE_CUT_SECONDS : PHASE_CUT_SECONDS) + Math.round(phase * period / 16);
      fixture.samples.fill(0, cut);
      assert.ok(verifySampleQuality(fixture, `synthetic phase ${phase} MIDI ${midi}`).some((error) => error.includes('abrupt tail transition')));
    }
  }
}
console.log('Fade self-check passed: 162 smooth fades and 27 quiet tails accepted; 96 phased/fading cutoffs (含 647/335/178-LSB 同型的硬切), missing fade and abrupt endpoint rejected.');

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
