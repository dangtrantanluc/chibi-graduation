import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import { Cel, Chibi, faceMatrix, garmentLathe, type ChibiLook } from './Chibi'
import { hairCap, hairCurtain, onHead, shine, spike, taperTube } from './hair'
import { G, mergeKit, roundedBox, type Part } from '../lib/kit'
import { world, type CharId } from '../../state/world'
import { SutraBook } from '../fx/SutraBook'
import {
  anipTex,
  bubbleTex,
  doiKhamSleeve,
  doiKhamTex,
  hanoiShirtTex,
  hanoiSleeve,
  laptopLidTex,
  laptopScreenTex,
  lucJacketTex,
  lucSleeve,
  nhatBinhSleeve,
  nhatBinhTex,
  nyTex,
  uniPoloTex,
  uniSleeve,
} from './garments'

/*
 * The cast of Lực's journey. Each figure is built from a character sheet:
 * signature silhouette + palette + the small objects that make the person
 * (a cap and a backpack full of keychains; a faculty polo and a stickered
 * laptop; a butter-yellow shirt, a bunny charm and a bunch of daisies), then
 * rendered with the anime pipeline: cel ramp + ink outlines + painted faces +
 * painted garment textures + animation on twos.
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
/**
 * Anime fringe: flat, overlapping blades lying on the forehead. Because they
 * overlap, the ink outline only traces the outer silhouette — clean 2D bangs.
 */
function fringe(p: Part[], color: string, xs: number[], y: number, len: number, wid: number, pointed = true, jitter = 0) {
  xs.forEach((x, i) => {
    const l = len * (1 + (i % 2 ? -jitter : jitter))
    const tilt = -x * 0.9
    if (pointed) p.push({ g: G.cone, c: color, mat: faceMatrix(x, y - l * 0.3, 0.018, [wid, l, 0.03], Math.PI + tilt) })
    else p.push({ g: G.sphere, c: color, mat: faceMatrix(x, y - l * 0.18, 0.016, [wid * 0.62, l * 0.55, 0.035], tilt * 0.4) })
  })
  p.push({ g: G.sphere, c: color, mat: faceMatrix(0, y + 0.03, 0.008, [Math.abs(xs[0]) + wid * 0.5, 0.05, 0.02]) })
}

/** long, flattened lock of hair falling from a scalp point */
function tress(p: Part[], color: string, pts: THREE.Vector3[], r0: number, r1: number, flat = 0.65) {
  p.push({ g: taperTube(pts, r0, r1, 14, 8, flat), c: color })
}

/** a wavy lock: control points ripple sideways as they fall */
function wavy(p: Part[], color: string, x: number, z: number, top: number, len: number, amp: number, phase: number, r0: number, r1: number, out = 0.1) {
  const pts: THREE.Vector3[] = []
  for (let k = 0; k <= 6; k++) {
    const t = k / 6
    const side = Math.sign(x || 1)
    pts.push(V(x + side * out * t * t + Math.sin(t * Math.PI * 2.2 + phase) * amp * t, top - t * len, z - 0.04 * t))
  }
  tress(p, color, pts, r0, r1, 0.62)
}

function Props({ build }: { build: () => Part[] }) {
  const geos = useMemo(() => mergeKit(build()), [build])
  return <Cel geos={geos} />
}

/** a painted decal glued to a surface (logos, labels) */
function Decal({ map, size, position, rotation }: { map: THREE.Texture; size: [number, number]; position: [number, number, number]; rotation?: [number, number, number] }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), [map])
  return (
    <mesh position={position} rotation={rotation} material={mat} renderOrder={3}>
      <planeGeometry args={size} />
    </mesh>
  )
}

