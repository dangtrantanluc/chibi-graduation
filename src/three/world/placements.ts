import { rng } from '../lib/kit'
import { BANYAN, BIKE, BOARD, CHAM, CONGLANG, DOANMON, GATE, HALL, HAYSTACK, HOUSE, HUE_PONDS, HUE_WALL_Z, NGOMON, FLAG_TOWER, PADDY, PATH, POND, RANGDONG, STREET, TOPIARY, VILLAGE_END, WELL } from '../layout'
import { CAMPUS_TREES } from './Campus'

/** Deterministic placement of buildings, trees, rocks and flowers, region by region. */

export interface HouseDef {
  x: number
  z: number
  ry: number
  w: number
  d: number
  h: number
  /** a Huế palace pavilion, or Hiển Lâm Các (three tiers) */
  style: 'hue' | 'tower'
}
export const HOUSES: HouseDef[] = [
  { x: -14.6, z: -69.2, ry: Math.PI / 2, w: 5.2, d: 4.6, h: 2.3, style: 'tower' },
  { x: 14.8, z: -68.8, ry: -Math.PI / 2, w: 4.8, d: 3.4, h: 2.3, style: 'hue' },
  { x: -15.0, z: -61.0, ry: Math.PI / 2, w: 4.2, d: 3.0, h: 2.0, style: 'hue' },
]

export type TreeKind = 'coconut' | 'phuong' | 'green' | 'autumn' | 'hoasua' | 'banyan' | 'mai' | 'pine'
export interface TreeDef {
  x: number
  z: number
  s: number
  ry: number
  kind: TreeKind
}

const HAND_TREES: TreeDef[] = [
  // I · Bình Định — coconut palms around the Cham tower and the forecourt
  { x: -9.2, z: 11.8, s: 1.1, ry: 0.4, kind: 'coconut' },
  { x: -15.4, z: 6.6, s: 1.2, ry: 2.1, kind: 'coconut' },
  { x: -8.6, z: 7.0, s: 0.95, ry: 4.0, kind: 'coconut' },
  { x: 5.4, z: 12.6, s: 1.15, ry: 1.2, kind: 'coconut' },
  { x: 6.4, z: 9.6, s: 0.9, ry: 0.9, kind: 'coconut' },
  { x: 20.8, z: 6.6, s: 1.05, ry: 3.1, kind: 'coconut' },
  { x: -17.8, z: 12.2, s: 1.0, ry: 0.8, kind: 'green' },
  // III · Thăng Long — golden autumn trees and hoa sữa
  { x: -5.8, z: -18.4, s: 1.15, ry: 0.3, kind: 'autumn' },
  { x: 5.2, z: -17.6, s: 1.1, ry: 2.2, kind: 'autumn' },
  { x: -7.4, z: -24.2, s: 1.2, ry: 1.4, kind: 'hoasua' },
  { x: 7.2, z: -24.0, s: 1.15, ry: 0.6, kind: 'autumn' },
  { x: -9.4, z: -16.6, s: 1.0, ry: 2.9, kind: 'autumn' },
  { x: 10.4, z: -20.4, s: 1.05, ry: 1.9, kind: 'hoasua' },
  { x: 3.6, z: -15.4, s: 0.9, ry: 3.3, kind: 'hoasua' },
  { x: -18.2, z: -24.6, s: 1.1, ry: 0.2, kind: 'autumn' },
  { x: 14.6, z: -16.6, s: 1.1, ry: 4.2, kind: 'autumn' },
  // IV · the village — the banyan just inside the gate
  { x: BANYAN.x, z: BANYAN.z, s: 1.0, ry: 0.6, kind: 'banyan' },
  // V · Huế — Tết apricot blossom and pines
  { x: -9.8, z: -48.4, s: 0.85, ry: 0.3, kind: 'mai' },
  { x: 10.0, z: -48.2, s: 0.85, ry: 2.0, kind: 'mai' },
  { x: -10.8, z: -52.8, s: 1.1, ry: 1.0, kind: 'pine' },
  { x: 11.4, z: -52.6, s: 1.05, ry: 2.4, kind: 'pine' },
  { x: -8.6, z: -64.4, s: 1.0, ry: 0.7, kind: 'mai' },
  { x: 8.8, z: -63.8, s: 1.0, ry: 2.7, kind: 'mai' },
  ...CAMPUS_TREES.map((t, i) => ({ ...t, ry: i * 1.3 })),
]

