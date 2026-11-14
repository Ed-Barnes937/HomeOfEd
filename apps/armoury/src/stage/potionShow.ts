// The potion's show in the close look (ADR 0111, "The mix"): one pure clock from the tap, every
// beat up to the stopper's return, and the player that keeps what is drawn smooth across a
// restart, the reveal and a put-back.

import { MIX_REVEAL_SECONDS, MIX_REVEAL_SECONDS_REDUCED } from '../potion/mixBeats.ts'
import { REST_CAP } from './potionMaterials.ts'

/** When each beat starts, seconds from the tap; the pop is the reveal. */
export const SHOW_BEATS = {
  lift: 0,
  swirl: 0.4,
  twist: 1.6,
  pop: MIX_REVEAL_SECONDS,
  live: 2.7,
  settle: 4.4,
  sink: 4.9,
  end: 5.2,
} as const

/** How far the bottle rises above the hold, in bottle heights. */
export const LIFT = 0.06
/** The vortex turns this far about the bottle's axis over the swirl, radians. */
export const SPIN = 4 * Math.PI
/** How far the stopper works loose as it twists, and how far out the pop takes it, in plug depths. */
const WORK = 0.15
export const STOPPER_OUT = 1.3
const POP_SECONDS = 0.2
const STOPPER_TURN = Math.PI / 2
const RATTLE = { seconds: 0.4, lift: 0.05, turn: 0.08, hops: 7.5, wiggles: 5 }
const REDUCED = { fade: 0.3, hold: 1.2, fadeOut: 0.5 }
/** A restart eases from what was drawn into the new show; a put-back eases the show to rest. */
const RESTART_SECONDS = 0.3
const LEAVE_SECONDS = 0.5

export interface ShowOptions {
  /** Not mixed and three in when the show started: the layers swirl into the mix. */
  firstMix: boolean
  /** Three in: a show; fewer, a rattle of the stopper. */
  full: boolean
  reducedMotion: boolean
  /** A restart's mix and vortex turn as drawn when it was tapped. */
  mixFrom?: number
  spinFrom?: number
}

export interface PotionShow {
  /** How far the bottle has risen above the hold, in bottle heights. */
  lift: number
  /** 0 the layers, 1 the mix. */
  mix: number
  /** How strongly the vortex winds the liquid, 0 to 1. */
  swirl: number
  /** How far the vortex has turned about the bottle's axis, radians. */
  spin: number
  /** How far the stopper is drawn out of the bore, in plug depths: 1 just clears the lip. */
  stopperLift: number
  /** The stopper's turn about the bottle's axis, radians. */
  stopperTurn: number
  /** The stopper is out of the neck, from the pop until it is back. */
  popped: boolean
  /** Ticket 15's: how strongly the neck emits, how long its effect has lived, and the cap it may reach. */
  emit: number
  age: number
  cap: number
}

export const showRest = (mix: number): PotionShow => ({
  lift: 0,
  mix,
  swirl: 0,
  spin: 0,
  stopperLift: 0,
  stopperTurn: 0,
  popped: false,
  emit: 0,
  age: 0,
  cap: REST_CAP,
})

const smoothstep = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1)
  return x * x * (3 - 2 * x)
}
const easeOutCubic = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3
const between = (t: number, from: number, to: number) => (t - from) / (to - from)

const reducedSeconds = () => MIX_REVEAL_SECONDS_REDUCED + REDUCED.fade + REDUCED.hold + REDUCED.fadeOut

/** How long a show lasts: the upright hold's length too. */
export function showSeconds({ full, reducedMotion }: Pick<ShowOptions, 'full' | 'reducedMotion'>) {
  if (!full) return reducedMotion ? 0 : RATTLE.seconds
  return reducedMotion ? reducedSeconds() : SHOW_BEATS.end
}

function rattle(t: number): PotionShow {
  const envelope = Math.sin((Math.PI * t) / RATTLE.seconds)
  return {
    ...showRest(0),
    stopperLift: RATTLE.lift * envelope * (0.5 - 0.5 * Math.cos(2 * Math.PI * RATTLE.hops * t)),
    stopperTurn: RATTLE.turn * envelope * Math.sin(2 * Math.PI * RATTLE.wiggles * t),
  }
}

function reducedShow(t: number, mixFrom: number, firstMix: boolean): PotionShow {
  const mix = firstMix ? mixFrom + (1 - mixFrom) * Math.min(t / MIX_REVEAL_SECONDS_REDUCED, 1) : 1
  const out = t >= MIX_REVEAL_SECONDS_REDUCED
  return { ...showRest(mix), stopperLift: out ? STOPPER_OUT : 0, popped: out }
}

