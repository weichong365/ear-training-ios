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

function loadEngine(downloadAsync, seekTo = async () => undefined, emitPlaying = true) {
  const events = { created: 0, played: 0, paused: 0, removed: 0 };
  const players = [];
  const timers = new Set();
  const engine = vm.runInNewContext(`${source}\n;({ playPianoNote, playQuestionAudio, stopQuestionAudio, isQuestionAudioBusy });`, {
    require(id) {
      if (id === 'expo-asset') return { Asset: { fromModule: () => ({ downloadAsync, localUri: 'file:///piano.wav' }) } };
      if (id === 'expo-audio') return {
        setAudioModeAsync: async () => undefined,
        createAudioPlayer: () => {
          events.created += 1;
          const instance = {
            played: 0,
            pause() { events.paused += 1; }, remove() { events.removed += 1; }, setPlaybackRate() {},
            play() {
              events.played += 1;
              instance.played += 1;
              if (emitPlaying) instance.emit?.({ playing: true, currentTime: 0 });
            }, replace() {},
            seekTo: () => seekTo(players.indexOf(instance)),
            addListener: (_event, listener) => { instance.emit = listener; return { remove() {} }; },
          };
          players.push(instance);
          return instance;
        },
      };
      if (id === 'expo-file-system') return { File: class { uri = 'file:///question.wav'; create() {} write() {} }, Paths: {} };
      if (id === 'react-native') return { Platform: { OS: 'ios' } };
      if (id === '@/core/piano-playback') return { pianoPlaybackConfig: (midi) => ({ sampleMidi: midi, playbackRate: 1 }) };
      if (id === '@/services/note-assets') return { NOTE_ASSETS: {}, PIANO_NOTE_ASSETS: { 69: 1, 70: 2 } };
      if (id === '../core/legacy/pcm-renderer.js') return { parsePcm16Wav() {}, renderQuestionWav: () => ({ arrayBuffer: new ArrayBuffer(0), duration: 2 }) };
      throw new Error(`Unexpected module: ${id}`);
    },
    setTimeout: (callback, ms) => { const timer = { callback, ms }; timers.add(timer); return timer; },
    clearTimeout: (timer) => timers.delete(timer),
    console,
  });
  return { engine, events, players, timers };
}

async function flushUntil(predicate) {
  for (let count = 0; count < 20 && !predicate(); count += 1) await Promise.resolve();
  assert.ok(predicate(), 'expected audio lifecycle boundary was not reached');
}