/** Hides / shows children depending on the character's current action. */
function WhenAction({ id, actions, children }: { id: CharId; actions: string[]; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  useFrame(() => {
    g.current.visible = actions.includes(world.chars[id].action)
  })
  return (
    <group ref={g} visible={false}>
      {children}
    </group>
  )
}

/** index + middle finger for the V-sign (the hand sphere is the fist) */
function VSign({ id }: { id: CharId }) {
  const build = useMemo(
    () => () => {
      const skin = id === 'luc' ? '#fde0c8' : '#fde6d6'
      const p: Part[] = []
      for (const s of [-1, 1]) p.push({ g: new THREE.CapsuleGeometry(0.021, 0.075, 3, 8), c: skin, p: [s * 0.026, -0.09, 0.014], r: [0, 0, s * 0.26] })
      return p
    },
    [id],
  )
  return (
    <WhenAction id={id} actions={['peace']}>
      <Props build={build} />
    </WhenAction>
  )
}

/**
 * A little cluster of charms on a split ring that swings as a pendulum —
 * it lags behind when the owner turns or walks.
 */
function Charms({ id, position, children }: { id: CharId; position: [number, number, number]; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  const st = useMemo(() => ({ a: 0, v: 0, b: 0, w: 0, last: 0, lx: 0, lz: 0 }), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const c = world.chars[id]
    const dRot = Math.atan2(Math.sin(c.rotY - st.last), Math.cos(c.rotY - st.last))
    st.last = c.rotY
    const vx = (c.pos.x - st.lx) / Math.max(dt, 1e-3)
    const vz = (c.pos.z - st.lz) / Math.max(dt, 1e-3)
    st.lx = c.pos.x
    st.lz = c.pos.z
    const speed = Math.min(Math.hypot(vx, vz), 3)
    st.v += (-18 * Math.sin(st.a) - 2.2 * st.v - dRot * 40 + Math.sin(world.time * 8) * speed * 6) * dt
    st.a += st.v * dt
    st.w += (-16 * Math.sin(st.b) - 2 * st.w + Math.cos(world.time * 7.3) * speed * 5) * dt
    st.b += st.w * dt
    g.current.rotation.set(st.b * 0.6, 0, st.a * 0.6)
  })
  return (
    <group position={position}>
      <group ref={g}>{children}</group>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════
//  LỰC — "Small steps, big dreams"
//  black NY cap · black coach jacket over a navy hoodie · a black
//  backpack with a water bottle and a jangle of keychains · light-grey
//  wide cargo trousers · chunky black sneakers · hands in pockets
// ═══════════════════════════════════════════════════════════
const L_HAIR = '#3b2a24'
const L_BLACK = '#1f2025'
const JACKET: [number, number][] = [
  [0, -0.08],
  [0.202, -0.08],
  [0.226, -0.02],
  [0.228, 0.08],
  [0.214, 0.2],
  [0.174, 0.3],
  [0.106, 0.36],
  [0, 0.374],
]

/** half-shell of an ellipsoid (the cap crown), open at the bottom */
function crownGeo() {
  const g = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.52)
  return g
}

/** the cap crown sits low on the brow and tilts back a little */
const CAP_P = V(0, 0.06, -0.03)
const CAP_TILT = -0.2
const CAP_S = V(0.43, 0.41, 0.45)

function LucCapDecals() {
  const ny = useMemo(() => nyTex(), [])
  // the embroidered logo on the front panel of the crown
  return (
    <group position={CAP_P.toArray()} rotation-x={CAP_TILT}>
      <Decal map={ny} size={[0.14, 0.14]} position={[0, 0.172, 0.43]} rotation={[-0.44, 0, 0]} />
    </group>
  )
}

const lucLook: ChibiLook = {
  skin: '#fde0c8',
  face: {
    iris: ['#34292a', '#8d7b72'],
    brow: '#3b2a24',
    lash: '#231a18',
    tilt: 0.02,
    eyeW: 0.132,
    eyeH: 0.166,
    browThick: 1.35,
    lashWing: 0.22,
    lashWeight: 1.05,
    grin: true,
  },
  head: (p) => {
    hairCap(p, L_HAIR, 1.03, 0.03, 0.05)
    // messy fringe peeking out under the brim
    fringe(p, L_HAIR, [-0.26, -0.16, -0.06, 0.05, 0.15, 0.25], 0.16, 0.15, 0.1, true, 0.3)
    // short sideburns in front of the ears and soft tufts at the nape
    for (const s of [-1, 1]) {
      spike(p, L_HAIR, s * 1.28, -0.02, 0.12, 0.06, -0.1, -1.4)
      spike(p, L_HAIR, s * 2.2, 0.02, 0.12, 0.07, 0.1, -1.3)
    }
    for (const th of [2.8, 3.14, 3.48]) spike(p, L_HAIR, th, -0.02, 0.12, 0.08, 0.15, -1.5)
    // black six-panel cap worn low: the brim sits just above the brows
    const cap = new THREE.Matrix4().compose(CAP_P, new THREE.Quaternion().setFromEuler(new THREE.Euler(CAP_TILT, 0, 0)), CAP_S)
    p.push({ g: crownGeo(), c: L_BLACK, mat: cap })
    // panel seams and the top button
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
      const seam = new THREE.TorusGeometry(1, 0.012, 4, 30, Math.PI * 0.5)
      seam.rotateZ(Math.PI / 4)
      seam.rotateY(a)
      p.push({ g: seam, c: '#34353b', mat: cap.clone().multiply(new THREE.Matrix4().makeScale(1.005, 1.005, 1.005)) })
    }
    p.push({ g: G.sphereLo, c: L_BLACK, mat: cap.clone().multiply(new THREE.Matrix4().compose(V(0, 1.0, 0), new THREE.Quaternion(), V(0.07, 0.05, 0.07))) })
    // sweatband edge + the brim (a flattened, gently drooping oval)
    p.push({ g: new THREE.TorusGeometry(1, 0.03, 5, 36), c: '#17181c', mat: cap.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(1.005, 1.005, 1)) })
    p.push({ g: G.sphere, c: L_BLACK, p: [0, 0.16, 0.47], r: [0.24, 0, 0], s: [0.31, 0.022, 0.21] })
    p.push({ g: G.sphere, c: '#2b2c31', p: [0, 0.146, 0.47], r: [0.24, 0, 0], s: [0.3, 0.012, 0.2] })
    // the adjuster strap across the opening at the back
    p.push({ g: new THREE.TorusGeometry(0.1, 0.016, 5, 16, Math.PI), c: '#17181c', p: [0, -0.02, -0.41], r: [0.1, Math.PI, 0] })
    p.push({ g: roundedBox(0.05, 0.024, 0.02, 0.006), c: '#9aa0a8', m: 'gloss', p: [0, 0.08, -0.43], r: [-0.25, 0, 0] })
  },
  headExtra: <LucCapDecals />,
  torso: (p) => {
    p.push({ g: garmentLathe(JACKET), c: '#ffffff', m: 'garment' })
    // stand collar, open over the navy hoodie (its hood bunches at the back)
    p.push({ g: new THREE.CylinderGeometry(0.108, 0.118, 0.06, 20, 1, true), c: L_BLACK, p: [0, 0.37, 0] })
    p.push({ g: new THREE.TorusGeometry(0.113, 0.012, 5, 22), c: '#17181c', p: [0, 0.4, 0], r: [Math.PI / 2, 0, 0] })
    p.push({ g: new THREE.CylinderGeometry(0.09, 0.1, 0.05, 16), c: '#2c3752', p: [0, 0.37, 0.012] })
    p.push({ g: G.sphere, c: '#2c3752', p: [0, 0.37, -0.12], s: [0.14, 0.07, 0.08] })
    for (const s of [-1, 1]) p.push({ g: G.cyl, c: '#e9e6de', p: [s * 0.035, 0.3, 0.165], r: [-0.4, 0, 0], s: [0.007, 0.1, 0.007] })
    p.push({ g: roundedBox(0.026, 0.045, 0.014, 0.006), c: '#b8bcc4', m: 'gloss', p: [0, 0.335, 0.125], r: [-0.55, 0, 0] })
    // backpack straps over the shoulders, down the chest, round under the arms
    for (const s of [-1, 1]) {
      p.push({
        g: taperTube([V(s * 0.08, 0.28, -0.24), V(s * 0.11, 0.37, -0.08), V(s * 0.12, 0.34, 0.11), V(s * 0.125, 0.22, 0.19), V(s * 0.15, 0.08, 0.205), V(s * 0.205, -0.01, 0.1), V(s * 0.15, 0.0, -0.2)], 0.024, 0.024, 26, 6, 0.32),
        c: '#15161a',
      })
      p.push({ g: roundedBox(0.05, 0.028, 0.02, 0.006), c: '#9aa0a8', m: 'gloss', p: [s * 0.14, 0.13, 0.21], r: [-0.1, 0, 0] })
    }
  },
  torsoExtra: <LucBackpack />,
  garment: lucJacketTex,
  sleeveTex: lucSleeve,
  arm: { sleeve: L_BLACK },
  leg: { pant: '#c8cacf', cuff: '#d7d9dd', wide: true, shoe: '#1f2025', sole: '#35373d', stripe: '#5b5e66' },
  idle: 'pockets',
  handR: <VSign id="luc" />,
}