export const BAMBOO: [number, number, number][] = [
  // Bình Định corners
  [-21.4, 2.6, 0.95],
  [21.4, 2.2, 1.0],
  // Thăng Long: a bamboo screen at the edges of the esplanade
  [-21.2, -20.4, 0.9],
  [21.2, -22.6, 0.95],
]

// ── free-space test ────────────────────────────────────────
function distToPath(x: number, z: number) {
  let best = Infinity
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i]
    const [bx, bz] = PATH[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)))
  }
  return best
}

/**
 * Camera sight-lines of the story's main shots ([x0, z0, x1, z1], camera →
 * subject): nothing tall may grow on them, or it would stand in front of a
 * character.
 */
const SIGHTS: [number, number, number, number][] = [
  [2.6, 11.5, 0.9, 6.4], // I · Lực on his bench
  [0.4, 26, 0.4, 5], // the opening wide shot
  [-2.6, -1.6, 3.2, -7.4], // II · the campus bench
  [-5.4, -3.6, 0.2, STREET.mid], // II · lost in the street, seen from the campus side
  [1.6, -16.2, -1.8, -21.8], // III · by the bicycle
  [-1.1, -35.5, 3.8, -38.0], // IV · the family in the yard
  [-0.6, -35.9, 2.2, -39.9],
  [0.2, -36.1, 0, -44.5], // IV · seeing him off down the lane
]
function distToSeg(x: number, z: number, [ax, az, bx, bz]: [number, number, number, number]) {
  const dx = bx - ax
  const dz = bz - az
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

export function isFree(x: number, z: number, m = 0) {
  if (SIGHTS.some((sg) => distToSeg(x, z, sg) < 1.6 + m)) return false
  if (x < BOARD.minX + 1 + m || x > BOARD.maxX - 1 - m || z < BOARD.minZ + 1 + m || z > BOARD.maxZ - 1.2 - m) return false
  if (distToPath(x, z) < 1.9 + m) return false
  // the five gate lines
  if (Math.abs(z - GATE.z) < 1.1 + m) return false
  if (Math.abs(z - DOANMON.z) < DOANMON.d / 2 + 0.9 + m) return false
  if (Math.abs(z - CONGLANG.z) < 1.3 + m) return false
  if (Math.abs(z - VILLAGE_END) < 1.2 + m) return false
  if (Math.abs(z - HUE_WALL_Z) < 1.2 + m) return false
  // Bình Định
  if (Math.hypot(x - CHAM.x, z - CHAM.z) < 2.7 + m) return false
  if (x > PADDY.x0 - 1.8 - m && x < PADDY.x1 + 0.8 + m && z > PADDY.z0 - 0.8 - m && z < PADDY.z1 + 1 + m) return false
  if (((x - POND.x) / (POND.rx + 0.9 + m)) ** 2 + ((z - POND.z) / (POND.rz + 0.9 + m)) ** 2 < 1) return false
  if (x > -3 - m && x < 3 - m && z > 5 && z < 9 + m) return false // benches
  // the city street and its pavements, the width of the board
  if (z > 0.55 - Math.max(m, 0) && z < 4.6 + Math.max(m, 0)) return false
  // Nông Lâm: the building and its plaza (between the lane and the façade)
  if (x > RANGDONG.xf - 1.4 - m && x < RANGDONG.xf + RANGDONG.d + 1.2 + m && Math.abs(z - RANGDONG.zc) < RANGDONG.w / 2 + 1.2 + m) return false
  if (x > -0.4 - m && x < RANGDONG.xf + m && Math.abs(z - RANGDONG.zc) < RANGDONG.w / 2 + 0.2 + m) return false
  if (Math.hypot(x - TOPIARY.x, z - TOPIARY.z) < TOPIARY.r + 1.2 + m) return false
  // the stone elephants before the Hoàng Đế citadel
  if (Math.abs(Math.abs(x) - 4.5) < 1.2 + m && Math.abs(z - (GATE.z + 1.8)) < 1.5 + m) return false
  // Thăng Long: the flag tower, the bicycle, the gánh, lamps and benches
  if (Math.abs(x - FLAG_TOWER.x) < 3.0 + m && Math.abs(z - FLAG_TOWER.z) < 3.0 + m) return false
  if (Math.hypot(x - BIKE.x, z - BIKE.z) < 1.3 + m) return false
  if (Math.hypot(x - 2.6, z + 19.6) < 1.3 + m) return false
  // the village
  if (Math.hypot(x - WELL.x, z - WELL.z) < 2.0 + m) return false
  if (Math.hypot(x - BANYAN.x, z - BANYAN.z) < 3.0 + m) return false
  // the green between Đoan Môn and the village gate keeps its middle clear (the lens follows him across it)
  if (Math.abs(x) < 4.4 + m && z < DOANMON.z - DOANMON.d / 2 - 0.6 + m && z > CONGLANG.z - 0.8) return false
  // the house, its yard (between the house and the lane) and the haystack
  if (x > 0 && x < HOUSE.x + 3.4 + m && z < CONGLANG.z - 0.6 + m && z > VILLAGE_END) return false
  if (Math.hypot(x - HAYSTACK.x, z - HAYSTACK.z) < 1.4 + m) return false
  // Huế: Ngọ Môn, its plaza, the ponds, the hall
  if (Math.abs(x - NGOMON.x) < NGOMON.w / 2 + 0.8 + m && z > NGOMON.z - NGOMON.depth / 2 - 1 && z < VILLAGE_END - 0.6 + m) return false
  for (const [x0, x1, z0, z1] of HUE_PONDS) if (x > x0 - 0.8 - m && x < x1 + 0.8 + m && z > z0 - 0.8 - m && z < z1 + 0.8 + m) return false
  if (Math.abs(x - HALL.x) < 8.2 + m && z < HALL.terraceFront + 1.4 + m) return false
  if (Math.abs(x) < 2.2 + m && z < NGOMON.z && z > HALL.terraceFront) return false
  // the kỳ lân in the court, the dismounting steles beside Ngọ Môn
  if (Math.abs(Math.abs(x) - 3.7) < 1.2 + m && Math.abs(z - (HALL.terraceFront + 1.75)) < 1.3 + m) return false
  if (Math.abs(Math.abs(x) - (NGOMON.w / 2 + 0.85)) < 0.8 + m && Math.abs(z - (NGOMON.z + NGOMON.depth / 2 + NGOMON.wing - 0.9)) < 0.8 + m) return false
  for (const h of HOUSES) {
    const c = Math.cos(h.ry)
    const s = Math.sin(h.ry)
    const lx = (x - h.x) * c - (z - h.z) * s
    const lz = (x - h.x) * s + (z - h.z) * c
    if (Math.abs(lx) < h.w / 2 + 1.2 + m && Math.abs(lz) < h.d / 2 + 1.4 + m) return false
  }
  return true
}

/** which kinds of tree grow in which region */
function regionKinds(z: number): TreeKind[] {
  if (z > GATE.z) return ['coconut', 'green', 'coconut']
  if (z > -13.5) return ['green', 'phuong', 'green']
  if (z > DOANMON.z) return ['autumn', 'autumn', 'hoasua', 'green']
  if (z > VILLAGE_END) return ['green', 'green']
  return ['mai', 'green', 'pine']
}

export const TREES: TreeDef[] = (() => {
  const r = rng(11)
  const out = [...HAND_TREES]
  let tries = 0
  while (out.length < 78 && tries < 8000) {
    tries++
    const x = BOARD.minX + 1 + r() * (BOARD.maxX - BOARD.minX - 2)
    const z = BOARD.minZ + 1 + r() * (BOARD.maxZ - BOARD.minZ - 2)
    if (!isFree(x, z, 0.4)) continue
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < (t.kind === 'banyan' ? 4.5 : 3.0))) continue
    if (BAMBOO.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 2.2)) continue
    const kinds = regionKinds(z)
    out.push({ x, z, s: 0.8 + r() * 0.4, ry: r() * 6.28, kind: kinds[Math.floor(r() * kinds.length)] })
  }
  return out
})()

