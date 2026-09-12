# iOS Practice Core Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every iOS practice type match the mini-program's UI information, state flow, local persistence, notation semantics, playback, feedback, and review-piano behavior while retaining native iOS interaction.

**Architecture:** Keep the already mirrored question, scoring, province, PCM, and sample core unchanged. Add a compact source-level parity contract, then make surgical changes in the existing practice screen and focused components/services; shared geometry remains the only notation coordinate source.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript, React Native SVG, Expo Audio, Node smoke tests.

**Spec:** `docs/superpowers/specs/2026-09-12-ios-practice-parity-design.md`

## Global Constraints

- Target iPhone portrait only; retain safe areas, native back behavior, and 44×44 pt minimum touch targets.
- Synchronize UI, functional flow, and local data only; do not add account, cloud-history, or cross-platform membership work.
- Do not change question difficulty, scoring rules, payment rules, or the mirrored legacy core unless a failing same-source test proves drift.
- Do not add dependencies.
- All music symbols use shared geometry rather than font baselines.
- Beams connect notes only within the same beat and never across beats or barlines; hidden time-signature rows still receive the layout meter.
- Piano playback remains G3–A5, uses the packaged common samples and master volume, and has a 1.85-second note lifecycle.

---

### Task 1: Practice parity contract

**Files:**
- Create: `scripts/practice-parity-smoke.cjs`
- Modify: `package.json`
- Test: `scripts/practice-parity-smoke.cjs`

**Interfaces:**
- Consumes: mini-program `pages/practice/practice.wxml` labels and `pages/practice/practice.js` state behavior as the product reference.
- Produces: `npm run test:practice-parity`, a fast guard for required App states, controls, and component wiring.

- [ ] **Step 1: Write the failing contract**

Create a Node script that reads `src/app/practice.tsx`, `src/components/answer-staff.tsx`, `src/components/notation-editor.tsx`, `src/components/piano-keyboard.tsx`, and `src/services/audio-engine.ts`. Assert the practice source contains:

```js
const requiredPracticeContracts = [
  "type Phase = 'ready' | 'answering' | 'feedback' | 'finished'",
  '上一题', '回放答案', '下一题', '剩余 ', '音量',
  '播放题目后开始作答', '提交答案并解锁键盘',
  '正确答案：', '你的答案：', '复盘钢琴',
];
```

Also assert the source does not render `audioDiagnostic`, raw `operateAudio`, `jsapi`, or `access denied` text; assert `PianoKeyboard` receives the stored volume; assert timed notation forwards a layout meter to every continuation system.

- [ ] **Step 2: Verify the contract fails**

Run: `node scripts/practice-parity-smoke.cjs`

Expected: FAIL because previous-question restoration, uniform volume visibility, and one or more parity markers are not yet implemented.

- [ ] **Step 3: Register the command**

Add to `package.json`:

```json
"test:practice-parity": "node ./scripts/practice-parity-smoke.cjs"
```

- [ ] **Step 4: Verify existing checks remain green**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test:core`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
test: define iOS practice parity contract
```

---

### Task 2: Recoverable practice session and question navigation

**Files:**
- Modify: `src/app/practice.tsx`
- Modify: `src/services/local-data.ts`
- Modify: `scripts/local-data-smoke.cjs`
- Test: `scripts/practice-parity-smoke.cjs`
- Test: `scripts/local-data-smoke.cjs`

**Interfaces:**
- Consumes: `ExamQuestion`, `ExamAnswer`, existing practice records, and the four-phase model.
- Produces: per-question snapshots containing `answer`, `phase`, `correct`, `playCount`, and `highlights`; idempotent navigation and persistence.

- [ ] **Step 1: Add failing persistence checks**

Extend the smoke checks to require a versioned practice-session key and restoration of answered and unanswered snapshots. Assert repeated submission cannot increment the score or duplicate a wrongbook entry.

- [ ] **Step 2: Verify failure**

Run: `npm run test:storage`

Expected: FAIL on the missing practice-session persistence contract.

- [ ] **Step 3: Implement the minimal snapshot flow**

In `practice.tsx`, store one snapshot per question before navigation. Add a guarded `previous()` action, restore snapshots in both directions, and preserve feedback state for submitted questions. Persist only JSON-safe values needed to resume the active group; clear the snapshot when the result is completed or the user chooses “再来一组”.

Do not create a new state framework. Reuse existing local-data serialization and the current `submitting` ref for idempotency.

- [ ] **Step 4: Render native navigation actions**