function LucBackpack() {
  const build = useMemo(
    () => () => {
      const B = '#1c1d21'
      const p: Part[] = [
        { g: roundedBox(0.34, 0.37, 0.16, 0.06), c: B, p: [0, 0.16, -0.27] },
        // front pocket, zips, top grab handle
        { g: roundedBox(0.27, 0.17, 0.05, 0.03), c: '#24252a', p: [0, 0.08, -0.365] },
        { g: G.box, c: '#6f737b', p: [0, 0.165, -0.392], s: [0.23, 0.008, 0.006] },
        { g: new THREE.TorusGeometry(0.16, 0.006, 4, 24, Math.PI), c: '#6f737b', p: [0, 0.18, -0.355], r: [Math.PI / 2 - 0.35, 0, 0], s: [1, 1.05, 1] },
        { g: new THREE.TorusGeometry(0.045, 0.012, 5, 14, Math.PI), c: '#15161a', p: [0, 0.35, -0.27] },
        // side mesh pocket (her… his right side) holding a water bottle
        { g: new THREE.CylinderGeometry(0.046, 0.046, 0.09, 12, 1, true), c: '#2a2b30', p: [-0.19, 0.06, -0.27] },
        { g: new THREE.CylinderGeometry(0.036, 0.036, 0.15, 14), c: '#a9d6f5', m: 'gloss', p: [-0.19, 0.12, -0.27] },
        { g: new THREE.CylinderGeometry(0.03, 0.032, 0.045, 14), c: '#2a6fd0', m: 'gloss', p: [-0.19, 0.215, -0.27] },
        { g: G.torus, c: '#2a6fd0', m: 'gloss', p: [-0.19, 0.25, -0.27], r: [0, Math.PI / 2, 0], s: 0.018 },
        // zipper pulls on the main compartment, where the charms hang
        { g: G.box, c: '#6f737b', p: [0.13, 0.3, -0.3], s: [0.012, 0.03, 0.006] },
      ]
      return p
    },
    [],
  )
  const charms = useMemo(
    () => () => {
      const p: Part[] = [
        // carabiner + split ring
        { g: G.torus, c: '#c7ccd4', m: 'gloss', p: [0, -0.02, 0], r: [0, Math.PI / 2, 0], s: [0.028, 0.04, 0.04] },
        // brass compass on a short chain
        { g: new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), c: '#c9953f', m: 'gold', p: [0.015, -0.1, 0.01], r: [Math.PI / 2, 0, 0.2] },
        { g: new THREE.CylinderGeometry(0.022, 0.022, 0.014, 16), c: '#f3ead2', p: [0.015, -0.1, 0.012], r: [Math.PI / 2, 0, 0.2] },
        // red charm with a white knot + tassel
        { g: roundedBox(0.035, 0.05, 0.014, 0.008), c: '#d23a36', p: [-0.03, -0.085, -0.006], r: [0, 0, -0.15] },
        { g: G.sphereXs, c: '#ffffff', p: [-0.03, -0.085, 0.004], s: 0.009 },
        { g: G.cone, c: '#d23a36', p: [-0.034, -0.135, -0.006], r: [Math.PI, 0, 0], s: [0.01, 0.045, 0.01] },
        // a small white plush bear
        { g: G.sphere, c: '#f7f4ee', p: [0.0, -0.07, 0.03], s: 0.025 },
        { g: G.sphere, c: '#f7f4ee', p: [0.0, -0.105, 0.03], s: [0.022, 0.026, 0.02] },
        { g: G.sphereXs, c: '#f7f4ee', p: [0.018, -0.052, 0.03], s: 0.009 },
        { g: G.sphereXs, c: '#f7f4ee', p: [-0.018, -0.052, 0.03], s: 0.009 },
        { g: G.sphereXs, c: '#2a2426', p: [0.0, -0.072, 0.054], s: 0.005 },
      ]
      return p
    },
    [],
  )
  const label = useMemo(() => anipTex(), [])
  return (
    <group>
      <Props build={build} />
      <Decal map={label} size={[0.09, 0.045]} position={[0, 0.09, -0.392]} rotation={[0, Math.PI, 0]} />
      <Charms id="luc" position={[0.15, 0.29, -0.3]}>
        <Props build={charms} />
      </Charms>
    </group>
  )
}

export function Luc() {
  return <Chibi id="luc" look={lucLook} />
}

// ═══════════════════════════════════════════════════════════
//  IT GIRL — "CNTT không chỉ là code, mà còn là những người bạn tuyệt vời"
//  long dark hair with hidden blue streaks · a blue X clip · the Khoa CNTT
//  black polo (roundel logo, circuit print, blue-tipped cuffs) · light
//  wash wide jeans · white sneakers with a blue stripe · a black watch ·
//  a backpack with a blue bear · a laptop covered in stickers
// ═══════════════════════════════════════════════════════════
const U_HAIR = '#2b1f1d'
const U_BLUE = '#3f67d6'
const POLO: [number, number][] = [
  [0, -0.07],
  [0.192, -0.07],
  [0.212, 0.0],
  [0.214, 0.08],
  [0.204, 0.2],
  [0.168, 0.3],
  [0.102, 0.358],
  [0, 0.372],
]

