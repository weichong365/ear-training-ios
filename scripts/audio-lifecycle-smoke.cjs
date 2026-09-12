const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const enginePath = path.join(__dirname, '..', 'src', 'services', 'audio-engine.ts');
const source = stripTypeScriptTypes(fs.readFileSync(enginePath, 'utf8')
  .replace("import { Asset } from 'expo-asset';", "const { Asset } = require('expo-asset');")
  .replace("import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';", "const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');")
  .replace("import { File, Paths } from 'expo-file-system';", "const { File, Paths } = require('expo-file-system');")
  .replace("import { Platform } from 'react-native';", "const { Platform } = require('react-native');")
  .replace("import type { PracticeQuestion } from '@/core';\n", '')
  .replace("import { pianoPlaybackConfig } from '@/core/piano-playback';", "const { pianoPlaybackConfig } = require('@/core/piano-playback');")
  .replace("import { NOTE_ASSETS, PIANO_NOTE_ASSETS } from '@/services/note-assets';", "const { NOTE_ASSETS, PIANO_NOTE_ASSETS } = require('@/services/note-assets');")
  .replace(/^export /gm, ''));

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

function loadEngine(downloadAsync) {
  const events = { created: 0, played: 0, paused: 0, removed: 0 };
  const engine = vm.runInNewContext(`${source}\n;({ playPianoNote, stopQuestionAudio });`, {
    require(id) {
      if (id === 'expo-asset') return { Asset: { fromModule: () => ({ downloadAsync, localUri: 'file:///piano.wav' }) } };
      if (id === 'expo-audio') return {
        setAudioModeAsync: async () => undefined,
        createAudioPlayer: () => {
          events.created += 1;
          return {
            pause() { events.paused += 1; }, remove() { events.removed += 1; }, setPlaybackRate() {},
            play() { events.played += 1; },
          };
        },
      };
      if (id === 'expo-file-system') return { File: class {}, Paths: {} };
      if (id === 'react-native') return { Platform: { OS: 'ios' } };
      if (id === '@/core/piano-playback') return { pianoPlaybackConfig: (midi) => ({ sampleMidi: midi, playbackRate: 1 }) };
      if (id === '@/services/note-assets') return { NOTE_ASSETS: {}, PIANO_NOTE_ASSETS: { 69: 1, 70: 2 } };
      if (id === '../core/legacy/pcm-renderer.js') return { parsePcm16Wav() {}, renderQuestionWav() {} };
      throw new Error(`Unexpected module: ${id}`);
    },
    setTimeout: () => ({ timer: true }),
    clearTimeout: () => undefined,
    console,
  });
  return { engine, events };
}

(async () => {
  const pending = deferred();
  const replay = loadEngine(() => pending.promise);
  const pendingNote = replay.engine.playPianoNote(69, 0.5);
  replay.engine.stopQuestionAudio();
  pending.resolve();
  assert.equal(await pendingNote, 'cancelled', 'replay cancellation must invalidate a pending manual piano load');
  assert.deepEqual(replay.events, { created: 0, played: 0, paused: 0, removed: 0 }, 'replay must prevent the cancelled manual piano request from creating overlapping audio');

  const firstLoad = deferred();
  let loads = 0;
  const rapid = loadEngine(() => (++loads === 1 ? firstLoad.promise : Promise.resolve()));
  const firstNote = rapid.engine.playPianoNote(69, 0.5);
  const secondNote = rapid.engine.playPianoNote(70, 0.5);
  firstLoad.resolve();
  assert.equal(await firstNote, 'cancelled', 'a superseded manual key request must report cancellation');
  assert.equal(await secondNote, 'started', 'the latest manual key request must still play');
  assert.equal(rapid.events.played, 1, 'superseding a pending key must produce only the latest piano playback');

  const failed = loadEngine(async () => { throw new Error('asset unavailable'); });
  assert.equal(await failed.engine.playPianoNote(69, 0.5), 'failed', 'a real piano asset failure must remain distinguishable from cancellation');

  console.log('audio lifecycle runtime contract passed: replay cancels pending piano audio, rapid taps supersede cleanly, and real failures remain reportable');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
