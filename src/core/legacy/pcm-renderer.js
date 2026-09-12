/**
 * 整题 PCM 渲染器
 *
 * 输入：G3-A5 每个半音一份定音 PCM16 样本 + 题目数据
 * 输出：一段连续的单声道 PCM16 WAV。播放阶段不再移调、解码或逐音符调度。
 */
// 钢琴采样统一为 16kHz，进一步压缩主包体积（16kHz 对听记足够）。
const SAMPLE_RATE = 16000;
const STANDARD_MIDI = 69;
const STANDARD_START = 0.08;
const QUESTION_START = 1.78;
const RELEASE_SECONDS = 0.08;

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
  if (format.audioFormat !== 1 || format.channels !== 1 || format.bitsPerSample !== 16 || format.sampleRate !== SAMPLE_RATE) {
    throw new Error(`音色格式必须是 mono PCM16 ${SAMPLE_RATE}Hz`);
  }
  const pcmBuffer = arrayBuffer.slice(dataOffset, dataOffset + dataSize);
  return { sampleRate: SAMPLE_RATE, samples: new Int16Array(pcmBuffer) };
}

function addNote(events, midi, start, duration, velocity = 0.86, release = RELEASE_SECONDS) {
  events.push({ type: 'note', midi, start, duration: Math.max(0.06, duration), velocity, release });
}

function buildQuestionTimeline(question) {
  if (!question || !question.type) throw new Error('题目数据不完整');
  const events = [];
  let end = 0;

  if (question.type !== 'rhythm') {
    addNote(events, STANDARD_MIDI, STANDARD_START, 1.35, 0.78);
    end = QUESTION_START;
  }

  switch (question.type) {
    case 'single':
      addNote(events, question.midis[0], QUESTION_START, 1.77, 0.94);
      end = QUESTION_START + 1.92;
      break;
    case 'interval':
      if (question.harmonic) {
        question.midis.forEach((midi) => addNote(events, midi, QUESTION_START, 1.65, 0.68));
        end = QUESTION_START + 1.8;
      } else {
        question.midis.forEach((midi, index) => addNote(events, midi, QUESTION_START + index * 0.72, 0.64, 0.84));
        end = QUESTION_START + question.midis.length * 0.72 + 0.15;
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
      // 不同音高的钢琴采样自然衰减时长差异很大（高音约 0.5s、低音约 1.8s 才衰减完），
      // 若按采样自然衰减混音，低音会拖尾、高音提前消失，听成“尾音参差”。
      // 因此把持续时长收敛到 1.3s（此时绝大多数和弦音仍可闻），并统一 0.3s release 渐隐，
      // 让所有音在同一时刻平滑结束，保证“同时开始、同时结束”。
      question.midis.forEach((midi) => addNote(events, midi, QUESTION_START, 1.3, 0.58, 0.3));
      end = QUESTION_START + 1.7;
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

function mixNote(output, sample, event) {
  const release = Math.max(0.02, Number(event.release) || RELEASE_SECONDS);
  const startFrame = Math.max(0, Math.round(event.start * SAMPLE_RATE));
  const requestedFrames = Math.round((event.duration + release) * SAMPLE_RATE);
  const frames = Math.min(sample.length, requestedFrames, output.length - startFrame);
  if (frames <= 0) return;
  const releaseFrames = Math.min(frames, Math.round(release * SAMPLE_RATE));
  const releaseStart = frames - releaseFrames;
  for (let index = 0; index < frames; index++) {
    const envelope = index < releaseStart ? 1 : (frames - index) / Math.max(1, releaseFrames);
    output[startFrame + index] += (sample[index] / 32768) * event.velocity * envelope;
  }
}

function mixClick(output, event) {
  const startFrame = Math.max(0, Math.round(event.start * SAMPLE_RATE));
  const frames = Math.min(Math.round(0.08 * SAMPLE_RATE), output.length - startFrame);
  const frequency = event.accent ? 1760 : 1180;
  const amplitude = event.accent ? 0.68 : 0.5;
  for (let index = 0; index < frames; index++) {
    const envelope = Math.pow(1 - index / frames, 3);
    const phase = 2 * Math.PI * frequency * index / SAMPLE_RATE;
    output[startFrame + index] += Math.sin(phase) * amplitude * envelope;
  }
}

function encodePcm16Wav(samples) {
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
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
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

function renderQuestionWav(question, bank) {
  const timeline = buildQuestionTimeline(question);
  const frameCount = Math.max(1, Math.ceil(timeline.duration * SAMPLE_RATE));
  const output = new Float32Array(frameCount);
  timeline.events.forEach((event) => {
    if (event.type === 'click') {
      mixClick(output, event);
      return;
    }
    const item = bank[event.midi];
    if (!item || !item.samples) throw new Error(`缺少 MIDI ${event.midi} 定音采样`);
    mixNote(output, item.samples, event);
  });
  return {
    arrayBuffer: encodePcm16Wav(output),
    duration: timeline.duration,
    events: timeline.events
  };
}

function renderNoteWav(sample, options = {}) {
  if (!sample || !sample.samples) throw new Error('定音采样未准备完成');
  const duration = Math.max(0.08, Number(options.duration) || 1.77);
  const release = Math.max(0.02, Number(options.release) || RELEASE_SECONDS);
  const velocity = Math.max(0, Math.min(1, Number(options.velocity) || 0.94));
  const output = new Float32Array(Math.ceil((duration + release) * SAMPLE_RATE));
  mixNote(output, sample.samples, { start: 0, duration, release, velocity });
  return { arrayBuffer: encodePcm16Wav(output), duration: duration + release };
}

module.exports = {
  SAMPLE_RATE,
  parsePcm16Wav,
  buildQuestionTimeline,
  renderQuestionWav,
  renderNoteWav,
  encodePcm16Wav
};