function collarFlap(len: number, wid: number) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(wid, 0)
  s.quadraticCurveTo(wid * 0.9, -len * 0.6, wid * 0.35, -len)
  s.lineTo(0.004, -len * 0.72)
  s.lineTo(0, 0)
  return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false })
}

const uniLook: ChibiLook = {
  skin: '#fde6d6',
  face: { iris: ['#2f3a8a', '#9fb4ff'], brow: '#3a2a26', lash: '#241a1e', tilt: 0.06, sparkle: true, eyeW: 0.142, eyeH: 0.184 },
  head: (p) => {
    hairCap(p, U_HAIR, 1.05, 0.05, 0.05)
    // blunt, softly separated bangs
    fringe(p, U_HAIR, [-0.25, -0.17, -0.085, 0, 0.085, 0.17, 0.25], 0.225, 0.2, 0.125, false)
    // long straight hair: a full curtain down the back, and a hidden blue
    // under-layer that shows at the hem and in the side locks
    p.push({ g: hairCurtain({ bottom: -0.9, r0: 0.43, r1: 0.28, gap: 0.9, grooves: 13, tips: 0.05, seed: 1 }), c: U_BLUE })
    p.push({ g: hairCurtain({ bottom: -0.8, r0: 0.45, r1: 0.31, gap: 0.82, grooves: 11, tips: 0.07, seed: 2 }), c: U_HAIR })
    for (const s of [-1, 1]) {
      tress(p, U_HAIR, [V(s * 0.3, 0.14, 0.14), V(s * 0.37, -0.12, 0.15), V(s * 0.36, -0.45, 0.14), V(s * 0.34, -0.66, 0.13)], 0.066, 0.03, 0.7)
      tress(p, U_BLUE, [V(s * 0.33, 0.02, 0.1), V(s * 0.39, -0.25, 0.1), V(s * 0.37, -0.58, 0.09), V(s * 0.35, -0.74, 0.08)], 0.04, 0.02, 0.6)
    }
    // blue X hair clip above her left temple
    for (const r of [0.75, -0.75]) p.push({ g: roundedBox(0.022, 0.11, 0.02, 0.008), c: '#3f7fe6', m: 'gloss', mat: faceMatrix(0.27, 0.2, 0.035, [1, 1, 1], r) })
    shine(p, '#5a4a52', 0.27, 1.08, 1.9, 0.014)
  },
  torso: (p) => {
    p.push({ g: garmentLathe(POLO), c: '#ffffff', m: 'garment' })
    // polo collar: a knit band and two flat points lying on the collarbones
    p.push({ g: new THREE.CylinderGeometry(0.098, 0.106, 0.045, 20, 1, true), c: '#1d1e25', p: [0, 0.372, 0] })
    for (const s of [-1, 1]) {
      const f = collarFlap(0.085, 0.08)
      if (s < 0) f.scale(-1, 1, 1)
      p.push({ g: f, c: '#1d1e25', p: [s * 0.012, 0.392, 0.085], r: [-1.05, s * 0.32, 0] })
      p.push({ g: G.box, c: '#3f7fe6', p: [s * 0.05, 0.355, 0.13], r: [-1.05, s * 0.32, s * 0.1], s: [0.06, 0.004, 0.004] })
    }
    // backpack straps
    for (const s of [-1, 1])
      p.push({
        g: taperTube([V(s * 0.08, 0.28, -0.22), V(s * 0.11, 0.36, -0.08), V(s * 0.12, 0.33, 0.1), V(s * 0.125, 0.22, 0.18), V(s * 0.15, 0.08, 0.2), V(s * 0.2, -0.01, 0.09), V(s * 0.15, 0.0, -0.19)], 0.02, 0.02, 26, 6, 0.32),
        c: '#15161a',
      })
  },
  torsoExtra: <UniBackpack />,
  garment: uniPoloTex,
  sleeveTex: uniSleeve,
  arm: { sleeve: '#1d1e25', short: true },
  leg: { pant: '#a9b8d0', cuff: '#c6d1e3', wide: true, shoe: '#f3f3f5', sole: '#d9dbe0', stripe: '#3f7fe6' },
  handL: <Watch />,
  handR: <VSign id="uni" />,
  hipsExtra: <Laptop />,
  scale: 0.97,
}

function Watch() {
  const build = useMemo(
    () => () => [
      { g: new THREE.TorusGeometry(0.047, 0.013, 6, 18), c: '#1a1b20', p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0] } as Part,
      { g: roundedBox(0.04, 0.012, 0.034, 0.006), c: '#101116', m: 'gloss', p: [0.045, 0.05, 0], r: [0, 0, Math.PI / 2] } as Part,
      { g: G.box, c: '#6ea8ff', p: [0.052, 0.05, 0], s: [0.002, 0.018, 0.022] } as Part,
    ],
    [],
  )
  return <Props build={build} />
}

function UniBackpack() {
  const build = useMemo(
    () => () => [
      { g: roundedBox(0.31, 0.34, 0.14, 0.06), c: '#1a1b20', p: [0, 0.16, -0.26] } as Part,
      { g: roundedBox(0.24, 0.15, 0.045, 0.03), c: '#22232a', p: [0, 0.08, -0.345] } as Part,
      { g: G.box, c: '#3f7fe6', p: [0, 0.158, -0.37], s: [0.2, 0.008, 0.006] } as Part,
      { g: new THREE.TorusGeometry(0.04, 0.011, 5, 14, Math.PI), c: '#15161a', p: [0, 0.33, -0.26] } as Part,
    ],
    [],
  )
  const bear = useMemo(
    () => () => {
      const B = '#4f86ec'
      const p: Part[] = [
        { g: G.torus, c: '#c7ccd4', m: 'gloss', p: [0, 0, 0], r: [0, Math.PI / 2, 0], s: 0.02 },
        { g: G.sphere, c: B, p: [0, -0.06, 0], s: 0.032 },
        { g: G.sphere, c: B, p: [0, -0.108, 0], s: [0.03, 0.034, 0.026] },
        { g: G.sphereXs, c: B, p: [0.024, -0.036, 0], s: 0.012 },
        { g: G.sphereXs, c: B, p: [-0.024, -0.036, 0], s: 0.012 },
        { g: G.sphereXs, c: '#dfeaff', p: [0, -0.068, 0.028], s: [0.013, 0.01, 0.006] },
        { g: G.sphereXs, c: '#1b1c22', p: [0.011, -0.055, 0.029], s: 0.004 },
        { g: G.sphereXs, c: '#1b1c22', p: [-0.011, -0.055, 0.029], s: 0.004 },
      ]
      return p
    },
    [],
  )
  return (
    <group>
      <Props build={build} />
      <Charms id="uni" position={[-0.16, 0.25, -0.26]}>
        <Props build={bear} />
      </Charms>
    </group>
  )
}

