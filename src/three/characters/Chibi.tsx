import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { G, mergeKit, type MatKey, type Part, type V3 } from '../lib/kit'
import { celMat, outlineMat, toonRamp, uNight } from '../lib/materials'
import { shadowTex } from '../lib/textures'
import { emit, faceProbe, world, type CharId, type CharState } from '../../state/world'
import { FacePainter, facePatchGeometry, type EyeState, type FaceStyle, type MouthState } from './face'

// ── Proportions (units ≈ a 1.4-tall collectible figure) ─────
export const R = 0.4
export const HIP = 0.25
export const NECK = 0.33
export const HEAD_UP = 0.33
export const SHOULDER_Y = 0.27
export const SHOULDER_X = 0.19
export const HEAD_S: V3 = [1, 0.93, 0.95]
/**
 * Figure proportions: the body (everything below the neck) is built at the
 * sizes above and then scaled by BODY, and the head by HEAD — about 2.4 heads
 * tall, so there is enough body for a pose to read.
 */
export const BODY = 1.2
export const HEAD = 0.95
/** shoulder → elbow, and elbow → wrist */
export const UPPER = 0.105
export const FORE = 0.1
const Z = new THREE.Vector3(0, 0, 1)
const FACE_DAY = new THREE.Color('#ffffff')
export const FACE_NIGHT = new THREE.Color('#c4bcd4')

/** Matrix for a flat/feature part sitting on the head surface, facing outwards. */
export function faceMatrix(x: number, y: number, off: number, s: V3 = [1, 1, 1], rotZ = 0, local?: THREE.Matrix4) {
  const a = R * HEAD_S[0]
  const b = R * HEAD_S[1]
  const c = R * HEAD_S[2]
  const k = 1 - (x / a) ** 2 - (y / b) ** 2
  const z = c * Math.sqrt(Math.max(k, 0.0001))
  const n = new THREE.Vector3(x / (a * a), y / (b * b), z / (c * c)).normalize()
  const o = new THREE.Object3D()
  o.position.set(x, y, z).addScaledVector(n, off)
  o.quaternion.setFromUnitVectors(Z, n)
  if (rotZ) o.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Z, rotZ))
  o.scale.set(...s)
  o.updateMatrix()
  return local ? o.matrix.clone().multiply(local) : o.matrix.clone()
}

/** Lathe body with crisp colour bands by height (extra rings at each band edge). */
export function lathe(profile: [number, number][], bands: [number, string][], seg = 22) {
  const pts: [number, number][] = []
  const edges = bands.map(([y]) => y).filter((y) => y > profile[0][1] && y < profile[profile.length - 1][1])
  for (let i = 0; i < profile.length; i++) {
    pts.push(profile[i])
    if (i === profile.length - 1) break
    const [r0, y0] = profile[i]
    const [r1, y1] = profile[i + 1]
    for (const e of edges) {
      if (e > y0 && e < y1) {
        const k = (e - y0) / (y1 - y0)
        const r = r0 + (r1 - r0) * k
        pts.push([r, e - 0.0015], [r, e + 0.0015])
      }
    }
  }
  const g = new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  )
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    let pick = bands[0][1]
    for (const [by, bc] of bands) if (y >= by) pick = bc
    c.set(pick)
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/** Lathe for a textured garment: white vertex colour, v mapped by height (hem 0 → collar 1). */
export function garmentLathe(profile: [number, number][], seg = 32) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i]
    const [r1, y1] = profile[i + 1]
    for (let k = 0; k < 4; k++) {
      const t = k / 4
      pts.push(new THREE.Vector2(r0 + (r1 - r0) * t, y0 + (y1 - y0) * t))
    }
  }
  pts.push(new THREE.Vector2(...profile[profile.length - 1]))
  const g = new THREE.LatheGeometry(pts, seg)
  const ys = profile.map((p) => p[1])
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - lo) / (hi - lo))
  return g
}

export const TORSO_PROFILE: [number, number][] = [
  [0.0, -0.06],
  [0.17, -0.06],
  [0.205, 0.0],
  [0.218, 0.08],
  [0.205, 0.2],
  [0.165, 0.3],
  [0.1, 0.36],
  [0.0, 0.372],
]

// ── Look specification ──────────────────────────────────────
/**
 * A signature way of standing:
 *  rest    arms loose at the sides, elbows a little bent
 *  pockets hands tucked into the trouser pockets
 *  akimbo  one hand on the hip, the other holding something (akimboR: mirrored)
 *  lamp    a lamp carried in the left hand, the right in a pocket
 *  carry   both hands holding a basket in front
 *  bouquet one arm cradling flowers against the shoulder, the other behind the back
 *  clasp   hands clasped in front
 *  court   hands held together at the waist inside wide sleeves
 */
export type IdlePose = 'rest' | 'pockets' | 'akimbo' | 'akimboR' | 'lamp' | 'carry' | 'bouquet' | 'clasp' | 'court'

export interface RibbonSpec {
  anchor: 'neck' | 'head' | 'hips'
  offset: V3
  color: string
  width: number
  length: number
  segs?: number
  side?: number
}

export interface ChibiLook {
  skin: string
  face: FaceStyle
  head?: (p: Part[]) => void
  torso: (p: Part[]) => void
  arm: {
    sleeve: string
    hand?: string
    wide?: boolean
    cuff?: string
    long?: boolean
    /** short sleeve: a sleeve cap with the bare forearm below */
    short?: boolean
  }
  /** painted textures for parts tagged m: 'garment' (torso) and the sleeves */
  garment?: () => THREE.Texture
  sleeveTex?: () => THREE.Texture
  leg?: {
    pant: string
    shoe: string
    hidden?: boolean
    sock?: string
    /** wide-leg trousers / jeans with a rolled cuff */
    wide?: boolean
    cuff?: string
    /** chunky sneaker: a thick sole and a side stripe */
    sole?: string
    stripe?: string
    /** knee-length shorts over bare shins */
    shorts?: boolean
    /** bare feet (farm folk) */
    bare?: boolean
  }
  /** how this character stands when nothing is happening (see restArms) */
  idle?: IdlePose
  ribbons?: RibbonSpec[]
  handR?: ReactNode
  handL?: ReactNode
  torsoExtra?: ReactNode
  /** things carried on the lap / at the pelvis (they don't bow with the torso) */
  hipsExtra?: ReactNode
  headExtra?: ReactNode
  scale?: number
}

