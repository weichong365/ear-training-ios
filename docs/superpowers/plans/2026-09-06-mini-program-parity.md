# 小程序优化同步至 iOS App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 iOS App 的训练、界面、题库、音频、答题和批改行为与当前小程序一致，同时保留 Apple 订阅和 iOS 本地数据。

**Architecture:** 小程序源码作为产品行为参照，题库及省份规则同步到现有共享核心，React Native 页面继续使用已有组件与 iOS 服务。生成题目的 MIDI、拼写、节奏和调拍号作为音频、谱面、文本与判分的唯一数据源；微信专用 API 不进入 App。

**Tech Stack:** Expo SDK 57、React Native 0.86、Expo Router、TypeScript、expo-audio、react-native-svg、AsyncStorage、Node.js assert 冒烟测试。

**Spec:** `docs/superpowers/specs/2026-09-06-mini-program-parity-design.md`

## Global Constraints

- 保留 `src/services/subscription.tsx` 的 Apple 订阅与权限判断。
- 不接入微信邀请、微信云函数、微信身份、微信云同步或微信支付。
- 不新增 npm 依赖，不修改 App bundle id、版本号或 Codemagic 发布配置。
- 保留现有未提交修改并逐项验证，不提交 `app-store-pages/`。
- 任何生成题目的 MIDI 必须位于 G3–A5（55–81）采样范围。
- 谱面、音频、答案文本和判分必须消费同一题目数据。
- 写生产代码前先运行对应失败检查；完成前运行全部现有检查。
- 写 Expo 代码前阅读 `https://docs.expo.dev/versions/v57.0.0/` 下对应的 Router、Audio 与 AppState 文档。

---

### Task 1: 固化当前工作区并同步题库与省份规则

**Files:**
- Modify: `scripts/core-smoke.cjs`
- Modify: `scripts/province-smoke.cjs`
- Modify: `scripts/verify-province-tier.cjs`
- Modify: `src/core/legacy/question.js`
- Modify: `src/core/legacy/province-frameworks.js`
- Modify: `src/core/legacy/choice-paper.js`
- Modify: `src/core/legacy/pcm-renderer.js`
- Modify: `src/core/provinces.ts`
- Reference: `../utils/question.js`
- Reference: `../utils/province-frameworks.js`
- Reference: `../subpackages/exam/data/province-frameworks.js`
- Reference: `../utils/choice-paper.js`
- Reference: `../utils/pcm-renderer.js`
- Reference: `../tests/core.test.js`
- Reference: `../tests/province-frameworks.test.js`

**Interfaces:**
- Consumes: `generateSet(type, count, profile, options)`, `generateExamFromSections(sections)`, `getProvinceFramework(id, random)` from the legacy core.
- Produces: App-wide `PracticeQuestion` / `ExamQuestion` objects whose MIDI, spellings, timing, repeat count and answer text match the mini program rules.

- [ ] **Step 1: Add failing generator distribution checks**

Add deterministic loops to `scripts/core-smoke.cjs` that assert:

```js
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
for (let run = 0; run < 100; run += 1) {
  const singles = questionCore.generateSet('single', 10);
  const altered = singles.filter((q) => BLACK_KEYS.has(q.midis[0] % 12));
  assert.ok(altered.length >= 1 && altered.length <= 2);
  assert.equal(new Set(singles.map((q) => q.midis[0])).size, 10);
}
const exam = questionCore.generateExamMixed();
assert.equal(exam.slice(0, 5).filter((q) => BLACK_KEYS.has(q.midis[0] % 12)).length, 1);
```

Add checks for note groups (`Math.abs(next - previous) <= 9`, no duplicates, at most one altered note), chord sets (exact 5/3/2 inversions per ten, approximately 30% augmented/diminished across repeated sets), and melody keys limited to `C`, `G`, `F`.

- [ ] **Step 2: Run the focused checks and verify the baseline**

Run: `npm run test:core`

Expected before retaining the pending generator sync: at least one new assertion fails against the committed baseline, demonstrating the old distribution differs from the current mini program.

- [ ] **Step 3: Compare and retain only product-rule changes**

