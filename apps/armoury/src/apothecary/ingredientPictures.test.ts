import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'

import {
  checkSheet,
  cropRects,
  cutSheet,
  INGREDIENT_IDS,
  MAX_BYTES,
  readSheetInfo,
  type SheetInfo,
} from '../../scripts/ingredient-pictures.ts'
import { INGREDIENTS } from '../potion/ingredients.ts'

const CWEBP = process.env.CWEBP ?? '/opt/homebrew/bin/cwebp'
const SCRIPT = join(import.meta.dirname, '../../scripts/ingredient-pictures.ts')

const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/** A real PNG, `width` by `height`, each ninth of it a flat colour of its own. */
const pngSheet = (width: number, height = width) => {
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1)
    for (let x = 0; x < width; x++) {
      const cell = Math.floor((y * 3) / height) * 3 + Math.floor((x * 3) / width)
      rows.writeUIntBE(40 + cell * 24, rowStart + 1 + x * 3, 3)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const exifSegment = (orientation: number, byteOrder: 'MM' | 'II') => {
  const be = byteOrder === 'MM'
  const tiff = Buffer.alloc(26)
  tiff.write(byteOrder, 0)
  const u16 = (value: number, at: number) =>
    be ? tiff.writeUInt16BE(value, at) : tiff.writeUInt16LE(value, at)
  const u32 = (value: number, at: number) =>
    be ? tiff.writeUInt32BE(value, at) : tiff.writeUInt32LE(value, at)
  u16(0x2a, 2)
  u32(8, 4)
  u16(1, 8)
  u16(0x0112, 10)
  u16(3, 12)
  u32(1, 14)
  u16(orientation, 18)
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), tiff])
  const length = Buffer.alloc(2)
  length.writeUInt16BE(payload.length + 2)
  return Buffer.concat([Buffer.from([0xff, 0xe1]), length, payload])
}

const jpegHeader = (
  width: number,
  height: number,
  { exif, fill = 0 }: { exif?: Buffer; fill?: number } = {},
) => {
  const frame = Buffer.alloc(15)
  frame.writeUInt16BE(17, 0)
  frame[2] = 8
  frame.writeUInt16BE(height, 3)
  frame.writeUInt16BE(width, 5)
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]),
    exif ?? Buffer.alloc(0),
    Buffer.alloc(fill, 0xff),
    Buffer.from([0xff, 0xc0]),
    frame,
  ])
}

const pngHeaderOnly = (width: number, height: number) => {
  const head = Buffer.from(pngSheet(16, 16).subarray(0, 33))
  head.writeUInt32BE(width, 16)
  head.writeUInt32BE(height, 20)
  return head
}

const made: string[] = []
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ingredient-pictures-'))
  made.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const sheetFile = (dir: string, side: number) => {
  const sheet = join(dir, 'sheet.png')
  writeFileSync(sheet, pngSheet(side))
  return sheet
}

const fakeEncode =
  (size: number) =>
  ({ outFile }: { outFile: string }) =>
    writeFileSync(outFile, Buffer.alloc(size))

describe('the sheet layout', () => {
  it('lists the ingredients in wheel order', () => {
    expect(INGREDIENT_IDS).toEqual(INGREDIENTS.map((i) => i.id))
  })

  it('crops each cell inset by 6 percent, row by row, left to right', () => {
    const rects = cropRects({ width: 2048, height: 2048 })
    expect(rects.map((r) => r.id)).toEqual(INGREDIENT_IDS)
    expect(rects[0]).toMatchObject({ x: 41, y: 41, w: 601, h: 601 })
    expect(rects[1]).toMatchObject({ x: 724, y: 41 })
    expect(rects[2]).toMatchObject({ x: 1406, y: 41 })
    expect(rects[3]).toMatchObject({ x: 41, y: 724 })
    expect(rects[8]).toMatchObject({ x: 1406, y: 1406, w: 601, h: 601 })
  })

  it('crops a 1024 sheet the same way', () => {
    const rects = cropRects({ width: 1024, height: 1024 })
    expect(rects[0]).toMatchObject({ x: 20, y: 20, w: 300, h: 300 })
    expect(rects[4]).toMatchObject({ x: 362, y: 362 })
    expect(rects[8]).toMatchObject({ x: 703, y: 703, w: 300, h: 300 })
  })

  it('keeps every crop square and inside the sheet whatever the size', () => {
    for (const side of [1024, 1500, 2047, 3001]) {
      for (const r of cropRects({ width: side, height: side })) {
        expect(r.w).toBe(r.h)
        expect(r.x + r.w).toBeLessThanOrEqual(side)
        expect(r.y + r.h).toBeLessThanOrEqual(side)
      }
    }
  })
})