/** A stickered laptop on her lap; the lid opens with world.laptop. */
function Laptop() {
  const g = useRef<THREE.Group>(null!)
  const lid = useRef<THREE.Group>(null!)
  const { base, lidMat, screenMat } = useMemo(() => {
    const base: Part[] = [
      { g: roundedBox(0.27, 0.016, 0.19, 0.008), c: '#c9ccd3', m: 'gloss', p: [0, 0, 0] },
      { g: G.box, c: '#2a2c33', p: [0, 0.009, 0.015], s: [0.23, 0.002, 0.1] },
      { g: G.box, c: '#b7bbc3', p: [0, 0.009, -0.06], s: [0.08, 0.002, 0.045] },
    ]
    const lidMat = new THREE.MeshToonMaterial({ map: laptopLidTex() })
    const screenMat = new THREE.MeshBasicMaterial({ map: laptopScreenTex(), toneMapped: false })
    return { base, lidMat, screenMat }
  }, [])
  const baseBuild = useMemo(() => () => base, [base])
  useFrame(() => {
    const c = world.chars.uni
    const show = c.pose === 'sit' || world.laptop > 0.01
    g.current.visible = show && c.pose === 'sit'
    lid.current.rotation.x = 0.02 + world.laptop * 1.82
    screenMat.color.setScalar(0.25 + 0.75 * world.laptop)
  })
  return (
    <group ref={g} position={[0, 0.085, 0.14]}>
      <Props build={baseBuild} />
      {/* the hinge is on the far edge; the lid swings up toward the viewer */}
      <group ref={lid} position={[0, 0.009, 0.095]}>
        <mesh position={[0, 0.006, -0.095]} rotation-x={-Math.PI / 2} material={lidMat} castShadow>
          <planeGeometry args={[0.27, 0.19]} />
        </mesh>
        <mesh position={[0, 0.0, -0.095]} rotation-x={Math.PI / 2} material={screenMat}>
          <planeGeometry args={[0.25, 0.17]} />
        </mesh>
        <mesh position={[0, 0.003, -0.095]}>
          <boxGeometry args={[0.27, 0.005, 0.19]} />
          <meshStandardMaterial color="#b7bbc3" metalness={0.3} roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

/** "</>" — a comic speech bubble that pops over her head. */
function CodeBubble() {
  const ref = useRef<THREE.Sprite>(null!)
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: bubbleTex(), transparent: true, depthWrite: false }), [])
  useFrame(() => {
    const b = world.bubble
    const c = world.chars.uni
    ref.current.visible = b > 0.01
    const pop = b < 1 ? b * (1 + 0.35 * Math.sin(b * Math.PI)) : 1 + 0.03 * Math.sin(world.time * 4)
    ref.current.scale.set(0.42 * pop, 0.33 * pop, 1)
    ref.current.position.set(c.pos.x + 0.3, c.pos.y + (c.pose === 'sit' ? 1.22 : 1.45) + 0.03 * Math.sin(world.time * 2.2), c.pos.z)
    mat.opacity = Math.min(1, b * 1.5)
  })
  return <sprite ref={ref} material={mat} renderOrder={6} />
}

export function Uni() {
  return (
    <>
      <Chibi id="uni" look={uniLook} />
      <CodeBubble />
    </>
  )
}

// ═══════════════════════════════════════════════════════════
//  HÀ NỘI FRIEND — "Good vibes only · Cùng nhau đi thật xa nhé!"
//  long wavy brown hair · butter-yellow shirt worn open over a white tank ·
//  a fine necklace · bead bracelet · light-blue wide jeans · white sneakers
//  with a navy stripe · a navy sling bag with a bunny charm · a bunch of
//  cúc họa mi (Hà Nội's late-autumn daisies)
// ═══════════════════════════════════════════════════════════
const H_HAIR = '#6e4431'
const H_HAIR_LT = '#8a5a40'
const SHIRT: [number, number][] = [
  [0, -0.1],
  [0.214, -0.1],
  [0.234, -0.03],
  [0.23, 0.08],
  [0.214, 0.2],
  [0.172, 0.3],
  [0.106, 0.358],
  [0, 0.372],
]