function buildHead(look: ChibiLook) {
  const p: Part[] = [
    { g: G.sphere, c: look.skin, s: [R * HEAD_S[0], R * HEAD_S[1], R * HEAD_S[2]] },
    { g: G.sphereLo, c: look.skin, p: [R * 0.97, -0.06, 0], s: [0.05, 0.075, 0.06] },
    { g: G.sphereLo, c: look.skin, p: [-R * 0.97, -0.06, 0], s: [0.05, 0.075, 0.06] },
  ]
  look.head?.(p)
  return mergeKit(p)
}

/** Two-part arm: the upper arm hangs from the shoulder, the forearm (and hand) from the elbow. */
function buildArm(look: ChibiLook) {
  const up: Part[] = []
  const fo: Part[] = []
  const a = look.arm
  const tex = !!look.sleeveTex
  const sleeveC = tex ? '#ffffff' : a.sleeve
  const sleeveM: MatKey | undefined = tex ? 'sleeve' : undefined
  /** a sleeve tube whose texture v runs v0 (lower edge) → v1 (upper edge) */
  const tube = (rTop: number, rBot: number, len: number, y: number, v0: number, v1: number, seg = 16, open = true): Part => {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1, open)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + (v1 - v0) * uv.getY(i))
    return { g, c: sleeveC, m: sleeveM, p: [0, y, 0] }
  }
  if (a.wide) {
    // a wide court sleeve, flaring from the shoulder to a cuff beyond the hand
    const len = a.long ? 0.3 : 0.22
    const k = UPPER / len
    const rE = 0.065 + (0.14 - 0.065) * k
    up.push(tube(0.065, rE, UPPER, -UPPER / 2 + 0.01, 1 - k, 1, 18))
    up.push({ g: G.sphere, c: a.sleeve, p: [0, -UPPER, 0], s: rE })
    fo.push(tube(rE, 0.14, len - UPPER, -(len - UPPER) / 2 + 0.01, 0, 1 - k, 18))
    fo.push({ g: new THREE.CylinderGeometry(0.135, 0.135, 0.02, 18), c: a.cuff ?? a.sleeve, p: [0, -(len - UPPER) + 0.01, 0] })
  } else if (a.short) {
    // puffed short sleeve on the upper arm, then the bare elbow and forearm
    up.push(tube(0.064, 0.074, 0.1, -0.045, 0, 1, 16, false))
    up.push({ g: G.sphere, c: a.sleeve, p: [0, 0, 0], s: 0.064 })
    if (a.cuff) up.push({ g: new THREE.CylinderGeometry(0.076, 0.076, 0.018, 16), c: a.cuff, p: [0, -0.094, 0] })
    up.push({ g: G.sphere, c: look.skin, p: [0, -UPPER, 0], s: 0.047 })
    fo.push({ g: new THREE.CapsuleGeometry(0.044, 0.05, 4, 10), c: look.skin, p: [0, -0.05, 0] })
  } else if (tex) {
    up.push(tube(0.06, 0.065, UPPER, -UPPER / 2, 0.42, 1, 14))
    up.push({ g: G.sphere, c: a.sleeve, p: [0, 0, 0], s: 0.06 })
    up.push({ g: G.sphere, c: a.sleeve, p: [0, -UPPER, 0], s: 0.065 })
    fo.push(tube(0.065, 0.069, 0.075, -0.0375, 0, 0.42, 14))
  } else {
    up.push({ g: new THREE.CapsuleGeometry(0.058, 0.05, 4, 10), c: a.sleeve, p: [0, -0.05, 0] })
    up.push({ g: G.sphere, c: a.sleeve, p: [0, -UPPER, 0], s: 0.058 })
    fo.push({ g: new THREE.CapsuleGeometry(0.056, 0.035, 4, 10), c: a.sleeve, p: [0, -0.04, 0] })
    if (a.cuff) fo.push({ g: G.cyl, c: a.cuff, p: [0, -0.05, 0], s: [0.063, 0.04, 0.063] })
  }
  // the hand: a soft mitten with a thumb (it points forward when the arm hangs)
  const hc = a.hand ?? look.skin
  fo.push({ g: G.sphere, c: hc, p: [0, -FORE, 0], s: [0.062, 0.07, 0.056] })
  fo.push({ g: G.sphereLo, c: hc, p: [0, -FORE + 0.014, 0.048], r: [0.6, 0, 0], s: [0.025, 0.036, 0.025] })
  return { upper: mergeKit(up), fore: mergeKit(fo) }
}

function buildLeg(look: ChibiLook) {
  const l = look.leg ?? { pant: '#444', shoe: '#222' }
  const p: Part[] = []
  if (l.shorts) {
    // bare shin, shorts rolled just above the knee
    p.push({ g: new THREE.CapsuleGeometry(0.058, 0.09, 4, 10), c: look.skin, p: [0, -0.1, 0] })
    p.push({ g: G.sphere, c: l.pant, p: [0, 0.0, 0], s: [0.084, 0.06, 0.084] })
    p.push({ g: new THREE.CylinderGeometry(0.084, 0.09, 0.1, 16, 1, true), c: l.pant, p: [0, -0.04, 0] })
    p.push({ g: new THREE.CylinderGeometry(0.094, 0.094, 0.028, 16), c: l.cuff ?? l.pant, p: [0, -0.092, 0] })
  } else if (l.wide) {
    // wide-leg trousers flaring to a rolled cuff that sits on the shoe
    p.push({ g: G.sphere, c: l.pant, p: [0, 0.0, 0], s: [0.079, 0.05, 0.079] })
    p.push({ g: new THREE.CylinderGeometry(0.079, 0.097, 0.17, 18, 1, true), c: l.pant, p: [0, -0.085, 0] })
    p.push({ g: new THREE.CylinderGeometry(0.1, 0.101, 0.034, 18), c: l.cuff ?? l.pant, p: [0, -0.168, 0] })
    // a soft crease down the front
    p.push({ g: G.box, c: l.cuff ?? l.pant, p: [0, -0.085, 0.086], r: [0.11, 0, 0], s: [0.006, 0.15, 0.006] })
  } else {
    p.push({ g: new THREE.CapsuleGeometry(0.072, 0.07, 4, 10), c: l.pant, p: [0, -0.08, 0] })
  }
  if (l.bare) {
    // a bare foot with a hint of toes
    p.push({ g: G.sphere, c: look.skin, p: [0, -0.205, 0.035], s: [0.07, 0.045, 0.1] })
    for (let k = -1; k <= 1; k++) p.push({ g: G.sphereXs, c: look.skin, p: [k * 0.03, -0.215, 0.125], s: [0.02, 0.018, 0.02] })
  } else if (l.sole) {
    // chunky sneaker: rounded upper, thick contrasting sole, a side stripe
    p.push({ g: G.sphere, c: l.shoe, p: [0, -0.19, 0.03], s: [0.084, 0.056, 0.115] })
    p.push({ g: G.sphere, c: l.sole, p: [0, -0.225, 0.03], s: [0.09, 0.028, 0.124] })
    if (l.stripe)
      for (const sx of [-1, 1])
        p.push({ g: G.sphereLo, c: l.stripe, p: [sx * 0.074, -0.19, 0.035], r: [0, 0, sx * 0.35], s: [0.012, 0.022, 0.062] })
    p.push({ g: G.sphereLo, c: '#f4f1ea', p: [0, -0.16, 0.085], s: [0.035, 0.012, 0.02] })
  } else {
    p.push({ g: G.sphere, c: l.shoe, p: [0, -0.19, 0.028], s: [0.082, 0.06, 0.108] })
  }
  if (l.sock) p.push({ g: G.cyl, c: l.sock, p: [0, -0.14, 0], s: [0.075, 0.06, 0.075] })
  return mergeKit(p)
}