describe('reading a sheet', () => {
  it('reads a PNG from its header', () => {
    expect(readSheetInfo(pngSheet(16, 8))).toEqual({
      format: 'png',
      width: 16,
      height: 8,
      orientation: 1,
    })
  })

  it('reads a JPEG from its frame header', () => {
    expect(readSheetInfo(jpegHeader(2048, 2040))).toEqual({
      format: 'jpeg',
      width: 2048,
      height: 2040,
      orientation: 1,
    })
  })

  it('reads a JPEG whose marker is preceded by 0xFF fill bytes', () => {
    expect(readSheetInfo(jpegHeader(2048, 2040, { fill: 3 }))).toMatchObject({
      format: 'jpeg',
      width: 2048,
      height: 2040,
    })
  })

  it('reads the EXIF orientation of a JPEG in either byte order, 1 when it has none', () => {
    const orientation = (exif?: Buffer) =>
      readSheetInfo(jpegHeader(2048, 2048, { exif }))?.orientation
    expect(orientation(exifSegment(6, 'MM'))).toBe(6)
    expect(orientation(exifSegment(3, 'II'))).toBe(3)
    expect(orientation()).toBe(1)
  })

  it('does not know other formats', () => {
    expect(readSheetInfo(Buffer.from('GIF89a......'))).toBeNull()
    expect(readSheetInfo(Buffer.alloc(0))).toBeNull()
  })
})

describe('refusing a bad sheet', () => {
  const png = (width: number, height: number): SheetInfo => ({
    format: 'png',
    width,
    height,
    orientation: 1,
  })

  it('accepts a square sheet, and one within 2 percent of square', () => {
    expect(checkSheet(png(2048, 2048))).toBeNull()
    expect(checkSheet(png(2048, 2010))).toBeNull()
    expect(checkSheet({ ...png(1024, 1024), format: 'jpeg' })).toBeNull()
  })

  it('refuses a sheet that is not square, saying its size', () => {
    expect(checkSheet(png(2048, 1900))).toMatch(/not square.*2048 x 1900/)
  })

  it('pins the 2 percent tolerance at its boundary, measured against the short side', () => {
    expect(checkSheet(png(2048, 2008))).toBeNull()
    expect(checkSheet(png(2008, 2048))).toBeNull()
    expect(checkSheet(png(2048, 2007))).toMatch(/not square.*2048 x 2007/)
    expect(checkSheet(png(2048, 2000))).toMatch(/not square.*2048 x 2000/)
  })

  it('refuses a JPEG with an EXIF orientation other than 1, saying what to do', () => {
    const rotated: SheetInfo = { ...png(2048, 2048), format: 'jpeg', orientation: 6 }
    expect(checkSheet(rotated)).toMatch(/orientation.*re-save.*upright.*PNG/i)
    expect(checkSheet({ ...rotated, orientation: 1 })).toBeNull()
  })

  it('refuses a sheet over 16384 px a side', () => {
    expect(checkSheet(png(16384, 16384))).toBeNull()
    expect(checkSheet(png(16385, 16385))).toMatch(/too large.*16385 x 16385.*16384/)
  })

  it('refuses a sheet under 1024 px a side', () => {
    expect(checkSheet(png(1000, 1000))).toMatch(/too small.*1000 x 1000.*1024/)
  })

  it('refuses an unknown format', () => {
    expect(checkSheet(null)).toMatch(/PNG or JPEG/)
  })
})

