import { describe, expect, it } from 'vitest'

import { navigatorShareTarget, shareWandUrl, type ShareTarget } from './shareAction.ts'

const URL_TO_SHARE = 'https://armoury.homeofed.com/#w=abc'
const WORDS = { title: 'Armoury', text: 'Look at the wand I made' }

function fakeClipboard(behaviour: 'ok' | 'reject' = 'ok') {
  const written: string[] = []
  return {
    written,
    clipboard: {
      writeText: (text: string) => {
        if (behaviour === 'reject') return Promise.reject(new Error('denied'))
        written.push(text)
        return Promise.resolve()
      },
    },
  }
}

describe('shareWandUrl', () => {
  it('opens the system share sheet when the platform has one', async () => {
    const shared: string[] = []
    const { written, clipboard } = fakeClipboard()
    const target: ShareTarget = {
      share: (data) => {
        shared.push(data.url)
        return Promise.resolve()
      },
      clipboard,
    }

    expect(await shareWandUrl(URL_TO_SHARE, target, WORDS)).toBe('shared')
    expect(shared).toEqual([URL_TO_SHARE])
    // The share sheet is the whole affordance on mobile - no silent copy too.
    expect(written).toEqual([])
  })

  it('copies to the clipboard when there is no share sheet', async () => {
    const { written, clipboard } = fakeClipboard()

    expect(await shareWandUrl(URL_TO_SHARE, { clipboard }, WORDS)).toBe('copied')
    expect(written).toEqual([URL_TO_SHARE])
  })

  it('reports a dismissed share sheet without pretending it copied', async () => {
    const { written, clipboard } = fakeClipboard()
    const target: ShareTarget = {
      share: () => Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
      clipboard,
    }

    expect(await shareWandUrl(URL_TO_SHARE, target, WORDS)).toBe('dismissed')
    expect(written).toEqual([])
  })

  it('falls back to the clipboard when the share sheet fails for another reason', async () => {
    const { written, clipboard } = fakeClipboard()
    const target: ShareTarget = {
      share: () => Promise.reject(new Error('not allowed here')),
      clipboard,
    }

    expect(await shareWandUrl(URL_TO_SHARE, target, WORDS)).toBe('copied')
    expect(written).toEqual([URL_TO_SHARE])
  })

  it('reports unavailable rather than throwing when nothing can share', async () => {
    expect(await shareWandUrl(URL_TO_SHARE, {}, WORDS)).toBe('unavailable')
  })

  it('reports unavailable when the clipboard write is refused', async () => {
    const { clipboard } = fakeClipboard('reject')
    expect(await shareWandUrl(URL_TO_SHARE, { clipboard }, WORDS)).toBe('unavailable')
  })
})

describe('navigatorShareTarget', () => {
  const clipboard = { writeText: () => Promise.resolve() }

  it('offers the share sheet on a touch device that has one (mobile)', async () => {
    const shared: string[] = []
    const nav = {
      share: (data: { url: string }) => {
        shared.push(data.url)
        return Promise.resolve()
      },
      clipboard,
    } as unknown as Navigator

    expect(await shareWandUrl(URL_TO_SHARE, navigatorShareTarget(nav, true), WORDS)).toBe('shared')
    expect(shared).toEqual([URL_TO_SHARE])
  })

  it('leaves the share sheet out on a browser without one', () => {
    const nav = { clipboard } as unknown as Navigator
    expect(navigatorShareTarget(nav, true).share).toBeUndefined()
  })

  it('copies rather than opening the sheet on a desktop browser that ships navigator.share', async () => {
    const shared: string[] = []
    const written: string[] = []
    const nav = {
      share: (data: { url: string }) => {
        shared.push(data.url)
        return Promise.resolve()
      },
      clipboard: {
        writeText: (text: string) => {
          written.push(text)
          return Promise.resolve()
        },
      },
    } as unknown as Navigator

    expect(await shareWandUrl(URL_TO_SHARE, navigatorShareTarget(nav, false), WORDS)).toBe('copied')
    expect(shared).toEqual([])
    expect(written).toEqual([URL_TO_SHARE])
  })
})
