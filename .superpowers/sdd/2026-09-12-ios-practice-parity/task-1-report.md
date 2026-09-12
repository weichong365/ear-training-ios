# Task 1: Practice parity contract

## Status

Implemented the practice parity smoke contract and registered `npm run test:practice-parity`.

## Changes

- Added `scripts/practice-parity-smoke.cjs`.
- Added the `test:practice-parity` npm script.
- The smoke contract checks required practice phase/label markers, rejects legacy audio/debug text, requires stored volume wiring to `PianoKeyboard`, and requires layout-meter forwarding for continuation systems.

## Verification

- `node scripts/practice-parity-smoke.cjs` — expected FAIL: the current implementation is missing the `上一题` marker; the contract also captures the missing stored-volume prop wiring.
- `npm run typecheck` — PASS.
- `npm run test:core` — PASS.

## Concerns

The parity smoke test is intentionally red until the practice implementation adds previous-question restoration and passes stored volume to `PianoKeyboard`. No question/scoring/audio-core behavior was changed.

## Review fix round 1

Addressed all review findings:

- Previous-question parity now requires a `previous()` handler, decrementing index, answer restoration, and a `上一题` Pressable wired to that handler.
- Volume visibility now rejects the existing compact-feedback conditional and requires an unconditional volume row.
- `PianoKeyboard` volume matching is bounded to its opening tag.
- Every rendered `TimedAnswerStaff` opening tag is enumerated and checked for layout-meter forwarding and continuation display-meter behavior, including standard-answer rendering.
- Forbidden audio/debug checks inspect only rendered text/accessibility JSX paths after removing comments.

Covering test file: `scripts/practice-parity-smoke.cjs`

Exact commands and relevant outputs:

```text
node scripts/practice-parity-smoke.cjs
exit=1
AssertionError [ERR_ASSERTION]: practice parity marker missing: 上一题

npm run typecheck
exit=0
tsc --noEmit

npm run test:core
exit=0
核心冒烟测试通过：题目去重、和弦同时起音与难度比例、四句式旋律和音频渲染均正常。
```

## Review fix round 3

Replaced the remaining restoration and volume regexes with TypeScript compiler-API AST contracts. The checks now require real function declarations/calls, indexed snapshot capture, all five state restorations, a concrete volume-row initializer with controls and value wiring, and exactly one ungated JSX insertion. No production code changed.

Covering test file: `scripts/practice-parity-smoke.cjs`

Exact commands and relevant outputs:

```text
node scripts/practice-parity-smoke.cjs
exit=1
AssertionError [ERR_ASSERTION]: practice parity marker missing: 上一题

npm run typecheck
exit=0
tsc --noEmit

npm run test:core
exit=0
核心冒烟测试通过：题目去重、和弦同时起音与难度比例、四句式旋律和音频渲染均正常。
```

## Review fix round 2

Strengthened the contract so later implementation cannot satisfy it with inert labels or a differently spelled conditional:

- Previous-question restoration now requires `questionSnapshots[index - 1]` lookup, a `restorePracticeSnapshot` call path, and restoration of `answer`, `phase`, `correct`, `playCount`, and `highlights`.
- Volume controls now require a named `volumeRow` render value containing the volume row and unconditional `{volumeRow}` insertion after the play control.

Covering test file: `scripts/practice-parity-smoke.cjs`

Exact commands and relevant outputs:

```text
node scripts/practice-parity-smoke.cjs
exit=1
AssertionError [ERR_ASSERTION]: practice parity marker missing: 上一题

npm run typecheck
exit=0
tsc --noEmit

npm run test:core
exit=0
核心冒烟测试通过：题目去重、和弦同时起音与难度比例、四句式旋律和音频渲染均正常。
```

## Review fix round 4

Addressed both remaining findings without changing production code:

- Snapshot capture now requires an assignment to the current index of the same lexically bound `questionSnapshots` collection used by restoration. Both direct collections and `.current` refs are accepted, with matching access on capture and restore. The assigned snapshot must contain all five fields, either inline or through a bound object initializer.
- Restoration resolves the called helper and snapshot variable through TypeScript symbols, then requires the exact `answer -> setAnswer`, `phase -> setPhase`, `correct -> setCorrect`, `playCount -> setPlayCount`, and `highlights -> setHighlights` mapping. The previous handler passes `index - 1`, and either it or the restore helper must update the bound index setter to that target. The previous button must use that handler.
- `volumeRow` must be a component-local constant initialized directly with a React Native `View`. Actual child `Pressable` handlers must call the component's `changeVolume` with the stored volume plus/minus a positive step. The row must render the volume label, percentage, track, and fill tied to that same volume binding.
- Exactly one reference to the bound row must be inserted directly in the rendered practice card after its play control. Conditional/logical initializers, gated insertions, and same-name bindings in other scopes cannot satisfy the checks. The existing finished/practice page switch remains valid.
- Added a reproducible AST probe artifact in this report directory: `task-1-r4-probes.cjs`. It checks five valid fixtures and rejects thirty mutations; all fixtures are parsed as valid TSX before exercising the contract.