const hanoiLook: ChibiLook = {
  skin: '#fde3cf',
  face: { iris: ['#4a2a1c', '#d2a26c'], brow: '#6e4431', lash: '#2c1a14', tilt: 0.0, sparkle: true, eyeW: 0.146, eyeH: 0.19 },
  head: (p) => {
    hairCap(p, H_HAIR, 1.07, 0.06, 0.05)
    // airy, see-through bangs
    fringe(p, H_HAIR, [-0.25, -0.15, -0.055, 0.045, 0.14, 0.24], 0.225, 0.21, 0.095, true, 0.25)
    // long wavy hair: a loose mane behind, face-framing locks with lighter streaks
    p.push({ g: hairCurtain({ bottom: -0.86, r0: 0.46, r1: 0.36, gap: 0.8, grooves: 9, wave: 0.05, tips: 0.1, seed: 3 }), c: H_HAIR })
    for (const s of [-1, 1]) {
      wavy(p, H_HAIR, s * 0.31, 0.13, 0.12, 0.8, 0.045, s, 0.07, 0.028, 0.06)
      wavy(p, H_HAIR_LT, s * 0.38, 0.0, 0.1, 0.82, 0.05, s + 1.3, 0.055, 0.024, 0.08)
    }
    // a little antenna strand
    p.push({ g: taperTube([onHead(0.2, 1.3, 1.0), onHead(0.3, 1.45, 1.25), onHead(0.55, 1.3, 1.32)], 0.022, 0.004, 10, 5), c: H_HAIR })
    shine(p, '#b98466', 0.27, 1.1, 2.0, 0.015)
  },
  torso: (p) => {
    p.push({ g: garmentLathe(SHIRT), c: '#ffffff', m: 'garment' })
    // an open shirt collar lying back on both shoulders
    for (const s of [-1, 1]) {
      const f = collarFlap(0.11, 0.1)
      if (s < 0) f.scale(-1, 1, 1)
      p.push({ g: f, c: '#f3e19a', p: [s * 0.055, 0.39, 0.07], r: [-1.1, s * 0.55, s * 0.1] })
    }
    p.push({ g: new THREE.CylinderGeometry(0.1, 0.11, 0.035, 20, 1, true), c: '#f3e19a', p: [0, 0.37, -0.01] })
    // sling bag strap: from her right shoulder across the chest to the left hip
    p.push({
      g: taperTube([V(-0.12, 0.37, -0.1), V(-0.13, 0.35, 0.08), V(-0.05, 0.26, 0.18), V(0.07, 0.14, 0.2), V(0.17, 0.05, 0.16), V(0.215, 0.0, 0.06), V(0.18, 0.06, -0.14), V(0.02, 0.24, -0.2), V(-0.12, 0.37, -0.1)], 0.013, 0.013, 40, 6, 0.4),
      c: '#27335a',
    })
  },
  torsoExtra: <SlingBag />,
  garment: hanoiShirtTex,
  sleeveTex: hanoiSleeve,
  arm: { sleeve: '#f6e6a2', short: true },
  leg: { pant: '#b7c9e2', cuff: '#d0dcee', wide: true, shoe: '#f7f7f5', sole: '#e8e4dc', stripe: '#27335a' },
  handR: (
    <>
      <VSign id="hanoi" />
      <Bracelet />
    </>
  ),
  handL: <Daisies />,
  scale: 0.97,
}

function Bracelet() {
  const build = useMemo(
    () => () => {
      const p: Part[] = []
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2
        p.push({ g: G.sphereXs, c: k % 3 === 0 ? '#f7c6d2' : '#fbf6ee', m: 'gloss', p: [Math.cos(a) * 0.05, 0.05, Math.sin(a) * 0.05], s: 0.013 })
      }
      return p
    },
    [],
  )
  return <Props build={build} />
}

function SlingBag() {
  const build = useMemo(
    () => () => [
      { g: roundedBox(0.15, 0.12, 0.06, 0.025), c: '#27335a', p: [0.235, 0.0, 0.05], r: [0, 1.25, 0.05] } as Part,
      { g: roundedBox(0.15, 0.07, 0.066, 0.02), c: '#33416e', p: [0.232, 0.03, 0.052], r: [0, 1.25, 0.05] } as Part,
      { g: roundedBox(0.03, 0.02, 0.01, 0.005), c: '#d9b25a', m: 'gold', p: [0.265, 0.01, 0.06], r: [0, 1.25, 0] } as Part,
    ],
    [],
  )
  const bunny = useMemo(
    () => () => {
      const Wb = '#fbfaf6'
      const p: Part[] = [
        { g: G.torus, c: '#c7ccd4', m: 'gloss', p: [0, 0, 0], r: [0, Math.PI / 2, 0], s: 0.016 },
        { g: G.sphere, c: Wb, p: [0, -0.055, 0], s: 0.03 },
        { g: G.sphere, c: Wb, p: [0, -0.1, 0], s: [0.027, 0.03, 0.024] },
        { g: G.sphere, c: Wb, p: [0.012, -0.012, 0], r: [0, 0, -0.2], s: [0.01, 0.03, 0.008] },
        { g: G.sphere, c: Wb, p: [-0.012, -0.012, 0], r: [0, 0, 0.2], s: [0.01, 0.03, 0.008] },
        { g: G.sphere, c: '#5fb26a', p: [0.012, -0.082, 0.02], s: [0.012, 0.008, 0.006] },
        { g: G.sphere, c: '#5fb26a', p: [-0.012, -0.082, 0.02], s: [0.012, 0.008, 0.006] },
        { g: G.sphereXs, c: '#2a2426', p: [0.01, -0.05, 0.027], s: 0.004 },
        { g: G.sphereXs, c: '#2a2426', p: [-0.01, -0.05, 0.027], s: 0.004 },
        { g: G.sphereXs, c: '#f5a3b5', p: [0, -0.06, 0.029], s: 0.004 },
        // a tiny green four-leaf charm beside it
        { g: G.sphereXs, c: '#3f9a6b', p: [0.03, -0.04, -0.005], s: [0.012, 0.012, 0.004] },
      ]
      return p
    },
    [],
  )
  return (
    <group>
      <Props build={build} />
      <Charms id="hanoi" position={[0.27, 0.0, 0.1]}>
        <Props build={bunny} />
      </Charms>
    </group>
  )
}

/** a small bunch of cúc họa mi wrapped in kraft paper */
function Daisies() {
  const build = useMemo(
    () => () => {
      const p: Part[] = [
        { g: new THREE.ConeGeometry(0.06, 0.16, 10, 1, true), c: '#d9bb8c', p: [0, -0.02, 0.05], r: [Math.PI + 0.35, 0, 0] },
        { g: G.torus, c: '#e7a0b4', p: [0, -0.05, 0.035], r: [Math.PI / 2 + 0.35, 0, 0], s: [0.028, 0.028, 0.05] },
      ]
      const heads: [number, number, number][] = [
        [0, 0.08, 0.1],
        [0.035, 0.07, 0.08],
        [-0.035, 0.07, 0.085],
        [0.02, 0.1, 0.07],
        [-0.02, 0.1, 0.065],
        [0.045, 0.045, 0.1],
        [-0.045, 0.05, 0.1],
      ]
      for (const [x, y, z] of heads) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          p.push({ g: G.sphereXs, c: '#fdfcf6', p: [x + Math.cos(a) * 0.016, y + Math.sin(a) * 0.016, z], r: [0, 0, a], s: [0.012, 0.005, 0.004] })
        }
        p.push({ g: G.sphereXs, c: '#f2c230', p: [x, y, z + 0.004], s: 0.008 })
      }
      for (const s of [-1, 1]) p.push({ g: G.sphereLo, c: '#6fa54f', p: [s * 0.04, 0.02, 0.07], r: [0, 0, s * 0.8], s: [0.01, 0.035, 0.006] })
      return p
    },
    [],
  )
  return (
    <group rotation={[0.25, 0, 0.2]}>
      <Props build={build} />
    </group>
  )
}

