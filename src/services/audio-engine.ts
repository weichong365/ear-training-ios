import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { PracticeQuestion } from '@/core';
import { pianoPlaybackConfig } from '@/core/piano-playback';
import { NOTE_ASSETS, PIANO_NOTE_ASSETS } from '@/services/note-assets';

type ParsedSample = { sampleRate: number; samples: Int16Array };
type SampleBank = Record<number, ParsedSample>;
type RenderResult = { arrayBuffer: ArrayBuffer; duration: number };
type PcmRenderer = {
  parsePcm16Wav(data: ArrayBuffer): ParsedSample;
  renderQuestionWav(question: PracticeQuestion, bank: SampleBank): RenderResult;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pcmRenderer = require('../core/legacy/pcm-renderer.js') as PcmRenderer;

let bankPromise: Promise<SampleBank> | null = null;
let player: AudioPlayer | null = null;
let statusSubscription: { remove(): void } | null = null;
let renderingOrPlaying = false;
let cacheSlot = 0;
let webObjectUrl = '';
let playbackWatchdog: ReturnType<typeof setTimeout> | null = null;
let playbackGeneration = 0;
let pendingStartCancel: (() => void) | null = null;
let pianoPlayer: AudioPlayer | null = null;
let pianoCleanup: ReturnType<typeof setTimeout> | null = null;
let pianoPlaybackGeneration = 0;

function stopPianoAudio() {
  if (pianoCleanup) clearTimeout(pianoCleanup);
  pianoCleanup = null;
  pianoPlayer?.pause();
  pianoPlayer?.remove();
  pianoPlayer = null;
}

function cancelPianoPlayback() {
  pianoPlaybackGeneration += 1;
  stopPianoAudio();
}

async function assetArrayBuffer(moduleId: number): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  if (!uri) throw new Error('钢琴采样没有可读取地址');
  if (uri.startsWith('file://')) return new File(uri).arrayBuffer();
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`钢琴采样读取失败：${response.status}`);
  return response.arrayBuffer();
}

export function preparePianoBank(): Promise<SampleBank> {
  if (bankPromise) return bankPromise;
  bankPromise = (async () => {
    const bank: SampleBank = {};
    await Promise.all(Object.entries(NOTE_ASSETS).map(async ([midiText, moduleId]) => {
      const midi = Number(midiText);
      bank[midi] = pcmRenderer.parsePcm16Wav(await assetArrayBuffer(moduleId));
    }));
    return bank;
  })().catch((error) => {
    bankPromise = null;
    throw error;
  });
  return bankPromise;
}

async function renderedAudio(question: PracticeQuestion): Promise<{ uri: string; duration: number }> {
  const bank = await preparePianoBank();
  const rendered = pcmRenderer.renderQuestionWav(question, bank);
  const bytes = new Uint8Array(rendered.arrayBuffer);

  if (Platform.OS === 'web') {
    if (webObjectUrl) URL.revokeObjectURL(webObjectUrl);
    webObjectUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    return { uri: webObjectUrl, duration: rendered.duration };
  }

  cacheSlot = cacheSlot ? 0 : 1;
  const output = new File(Paths.cache, `ear-training-question-${cacheSlot}.wav`);
  output.create({ overwrite: true, intermediates: true });
  output.write(bytes);
  return { uri: output.uri, duration: rendered.duration };
}

export async function configureIOSAudio() {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  });
  preparePianoBank().catch(() => null);
}

export function isQuestionAudioBusy() {
  return renderingOrPlaying;
}

