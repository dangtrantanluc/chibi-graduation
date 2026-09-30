import * as THREE from 'three'
import { G, type Part } from '../lib/kit'
import { faceMatrix, HEAD_S, R } from './Chibi'

const UP = new THREE.Vector3(0, 1, 0)

/** Point on the head ellipsoid. theta: azimuth from +z toward +x, phi: elevation. */
export function onHead(theta: number, phi: number, k = 1) {
  return new THREE.Vector3(
    R * HEAD_S[0] * k * Math.cos(phi) * Math.sin(theta),
    R * HEAD_S[1] * k * Math.sin(phi),
    R * HEAD_S[2] * k * Math.cos(phi) * Math.cos(theta),
  )
}

/** Hair cap covering the top/back of the head, leaving the face free. */
export function hairCap(p: Part[], color: string, k = 1.045, lift = 0.06, back = 0.05) {
  p.push({
    g: G.sphere,
    c: color,
    p: [0, lift, -back],
    s: [R * HEAD_S[0] * k, R * HEAD_S[1] * k, R * HEAD_S[2] * k],
  })
}

/** Soft fringe lobes along the hairline. */
export function bangs(p: Part[], color: string, n = 5, y = 0.2, spread = 0.27, size = 1) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5
    const x = t * 2 * spread
    const yy = y - Math.abs(t) * 0.05 - (i % 2) * 0.025
    p.push({
      g: G.sphere,
      c: color,
      mat: faceMatrix(x, yy, 0.01, [0.1 * size, 0.13 * size, 0.055 * size], -t * 0.9),
    })
  }
}

/** A cone spike sprouting from the scalp. */
export function spike(p: Part[], color: string, theta: number, phi: number, len: number, rad: number, back = 0.3, up = 0.25) {
  const base = onHead(theta, phi, 0.96)
  const dir = base.clone().normalize()
  dir.y += up
  dir.z -= back
  dir.normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir)
  const pos = base.clone().addScaledVector(dir, len * 0.42)
  p.push({ g: G.cone, c: color, mat: new THREE.Matrix4().compose(pos, q, new THREE.Vector3(rad, len, rad)) })
}

/** Rounded lock of hair (elongated blob) from a scalp point, hanging along dir. */
export function lock(p: Part[], color: string, from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number) {
  const d = dir.clone().normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d)
  const pos = from.clone().addScaledVector(d, len * 0.5)
  p.push({ g: G.sphere, c: color, mat: new THREE.Matrix4().compose(pos, q, new THREE.Vector3(rad, len * 0.55, rad * 0.85)) })
}

/**
 * Tapered, curved lock of hair — the building block of anime hair: bangs that
 * end in points, side locks, pony tails, spikes that bend.
 */
export function taperTube(points: THREE.Vector3[], r0: number, r1: number, seg = 12, radial = 7, flat = 1) {
  const curve = new THREE.CatmullRomCurve3(points)
  const frames = curve.computeFrenetFrames(seg, false)
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const c = curve.getPointAt(t)
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.9))
    const n = frames.normals[i]
    const b = frames.binormals[i]
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r * flat
      pos.push(c.x + n.x * x + b.x * y, c.y + n.y * x + b.y * y, c.z + n.z * x + b.z * y)
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = i * radial + ((j + 1) % radial)
      const c = a + radial
      const d = b + radial
      idx.push(a, c, b, b, c, d)
    }
  }
  // close the root end
  const start = pos.length / 3
  const c0 = curve.getPointAt(0)
  pos.push(c0.x, c0.y, c0.z)
  for (let j = 0; j < radial; j++) idx.push(start, j, (j + 1) % radial)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Shorthand: lock from a scalp point (theta, phi) through a bend to a tip. */
export function lockTo(p: Part[], color: string, theta: number, phi: number, mid: THREE.Vector3, tip: THREE.Vector3, r0: number, r1 = 0.006, k = 0.98) {
  const base = onHead(theta, phi, k)
  p.push({ g: taperTube([base, base.clone().lerp(mid, 0.6).add(mid.clone().multiplyScalar(0.0)), mid, tip], r0, r1), c: color })
}

/** Anime "angel ring" shine band across the upper hair. */
export function shine(p: Part[], color: string, y = 0.26, k = 1.075, arc = 2.1, tube = 0.016) {
  const r = Math.sqrt(Math.max(0.0001, 1 - (y / (R * HEAD_S[1] * k)) ** 2)) * R * k
  const g = new THREE.TorusGeometry(r, tube, 5, 24, arc)
  g.rotateX(Math.PI / 2)
  g.rotateY(arc / 2 - Math.PI / 2)
  p.push({ g, c: color, p: [0, y + 0.02, -0.02] })
}

/**
 * A long-hair "curtain": an open shell hanging behind the head and down past
 * the shoulders, leaving the face free. Grooves run down it like strands;
 * `wave` ripples it (wavy hair) and the hem is cut into soft points.
 */
export function hairCurtain(o: { top?: number; bottom: number; r0?: number; r1?: number; gap?: number; wave?: number; grooves?: number; tips?: number; seed?: number }) {
  const top = o.top ?? 0.24
  const r0 = o.r0 ?? 0.44
  const r1 = o.r1 ?? 0.39
  const gap = o.gap ?? 0.78
  const prof: THREE.Vector2[] = []
  const N = 14
  for (let i = 0; i <= N; i++) {
    const t = i / N // 0 bottom → 1 top
    const y = o.bottom + (top - o.bottom) * t
    // bulge a little at the shoulders, taper to the crown
    const r = THREE.MathUtils.lerp(r1, r0, Math.pow(t, 0.6)) + 0.03 * Math.sin(t * Math.PI) - (t > 0.85 ? (t - 0.85) * 0.5 : 0)
    prof.push(new THREE.Vector2(r, y))
  }
  const g = new THREE.LatheGeometry(prof, 40, gap, Math.PI * 2 - gap * 2)
  const pos = g.attributes.position
  const grooves = o.grooves ?? 11
  const wave = o.wave ?? 0
  const tips = o.tips ?? 0.06
  const seed = o.seed ?? 0
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const phi = Math.atan2(v.x, v.z)
    const t = (v.y - o.bottom) / (top - o.bottom)
    const k = 1 + 0.035 * Math.sin(phi * grooves + seed) * (1 - t * 0.7) + wave * Math.sin(v.y * 14 + phi * 3 + seed) * (1 - t)
    v.x *= k
    v.z *= k
    if (t < 0.02) v.y -= tips * (0.5 + 0.5 * Math.cos(phi * grooves * 0.5 + seed))
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}