Use no-index diffs between each reference file and its `src/core/legacy/` counterpart. Retain the current pending changes for:

```text
single set: 10 unique, 1–2 altered; exam five with exactly one altered
note group: unique, maximum 9-semitone step, at most one altered at 25% chance
chord set: four triad qualities, inversion counts 5/3/2, 30% augmented/diminished
melody keys: C/G/F only
labels: 听记
```

Do not port `wx.*`, file-system cache paths, invite logic or cloud persistence.

- [ ] **Step 4: Verify province generation and sampling**

Run:

```text
npm run test:core
npm run test:provinces
npm run test:province-tier
npm run test:sample-range
```

Expected: all commands exit 0; every province/year has correct question count, score sum, repeat count, answer text and playable timeline; all generated MIDI values remain 55–81.

- [ ] **Step 5: Commit the isolated core parity change**

Stage only the Task 1 files and commit with:

```text
feat: sync iOS question rules with mini program
```

---

### Task 2: 对齐答案模型、五线谱输入与判分

**Files:**
- Modify: `scripts/answer-smoke.mjs`
- Modify: `src/core/exam-answer.ts`
- Modify: `src/core/answer-sync.ts`
- Modify: `src/core/pitch-spelling.ts`
- Modify: `src/core/staff-coordinate.ts`
- Modify: `src/core/music-notation.ts`
- Modify: `src/components/answer-staff.tsx`
- Modify: `src/components/notation-editor.tsx`
- Reference: `../pages/practice/practice.js`
- Reference: `../components/answer-staff/answer-staff.js`
- Reference: `../components/staff-layout.js`
- Reference: `../tests/practice-staff.test.js`
- Reference: `../tests/exam-flow.test.js`

**Interfaces:**
- Consumes: `ExamQuestion`, `ExamAnswer`, written MIDI spellings and `NotationEvent[]`.
- Produces: `answerIsComplete`, `scoreQuestion`, `practiceAnswerCorrect`, `formatExamAnswer`, `formatCorrectAnswer` and controlled `AnswerStaff` / `NotationEditor` interactions.

- [ ] **Step 1: Add failing parity cases to `scripts/answer-smoke.mjs`**

Add assertions covering all input models:

```js
assert.equal(durationNotation(4).headKind, 'whole');
assert.equal(durationNotation(4).hasStem, false);
assert.equal(practiceAnswerCorrect(melodicInterval, orderedAnswer), true);
assert.equal(practiceAnswerCorrect(melodicInterval, reversedAnswer), false);
assert.equal(practiceAnswerCorrect(harmonicInterval, reversedAnswer), true);
assert.equal(practiceAnswerCorrect(chordQuestion, shuffledChordAnswer), true);
assert.equal(answerIsComplete(qualityQuestion, qualityWithoutInversion), false);
assert.equal(answerIsComplete(qualityQuestion, qualityAndInversion), true);
```

Also assert rest events survive local normalization, bar indices affect timed grading, G/F key-signature spellings display correctly, and the formatted correct answer uses the same spelling as the rendered note.

- [ ] **Step 2: Run and verify the new checks fail for missing parity**

Run: `npm run test:answers`

Expected: new cases that expose any remaining mismatch fail for that specific mismatch, not for import or syntax errors.

- [ ] **Step 3: Apply the smallest shared-core fixes**

Keep answer comparison centralized:

```ts
const pitchCorrect = question.harmonic || question.type === 'chord'
  ? sameUnorderedMidis(answer.pitches, targetPitches(question))
  : sameOrderedMidis(answer.pitches, targetPitches(question));
```

Ensure basic questions generate four-beat display events, ordered answer slots retain `inputSlot`, stacked events keep all chord MIDI values together, and key-signature accidentals come from the existing pitch-spelling helpers. Do not duplicate pitch-name conversion in components.

- [ ] **Step 4: Align controlled staff interactions**

In `AnswerStaff`, preserve the current slot when dragging, update spelling and accidental together, and make erase remove the selected slot/stack only. In `NotationEditor`, reject events that exceed the current bar capacity and preserve negative-duration rests through normalized `{ duration: abs, rest: true }` events.