Exact commands and outputs (working directory: `F:\WorkBuddy\练耳大师\ios-app\.worktrees\ios-practice-parity`):

```text
node .superpowers/sdd/2026-09-12-ios-practice-parity/task-1-r4-probes.cjs
exit=0
practice parity AST probes passed (5 valid fixtures, 30 rejected mutations)

node scripts/practice-parity-smoke.cjs
exit=1
node:internal/assert/utils:77
    throw err;
    ^

AssertionError [ERR_ASSERTION]: practice parity marker missing: 上一题
    at Object.<anonymous> (F:\WorkBuddy\练耳大师\ios-app\.worktrees\ios-practice-parity\scripts\practice-parity-smoke.cjs:33:10)
    at Module._compile (node:internal/modules/cjs/loader:1760:14)
    at Object..js (node:internal/modules/cjs/loader:1892:10)
    at Module.load (node:internal/modules/cjs/loader:1480:32)
    at Module._load (node:internal/modules/cjs/loader:1299:12)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v25.2.1

npm run typecheck
exit=0
> ear-training-buddy-ios@1.0.0 typecheck
> tsc --noEmit

npm run test:core
exit=0
> ear-training-buddy-ios@1.0.0 test:core
> node ./scripts/core-smoke.cjs

核心冒烟测试通过：题目去重、和弦同时起音与难度比例、四句式旋律和音频渲染均正常。
```

Self-review: inspected the full diff against both findings, verified no production files changed, and confirmed the positive fixtures accept both snapshot storage forms and the real finished-page conditional. The mutation probes cover each field mapping, missing/wrong index updates, missing/wrong capture assignments, native/component/state shadowing, absent handlers, gated row initializers/insertions, duplicate insertions, and a disconnected previous button. The contract remains a focused structural smoke check, not a runtime proof of every control-flow path; later-task parity gaps intentionally keep the application smoke test red.

## Review fix round 5 (final allowed round)

Addressed the two open round-4 findings with changes only to the contract, its existing probes, and this report:

- The restore helper must not overwrite a field after restoring it, or call the bound `resetQuestionState` after restoration begins. The caller must not reset or overwrite any of the five saved fields after the restore call. Reset/guard logic before restoration remains valid, including an early-return fallback for a missing snapshot.
- The volume card's complete ancestry to the component return is now checked. JSX containers and parentheses are allowed, along with at most one switch whose condition is the bound `phase === 'finished'` and whose practice branch contains the card. Any extra conditional/logical gate is rejected.
- Preserved all 5 existing positive fixtures and all 30 mutations. Added 4 positive fixtures for prior reset/guard flow, a fragment in the practice branch, and an ungated card. Added the requested reset-in-helper, post-restore answer overwrite, post-restore phase overwrite, hidden ternary card, and hidden logical card mutations, plus 5 related regression cases. The two overwrite examples are separate probes.
- The existing probe runner now reports all missed mutations together, so a failure cannot hide the remaining review examples.

Exact commands and relevant outputs (working directory: `F:\WorkBuddy\练耳大师\ios-app\.worktrees\ios-practice-parity`):

```text
# Before changing the contract: reproduced the findings with the added probes.
node .superpowers/sdd/2026-09-12-ios-practice-parity/task-1-r4-probes.cjs
exit=1
AssertionError [ERR_ASSERTION]: all positive fixtures must pass and every mutation must be rejected
actual: [
  'valid fixture 6: previous must not reset the restored snapshot',
  'Missing expected exception (AssertionError): reset inside restore helper',
  'Missing expected exception (AssertionError): answer overwritten after restore',
  'Missing expected exception (AssertionError): phase overwritten after restore',
  'Missing expected exception (AssertionError): conditional card ancestor',
  'Missing expected exception (AssertionError): logical card ancestor',
  'Missing expected exception (AssertionError): answer overwritten inside restore helper',
  'Missing expected exception (AssertionError): phase overwritten inside restore helper',
  'Missing expected exception (AssertionError): wrong card switch',
  'Missing expected exception (AssertionError): nested finished switches'
]

# After the contract fix.
node .superpowers/sdd/2026-09-12-ios-practice-parity/task-1-r4-probes.cjs
exit=0
practice parity AST probes passed (9 valid fixtures, 40 rejected mutations)

node scripts/practice-parity-smoke.cjs
exit=1
AssertionError [ERR_ASSERTION]: practice parity marker missing: 上一题

npm run typecheck
exit=0
> ear-training-buddy-ios@1.0.0 typecheck
> tsc --noEmit

npm run test:core
exit=0
> ear-training-buddy-ios@1.0.0 test:core
> node ./scripts/core-smoke.cjs
核心冒烟测试通过：题目去重、和弦同时起音与难度比例、四句式旋律和音频渲染均正常。
```

Self-review: checked the full diff and both open findings against all new and retained fixtures. State-write ordering uses the same lexical symbols as the existing restoration contract, and ancestor checks inspect only the card's render path, leaving unrelated conditions in card content valid. The change is a structural guard for the declared handler/helper shape; it does not claim arbitrary control-flow or indirect side-effect execution analysis. No production files changed. The application parity smoke remains intentionally red on the genuine later-task `上一题` gap.
