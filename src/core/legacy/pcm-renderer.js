/**
 * 整题 PCM 渲染器
 *
 * 输入：G3-A5 每个半音一份定音样本（运行期来自包内 mp3 的 WebAudio 解码，
 *       测试里来自合成波形）+ 题目数据
 * 输出：一段连续的单声道 PCM16 WAV。播放阶段不再移调、解码或逐音符调度。
 *
 * ⚠️ 采样率不写死。包内是 44.1kHz 的 mp3，但 WebAudio 的 decodeAudioData 会把结果
 * 重采样到**宿主音频上下文的采样率** —— Chromium(含微信开发者工具) 默认 48kHz，
 * 微信真机通常是 44.1kHz。所以实际采样率由 bank 里的样本携带，渲染器读它、
 * 并把同一个值写进 WAV 头，这样无论宿主解出多少，时间轴与播放速度都自洽。
 */
const DEFAULT_SAMPLE_RATE = 44100;
// 兼容旧引用名；渲染时实际用的是 resolveSampleRate() 的结果。
const SAMPLE_RATE = DEFAULT_SAMPLE_RATE;
const STANDARD_MIDI = 69;
// 标准参考音（A4）的力度。2026-09-20 由 0.78 提到 0.94，与单音题同档：
// 它原本只是时间轴上的第 0 个 note，跟着题目音共用一张力度表，被顺手塞了偏低的 0.78；
// 而单音题在换 4 秒采样那轮提到了 0.94 ⇒ 实测标准音比题目音轻 1.62 dB，
// 用户真机听感反馈「标准音的力度比后面的音小」。标准音是考纲要求的定调基准，
// 与题目音等响反而更好用 —— 区分「这是标准音」靠的是音色与时序（固定 A4、提前 1.7 秒单独响），
// 不该靠音量。改动需与 ios-app/src/core/legacy/pcm-renderer.js 同步（ios-sync.test.js 逐字节校验）。
const STANDARD_VELOCITY = 0.94;
const STANDARD_START = 0.08;
const QUESTION_START = 1.78;
const RELEASE_SECONDS = 0.08;
// 仅用 0.5ms 消除 MP3 延迟补偿后首帧不为零造成的波形跳变；
// 更长淡入会明显压低钢琴最前端的琴槌瞬态。
const NOTE_ATTACK_SECONDS = 0.0005;
// 单音题与复盘钢琴：让钢琴音自然衰减完整（包内采样长 4.00s）。
const NOTE_DURATION = 4.0;
const SEQUENTIAL_NOTE_SECONDS = 2.0;
const HARMONIC_NOTE_SECONDS = 4.0;

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  const tag = Object.prototype.toString.call(data);
  if (tag === '[object ArrayBuffer]') {
    const copy = new Uint8Array(data.byteLength);
    copy.set(new Uint8Array(data));
    return copy.buffer;
  }
  const bufferTag = data && Object.prototype.toString.call(data.buffer);
  if (data && (data.buffer instanceof ArrayBuffer || bufferTag === '[object ArrayBuffer]')) {
    const start = Number(data.byteOffset) || 0;
    const length = Number(data.byteLength) || data.buffer.byteLength;
    const copy = new Uint8Array(length);
    copy.set(new Uint8Array(data.buffer, start, length));
    return copy.buffer;
  }
  throw new Error('音色文件不是 ArrayBuffer');
}

function fourCC(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1),
    view.getUint8(offset + 2), view.getUint8(offset + 3)
  );
}

function parsePcm16Wav(data) {
  const arrayBuffer = toArrayBuffer(data);
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 44 || fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') {
    throw new Error('无效的 WAV 文件');
  }
  let offset = 12;
  let format = null;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (body + size > view.byteLength) throw new Error(`WAV ${id} 数据越界`);
    if (id === 'fmt ') {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true)
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!format || dataOffset < 0) throw new Error('WAV 缺少 fmt 或 data 区块');
  if (format.audioFormat !== 1 || format.channels !== 1 || format.bitsPerSample !== 16
      || !(format.sampleRate > 0)) {
    throw new Error('音色格式必须是 mono PCM16 WAV');
  }
  const pcmBuffer = arrayBuffer.slice(dataOffset, dataOffset + dataSize);
  return { sampleRate: format.sampleRate, samples: new Int16Array(pcmBuffer) };
}

/** 解析本次渲染要用的采样率：显式参数 > bank 内样本 > 默认值。 */
function resolveSampleRate(bank, explicit) {
  const given = Number(explicit);
  if (given > 0) return given;
  if (bank) {
    for (const key in bank) {
      const item = bank[key];
      if (item && Number(item.sampleRate) > 0) return Number(item.sampleRate);
    }
  }
  return DEFAULT_SAMPLE_RATE;
}

