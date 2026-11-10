import { createContext, type ComponentType, type Ref } from 'react'

import type { Params } from '../engine/schema.ts'

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

/** What the shop can ask of the wand once it's lifted out for a closer look. */
export interface CloseUpHandle {
  /** Waves the wand in a figure of 8, then casts a spell from the tip in the core's colour. */
  cast(): void
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
  onTapWand: () => void
  onTapAway: () => void
  ref?: Ref<CloseUpHandle>
}

export interface Stages {
  Box: StageComponent
  CloseUp: ComponentType<CloseUpProps>
}

/** The real stages are three.js; the .iwft harness swaps in fakes (ADR 0073). */
export const StageContext = createContext<Stages | null>(null)
