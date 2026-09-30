import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { G, mergeKit, type MatKey, type Part, type V3 } from '../lib/kit'
import { celMat, outlineMat, toonRamp } from '../lib/materials'
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
const Z = new THREE.Vector3(0, 0, 1)

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
  /** resting arm pose: 'pockets' tucks the hands into the jacket pockets */
  idle?: 'rest' | 'pockets'
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

function buildArm(look: ChibiLook) {
  const p: Part[] = []
  const tex = !!look.sleeveTex
  if (look.arm.wide) {
    const len = look.arm.long ? 0.3 : 0.22
    p.push({ g: new THREE.CylinderGeometry(0.065, 0.14, len, 18, 1, true), c: tex ? '#ffffff' : look.arm.sleeve, m: tex ? 'sleeve' : undefined, p: [0, -len / 2 + 0.01, 0] })
    p.push({ g: new THREE.CylinderGeometry(0.135, 0.135, 0.02, 18), c: look.arm.cuff ?? look.arm.sleeve, p: [0, -len + 0.01, 0] })
  } else if (look.arm.short) {
    // puffed short sleeve, then the bare forearm
    p.push({ g: new THREE.CylinderGeometry(0.064, 0.074, 0.1, 16, 1, false), c: tex ? '#ffffff' : look.arm.sleeve, m: tex ? 'sleeve' : undefined, p: [0, -0.045, 0] })
    p.push({ g: G.sphere, c: look.arm.sleeve, p: [0, 0, 0], s: 0.064 })
    if (look.arm.cuff) p.push({ g: new THREE.CylinderGeometry(0.076, 0.076, 0.018, 16), c: look.arm.cuff, p: [0, -0.094, 0] })
    p.push({ g: new THREE.CapsuleGeometry(0.046, 0.08, 4, 10), c: look.skin, p: [0, -0.13, 0] })
  } else if (tex) {
    p.push({ g: new THREE.CylinderGeometry(0.06, 0.068, 0.17, 14, 1, true), c: '#ffffff', m: 'sleeve', p: [0, -0.085, 0] })
    p.push({ g: G.sphere, c: look.arm.sleeve, p: [0, 0, 0], s: 0.06 })
  } else {
    p.push({ g: new THREE.CapsuleGeometry(0.058, 0.1, 4, 10), c: look.arm.sleeve, p: [0, -0.085, 0] })
    if (look.arm.cuff) p.push({ g: G.cyl, c: look.arm.cuff, p: [0, -0.15, 0], s: [0.063, 0.04, 0.063] })
  }
  p.push({ g: G.sphere, c: look.arm.hand ?? look.skin, p: [0, -0.205, 0], s: 0.066 })
  return mergeKit(p)
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
const JOINTS = ['hipY', 'bob', 'squash', 'spin', 'tX', 'tY', 'tZ', 'hX', 'hY', 'hZ', 'aLx', 'aLz', 'aRx', 'aRz', 'lLx', 'lRx', 'lLz', 'lRz'] as const
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
        const step = Math.min(dist, c.speed * dt)
        c.pos.x += (tmp.v.x / dist) * step
        c.pos.z += (tmp.v.z / dist) * step
        c.pos.y = lerp(c.pos.y, next.y, Math.min(1, dt * 10))
        const heading = Math.atan2(tmp.v.x, tmp.v.z)
        c.rotY += wrapPi(heading - c.rotY) * Math.min(1, dt * 9)
        a.phase += dt * c.speed * 8.2
      }
    } else if (c.faceY !== null) {
      c.rotY += wrapPi(c.faceY - c.rotY) * Math.min(1, dt * 5)
    }

    // ── base pose ──
    const breathe = Math.sin(t * 2.3 + a.seed)
    tg.aLz = 0.13 + breathe * 0.02
    tg.aRz = -0.13 - breathe * 0.02
    tg.squash = breathe * 0.012
    if (look.idle === 'pockets') {
      // hands tucked into the jacket pockets, elbows relaxed
      tg.aLz = -0.02 + breathe * 0.01
      tg.aRz = 0.02 - breathe * 0.01
      tg.aLx = 0.16
      tg.aRx = 0.16
    }
    if (c.pose === 'sit') {
      tg.hipY = -0.175
      tg.lLx = -1.38 + 0.3 * Math.sin(t * 3.0 + a.seed)
      tg.lRx = -1.38 + 0.3 * Math.sin(t * 3.0 + a.seed + 2.3)
      tg.aLx = 0.35
      tg.aLz = 0.42
      tg.aRx = 0.35
      tg.aRz = -0.42
      tg.tX = -0.06
    }
    if (walking) {
      const s = Math.sin(a.phase)
      tg.lLx = 0.62 * s
      tg.lRx = -0.62 * s
      tg.aLx = -0.55 * s
      tg.aRx = 0.55 * s
      tg.bob = 0.045 * Math.abs(s)
      tg.tZ = 0.05 * s
      tg.tX = 0.07
      tg.squash = 0.035 * Math.cos(2 * a.phase)
    }

    // ── actions ──
    let mood = c.mood
    let eyesWide = false
    let wink = false
    switch (c.action) {
      case 'wave': {
        const e = env(tau, ACTION_DUR.wave)
        tg.aRz = lerp(tg.aRz, -2.55 + 0.34 * Math.sin(tau * 10.5), e)
        tg.aRx = lerp(tg.aRx, -0.2, e)
        tg.hZ += 0.12 * e
        tg.tZ += 0.05 * e
        tg.bob += 0.02 * e * Math.abs(Math.sin(tau * 5))
        mood = 'happy'
        break
      }
      case 'beckon': {
        const e = env(tau, ACTION_DUR.beckon)
        tg.aRx = lerp(tg.aRx, -1.5 + 0.4 * Math.sin(tau * 9), e)
        tg.aRz = lerp(tg.aRz, -0.35, e)
        tg.hZ += -0.14 * e
        mood = 'happy'
        break
      }
      case 'bow': {
        const e = env(tau, ACTION_DUR.bow, 0.5, 0.6)
        tg.tX += 0.52 * e
        tg.hX += 0.3 * e
        tg.aRx = lerp(tg.aRx, -1.15, e)
        tg.aRz = lerp(tg.aRz, 0.5, e)
        tg.aLx = lerp(tg.aLx, 0.3, e)
        mood = 'happy'
        break
      }
      case 'omQuyen': {
        // Bình Định martial salute: fist meets palm in front of the chest with a
        // crisp snap, a short firm bow, then the hands drop smartly
        const snap = sstep(0, 0.18, tau) * (1 - sstep(1.55, 1.85, tau))
        const bow = sstep(0.45, 0.72, tau) * (1 - sstep(1.1, 1.4, tau))
        tg.aLx = lerp(tg.aLx, -1.32, snap)
        tg.aRx = lerp(tg.aRx, -1.28, snap)
        tg.aLz = lerp(tg.aLz, -0.62, snap)
        tg.aRz = lerp(tg.aRz, 0.66, snap)
        tg.tX += 0.34 * bow
        tg.hX += 0.2 * bow
        tg.squash += tau < 0.12 ? -0.05 : 0
        mood = tau > 1.2 ? 'happy' : 'calm'
        break
      }
      case 'scratch': {
        // gãi đầu: a hand to the back of the head, a shy tilt and grin
        const e = env(tau, ACTION_DUR.scratch, 0.3, 0.4)
        tg.aRx = lerp(tg.aRx, -2.55 + 0.1 * Math.sin(tau * 14), e)
        tg.aRz = lerp(tg.aRz, 0.95, e)
        tg.hZ += 0.16 * e
        tg.hX += 0.08 * e
        tg.tZ += -0.04 * e
        mood = 'happy'
        break
      }
      case 'peace': {
        // V-sign held out toward the guest, head tilted, a wink
        const e = env(tau, ACTION_DUR.peace, 0.18, 0.4)
        tg.aRx = lerp(tg.aRx, -1.75, e)
        tg.aRz = lerp(tg.aRz, 0.12, e)
        tg.aLz = lerp(tg.aLz, 0.45, e)
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
        tg.aRx = lerp(tg.aRx, -2.45, up)
        tg.aRz = lerp(tg.aRz, 0.18, up)
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
        // typing on the laptop in her lap: small alternating hand taps
        tg.aLx = -0.95 + 0.07 * Math.sin(tau * 15)
        tg.aRx = -0.95 + 0.07 * Math.sin(tau * 15 + 2.1)
        tg.aLz = -0.12
        tg.aRz = 0.12
        tg.hX += 0.28
        tg.tX += 0.08
        break
      }
      case 'offer': {
        // both hands hold something out toward the guest, a little bashful lean
        const e = env(tau, ACTION_DUR.offer, 0.35, 0.5)
        tg.aLx = lerp(tg.aLx, -1.4, e)
        tg.aRx = lerp(tg.aRx, -1.45, e)
        tg.aLz = lerp(tg.aLz, -0.42, e)
        tg.aRz = lerp(tg.aRz, 0.4, e)
        tg.tX += 0.14 * e
        tg.hZ += 0.12 * e
        tg.bob += 0.03 * Math.abs(Math.sin(tau * 3)) * e
        mood = 'happy'
        break
      }
      case 'think': {
        const e = env(tau, ACTION_DUR.think, 0.35, 0.45)
        tg.aRx = lerp(tg.aRx, -2.0, e)
        tg.aRz = lerp(tg.aRz, 0.62, e)
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
        tg.aLz = lerp(tg.aLz, 2.1 + 0.35 * Math.sin(k * 2), e)
        tg.aRz = lerp(tg.aRz, -1.25 - 0.45 * Math.sin(k * 2 + 1.5), e)
        tg.aLx = lerp(tg.aLx, -0.3 * Math.sin(k), e)
        tg.aRx = lerp(tg.aRx, -0.6 + 0.3 * Math.cos(k), e)
        tg.tZ += 0.12 * Math.sin(k) * e
        tg.hZ += -0.14 * Math.sin(k) * e
        tg.bob += 0.05 * Math.abs(Math.sin(k * 2)) * e
        tg.lLx += 0.25 * Math.sin(k * 2) * e
        mood = 'happy'
        break
      }
      case 'greet': {
        // khoanh tay: arms folded across the chest, then a slow, polite bow
        const fold = sstep(0, 0.35, tau) * (1 - sstep(1.95, 2.35, tau))
        const bow = sstep(0.55, 0.95, tau) * (1 - sstep(1.4, 1.85, tau))
        tg.aLx = lerp(tg.aLx, -1.35, fold)
        tg.aRx = lerp(tg.aRx, -1.2, fold)
        tg.aLz = lerp(tg.aLz, -0.9, fold)
        tg.aRz = lerp(tg.aRz, 0.95, fold)
        tg.tX += 0.4 * bow
        tg.hX += 0.25 * bow
        mood = tau > 1.5 ? 'happy' : 'calm'
        break
      }
      case 'present': {
        // both hands hold the notice out; they part as it unrolls
        const e = sstep(0, 0.45, tau)
        const s = world.diploma
        tg.aLx = lerp(tg.aLx, -1.35, e)
        tg.aRx = lerp(tg.aRx, -1.35, e)
        tg.aLz = lerp(tg.aLz, -0.42 + 0.95 * s, e)
        tg.aRz = lerp(tg.aRz, 0.42 - 0.95 * s, e)
        tg.hX += 0.1 * e
        mood = s > 0.5 ? 'happy' : 'calm'
        break
      }
      case 'clap': {
        const e = env(tau, ACTION_DUR.clap, 0.2, 0.35)
        const k = Math.sin(tau * 17)
        tg.aLx = lerp(tg.aLx, -1.25, e)
        tg.aRx = lerp(tg.aRx, -1.25, e)
        tg.aLz = lerp(tg.aLz, -0.5 + 0.2 * k, e)
        tg.aRz = lerp(tg.aRz, 0.5 - 0.2 * k, e)
        tg.bob += 0.025 * Math.abs(k) * e
        mood = 'happy'
        break
      }
      case 'usher': {
        // an open palm swept out toward the way ahead, a little nod
        const e = env(tau, ACTION_DUR.usher, 0.3, 0.45)
        const sweep = sstep(0.2, 0.9, tau)
        tg.aRx = lerp(tg.aRx, -1.15, e)
        tg.aRz = lerp(tg.aRz, lerp(0.3, -0.85, sweep), e)
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
        tg.aLz = lerp(tg.aLz, 2.55 + 0.2 * Math.sin(tau * 13), e)
        tg.aRz = lerp(tg.aRz, -2.55 - 0.2 * Math.sin(tau * 13 + 1), e)
        tg.lLx += -0.25 * hop * e
        tg.lRx += -0.25 * hop * e
        mood = 'happy'
        break
      }
      case 'surprise': {
        const e = env(tau, ACTION_DUR.surprise, 0.08, 0.4)
        tg.bob += 0.1 * Math.max(0, Math.sin((tau / 0.45) * Math.PI)) * (tau < 0.45 ? 1 : 0)
        tg.aLz = lerp(tg.aLz, 0.95, e)
        tg.aRz = lerp(tg.aRz, -0.95, e)
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
      tmp.v.set(c.pos.x, c.pos.y + 0.95 * scale, c.pos.z)
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

    // ── damp toward targets (continuous), show on twos ──
    const fast = ['wave', 'beckon', 'cheer', 'dance', 'peace', 'hi5', 'omQuyen', 'type', 'laugh', 'clap'].includes(c.action)
    for (const k of JOINTS) {
      const lam = k === 'spin' ? 30 : k === 'hX' || k === 'hY' || k === 'tY' ? 6 : fast && k[0] === 'a' ? 22 : k === 'bob' || k === 'squash' ? 18 : 12
      a.cur[k] = THREE.MathUtils.damp(a.cur[k], tg[k], lam, dt)
    }
    a.stepT += dt
    if (a.stepT >= ANIME_STEP) {
      a.stepT %= ANIME_STEP
      Object.assign(a.shown, a.cur)
    }
    const p = a.shown

    // ── apply ──
    faceProbe(c).set(c.pos.x, c.pos.y + p.bob + 0.95 * scale + (c.pose === 'sit' ? -0.17 : 0), c.pos.z)
    root.current.position.set(c.pos.x, c.pos.y + p.bob, c.pos.z)
    root.current.rotation.y = c.rotY + p.spin
    const sq = 1 + p.squash
    squashG.current.scale.set(scale / Math.sqrt(sq), scale * sq, scale / Math.sqrt(sq))
    hips.current.position.y = HIP + p.hipY
    torsoG.current.rotation.set(p.tX, p.tY, p.tZ)
    headG.current.rotation.set(p.hX, p.hY, p.hZ)
    shL.current.rotation.set(p.aLx, 0, p.aLz)
    shR.current.rotation.set(p.aRx, 0, p.aRz)
    legL.current.rotation.set(p.lLx, 0, p.lLz)
    legR.current.rotation.set(p.lRx, 0, p.lRz)

    // ── painted expression ──
    if (t > a.nextBlink) {
      a.blinkT = t
      a.nextBlink = t + 1.8 + Math.random() * 3.2
      if (Math.random() < 0.2) a.nextBlink = t + 0.28
    }
    const blinking = t - a.blinkT < 0.12
    const closedHappy = mood === 'happy' && ['cheer', 'smile', 'bow', 'dance', 'hop', 'laugh', 'hi5', 'clap'].includes(c.action)
    let eyes: EyeState = eyesWide ? 'surprised' : wink ? 'wink' : closedHappy ? 'happy' : 'open'
    if (blinking && eyes === 'open') eyes = 'blink'
    const grin = look.face.grin
    const rest: MouthState = look.face.catMouth ? 'cat' : 'smile'
    const mouth: MouthState = mood === 'surprised' ? 'o' : wink ? 'cat' : mood === 'happy' ? (grin ? 'grin' : 'open') : c.action === 'think' || c.action === 'type' ? 'flat' : rest
    // the painted irises drift toward idle glances (the head leads, the eyes follow)
    const gaze = !lookTarget && !walking && Math.abs(a.glanceY) > 0.32 ? Math.sign(a.glanceY) : 0
    face.painter.draw(eyes, mouth, gaze)
  })

  return (
    <group ref={root}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} material={shadowMat} renderOrder={1}>
        <planeGeometry args={[0.95 * (look.scale ?? 1), 0.8 * (look.scale ?? 1)]} />
      </mesh>
      <group ref={squashG}>
        <group ref={hips} position-y={HIP}>
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
              <Cel geos={arm} tex={tex} />
              <group position={[0, -0.21, 0]}>{look.handL}</group>
            </group>
            <group ref={shR} position={[-SHOULDER_X, SHOULDER_Y, 0]}>
              <Cel geos={arm} tex={tex} />
              <group position={[0, -0.21, 0]}>{look.handR}</group>
            </group>
            <group ref={neck} position-y={NECK}>
              <group ref={headG}>
                <group position-y={HEAD_UP} scale={1.07}>
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
