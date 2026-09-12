# Final practice-parity fixes

Date: 2026-09-12

Workspace: `F:\WorkBuddy\练耳大师\ios-app\.worktrees\ios-practice-parity`

Base: `fc663c503670c784e72b85c8a88f522dca449a6b`

Product/test commit: `28ff0dd2d69c55006e932179bae55c0b030b15b8` — `fix: resolve final iOS practice parity regressions`

All five supplied findings are addressed and have passing regressions. Final controller review is pending. No question generation, scoring, shared staff geometry, dependencies, payment behavior or remote services were changed.

## Fixes and red/green evidence

| Finding | Production change | Regression and observed initial failure |
| --- | --- | --- |
| Negative rest durations disappear on restore | `normalizeAnswer` accepts finite nonzero signed durations and restores rest semantics when the duration is negative. Zero and nonfinite values remain invalid. | `npm run test:storage` initially failed on `rhythm answering` because the restored sequence omitted both rests. The actual storage service now round-trips rhythm and melody in answering and feedback, preserving pitch/rest order, durations, bar indices and input order. |
| Stale question seek operates on a new player | The request retains its player, checks generation and instance after seek and start waits, guards listener callbacks, and only clears its own start cancellation. A stale finalize cannot clear the current watchdog. Current failures use the same cleanup path. | `node scripts/audio-lifecycle-smoke.cjs` initially failed with B's play count `2 !== 1` for A seek → stop → B → A return. Tests now also cover a stop between a native start event and promise resumption, late A events, B cancellation ownership, and current-request completion. |
| Connection wrongbook flow is broken | All incorrect questions can be saved. Wrongbook grouping includes all supported practice keys. A stored `connection` group restores `question.type` as `intervalConnection`, including previously normalized stored questions. | `npm run test:storage` first failed on absent saved connection, then on `connection` instead of `intervalConnection`. `npm run test:practice-parity` failed on the missing wrongbook group. The real service and screen handlers now pass incorrect submission → stored group → wrongbook navigation → original connection groups → correctly retried submission → removal at completion. Group-order scoring is unchanged. |
| Piano states rely only on color | White and black keys show ✓ correct, × wrong, ▶ playing, and ● reference marks, with a visible legend and dynamic accessibility values. A derived, stateless effect sends current note/state announcements through the native accessibility API. | `npm run test:practice-parity` initially failed because C4 had no visible correct marker. Components now verify all four marks on white/black keys, state values, requested announcements, silence while locked/playing question audio, and the cleared playback state. |
| Manual highlight starts before sample loading finishes | The piano service signals actual native start/end; the practice screen sets/restores highlights from those callbacks. The 1.85-second disposal timer starts at the native playing event. Native failure, start timeout, cancellation and duplicate end events release their own resources. The old page timer is removed. | The audio test initially failed because native start produced no start callback. The screen test initially failed because a loading key was already marked `play`. Both now pass delayed asset loading, waiting for native start, actual end, cancellation, failure and restored grading states. |

Tests were added before the corresponding production fixes; each reported initial failure was observed. The audio harness has a completion guard so an unresolved awaited promise cannot silently pass when Node exits.

## Verification

These commands were executed against the final product/test content committed in `28ff0dd2d69c55006e932179bae55c0b030b15b8`. Each finished with exit code 0. Commands are run from the workspace above.

