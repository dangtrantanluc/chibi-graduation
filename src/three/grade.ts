import * as THREE from 'three'
import gsap from 'gsap'
import { uNight } from './lib/materials'
import { useUI } from '../state/store'

/*
 * The light of the journey. One day stands for the four years: Lực sets out
 * before dawn with a single lamp, the sun comes up over his home town, the
 * city is grey until a friend calls his name, Hà Nội is a gold afternoon, he
 * reaches home at sunset — and the capital is all lanterns, at night.
 * The director calls setGrade() at each threshold; everything that lights or
 * tints the world reads `grade` (sky, sun, fill, haze, clouds, mountains).
 */

interface GradeDef {
  /** sky: zenith, mid, horizon, and below the horizon */
  top: string
  mid: string
  horizon: string
  low: string
  /** the glow round the sun in the sky */
  glow: string
  /** key light */
  sun: string
  sunI: number
  /** sun elevation, radians (its bearing never changes: the mountains' light is painted) */
  elev: number
  hemiSky: string
  hemiGround: string
  hemiI: number
  fillI: number
  envI: number
  /** distance haze and backdrop */
  fog: string
  cloud: string
  cloudGlow: string
  /** tint over the painted mountain rim */
  range: string
  /** 0 day ‥ 1 night: stars and moon, lantern glow, moonlit figures (drives uNight) */
  night: number
  /** how much the lamp in Lực's hand matters: 0 (lost in daylight) ‥ 1 (the only light) */
  lamp: number
}

export type GradeName = 'predawn' | 'dawn' | 'overcast' | 'noon' | 'autumn' | 'sunset' | 'night'

const GRADES: Record<GradeName, GradeDef> = {
  // before first light: stars, a setting moon, a faint warmth along the horizon
  predawn: {
    top: '#0a0f2c', mid: '#1b2352', horizon: '#5b4a7c', low: '#262550', glow: '#ff9a72',
    sun: '#a3b4f2', sunI: 1.15, elev: 0.2,
    hemiSky: '#5a69ba', hemiGround: '#35304f', hemiI: 0.68, fillI: 0.3, envI: 0.16,
    fog: '#262c5a', cloud: '#636da0', cloudGlow: '#383c6e', range: '#59639f', night: 0.82, lamp: 1,
  },
  // sunrise over Bình Định
  dawn: {
    top: '#5670b8', mid: '#e3a3ac', horizon: '#ffd7a4', low: '#f1b596', glow: '#ffd7a6',
    sun: '#ffcb9a', sunI: 3.0, elev: 0.24,
    hemiSky: '#c2cbf4', hemiGround: '#dfa986', hemiI: 0.85, fillI: 0.38, envI: 0.45,
    fog: '#efc2ae', cloud: '#fff5ee', cloudGlow: '#f5bfa8', range: '#ffffff', night: 0, lamp: 0.3,
  },
  // a grey city sky: the first years, lost in the crowd
  overcast: {
    top: '#687893', mid: '#93a0b3', horizon: '#b5bcc6', low: '#8b95a3', glow: '#c9d1dc',
    sun: '#c6d2e6', sunI: 1.35, elev: 0.7,
    hemiSky: '#b3bfd8', hemiGround: '#878c96', hemiI: 1.05, fillI: 0.42, envI: 0.34,
    fog: '#a4aebc', cloud: '#cfd6e0', cloudGlow: '#8a94a4', range: '#aab6ca', night: 0.14, lamp: 0.75,
  },
  // the sun breaks through: Sài Gòn at midday
  noon: {
    top: '#3c7bcc', mid: '#8bbdec', horizon: '#dcedf6', low: '#b6d9ec', glow: '#fff5d6',
    sun: '#fff0d2', sunI: 3.5, elev: 0.82,
    hemiSky: '#cde0ff', hemiGround: '#c8c09e', hemiI: 0.95, fillI: 0.4, envI: 0.5,
    fog: '#d6e8f2', cloud: '#ffffff', cloudGlow: '#c6dcee', range: '#e4eeff', night: 0, lamp: 0.08,
  },
  // Hà Nội, a gold autumn afternoon
  autumn: {
    top: '#5a77b6', mid: '#d8b789', horizon: '#ffde9e', low: '#efc68e', glow: '#ffdd98',
    sun: '#ffce86', sunI: 3.3, elev: 0.44,
    hemiSky: '#c8cee6', hemiGround: '#dfae6e', hemiI: 0.86, fillI: 0.38, envI: 0.46,
    fog: '#efd0a6', cloud: '#fff4e0', cloudGlow: '#f1c68e', range: '#fff3e0', night: 0, lamp: 0.2,
  },
  // home at sunset — the light the whole board was first painted in
  sunset: {
    top: '#41508f', mid: '#b58db4', horizon: '#ffc7a0', low: '#e7a58f', glow: '#ffd49a',
    sun: '#ffc28a', sunI: 3.4, elev: 0.306,
    hemiSky: '#b9c5f2', hemiGround: '#d9a27e', hemiI: 0.85, fillI: 0.38, envI: 0.45,
    fog: '#e8b8a6', cloud: '#fff4ec', cloudGlow: '#f3b9a2', range: '#ffffff', night: 0, lamp: 0.5,
  },
  // the capital by night: a moon, stars, lanterns
  night: {
    top: '#070b24', mid: '#141c4a', horizon: '#33407e', low: '#1a1f4a', glow: '#ffb48a',
    sun: '#a9bdff', sunI: 1.35, elev: 0.36,
    hemiSky: '#5263b8', hemiGround: '#2f2c52', hemiI: 0.7, fillI: 0.3, envI: 0.14,
    fog: '#1b2350', cloud: '#566394', cloudGlow: '#2a3468', range: '#4f5c9c', night: 1, lamp: 1,
  },
}

