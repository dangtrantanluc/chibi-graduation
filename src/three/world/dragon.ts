import * as THREE from 'three'
import { G, type MatKey, type Part } from '../lib/kit'
import { taperTube } from '../characters/hair'

/*
 * Vietnamese dragons, built along any spine — each monument wears the dragon
 * of its own time.
 *
 *   'ly'      Thăng Long (Lý dynasty, 11th–13th c.), after the reliefs and the
 *             way sculptors rebuild them in the round: a long smooth body in
 *             many soft bends, easing evenly to a whip of a tail; broad plates
 *             down the belly, fine scales on the back, a low close fin of small
 *             flames all the way along, long as a mane on the neck; a tuft
 *             at the tip of the tail. The head is hornless: the upper lip
 *             turns up into a tall fleshy leaf (the crest) with a ridge
 *             winding up each face like an S; a long tusk curves up beside it
 *             from the corner of the mouth; a heavy brow, the ear a rolled
 *             scroll behind it; the mouth open on rows of small teeth, a whip
 *             of a tongue and a pearl; the mane streams straight back in long
 *             waving locks and the beard with it under the jaw. Slender legs
 *             with three claws and a spur, a tuft streaming from each elbow
 *   'tayson'  the Hoàng Đế citadel (Tây Sơn, late 18th c., in the manner the
 *             Lê Trung Hưng carvers left): a heavy body in a few strong
 *             humps, a big horned head, and "đao mác" — long straight blades
 *             of flame streaming from the head and the elbows; the tail a
 *             single long flame
 *   'nguyen'  Huế (Nguyễn dynasty, 19th c.): robust, a big head with branched
 *             antlers, bulging eyes, flame brows, fangs and beard, a mane of
 *             sharp curling flames, tall spiky fins, four clawed legs, a
 *             fanned flame tail
 *
 * Everything is returned as kit parts in world space, so a dragon bakes into
 * the building it belongs to (no extra draw calls).
 */

export type DragonStyle = 'ly' | 'tayson' | 'nguyen'

export interface DragonOpts {
  /** the spine, head first */
  pts: THREE.Vector3[]
  /** body radius at the shoulders */
  r: number
  style?: DragonStyle
  body: string
  belly?: string
  fin?: string
  mane?: string
  horn?: string
  /** material of the body, and of the trimmings (horns, fins, mane) */
  m?: MatKey
  accent?: MatKey
  legs?: boolean
  /** 'low' drops the belly, teeth, whiskers and beard (small or distant dragons) */
  detail?: 'full' | 'low'
  /** head size relative to the body radius */
  head?: number
  /** which way the back faces at a point of the spine (default: straight up) */
  up?: (p: THREE.Vector3, t: number) => THREE.Vector3
  pearl?: boolean
}

const Y = new THREE.Vector3(0, 1, 0)
const tint = (hex: string, to: string, k: number) => '#' + new THREE.Color(hex).lerp(new THREE.Color(to), k).getHexString()
const compose = (p: THREE.Vector3, q: THREE.Quaternion, s: THREE.Vector3) => new THREE.Matrix4().compose(p, q, s)

/** a matrix that puts a unit cone (apex +y) at `p`, pointing along `dir`, `len` long, `w` × `thin` across (thin along `flatAxis`) */
function flame(p: THREE.Vector3, dir: THREE.Vector3, flatAxis: THREE.Vector3, len: number, w: number, thin: number) {
  const y = dir.clone().normalize()
  const z = flatAxis.clone().addScaledVector(y, -flatAxis.dot(y)).normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  return new THREE.Matrix4().makeBasis(x.multiplyScalar(w), y.clone().multiplyScalar(len), z.multiplyScalar(thin)).setPosition(p.clone().addScaledVector(y, len / 2))
}

/**
 * A ribbon along `pts`: its half-width follows `rad(t)` in the direction `wide`, and it is `flat` times
 * as thick the other way (a leaf of flame, a lock of mane, a tuft). `flat` = 1 gives a round tube.
 */
function ribbon(pts: THREE.Vector3[], rad: (t: number) => number, wide: THREE.Vector3, flat: number, seg = 12, radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts)
  const pos: number[] = []
  const idx: number[] = []
  const n = new THREE.Vector3()
  const b = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const c = curve.getPointAt(t)
    const T = curve.getTangentAt(t)
    n.copy(wide).addScaledVector(T, -wide.dot(T))
    if (n.lengthSq() < 1e-6) n.set(T.y, T.z, T.x).addScaledVector(T, -(T.x * T.y + T.y * T.z + T.z * T.x))
    n.normalize()
    b.crossVectors(T, n)
    const r = Math.max(1e-4, rad(t))
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r * flat
      pos.push(c.x + n.x * x + b.x * y, c.y + n.y * x + b.y * y, c.z + n.z * x + b.z * y)
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const d = i * radial + ((j + 1) % radial)
      idx.push(a, d, a + radial, d, d + radial, a + radial)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export interface HeadColors {
  body: string
  belly: string
  mane: string
  horn: string
}

/**
 * A dragon's head in the frame M (x: its left, y: up, z: forward out of the
 * snout; one unit = the head's half-length).
 */
