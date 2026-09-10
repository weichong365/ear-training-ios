# Native Parity Audio and Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make question playback and the review piano use the same clean, accurately tuned G3–A5 samples with a 1.85-second single-note envelope and safe user-facing errors.

**Architecture:** Treat the 27 checked-in WAV files as canonical, map each MIDI note directly to its matching file, and remove runtime pitch shifting for this range. Keep rhythm and melody scheduling based on written duration while sharing one playback path for isolated notes and review keys.

**Tech Stack:** Expo Audio, TypeScript, Python audio verification script, Node smoke tests

**Spec:** `docs/superpowers/specs/2026-09-10-miniprogram-native-parity-design.md`

## Global Constraints

- Canonical range is MIDI 55–81 inclusive, G3 through A5, exactly 27 samples.
- Tuning is A4=440 Hz equal temperament with detected error no greater than ±0.5 cents.
- Single-note and review-piano playback is 1.85 seconds: 1.77 seconds sustain plus 0.08 seconds fade.
- Exact samples use playback rate `1`; rhythm and melody retain written timing.
- Raw native or Expo error strings never appear in the interface.

---

### Task 1: Make sample quality measurable

**Files:**
- Modify: `scripts/verify-sample-range.cjs`
- Modify: `scripts/answer-smoke.mjs`
- Test: `scripts/verify-sample-range.cjs`

**Interfaces:**
- Consumes: `assets/audio/piano/*.wav`, `src/services/note-assets.ts`, `src/core/piano-playback.ts`
- Produces: automated checks for count, direct mapping, duration, fade, and tuning

- [ ] **Step 1: Add failing assertions for the canonical asset contract**

For every MIDI value 55–81, assert one mapped WAV, `playbackRate === 1`, sample duration within `1.85 ± 0.01` seconds, and final 80 ms monotonically approaching silence within a small RMS tolerance.

- [ ] **Step 2: Add a deterministic tuning check**

Compute target frequency with:

```js
const targetHz = 440 * 2 ** ((midi - 69) / 12);
const cents = 1200 * Math.log2(detectedHz / targetHz);
assert.ok(Math.abs(cents) <= 0.5, `${name} tuning drift: ${cents.toFixed(3)} cents`);
```

Use the existing offline verification path; do not add an npm dependency.

- [ ] **Step 3: Run checks and record which assets fail**

Run: `npm run test:sample-range && npm run test:answers`

Expected: FAIL if any asset, duration, fade, or runtime-rate assertion remains out of contract.

- [ ] **Step 4: Commit the failing audio contract**

```bash
git add scripts/verify-sample-range.cjs scripts/answer-smoke.mjs
git commit -m "test: define canonical piano sample contract"
```

### Task 2: Finalize the canonical 27 samples

**Files:**
- Modify: `scripts/retune-piano-samples.py`
- Modify: `assets/audio/piano/G3.wav` through `assets/audio/piano/A5.wav`
- Test: `scripts/verify-sample-range.cjs`

**Interfaces:**
- Consumes: current WAV files and MIDI-to-frequency formula
- Produces: 27 normalized PCM WAV files with clean attack, steady harmonics, and 80 ms fade

- [ ] **Step 1: Make the retuning script deterministic**

Use a fixed sample rate, preserve the fundamental at the target frequency, suppress DC offset, apply conservative peak normalization, and apply only one terminal 80 ms equal-power fade. Avoid repeated resampling passes.

- [ ] **Step 2: Regenerate only MIDI 55–81 assets**

Run: `python scripts/retune-piano-samples.py`

Expected: exactly 27 WAV files are updated; the script reports target frequency, detected frequency, cents error, and duration for each file.

- [ ] **Step 3: Verify sample quality**

Run: `npm run test:sample-range`

Expected: PASS for all 27 files, duration `1.85 ± 0.01` seconds, and tuning within ±0.5 cents.

- [ ] **Step 4: Commit the audio assets and generator together**

```bash
git add scripts/retune-piano-samples.py assets/audio/piano
git commit -m "fix: finalize clean calibrated piano samples"
```

### Task 3: Unify question and review playback