In feedback, show “上一题” only when `index > 0`, then “回放答案” and “下一题/查看结果”. Every control must have an accessibility role, label, disabled state, and at least 44 pt height.

- [ ] **Step 5: Verify**

Run: `npm run test:storage`

Expected: PASS.

Run: `npm run test:practice-parity`

Expected: either PASS or only later-task assertions remain failing.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
feat: restore iOS practice question state
```

---

### Task 3: Playback, volume, interruption, and user-safe errors

**Files:**
- Modify: `src/app/practice.tsx`
- Modify: `src/services/audio-engine.ts`
- Modify: `src/core/audio-settings.ts`
- Test: `scripts/practice-parity-smoke.cjs`
- Test: `scripts/verify-sample-range.cjs`

**Interfaces:**
- Consumes: packaged piano sample map, stored master volume, `playQuestionAudio`, `playPianoNote`, and AppState lifecycle.
- Produces: a single volume path for question, answer replay, and piano; safe playback state transitions with no raw platform errors in UI.

- [ ] **Step 1: Add failing checks**

Assert all three playback entry points receive the normalized `volume / 100`; volume controls are present in ready, answering, and feedback states; AppState background cleanup clears timers and highlights; diagnostic strings are logged only in development and never rendered.

- [ ] **Step 2: Verify failure**

Run: `npm run test:practice-parity`

Expected: FAIL on at least the missing uniform volume or diagnostic boundary.

- [ ] **Step 3: Implement one audio-state path**

Keep the existing service API. Normalize volume once, pass it to question playback, replay, and `playPianoNote`, and persist it through the existing audio settings storage. On interruption or navigation blur, stop active audio, cancel standard-tone timers, clear highlights, and leave feedback answers intact.

Convert expected permission/interruption failures into the short message “音频暂时无法播放，请重试”; keep raw details out of rendered state.

- [ ] **Step 4: Keep controls visible and native**

Remove compact-mode conditions that hide volume. Retain compact spacing only. Use accessible decrement/increment controls and progress semantics without adding a custom slider dependency.

- [ ] **Step 5: Verify**

Run: `npm run test:sample-range`

Expected: PASS for all 27 G3–A5 samples and the 1.85-second renderer contract.

Run: `npm run test:practice-parity`

Expected: PASS for playback/error assertions.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
fix: unify iOS practice playback state
```

---

### Task 4: Pitch, chord, and connection answer parity

**Files:**
- Modify: `src/app/practice.tsx`
- Modify: `src/components/answer-staff.tsx`
- Modify: `src/core/staff-coordinate.ts`
- Modify: `src/core/music-notation.ts`
- Test: `scripts/practice-parity-smoke.cjs`
- Test: existing core and answer smoke commands

**Interfaces:**
- Consumes: question slots, spellings, chord stack limits, connection offsets, shared staff geometry.
- Produces: equivalent ready/answering/feedback views for single, group, interval, chord, chord-quality, chord-pitch, interval-connection, and adaptive-generated pitch questions.

- [ ] **Step 1: Add failing geometry and workflow assertions**

Require every pitch-mode render to expose the instruction text, empty-state text, completion state, correct/user answer summary, and teacher mark. Add assertions that connection groups cannot submit until every group slot is filled.

- [ ] **Step 2: Verify failure**

Run: `npm run test:practice-parity`

Expected: FAIL on missing compact-mode information or incomplete connection behavior.

- [ ] **Step 3: Align the answer presentation**

Remove compact-mode behavior that drops required information. Keep compact dimensions where they do not hide labels or controls. Match the mini-program's answer nouns, empty prompts, quality-then-inversion order, and feedback summary.

- [ ] **Step 4: Keep geometry shared**

Use `staff-coordinate.ts` for line/space positions and final pixel rounding. Do not add per-device offsets. Ensure whole-note heads, accidentals, stems, ledger lines, barlines, and end lines derive from the same staff top and line gap.

- [ ] **Step 5: Verify**

Run: `npm run test:answers`

Expected: PASS.

Run: `npm run test:core`

Expected: PASS.

Run: `npm run test:practice-parity`