const GLOSSY = new Set<MatKey>(['gloss', 'gold', 'ceramic', 'bronze'])

/** Cel-shaded mesh + its ink outline (inverted hull). */
export function Cel({
  geos,
  outline = true,
  shadow = true,
  tex,
}: {
  geos: Map<MatKey, THREE.BufferGeometry>
  outline?: boolean
  shadow?: boolean
  tex?: Partial<Record<MatKey, THREE.Texture>>
}) {
  return (
    <>
      {[...geos].map(([k, g]) => (
        <group key={k}>
          <mesh geometry={g} material={celMat(GLOSSY.has(k) ? 'gloss' : 'cloth', tex?.[k])} castShadow={shadow} />
          {outline && <mesh geometry={g} material={outlineMat()} />}
        </group>
      ))}
    </>
  )
}

// ── Animation helpers ──────────────────────────────────────
const JOINTS = [
  'hipY',
  'hipX',
  'hipR',
  'bob',
  'squash',
  'spin',
  'tX',
  'tY',
  'tZ',
  'hX',
  'hY',
  'hZ',
  // shoulders (x: + back / − forward, z: + toward the character's left), elbows (x: flex forward, z as the shoulder)
  'aLx',
  'aLz',
  'aRx',
  'aRz',
  'eLx',
  'eLz',
  'eRx',
  'eRz',
  // a little cartoon stretch of the whole arm (0 = none), so a hand can reach someone else
  'sL',
  'sR',
  'lLx',
  'lRx',
  'lLz',
  'lRz',
] as const
type Joint = (typeof JOINTS)[number]
type Pose = Record<Joint, number>
const zeroPose = (): Pose => Object.fromEntries(JOINTS.map((k) => [k, 0])) as Pose

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}
/** attack–hold–release envelope */
const env = (t: number, dur: number, att = 0.25, rel = 0.35) => sstep(0, att, t) * (1 - sstep(dur - rel, dur, t))
const lerp = THREE.MathUtils.lerp
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** [shoulder x, shoulder z, elbow flex, elbow z] for the left arm; the right arm mirrors z */
type ArmPose = [number, number, number, number]
const ARMS: Record<IdlePose, { l: ArmPose; r: ArmPose }> = {
  rest: { l: [0.04, 0.17, 0.32, -0.12], r: [0.04, 0.17, 0.32, -0.12] },
  pockets: { l: [0.3, 0.3, 0.55, -0.4], r: [0.3, 0.3, 0.55, -0.4] },
  akimbo: { l: [0.25, 0.72, 0.35, -1.75], r: [0.06, 0.2, 0.3, -0.1] },
  akimboR: { l: [0.06, 0.2, 0.3, -0.1], r: [0.25, 0.72, 0.35, -1.75] },
  lamp: { l: [-0.42, 0.2, 0.8, -0.05], r: [0.3, 0.3, 0.55, -0.4] },
  carry: { l: [-0.3, 0.06, 1.2, -0.42], r: [-0.3, 0.06, 1.2, -0.42] },
  bouquet: { l: [-0.4, 0.08, 1.75, -0.45], r: [0.42, 0.12, 0.25, -0.5] },
  clasp: { l: [-0.22, 0.05, 0.78, -0.6], r: [-0.22, 0.05, 0.78, -0.6] },
  court: { l: [-0.25, 0.12, 1.2, -0.55], r: [-0.25, 0.12, 1.2, -0.55] },
}
/** poses that hold something in front: the arms keep their place while walking */
const CARRYING = new Set<IdlePose>(['carry', 'bouquet', 'court'])
/** … and those whose LEFT hand alone is taken (it sits out the one-armed flourishes) */
const LEFT_FULL = new Set<IdlePose>(['carry', 'bouquet', 'court', 'lamp'])
/** put both arms in a standing pose (k = how far toward it, for blending) */
function restArms(tg: Pose, idle: IdlePose, breathe: number) {
  const { l, r } = ARMS[idle]
  tg.aLx = l[0]
  tg.aLz = l[1] + breathe * 0.02
  tg.eLx = l[2] + breathe * 0.02
  tg.eLz = l[3]
  tg.aRx = r[0]
  tg.aRz = -r[1] - breathe * 0.02
  tg.eRx = r[2] + breathe * 0.02
  tg.eRz = -r[3]
}

export const ACTION_DUR: Record<string, number> = {
  wave: 2.4,
  bow: 2.3,
  cheer: 1.9,
  surprise: 1.0,
  beckon: 2.0,
  standUp: 0.8,
  hop: 0.6,
  smile: 1.8,
  laugh: 1.7,
  dance: 3.4,
  greet: 2.4,
  clap: 2.2,
  usher: 2.6,
  omQuyen: 2.0,
  scratch: 1.9,
  peace: 2.6,
  hi5: 1.2,
  offer: 3.2,
  think: 2.6,
  bowDeep: 3.8,
  pat: 2.9,
  patBack: 1.7,
  nudge: 0.7,
  tear: 2.6,
  lookAbout: 6.6,
}

/**
 * Limited animation: the pose is sampled at 12 fps and held in between
 * ("animating on twos"), like hand-drawn anime. Root travel stays smooth.
 */
const ANIME_STEP = 1 / 12

