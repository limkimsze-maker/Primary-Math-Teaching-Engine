# Primary Maths Studio

19 topic tabs for Singapore P1–P3 classroom mathematics. Created by Lim Kim Sze.

The three measurement engines preserve the completed length, mass and volume activities. Twelve shared engines use the common configuration, generation and checking core. Four dedicated topic hubs cover Comparing & ordering, Mental sum, Measurement conversion, and P3 More Word Problems. P3 More Word Problems loads the original Monster Quest reference directly so its diagrams and teaching sequence remain authoritative. Only the selected workspace is mounted.

The grade presets were checked against MOE's 2021 Primary Mathematics syllabus, updated October 2025, pages 31–36. This toolkit covers selected reusable activity types, not every syllabus objective. Original questions and diagrams are used; exact textbook-page alignment is not claimed.

See `SYLLABUS_AUDIT_P1_P3.md` for the current objective-by-objective P1–P3 coverage audit and remaining gaps.

## SLS working baseline

The current known-good MOE SLS export baseline is **Mode B v23** (`20260929-sls-mode-b-exact-23`), user-verified on 29 September 2026. See [`SLS_MODE_B_WORKING_BASELINE.md`](SLS_MODE_B_WORKING_BASELINE.md) before changing any SLS/xAPI plumbing, script order, score/feedback transport, first-submit locking, or ZIP injection logic.

This is a tested project baseline, not formal SLS certification.

## Development

Run `node scripts/assemble-engines.mjs` after editing `engine-src/`. It generates the standalone HTML and the download endpoint's template from the same source. Use the project package manager and existing Sites build workflow.

`node checks/check-engines.mjs` checks all new grade/task combinations, generated questions and arithmetic edge cases. `node checks/check-downloads.mjs` checks configured HTML, HTML/JSON download responses and invalid requests. The latter creates temporary `public/qa` samples for preview QA; remove those samples before the final build.

Fixed activities contain one exact example. Random practice generates a fresh set each time it starts, preserving the shown controls and grade ranges. Downloaded copies never update themselves. Results are session-local; JSON saves configuration only. Standalone downloads have no external assets and need no account. No xAPI reporting or SLS certification is claimed.

Optional WebMCP tools are feature-detected. The current browser QA environment does not expose the modelContext API, so tool validation was unavailable.