Expected: PASS for pitch/chord/connection assertions.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
feat: align iOS pitch answer workflow
```

---

### Task 5: Rhythm and melody editor parity

**Files:**
- Modify: `src/components/notation-editor.tsx`
- Modify: `src/components/answer-staff.tsx`
- Modify: `src/core/music-notation.ts`
- Modify: `src/app/practice.tsx`
- Test: `scripts/practice-parity-smoke.cjs`
- Test: existing core and answer smoke commands

**Interfaces:**
- Consumes: `ExamAnswer.events`, meter, key signature, duration selection, undo, and shared notation geometry.
- Produces: two-measure systems with complete input prerequisites, beat-local beams, continuation layout meter, and comparable correct/user systems.

- [ ] **Step 1: Add failing timed-notation checks**

Require meter selection before rhythm writing; meter plus key selection before melody writing; duration toolbar, undo action, two-measure system splitting, and `beamMeter`/equivalent layout meter on continuation systems.

- [ ] **Step 2: Verify failure**

Run: `npm run test:practice-parity`

Expected: FAIL on any missing prerequisite, continuation-meter, or comparison contract.

- [ ] **Step 3: Implement the minimal editor alignment**

Keep the current editor component. Match tool ordering and disabled states to the mini-program; preserve entered events while changing duration; make undo remove only the last entered event. Render user and standard systems from the same system splitter.

- [ ] **Step 4: Enforce notation semantics**

Pass the full meter to layout on every row, even when its label is hidden. Derive beam groups from measure-local accumulated duration and flush on beat or barline change. Apply final pixel rounding only at the SVG boundary.

- [ ] **Step 5: Verify**

Run: `npm run test:answers`

Expected: PASS.

Run: `npm run test:core`

Expected: PASS.

Run: `npm run test:practice-parity`

Expected: PASS for timed notation assertions.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
feat: align iOS timed notation workflow
```

---

### Task 6: Feedback, review piano, and completion parity

**Files:**
- Modify: `src/app/practice.tsx`
- Modify: `src/components/piano-keyboard.tsx`
- Test: `scripts/practice-parity-smoke.cjs`
- Test: `scripts/verify-sample-range.cjs`

**Interfaces:**
- Consumes: submitted answer snapshots, correctness, highlights, sample playback, practice and wrongbook persistence.
- Produces: locked/unlocked piano behavior, synchronized highlights, stable result summary, and correct continuation routes.

- [ ] **Step 1: Add failing feedback checks**

Require locked piano accessibility text before submission, unlocked state after submission, 1.85-second manual key playback, highlight cleanup, previous/replay/next actions, result counts, wrongbook message, “再来一组/再练一次”, and destination-aware return.

- [ ] **Step 2: Verify failure**

Run: `npm run test:practice-parity`

Expected: FAIL on any missing feedback or completion contract.

- [ ] **Step 3: Align feedback and piano behavior**

Keep the piano component stateless apart from press feedback. Drive lock, highlights, and sound from the practice screen. Ensure repeated key taps replace the earlier highlight timer and question playback disables manual keys.

- [ ] **Step 4: Align completion behavior**

Calculate accuracy once from finalized snapshots, avoid duplicate records, clear resumable session data, and route wrongbook-origin practice back to wrongbook while normal practice returns home.

- [ ] **Step 5: Verify**

Run: `npm run test:sample-range`

Expected: PASS.

Run: `npm run test:storage`

Expected: PASS.

Run: `npm run test:practice-parity`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
feat: complete iOS practice feedback parity
```

---

### Task 7: Full regression and bounded native visual verification

**Files:**
- Modify only files proven defective by the first visual pass.
- Test: all package checks and iOS simulator screenshots.

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: verified practice-core release candidate and a concise list of remaining out-of-scope differences.

- [ ] **Step 1: Run the complete automated suite**

Run each command separately:

```text
npm run typecheck
npm run lint
npm run test:core
npm run test:provinces
npm run test:answers
npm run test:storage
npm run test:province-tier
npm run test:sample-range
npm run test:practice-parity
npm run export:web
```

Expected: every command exits 0.

- [ ] **Step 2: First visual pass**

Build and inspect every supported practice entry mode at ready, answering, feedback, and finished states on one Dynamic-Island iPhone and one narrow iPhone simulator. Batch defects by component; check safe areas, 44 pt targets, truncation, staff clipping, keyboard overlays, large text, and Reduce Motion.

- [ ] **Step 3: Apply one batched correction**

Change only defects observed in Step 2. Do not redesign approved surfaces or add polish unrelated to parity.

- [ ] **Step 4: Confirmation pass**

Rebuild once and confirm the corrected states on both device classes. Capture evidence from the iOS simulator, not the web preview.

- [ ] **Step 5: Commit**

```text
fix: finish iOS practice parity verification
```

- [ ] **Step 6: Prepare TestFlight handoff**

Report the tested commit, passed commands, simulator device classes, known out-of-scope differences, and the specific real-device checks for the user: audio timbre, touch drag accuracy, interruption recovery, and local-data restoration.