describe('cutting a sheet', () => {
  it('writes one file per ingredient, named by id, and nothing else', async () => {
    const dir = scratch()
    const outDir = join(dir, 'out')

    const written = await cutSheet({
      sheetPath: sheetFile(dir, 1024),
      outDir,
      encode: fakeEncode(1000),
    })

    expect(written.map((w) => w.id)).toEqual(INGREDIENT_IDS)
    expect(readdirSync(outDir).sort()).toEqual(INGREDIENT_IDS.map((id) => `${id}.webp`).sort())
  })

  it('asks the encoder for each cell in order', async () => {
    const dir = scratch()
    const asked: string[] = []

    await cutSheet({
      sheetPath: sheetFile(dir, 1024),
      outDir: join(dir, 'out'),
      encode: ({ rect, outFile }) => {
        asked.push(`${rect.id}@${rect.x},${rect.y}`)
        writeFileSync(outFile, Buffer.alloc(10))
      },
    })

    expect(asked[0]).toBe('emberroot@20,20')
    expect(asked[8]).toBe('puffcap@703,703')
  })

  it('writes nothing when the sheet is refused', async () => {
    const dir = scratch()
    const outDir = join(dir, 'out')

    await expect(
      cutSheet({ sheetPath: sheetFile(dir, 512), outDir, encode: fakeEncode(10) }),
    ).rejects.toThrow(/too small/)
    expect(existsSync(outDir)).toBe(false)
  })

  it('writes nothing when one picture is over budget', async () => {
    const dir = scratch()
    const outDir = join(dir, 'out')
    mkdirSync(outDir)

    await expect(
      cutSheet({
        sheetPath: sheetFile(dir, 1024),
        outDir,
        encode: fakeEncode(MAX_BYTES + 1),
      }),
    ).rejects.toThrow(/over 30 KB/)
    expect(readdirSync(outDir)).toEqual([])
  })

  it('names the cell and says the sheet could not be read when the encoder fails', async () => {
    const dir = scratch()
    const outDir = join(dir, 'out')
    let calls = 0

    await expect(
      cutSheet({
        sheetPath: sheetFile(dir, 1024),
        outDir,
        encode: ({ outFile }) => {
          if (++calls === 3) throw new Error('Unsupported color conversion request')
          writeFileSync(outFile, Buffer.alloc(10))
        },
      }),
    ).rejects.toThrow(
      /frogfizz.*could not be read as a picture.*Unsupported color conversion request/s,
    )
    expect(existsSync(outDir)).toBe(false)
  })

  it('refuses absurd dimensions before calling the encoder', async () => {
    const dir = scratch()
    const sheetPath = join(dir, 'huge.png')
    writeFileSync(sheetPath, pngHeaderOnly(60000, 60000))
    let called = false

    await expect(
      cutSheet({
        sheetPath,
        outDir: join(dir, 'out'),
        encode: () => {
          called = true
        },
      }),
    ).rejects.toThrow(/too large/)
    expect(called).toBe(false)
  })

  it.skipIf(!existsSync(CWEBP))(
    'cuts a real sheet with cwebp into webps under budget (needs cwebp)',
    async () => {
      const dir = scratch()
      const outDir = join(dir, 'out')

      const written = await cutSheet({ sheetPath: sheetFile(dir, 1024), outDir })

      for (const { id, bytes } of written) {
        expect(statSync(join(outDir, `${id}.webp`)).size).toBe(bytes)
        expect(bytes).toBeLessThan(MAX_BYTES)
      }
    },
  )
})

describe('the command line', () => {
  const run = (...args: string[]) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' })

  it('exits non-zero with the reason for a sheet that is too small', () => {
    const result = run(sheetFile(scratch(), 512))
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/too small/)
  })

  it('exits non-zero with the reason for a sheet that is not square', () => {
    const file = join(scratch(), 'wide.png')
    writeFileSync(file, pngSheet(2048, 1100))
    const result = run(file)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/not square/)
  })

  it('exits non-zero for a file that is not a picture, and for no argument', () => {
    const file = join(scratch(), 'notes.png')
    writeFileSync(file, 'hello')
    expect(run(file).status).toBe(1)
    expect(run().status).toBe(2)
  })
})