- [ ] **Step 5: Verify answer and storage compatibility**

Run:

```text
npm run test:answers
npm run test:storage
npm run typecheck
```

Expected: current and legacy chord-quality answers score correctly; timed answers respect bars; old stored records load without throwing.

- [ ] **Step 6: Commit the isolated answer parity change**

Stage only Task 2 files and commit with:

```text
fix: align iOS staff answers and grading
```

---

### Task 3: 对齐播放生命周期与回放语义

**Files:**
- Create: `src/core/playback-policy.ts`
- Create: `scripts/playback-smoke.mjs`
- Modify: `package.json`
- Modify: `src/services/audio-engine.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/practice.tsx`
- Modify: `src/app/exam-paper.tsx`
- Reference: `../utils/native-audio-engine.js`
- Reference: `../pages/practice/practice.js`
- Reference: `../tests/practice-flow.test.js`
- Reference: `../tests/audio-scheduling.test.js`

**Interfaces:**
- Produces: `canStartPlayback({ playing, preparing, submitted, playCount, repeatCount }): boolean` and `remainingPlayCount(playCount, repeatCount): number`.
- Consumes: existing `playQuestionAudio(question, volume, callbacks)`, `stopQuestionAudio()` and page phase state.

- [ ] **Step 1: Create the failing playback policy test**

Create `scripts/playback-smoke.mjs` with real policy assertions:

```js
assert.equal(canStartPlayback({ playing: false, preparing: false, submitted: false, playCount: 0, repeatCount: 3 }), true);
assert.equal(canStartPlayback({ playing: true, preparing: false, submitted: false, playCount: 0, repeatCount: 3 }), false);
assert.equal(canStartPlayback({ playing: false, preparing: true, submitted: false, playCount: 0, repeatCount: 3 }), false);
assert.equal(canStartPlayback({ playing: false, preparing: false, submitted: false, playCount: 3, repeatCount: 3 }), false);
assert.equal(canStartPlayback({ playing: false, preparing: false, submitted: true, playCount: 3, repeatCount: 3 }), true);
```

Add `"test:playback": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ./scripts/playback-smoke.mjs"` to `package.json` only after the test file exists.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:playback`

Expected: FAIL because `src/core/playback-policy.ts` does not exist.

- [ ] **Step 3: Implement the minimal shared policy**

```ts
export function canStartPlayback(state: PlaybackState) {
  if (state.playing || state.preparing) return false;
  return state.submitted || state.playCount < state.repeatCount;
}

