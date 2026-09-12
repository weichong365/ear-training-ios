const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const enginePath = path.join(__dirname, '..', 'src', 'services', 'audio-engine.ts');
let resolveDownload;
const download = new Promise((resolve) => { resolveDownload = resolve; });
let createdPlayers = 0;
let playCalls = 0;

const source = stripTypeScriptTypes(fs.readFileSync(enginePath, 'utf8')
  .replace("import { Asset } from 'expo-asset';", "const { Asset } = require('expo-asset');")
  .replace("import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';", "const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');")
  .replace("import { File, Paths } from 'expo-file-system';", "const { File, Paths } = require('expo-file-system');")
  .replace("import { Platform } from 'react-native';", "const { Platform } = require('react-native');")
  .replace("import type { PracticeQuestion } from '@/core';\n", '')
  .replace("import { pianoPlaybackConfig } from '@/core/piano-playback';", "const { pianoPlaybackConfig } = require('@/core/piano-playback');")
  .replace("import { NOTE_ASSETS, PIANO_NOTE_ASSETS } from '@/services/note-assets';", "const { NOTE_ASSETS, PIANO_NOTE_ASSETS } = require('@/services/note-assets');")
  .replace(/^export /gm, ''));

const engine = vm.runInNewContext(`${source}\n;({ playPianoNote, stopQuestionAudio });`, {
  require(id) {
    if (id === 'expo-asset') return { Asset: { fromModule: () => ({ downloadAsync: () => download, localUri: 'file:///piano.wav' }) } };
    if (id === 'expo-audio') return {
      setAudioModeAsync: async () => undefined,
      createAudioPlayer: () => {
        createdPlayers += 1;
        return {
          pause() {}, remove() {}, setPlaybackRate() {},
          play() { playCalls += 1; },
        };
      },
    };
    if (id === 'expo-file-system') return { File: class {}, Paths: {} };
    if (id === 'react-native') return { Platform: { OS: 'ios' } };
    if (id === '@/core/piano-playback') return { pianoPlaybackConfig: (midi) => ({ sampleMidi: midi, playbackRate: 1 }) };
    if (id === '@/services/note-assets') return { NOTE_ASSETS: {}, PIANO_NOTE_ASSETS: { 69: 1 } };
    if (id === '../core/legacy/pcm-renderer.js') return { parsePcm16Wav() {}, renderQuestionWav() {} };
    throw new Error(`Unexpected module: ${id}`);
  },
  setTimeout: () => ({ timer: true }),
  clearTimeout: () => undefined,
  console,
});

const pendingPlay = engine.playPianoNote(69, 0.5);
engine.stopQuestionAudio();
resolveDownload();

pendingPlay.then((started) => {
  assert.equal(started, false, 'a piano load invalidated by cleanup must not report playback started');
  assert.equal(createdPlayers, 0, 'a piano player must not be created after cleanup');
  assert.equal(playCalls, 0, 'a piano note must not play after cleanup');
  console.log('audio lifecycle runtime contract passed: cancelled piano load cannot start playback');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