// ── Component ──────────────────────────────────────────────
export function Chibi({ id, look, children }: { id: CharId; look: ChibiLook; children?: ReactNode }) {
  const camera = useThree((s) => s.camera)
  const head = useMemo(() => buildHead(look), [look])
  const arm = useMemo(() => buildArm(look), [look])
  const leg = useMemo(() => buildLeg(look), [look])
  const torso = useMemo(() => {
    const p: Part[] = []
    look.torso(p)
    return mergeKit(p)
  }, [look])
  const face = useMemo(() => {
    const painter = new FacePainter(look.face)
    const mat = new THREE.MeshBasicMaterial({
      map: painter.tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    return { painter, mat, geo: facePatchGeometry() }
  }, [look])
  useEffect(() => () => face.painter.tex.dispose(), [face])
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }), [])
  const tex = useMemo(() => ({ garment: look.garment?.(), sleeve: look.sleeveTex?.() }), [look])

  const root = useRef<THREE.Group>(null!)
  const squashG = useRef<THREE.Group>(null!)
  const hips = useRef<THREE.Group>(null!)
  const torsoG = useRef<THREE.Group>(null!)
  const neck = useRef<THREE.Group>(null!)
  const headG = useRef<THREE.Group>(null!)
  const shL = useRef<THREE.Group>(null!)
  const shR = useRef<THREE.Group>(null!)
  const elL = useRef<THREE.Group>(null!)
  const elR = useRef<THREE.Group>(null!)
  const legL = useRef<THREE.Group>(null!)
  const legR = useRef<THREE.Group>(null!)

  const anim = useMemo(
    () => ({
      cur: zeroPose(),
      shown: zeroPose(),
      stepT: 0,
      phase: 0,
      nextBlink: 1 + Math.random() * 2,
      blinkT: -1,
      nextGlance: 0,
      glanceY: 0,
      glanceX: 0,
      kicked: false,
      lastActionT: -1,
      seed: Math.random() * 10,
    }),
    [],
  )

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), w: new THREE.Vector3() }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const c: CharState = world.chars[id]
    const t = world.time
    const a = anim
    const tg = zeroPose()
    const scale = look.scale ?? 1

    if (c.actionT !== a.lastActionT) {
      a.lastActionT = c.actionT
      a.kicked = false
      if (c.action === 'standUp') c.pose = 'stand'
    }
    const tau = t - c.actionT
    const dur = ACTION_DUR[c.action]
    if (dur !== undefined && tau > dur) {
      c.action = 'none'
      if (c.mood !== 'calm') c.mood = 'calm'
    }

    // ── locomotion ──
    let walking = false
    if (c.path.length) {
      const next = c.path[0]
      tmp.v.subVectors(next, c.pos)
      const dist = Math.hypot(tmp.v.x, tmp.v.z)
      if (dist < 0.04) {
        c.pos.copy(next)
        c.path.shift()
      } else {
        walking = true
        // travel keeps to real time even when frames are slow, so walks still land on the story's beats
        const step = Math.min(dist, c.speed * Math.min(rawDt, 0.12))
        c.pos.x += (tmp.v.x / dist) * step
        c.pos.z += (tmp.v.z / dist) * step
        // climb (or descend) evenly along the leg, so stairs are walked, not jumped
        c.pos.y += (next.y - c.pos.y) * (step / dist)
        const heading = Math.atan2(tmp.v.x, tmp.v.z)
        c.rotY += wrapPi(heading - c.rotY) * Math.min(1, dt * 9)
        a.phase += dt * c.speed * 8.2
      }
    } else if (c.faceY !== null) {
      c.rotY += wrapPi(c.faceY - c.rotY) * Math.min(1, dt * 5)
    }

    // ── base pose ──
    const idle: IdlePose = look.idle ?? 'rest'
    const breathe = Math.sin(t * 2.3 + a.seed)
    restArms(tg, idle, breathe)
    tg.squash = breathe * 0.012
    if (c.pose === 'sit') {
      tg.hipY = -0.175
      tg.lLx = -1.38 + 0.3 * Math.sin(t * 3.0 + a.seed)
      tg.lRx = -1.38 + 0.3 * Math.sin(t * 3.0 + a.seed + 2.3)
      // hands resting on the seat either side
      tg.aRx = 0.3
      tg.aRz = -0.36
      tg.eRx = 0.2
      tg.eRz = -0.1
      if (idle === 'lamp') {
        // … except the hand that holds the lamp, out over his knee
        tg.aLx = -0.55
        tg.aLz = 0.3
        tg.eLx = 0.55
        tg.eLz = 0
      } else {
        tg.aLx = 0.3
        tg.aLz = 0.36
        tg.eLx = 0.2
        tg.eLz = 0.1
      }
      tg.tX = -0.06
    } else if (!walking) {
      // contrapposto: the weight settles on one leg, then, after a while, the other
      const w = Math.sin(t * 0.36 + a.seed * 3)
      const ws = w / Math.sqrt(w * w + 0.06)
      tg.hipX = 0.02 * ws
      tg.hipR = 0.05 * ws
      tg.hZ += 0.035 * ws
    }
    if (walking) {
      const s = Math.sin(a.phase)
      tg.lLx = 0.62 * s
      tg.lRx = -0.62 * s
      if (CARRYING.has(idle)) {
        // whatever is carried stays put; it only rocks a little with the stride
        tg.aLx += -0.07 * s
        tg.aRx += 0.07 * s
      } else {
        // arms swing from the shoulder with soft elbows that close on the forward swing
        tg.aRx = 0.5 * s
        tg.aRz = -0.14
        tg.eRx = 0.55 + 0.3 * Math.max(0, -s)
        tg.eRz = 0.1
        if (idle === 'lamp') {
          // the lamp is carried steady, a little out in front to light the way
          tg.aLx += -0.12 - 0.05 * s
        } else {
          tg.aLx = -0.5 * s
          tg.aLz = 0.14
          tg.eLx = 0.55 + 0.3 * Math.max(0, s)
          tg.eLz = -0.1
        }
      }
      tg.bob = 0.045 * Math.abs(s)
      tg.tZ = 0.05 * s
      tg.tY = -0.1 * s
      tg.tX = 0.07
      tg.squash = 0.035 * Math.cos(2 * a.phase)
    }

    // ── actions ──
    let mood = c.mood
    let eyesWide = false
    let wink = false
    let tearful = false
    /** blend the right / left arm toward [shoulder x, shoulder z, elbow flex, elbow z] */
    const armR = (e: number, sx: number, sz: number, ex: number, ez: number) => {
      tg.aRx = lerp(tg.aRx, sx, e)
      tg.aRz = lerp(tg.aRz, sz, e)
      tg.eRx = lerp(tg.eRx, ex, e)
      tg.eRz = lerp(tg.eRz, ez, e)
    }
    const armL = (e: number, sx: number, sz: number, ex: number, ez: number) => {
      tg.aLx = lerp(tg.aLx, sx, e)
      tg.aLz = lerp(tg.aLz, sz, e)
      tg.eLx = lerp(tg.eLx, ex, e)
      tg.eLz = lerp(tg.eLz, ez, e)
    }
    switch (c.action) {
      case 'wave': {
        // upper arm out and up, the forearm waving from the elbow
        const e = env(tau, ACTION_DUR.wave)
        armR(e, -0.15, -1.75, 0.1, -0.85 + 0.42 * Math.sin(tau * 10.5))
        tg.hZ += 0.12 * e
        tg.tZ += 0.05 * e
        tg.bob += 0.02 * e * Math.abs(Math.sin(tau * 5))
        mood = 'happy'
        break
      }
      case 'beckon': {
        // "come on!" — the forearm scoops toward the body
        const e = env(tau, ACTION_DUR.beckon)
        armR(e, -1.05, -0.3, 0.9 + 0.55 * Math.sin(tau * 9), 0.15)
        tg.hZ += -0.14 * e
        tg.tX += 0.05 * e
        mood = 'happy'
        break
      }
      case 'bow': {
        // a hand to the chest, the other swept back
        const e = env(tau, ACTION_DUR.bow, 0.5, 0.6)
        tg.tX += 0.52 * e
        tg.hX += 0.3 * e
        armR(e, -0.85, 0.3, 1.5, 0.75)
        armL(e, 0.45, 0.3, 0.3, 0)
        mood = 'happy'
        break
      }
      case 'omQuyen': {
        // Bình Định martial salute: fist meets palm in front of the chest with a
        // crisp snap, a short firm bow, then the hands drop smartly
        const snap = sstep(0, 0.18, tau) * (1 - sstep(1.55, 1.85, tau))
        const bow = sstep(0.45, 0.72, tau) * (1 - sstep(1.1, 1.4, tau))
        armL(snap, -0.95, 0.05, 1.45, -0.8)
        armR(snap, -0.95, -0.05, 1.45, 0.8)
        tg.tX += 0.34 * bow
        tg.hX += 0.2 * bow
        tg.squash += tau < 0.12 ? -0.05 : 0
        mood = tau > 1.2 ? 'happy' : 'calm'
        break
      }
      case 'scratch': {
        // gãi đầu: a hand to the back of the head, a shy tilt and grin
        const e = env(tau, ACTION_DUR.scratch, 0.3, 0.4)
        armR(e, 0.25, -2.25, -0.35, -1.65 + 0.1 * Math.sin(tau * 14))
        tg.hZ += 0.16 * e
        tg.hX += 0.08 * e
        tg.tZ += -0.04 * e
        mood = 'happy'
        break
      }
      case 'peace': {
        // V-sign held up beside the cheek, head tilted, a wink; the other hand on the hip
        const e = env(tau, ACTION_DUR.peace, 0.18, 0.4)
        armR(e, -1.05, -0.5, 1.75, 0.35)
        if (!LEFT_FULL.has(idle)) armL(e, 0.25, 0.72, 0.35, -1.75)
        tg.hZ += 0.2 * e
        tg.tZ += -0.07 * e
        tg.tX += -0.05 * e
        tg.bob += 0.06 * Math.max(0, Math.sin(Math.min(tau / 0.35, 1) * Math.PI))
        wink = e > 0.3
        mood = 'happy'
        break
      }
      case 'hi5': {
        const up = sstep(0, 0.3, tau) * (1 - sstep(0.75, 1.15, tau))
        const hit = sstep(0.3, 0.38, tau) * (1 - sstep(0.38, 0.6, tau))
        armR(up, -2.2, -0.25, 0.5 - 0.45 * hit, 0.1)
        tg.tX += -0.05 * up + 0.05 * hit
        tg.bob += 0.05 * up
        if (!a.kicked && tau > 0.36) {
          a.kicked = true
          const d = new THREE.Vector3(Math.sin(c.rotY), 0, Math.cos(c.rotY))
          emit({ type: 'sparkle', pos: c.pos.clone().addScaledVector(d, 0.26).setY(c.pos.y + 0.98), count: 8, color: '#fff2b8' })
        }
        mood = 'happy'
        break
      }
      case 'type': {
        // typing on the laptop in her lap: elbows in, small alternating hand taps
        armL(1, -0.3, 0.1, 1.05 + 0.07 * Math.sin(tau * 15), -0.3)
        armR(1, -0.3, -0.1, 1.05 + 0.07 * Math.sin(tau * 15 + 2.1), 0.3)
        tg.hX += 0.28
        tg.tX += 0.08
        break
      }
      case 'offer': {
        // both hands hold something out toward the guest, a little bashful lean
        const e = env(tau, ACTION_DUR.offer, 0.35, 0.5)
        armL(e, -1.05, 0.05, 0.75, -0.4)
        armR(e, -1.05, -0.05, 0.75, 0.4)
        tg.tX += 0.14 * e
        tg.hZ += 0.12 * e
        tg.bob += 0.03 * Math.abs(Math.sin(tau * 3)) * e
        mood = 'happy'
        break
      }
      case 'think': {
        // a hand to the chin, the other arm folded under its elbow
        const e = env(tau, ACTION_DUR.think, 0.35, 0.45)
        armR(e, -0.7, 0.1, 2.25, 0.35)
        if (!LEFT_FULL.has(idle)) armL(e, -0.45, 0.1, 1.45, -1.05)
        tg.hZ += 0.14 * e
        tg.hX += -0.08 * e
        break
      }
      case 'laugh': {
        const e = env(tau, ACTION_DUR.laugh, 0.12, 0.4)
        tg.bob += 0.04 * Math.abs(Math.sin(tau * 12)) * e
        tg.tZ += 0.06 * Math.sin(tau * 12) * e
        tg.tX += -0.08 * e
        tg.hX += -0.12 * e
        mood = 'happy'
        break
      }
      case 'dance': {
        const e = env(tau, ACTION_DUR.dance, 0.3, 0.5)
        const k = tau * 2.2
        tg.spin = sstep(0.2, ACTION_DUR.dance - 0.4, tau) * Math.PI * 2
        armL(e, -0.3 * Math.sin(k), 1.75 + 0.35 * Math.sin(k * 2), 0.2, 0.55)
        armR(e, -0.6 + 0.3 * Math.cos(k), -1.0 - 0.45 * Math.sin(k * 2 + 1.5), 0.45, -0.4)
        tg.tZ += 0.12 * Math.sin(k) * e
        tg.hZ += -0.14 * Math.sin(k) * e
        tg.bob += 0.05 * Math.abs(Math.sin(k * 2)) * e
        tg.lLx += 0.25 * Math.sin(k * 2) * e
        mood = 'happy'
        break
      }
      case 'greet': {
        // khoanh tay: forearms folded across the chest, then a slow, polite bow
        const fold = sstep(0, 0.35, tau) * (1 - sstep(1.95, 2.35, tau))
        const bow = sstep(0.55, 0.95, tau) * (1 - sstep(1.4, 1.85, tau))
        armL(fold, -0.62, 0.1, 1.55, -1.2)
        armR(fold, -0.5, -0.1, 1.5, 1.25)
        tg.tX += 0.4 * bow
        tg.hX += 0.25 * bow
        mood = tau > 1.5 ? 'happy' : 'calm'
        break
      }
      case 'present': {
        // both hands hold the diploma out; they part as it unrolls
        const e = sstep(0, 0.45, tau)
        const s = world.diploma
        armL(e, -0.95, -0.25 + 0.62 * s, 0.85, -0.35)
        armR(e, -0.95, 0.25 - 0.62 * s, 0.85, 0.35)
        tg.hX += 0.1 * e
        mood = s > 0.5 ? 'happy' : 'calm'
        break
      }
      case 'clap': {
        const e = env(tau, ACTION_DUR.clap, 0.2, 0.35)
        const k = Math.sin(tau * 17)
        if (CARRYING.has(idle)) {
          // hands are full: a happy little bounce instead
          tg.bob += 0.035 * Math.abs(k) * e
          tg.hZ += 0.1 * Math.sin(tau * 8.5) * e
        } else {
          armL(e, -0.75, 0.05, 1.3, -0.55 + 0.22 * k)
          armR(e, -0.75, -0.05, 1.3, 0.55 - 0.22 * k)
          tg.bob += 0.025 * Math.abs(k) * e
        }
        mood = 'happy'
        break
      }
      case 'usher': {
        // an open palm swept out toward the way ahead, a little nod
        const e = env(tau, ACTION_DUR.usher, 0.3, 0.45)
        const sweep = sstep(0.2, 0.9, tau)
        armR(e, -1.0, lerp(0.3, -0.95, sweep), lerp(1.1, 0.25, sweep), 0)
        tg.tY += -0.25 * e
        tg.hX += 0.12 * sstep(0.6, 0.9, tau) * (1 - sstep(1.2, 1.6, tau))
        mood = 'happy'
        break
      }
      case 'cheer': {
        const hop = Math.max(0, Math.sin(tau * Math.PI * 2 * 1.15))
        const e = env(tau, ACTION_DUR.cheer, 0.15, 0.3)
        tg.bob += 0.2 * hop * e
        tg.squash += (hop > 0.05 ? 0.08 * hop : -0.07) * e
        if (LEFT_FULL.has(idle)) {
          // one free hand punches the air
          armR(e, 0, -2.4 - 0.2 * Math.sin(tau * 13 + 1), 0.1, -0.3)
        } else {
          armL(e, 0, 2.35 + 0.2 * Math.sin(tau * 13), 0.1, 0.35)
          armR(e, 0, -2.35 - 0.2 * Math.sin(tau * 13 + 1), 0.1, -0.35)
        }
        tg.lLx += -0.25 * hop * e
        tg.lRx += -0.25 * hop * e
        mood = 'happy'
        break
      }
      case 'surprise': {
        const e = env(tau, ACTION_DUR.surprise, 0.08, 0.4)
        tg.bob += 0.1 * Math.max(0, Math.sin((tau / 0.45) * Math.PI)) * (tau < 0.45 ? 1 : 0)
        if (c.pose !== 'sit' && !CARRYING.has(idle)) {
          if (!LEFT_FULL.has(idle)) armL(e, -0.3, 0.7, 1.3, 0.3)
          armR(e, -0.3, -0.7, 1.3, -0.3)
        } else {
          tg.aLz = lerp(tg.aLz, 0.95, e)
          tg.aRz = lerp(tg.aRz, -0.95, e)
        }
        tg.hX += -0.1 * e
        tg.squash += tau < 0.1 ? -0.08 : 0.04 * e
        eyesWide = e > 0.2
        mood = 'surprised'
        break
      }
      case 'standUp': {
        const k = Math.min(tau / ACTION_DUR.standUp, 1)
        tg.bob += 0.15 * Math.sin(Math.PI * k)
        tg.squash += k < 0.18 ? -0.12 : 0.08 * Math.sin(Math.PI * k)
        tg.aLz = lerp(tg.aLz, 0.6, Math.sin(Math.PI * k))
        tg.aRz = lerp(tg.aRz, -0.6, Math.sin(Math.PI * k))
        break
      }
      case 'hop': {
        const k = Math.min(tau / ACTION_DUR.hop, 1)
        tg.bob += 0.16 * Math.sin(Math.PI * k)
        tg.squash += k < 0.15 ? -0.1 : 0.07 * Math.sin(Math.PI * k)
        mood = 'happy'
        break
      }
      case 'bowDeep': {
        // khoanh tay, cúi thật sâu: arms folded, a bow from the waist that brings his head down
        // to where his father's hand can rest on it — held, then he straightens
        const fold = sstep(0, 0.35, tau) * (1 - sstep(3.3, 3.75, tau))
        const bow = sstep(0.45, 1.0, tau) * (1 - sstep(2.9, 3.5, tau))
        armL(fold, -0.62, 0.1, 1.55, -1.2)
        armR(fold, -0.5, -0.1, 1.5, 1.25)
        tg.tX += 1.0 * bow
        tg.hX += 0.08 * bow
        mood = tau > 3.3 ? 'happy' : 'calm'
        break
      }
      case 'pat': {
        // xoa đầu: the right arm out and up, the hand resting on a bowed head and stroking it
        const e = env(tau, ACTION_DUR.pat, 0.45, 0.5)
        armR(e, 0, -2.4 + 0.07 * Math.sin(tau * 7.5), 0.06, 0)
        tg.sR = 0.22 * e
        tg.tZ += 0.06 * e
        tg.hZ += 0.1 * e
        mood = 'happy'
        break
      }
      case 'patBack': {
        // vỗ lưng: the right hand out in front, two firm pats — "go on"
        const e = env(tau, ACTION_DUR.patBack, 0.3, 0.35)
        const hit = Math.max(0, Math.sin((tau - 0.3) * 9.5)) * (tau > 0.3 && tau < 1.3 ? 1 : 0)
        armR(e, -1.27 + 0.2 * (1 - hit), -0.5, 0.08, 0)
        tg.sR = 0.2 * e
        tg.tX += 0.05 * e
        mood = 'happy'
        break
      }
      case 'nudge': {
        // a pat on the back lands: a small rock forward and a grin
        const k = Math.min(tau / ACTION_DUR.nudge, 1)
        tg.tX += 0.16 * Math.sin(Math.PI * k) * (1 - k)
        tg.bob += 0.03 * Math.sin(Math.PI * k)
        mood = 'happy'
        break
      }
      case 'tear': {
        // happy tears: the free hand comes up to her cheek
        const e = env(tau, ACTION_DUR.tear, 0.35, 0.45)
        armR(e, -0.8, -0.2, 2.3 + 0.07 * Math.sin(tau * 6), 0.3)
        tg.hX += 0.1 * e
        tg.hZ += -0.08 * e
        tearful = e > 0.25
        mood = 'happy'
        break
      }
      case 'lookAbout': {
        // lost: he turns his head one way, then the other, shoulders drawn in
        const e = env(tau, ACTION_DUR.lookAbout, 0.4, 0.5)
        const sweep = Math.sin(tau * 1.9)
        tg.hY += 0.95 * sweep * e
        tg.tY += 0.28 * sweep * e
        tg.tX += 0.05 * e
        tg.hX += 0.05 * e
        break
      }
      case 'smile': {
        const e = env(tau, ACTION_DUR.smile)
        tg.hZ += 0.16 * e
        tg.tZ += 0.04 * e
        mood = 'happy'
        break
      }
    }

    // ── gaze ──
    const lookTarget = c.look === 'camera' ? camera.position : c.look
    const spinning = c.action === 'dance'
    if (lookTarget && !walking && !spinning) {
      tmp.v.set(c.pos.x, c.pos.y + 0.98 * scale, c.pos.z)
      tmp.w.subVectors(lookTarget, tmp.v)
      const cs = Math.cos(c.rotY)
      const sn = Math.sin(c.rotY)
      const lx = tmp.w.x * cs - tmp.w.z * sn
      const lz = tmp.w.x * sn + tmp.w.z * cs
      const yaw = Math.atan2(lx, lz)
      const pitch = -Math.atan2(tmp.w.y, Math.hypot(lx, lz))
      const hy = THREE.MathUtils.clamp(yaw, -1.1, 1.1)
      tg.hY += hy
      tg.tY += THREE.MathUtils.clamp(yaw - hy, -0.8, 0.8) * 0.8
      tg.hX += THREE.MathUtils.clamp(pitch, -0.45, 0.4)
    } else if (!walking && !spinning) {
      if (t > a.nextGlance) {
        a.nextGlance = t + 2.2 + Math.random() * 3
        a.glanceY = (Math.random() - 0.5) * 1.1
        a.glanceX = (Math.random() - 0.4) * 0.25
      }
      tg.hY += a.glanceY
      tg.hX += a.glanceX
    }
    tg.hZ += Math.sin(t * 1.3 + a.seed) * 0.03
    // a speaker nods along with the words
    if (world.talk.on && world.talk.who.includes(id)) tg.hX += 0.035 * Math.sin(t * 8.5)

    // ── damp toward targets (continuous), show on twos ──
    const fast = ['wave', 'beckon', 'cheer', 'dance', 'peace', 'hi5', 'omQuyen', 'type', 'laugh', 'clap'].includes(c.action)
    for (const k of JOINTS) {
      const arm = k[0] === 'a' || k[0] === 'e'
      const lam = k === 'spin' ? 30 : k === 'hipX' || k === 'hipR' ? 2.2 : k === 'hX' || k === 'hY' || k === 'tY' ? 6 : fast && arm ? 22 : k === 'bob' || k === 'squash' ? 18 : 12
      a.cur[k] = THREE.MathUtils.damp(a.cur[k], tg[k], lam, dt)
    }
    a.stepT += dt
    if (a.stepT >= ANIME_STEP) {
      a.stepT %= ANIME_STEP
      Object.assign(a.shown, a.cur)
    }
    const p = a.shown

    // ── apply ──
    faceProbe(c).set(c.pos.x, c.pos.y + p.bob + 0.98 * scale + (c.pose === 'sit' ? -0.2 : 0), c.pos.z)
    root.current.position.set(c.pos.x, c.pos.y + p.bob, c.pos.z)
    root.current.rotation.y = c.rotY + p.spin
    const sq = 1 + p.squash
    squashG.current.scale.set(scale / Math.sqrt(sq), scale * sq, scale / Math.sqrt(sq))
    hips.current.position.set(p.hipX, (HIP + p.hipY) * BODY, 0)
    hips.current.rotation.z = p.hipR
    // the shoulders tip the other way from the hips
    torsoG.current.rotation.set(p.tX, p.tY, p.tZ - p.hipR * 1.6)
    headG.current.rotation.set(p.hX, p.hY, p.hZ)
    shL.current.rotation.set(p.aLx, 0, p.aLz)
    shR.current.rotation.set(p.aRx, 0, p.aRz)
    shL.current.scale.y = 1 + p.sL
    shR.current.scale.y = 1 + p.sR
    elL.current.rotation.set(-p.eLx, 0, p.eLz)
    elR.current.rotation.set(-p.eRx, 0, p.eRz)
    // the feet stay planted while the hips shift and roll above them
    const plant = -p.hipR - p.hipX / (0.2 * BODY)
    legL.current.rotation.set(p.lLx, 0, p.lLz + plant)
    legR.current.rotation.set(p.lRx, 0, p.lRz + plant)

    // ── painted expression ──
    if (t > a.nextBlink) {
      a.blinkT = t
      a.nextBlink = t + 1.8 + Math.random() * 3.2
      if (Math.random() < 0.2) a.nextBlink = t + 0.28
    }
    const blinking = t - a.blinkT < 0.12
    const closedHappy = mood === 'happy' && ['cheer', 'smile', 'bow', 'dance', 'hop', 'laugh', 'hi5', 'clap', 'tear', 'pat'].includes(c.action)
    let eyes: EyeState = eyesWide ? 'surprised' : wink ? 'wink' : closedHappy ? 'happy' : 'open'
    if (blinking && eyes === 'open') eyes = 'blink'
    const grin = look.face.grin
    const rest: MouthState = look.face.catMouth ? 'cat' : 'smile'
    // speaking: the mouth opens and closes on twos while the line is typed (parents take turns by the syllable)
    const talking = world.talk.on && world.talk.who.includes(id) && Math.floor(t * 7.5 + (id === 'mother' ? 0.5 : 0)) % 2 === 0
    const mouth: MouthState = mood === 'surprised' ? 'o' : wink ? 'cat' : talking ? 'talk' : mood === 'happy' ? (grin ? 'grin' : 'open') : c.action === 'think' || c.action === 'type' ? 'flat' : rest
    // the painted irises drift toward idle glances (the head leads, the eyes follow)
    const gaze = !lookTarget && !walking && Math.abs(a.glanceY) > 0.32 ? Math.sign(a.glanceY) : 0
    face.painter.draw(eyes, mouth, gaze, tearful)
    // the painted face is unlit: by night it takes the tone of the moonlit skin around it
    face.mat.color.lerpColors(FACE_DAY, FACE_NIGHT, uNight.value)
  })

  return (
    <group ref={root}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} material={shadowMat} renderOrder={1}>
        <planeGeometry args={[0.95 * (look.scale ?? 1), 0.8 * (look.scale ?? 1)]} />
      </mesh>
      <group ref={squashG}>
        <group ref={hips} position-y={HIP * BODY} scale={BODY}>
          <group ref={legL} position={[0.085, 0, 0]}>
            {!look.leg?.hidden && <Cel geos={leg} />}
          </group>
          <group ref={legR} position={[-0.085, 0, 0]}>
            {!look.leg?.hidden && <Cel geos={leg} />}
          </group>
          {look.hipsExtra}
          <group ref={torsoG}>
            <Cel geos={torso} tex={tex} />
            {look.torsoExtra}
            <group ref={shL} position={[SHOULDER_X, SHOULDER_Y, 0]}>
              <Cel geos={arm.upper} tex={tex} />
              <group ref={elL} position={[0, -UPPER, 0]}>
                <Cel geos={arm.fore} tex={tex} />
                <group position={[0, -FORE - 0.005, 0]}>{look.handL}</group>
              </group>
            </group>
            <group ref={shR} position={[-SHOULDER_X, SHOULDER_Y, 0]}>
              <Cel geos={arm.upper} tex={tex} />
              <group ref={elR} position={[0, -UPPER, 0]}>
                <Cel geos={arm.fore} tex={tex} />
                <group position={[0, -FORE - 0.005, 0]}>{look.handR}</group>
              </group>
            </group>
            <group ref={neck} position-y={NECK}>
              <group ref={headG}>
                <group position-y={(HEAD_UP * HEAD) / (1.07 * BODY)} scale={HEAD / BODY}>
                  <Cel geos={head} />
                  <mesh geometry={face.geo} material={face.mat} renderOrder={2} />
                  {look.headExtra}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      {children}
      {look.ribbons?.map((r, i) => (
        <Ribbon key={i} spec={r} anchor={r.anchor === 'neck' ? neck : r.anchor === 'hips' ? hips : headG} />
      ))}
    </group>
  )
}