export function dragonHead(M: THREE.Matrix4, style: DragonStyle, c: HeadColors, m: MatKey, accent: MatKey, full: boolean, pearl: boolean): Part[] {
  const p: Part[] = []
  const E = new THREE.Euler()
  const Q = new THREE.Quaternion()
  const at = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) =>
    M.clone().multiply(compose(new THREE.Vector3(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)).clone(), new THREE.Vector3(sx, sy, sz)))
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(M)
  const unit = new THREE.Vector3().setFromMatrixColumn(M, 2).length()
  const tube = (pts: [number, number, number][], r0: number, r1: number, col: string, mat: MatKey, flat = 1) => p.push({ g: taperTube(pts.map(([x, y, z]) => v(x, y, z)), r0 * unit, r1 * unit, 10, 6, flat), c: col, m: mat })
  if (style === 'ly') return lyHead(M, c, m, accent, full, pearl)
  const slim = 1

  // skull, brow, upper jaw, nose
  p.push({ g: G.sphereLo, c: c.body, m, mat: at(0, 0.1, 0.15, 0.62 * slim, 0.56 * slim, 0.72) })
  p.push({ g: G.sphereLo, c: c.body, m, mat: at(0, 0.4, 0.5, 0.42 * slim, 0.26, 0.4) })
  p.push({ g: G.sphereLo, c: c.body, m, mat: at(0, 0.04, 0.98, 0.42 * slim, 0.28, 0.64) })
  p.push({ g: G.sphereLo, c: c.belly, m, mat: at(0, 0.14, 1.52, 0.27, 0.2, 0.22) })
  // lower jaw, open, and the red of the mouth
  p.push({ g: G.sphereLo, c: c.belly, m, mat: at(0, -0.36, 0.86, 0.34 * slim, 0.13, 0.56, 0.32) })
  p.push({ g: G.sphereLo, c: '#a3241f', m, mat: at(0, -0.2, 0.92, 0.28 * slim, 0.07, 0.46, 0.16) })
  if (pearl) p.push({ g: G.sphereLo, c: '#ffe9a8', m: 'gold', mat: at(0, -0.22, 1.36, 0.15, 0.15, 0.15) })
  // eyes under flame brows
  for (const s of [-1, 1]) {
    p.push({ g: G.sphereLo, c: '#fbf6e8', m, mat: at(s * 0.36 * slim, 0.36, 0.74, 0.15, 0.15, 0.11) })
    p.push({ g: G.sphereXs, c: '#231a1a', m, mat: at(s * 0.4 * slim, 0.37, 0.83, 0.07, 0.08, 0.05) })
    p.push({ g: G.coneLo, c: c.mane, m: accent, mat: at(s * 0.36 * slim, 0.62, 0.42, 0.1, 0.46, 0.05, -1.15, 0, -s * 0.3) })
    // ears
    p.push({ g: G.sphereLo, c: c.body, m, mat: at(s * 0.6 * slim, 0.22, -0.05, 0.07, 0.2, 0.26, 0, -s * 0.5, 0) })
  }
  {
    // branched antlers
    for (const s of [-1, 1]) {
      tube(
        [
          [s * 0.26, 0.55, 0.12],
          [s * 0.4, 1.08, -0.36],
          [s * 0.5, 1.34, -1.0],
        ],
        0.075,
        0.02,
        c.horn,
        accent,
      )
      if (style === 'nguyen')
        tube(
          [
            [s * 0.4, 1.06, -0.34],
            [s * 0.66, 1.36, -0.28],
          ],
          0.045,
          0.015,
          c.horn,
          accent,
        )
    }
  }
  // the mane: locks streaming back from the crown and the cheeks.
  // Tây Sơn: straight blades of flame (đao mác); Nguyễn: a fan of shorter, upswept flames
  const blade = style === 'tayson'
  const locks = blade ? [-2, -1, 0, 1, 2] : [-3, -2, -1, 0, 1, 2, 3]
  for (const k of locks) {
    const a = Math.abs(k)
    const len = blade ? 2.9 - a * 0.3 : 1.9 - a * 0.16
    tube(
      [
        [k * 0.15, 0.3 - a * 0.07, -0.35],
        [k * (blade ? 0.26 : 0.3), (blade ? 0.42 : 0.52) - a * 0.12, -0.35 - len * 0.45],
        [k * (blade ? 0.38 : 0.44), (blade ? 0.54 : 0.78) - a * (blade ? 0.16 : 0.2), -0.35 - len],
      ],
      blade ? 0.1 : 0.12,
      0.012,
      c.mane,
      accent,
      blade ? 0.32 : 0.5,
    )
  }
  for (const s of [-1, 1])
    tube(
      [
        [s * 0.52, -0.1, 0.1],
        [s * 0.92, -0.06, -0.6],
        [s * 1.08, 0.22, -1.25],
      ],
      0.1,
      0.012,
      c.mane,
      accent,
      0.5,
    )
  if (full) {
    // whiskers curling out and back from the snout
    for (const s of [-1, 1])
      tube(
        [
          [s * 0.28, -0.02, 1.36],
          [s * 0.78, 0.06, 1.52],
          [s * 1.16, 0.38, 1.02],
          [s * 1.26, 0.8, 0.4],
        ],
        0.04,
        0.008,
        c.horn,
        accent,
      )
    // fangs and a beard
    for (const s of [-1, 1]) {
      p.push({ g: G.coneLo, c: '#fbf6e8', m, mat: at(s * 0.2 * slim, -0.2, 1.3, 0.05, 0.17, 0.05, Math.PI) })
      p.push({ g: G.coneLo, c: '#fbf6e8', m, mat: at(s * 0.16 * slim, -0.3, 1.16, 0.04, 0.12, 0.04, 0.3) })
      p.push({ g: G.coneLo, c: c.mane, m: accent, mat: at(s * 0.13, -0.66, 0.5, 0.08, 0.42, 0.05, Math.PI + 0.5) })
    }
    p.push({ g: G.coneLo, c: c.mane, m: accent, mat: at(0, -0.72, 0.62, 0.09, 0.5, 0.05, Math.PI + 0.35) })
  }
  return p
}