export const BUSHES: [number, number, number][] = (() => {
  const r = rng(23)
  const out: [number, number, number][] = [
    [-9.5, 0.2, 0.55],
    [-14.2, 0.1, 0.6],
    [-5.6, -47.4, 0.7],
    [5.6, -47.4, 0.7],
  ]
  let tries = 0
  while (out.length < 76 && tries < 5000) {
    tries++
    const x = BOARD.minX + 1 + r() * (BOARD.maxX - BOARD.minX - 2)
    const z = BOARD.minZ + 1 + r() * (BOARD.maxZ - BOARD.minZ - 2)
    if (!isFree(x, z, -0.6)) continue
    if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 1.3)) continue
    out.push([x, z, 0.45 + r() * 0.4])
  }
  return out
})()

/** Flower beds, including deliberate foreground clusters for depth in each shot. */
export const FLOWERS: [number, number, string][] = (() => {
  const r = rng(5)
  const out: [number, number, string][] = []
  const bed = (cx: number, cz: number, rad: number, n: number, palette: string[]) => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * rad
      out.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d, palette[Math.floor(r() * palette.length)]])
    }
  }
  const field = ['#ffd36e', '#ffffff', '#f48a6a', '#c9a3ff', '#ff9fb2']
  const campus = ['#e2413a', '#f06a5a', '#ffffff', '#ff9fb2']
  const daisies = ['#fdfcf6', '#fdfcf6', '#f6d24a']
  const hue = ['#ffd36e', '#f7a8b8', '#ffffff', '#f48a6a']
  bed(-4.8, 12.4, 1.2, 20, field)
  bed(4.0, 11.2, 1.0, 16, field)
  bed(-11.6, 4.0, 1.2, 14, field)
  bed(-2.6, -8.4, 0.9, 16, campus)
  bed(12.6, -2.6, 1.0, 14, campus)
  bed(-4.6, -21.6, 1.0, 22, daisies)
  bed(4.6, -22.8, 0.9, 18, daisies)
  bed(-3.2, -31.0, 0.6, 12, daisies)
  bed(3.2, -31.0, 0.6, 12, field)
  bed(-6.6, -30.4, 0.7, 10, field)
  bed(6.4, -31.4, 0.7, 10, daisies)
  bed(-8.4, -41.6, 0.9, 12, field)
  bed(-4.2, -47.2, 0.8, 14, hue)
  bed(4.2, -47.2, 0.8, 14, hue)
  bed(-10.4, -58.0, 0.9, 12, hue)
  return out
})()