export async function playQuestionAudio(
  question: PracticeQuestion,
  options: { volume?: number; onFinish?: () => void; onInterrupted?: () => void; onError?: (error: Error) => void } = {},
) {
  if (renderingOrPlaying) return false;
  renderingOrPlaying = true;
  const generation = playbackGeneration;
  try {
    const { uri, duration } = await renderedAudio(question);
    // 页面退出或进入后台时会令 generation 失效；旧的异步渲染不得在稍后自行开播。
    if (generation !== playbackGeneration) return false;
    statusSubscription?.remove();
    if (playbackWatchdog) clearTimeout(playbackWatchdog);
    if (!player) player = createAudioPlayer(uri, { updateInterval: 100 });
    else player.replace(uri);
    player.volume = Math.max(0, Math.min(1, options.volume ?? 0.78));
    let completed = false;
    let hasStarted = false;
    let startSettled = false;
    let startTimeout: ReturnType<typeof setTimeout> | null = null;
    let resolveStart: (started: boolean) => void = () => undefined;
    const startedPromise = new Promise<boolean>((resolve) => { resolveStart = resolve; });
    const settleStart = (started: boolean) => {
      if (startSettled) return;
      startSettled = true;
      if (startTimeout) clearTimeout(startTimeout);
      startTimeout = null;
      pendingStartCancel = null;
      resolveStart(started);
    };
    const finalize = (reason: 'finish' | 'interrupted' | 'error', error?: Error) => {
      if (completed) return;
      completed = true;
      settleStart(false);
      if (playbackWatchdog) clearTimeout(playbackWatchdog);
      playbackWatchdog = null;
      if (generation !== playbackGeneration) return;
      renderingOrPlaying = false;
      if (reason === 'finish') options.onFinish?.();
      else if (reason === 'interrupted') options.onInterrupted?.();
      else if (error) options.onError?.(error);
    };
    statusSubscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.error) {
        finalize('error', new Error(status.error));
        return;
      }
      if (status.playing) {
        hasStarted = true;
        settleStart(true);
      }
      if (status.didJustFinish || (hasStarted && status.currentTime >= duration - 0.08)) {
        finalize('finish');
        return;
      }
      if (hasStarted && status.timeControlStatus === 'paused' && !status.isBuffering && status.currentTime > 0.05 && status.currentTime < duration - 0.08) {
        finalize('interrupted');
      }
    });
    await player.seekTo(0);
    pendingStartCancel = () => finalize('interrupted');
    startTimeout = setTimeout(() => finalize('error', new Error('音频未能正常开始播放，请重试')), 3000);
    playbackWatchdog = setTimeout(() => finalize('finish'), Math.ceil((duration + 1.5) * 1000));
    player.play();
    return await startedPromise;
  } catch (reason) {
    if (generation !== playbackGeneration) return false;
    renderingOrPlaying = false;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    options.onError?.(error);
    return false;
  }
}

export function stopQuestionAudio() {
  playbackGeneration += 1;
  const cancelStart = pendingStartCancel;
  pendingStartCancel = null;
  cancelStart?.();
  if (playbackWatchdog) clearTimeout(playbackWatchdog);
  playbackWatchdog = null;
  statusSubscription?.remove();
  statusSubscription = null;
  if (player) {
    player.pause();
    player.remove();
    player = null;
  }
  cancelPianoPlayback();
  renderingOrPlaying = false;
}

export async function playPianoNote(midi: number, volume = 0.78) {
  const config = pianoPlaybackConfig(midi);
  if (!config) return false;
  const moduleId = PIANO_NOTE_ASSETS[config.sampleMidi];
  if (!moduleId) return false;
  const generation = ++pianoPlaybackGeneration;
  try {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    if (generation !== pianoPlaybackGeneration) return false;
    const uri = asset.localUri || asset.uri;
    if (!uri) return false;
    stopPianoAudio();
    pianoPlayer = createAudioPlayer(uri, { updateInterval: 250 });
    pianoPlayer.volume = Math.max(0, Math.min(1, volume));
    pianoPlayer.shouldCorrectPitch = false;
    pianoPlayer.setPlaybackRate(config.playbackRate);
    pianoPlayer.play();
    pianoCleanup = setTimeout(() => {
      pianoPlayer?.pause();
      pianoPlayer?.remove();
      pianoPlayer = null;
      pianoCleanup = null;
    }, 1600);
    return true;
  } catch {
    return false;
  }
}