/**
 * The head of a Lý dragon (same frame as dragonHead). Everything that makes it
 * a Lý dragon is here: the leaf of flame the upper lip turns up into, the long
 * tusk beside it, the open mouth with its teeth, tongue and pearl, the S on the
 * brow, the mane streaming back and the beard in waves.
 */
function lyHead(M: THREE.Matrix4, c: HeadColors, m: MatKey, accent: MatKey, full: boolean, pearl: boolean): Part[] {
  const p: Part[] = []
  const E = new THREE.Euler()
  const Q = new THREE.Quaternion()
  const at = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) =>
    M.clone().multiply(compose(new THREE.Vector3(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)).clone(), new THREE.Vector3(sx, sy, sz)))
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(M)
  const unit = new THREE.Vector3().setFromMatrixColumn(M, 2).length()
  type P3 = [number, number, number]
  const tube = (pts: P3[], r0: number, r1: number, col: string, mat: MatKey, flat = 1, seg = 10) => p.push({ g: taperTube(pts.map(([x, y, z]) => v(x, y, z)), r0 * unit, r1 * unit, seg, 6, flat), c: col, m: mat })
  /** a direction of the head's frame, in the world */
  const axis = ([x, y, z]: P3) => new THREE.Vector3(x, y, z).transformDirection(M)
  const leaf = (pts: P3[], rad: (t: number) => number, wide: P3, col: string, mat: MatKey, flat: number, seg = 12) =>
    p.push({ g: ribbon(pts.map(([x, y, z]) => v(x, y, z)), (t) => rad(t) * unit, axis(wide), flat, seg, 6), c: col, m: mat })
  /** a lock of hair from `root` along `dir`, waving across `wave` as it goes, its tip flicked `flick` */
  const lock = (root: P3, dir: P3, len: number, r0: number, wave: P3, amp: number, phase: number, flick: P3 = [0, 0, 0], flat = 0.42) => {
    const n = full ? 5 : 3
    const pts: P3[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const w = amp * Math.sin(phase + t * 4.6) * Math.min(1, t * 1.6)
      const f = t * t * t
      pts.push([root[0] + dir[0] * len * t + wave[0] * w + flick[0] * f, root[1] + dir[1] * len * t + wave[1] * w + flick[1] * f, root[2] + dir[2] * len * t + wave[2] * w + flick[2] * f])
    }
    // a flame of hair: full from the root for most of its length, then drawn out to a point
    // (it is broad the way it waves, so its curves show from the side)
    leaf(pts, (t) => r0 * (0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.25) * 0.8)) * (1 - Math.pow(t, 2.2)), wave, c.mane, accent, flat, full ? 10 : 6)
  }
  // (a dragon carved of stone or cast in bronze is all of one colour: no red mouth, no white of the eye)
  const mono = m === 'aged' || m === 'stone' || m === 'bronze'
  const ivory = mono ? tint(c.belly, '#ffffff', 0.18) : tint(c.horn, '#fff8e6', 0.5)
  const red = mono ? tint(c.body, '#000000', 0.42) : '#a3241f'
  const tongue = mono ? tint(c.body, '#000000', 0.2) : '#b8322a'
  const pupil = mono ? tint(c.body, '#000000', 0.55) : '#231a1a'
  const iris = mono ? c.belly : '#e2452a'
  const bodyLt = tint(c.body, c.belly, 0.6)
  const bodyDk = tint(c.body, '#000000', 0.16)
  const ridgeCol = tint(c.belly, '#ffffff', 0.25)

  // the skull: a small domed head, a brow over each eye, a long upper jaw lifting toward the lip
  p.push({ g: G.sphereLo, c: c.body, m, mat: at(0, 0.12, 0.05, 0.54, 0.52, 0.66) })
  p.push({ g: G.sphereLo, c: c.body, m, mat: at(0, 0.44, 0.5, 0.4, 0.2, 0.36) })
  p.push({ g: G.sphereLo, c: c.body, m, mat: at(0, 0.1, 0.98, 0.33, 0.23, 0.68, -0.14) })
  p.push({ g: G.sphereLo, c: c.body, m, mat: at(0, 0.3, 1.56, 0.21, 0.26, 0.2) })
  // the lower jaw, wide open; the red of the mouth; the pearl held at the back of it
  const jaw = (k: number, up = 0): P3 => [0, -0.2 - 0.44 * k + up, 0.3 + 1.02 * k]
  p.push({ g: G.sphereLo, c: c.belly, m, mat: at(0, -0.42, 0.8, 0.27, 0.1, 0.56, 0.42) })
  p.push({ g: G.sphereLo, c: c.belly, m, mat: at(...jaw(1.0, 0.05), 0.12, 0.1, 0.12) })
  p.push({ g: G.sphereLo, c: red, m, mat: at(0, -0.3, 0.8, 0.22, 0.05, 0.48, 0.42) })
  p.push({ g: G.sphereLo, c: red, m, mat: at(0, -0.06, 0.86, 0.24, 0.05, 0.52, -0.14) })
  if (pearl) p.push({ g: G.sphereLo, c: mono ? ivory : '#ffe9a8', m: mono ? m : 'gold', mat: at(0, -0.17, 0.62, 0.19, 0.19, 0.19) })

  for (const s of [-1, 1]) {
    // the eye: round and full, a red iris, deep under a heavy brow that sweeps up and back
    p.push({ g: G.sphereLo, c: iris, m, mat: at(s * 0.32, 0.33, 0.68, 0.14, 0.13, 0.12) })
    p.push({ g: G.sphereXs, c: pupil, m, mat: at(s * 0.38, 0.33, 0.77, 0.035, 0.085, 0.04, 0, s * 0.6, 0) })
    p.push({ g: G.sphereLo, c: bodyLt, m, mat: at(s * 0.3, 0.24, 0.7, 0.16, 0.07, 0.14, 0.15) })
    tube(
      [
        [s * 0.12, 0.4, 1.1],
        [s * 0.3, 0.5, 0.9],
        [s * 0.46, 0.53, 0.62],
        [s * 0.54, 0.46, 0.3],
      ],
      0.125,
      0.07,
      bodyDk,
      m,
      1,
      8,
    )
    // nostrils on the turned-up lip
    p.push({ g: G.sphereXs, c: c.belly, m, mat: at(s * 0.13, 0.34, 1.62, 0.07, 0.07, 0.07) })
    // the long tusk: out of the corner of the upper lip, forward and up past the crest, its tip curling back
    p.push({ g: G.sphereLo, c: c.belly, m, mat: at(s * 0.27, 0.05, 1.12, 0.12, 0.09, 0.13) })
    tube(
      [
        [s * 0.27, 0.04, 1.12],
        [s * 0.44, 0.34, 1.46],
        [s * 0.47, 0.86, 1.6],
        [s * 0.4, 1.34, 1.42],
      ],
      0.115,
      0.014,
      ivory,
      m,
      1,
      12,
    )
    // the ear: a rolled scroll, like a curl of cloud, behind the brow
    if (full) {
      const roll: P3[] = []
      for (let i = 0; i <= 9; i++) {
        const k = i / 9
        const a = 2.4 + k * 8.2
        const r = 0.27 * (1 - 0.78 * k)
        roll.push([s * (0.4 + 0.07 * k), 0.6 + Math.sin(a) * r, 0.02 + Math.cos(a) * r])
      }
      tube(roll, 0.085, 0.035, bodyLt, m, 1, 18)
    } else p.push({ g: G.sphereLo, c: bodyLt, m, mat: at(s * 0.42, 0.6, 0.02, 0.08, 0.24, 0.24) })
    // a frill of small flames behind the brow
    lock([s * 0.3, 0.56, 0.5], [s * 0.2, 0.34, -1], 1.05, 0.1, [0, 1, 0], 0.08, 0.4, [0, 0.25, 0])
    if (full) lock([s * 0.5, 0.36, 0.3], [s * 0.36, 0.1, -1], 0.9, 0.08, [0, 1, 0], 0.07, 1.6, [s * 0.1, 0.18, 0])
  }

  // the crest — the upper lip turns up into a tall fleshy leaf, widest low down, drawn out to a point
  // that leans a little forward
  const H0 = 0.3
  const HC = 2.5
  const spine: P3[] = [
    [0, H0, 1.62],
    [0, H0 + HC * 0.3, 1.78],
    [0, H0 + HC * 0.65, 1.92],
    [0, H0 + HC, 2.2],
  ]
  const FLAT = 0.3
  const blade = (t: number) => {
    const u = Math.min(1, Math.max(0, t))
    return 0.16 * (1 - u) + 0.47 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 0.56))), 0.9) * (1 - 0.25 * u)
  }
  leaf(spine, blade, [0, 0, 1], c.body, m, FLAT, full ? 16 : 8)
  if (full) {
    // on each face a ridge winds up it like an S (the Lý carvers' sign), and a rim follows its front edge
    const cz = (t: number) => 1.62 + 0.5 * t + 0.08 * t * t
    for (const s of [-1, 1]) {
      const ridge: P3[] = []
      for (let i = 0; i <= 14; i++) {
        const t = 0.08 + (i / 14) * 0.8
        const w = blade(t)
        const d = 0.56 * w * Math.sin(t * 15.5)
        ridge.push([s * (FLAT * Math.sqrt(Math.max(0, w * w - d * d)) + 0.02), H0 + HC * t, cz(t) + d])
      }
      tube(ridge, 0.085, 0.04, ridgeCol, m, 1, 28)
    }
    const rim: P3[] = []
    for (let i = 0; i <= 8; i++) {
      const t = 0.02 + (i / 8) * 0.96
      rim.push([0, H0 + HC * t, cz(t) + blade(t) * 0.97])
    }
    tube(rim, 0.06, 0.02, ridgeCol, m, 1, 16)
  }

  // the mane: long waving locks streaming straight back from the crown, the temples and the jaw
  const crown: [number, number, number, number][] = full
    ? [
        [0, 0.58, 2.5, 0.0],
        [-0.2, 0.5, 2.2, 1.1],
        [0.2, 0.5, 2.2, 2.3],
        [-0.38, 0.32, 2.3, 3.1],
        [0.38, 0.32, 2.3, 0.7],
        [-0.48, 0.08, 1.9, 1.9],
        [0.48, 0.08, 1.9, 2.8],
      ]
    : [
        [0, 0.56, 2.4, 0.0],
        [-0.34, 0.34, 2.1, 1.1],
        [0.34, 0.34, 2.1, 2.3],
      ]
  for (const [x, y, len, ph] of crown) lock([x, y, -0.25], [x * 0.3, 0.08 - Math.abs(x) * 0.12, -1], len, 0.2, [0, 1, 0], 0.17, ph, [0, 0.5, 0])
  for (const s of [-1, 1]) lock([s * 0.44, -0.18, 0.1], [s * 0.3, -0.25, -1], 1.7, 0.16, [0, 1, 0], 0.14, s + 1.5, [s * 0.1, 0.55, 0])

  // the beard, in waves under the chin; teeth; the tongue, a long whip curling out of the mouth
  const beard: [number, number, number, number][] = full
    ? [
        [0, 0.92, 1.25, 0.0],
        [-0.11, 0.76, 1.1, 1.3],
        [0.11, 0.76, 1.1, 2.6],
        [-0.15, 0.56, 0.95, 0.6],
        [0.15, 0.56, 0.95, 1.9],
        [-0.17, 0.36, 0.85, 2.2],
        [0.17, 0.36, 0.85, 0.2],
      ]
    : [[0, 0.88, 1.15, 0.0]]
  for (const [x, k, len, ph] of beard) {
    const [, jy, jz] = jaw(k, -0.06)
    lock([x, jy, jz], [x * 0.5, -0.62, -0.8], len * 1.15, 0.14, [0, 0.8, 0.6], 0.13, ph, [0, 0.16, -0.3])
  }
  if (full) {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const z = 0.62 + i * 0.16
        p.push({ g: G.coneLo, c: ivory, m, mat: at(s * (0.27 - i * 0.022), -0.04 + i * 0.012, z, 0.035, 0.11, 0.035, Math.PI) })
      }
      for (let i = 0; i < 5; i++) {
        const [, jy, jz] = jaw(0.42 + i * 0.12, 0.1)
        p.push({ g: G.coneLo, c: ivory, m, mat: at(s * (0.21 - i * 0.02), jy, jz, 0.03, 0.09, 0.03, 0.3) })
      }
      // a fang at the front of the upper jaw
      p.push({ g: G.coneLo, c: ivory, m, mat: at(s * 0.13, -0.02, 1.5, 0.045, 0.2, 0.045, Math.PI) })
    }
    tube(
      [
        [0, -0.3, 0.72],
        [0, -0.46, 1.2],
        [0, -0.44, 1.72],
        [0, -0.2, 2.08],
        [0, 0.02, 2.02],
      ],
      0.075,
      0.012,
      tongue,
      m,
      0.5,
      12,
    )
  }
  return p
}

