import * as THREE from 'three'
import { G, blob, rng, type Part, type V3 } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { taperTube } from '../characters/hair'
import { BOARD, CHAM, DOANMON, GATE, HALL, HUE_PONDS, HUE_WALL_Z, NGOMON } from '../layout'

/*
 * What time grows on old masonry. The weathering shader paints moss and mould
 * onto the walls and roofs; this adds the things that stand off them — moss
 * cushions along the foot of a wall and on its ledges, weeds and little ferns
 * rooted in the joints, creepers hanging over the top — on the four old
 * monuments: the Hoàng Đế citadel, Đoan Môn, Ngọ Môn and Điện Thái Hòa.
 * Everything clings (no wind sway) and is baked into one mesh.
 */

type R = () => number
// old growth: brown-olive cushions that have dried and darkened over the years, a few still deep green
const GREENS = ['#4a3c26', '#56552c', '#3a4a2a', '#5e4a2a', '#33402a', '#4c4f28']
const DRY = ['#7a6238', '#8a6e3c', '#665a30']
// what still grows on top of it — weeds, ferns, creeper leaves — stays a dark, dusty green
const LEAF = ['#3a4a2a', '#33402a', '#4c5230', '#44522c', '#565a2e']
const pick = <T,>(r: R, a: readonly T[]) => a[Math.floor(r() * a.length)]
let PADS: THREE.BufferGeometry[] | null = null
const pads = () => (PADS ??= [blob(901, 1, 0.24), blob(902, 1, 0.3), blob(903, 1, 0.2)])

/** one moss cushion sitting on a surface at p */
function pad(r: R, p: V3, size: number): Part {
  const s = size * (0.55 + 0.9 * r())
  return { g: pick(r, pads()), c: pick(r, GREENS), m: 'moss', p: [p[0], p[1] + s * 0.1, p[2]], r: [0, r() * 6.28, 0], s: [s * (1 + 0.6 * r()), s * (0.36 + 0.22 * r()), s * (1 + 0.6 * r())] }
}

const UP = new THREE.Vector3(0, 1, 0)
/** a tuft of weeds: thin blades fanning out of a point. `lean` tips it over (a fern growing out of a wall face). */
function tuft(r: R, p: V3, s = 1, lean: V3 = [0, 0, 0], wide = 1): Part[] {
  const out: Part[] = []
  const n = 4 + Math.floor(r() * 4)
  const dir = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const spin = new THREE.Quaternion()
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2
    const spread = 0.25 + 0.6 * r()
    dir.set(Math.cos(a) * spread + lean[0], 1 + lean[1], Math.sin(a) * spread + lean[2]).normalize()
    const len = (0.1 + 0.16 * r()) * s
    q.setFromUnitVectors(UP, dir).multiply(spin.setFromAxisAngle(UP, r() * 6.28))
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]).addScaledVector(dir, len / 2), q, new THREE.Vector3(0.016 * s * wide, len, 0.006 * s))
    out.push({ g: G.coneLo, c: r() < 0.25 ? pick(r, DRY) : pick(r, LEAF), m: 'moss', mat })
  }
  return out
}

/** a creeper hanging down a wall face from `top` (a point on the wall's upper edge); (nx, nz) is the way the wall faces */
function creeper(r: R, top: V3, len: number, nx: number, nz: number): Part[] {
  const out: Part[] = []
  const tx = -nz
  const tz = nx
  const ry = Math.atan2(nx, nz)
  const strands = 2 + Math.floor(r() * 2)
  for (let s = 0; s < strands; s++) {
    const off = (r() - 0.5) * 0.32
    const L = len * (0.5 + 0.5 * r())
    const ph = r() * 6
    // it is rooted on top of the wall, comes over the edge and wanders down the face
    const pts = [new THREE.Vector3(top[0] + tx * off - nx * 0.12, top[1] + 0.02, top[2] + tz * off - nz * 0.12)]
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      const w = off + Math.sin(t * 4 + ph) * 0.07 * t + (r() - 0.5) * 0.03
      pts.push(new THREE.Vector3(top[0] + tx * w + nx * 0.03, top[1] - t * L, top[2] + tz * w + nz * 0.03))
    }
    out.push({ g: taperTube(pts, 0.011, 0.005, 14, 5), c: '#3e3420', m: 'moss' })
    const curve = new THREE.CatmullRomCurve3(pts)
    const count = Math.max(3, Math.round(L / 0.1))
    for (let j = 0; j < count; j++) {
      const pt = curve.getPoint(0.16 + 0.84 * ((j + 0.5) / count))
      const side = (j % 2 ? 1 : -1) * (0.03 + 0.03 * r())
      out.push({
        g: G.sphereXs,
        c: pick(r, LEAF),
        m: 'moss',
        p: [pt.x + tx * side + nx * 0.02, pt.y, pt.z + tz * side + nz * 0.02],
        r: [0, ry, (j % 2 ? -1 : 1) * (0.6 + 0.5 * r())],
        s: [0.05, 0.03, 0.012],
      })
    }
  }
  return out
}