function stopper(t: number): Pick<PotionShow, 'stopperLift' | 'stopperTurn'> {
  const b = SHOW_BEATS
  if (t < b.twist) return { stopperLift: 0, stopperTurn: 0 }
  if (t < b.pop) {
    const k = smoothstep(between(t, b.twist, b.pop))
    return { stopperLift: WORK * k, stopperTurn: STOPPER_TURN * k }
  }
  if (t < b.settle) {
    const popped = WORK + (STOPPER_OUT - WORK) * easeOutCubic((t - b.pop) / POP_SECONDS)
    const bob = 0.04 * Math.sin((2 * Math.PI * (t - b.pop)) / ((b.settle - b.pop) / 2))
    return { stopperLift: popped + bob * smoothstep((t - b.pop) / POP_SECONDS), stopperTurn: STOPPER_TURN }
  }
  const back = 1 - smoothstep(between(t, b.settle, b.sink))
  return { stopperLift: STOPPER_OUT * back, stopperTurn: STOPPER_TURN * back }
}

/** The show `t` seconds after the tap; at rest outside it, mixed after a first mix. */
export function potionShow(t: number, options: ShowOptions): PotionShow {
  const { firstMix, full, reducedMotion, mixFrom = 0, spinFrom = 0 } = options
  const mixedAfter = full ? 1 : 0
  if (!(t >= 0)) return showRest(firstMix ? 0 : mixedAfter)
  if (t >= showSeconds(options)) return showRest(mixedAfter)
  if (!full) return rattle(t)
  if (reducedMotion) return reducedShow(t, mixFrom, firstMix)

  const b = SHOW_BEATS
  const u = between(t, b.swirl, b.twist)
  const mixing = firstMix ? mixFrom + (1 - mixFrom) * smoothstep((u - 0.12) / 0.78) : 1
  const swirl = u <= 0 || u >= 1 ? 0 : smoothstep(u / 0.3) * (1 - smoothstep((u - 0.6) / 0.4))
  return {
    ...showRest(mixing),
    lift: LIFT * (t < b.sink ? smoothstep(t / b.swirl) : 1 - smoothstep(between(t, b.sink, b.end))),
    swirl,
    spin: spinFrom + SPIN * smoothstep(u),
    ...stopper(t),
    popped: t >= b.pop && t < b.sink,
  }
}

const lerp = (a: number, b: number, w: number) => a + (b - a) * w

/** `from` eased towards `to` by `w`, 0 to 1. */
export function blendShow(from: PotionShow, to: PotionShow, w: number): PotionShow {
  if (w >= 1) return to
  if (w <= 0) return from
  return {
    lift: lerp(from.lift, to.lift, w),
    mix: lerp(from.mix, to.mix, w),
    swirl: lerp(from.swirl, to.swirl, w),
    spin: lerp(from.spin, to.spin, w),
    stopperLift: lerp(from.stopperLift, to.stopperLift, w),
    stopperTurn: lerp(from.stopperTurn, to.stopperTurn, w),
    popped: w < 0.5 ? from.popped : to.popped,
    emit: lerp(from.emit, to.emit, w),
    age: to.age,
    cap: lerp(from.cap, to.cap, w),
  }
}

/**
 * The show as the stage draws it on its clock: a tap mid-show restarts it from what was drawn,
 * a put-back eases it to rest (mixed, if the show was one: the shell mixes it on closing), and
 * outside a show the potion rests as its params say.
 */
export class PotionShowPlayer {
  private start: number | null = null
  private options: ShowOptions = { firstMix: false, full: false, reducedMotion: false }
  private from: PotionShow | null = null
  private leftAt: number | null = null
  private last: PotionShow = showRest(0)

  play(now: number, options: ShowOptions): void {
    const running =
      this.start !== null && this.leftAt === null && now - this.start < showSeconds(this.options)
    this.from = running ? this.last : null
    this.start = now
    this.options = this.from
      ? { ...options, mixFrom: this.from.mix, spinFrom: this.from.spin }
      : options
    this.leftAt = null
  }

  leave(now: number): void {
    if (this.start !== null && this.leftAt === null) this.leftAt = now
  }

  /** What to draw at `now`, given the potion's mix at rest by its params. */
  draw(now: number, restMix: number): PotionShow {
    this.last = this.shown(now, restMix)
    return this.last
  }

  private shown(now: number, restMix: number): PotionShow {
    if (this.start === null) return showRest(restMix)
    const { options, from, leftAt } = this
    const t = now - this.start
    if (leftAt === null && t >= showSeconds(options)) return showRest(restMix)
    let show = potionShow(t, options)
    if (from && !options.reducedMotion) show = blendShow(from, show, smoothstep(t / RESTART_SECONDS))
    if (leftAt === null) return show
    const rest = showRest(options.full ? 1 : restMix)
    return blendShow(show, rest, options.reducedMotion ? 1 : smoothstep((now - leftAt) / LEAVE_SECONDS))
  }
}
