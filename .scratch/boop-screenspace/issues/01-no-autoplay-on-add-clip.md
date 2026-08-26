# Adding a clip must not start playback

Type: task
Status: ready-for-agent

**Blocked by:** —

## What to change

`apps/boop/src/pages/HomePage.tsx`, in `pickClip`:

```ts
const landed = addClipToSong(() => samplePattern(kit, sample.rows), sample.label)
if (landed && !engine.isPlaying()) void engine.start()   // <- this line goes
```

## Why

Adding a clip is an **edit**, not a transport command. The child decides when
sound happens; nothing else in boop starts playback as a side effect of an
edit, and a toy that suddenly plays on its own is startling rather than
delightful.

It is also inconsistent today: the line sits on the sample-clip path only, so
picking **Blank** from "+ New clip" adds silently while picking a sample clip
starts the loop. Removing it makes the two routes through the same picker
agree.

## Independent of everything else

This is not part of the layout change and must not wait for it. Landing it
first also keeps it out of the diff for ticket 03, which is large enough
already.

## Verify

- A `.iwft` case: open "+ New clip", pick a sample clip, assert the transport
  is **not** playing afterwards. There is an existing suite to extend —
  `newClipPicker.iwft.tsx`.
- Check the Blank path stays silent too, so the assertion covers both routes.
- The clip still lands selected and on the grid; only the auto-start goes.
