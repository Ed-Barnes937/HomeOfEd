# Clip length

Type: grilling
Status: resolved

## Question

Is a clip permanently fixed at 16 steps / 4 bars (the working grid's full
width), or are variable-length clips (1/2/4/8 bars) wanted?

## Answer

Decided by ed-barnes937 during charting (2026-08-12): **fixed at 16 steps /
4 bars.** Everything assumes it — `step = tick mod 16`, the phone step window
and loop map, the save format, the handoff geometry, and the song bar's
"positions × 4" arithmetic. Longer phrases come from placing clips
back-to-back; shorter ones from sparse grids. Variable-length clips are not
wanted.