export interface BodyFrame {
  /** a point of the spine, the direction toward the tail, the back, and the dragon's left there */
  P: THREE.Vector3
  T: THREE.Vector3
  U: THREE.Vector3
  S: THREE.Vector3
}

/**
 * One leg of a Lý dragon on side `s` (±1) of the body frame `f`, the body `rr` thick there: slender,
 * crouched — the thigh out and back to the elbow, the shin down and forward to a foot of three long
 * claws and a spur — with a tuft of flames streaming back from the elbow.
 */
export function lyLeg(f: BodyFrame, rr: number, s: number, c: { body: string; mane: string; claw: string }, m: MatKey, accent: MatKey, full: boolean): Part[] {
  const p: Part[] = []
  const fwd = f.T.clone().multiplyScalar(-1)
  const a = f.P.clone().addScaledVector(f.S, s * rr * 0.62).addScaledVector(f.U, -rr * 0.2)
  const b = f.P.clone().addScaledVector(f.S, s * rr * 1.55).addScaledVector(f.U, rr * 0.2).addScaledVector(fwd, -rr * 0.7)
  const k = f.P.clone().addScaledVector(f.S, s * rr * 1.85).addScaledVector(f.U, -rr * 0.4).addScaledVector(fwd, -rr * 0.1)
  const e = f.P.clone().addScaledVector(f.S, s * rr * 1.9).addScaledVector(f.U, -rr * 0.95).addScaledVector(fwd, rr * 0.75)
  p.push({ g: ribbon([a, b, k, e], (u) => rr * (0.5 - 0.3 * Math.pow(u, 0.7)), f.T, 0.8, 12, 7), c: c.body, m })
  p.push({ g: G.sphereLo, c: c.body, m, mat: compose(a.clone().lerp(b, 0.35), new THREE.Quaternion(), new THREE.Vector3(rr * 0.5, rr * 0.5, rr * 0.5)) })
  p.push({ g: G.sphereLo, c: c.body, m, mat: compose(e, new THREE.Quaternion(), new THREE.Vector3(rr * 0.27, rr * 0.2, rr * 0.3)) })
  // three long claws forward, a spur behind
  for (const j of [-1, 0, 1]) {
    const d = fwd.clone().multiplyScalar(Math.cos(j * 0.5)).addScaledVector(f.S, s * 0.2 + Math.sin(j * 0.5)).addScaledVector(f.U, -0.28)
    p.push({ g: G.coneLo, c: c.claw, m, mat: flame(e.clone().addScaledVector(d, rr * 0.12), d, f.U, rr * 0.78, rr * 0.1, rr * 0.1) })
  }
  p.push({ g: G.coneLo, c: c.claw, m, mat: flame(e, f.T.clone().addScaledVector(f.U, -0.2), f.U, rr * 0.45, rr * 0.085, rr * 0.085) })
  // the tuft at the elbow: flames streaming back along the body, waving
  for (const j of full ? [-1, 0, 1] : [0]) {
    const tip = b.clone().addScaledVector(f.T, rr * (2.3 - Math.abs(j) * 0.5)).addScaledVector(f.U, rr * (0.6 + j * 0.55)).addScaledVector(f.S, s * rr * 0.3)
    const m1 = b.clone().lerp(tip, 0.35).addScaledVector(f.U, rr * 0.22)
    const m2 = b.clone().lerp(tip, 0.7).addScaledVector(f.U, -rr * 0.16)
    p.push({ g: ribbon([b, m1, m2, tip], (u) => rr * 0.26 * (0.6 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.3) * 0.8)) * (1 - Math.pow(u, 2.2)), f.U, 0.4, 8, 6), c: c.mane, m: accent })
  }
  return p
}

