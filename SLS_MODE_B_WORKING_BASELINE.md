# SLS Mode B — Known-Good Working Baseline

**Status:** WORKING — user verified in MOE SLS  
**Verified:** 29 September 2026  
**Known-good packager version:** `20260929-sls-mode-b-exact-23`  
**Reference implementation:** Mode B from `https://limkimsze-maker.github.io/Compiler/`

## Why this document exists

This file records the SLS integration state that was proven to work, so future changes do not repeat the same debugging or accidentally regress the SLS export.

When working on SLS scoring, feedback, ZIP generation, first-submit locking, or the exported pupil runtime, treat this document and the v23 plumbing as the baseline.

## User-verified result

A newly generated ZIP from the P1–P3 Math Teaching Engine was uploaded into MOE SLS and the activity loaded correctly after the v23 fixes.

Before v23, the uploaded ZIP opened as a generic blank **Teaching engine** shell with empty Grade/Task selectors instead of the configured activity.

The key Console error was:

```
Uncaught SyntaxError: Unexpected token '<'
```

Other errors such as null `querySelectorAll` / `textContent` failures appeared after that and were secondary consequences of the main activity runtime not starting.

## Canonical Mode B order — DO NOT REORDER

The working Compiler Mode B template uses this order:

1. Define `window.ACTIVITY_ID`.
2. Load `xapiwrapper.min.js`.
3. Load `index.js` with `defer`.
4. Run the fresh-session reset script.

In compact form:

```text
ACTIVITY_ID
→ xapiwrapper.min.js
→ index.js defer
→ fresh-session reset
```

The reset still executes before deferred `index.js` hydration.

Do not move the reset before the two Mode B transport files unless a new SLS test proves that change works.

## Critical v23 fix

The Math Teaching Engine contains teacher/exporter JavaScript that itself includes text patterns such as:

```text
<script ...>
<\/script>
```

These are harmless inside normal JavaScript on the live GitHub page, but SLS HTML5 processing can interpret raw script-tag text as markup while processing the uploaded package.

That caused the exported page to fail before the configured activity could initialise and produced:

```
Unexpected token '<'
```

### Required safeguard

Before creating the SLS ZIP, encode raw nested script-tag text inside ordinary inline JavaScript so SLS cannot treat it as real HTML markup.

The pupil export must contain **no raw nested `<script` / `<\/script` text inside the main activity runtime**.

The actual external Mode B tags themselves must remain normal valid HTML tags.

## Export requirements

Every generated SLS ZIP must preserve all of the following:

- The selected engine.
- Grade.
- Task.
- Question count.
- Saved configuration in `#saved-config`.
- The actual configured pupil activity, not the generic teacher shell state.
- `xapiwrapper.min.js` from the proven Compiler/ZIP Factory implementation.
- `index.js` from the proven Compiler/ZIP Factory implementation.
- Valid real HTML closing `</script>` tags.
- No `<base>` tag that redirects local ZIP scripts.
- No teacher-only SLS packager script inside the pupil ZIP.
- Mobile scrolling support for SLS frames.
- Hidden score and feedback fields required by the Mode B transport.

## Scoring rule

The Math Teaching Engine uses:

- 1 mark per question.
- A mark is earned only when the **first checked answer is correct**.
- Using **Help me**, reveal, or show-next-step removes eligibility for that mark.
- A pupil may retry for learning, but later retries do not recover the mark.
- For an 8-question activity, Maximum Marks in SLS should be set to 8.

The final completed result sends the raw score plus detailed feedback.

## Feedback

Feedback should be specific by problem type, not merely a broad topic name.

Examples:

```text
Pictorial Model — Find a part: Give away
Pictorial Model — Comparison: More than
Operations and grouping — add 2 digits to tens
```

The final feedback can include:

- Score earned / maximum.
- First-check correct count.
- Self-corrected count.
- Assisted count.
- Problem types requiring review.
- Question numbers where marks were lost.
- By-type performance.

## First-submit behaviour

Mode B uses the first completed assessment result as the SLS result for that session.

Relevant state includes:

```text
UFCO-firstSubmit::<ACTIVITY_ID>
sls_unlike_payload::<ACTIVITY_ID>::v1
```

`Practise again` must not overwrite the first completed score during the same session.

The fresh-session reset clears stale state on a new activity load according to the canonical Mode B behaviour.

## Pupil SLS Submit reminder

After the first completed run, the exported activity shows:

> 📤 **Before you leave**  
> Return to **SLS** and press **Submit** so your **score and feedback** are recorded.

This reminder should appear once for the first completed practice, not repeatedly after every `Practise again`.

## Preflight requirements

The Download SLS ZIP preflight should check at least:

- Configured activity is valid.
- Maximum Marks can be determined.
- Saved configuration survives export unchanged.
- Canonical Mode B script order is present.
- Proven `xapiwrapper.min.js` is linked.
- Proven `index.js` is linked with `defer`.
- Final SLS result trigger exists.
- Score/feedback bridge exists.
- First-completion SLS Submit reminder is wired.
- Script tags are valid HTML.
- No raw nested script-tag text remains in the pupil runtime.
- No `<base>` tag is present.
- Teacher-only packager is removed from the pupil ZIP.

A green preflight is a **structural check**, not a substitute for final SLS integration testing after plumbing changes.

## Regression signature

If an SLS upload shows:

- Header: **Teaching engine**
- Empty Grade preset
- Empty Task
- Blank activity area

then check Console immediately.

If Console shows:

```
Unexpected token '<'
```

suspect SLS parsing of the generated HTML / script boundaries before debugging the mathematical activity itself.

The null-property errors that follow are likely secondary until the first syntax error is resolved.

## Change policy

For future SLS work:

1. Start from `20260929-sls-mode-b-exact-23`.
2. Do not rewrite Mode B plumbing simply to make it “cleaner”.
3. Do not change script order without a real SLS test.
4. Preserve the raw-script-text sanitizer.
5. Preserve first-submit locking.
6. Preserve score + feedback state shape.
7. Preserve the pupil Submit reminder.
8. After any plumbing change, generate a fresh ZIP and test it in SLS.
9. If a test fails, diagnose the **first Console error**, not downstream errors.
10. Once another version is proven in SLS, update this document and explicitly mark the new known-good version.

## Proven source references

- Compiler: `https://limkimsze-maker.github.io/Compiler/`
- Mode B canonical template: the user's working Mode B file used during the 29 Sep 2026 debugging session.
- ZIP Factory transport files: the literal `index.js` and `xapiwrapper.min.js` used by the working Compiler flow.

---

**Do not delete this file when refactoring. It is the recovery point for the SLS integration.**
