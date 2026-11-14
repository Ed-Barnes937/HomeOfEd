export const INGREDIENT_IDS: readonly string[]
export const MIN_SIDE: number
export const MAX_BYTES: number

export interface SheetInfo {
  format: string
  width: number
  height: number
}

export interface CropRect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export function readSheetInfo(bytes: Buffer): SheetInfo | null
export function checkSheet(info: SheetInfo | null): string | null
export function cropRects(size: { width: number; height: number }): CropRect[]
export function cutSheet(options: {
  sheetPath: string
  outDir?: string
  encode?: (job: { sheetPath: string; rect: CropRect; outFile: string }) => unknown
}): Promise<{ id: string; bytes: number }[]>
