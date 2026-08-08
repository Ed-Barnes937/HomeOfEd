/**
 * The download name for an exported boop (ticket 34): the saved boop's own
 * name, slugged and lowercased — "Boop 3" saves as `boop-3.wav`. A child can
 * type anything into the rename field (emoji, slashes, spaces), so slugging is
 * required whatever the name is; a name with nothing left after it falls back
 * to `boop.wav` rather than an empty or hidden filename.
 */
export function boopFilename(name: string): string {
  const slug = name
    // Decompose accents, then drop the combining marks — "Café" → "cafe".
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug === '' ? 'boop' : slug}.wav`
}
