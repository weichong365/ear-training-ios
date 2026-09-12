# SDD ledger — plan: docs/superpowers/plans/2026-09-12-ios-practice-parity.md

Workspace: F:/WorkBuddy/练耳大师/ios-app/.worktrees/ios-practice-parity
Branch: feature/ios-practice-parity
Baseline: 8dd0051
Baseline checks: typecheck, lint, core, provinces, answers, storage, province-tier, sample-range all pass.

## Preflight interface scan

| Tasks | Producer / consumer | Finding |
|---|---|---|
| 1 → 2–6 | Task 1 produces `test:practice-parity`; later tasks extend and satisfy it | Clean; keep assertions behavioral or structural without snapshotting formatting. |
| 2 → 3 | Task 2 produces resumable question snapshots; Task 3 changes transient audio state | Clean; snapshots must not persist timers, playing flags, or raw errors. |
| 2 → 6 | Task 2 produces finalized per-question state; Task 6 calculates completion | Clean; score and wrongbook writes must remain idempotent. |
| 3 → 6 | Task 3 produces unified volume/playback state; Task 6 consumes it for piano and replay | Clean; one normalized volume path is binding. |
| 4 → 5 | Tasks share answer-staff and notation geometry | Clean; Task 4 owns pitch primitives, Task 5 owns timed-system composition. |
| 4 → 6 | Task 4 produces answer/feedback presentation; Task 6 adds piano/completion behavior | Clean; Task 6 must not restyle notation geometry. |
| 5 → 7 | Task 5 produces timed notation parity; Task 7 verifies all modes | Clean. |
| 6 → 7 | Task 6 completes feedback flow; Task 7 runs full regression | Clean. |
| Task 1 | Test text vs files named | Clean; initial failure must represent missing behavior, not an invented API. |
| Task 2 | Persistence tests vs practice/local-data changes | Clean. |
| Task 3 | Audio tests vs existing service API | Clean; no new dependency. |
| Task 4 | Geometry files listed even if current shared geometry is already correct | Ruling recorded below. |
| Task 5 | Geometry files listed even if existing beam logic already satisfies spec | Ruling recorded below. |
| Task 6 | Piano lifecycle and feedback tests | Clean. |
| Task 7 | Requires iOS Simulator on a Windows host | Ruling recorded below. |

Ruling: Tasks 4 and 5 modify shared geometry only when a failing parity test proves a defect — avoids speculative churn; if wrong, a real geometry mismatch may survive until final device review.

Ruling: Task 7 cannot capture iOS Simulator evidence on this Windows host — use all automated checks plus Codemagic native compilation and user TestFlight verification; if wrong, a device-class-only layout defect may require one follow-up build.

Task 1: dispatched to /root/practice_task1_impl at base 8dd0051.
Task 1: fix round 1/5 (3 addressed, 2 open — restoration and unconditional volume checks remained bypassable; commits c8aedef..7691a67)
Task 1: fix round 2/5 (0 addressed, 2 open — regex contracts still admitted inert wiring; commits 7691a67..e4836d1)
Task 1: fix round 3/5 (0 addressed, 2 open — AST checks did not bind capture/mapping/card ancestry tightly enough; commits e4836d1..4ac6518)
Task 1: fix round 4/5 (0 addressed, 2 open — post-restore overwrite and extra card gating remained possible; commits 4ac6518..f104bae)
Task 1: fix round 5/5 (2 addressed, 0 open — 9 positive fixtures pass and 40 mutations rejected; commits f104bae..ddd0bcb)
Task 1: complete (commits 8dd0051..ddd0bcb, review clean)
Task 2: fix round 1/5 (0 addressed, 2 open — score idempotency and malformed snapshot behavior; commits 44a4f1f..a5e2a6c)
Task 2: fix round 2/5 (2 addressed, 0 open — executable score guard and strict snapshot validation; commits a5e2a6c..13863bd)
Task 2: complete (commits ddd0bcb..13863bd, review clean)
Task 3: fix round 1/5 (2 addressed, 0 open — stale sample load and delayed autoplay now cancel safely; commits 2759680..a7d1be8)
Task 3: complete (commits 13863bd..a7d1be8, review clean)
Task 4: Ruling: allow a surgical `src/core/exam-answer.ts` completion fix because sparse-array `.every` skips holes and violates the spec; add an executable regression and do not change scoring semantics — if wrong, another answer mode could become stricter than intended.
Task 4: complete (commits a7d1be8..331fe5a, review clean)
Task 5: complete (commits 331fe5a..810bd69, review clean)
Task 6: fix round 1/5 (3 addressed, 0 open — persistent feedback highlights, replay cancellation, and stale-result handling; commits ff80c89..fc663c5)
Task 6: complete (commits 810bd69..fc663c5, review clean)
Task 7: Ruling: the 44×44 pt minimum applies to conventional controls; the 16-key continuous piano surface is exempt from the width minimum because keeping G3–A5 visible is a binding product requirement. Preserve at least 44 pt vertical hit depth and verify mistap risk on TestFlight — if wrong, narrow phones may need octave paging or horizontal scrolling.
Task 7: fix round 1/5 (1 addressed, 0 open — retained executable matrix and raw command evidence; no product commit)
Task 7: complete (commits fc663c5..fc663c5, review clean; native acceptance pending TestFlight)
Task 6: fix round 1/5 (3 addressed, 0 open — persistent feedback highlights, replay cancellation, and stale-result handling; commits ff80c89..fc663c5)
Task 6: complete (commits 810bd69..fc663c5, review clean)

Final branch fixes: dispatched to /root/final_branch_fixes at base fc663c5; no child agents.
Final branch fixes: complete (commit 28ff0dd2d69c55006e932179bae55c0b030b15b8; 5 supplied findings addressed, controller review pending).
Final branch fixes: signed-rest answering/feedback storage round trips; request-owned question audio across seek/start cancellation; complete connection wrongbook/retry flow; visible piano state markers and accessibility announcements; native-start/end-driven manual highlights.
Final branch fixes: verified storage, audio lifecycle, practice parity, typecheck, lint (0 errors / 4 existing warnings), answers, core, sample-range, 96-state component matrix, web export (18 routes) and diff whitespace check. See task-final-fixes-report.md for exact commands, observed red/green evidence and scope.
Final branch fixes: preserved controller rulings — no scoring/generation/geometry changes; all 16 white keys / 11 black keys remain visible and both key colors retain >=44 pt vertical hit depth. Native display, VoiceOver audibility and narrow-device touch acceptance still require iPhone/TestFlight verification on the existing Windows-host ruling.
