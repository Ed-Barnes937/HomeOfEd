let graphemes: Intl.Segmenter | undefined

/** The letter a profile shows where it has no avatar: its name's first grapheme, upper-cased. */
export function profileInitial(name: string): string {
  return (firstGrapheme(name.trim()) ?? '').toUpperCase()
}

// Built on first use, not at load: a browser without Intl.Segmenter (Firefox < 125,
// iOS < 14.5) gets the first code point rather than an app that will not boot.
function firstGrapheme(text: string): string | undefined {
  if (typeof Intl.Segmenter !== 'function') return Array.from(text)[0]
  graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return graphemes.segment(text)[Symbol.iterator]().next().value?.segment
}