export function remainingPlayCount(playCount: number, repeatCount: number) {
  return Math.max(0, repeatCount - playCount);
}
```

Consume the helper from practice and exam pages so both enforce the same rule.

- [ ] **Step 4: Align audio state transitions**

Read the Expo SDK 57 Audio and AppState documentation, then ensure:

```text
prepare/start failure -> clear preparing and playing
successful start -> unlock answering and increment count once
finish/interruption/error -> clear playing once
screen blur/background -> stop current question audio
feedback/submitted -> unlimited replay, no overlap
```

Keep A4 standard tone and the existing question timeline as the only source for playback order. Do not add mini-program WAV cache behavior.

- [ ] **Step 5: Verify playback and existing core checks**

Run:

```text
npm run test:playback
npm run test:answers
npm run test:core
npm run typecheck
```

Expected: all exit 0 and no page can start a second question audio while one is preparing or playing.

- [ ] **Step 6: Commit the isolated playback parity change**

Stage only Task 3 files and commit with:

```text
fix: synchronize iOS question playback states
```

---

### Task 4: 同步专项训练和模拟考试界面状态

**Files:**
- Create: `scripts/training-ui-smoke.cjs`
- Modify: `package.json`
- Modify: `src/app/practice.tsx`
- Modify: `src/app/exam-paper.tsx`
- Modify: `src/components/teacher-grade-mark.tsx`
- Modify: `src/components/answer-staff.tsx`
- Modify: `src/components/notation-editor.tsx`
- Reference: `../pages/practice/practice.wxml`
- Reference: `../pages/practice/practice.wxss`
- Reference: `../subpackages/exam/pages/exam/exam.wxml`
- Reference: `../subpackages/exam/pages/exam/exam.wxss`

**Interfaces:**
- Consumes: core answer functions, playback policy, controlled staff components and theme constants.
- Produces: four-state practice flow (`ready`, `answering`, `feedback`, `finished`) and submitted/unsubmitted exam-paper UI.

- [ ] **Step 1: Create failing source-level UI contract checks**

Create `scripts/training-ui-smoke.cjs` that reads the relevant TSX files and asserts durable product contracts rather than exact layout strings:

```js
assert.match(practice, /type Phase = 'ready' \| 'answering' \| 'feedback' \| 'finished'/);
assert.match(practice, /phase === 'feedback'.*不限次数/s);
assert.match(practice, /TeacherGradeMark/);
assert.match(practice, /showCorrect=\{phase === 'feedback' && !correct\}/);
assert.match(exam, /question\.repeatCount/);
assert.match(exam, /submitted/);
assert.doesNotMatch(exam, /\/ 2/);
```

Add checks that single/group/interval/chord answers use `AnswerStaff`, timed answers use `NotationEditor`, and incorrect timed answers render a separate correct staff.

- [ ] **Step 2: Run and verify RED**

Add `"test:training-ui": "node ./scripts/training-ui-smoke.cjs"`, then run `npm run test:training-ui`.

Expected: at least one assertion fails for a known remaining mini-program parity gap.

- [ ] **Step 3: Implement practice-screen parity**

Use the existing visual system and compact components to align:

```text
ready: play enabled, staff disabled
answering: staff enabled, piano disabled, submit gated by answerIsComplete
feedback: answer frozen, piano and unlimited answer replay enabled, red/green review visible
finished: score, correct count, wrong count, retry and return actions
```

Keep whole notes for single/group/interval/chord, split chord quality and inversion only when required, and use “听记” wording throughout.

- [ ] **Step 4: Implement exam-paper parity**

Keep questions in a single vertical flow, use each question's `repeatCount`, prevent answer input before first successful play, and after submission retain the candidate answer while showing a separated standard answer. Use `TeacherGradeMark` for the handwritten result mark and keep the submitted replay path unlimited.

- [ ] **Step 5: Verify UI contracts and compilation**

Run:

```text
npm run test:training-ui
npm run test:answers
npm run typecheck
npm run lint
```

Expected: all exit 0 with no TypeScript or lint errors.

- [ ] **Step 6: Commit the isolated training UI change**

Stage only Task 4 files and commit with:

```text
feat: match iOS training flow to mini program
```

---

### Task 5: 同步首页、省份、统计与错题本

**Files:**
- Create: `src/core/practice-stats.ts`
- Create: `scripts/practice-stats-smoke.mjs`
- Modify: `package.json`
- Modify: `src/app/index.tsx`
- Modify: `src/app/province-select.tsx`
- Modify: `src/app/stats.tsx`
- Modify: `src/app/wrongbook.tsx`
- Modify: `src/services/local-data.ts`
- Reference: `../pages/index/index.js`
- Reference: `../pages/index/index.wxml`
- Reference: `../pages/index/index.wxss`
- Reference: `../pages/province-select/province-select.js`
- Reference: `../pages/stats/stats.js`
- Reference: `../pages/stats/stats.wxml`
- Reference: `../pages/wrongbook/wrongbook.js`
- Reference: `../pages/wrongbook/wrongbook.wxml`
- Reference: `../services/db.js`

**Interfaces:**
- Consumes: `PracticeRecord[]`, `WrongRecord[]`, `ExamResultRecord[]`, `ProvinceId` and `getProvincePracticeModules(id)`.
- Produces: `aggregatePracticeStats(records, now)` for shared homepage/statistics values and resilient screen loading states.

- [ ] **Step 1: Add failing aggregate tests**

Create `scripts/practice-stats-smoke.mjs` with records across multiple days and sessions:

```js
const stats = aggregatePracticeStats(records, new Date('2026-09-06T12:00:00+08:00'));
assert.equal(stats.totalQuestions, 4);
assert.equal(stats.accuracy, 75);
assert.equal(stats.sessions, 2);
assert.equal(stats.streak, 2);
assert.equal(stats.byType.single.attempts, 2);
assert.equal(stats.trend7day.length, 7);
```

Add `"test:stats": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ./scripts/practice-stats-smoke.mjs"`.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:stats`