**Files:**
- Modify: `src/core/piano-playback.ts`
- Modify: `src/services/note-assets.ts`
- Modify: `src/services/audio-engine.ts`
- Modify: `src/app/practice.tsx`
- Modify: `src/app/exam-paper.tsx`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `pianoPlaybackConfig(midi)` and canonical note asset map
- Produces: `playPianoNote(midi, options)` using direct assets and rate 1
- Produces: `friendlyAudioMessage(error: unknown): string`

- [ ] **Step 1: Change the smoke contract from runtime pitch shifting to direct playback**

```js
assert.doesNotMatch(audioEngineSource, /setPlaybackRate\(/, '精确采样范围不得运行时变速');
assert.deepEqual(pianoPlaybackConfig(60), { sampleMidi: 60, playbackRate: 1 });
```

- [ ] **Step 2: Remove the unnecessary native rate call**

In `playPianoNote`, load `config.sampleMidi` and call play directly. Do not call `setPlaybackRate` when the canonical mapping returns rate 1.

- [ ] **Step 3: Share one isolated-note playback path**

Route question single-note playback and unlocked review-key playback through the same asset lookup, volume handling, and interruption cleanup. Preserve melody and rhythm scheduler durations.

- [ ] **Step 4: Sanitize visible playback failures**

Add a small pure mapper:

```ts
export function friendlyAudioMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error || '');
  if (/permission|access denied|jsapi|operateAudio/i.test(value)) return '音频暂时无法播放，请稍后重试';
  return '播放失败，请重试';
}
```

Use it in practice and exam screens; keep raw details only in development logging.

- [ ] **Step 5: Run all audio checks**

Run: `npm run test:sample-range && npm run test:answers && npm run typecheck`

Expected: all PASS and source contains no `setPlaybackRate(` call.

- [ ] **Step 6: Commit unified playback**

```bash
git add src/core/piano-playback.ts src/services/note-assets.ts src/services/audio-engine.ts src/app/practice.tsx src/app/exam-paper.tsx scripts/answer-smoke.mjs
git commit -m "fix: unify native question and review audio"
```

### Task 4: Align the review piano overlay

**Files:**
- Modify: `src/components/piano-keyboard.tsx`
- Modify: `src/app/practice.tsx`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: submission state and `playPianoNote`
- Produces: a centered lock overlay and mutually exclusive question/review playback

- [ ] **Step 1: Add a source assertion for centered overlay layout**

Assert the lock overlay uses absolute fill plus both `alignItems: 'center'` and `justifyContent: 'center'`.

- [ ] **Step 2: Center and orient the lock**

Apply `StyleSheet.absoluteFillObject` to the overlay, center the square backing and glyph, and use the confirmed 90-degree keyhole orientation without rotating the entire lock body.

- [ ] **Step 3: Prevent concurrent playback**

Before starting a question, stop a review note; before starting a review note, stop question playback. Keep review keys disabled until answer submission.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:answers && npm run typecheck`

Expected: PASS.

```bash
git add src/components/piano-keyboard.tsx src/app/practice.tsx scripts/answer-smoke.mjs
git commit -m "fix: align native review piano behavior"
```

### Task 5: Perform device audio verification

**Files:**
- Verify: `assets/audio/piano/*.wav`
- Verify: `src/services/audio-engine.ts`
- Verify: `src/app/practice.tsx`

**Interfaces:**
- Consumes: finished audio implementation
- Produces: Simulator evidence and a user true-device verification checklist

- [ ] **Step 1: Compare question and review playback on Simulator**

Play G3, C4, A4, C5, and A5 as questions and as review keys at the same volume. Confirm matching timbre, pitch, envelope, and no overlap.

- [ ] **Step 2: Exercise interruption and page-return paths**

Navigate away during playback, return to practice, and replay. Confirm no raw error text appears and audio remains recoverable.

- [ ] **Step 3: Run the complete suite**

Run: `npm run lint && npm run typecheck && npm run test:sample-range && npm run test:answers`

Expected: all PASS.

- [ ] **Step 4: Ask the user to confirm final timbre on an iPhone**

Use the same five-note comparison because Simulator cannot prove speaker coloration or final true-device perception.
