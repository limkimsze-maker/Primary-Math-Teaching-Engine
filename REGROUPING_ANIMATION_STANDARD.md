# Regrouping Animation Standard

Last updated: 1 October 2026  
Status: **Audited and approved standard**

This is the standard visual treatment for base-ten regrouping in the P1 to P3 Math Teaching Engine. The implementation in `public/operations.html` was re-audited on 1 October 2026 for both addition and subtraction.

## Core rule

Regrouping must show the mathematical equivalence clearly. Blocks must not squash, stretch or morph ambiguously.

A moving or landed regrouped piece must use its normal base-ten shape:
- 1 one = normal unit cube
- 1 ten = normal ten rod
- 1 hundred = normal hundred flat
- 1 thousand = normal thousand block

Every regrouping stage uses the same **crisp dark-teal outline (#183c35)**:
- donor block being regrouped;
- regrouped piece while it is moving;
- regrouped piece after it lands;
- newly formed larger block in addition.

Do **not** use yellow regrouping glow, blur, fuzzy shadow or yellow donor outlines for Operations regrouping. A brief emphasis pulse may scale the object slightly, but must not add a coloured glow or alter its mathematical shape.

## Subtraction / renaming

Show the donor breaking apart one unit at a time:
- 1 ten -> 10 ones
- 1 hundred -> 10 tens
- 1 thousand -> 10 hundreds

The donor is represented as 10 connected smaller units. One smaller unit detaches at a time and moves to the next place. The remaining connected donor becomes physically smaller because a real unit has been removed; it must never look compressed.

Examples:
- 1 ten becomes 9 connected ones, then 8, 7 ... until 10 separate ones have moved.
- 1 hundred becomes 9 connected tens, then 8, 7 ... until 10 separate tens have moved.
- 1 thousand becomes 9 connected hundreds, then 8, 7 ... until 10 separate hundreds have moved.

The detached piece must already look like the **normal target-place block from the moment it starts moving**:
- ten -> one: normal one cube;
- hundred -> ten: normal ten rod;
- thousand -> hundred: normal hundred flat.

The moving piece keeps the crisp teal outline while travelling and after landing.

After landing, the block remains in its normal base-ten form. If that landed block is regrouped again later, it first remains visible in its normal form and only breaks apart when the next regrouping step begins.

## Addition / regrouping

Show the reverse process:
- 10 ones -> 1 normal ten rod
- 10 tens -> 1 normal hundred flat
- 10 hundreds -> 1 normal thousand block

The 10 smaller blocks are first visually grouped together. They then visibly combine to form **one normal larger base-ten block**.

The newly formed larger block:
- is recognizable immediately as the correct base-ten object;
- uses the crisp teal outline;
- moves to the next place in its normal shape;
- lands and remains in that normal shape.

Do not show a temporary cube, stretched rod, compressed flat or any other distorted intermediate object.

## Timing and pedagogy

Regrouping animations should be deliberately slow enough for primary pupils to follow the transformation.

The animation should:
1. focus attention on the units being regrouped;
2. show the equivalence step by step;
3. pause briefly after the new block is formed or the smaller blocks have landed;
4. keep the mathematical object as the visual focus;
5. use consistent teal outlining throughout the regrouping sequence.

## Implementation guardrails

This standard applies to **Operations addition and subtraction regrouping**.

When editing regrouping visuals:
- preserve the normal base-ten shapes;
- preserve the crisp teal outline at donor, moving and landed stages;
- do not reintroduce the old yellow `addsub-regrouped-glow` treatment;
- do not use blur or coloured drop-shadow effects on regrouped Operations blocks;
- keep the animation presentation-only.

Animation changes must **not** change scoring, attempts, hint tracking, feedback or SLS submission logic.

This document is the source of truth for future regrouping-animation changes.