Expected: FAIL because `aggregatePracticeStats` does not exist.

- [ ] **Step 3: Implement one shared aggregate**

Implement a pure `aggregatePracticeStats` that derives total questions, correct count, accuracy, session count, streak, per-type attempts/accuracy/error rate, seven-day trend and recent sessions. Do not add remote sync or identifiers.

- [ ] **Step 4: Align homepage and province selection**

Use the shared aggregate for homepage totals. Keep the current province visible, show whether it uses a dedicated or national template, remove redundant difficulty controls, keep training cards in a compact two-column grid, and route the selected province/tier to practice or exam without changing subscription gates.

- [ ] **Step 5: Add resilient statistics and wrongbook states**

For both screens maintain explicit `loading`, `error`, and loaded data state. In each `useFocusEffect`, use a local `active` flag so a finished AsyncStorage request cannot update an unfocused screen:

```ts
let active = true;
void load().then((value) => { if (active) setValue(value); })
  .catch(() => { if (active) setError(true); });
return () => { active = false; };
```

Wrongbook items must show answer, user's last answer, error count, recent date and a reinforce action only when the stored question can be regenerated safely.

- [ ] **Step 6: Verify statistics, storage and UI compilation**

Run:

```text
npm run test:stats
npm run test:storage
npm run test:province-tier
npm run typecheck
npm run lint
```

Expected: all exit 0; empty, failure and populated states remain reachable without stale updates.

- [ ] **Step 7: Commit the isolated dashboard parity change**

Stage only Task 5 files and commit with:

```text
feat: sync iOS training dashboard and review pages
```

---

### Task 6: 全量回归、Web 视觉检查与交付

**Files:**
- Modify only if a failing check identifies a root cause in an earlier task file.
- Do not modify: `src/services/subscription.tsx`, `app.json`, `codemagic.yaml`, `app-store-pages/`.

**Interfaces:**
- Consumes: every task deliverable.
- Produces: verified iOS source ready for a TestFlight build and final device QA checklist.

- [ ] **Step 1: Run all automated checks**

Run:

```text
npm run typecheck
npm run lint
npm run test:core
npm run test:provinces
npm run test:answers
npm run test:playback
npm run test:training-ui
npm run test:stats
npm run test:storage
npm run test:province-tier
npm run test:sample-range
npm run doctor
```

Expected: every command exits 0. If any command fails, use systematic debugging and fix only the demonstrated root cause before rerunning the affected check.

- [ ] **Step 2: Export the web build to a disposable directory**

Run: `npx expo export --platform web --output-dir dist-parity-check`

Expected: all Expo Router routes export successfully with no bundling error. Remove only `dist-parity-check` after inspection; do not touch pre-existing `dist-check`.

- [ ] **Step 3: Inspect critical screens at phone width**

Check homepage, province selection, one basic practice question, one timed question, exam paper, wrongbook and stats. Verify no clipping, overlapping bottom actions, hidden staff controls, unreadable red/green feedback or touch targets below 44pt.

- [ ] **Step 4: Review the final diff for scope**

Confirm:

```text
Apple subscription unchanged
no wx.* API or cloud code in ios-app
no new dependency
no app-store-pages staged
no signing/version/config changes
```

- [ ] **Step 5: Commit only verified regression fixes**

If Task 6 required fixes, commit those exact files with:

```text
fix: complete iOS mini program parity regression
```

- [ ] **Step 6: Prepare device QA**

Record a concise TestFlight checklist for standard tone, all seven answer models, foreground/background interruption, replay limits, staff dragging, accidental editing, timed bar capacity, correct-answer overlays, wrongbook removal and statistics refresh. Do not push or start Codemagic until the user explicitly authorizes publishing the new commits.
