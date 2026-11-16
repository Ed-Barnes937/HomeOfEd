// The potion's show in the close look (ADR 0111, "The mix" and "The uncorking"): one pure clock
// from the tap, every beat to the stopper's return and the effect between the pop and it, and the
// player that keeps what is drawn smooth across a restart, the reveal and a put-back.

import { MIX_REVEAL_SECONDS, MIX_REVEAL_SECONDS_REDUCED } from '../potion/mixBeats.ts'
import { MAX_POURS } from '../potion/potionSchema.ts'
import { EFFECT_SECONDS, EFFECT_STILL_AGE } from './effectKinds.ts'
import { REST_CAP } from './potionMaterials.ts'
import { BLOOM_THRESHOLD } from './stage.ts'

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
const RATTLE = { seconds: 0.4, lift: 0.095, turn: 0.18, hops: 7.5, wiggles: 5 }
const REDUCED = { fade: 0.3, hold: 1.2, fadeOut: 0.5 }
/** The brightest a particle of the effect may be, as the sword's glint: only between the pop and the stopper's return. */
export const EFFECT_CAP = 2 * BLOOM_THRESHOLD
const EMIT = { rise: 0.8, fall: 0.35 }
/** The stopper swings clear of the neck this long after the pop, and is back above it by the settle. */
const ASIDE = { after: 0.06, out: 0.4, back: 0.4 }
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

/** The show a potion plays at a flourish, by the potion as it is then. */
export function showOptions(
  spec: { layers: readonly unknown[]; mixed: boolean },
  reducedMotion: boolean,
): ShowOptions {
  const full = spec.layers.length === MAX_POURS
  return { firstMix: full && !spec.mixed, full, reducedMotion }
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
  /** How far the stopper has swung aside of the neck, out of the effect's way, 0 to 1. */
  stopperAside: number
  /** The stopper is out of the neck, from the pop until it is back. */
  popped: boolean
  /** How much of the effect shows, 0 to 1. */
  emit: number
  /** Seconds since the pop that let the effect out; one still moment under reduced motion. */
  age: number
  /** The brightest the effect's particles may be: the resting cap but while it shows. */
  cap: number
}

export const showRest = (mix: number): PotionShow => ({
  lift: 0,
  mix,
  swirl: 0,
  spin: 0,
  stopperLift: 0,
  stopperTurn: 0,
  stopperAside: 0,
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

const reducedSeconds = () =>
  MIX_REVEAL_SECONDS_REDUCED + REDUCED.fade + REDUCED.hold + REDUCED.fadeOut

const popSeconds = ({ reducedMotion }: Pick<ShowOptions, 'reducedMotion'>) =>
  reducedMotion ? MIX_REVEAL_SECONDS_REDUCED : SHOW_BEATS.pop

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

const effectAt = (emit: number, age: number): Pick<PotionShow, 'emit' | 'age' | 'cap'> =>
  emit > 0
    ? { emit, age, cap: REST_CAP + (EFFECT_CAP - REST_CAP) * emit }
    : { emit: 0, age: 0, cap: REST_CAP }

function effect(t: number): Pick<PotionShow, 'emit' | 'age' | 'cap'> {
  const age = t - SHOW_BEATS.pop
  if (!(age > 0 && t < SHOW_BEATS.settle)) return effectAt(0, 0)
  const fading = smoothstep((age - (EFFECT_SECONDS - EMIT.fall)) / EMIT.fall)
  return effectAt(easeOutCubic(age / EMIT.rise) * (1 - fading), age)
}

/** Reduced motion: one still moment of the effect, faded in, held and faded out. */
function stillEffect(t: number): Pick<PotionShow, 'emit' | 'age' | 'cap'> {
  const e = t - MIX_REVEAL_SECONDS_REDUCED
  const { fade, hold, fadeOut } = REDUCED
  const emit = e < fade ? e / fade : e < fade + hold ? 1 : 1 - (e - fade - hold) / fadeOut
  return effectAt(Math.min(Math.max(emit, 0), 1), EFFECT_STILL_AGE)
}

function reducedShow(t: number, mixFrom: number, firstMix: boolean): PotionShow {
  const mix = firstMix ? mixFrom + (1 - mixFrom) * Math.min(t / MIX_REVEAL_SECONDS_REDUCED, 1) : 1
  const out = t >= MIX_REVEAL_SECONDS_REDUCED
  return {
    ...showRest(mix),
    stopperLift: out ? STOPPER_OUT : 0,
    stopperAside: out ? 1 : 0,
    popped: out,
    ...stillEffect(t),
  }
}

function aside(t: number): number {
  const b = SHOW_BEATS
  if (t < b.pop || t >= b.settle) return 0
  return (
    smoothstep((t - b.pop - ASIDE.after) / ASIDE.out) *
    (1 - smoothstep((t - (b.settle - ASIDE.back)) / ASIDE.back))
  )
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
    return {
      stopperLift: popped + bob * smoothstep((t - b.pop) / POP_SECONDS),
      stopperTurn: STOPPER_TURN,
    }
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
    stopperAside: aside(t),
    popped: t >= b.pop && t < b.sink,
    ...effect(t),
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
    stopperAside: lerp(from.stopperAside, to.stopperAside, w),
    popped: w < 0.5 ? from.popped : to.popped,
    emit: lerp(from.emit, to.emit, w),
    // An effect that is fading out keeps its own age.
    age: to.emit > 0 ? to.age : from.age,
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
    if (from && !options.reducedMotion && t < RESTART_SECONDS) {
      show = blendShow(from, show, smoothstep(t / RESTART_SECONDS))
      // The old effect runs on as it fades.
      if (show !== from && from.emit > 0) show.age = from.age + t
    }
    if (leftAt === null) return show
    // Put back before the pop, the stopper may still pop on the way down: nothing comes out.
    if (show.emit > 0 && leftAt - this.start < popSeconds(options))
      show = { ...show, ...effectAt(0, 0) }
    const rest = showRest(options.full ? 1 : restMix)
    const w = options.reducedMotion ? 1 : smoothstep((now - leftAt) / LEAVE_SECONDS)
    // The vortex fades where it has turned to, never unwinding.
    return w < 1 ? blendShow(show, { ...rest, spin: show.spin }, w) : rest
  }
}