let completed = false;
process.once('beforeExit', () => assert.ok(completed, 'audio regression must finish every awaited assertion'));
(async () => {
  const firstSeek = deferred();
  const race = loadEngine(async () => undefined, (index) => index === 0 ? firstSeek.promise : Promise.resolve(), false);
  const staleCallbacks = [];
  const firstQuestion = race.engine.playQuestionAudio({}, { onFinish: () => staleCallbacks.push('finish'), onError: () => staleCallbacks.push('error') });
  let firstReturned = false;
  firstQuestion.then(() => { firstReturned = true; });
  await flushUntil(() => race.players.length === 1);
  race.engine.stopQuestionAudio();
  const secondQuestion = race.engine.playQuestionAudio({});
  await flushUntil(() => race.players[1]?.played === 1);
  const currentTimers = [...race.timers];
  firstSeek.resolve();
  await flushUntil(() => race.players[1]?.played > 1 || firstReturned);
  assert.equal(race.players[0].played, 0, 'a cancelled seek must never start the old player');
  assert.equal(race.players[1].played, 1, 'A seek → stop → B → A return must not play B a second time');
  assert.deepEqual([...race.timers], currentTimers, 'a stale seek must not replace B cancellation/watchdog timers');
  assert.equal(await firstQuestion, false, 'the stopped request must settle as cancelled');
  race.players[0].emit({ playing: true, didJustFinish: true, currentTime: 2 });
  assert.deepEqual(staleCallbacks, [], 'late events from A must not finish or error the newer request');
  assert.equal(race.engine.isQuestionAudioBusy(), true, 'B must remain busy after A returns and emits late events');
  race.engine.stopQuestionAudio();
  assert.equal(await secondQuestion, false, 'B must retain its own start cancellation callback');
  assert.equal(race.timers.size, 0, 'stopping B must remove every pending timer');

  const startRace = loadEngine(async () => undefined, undefined, false);
  const cancelledStart = startRace.engine.playQuestionAudio({});
  await flushUntil(() => startRace.players[0]?.played === 1);
  startRace.players[0].emit({ playing: true, currentTime: 0 });
  startRace.engine.stopQuestionAudio();
  let finished = 0;
  const currentStart = startRace.engine.playQuestionAudio({}, { onFinish: () => { finished += 1; } });
  await flushUntil(() => startRace.players[1]?.played === 1);
  assert.equal(await cancelledStart, false, 'stop after a native start event but before the awaiting caller resumes must invalidate its result');
  startRace.players[1].emit({ playing: true, currentTime: 0 });
  assert.equal(await currentStart, true, 'the current request must still report a successful start');
  startRace.players[1].emit({ playing: false, didJustFinish: true, currentTime: 2 });
  assert.equal(finished, 1, 'a current player must finish once');
  assert.equal(startRace.engine.isQuestionAudioBusy(), false);
  assert.equal(startRace.timers.size, 0);

  const slowLoad = deferred();
  const lifecycle = loadEngine(() => slowLoad.promise, undefined, false);
  const signals = [];
  const slowNote = lifecycle.engine.playPianoNote(69, 0.5, { onStart: () => signals.push('start'), onFinish: () => signals.push('finish') });
  assert.deepEqual(signals, [], 'loading a sample must not report audible playback');
  assert.equal(lifecycle.timers.size, 0, 'sample loading must not spend the audible note lifetime');
  slowLoad.resolve();
  await flushUntil(() => lifecycle.players.length === 1);
  assert.deepEqual(signals, [], 'creating a player must not highlight a key before native playback starts');
  lifecycle.players[0].emit?.({ playing: true, currentTime: 0 });
  assert.deepEqual(signals, ['start'], 'the native playing event must start the key highlight');
  assert.equal(await slowNote, 'started');
  const noteTimer = [...lifecycle.timers].find((timer) => timer.ms === 1850);
  assert.ok(noteTimer, 'the full 1.85-second lifetime must begin with audible playback');
  noteTimer.callback();
  assert.deepEqual(signals, ['start', 'finish'], 'audio disposal must end the key highlight exactly once');
  assert.equal(lifecycle.events.removed, 1);

  const nativeFailure = loadEngine(async () => undefined, undefined, false);
  const failedSignals = [];
  const failedNote = nativeFailure.engine.playPianoNote(69, 0.5, { onStart: () => failedSignals.push('start') });
  await flushUntil(() => nativeFailure.players.length === 1);
  nativeFailure.players[0].emit?.({ error: 'native load failed' });
  assert.equal(await failedNote, 'failed', 'a native player failure before start must return failure');
  assert.deepEqual(failedSignals, [], 'failed audio must never activate a key highlight');
  assert.equal(nativeFailure.timers.size, 0);

  const stalled = loadEngine(async () => undefined, undefined, false);
  const stalledNote = stalled.engine.playPianoNote(69, 0.5);
  await flushUntil(() => stalled.players.length === 1);
  [...stalled.timers].find((timer) => timer.ms === 3000).callback();
  assert.equal(await stalledNote, 'failed', 'a native player that never starts must release the request with a failure');
  assert.equal(stalled.timers.size, 0);

  const cancelled = loadEngine(async () => undefined, undefined, false);
  const cancelledSignals = [];
  const cancelledNote = cancelled.engine.playPianoNote(69, 0.5, { onStart: () => cancelledSignals.push('start') });
  await flushUntil(() => cancelled.players.length === 1);
  cancelled.engine.stopQuestionAudio();
  cancelled.players[0].emit({ playing: true, currentTime: 0 });
  assert.equal(await cancelledNote, 'cancelled', 'stop while waiting for native playback must settle cancellation');
  assert.deepEqual(cancelledSignals, [], 'a removed piano player cannot later highlight a key');
  assert.equal(cancelled.timers.size, 0);

  const ended = loadEngine(async () => undefined);
  let ends = 0;
  await ended.engine.playPianoNote(69, 0.5, { onFinish: () => { ends += 1; } });
  ended.players[0].emit({ playing: false, didJustFinish: true, currentTime: 1.85 });
  assert.equal(ends, 1, 'the native end event must release the highlight without waiting for the fallback timer');
  assert.equal(ended.timers.size, 0);
  ended.players[0].emit({ playing: false, didJustFinish: true, currentTime: 1.85 });
  assert.equal(ends, 1, 'duplicate end events must not reset later UI state');

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

  completed = true;
  console.log('audio lifecycle runtime contract passed: seek/start races, native piano start/end, delayed loading, cancellation, rapid taps and failures');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
