import { createContext, use, type ComponentType, type Ref } from 'react'

import type { Params } from '../engine/schema.ts'
import type { ItemKind } from '../items/item.ts'

export const LONGEST_WAND_MM = 380
/** The longest wand spans this much of the stage's width; the rest is room for the spell. */
export const STAGE_FILL = 0.72
/** Only light brighter than this blooms: the core's glow, its sparkles and the spell. */
export const BLOOM_THRESHOLD = 1.4
/** A wave starts as soon as it's asked for; the spell leaves the tip this long after. */
export const WAVE_TO_SPELL_SECONDS = 2.5
/** How long a spell's burst lasts once it leaves the tip. */
export const SPELL_SECONDS = 1.6

/** What the shop can ask of the wand on the counter. */
export interface StageHandle {
  /** Rolls the wand about its length; `turns` is a fraction of a full turn. */
  roll(turns: number): void
  /** The wand alone on a transparent background, for the share card. */
  capture(): Promise<HTMLCanvasElement>
}

export interface StageProps {
  params: Params
  reducedMotion: boolean
  ref?: Ref<StageHandle>
}

export type StageComponent = ComponentType<StageProps>

/** Where the wand lies in its box: the box stage's rect on screen and how far it's rolled. */
export interface BoxPose {
  rect: DOMRect
  turns: number
}

/** What the shop can ask of the item once it's lifted out for a closer look. */
export interface CloseUpHandle {
  /** The item's show-off move: a wand waves a figure of 8 and casts a spell from its tip. */
  flourish(): void
  /** Flies the wand back down into its box; resolves once it's lying there. */
  putBack(): Promise<void>
}

export interface CloseUpProps {
  params: Params
  reducedMotion: boolean
  /** Read when the wand lifts and again when it goes back, as the box may have moved. */
  boxPose: () => BoxPose
  /** The close look has drawn the wand, so the box can show empty. */
  onLift: () => void
  /** The wand has risen into the middle of the screen. */
  onArrive: () => void
  onTapItem: () => void
  onTapAway: () => void
  ref?: Ref<CloseUpHandle>
}

export interface Stages {
  Box: StageComponent
  CloseUp: ComponentType<CloseUpProps>
}

export type StagesByKind = Partial<Record<ItemKind, Stages>>

/** The real stages are three.js; the .iwft harness swaps in fakes (ADR 0073). */
export const StageContext = createContext<StagesByKind>({})

/** A kind with no stages shows its shop without one, as a browser without WebGL does. */
export function useStages(kind: ItemKind): Stages | undefined {
  return use(StageContext)[kind]
}