const COLORS = ['top', 'mid', 'horizon', 'low', 'glow', 'sun', 'hemiSky', 'hemiGround', 'fog', 'cloud', 'cloudGlow', 'range'] as const
const NUMBERS = ['sunI', 'elev', 'hemiI', 'fillI', 'envI', 'night', 'lamp'] as const
type ColorKey = (typeof COLORS)[number]
type NumberKey = (typeof NUMBERS)[number]
type Live = Record<ColorKey, THREE.Color> & Record<NumberKey, number>

const live = (d: GradeDef): Live => {
  const o = {} as Live
  for (const k of COLORS) o[k] = new THREE.Color(d[k])
  for (const k of NUMBERS) o[k] = d[k]
  return o
}

/** the light right now — read every frame by the sky, the lights, the haze */
export const grade: Live = live(GRADES.predawn)
/** where the sun (or moon) stands; shared with the sky dome and the shadow light */
export const sunDir = new THREE.Vector3()
// its bearing, fixed
const SUN_X = -0.652
const SUN_Z = -0.757

function sync() {
  sunDir.set(SUN_X * Math.cos(grade.elev), Math.sin(grade.elev), SUN_Z * Math.cos(grade.elev))
  uNight.value = grade.night
  // the paper UI follows: indigo and gold after dark
  const theme = grade.night > 0.5 ? 'dark' : 'light'
  if (useUI.getState().theme !== theme) {
    useUI.setState({ theme })
    document.documentElement.dataset.theme = theme
  }
}
sync()

let tween: gsap.core.Tween | null = null
/** Move the light to another time of day, over `duration` seconds (0 = at once, e.g. behind a wipe). */
export function setGrade(name: GradeName, duration = 0, ease = 'sine.inOut') {
  tween?.kill()
  const to = live(GRADES[name])
  if (duration <= 0) {
    for (const k of COLORS) grade[k].copy(to[k])
    for (const k of NUMBERS) grade[k] = to[k]
    sync()
    return
  }
  const from = {} as Live
  for (const k of COLORS) from[k] = grade[k].clone()
  for (const k of NUMBERS) from[k] = grade[k]
  const o = { k: 0 }
  tween = gsap.to(o, {
    k: 1,
    duration,
    ease,
    onUpdate: () => {
      for (const k of COLORS) grade[k].lerpColors(from[k], to[k], o.k)
      for (const k of NUMBERS) grade[k] = from[k] + (to[k] - from[k]) * o.k
      sync()
    },
  })
}
