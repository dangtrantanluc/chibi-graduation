import * as THREE from 'three'

/**
 * Transient, per-frame world state. Mutated by the story director (GSAP) and
 * read inside useFrame — never triggers React renders.
 */

/** Lực, his university friend (IT girl), his Hà Nội friend, his father and mother, the princess */
export type CharId = 'luc' | 'uni' | 'hanoi' | 'father' | 'mother' | 'princess'

export type Action =
  | 'none'
  | 'wave'
  | 'bow'
  | 'cheer'
  | 'surprise'
  | 'beckon'
  | 'standUp'
  | 'hop'
  | 'smile'
  | 'laugh'
  | 'dance'
  /** arms folded, a bow — how a Vietnamese child greets their parents (khoanh tay chào) */
  | 'greet'
  /** holding the graduation notice open in both hands */
  | 'present'
  | 'clap'
  /** an open-palmed sweep of the arm: "go on, in you go" */
  | 'usher'
  /** Bình Định martial-arts salute: right fist into the left palm */
  | 'omQuyen'
  /** a shy grin, scratching the back of his head (gãi đầu) */
  | 'scratch'
  /** V-sign held toward the guest, with a wink */
  | 'peace'
  | 'hi5'
  | 'type'
  /** offering something (a bouquet) toward the guest */
  | 'offer'
  | 'think'

export type Mood = 'calm' | 'happy' | 'surprised'

export interface CharState {
  pos: THREE.Vector3
  rotY: number
  faceY: number | null
  path: THREE.Vector3[]
  speed: number
  pose: 'stand' | 'sit'
  action: Action
  actionT: number
  look: 'camera' | THREE.Vector3 | null
  mood: Mood
}

function char(pos: [number, number, number], rotY = 0, pose: 'stand' | 'sit' = 'stand'): CharState {
  return {
    pos: new THREE.Vector3(...pos),
    rotY,
    faceY: rotY,
    path: [],
    speed: 1.4,
    pose,
    action: 'none',
    actionT: -99,
    look: null,
    mood: 'calm',
  }
}

/**
 * Foreground cut-hiders: the North–South express rushing past the lens, a
 * gust of Hà Nội autumn leaves, bamboo culms of a village hedge.
 */
export type WipeKind = 'none' | 'train' | 'leaves' | 'bamboo'

export interface LightSlot {
  pos: THREE.Vector3
  color: THREE.Color
  intensity: number
  distance: number
}

export const world = {
  time: 0,
  cam: {
    pos: new THREE.Vector3(0, 4.2, 27),
    target: new THREE.Vector3(0, 2.2, 5),
    fov: 30,
    /** world point kept in focus */
    focus: new THREE.Vector3(1.5, 1, 7.3),
    /** 0‥1 depth-of-field strength */
    dof: 1,
    /** depth (world units) kept sharp around the focus point */
    range: 3.2,
    /** 0‥1 tilt-shift strength (miniature look on wide shots) */
    tilt: 0.35,
    /** 0‥1 how much the "handheld" drift and pointer parallax apply */
    drift: 1,
    /** 0‥1 how far the rig may dolly back on narrow (portrait) screens */
    backoff: 1,
    /** how far the guest may drag-orbit around the target (radians) and zoom */
    orbit: { yaw: 0.55, up: 0.3, down: 0.12, zoom: 0.25 },
  },
  /** guest's drag-to-look offsets, eased back to 0 on every new shot */
  look: { yaw: 0, pitch: 0, zoom: 0, active: false },
  chars: {
    luc: char([1.55, 0, 7.35], 0, 'sit'),
    uni: char([1.05, 0, -6.35], 0.4, 'sit'),
    hanoi: char([-1.75, 0, -21.4], 0.5),
    father: char([-0.55, 0, -35.3], 0.15),
    mother: char([0.55, 0, -35.3], -0.15),
    princess: char([0, 0, -41.9], 0),
  } as Record<CharId, CharState>,
  wipe: { kind: 'none' as WipeKind, p: 0 },
  /** morning light pouring through the Hoàng Đế gate as Lực sets off */
  gate: { light: 0 },
  /** extra brightness per lantern zone */
  glow: { hanoi: 0, village: 0, hue: 0 },
  /** 0‥1 village lanterns lighting up one after another (golden threads) */
  villageWave: 0,
  /** bảng vàng unfurl 0‥1 */
  scroll: 0,
  /** Lực's graduation notice 0 (rolled) ‥ 1 (open) */
  diploma: 0,
  /** where the notice is (updated by its rig) — the golden threads start here */
  diplomaPos: new THREE.Vector3(0, -50, 0),
  /** IT friend's laptop lid 0 (closed) ‥ 1 (open) */
  laptop: 0,
  /** "</>" speech bubble over the IT friend 0‥1 */
  bubble: 0,
  /** where the directional shadow camera is centred, and its half-size */
  shadowFocus: new THREE.Vector3(0, 0, 4),
  shadowSize: 14,
  lights: [0, 1, 2].map(() => ({
    pos: new THREE.Vector3(0, -50, 0),
    color: new THREE.Color('#ffb46b'),
    intensity: 0,
    distance: 9,
  })) as LightSlot[],
}

// ── tiny event bus ──────────────────────────────────────────
export type WorldEvent =
  | { type: 'gust'; x: number; z: number; strength: number; radius: number }
  | { type: 'sparkle'; pos: THREE.Vector3; count: number; color?: string }

type Listener = (e: WorldEvent) => void
const listeners = new Set<Listener>()
export function emit(e: WorldEvent) {
  listeners.forEach((l) => l(e))
}
export function on(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// ── character helpers used by the director ─────────────────
export function act(id: CharId, action: Action, mood?: Mood) {
  const c = world.chars[id]
  c.action = action
  c.actionT = world.time
  if (mood) c.mood = mood
}

export function walk(id: CharId, pts: [number, number, number][], speed = 1.4, faceY: number | null = null) {
  const c = world.chars[id]
  c.path = pts.map((p) => new THREE.Vector3(...p))
  c.speed = speed
  c.faceY = faceY
  c.pose = 'stand'
}

export function place(id: CharId, pos: [number, number, number], rotY: number, pose: 'stand' | 'sit' = 'stand') {
  const c = world.chars[id]
  c.pos.set(...pos)
  c.rotY = rotY
  c.faceY = rotY
  c.path = []
  c.pose = pose
  c.action = 'none'
}

export function lookAt(id: CharId, target: 'camera' | CharId | [number, number, number] | null) {
  const c = world.chars[id]
  if (target === null || target === 'camera') c.look = target
  else if (Array.isArray(target)) c.look = new THREE.Vector3(...target)
  else {
    // look at another character's face (the vector is live: it follows them)
    const o = world.chars[target]
    c.look = faceProbe(o)
  }
}

const probes = new WeakMap<CharState, THREE.Vector3>()
/** a Vector3 kept at a character's face height, refreshed by their rig each frame */
export function faceProbe(c: CharState) {
  let v = probes.get(c)
  if (!v) {
    v = new THREE.Vector3()
    probes.set(c, v)
  }
  return v
}
