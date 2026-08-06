import { describe, expect, it } from 'vitest'

import { exportGrooveWav, navigatorExportTarget, type ExportTarget } from './exportAction.ts'

const BLOB = new Blob(['fake wav bytes'], { type: 'audio/wav' })
const FILENAME = 'groove.wav'

function fakeDownload() {
  const calls: { blob: Blob; filename: string }[] = []
  return { calls, download: (blob: Blob, filename: string) => calls.push({ blob, filename }) }
}

describe('exportGrooveWav', () => {
  it('opens the share sheet when the platform can share files, and does not also download', async () => {
    const shared: { files: File[] }[] = []
    const { calls, download } = fakeDownload()
    const target: ExportTarget = {
      canShareFiles: () => true,
      share: (data) => {
        shared.push(data)
        return Promise.resolve()
      },
      download,
    }

    expect(await exportGrooveWav(BLOB, FILENAME, target)).toBe('shared')
    expect(shared).toHaveLength(1)
    expect(shared[0]!.files[0]!.name).toBe(FILENAME)
    expect(calls).toEqual([])
  })

  it('downloads when the platform cannot share the file', async () => {
    const { calls, download } = fakeDownload()
    const target: ExportTarget = { canShareFiles: () => false, share: () => Promise.resolve(), download }

    expect(await exportGrooveWav(BLOB, FILENAME, target)).toBe('downloaded')
    expect(calls).toEqual([{ blob: BLOB, filename: FILENAME }])
  })

  it('downloads when there is no share capability at all (desktop)', async () => {
    const { calls, download } = fakeDownload()

    expect(await exportGrooveWav(BLOB, FILENAME, { download })).toBe('downloaded')
    expect(calls).toEqual([{ blob: BLOB, filename: FILENAME }])
  })

  it('reports a dismissed share sheet without downloading behind the child’s back', async () => {
    const { calls, download } = fakeDownload()
    const target: ExportTarget = {
      canShareFiles: () => true,
      share: () => Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
      download,
    }

    expect(await exportGrooveWav(BLOB, FILENAME, target)).toBe('dismissed')
    expect(calls).toEqual([])
  })

  it('falls back to download when the share sheet fails for another reason', async () => {
    const { calls, download } = fakeDownload()
    const target: ExportTarget = {
      canShareFiles: () => true,
      share: () => Promise.reject(new Error('not allowed here')),
      download,
    }

    expect(await exportGrooveWav(BLOB, FILENAME, target)).toBe('downloaded')
    expect(calls).toEqual([{ blob: BLOB, filename: FILENAME }])
  })
})

describe('navigatorExportTarget', () => {
  it('offers canShareFiles/share on a browser that has them (mobile)', () => {
    const nav = {
      canShare: (data: { files?: File[] }) => (data.files?.length ?? 0) > 0,
      share: () => Promise.resolve(),
    } as unknown as Navigator
    const doc = {} as Document

    const target = navigatorExportTarget(nav, doc)
    expect(target.canShareFiles?.(new File([BLOB], FILENAME))).toBe(true)
    expect(target.share).toBeDefined()
  })

  it('leaves canShareFiles/share out on a browser without them (desktop)', () => {
    const nav = {} as Navigator
    const doc = {} as Document

    const target = navigatorExportTarget(nav, doc)
    expect(target.canShareFiles).toBeUndefined()
    expect(target.share).toBeUndefined()
  })

  it('downloads via an object-URL anchor click', () => {
    const created: string[] = []
    const revoked: string[] = []
    const originalCreate = URL.createObjectURL.bind(URL)
    const originalRevoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (blob: Blob) => {
      created.push(blob.type)
      return 'blob:fake'
    }
    URL.revokeObjectURL = (url: string) => revoked.push(url)

    try {
      const clicks: string[] = []
      const anchor = {
        click: () => clicks.push(anchor.href),
        remove: () => {},
        href: '',
        download: '',
      }
      const doc = {
        createElement: () => anchor,
        body: { appendChild: () => {} },
      } as unknown as Document
      const nav = {} as Navigator

      navigatorExportTarget(nav, doc).download(BLOB, FILENAME)

      expect(created).toEqual(['audio/wav'])
      expect(anchor.download).toBe(FILENAME)
      expect(clicks).toEqual(['blob:fake'])
      expect(revoked).toEqual(['blob:fake'])
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })
})