export const ROCKS: [number, number, number][] = (() => {
  const r = rng(77)
  const out: [number, number, number][] = [
    [-4.2, 12.9, 0.35],
    [3.1, 13.1, 0.4],
    [POND.x + POND.rx + 0.3, POND.z + 0.4, 0.4],
    [POND.x - POND.rx - 0.2, POND.z - 0.6, 0.35],
  ]
  let tries = 0
  while (out.length < 50 && tries < 3600) {
    tries++
    const x = BOARD.minX + 1 + r() * (BOARD.maxX - BOARD.minX - 2)
    const z = BOARD.minZ + 1 + r() * (BOARD.maxZ - BOARD.minZ - 2)
    if (!isFree(x, z, -0.8)) continue
    out.push([x, z, 0.18 + r() * 0.25])
  }
  return out
})()

export const GRASS: [number, number, number][] = (() => {
  const r = rng(99)
  const out: [number, number, number][] = []
  let tries = 0
  while (out.length < 540 && tries < 11000) {
    tries++
    const x = BOARD.minX + 0.6 + r() * (BOARD.maxX - BOARD.minX - 1.2)
    const z = BOARD.minZ + 0.6 + r() * (BOARD.maxZ - BOARD.minZ - 1.2)
    if (!isFree(x, z, -1.1)) continue
    // no lawn tufts on the paved Huế plaza or the campus concrete
    if (z < VILLAGE_END - 0.6 && Math.abs(x) < 8) continue
    out.push([x, z, 0.6 + r() * 0.7])
  }
  return out
})()