export function Hanoi() {
  return <Chibi id="hanoi" look={hanoiLook} />
}

const LONG_ROBE: [number, number][] = [
  [0, -0.25],
  [0.3, -0.25],
  [0.28, -0.17],
  [0.24, -0.04],
  [0.215, 0.08],
  [0.205, 0.18],
  [0.168, 0.29],
  [0.105, 0.355],
  [0, 0.372],
]

// ═══════════════════════════════════════════════════════════
//  NỮ QUAN — court lady in áo đối khâm, with a lacquered sutra
// ═══════════════════════════════════════════════════════════
const BLACK_HAIR = '#1e1718'

function courtLadyLook(handL: ReactNode, handR: ReactNode): ChibiLook {
  return {
    skin: '#fde3d3',
    face: { iris: ['#3a2418', '#b07a50'], brow: '#3a2a22', lash: '#2a1a14', tilt: 0.12, sparkle: true },
    head: (p) => {
      hairCap(p, BLACK_HAIR, 1.05, 0.05, 0.05)
      fringe(p, BLACK_HAIR, [-0.22, -0.11, 0, 0.11, 0.22], 0.2, 0.14, 0.14, false)
      // khăn vấn: a dark wrapped turban, two layered coils with a gold edge
      p.push({ g: new THREE.TorusGeometry(0.385, 0.05, 10, 40), c: '#3f2a22', p: [0, 0.21, -0.03], r: [Math.PI / 2 - 0.2, 0, 0] })
      p.push({ g: new THREE.TorusGeometry(0.35, 0.042, 10, 40), c: '#4d3328', p: [0, 0.27, -0.05], r: [Math.PI / 2 - 0.24, 0, 0.08] })
      p.push({ g: new THREE.TorusGeometry(0.4, 0.01, 5, 40), c: '#e9c46a', m: 'gold', p: [0, 0.175, -0.02], r: [Math.PI / 2 - 0.2, 0, 0] })
      // low bun with a jade hairpin, small jade earrings
      p.push({ g: G.sphere, c: BLACK_HAIR, p: [0, -0.02, -0.4], s: [0.15, 0.12, 0.12] })
      p.push({ g: G.cyl, c: '#5fb28c', m: 'ceramic', p: [0, 0.0, -0.44], r: [0, 0, 1.4], s: [0.014, 0.4, 0.014] })
      for (const s of [-1, 1]) p.push({ g: G.sphere, c: '#5fb28c', m: 'ceramic', p: [s * 0.4, -0.14, 0.03], s: [0.022, 0.03, 0.022] })
      shine(p, '#5a4a52', 0.36, 1.02, 1.4, 0.012)
    },
    torso: (p) => {
      p.push({ g: garmentLathe(LONG_ROBE), c: '#ffffff', m: 'garment' })
      // silk sash (thắt lưng) with a front knot
      p.push({ g: new THREE.TorusGeometry(0.212, 0.022, 6, 28), c: '#e98aa0', p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0] })
      p.push({ g: G.sphere, c: '#e98aa0', p: [0.05, 0.05, 0.21], s: [0.05, 0.035, 0.03] })
      // standing inner collar
      p.push({ g: new THREE.TorusGeometry(0.1, 0.02, 6, 20), c: '#e9d8a6', p: [0, 0.35, 0.01], r: [Math.PI / 2, 0, 0] })
    },
    garment: doiKhamTex,
    sleeveTex: doiKhamSleeve,
    arm: { sleeve: '#2e6b66', cuff: '#e9d8a6' },
    leg: { pant: '#2a2228', shoe: '#2d2b30', hidden: true },
    ribbons: [
      { anchor: 'hips', offset: [0.06, 0.05, 0.2], color: '#e98aa0', width: 0.045, length: 0.32, segs: 6, side: 1 },
      { anchor: 'hips', offset: [0.1, 0.05, 0.19], color: '#e98aa0', width: 0.045, length: 0.26, segs: 6, side: 2.5 },
    ],
    handL,
    handR,
  }
}

export function CourtLady() {
  const handL = useRef<THREE.Group>(null)
  const handR = useRef<THREE.Group>(null)
  const look = useMemo(() => courtLadyLook(<group ref={handL} />, <group ref={handR} />), [])
  return (
    <>
      <Chibi id="lady" look={look} />
      <SutraBook handL={handL} handR={handR} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════
//  CÔNG NƯƠNG — princess in áo nhật bình, dancing with lotus lanterns
// ═══════════════════════════════════════════════════════════
/** hoa đăng: a small lotus lantern with a glowing heart */
function LotusLantern() {
  const build = useMemo(
    () => () => {
      const p: Part[] = [{ g: G.cyl, c: '#3f9a6b', p: [0, -0.02, 0.05], s: [0.05, 0.02, 0.05] }]
      for (let ring = 0; ring < 2; ring++)
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + ring * 0.4
          const r = ring ? 0.045 : 0.07
          p.push({ g: G.sphereLo, c: ring ? '#f7c3d3' : '#ee8fb0', p: [Math.cos(a) * r, 0.03 + ring * 0.02, 0.05 + Math.sin(a) * r], r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], s: [0.03, 0.06, 0.02] })
        }
      return p
    },
    [],
  )
  return (
    <group position={[0, 0.02, 0.02]}>
      <Props build={build} />
      <mesh position={[0, 0.06, 0.05]}>
        <sphereGeometry args={[0.028, 12, 10]} />
        <meshBasicMaterial color="#ffdc8a" toneMapped={false} />
      </mesh>
    </group>
  )
}