/**
 * The hide of a Lý dragon: a tube of `seg` rings by `radial` scales. Alternate rings are turned half
 * a scale, so the triangles between them fall into rows of pointed scales, each row lapping the
 * next like roof tiles; every scale is dark at its root, where it lies under the row in front, and
 * light at its tip. Broad pale plates run down the belly. The rings are placed (and may be moved
 * every frame) with `set`, then `commit`.
 */
export function lyHide(seg: number, radial: number, body: string, belly: string, tail?: string) {
  const n = seg * radial * 6
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const rp = new Float32Array((seg + 1) * radial * 3)
  const rn = new Float32Array((seg + 1) * radial * 3)
  const ang = (i: number, j: number) => ((j + (i % 2) * 0.5) / radial) * Math.PI * 2
  // each quad between two rings is two triangles: A points to the tail (the tip of a scale), B to the
  // head (the root of a scale of the next row). [ring offset, column offset] per corner, apex second.
  const TRIS = [
    // even rings
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    // odd rings (turned half a scale)
    [
      [0, 0],
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  ]
  const ROOT = 0.4
  const MID = 0.8
  const TIP = 1.16
  const cBody = new THREE.Color(body)
  const cBelly = new THREE.Color(belly)
  const cTail = new THREE.Color(tail ?? body)
  const c = new THREE.Color()
  let k = 0
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < radial; j++) {
      const up = Math.sin(ang(i, j + 0.5))
      // (no two scales quite the same shade)
      const shade = 0.93 + 0.12 * (((i * 7 + j * 13) % 5) / 4)
      TRIS[i % 2].forEach(([di], v) => {
        if (up < -0.35) c.copy(cBelly).multiplyScalar(di ? 1.03 : 0.72)
        else {
          // A (corners 0‥2): mid at its base, light at its apex; B (3‥5): dark at its apex, mid at its base
          const tone = v < 3 ? (di ? TIP : MID) : di ? MID : ROOT
          c.copy(cBody)
            .lerp(cTail, i / seg)
            .multiplyScalar(tone * shade * (up > 0.85 ? 0.88 : 1))
        }
        col[k++] = c.r
        col[k++] = c.g
        col[k++] = c.b
      })
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return {
    g,
    /** ring i (0 at the head ‥ seg at the tail) is centred on P, `rr` across, its back toward U and its left toward S */
    set(i: number, P: THREE.Vector3, U: THREE.Vector3, S: THREE.Vector3, rr: number) {
      let o = i * radial * 3
      for (let j = 0; j < radial; j++) {
        const a = ang(i, j)
        const cs = Math.cos(a)
        const sn = Math.sin(a)
        const nx = S.x * cs + U.x * sn
        const ny = S.y * cs + U.y * sn
        const nz = S.z * cs + U.z * sn
        rn[o] = nx
        rn[o + 1] = ny
        rn[o + 2] = nz
        rp[o++] = P.x + nx * rr
        rp[o++] = P.y + ny * rr
        rp[o++] = P.z + nz * rr
      }
    },
    commit() {
      let o = 0
      for (let i = 0; i < seg; i++)
        for (let j = 0; j < radial; j++)
          for (const [di, dj] of TRIS[i % 2]) {
            const v = ((i + di) * radial + ((j + dj) % radial)) * 3
            pos[o] = rp[v]
            pos[o + 1] = rp[v + 1]
            pos[o + 2] = rp[v + 2]
            nor[o] = rn[v]
            nor[o + 1] = rn[v + 1]
            nor[o + 2] = rn[v + 2]
            o += 3
          }
      g.attributes.position.needsUpdate = true
      g.attributes.normal.needsUpdate = true
    },
  }
}

/** the tuft at the tip of a Lý dragon's tail: a few waving flames carrying on the way the tail points (`r` = the body's full girth) */
export function lyTailTuft(f: BodyFrame, r: number, mane: string, accent: MatKey, full: boolean): Part[] {
  const p: Part[] = []
  for (const j of full ? [-1, 0, 1] : [0]) {
    const len = r * (2.6 - Math.abs(j) * 0.7)
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 4; i++) {
      const u = i / 4
      pts.push(
        f.P.clone()
          .addScaledVector(f.T, len * u)
          .addScaledVector(f.U, r * (j * 0.7 * u + 0.3 * Math.sin(u * 4.4 + j) * u))
          .addScaledVector(f.S, r * 0.14 * j * u),
      )
    }
    p.push({ g: ribbon(pts, (u) => r * 0.3 * (0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.2) * 0.85)) * (1 - Math.pow(u, 2.4)), f.U, 0.4, 10, 6), c: mane, m: accent })
  }
  return p
}