// ── Cloth ribbon (scarf tails, headband ties, veils) — verlet strip in world space ──
function Ribbon({ spec, anchor }: { spec: RibbonSpec; anchor: RefObject<THREE.Group | null> }) {
  const segs = spec.segs ?? 8
  const sim = useMemo(() => {
    const pts = Array.from({ length: segs + 1 }, () => new THREE.Vector3())
    const prev = Array.from({ length: segs + 1 }, () => new THREE.Vector3())
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array((segs + 1) * 2 * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const idx: number[] = []
    for (let i = 0; i < segs; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    geo.setIndex(idx)
    return { pts, prev, geo, pos, init: false }
  }, [segs])
  const mat = useMemo(
    () => new THREE.MeshToonMaterial({ color: spec.color, gradientMap: toonRamp(), side: THREE.DoubleSide }),
    [spec.color],
  )
  const mesh = useRef<THREE.Mesh>(null!)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), side: new THREE.Vector3(), q: new THREE.Quaternion() }), [])

  useEffect(() => {
    mesh.current.matrixWorldAutoUpdate = false
    mesh.current.matrixWorld.identity()
    return () => sim.geo.dispose()
  }, [sim])

  useFrame((_, rawDt) => {
    const g = anchor.current
    if (!g) return
    const dt = Math.min(rawDt, 1 / 30)
    g.updateWorldMatrix(true, false)
    tmp.a.set(...spec.offset).applyMatrix4(g.matrixWorld)
    g.getWorldQuaternion(tmp.q)
    tmp.side.set(1, 0, 0).applyQuaternion(tmp.q)
    const segLen = spec.length / segs
    const { pts, prev } = sim
    if (!sim.init) {
      for (let i = 0; i <= segs; i++) {
        pts[i].copy(tmp.a).add(new THREE.Vector3(0, -i * segLen * 0.7, -i * segLen * 0.7).applyQuaternion(tmp.q))
        prev[i].copy(pts[i])
      }
      sim.init = true
    }
    const t = world.time
    const wind = 0.9 * Math.sin(t * 1.7 + (spec.side ?? 0)) + 0.5 * Math.sin(t * 3.9)
    pts[0].copy(tmp.a)
    for (let i = 1; i <= segs; i++) {
      const p = pts[i]
      const vx = (p.x - prev[i].x) * 0.94
      const vy = (p.y - prev[i].y) * 0.94
      const vz = (p.z - prev[i].z) * 0.94
      prev[i].copy(p)
      p.x += vx + wind * 0.25 * dt * dt * i
      p.y += vy - 9.8 * 0.35 * dt * dt
      p.z += vz + 0.6 * dt * dt * i * (0.5 + 0.5 * Math.sin(t * 2.3 + i))
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i <= segs; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        const d = Math.hypot(dx, dy, dz) || 1e-6
        const k = (d - segLen) / d
        if (i === 1) {
          b.x -= dx * k
          b.y -= dy * k
          b.z -= dz * k
        } else {
          a.x += dx * k * 0.5
          a.y += dy * k * 0.5
          a.z += dz * k * 0.5
          b.x -= dx * k * 0.5
          b.y -= dy * k * 0.5
          b.z -= dz * k * 0.5
        }
      }
    }
    const w = spec.width / 2
    for (let i = 0; i <= segs; i++) {
      const taper = 1 - (i / segs) * 0.35
      const p = pts[i]
      sim.pos.set([p.x - tmp.side.x * w * taper, p.y - tmp.side.y * w * taper, p.z - tmp.side.z * w * taper], i * 6)
      sim.pos.set([p.x + tmp.side.x * w * taper, p.y + tmp.side.y * w * taper, p.z + tmp.side.z * w * taper], i * 6 + 3)
    }
    sim.geo.attributes.position.needsUpdate = true
    sim.geo.computeVertexNormals()
  })

  return <mesh ref={mesh} geometry={sim.geo} material={mat} frustumCulled={false} castShadow />
}
