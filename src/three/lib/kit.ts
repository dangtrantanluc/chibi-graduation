import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * "Kit" = a list of primitive parts that get baked into as few meshes as possible:
 * every part gets its colour written into a vertex-colour attribute, then all parts
 * sharing a material are merged. A whole building ends up as 3–5 draw calls.
 */

export type MatKey =
  | 'wood'
  | 'paint'
  | 'tile'
  | 'trim'
  | 'stone'
  | 'plaster'
  | 'gold'
  | 'bronze'
  | 'ceramic'
  | 'foliage'
  | 'toy'
  | 'gloss'
  | 'paperLit'
  | 'ground'
  | 'garment'
  | 'sleeve'
  | 'lacquer'
  /** weathered plaster / laterite / brick: rain streaks and moss (world-space) */
  | 'aged'
  /** glass curtain wall: glossy, a little emissive */
  | 'glass'
  /** straw thatch: strands running down the slope (UVs in world units) */
  | 'thatch'
  /** moss cushions, weeds and creepers growing on old masonry */
  | 'moss'

export type V3 = [number, number, number]

export interface Part {
  g: THREE.BufferGeometry
  c?: THREE.ColorRepresentation
  m?: MatKey
  p?: V3
  r?: V3
  s?: number | V3
  /** Keep the geometry's own `color` attribute (e.g. pre-coloured roofs). */
  keep?: boolean
  /** Full transform; overrides p / r / s when given. */
  mat?: THREE.Matrix4
}

const KEEP = new Set(['position', 'normal', 'uv', 'color'])
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

export function bake(part: Part): THREE.BufferGeometry {
  const g = part.g.index ? part.g.toNonIndexed() : part.g.clone()
  g.clearGroups()
  for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k)
  g.morphAttributes = {}
  const n = g.attributes.position.count
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  const keep = part.keep ?? (part.c === undefined && !!g.attributes.color)
  if (!keep || !g.attributes.color) {
    _c.set(part.c ?? '#ffffff')
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = _c.r
      arr[i * 3 + 1] = _c.g
      arr[i * 3 + 2] = _c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  }
  if (part.mat) {
    g.applyMatrix4(part.mat)
    return g
  }
  const s = part.s ?? 1
  _p.set(...(part.p ?? [0, 0, 0]))
  _q.setFromEuler(_e.set(...(part.r ?? [0, 0, 0])))
  if (typeof s === 'number') _s.set(s, s, s)
  else _s.set(...s)
  _m.compose(_p, _q, _s)
  g.applyMatrix4(_m)
  return g
}

/** Bake + merge parts into one geometry per material key. */
export function mergeKit(parts: Part[]): Map<MatKey, THREE.BufferGeometry> {
  const groups = new Map<MatKey, THREE.BufferGeometry[]>()
  for (const part of parts) {
    const key = part.m ?? 'toy'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(bake(part))
  }
  const out = new Map<MatKey, THREE.BufferGeometry>()
  for (const [k, list] of groups) {
    const merged = mergeGeometries(list, false)
    list.forEach((g) => g.dispose())
    if (merged) {
      merged.computeBoundingSphere()
      out.set(k, merged)
    }
  }
  return out
}

/** Transform a whole list of parts (for building sub-assemblies). */
export function offsetParts(parts: Part[], p: V3 = [0, 0, 0], ry = 0, scale = 1): Part[] {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(scale, scale, scale),
  )
  return parts.map((part) => {
    const g = bake(part)
    g.applyMatrix4(m)
    return { g, m: part.m, keep: true }
  })
}

// ── Shared primitive geometries (cloned on bake, so sharing is safe) ──
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLo: new THREE.SphereGeometry(1, 10, 7),
  sphereXs: new THREE.SphereGeometry(1, 6, 4),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16, 1),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
  cone: new THREE.ConeGeometry(1, 1, 12, 1),
  coneLo: new THREE.ConeGeometry(1, 1, 5, 1),
  cylXs: new THREE.CylinderGeometry(1, 1, 1, 5, 1),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 24),
  torusLo: new THREE.TorusGeometry(1, 0.12, 4, 12),
  ico: new THREE.IcosahedronGeometry(1, 1),
}

/** Rounded box built from a capsule-ish extrusion; cheap soft edges. */
export function roundedBox(w: number, h: number, d: number, r = 0.06, seg = 2): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const x = -w / 2 + r
  const y = -h / 2 + r
  const ww = w - 2 * r
  const hh = h - 2 * r
  shape.moveTo(x, y - r)
  shape.lineTo(x + ww, y - r)
  shape.quadraticCurveTo(x + ww + r, y - r, x + ww + r, y)
  shape.lineTo(x + ww + r, y + hh)
  shape.quadraticCurveTo(x + ww + r, y + hh + r, x + ww, y + hh + r)
  shape.lineTo(x, y + hh + r)
  shape.quadraticCurveTo(x - r, y + hh + r, x - r, y + hh)
  shape.lineTo(x - r, y)
  shape.quadraticCurveTo(x - r, y - r, x, y - r)
  const depth = Math.max(0.001, d - 2 * r)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: r * 0.9,
    bevelThickness: r,
    bevelSegments: seg,
    curveSegments: 4,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Seeded PRNG so the village is identical on every visit. */
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Slightly lumpy sphere — clay / felt look for foliage, rocks and clouds. */
export function blob(seed: number, detail = 2, amount = 0.12): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const r = rng(seed)
  const k = [r() * 6, r() * 6, r() * 6]
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n =
      Math.sin(v.x * 2.3 + k[0]) * Math.sin(v.y * 2.1 + k[1]) * Math.sin(v.z * 2.7 + k[2])
    v.multiplyScalar(1 + n * amount)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}
