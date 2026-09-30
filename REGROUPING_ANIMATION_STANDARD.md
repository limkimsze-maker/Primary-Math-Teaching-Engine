# Regrouping Animation Standard

Last updated: 1 October 2026

This is the standard visual treatment for base-ten regrouping in the P1 to P3 Math Teaching Engine.

## Core rule

Regrouping must show the mathematical equivalence clearly. Blocks must not squash, stretch or morph ambiguously.

A moving or landed regrouped piece must use its normal base-ten shape:
- 1 one = normal unit cube
- 1 ten = normal ten rod
- 1 hundred = normal hundred flat
- 1 thousand = normal thousand block

Newly regrouped pieces use a crisp dark-teal outline (#183c35), with no yellow glow, blur or fuzzy shadow.

The same crisp dark-teal outline is also used on every donor block while it is being regrouped (ten, hundred and thousand), so the visual cue is consistent before, during and after the regrouping animation.

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

When a piece moves, it must already look like the normal target-place block. After landing, it remains in that normal shape.

If a landed block is regrouped again later, it first appears normally in its place and only then breaks apart in the next regrouping step.

## Addition / regrouping

Show the reverse process:
- 10 ones -> 1 normal ten rod
- 10 tens -> 1 normal hundred flat
- 10 hundreds -> 1 normal thousand block

The 10 smaller blocks visibly group together first. They then form one normal larger base-ten block, which moves to the next place with the crisp dark-teal outline.

The new block must be recognizable immediately as the correct base-ten object; do not show a temporary cube or distorted intermediate shape.

## Timing and pedagogy

Regrouping animations should be deliberately slow enough for primary pupils to follow the transformation.

The animation should:
1. focus attention on the units being regrouped;
2. show the equivalence step by step;
3. pause briefly after the new block is formed or the smaller blocks have landed;
4. keep the mathematical object as the visual focus.

Animation changes must remain presentation-only. Do not change scoring, attempts, hint tracking, feedback or SLS submission logic when adjusting regrouping visuals.
