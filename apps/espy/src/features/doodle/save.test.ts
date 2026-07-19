import { describe, expect, it } from 'vitest'

import { saveImage, type SaveCaps } from './save.ts'

interface CallLog {
  shareFiles: Array<{ name: string; title: string }>
  download: string[]
  nativeShare: string[]
}

function makeCaps(overrides: Partial<SaveCaps> = {}): { caps: SaveCaps; calls: CallLog } {
  const calls: CallLog = { shareFiles: [], download: [], nativeShare: [] }
  const caps: SaveCaps = {
    isNative: false,
    canShareFiles: () => false,
    shareFiles: (file, title) => {
      calls.shareFiles.push({ name: file.name, title })
      return Promise.resolve()
    },
    download: (_blob, filename) => {
      calls.download.push(filename)
    },
    nativeShare: (_blob, filename) => {
      calls.nativeShare.push(filename)
      return Promise.resolve()
    },
    ...overrides,
  }
  return { caps, calls }
}

const blob = new Blob(['png-bytes'], { type: 'image/png' })

describe('saveImage', () => {
  it('uses the native share path when running under a native shell', async () => {
    const { caps, calls } = makeCaps({ isNative: true, canShareFiles: () => true })

    await saveImage(blob, 'espy.png', 'Espy', caps)

    expect(calls.nativeShare).toEqual(['espy.png'])
    expect(calls.shareFiles).toEqual([])
    expect(calls.download).toEqual([])
  })

  it('uses the Web Share API when the file is shareable', async () => {
    const { caps, calls } = makeCaps({ canShareFiles: () => true })

    await saveImage(blob, 'espy.png', 'Espy', caps)

    expect(calls.shareFiles).toEqual([{ name: 'espy.png', title: 'Espy' }])
    expect(calls.nativeShare).toEqual([])
    expect(calls.download).toEqual([])
  })

  it('falls back to an anchor download when the file is not shareable', async () => {
    const { caps, calls } = makeCaps({ canShareFiles: () => false })

    await saveImage(blob, 'espy.png', 'Espy', caps)

    expect(calls.download).toEqual(['espy.png'])
    expect(calls.shareFiles).toEqual([])
    expect(calls.nativeShare).toEqual([])
  })

  it('swallows AbortError when the user dismisses the share sheet', async () => {
    const abort = new Error('dismissed')
    abort.name = 'AbortError'
    const { caps } = makeCaps({
      canShareFiles: () => true,
      shareFiles: () => Promise.reject(abort),
    })

    await expect(saveImage(blob, 'espy.png', 'Espy', caps)).resolves.toBeUndefined()
  })

  it('swallows AbortError from the native share sheet too', async () => {
    const abort = new Error('dismissed')
    abort.name = 'AbortError'
    const { caps } = makeCaps({
      isNative: true,
      nativeShare: () => Promise.reject(abort),
    })

    await expect(saveImage(blob, 'espy.png', 'Espy', caps)).resolves.toBeUndefined()
  })

  it('rethrows non-abort errors from a share', async () => {
    const { caps } = makeCaps({
      canShareFiles: () => true,
      shareFiles: () => Promise.reject(new Error('boom')),
    })

    await expect(saveImage(blob, 'espy.png', 'Espy', caps)).rejects.toThrow('boom')
  })
})