/** 样本可能是解码后的 Float32（±1），也可能是解析出来的 Int16。 */
function sampleScale(samples) {
  return Object.prototype.toString.call(samples) === '[object Float32Array]' ? 1 : 1 / 32768;
}

function addNote(events, midi, start, duration, velocity = 0.86, release = RELEASE_SECONDS) {
  events.push({ type: 'note', midi, start, duration: Math.max(0.06, duration), velocity, release });
}

function buildQuestionTimeline(question) {
  if (!question || !question.type) throw new Error('题目数据不完整');
  const events = [];
  let end = 0;

  if (question.type !== 'rhythm') {
    addNote(events, STANDARD_MIDI, STANDARD_START, 1.35, STANDARD_VELOCITY);
    end = QUESTION_START;
  }

  switch (question.type) {
    case 'single':
      // 单音题放宽到整段采样长度，让钢琴尾巴自然衰减完（原来 1.77s 是 16kHz 采样的物理上限）。
      addNote(events, question.midis[0], QUESTION_START, NOTE_DURATION, 0.94);
      end = QUESTION_START + NOTE_DURATION + RELEASE_SECONDS;
      break;
    case 'interval':
      if (question.harmonic) {
        question.midis.forEach((midi) => addNote(
          events, midi, QUESTION_START, HARMONIC_NOTE_SECONDS - RELEASE_SECONDS, 0.68
        ));
        end = QUESTION_START + HARMONIC_NOTE_SECONDS;
      } else {
        question.midis.forEach((midi, index) => addNote(
          events, midi, QUESTION_START + index * SEQUENTIAL_NOTE_SECONDS,
          SEQUENTIAL_NOTE_SECONDS - RELEASE_SECONDS, 0.84
        ));
        end = QUESTION_START + question.midis.length * SEQUENTIAL_NOTE_SECONDS;
      }
      break;
    case 'intervalConnection':
      question.chords.forEach((chord, chordIndex) => {
        chord.forEach((midi) => addNote(events, midi, QUESTION_START + chordIndex * 1.12, 0.94, 0.68));
      });
      end = QUESTION_START + question.chords.length * 1.12 + 0.15;
      break;
    case 'chord':
      // 和弦听记必须是柱式和弦：所有采样写入完全相同的起始帧。
      // 旧逻辑每个音错开 35ms，会在真机上听成轻微琶音。
      // 三个音统一保持 4 秒可听窗口，其中最后 0.3 秒同步渐隐，保证同时开始、同时结束。
      question.midis.forEach((midi) => addNote(
        events, midi, QUESTION_START, HARMONIC_NOTE_SECONDS - 0.3, 0.58, 0.3
      ));
      end = QUESTION_START + HARMONIC_NOTE_SECONDS;
      break;
    case 'melody': {
      const beatSeconds = 60 / question.bpm;
      let cursor = QUESTION_START;
      question.midis.forEach((midi, index) => {
        const durationValue = Number(question.durs[index]) || 1;
        const beatDuration = Math.abs(durationValue) * beatSeconds;
        if (durationValue > 0) {
          const beatInBar = ((cursor - QUESTION_START) / beatSeconds) % (question.beatsPerBar || 4);
          const velocity = beatInBar < 0.01 ? 0.84 : 0.79;
          addNote(events, midi, cursor, Math.max(0.16, beatDuration * 0.94), velocity);
        }
        cursor += beatDuration;
      });
      end = cursor + 0.25;
      break;
    }
    case 'rhythm': {
      const beatSeconds = 60 / question.bpm;
      let cursor = 0.22;
      const numerator = Number(question.meterNumerator) || 4;
      const denominator = Number(question.meterDenominator) || 4;
      const countInCount = denominator === 8 && numerator === 6 ? 6 : numerator;
      const countInStep = denominator === 8 ? 0.5 : 1;
      for (let index = 0; index < countInCount; index++) {
        const accent = denominator === 8 && numerator === 6 ? (index === 0 || index === 3) : index === 0;
        events.push({ type: 'click', start: cursor, accent });
        cursor += beatSeconds * countInStep;
      }
      const sourceEvents = Array.isArray(question.rhythmEvents)
        ? question.rhythmEvents.reduce((all, bar) => all.concat(bar), [])
        : question.beats.map((beat) => ({ duration: Math.abs(beat), rest: beat < 0, tieToNext: false }));
      for (let index = 0; index < sourceEvents.length; index++) {
        const source = sourceEvents[index];
        let beats = Math.abs(Number(source.duration) || 0);
        if (!source.rest) {
          while (sourceEvents[index].tieToNext && sourceEvents[index + 1] && !sourceEvents[index + 1].rest) {
            index++;
            beats += Math.abs(Number(sourceEvents[index].duration) || 0);
          }
          const duration = beats * beatSeconds;
          addNote(events, STANDARD_MIDI, cursor, Math.max(0.16, duration * 0.94), 0.84);
        }
        cursor += beats * beatSeconds;
      }
      end = cursor + 0.3;
      break;
    }
    default:
      throw new Error(`不支持的题型: ${question.type}`);
  }

  return { events, duration: end };
}

