const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The letter a profile shows where it has no avatar: its name's first grapheme, upper-cased. */
export function profileInitial(name: string): string {
  const first = graphemes.segment(name.trim())[Symbol.iterator]().next()
  return first.done === true ? '' : first.value.segment.toUpperCase()
}