/** how thick a Lý dragon is along its length (0 at the head ‥ 1 at the tip of the tail), as a share of its full girth */
export function lyGirth(t: number) {
  const neck = THREE.MathUtils.lerp(0.74, 1, Math.min(1, t / 0.14))
  const hold = 0.36
  return neck * (t < hold ? 1 : THREE.MathUtils.lerp(1, 0.07, Math.pow((t - hold) / (1 - hold), 1.25)))
}

/** A whole dragon along a spine. */
export function dragonParts(o: DragonOpts): Part[] {
  const style = o.style ?? 'nguyen'
  const ly = style === 'ly'
  const m = o.m ?? 'ceramic'
  const accent = o.accent ?? m
  const full = (o.detail ?? 'full') === 'full'
  const body = o.body
  const belly = o.belly ?? tint(body, '#fff6dc', 0.5)
  const fin = o.fin ?? tint(body, '#ffd070', 0.55)
  const mane = o.mane ?? fin
  const horn = o.horn ?? '#e2b44a'
  const r = o.r
  const p: Part[] = []

  const curve = new THREE.CatmullRomCurve3(o.pts, false, 'centripetal')
  const length = curve.getLength()
  // thickness along the spine: a neck, full shoulders and barrel, then the long taper of the tail
  const radius = (t: number) => {
    if (ly) return r * lyGirth(t)
    const neck = THREE.MathUtils.lerp(0.8, 1, Math.min(1, t / 0.14))
    const hold = 0.52
    const tail = t < hold ? 1 : THREE.MathUtils.lerp(1, 0.3, Math.pow((t - hold) / (1 - hold), 1.15))
    return r * neck * tail
  }
  const frame = (t: number) => {
    const P = curve.getPointAt(t)
    const T = curve.getTangentAt(t)
    const U = (o.up?.(P, t) ?? Y).clone()
    U.addScaledVector(T, -U.dot(T))
    if (U.lengthSq() < 1e-6) U.set(0, 0, 1).addScaledVector(T, -T.z)
    U.normalize()
    const S = new THREE.Vector3().crossVectors(U, T).normalize()
    return { P, T, U, S }
  }

  // The body. A Lý dragon (in full) wears its hide scale by scale; the others are one tube painted
  // as it is built — a paler belly along the underside, a darker line down the back, and alternate
  // rings a shade apart, which read as rows of scales.
  if (ly && full) {
    const seg = Math.max(24, Math.min(84, Math.round(length / (r * 0.34))))
    const hide = lyHide(seg, 14, body, belly)
    for (let i = 0; i <= seg; i++) {
      const f = frame(i / seg)
      hide.set(i, f.P, f.U, f.S, radius(i / seg))
    }
    hide.commit()
    hide.g.computeBoundingSphere()
    p.push({ g: hide.g, m, keep: true })
  } else {
    const seg = Math.max(16, Math.min(46, Math.round(length / (r * 0.6))))
    const radial = full ? 8 : 6
    const pos: number[] = []
    const col: number[] = []
    const idx: number[] = []
    const cBody = new THREE.Color(body)
    const cBelly = new THREE.Color(belly)
    const c = new THREE.Color()
    for (let i = 0; i <= seg; i++) {
      const t = i / seg
      const f = frame(t)
      const rr = radius(t)
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2
        const cs = Math.cos(a)
        const sn = Math.sin(a)
        pos.push(f.P.x + (f.S.x * cs + f.U.x * sn) * rr, f.P.y + (f.S.y * cs + f.U.y * sn) * rr, f.P.z + (f.S.z * cs + f.U.z * sn) * rr)
        if (sn < -0.42) c.copy(cBelly).multiplyScalar(i % 2 ? 0.94 : 1)
        else c.copy(cBody).multiplyScalar((i % 2 ? 0.86 : 1) * (sn > 0.8 ? 0.82 : 1))
        col.push(c.r, c.g, c.b)
      }
    }
    for (let i = 0; i < seg; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j
        const b = i * radial + ((j + 1) % radial)
        idx.push(a, a + radial, b, b, a + radial, b + radial)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    p.push({ g, m, keep: true })
  }

  // the dorsal fin: flames along the spine, leaning toward the tail
  const step = r * (ly ? (full ? 0.44 : 0.62) : 0.8)
  const n = Math.floor((length * 0.94) / step)
  for (let i = 1; i <= n; i++) {
    const t = Math.min(0.985, (i * step) / length + (ly ? 0.06 : 0.03))
    const f = frame(t)
    const rr = radius(t)
    // (toward the tail the body thins faster than the fin does: the tail ends feathered with small flames)
    // (on the neck it is long, a mane; then low and close all the way down)
    const h = ly ? (0.62 * rr + 0.1 * r) * (i % 2 ? 0.72 : 1) * (1 + 1.5 * Math.max(0, 1 - t / 0.24)) : 1.25 * rr * (i % 2 ? 0.74 : 1)
    const dir = f.U.clone().multiplyScalar(ly ? 0.62 : 0.8).addScaledVector(f.T, ly ? 0.78 : 0.6)
    p.push({ g: G.coneLo, c: fin, m: accent, mat: flame(f.P.clone().addScaledVector(f.U, rr * 0.82), dir, f.S, h, ly ? 0.34 * rr + 0.06 * r : rr * 0.42, rr * 0.12 + (ly ? 0.01 * r : 0)) })
  }

  // four legs, each ending in a clawed foot, with a tuft of flame at the elbow
  if (o.legs ?? true) {
    for (const t of ly ? [0.17, 0.5] : [0.2, 0.6]) {
      const f = frame(t)
      const rr = radius(t) * (t > 0.4 ? 1.15 : 1) * (ly ? 0.9 : 1)
      const fwd = f.T.clone().multiplyScalar(-1)
      for (const s of [-1, 1]) {
        if (ly) {
          p.push(...lyLeg(f, rr, s, { body, mane, claw: m === 'aged' || m === 'stone' || m === 'bronze' ? belly : '#fbf6e8' }, m, accent, full))
          continue
        }
        const a = f.P.clone().addScaledVector(f.S, s * rr * 0.6).addScaledVector(f.U, -rr * 0.15)
        const b = f.P.clone().addScaledVector(f.S, s * rr * 1.75).addScaledVector(f.U, rr * 0.25).addScaledVector(fwd, -rr * 0.4)
        const c = f.P.clone().addScaledVector(f.S, s * rr * 1.95).addScaledVector(f.U, -rr * 0.95).addScaledVector(fwd, rr * 0.7)
        p.push({ g: taperTube([a, b, c], rr * 0.42, rr * 0.24, 8, 6), c: body, m })
        p.push({ g: G.sphereLo, c: body, m, mat: compose(c, new THREE.Quaternion(), new THREE.Vector3(rr * 0.3, rr * 0.26, rr * 0.3)) })
        for (const k of [-1, 0, 1]) {
          const d = fwd.clone().multiplyScalar(Math.cos(k * 0.55)).addScaledVector(f.S, s * 0.25 + Math.sin(k * 0.55)).addScaledVector(f.U, -0.35)
          p.push({ g: G.coneLo, c: '#fbf6e8', m, mat: flame(c, d, f.U, rr * 0.62, rr * 0.11, rr * 0.11) })
        }
        const back = f.T.clone().multiplyScalar(0.8).addScaledVector(f.U, 0.5).addScaledVector(f.S, s * 0.4)
        p.push({ g: G.coneLo, c: mane, m: accent, mat: flame(b, back, f.S, rr * (style === 'tayson' ? 2.3 : 1.2), rr * (style === 'tayson' ? 0.22 : 0.3), rr * 0.1) })
      }
    }
  }

  // the tail: a fan of flames (Nguyễn), one long blade (Tây Sơn); the Lý dragon's runs out to a whip
  // with a tuft at its tip
  if (ly) p.push(...lyTailTuft(frame(0.985), r, mane, accent, full))
  else {
    const f = frame(1)
    const ts = style === 'tayson'
    for (const k of ts ? [-1, 0, 1] : [-2, -1, 0, 1, 2]) {
      const d = f.T.clone().multiplyScalar(Math.cos(k * 0.42)).addScaledVector(f.U, Math.sin(k * 0.42) + 0.25)
      const len = ts ? (k ? 1.1 : 3.0) : 2.0 - Math.abs(k) * 0.3
      p.push({ g: G.coneLo, c: mane, m: accent, mat: flame(f.P, d, f.S, r * len, r * (ts ? 0.26 : 0.34), r * 0.1) })
    }
  }

  // the head, carried at the front of the spine
  {
    const f = frame(0)
    const F = f.T.clone().multiplyScalar(-1)
    const X = new THREE.Vector3().crossVectors(f.U, F).normalize()
    const h = r * (o.head ?? 1.5)
    const M = new THREE.Matrix4().makeBasis(X.multiplyScalar(h), f.U.clone().multiplyScalar(h), F.clone().multiplyScalar(h)).setPosition(f.P.clone().addScaledVector(F, h * 0.25))
    p.push(...dragonHead(M, style, { body, belly, mane, horn }, m, accent, full, o.pearl ?? ly))
  }
  return p
}