| Command | Result |
| --- | --- |
| `npm run test:storage` | Passed; four signed-rest snapshot round trips, invalid-event filtering, connection preservation/compatibility, existing storage and idempotency coverage. |
| `node scripts/audio-lifecycle-smoke.cjs` | Passed; deterministic seek/start races, native piano start/end, delayed loading, start timeout, cancellation, rapid taps and failures. |
| `npm run test:practice-parity` | Passed; existing 6 source contracts, 16 pitch workflows, 12 beam fixtures and 2 timed workflows, plus piano accessibility/hit-depth checks, real wrongbook retry flow and manual-key UI lifecycle. |
| `npm run typecheck` | Passed; no TypeScript errors. |
| `npm run lint` | Passed; 0 errors, the same 4 existing warnings. |
| `npm run test:answers` | Passed; generated-answer scoring, staff coordinates, pitch/connection/chord/rhythm/melody and choice answers. |
| `npm run test:core` | Passed; question deduplication, simultaneous chord attacks, difficulty distribution, four-phrase melody and audio rendering. |
| `npm run test:sample-range` | Passed; 27 G3–A5 samples, duration/fade/pitch checks, generated MIDI range and zero missing-sample rendering failures. |
| `node .superpowers/sdd/2026-09-12-ios-practice-parity/task-7-evidence/render-matrix.cjs` | Passed; 10 modes, 24 generated fixtures, 96 state renders using actual notation/piano components and mocked native effects. |
| `npm run export:web` | Passed; 18 static routes, 975 web modules / 1005 server modules, approximately 2.7 MB JS bundle. Ignored output is `dist-check/`. |
| `git diff --check` | Passed; no whitespace errors. Git emitted only the repository's LF/CRLF conversion notices. |

Existing lint warnings are `practice.tsx:166` and `local-data.ts:88` for `Array<T>`, and `practice.tsx:234` / `:253` for snapshot helper dependencies. They were not changed. The audio script emits Node's experimental TypeScript-strip warning; export emits the existing `NO_COLOR`/`FORCE_COLOR` environment warning.

## Changed product/test files

- `src/core/local-data-normalize.js`
- `src/services/local-data.ts`
- `src/services/audio-engine.ts`
- `src/app/(tabs)/wrongbook.tsx`
- `src/app/practice.tsx`
- `src/components/piano-keyboard.tsx`
- `scripts/local-data-smoke.cjs`
- `scripts/audio-lifecycle-smoke.cjs`
- `scripts/practice-parity-smoke.cjs`

## Controller rulings and remaining verification limits

The plan, specification and progress ledger were read before implementation. The piano keeps all 16 white keys and 11 black keys visible across G3–A5. In accordance with the controller's width exemption, keys keep flexible widths. The default keyboard remains 155 pt high; the unused compact variant is raised from 104 to 116 pt so both black-key and exposed white-key depths satisfy the explicit 44 pt minimum even after border allowance. The legend is outside the keybed and does not reduce those depths. The component keeps no local state or refs; its only new effect delivers accessibility announcements derived from current props.

Native iOS rendering, Yoga hit testing, VoiceOver audibility/interruption behavior, Dynamic Type and narrow-phone mistaps remain unverified on this Windows host. The storage test uses an in-memory AsyncStorage boundary; the screen tests execute actual component output and handlers with native hooks/effects simulated. Audio regressions drive controlled asset/player events rather than emitting real sound. These are not simulator screenshots or native listening evidence.

The controller's existing native-acceptance ruling therefore remains: verify on a narrow iPhone and a Dynamic-Island iPhone through the native build/TestFlight workflow. In particular, check symbol legibility, VoiceOver state announcements, note/highlight timing under cold sample loading, background/foreground cancellation and force-quit/restored answers. No native build, push, publication, TestFlight upload or Codemagic run was started by this fix task.

API references checked before editing: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) and [React Native accessibility announcements](https://reactnative.dev/docs/accessibilityinfo#announceforaccessibility), together with the installed React Native API declarations.

## Final scoped re-review follow-up

The single scoped re-review found two additional page-level edge cases. Both were reproduced before implementation and fixed surgically:

- A stale question-play request can no longer clear the preparing state owned by its replacement request.
- A failed wrong-answer write is no longer reported as saved on the completion card; the unsaved count remains visible with a retry instruction.

Fresh verification after these fixes passed: typecheck, lint (0 errors / 4 existing warnings), core, provinces, answers, storage, province-tier, sample-range, practice-parity, web export, the 96-state component matrix, and the audio lifecycle harness.