interface FaceOpts {
  /** metres along the face to leave bare: gateways, a hanging scroll… */
  skip?: [number, number][]
  /** height of the foot of the wall (a terrace), default 0 */
  y0?: number
  /** how far the wall's top edge overhangs the face (cornice) */
  lip?: number
  /** moss cushions per metre along the foot */
  foot?: number
  /** cushions and weeds along the top edge */
  top?: boolean
  /** ferns rooted in the joints of the face, one every this many metres (0 = none) */
  ferns?: number
  /** creepers over the top, one every this many metres (0 = none), and how long */
  creepers?: number
  drop?: number
}

/**
 * Dress one wall face that runs from (ax, az) to (bx, bz), is `H` tall and
 * faces (nx, nz): cushions along its foot, weeds on top, ferns in the joints,
 * creepers hanging over the edge.
 */
function face(r: R, ax: number, az: number, bx: number, bz: number, nx: number, nz: number, H: number, o: FaceOpts = {}): Part[] {
  const out: Part[] = []
  const len = Math.hypot(bx - ax, bz - az)
  const ux = (bx - ax) / len
  const uz = (bz - az) / len
  const y0 = o.y0 ?? 0
  const lip = o.lip ?? 0
  const bare = (d: number) => (o.skip ?? []).some(([s0, s1]) => d > s0 && d < s1)
  const at = (d: number, off: number): [number, number] => [ax + ux * d + nx * off, az + uz * d + nz * off]
  // the foot: cushions in loose clusters, thinning out away from the wall
  const perM = o.foot ?? 3.2
  for (let d = 0.1; d < len - 0.05; d += 1 / perM) {
    const dd = d + (r() - 0.5) * 0.2
    if (bare(dd) || r() < 0.28) continue
    const [x, z] = at(dd, 0.02 + r() * 0.07)
    out.push(pad(r, [x, y0, z], 0.11))
    if (r() < 0.35) {
      const [x2, z2] = at(dd + (r() - 0.5) * 0.2, 0.1 + r() * 0.14)
      out.push(pad(r, [x2, y0, z2], 0.07))
    }
    if (r() < 0.16) out.push(...tuft(r, [x, y0, z], 0.9))
  }
  if (o.top ?? true) {
    for (let d = 0.2; d < len - 0.1; d += 0.42) {
      const dd = d + (r() - 0.5) * 0.3
      if (bare(dd) || r() < 0.4) continue
      const [x, z] = at(dd, Math.min(lip, 0) - 0.08 - r() * 0.1)
      out.push(pad(r, [x, y0 + H, z], 0.075))
      if (r() < 0.4) out.push(...tuft(r, [x, y0 + H, z], 0.8 + r() * 0.5))
    }
  }
  if (o.ferns) {
    for (let d = o.ferns * 0.5; d < len - 0.2; d += o.ferns) {
      const dd = d + (r() - 0.5) * o.ferns * 0.6
      if (bare(dd)) continue
      const [x, z] = at(dd, 0.0)
      const y = y0 + 0.45 + r() * Math.max(0.1, H - 0.9)
      out.push(...tuft(r, [x, y, z], 1.15, [nx * 1.1, -0.35, nz * 1.1], 1.9))
      out.push(pad(r, [x + nx * 0.01, y - 0.03, z + nz * 0.01], 0.05))
    }
  }
  if (o.creepers) {
    for (let d = o.creepers * 0.5; d < len - 0.25; d += o.creepers) {
      const dd = d + (r() - 0.5) * o.creepers * 0.5
      if (bare(dd)) continue
      const [x, z] = at(dd, lip)
      out.push(...creeper(r, [x, y0 + H, z], o.drop ?? Math.min(1.4, H * 0.6), nx, nz))
    }
  }
  return out
}