const princessLook: ChibiLook = {
  skin: '#fde6d8',
  face: { iris: ['#2a1a2e', '#a0708c'], brow: '#2a1a1e', lash: '#221418', tilt: 0.08, sparkle: true },
  head: (p) => {
    hairCap(p, BLACK_HAIR, 1.05, 0.05, 0.05)
    fringe(p, BLACK_HAIR, [-0.22, -0.11, 0, 0.11, 0.22], 0.2, 0.14, 0.14, false)
    p.push({ g: G.sphere, c: BLACK_HAIR, p: [0, 0.3, -0.34], s: [0.17, 0.14, 0.14] })
    // khăn vành: a golden turban ring, embroidered edge
    p.push({ g: new THREE.TorusGeometry(0.4, 0.085, 10, 44), c: '#e6b53a', m: 'gold', p: [0, 0.2, -0.02], r: [Math.PI / 2 - 0.16, 0, 0] })
    p.push({ g: new THREE.TorusGeometry(0.42, 0.014, 5, 44), c: '#b3262e', p: [0, 0.2, 0.0], r: [Math.PI / 2 - 0.16, 0, 0] })
    // little golden phoenix crowning the front
    const fz = 0.33
    p.push({ g: G.sphere, c: '#f0c24e', m: 'gold', p: [0, 0.38, fz], s: [0.05, 0.04, 0.06] })
    p.push({ g: G.sphere, c: '#f0c24e', m: 'gold', p: [0, 0.43, fz + 0.05], s: 0.028 })
    for (const s of [-1, 1]) p.push({ g: G.cone, c: '#f0c24e', m: 'gold', p: [s * 0.07, 0.41, fz - 0.01], r: [0, 0, -s * 1.1], s: [0.03, 0.11, 0.015] })
    for (let k = 0; k < 3; k++) p.push({ g: taperTube([V(0, 0.38, fz - 0.05), V((k - 1) * 0.06, 0.48, fz - 0.15), V((k - 1) * 0.12, 0.5, fz - 0.28)], 0.018, 0.006, 8, 5), c: '#f0c24e', m: 'gold' })
    p.push({ g: G.sphereLo, c: '#c8342b', m: 'gloss', p: [0, 0.39, fz + 0.06], s: 0.015 })
    // pearl strands from two side hairpins
    for (const s of [-1, 1]) {
      p.push({ g: G.cyl, c: '#f0c24e', m: 'gold', p: [s * 0.36, 0.26, 0.08], r: [0, 0, s * 0.9], s: [0.012, 0.16, 0.012] })
      for (let k = 0; k < 4; k++) p.push({ g: G.sphereXs, c: '#fbf5ea', m: 'gloss', p: [s * (0.42 + k * 0.005), 0.2 - k * 0.045, 0.1], s: 0.017 })
    }
    for (const s of [-1, 1]) p.push({ g: G.sphere, c: '#f0c24e', m: 'gold', p: [s * 0.4, -0.14, 0.03], s: [0.022, 0.03, 0.022] })
  },
  torso: (p) => {
    p.push({ g: garmentLathe(LONG_ROBE), c: '#ffffff', m: 'garment' })
    // the nhật bình collar: a flat square yoke on the shoulders, blue with a gold rim
    const yoke = new THREE.Shape()
    yoke.moveTo(-0.27, -0.24)
    yoke.lineTo(0.27, -0.24)
    yoke.lineTo(0.27, 0.24)
    yoke.lineTo(-0.27, 0.24)
    yoke.lineTo(-0.27, -0.24)
    const hole = new THREE.Path()
    hole.moveTo(-0.1, -0.1)
    hole.lineTo(-0.1, 0.1)
    hole.lineTo(0.1, 0.1)
    hole.lineTo(0.1, -0.1)
    hole.lineTo(-0.1, -0.1)
    yoke.holes.push(hole)
    const yg = new THREE.ExtrudeGeometry(yoke, { depth: 0.022, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 })
    yg.rotateX(-Math.PI / 2)
    p.push({ g: yg, c: '#23457d', p: [0, 0.33, 0.01], r: [0.12, 0, 0] })
    const rim = new THREE.ExtrudeGeometry(
      (() => {
        const s2 = new THREE.Shape()
        s2.moveTo(-0.285, -0.255)
        s2.lineTo(0.285, -0.255)
        s2.lineTo(0.285, 0.255)
        s2.lineTo(-0.285, 0.255)
        s2.lineTo(-0.285, -0.255)
        const h2 = new THREE.Path()
        h2.moveTo(-0.26, -0.23)
        h2.lineTo(-0.26, 0.23)
        h2.lineTo(0.26, 0.23)
        h2.lineTo(0.26, -0.23)
        h2.lineTo(-0.26, -0.23)
        s2.holes.push(h2)
        return s2
      })(),
      { depth: 0.026, bevelEnabled: false },
    )
    rim.rotateX(-Math.PI / 2)
    p.push({ g: rim, c: '#e8c267', m: 'gold', p: [0, 0.332, 0.01], r: [0.12, 0, 0] })
    // gold embroidered medallions on the yoke corners
    for (const [x, z] of [
      [-0.18, 0.18],
      [0.18, 0.18],
      [-0.18, -0.16],
      [0.18, -0.16],
    ])
      p.push({ g: G.cyl, c: '#f0c24e', m: 'gold', p: [x, 0.36 + z * 0.12, z + 0.01], r: [0.12, 0, 0], s: [0.035, 0.01, 0.035] })
  },
  garment: nhatBinhTex,
  sleeveTex: nhatBinhSleeve,
  arm: { sleeve: '#b3262e', cuff: '#f7ecd2', wide: true, long: true },
  leg: { pant: '#b3262e', shoe: '#2d2b30', hidden: true },
  handL: <LotusLantern />,
  handR: <LotusLantern />,
}

export function Princess() {
  return <Chibi id="princess" look={princessLook} />
}