function mixNote(output, sample, event, sampleRate) {
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : DEFAULT_SAMPLE_RATE;
  const release = Math.max(0.02, Number(event.release) || RELEASE_SECONDS);
  const startFrame = Math.max(0, Math.round(event.start * rate));
  const requestedFrames = Math.round((event.duration + release) * rate);
  const frames = Math.min(sample.length, requestedFrames, output.length - startFrame);
  if (frames <= 0) return;
  const scale = sampleScale(sample);
  const attackFrames = Math.min(frames, Math.max(1, Math.round(NOTE_ATTACK_SECONDS * rate)));
  const releaseFrames = Math.min(frames, Math.round(release * rate));
  const releaseStart = frames - releaseFrames;
  for (let index = 0; index < frames; index++) {
    const attackEnvelope = Math.min(1, index / attackFrames);
    const releaseEnvelope = index < releaseStart ? 1 : (frames - index) / Math.max(1, releaseFrames);
    const envelope = attackEnvelope * releaseEnvelope;
    output[startFrame + index] += (sample[index] * scale) * event.velocity * envelope;
  }
}

function mixClick(output, event, sampleRate) {
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : DEFAULT_SAMPLE_RATE;
  const startFrame = Math.max(0, Math.round(event.start * rate));
  const frames = Math.min(Math.round(0.08 * rate), output.length - startFrame);
  const frequency = event.accent ? 1760 : 1180;
  const amplitude = event.accent ? 0.68 : 0.5;
  for (let index = 0; index < frames; index++) {
    const envelope = Math.pow(1 - index / frames, 3);
    const phase = 2 * Math.PI * frequency * index / rate;
    output[startFrame + index] += Math.sin(phase) * amplitude * envelope;
  }
}

function encodePcm16Wav(samples, sampleRate) {
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : DEFAULT_SAMPLE_RATE;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let peak = 0;
  for (let index = 0; index < samples.length; index++) peak = Math.max(peak, Math.abs(samples[index]));
  const scale = peak > 0.94 ? 0.94 / peak : 1;
  for (let index = 0; index < samples.length; index++) {
    const value = Math.max(-1, Math.min(1, samples[index] * scale));
    view.setInt16(44 + index * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return buffer;
}

function renderQuestionWav(question, bank, sampleRate) {
  const rate = resolveSampleRate(bank, sampleRate);
  const timeline = buildQuestionTimeline(question);
  const frameCount = Math.max(1, Math.ceil(timeline.duration * rate));
  const output = new Float32Array(frameCount);
  timeline.events.forEach((event) => {
    if (event.type === 'click') {
      mixClick(output, event, rate);
      return;
    }
    const item = bank[event.midi];
    if (!item || !item.samples) throw new Error(`缺少 MIDI ${event.midi} 定音采样`);
    mixNote(output, item.samples, event, rate);
  });
  return {
    arrayBuffer: encodePcm16Wav(output, rate),
    sampleRate: rate,
    duration: timeline.duration,
    events: timeline.events
  };
}

function renderNoteWav(sample, options = {}) {
  if (!sample || !sample.samples) throw new Error('定音采样未准备完成');
  const rate = Number(sample.sampleRate) || DEFAULT_SAMPLE_RATE;
  const duration = Math.max(0.08, Number(options.duration) || NOTE_DURATION);
  const release = Math.max(0.02, Number(options.release) || RELEASE_SECONDS);
  const velocity = Math.max(0, Math.min(1, Number(options.velocity) || 0.94));
  const output = new Float32Array(Math.ceil((duration + release) * rate));
  mixNote(output, sample.samples, { start: 0, duration, release, velocity }, rate);
  return { arrayBuffer: encodePcm16Wav(output, rate), sampleRate: rate, duration: duration + release };
}

module.exports = {
  SAMPLE_RATE,
  DEFAULT_SAMPLE_RATE,
  NOTE_DURATION,
  NOTE_ATTACK_SECONDS,
  resolveSampleRate,
  parsePcm16Wav,
  buildQuestionTimeline,
  renderQuestionWav,
  renderNoteWav,
  encodePcm16Wav
};