function build(): Part[] {
  const r = rng(2046)
  const p: Part[] = []
  const edge = BOARD.maxX - 0.4

  // ── I · the Hoàng Đế citadel: dark laterite walls either side of the gate ──
  {
    const z = GATE.z
    for (const s of [-1, 1]) {
      // front (toward the guest) and back
      p.push(...face(r, s * 4.15, z + 0.3, s * edge, z + 0.3, 0, 1, 2.17, { lip: 0.02, ferns: 2.4, creepers: 3.1, drop: 1.25 }))
      p.push(...face(r, s * edge, z - 0.3, s * 4.15, z - 0.3, 0, -1, 2.17, { lip: 0.02, ferns: 3.2, creepers: 4.2, drop: 1.1 }))
      // the feet of the gate pillars, on the sides away from the lane
      for (const [x, dz] of [
        [3.2 + 0.32, 0.25],
        [3.2 + 0.3, -0.28],
        [1.25 + 0.36, 0.3],
        [1.25 + 0.38, -0.3],
        [2.72, 0.24],
      ] as const)
        p.push(pad(r, [s * x, 0, z + dz], 0.09))
    }
  }
  // the Cham tower: weeds round its plinth
  for (const [nx, nz] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const) {
    const h = 1.58
    const ax = CHAM.x + nx * h - nz * h
    const az = CHAM.z + nz * h + nx * h
    p.push(...face(r, ax, az, ax + nz * 2 * h, az - nx * 2 * h, nx, nz, 0.18, { top: false, foot: 2.6 }))
  }

  // ── III · Đoan Môn and the wall of the Forbidden City ──
  {
    const D = DOANMON
    const zf = D.z + D.d / 2
    const zb = D.z - D.d / 2
    const half = D.w / 2
    // openings, as metres along the front face (which runs from −half to +half)
    const gaps: [number, number][] = [
      [0, 0.9],
      [2.35, 0.65],
      [-2.35, 0.65],
      [4.35, 0.55],
      [-4.35, 0.55],
    ].map(([c, w]) => [half + c - w, half + c + w])
    p.push(...face(r, -half, zf + 0.06, half, zf + 0.06, 0, 1, D.h + 0.12, { skip: gaps, lip: 0.05, top: false, ferns: 1.5, creepers: 1.9, drop: 1.15 }))
    p.push(...face(r, half, zb - 0.06, -half, zb - 0.06, 0, -1, D.h + 0.12, { skip: gaps.map(([a, b]) => [D.w - b, D.w - a] as [number, number]), lip: 0.05, top: false, ferns: 1.7, creepers: 2.2, drop: 1.2 }))
    for (const s of [-1, 1]) {
      p.push(...face(r, s * half, D.z + 0.45, s * edge, D.z + 0.45, 0, 1, 2.2, { lip: -0.05, ferns: 2.6, creepers: 3.4, drop: 1.2 }))
      p.push(...face(r, s * edge, D.z - 0.45, s * half, D.z - 0.45, 0, -1, 2.2, { lip: -0.05, ferns: 3.0, creepers: 3.8, drop: 1.2 }))
      // weeds on the crenellations
      for (let x = half + 0.35; x < edge; x += 0.8) if (r() < 0.45) p.push(...tuft(r, [s * x + (r() - 0.5) * 0.2, 2.48, D.z + (r() - 0.5) * 0.4], 0.9 + r() * 0.5))
    }
  }

  // ── V · Ngọ Môn: the U-shaped base, and the citadel wall ──
  {
    const N = NGOMON
    const zf = N.z + N.depth / 2
    const zw = zf + N.wing
    const wi = N.w / 2 - 2.0 // inner face of the wings
    const wo = N.w / 2
    // front face between the wings: bare at the three gateways (the list hangs over the middle one)
    const gaps: [number, number][] = [
      [0, 1.3],
      [2.5, 0.85],
      [-2.5, 0.85],
    ].map(([c, w]) => [wi + c - w, wi + c + w])
    p.push(...face(r, -wi, zf + 0.02, wi, zf + 0.02, 0, 1, N.h, { skip: gaps, top: false, ferns: 1.25, creepers: 2.3, drop: 1.5 }))
    for (const s of [-1, 1]) {
      // inner and outer faces of each wing (bare at its Dịch Môn), and its front
      const gate: [number, number][] = [[N.wing / 2 - 0.75, N.wing / 2 + 0.75]]
      p.push(...face(r, s * wi, zf, s * wi, zw, -s, 0, N.h, { skip: gate, top: false, ferns: 1.4, creepers: 1.5, drop: 1.4 }))
      p.push(...face(r, s * wo, zw, s * wo, zf - N.depth, s, 0, N.h, { skip: [[N.wing / 2 - 0.75, N.wing / 2 + 0.75]], top: false, ferns: 1.8, creepers: 2.2, drop: 1.5 }))
      p.push(...face(r, s * wi, zw + 0.02, s * wo, zw + 0.02, 0, 1, N.h, { top: false, ferns: 1.1, creepers: 1.3, drop: 1.5 }))
      // the citadel wall running off to the edge of the board
      p.push(...face(r, s * wo, HUE_WALL_Z + 0.36, s * edge, HUE_WALL_Z + 0.36, 0, 1, 2.78, { lip: 0.04, ferns: 2.4, creepers: 3.0, drop: 1.4 }))
      p.push(...face(r, s * edge, HUE_WALL_Z - 0.36, s * wo, HUE_WALL_Z - 0.36, 0, -1, 2.78, { lip: 0.04, ferns: 3.0, creepers: 3.6, drop: 1.4 }))
      for (let x = wo + 0.4; x < edge; x += 0.9) if (r() < 0.45) p.push(...tuft(r, [s * x + (r() - 0.5) * 0.2, 3.1, HUE_WALL_Z + (r() - 0.5) * 0.4], 0.9 + r() * 0.5))
    }
    // the back of the gate, toward the lotus ponds
    p.push(...face(r, wo, zf - N.depth - 0.02, -wo, zf - N.depth - 0.02, 0, -1, N.h, { skip: gaps.map(([a, b]) => [a + 2, b + 2] as [number, number]), top: false, ferns: 1.6, creepers: 2.4, drop: 1.5 }))
  }

  // ── Điện Thái Hòa: its terrace, its stairs, the kerbs of the lotus ponds ──
  {
    const front = HALL.terraceFront
    const back = HALL.terraceBack
    const ty = HALL.terraceY
    for (const s of [-1, 1]) {
      // the terrace front either side of the stairs, and its two flanks
      p.push(...face(r, s * 1.9, front + 0.04, s * 7.25, front + 0.04, 0, 1, ty, { lip: 0.06, top: false, ferns: 1.6, creepers: 1.7, drop: 0.55 }))
      p.push(...face(r, s * 7.27, front, s * 7.27, back, s, 0, ty, { lip: 0.06, top: false, ferns: 2.2, creepers: 2.4, drop: 0.55 }))
      // moss gathers where each step meets the dragon balustrade
      for (let k = 0; k < 5; k++) {
        const y = ty - k * 0.18
        const z = front + 0.3 * (k + 1) - 0.15
        p.push(pad(r, [s * (1.43 - r() * 0.05), y, z - 0.06 + r() * 0.1], 0.06))
        if (r() < 0.5) p.push(pad(r, [s * (1.3 - r() * 0.1), y, z - 0.1], 0.045))
        if (k % 2 === 0) p.push(...tuft(r, [s * 1.45, y, z], 0.7))
      }
      // along the foot of the balustrade on the terrace, clear of the stairhead
      for (let x = 2.2; x < 7.0; x += 0.5) if (r() < 0.55) p.push(pad(r, [s * (x + (r() - 0.5) * 0.2), ty + 0.03, front - 0.06 - r() * 0.12], 0.06))
    }
    // the stone kerbs of the lotus ponds (not the inner one, by the Trung Đạo)
    for (const [x0, x1, z0, z1] of HUE_PONDS) {
      const outer = x0 < 0 ? x0 - 0.1 : x1 + 0.1
      for (let x = x0; x <= x1; x += 0.36) {
        if (r() < 0.5) p.push(pad(r, [x + (r() - 0.5) * 0.2, 0.2, z0 - 0.1], 0.07))
        if (r() < 0.5) p.push(pad(r, [x + (r() - 0.5) * 0.2, 0.2, z1 + 0.1], 0.07))
        if (r() < 0.14) p.push(...tuft(r, [x, 0.2, r() < 0.5 ? z0 - 0.1 : z1 + 0.1], 1.1))
      }
      for (let z = z0; z <= z1; z += 0.36) if (r() < 0.5) p.push(pad(r, [outer, 0.2, z + (r() - 0.5) * 0.2], 0.07))
    }
  }
  return p
}

/** Moss cushions, weeds, ferns and creepers on the old monuments. */
export function Overgrowth() {
  return <KitMesh build={build} />
}
