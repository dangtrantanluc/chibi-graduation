import * as THREE from 'three'
import { G, type MatKey, type Part } from '../lib/kit'
import { taperTube } from '../characters/hair'

/*
 * Vietnamese dragons, built along any spine.
 *
 *   'ly'      the dragon of Thăng Long (Lý dynasty, 11th–13th c.) — the one this
 *             world uses throughout: slender and smooth, the body in many
 *             soft bends that ease toward the tail; no horns, a long flame
 *             crest rising from the upper lip, a long flowing mane, a pearl in
 *             the mouth, a low soft fin, small three-clawed legs with a tuft
 *             at the elbow, the tail running out to a point
 *   'nguyen'  the dragon of Huế (Nguyễn dynasty, 19th c.) and of the mosaic
 *             gates of the centre: robust, a big head with branched antlers,
 *             bulging eyes, flame brows, fangs and beard, a mane of sharp
 *             flames, tall spiky fins, four clawed legs, a fanned flame tail
 *
 * Everything is returned as kit parts in world space, so a dragon bakes into
 * the building it belongs to (no extra draw calls).
 */

export type DragonStyle = 'ly' | 'nguyen'

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
  const ly = style === 'ly'
  const slim = ly ? 0.82 : 1

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
  if (ly) {
    // the Lý dragon's crest: a long flame rising in an S from the upper lip
    tube(
      [
        [0, 0.24, 1.5],
        [0, 0.78, 1.82],
        [0, 1.22, 1.55],
        [0, 1.6, 1.95],
      ],
      0.11,
      0.015,
      c.mane,
      accent,
      0.55,
    )
  } else {
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
  // the mane: locks streaming back from the crown and the cheeks
  const locks = ly ? [-1, 0, 1] : [-3, -2, -1, 0, 1, 2, 3]
  for (const k of locks) {
    const a = Math.abs(k)
    const len = ly ? 3.0 : 1.9 - a * 0.16
    tube(
      [
        [k * 0.15, 0.3 - a * 0.07, -0.35],
        [k * (ly ? 0.22 : 0.3), 0.52 - a * 0.12, -0.35 - len * 0.45],
        [k * (ly ? 0.34 : 0.44), (ly ? 0.3 : 0.78) - a * 0.2, -0.35 - len],
      ],
      ly ? 0.14 : 0.12,
      0.012,
      c.mane,
      accent,
      0.5,
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
    const neck = THREE.MathUtils.lerp(ly ? 0.74 : 0.8, 1, Math.min(1, t / 0.14))
    const hold = ly ? 0.22 : 0.52
    const tail = t < hold ? 1 : THREE.MathUtils.lerp(1, ly ? 0.1 : 0.3, Math.pow((t - hold) / (1 - hold), 1.15))
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

  // The body: one tube, painted as it is built — a paler belly along the underside, a darker
  // line down the back, and alternate rings a shade apart, which read as rows of scales.
  {
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
  const step = r * (ly ? 0.62 : 0.8)
  const n = Math.floor((length * 0.94) / step)
  for (let i = 1; i <= n; i++) {
    const t = Math.min(0.985, (i * step) / length + 0.03)
    const f = frame(t)
    const rr = radius(t)
    const h = (ly ? 0.6 : 1.25) * rr * (i % 2 && !ly ? 0.74 : 1)
    const dir = f.U.clone().multiplyScalar(0.8).addScaledVector(f.T, 0.6)
    p.push({ g: G.coneLo, c: fin, m: accent, mat: flame(f.P.clone().addScaledVector(f.U, rr * 0.82), dir, f.S, h, rr * (ly ? 0.5 : 0.42), rr * 0.12) })
  }

  // four legs, each ending in a clawed foot, with a tuft of flame at the elbow
  if (o.legs ?? true) {
    for (const t of ly ? [0.15, 0.46] : [0.2, 0.6]) {
      const f = frame(t)
      const rr = radius(t) * (t > 0.4 ? 1.15 : 1) * (ly ? 0.9 : 1)
      const fwd = f.T.clone().multiplyScalar(-1)
      for (const s of [-1, 1]) {
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
        p.push({ g: G.coneLo, c: mane, m: accent, mat: flame(b, back, f.S, rr * 1.2, rr * 0.3, rr * 0.1) })
      }
    }
  }

  // the tail: a fan of flames (Nguyễn); the Lý dragon's simply runs out to a point
  if (!ly) {
    const f = frame(1)
    for (const k of [-2, -1, 0, 1, 2]) {
      const d = f.T.clone().multiplyScalar(Math.cos(k * 0.42)).addScaledVector(f.U, Math.sin(k * 0.42) + 0.25)
      p.push({ g: G.coneLo, c: mane, m: accent, mat: flame(f.P, d, f.S, r * (2.0 - Math.abs(k) * 0.3), r * 0.34, r * 0.1) })
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
