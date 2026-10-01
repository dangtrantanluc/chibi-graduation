import * as THREE from 'three'
import { G, offsetParts, type Part } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { hipRoof } from '../lib/roof'
import { taperTube } from '../characters/hair'
import { BOARD, HALL, HUE_PONDS, HUE_WALL_Z, MAI_POTS, NGOMON, NGOMON_INNER, VILLAGE_END } from '../layout'

/** where the Ngọ Môn plaza begins, just past the bamboo at the end of the village */
export const PLAZA0 = VILLAGE_END - 1.2
/** the lantern strings run down either side of the plaza, to posts before the wings */
export const STRING_X = NGOMON_INNER + 0.7
import { PLAQUES } from '../../config'
import { HOUSES, type HouseDef } from './placements'
import { C, archRing, archedWall, box, cauldron, column, cyl, mosaic, ridgeDragons, skirting, windowPane } from './parts'
import { Couplet, Flags, Frieze, Plaque } from './Common'

/*
 * V · HUẾ — Ngọ Môn, the Meridian Gate, is the final stage.
 * Its U-shaped stone base (three gates in front, a Dịch Môn through each
 * wing), and on top Lầu Ngũ Phụng — the Five-Phoenix pavilion: a long red
 * colonnade under green tiles, the central hall under a double roof of
 * imperial yellow, mosaic ridges and "lưỡng long chầu nhật". The golden
 * list (bảng vàng) with the guest's name unfurls from its balcony.
 * Behind it: the Thái Dịch lotus ponds, the Trung Đạo path lined with phẩm
 * sơn, and Điện Thái Hòa; Hiển Lâm Các and palace pavilions to the sides.
 */

/** Phẩm sơn: the rank steles lining a Huế ceremonial courtyard. */
function phamSon(x: number, z: number): Part[] {
  return [
    box(0.34, 0.1, 0.24, [x, 0.05, z], C.stoneDk),
    box(0.22, 0.34, 0.08, [x, 0.27, z], '#c9c0ae'),
    { g: new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14, 1, false, 0, Math.PI), c: '#c9c0ae', m: 'stone', p: [x, 0.44, z], r: [Math.PI / 2, Math.PI / 2, 0] },
    box(0.1, 0.18, 0.01, [x, 0.28, z + 0.045], '#8a7f6f'),
  ]
}

/** Huế citadel wall: brick-grey with a crenellated top */
function citadelWall(x0: number, x1: number, z: number, h = 2.6): Part[] {
  const len = x1 - x0
  const cx = (x0 + x1) / 2
  const p: Part[] = [box(len, h, 0.7, [cx, h / 2, z], '#8e8173', 'aged'), box(len + 0.04, 0.18, 0.8, [cx, h + 0.09, z], '#b3a794', 'aged')]
  for (let x = x0 + 0.4; x < x1 - 0.2; x += 0.9) p.push(box(0.45, 0.32, 0.72, [x, h + 0.34, z], '#8e8173', 'aged'))
  return p
}

// ═══════════════════════════════════════════════════════════
//  NGỌ MÔN
// ═══════════════════════════════════════════════════════════
function ngoMonParts(): Part[] {
  const W = NGOMON.w
  const H = NGOMON.h
  const D = NGOMON.depth
  const STONE = '#948a7d'
  const p: Part[] = []
  // central block: the Ngọ Môn gate (for the king) and two side gates
  const main: [number, number, number][] = [
    [0, NGOMON.archW / 2, NGOMON.archH - NGOMON.archW / 2],
    [-2.5, 0.62, 1.22],
    [2.5, 0.62, 1.22],
  ]
  p.push({ g: archedWall(W, H, D, main), c: STONE, m: 'aged' })
  for (const f of [1, -1]) for (const [cx, hw, sp] of main) p.push({ g: archRing(cx, hw, sp, cx === 0 ? 0.18 : 0.13), c: '#c3b7a2', m: 'aged', p: [0, 0, f * (D / 2) + (f > 0 ? 0 : -0.06)] })
  // the wings of the U, each pierced by a Dịch Môn that runs across it
  const wx = W / 2 - 1.0
  const wz = D / 2 + NGOMON.wing / 2
  for (const s of [-1, 1]) {
    const wing = archedWall(NGOMON.wing, H, 2.0, [[0, 0.5, 1.02]])
    wing.rotateY(Math.PI / 2)
    p.push({ g: wing, c: STONE, m: 'aged', p: [s * wx, 0, wz] })
    for (const f of [1, -1]) {
      const ring = archRing(0, 0.5, 1.02, 0.12)
      ring.rotateY(Math.PI / 2)
      p.push({ g: ring, c: '#c3b7a2', m: 'aged', p: [s * wx + f * 1.0 + (f > 0 ? 0 : -0.06), 0, wz] })
    }
    p.push(box(2.2, 0.2, NGOMON.wing + 0.2, [s * wx, H + 0.1, wz], '#bdb2a1', 'aged'))
  }
  // dressed-stone courses across the faces — each course stops at the gateways it meets
  const course = (y: number, lo: number, hi: number, gates: [number, number, number, number][], put: (c: number, len: number) => void) => {
    // gates: [centre, half-width, spring height, ring width]
    const cuts = gates
      .map(([c, hw, sp, ring]) => {
        const r = hw + ring
        const half = y <= sp ? r : y < sp + r ? Math.sqrt(r * r - (y - sp) ** 2) : 0
        return [c - half - 0.02, c + half + 0.02, half] as const
      })
      .filter(([, , half]) => half > 0)
      .sort((a, b) => a[0] - b[0])
    let x = lo
    for (const [a, b] of cuts) {
      if (a - x > 0.05) put((x + a) / 2, a - x)
      x = Math.max(x, b)
    }
    if (hi - x > 0.05) put((x + hi) / 2, hi - x)
  }
  const frontGates = main.map(([c, hw, sp]) => [c, hw, sp, c === 0 ? 0.18 : 0.13] as [number, number, number, number])
  for (let y = 0.45; y < H - 0.1; y += 0.42) {
    course(y, -W / 2, W / 2, frontGates, (c, len) => p.push(box(len, 0.025, 0.02, [c, y, D / 2 + 0.005], '#7c7366', 'aged')))
    for (const s of [-1, 1]) {
      p.push(box(2.02, 0.025, 0.02, [s * wx, y, D / 2 + NGOMON.wing + 0.005], '#7c7366', 'aged'))
      // the inner face of each wing is pierced by its Dịch Môn
      course(y, wz - NGOMON.wing / 2, wz + NGOMON.wing / 2, [[wz, 0.5, 1.02, 0.12]], (c, len) => p.push(box(0.02, 0.025, len, [s * (wx - 1.0) - s * 0.005, y, c], '#7c7366', 'aged')))
    }
  }
  p.push(box(W + 0.3, 0.2, D + 0.3, [0, H + 0.1, 0], '#bdb2a1', 'aged'))
  p.push(...skirting(W, D, 0.3, main, '#7c7366', 'aged', 0.1))
  // a low balustrade of red posts and a gilded rail along the front edge (the scroll hangs here)
  const rail = (x0: number, x1: number, z: number) => {
    for (let x = x0; x <= x1 + 1e-3; x += 0.5) p.push(box(0.08, 0.36, 0.08, [x, H + 0.38, z], C.hueRed, 'paint'))
    p.push(box(x1 - x0 + 0.1, 0.06, 0.07, [(x0 + x1) / 2, H + 0.54, z], C.gold, 'gold'))
    p.push(box(x1 - x0 + 0.1, 0.04, 0.06, [(x0 + x1) / 2, H + 0.3, z], C.hueRed, 'paint'))
  }
  rail(-W / 2 + 2.2, W / 2 - 2.2, D / 2 + 0.05)
  const top = H + 0.2
  // ── Lầu Ngũ Phụng, lower storey: a long red colonnade ──
  p.push(box(W - 1.4, 0.08, 1.9, [0, top + 0.04, 0], '#c9bfae', 'stone'))
  for (const x of [-5.4, -4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2, 5.4]) for (const z of [-0.78, 0.78]) p.push(...column(x, top, z, 1.2, 0.085, C.hueRed))
  // the back of the lower storey is closed by lattice doors between every pair of columns
  for (const x of [-4.8, -3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6, 4.8]) {
    p.push(...windowPane(1.02, 0.8, [x, top + 0.62, -0.78], 0, '#6e1e1a'))
    p.push(box(1.04, 0.3, 0.06, [x, top + 0.07, -0.78], '#6e1e1a', 'paint'))
    p.push(box(1.04, 0.14, 0.06, [x, top + 1.1, -0.78], C.hueRed, 'paint'))
  }
  // lower roofs: green over the side sections, imperial yellow over the centre
  for (const s of [-1, 1]) p.push(...offsetParts(hipRoof({ w: 4.2, d: 2.7, h: 0.5, lift: 0.3, tile: C.hueGreen, under: C.hueRed, fascia: C.redDk, ridgeColor: '#2f5f3d', style: 'vn' }), [s * 4.15, top + 1.2, 0]))
  p.push(...offsetParts(hipRoof({ w: 5.4, d: 2.9, h: 0.46, lift: 0.34, tile: C.hueYellow, under: C.hueRed, fascia: C.redDk, ridgeColor: '#c98f2a', ornaments: false }), [0, top + 1.2, 0]))
  // upper central hall + double yellow roof, mosaic ridge, dragons facing the sun
  p.push(box(3.4, 0.52, 1.5, [0, top + 1.72, 0], C.hueRed, 'paint'))
  p.push(...windowPane(1.3, 0.34, [0, top + 1.72, 0.76], 0, '#6e1e1a'))
  for (const s of [-1, 1]) p.push(...windowPane(0.7, 0.34, [s * 1.2, top + 1.72, 0.76], 0, '#6e1e1a'))
  p.push(box(3.5, 0.06, 1.6, [0, top + 1.99, 0], C.gold, 'gold'))
  p.push(...offsetParts(hipRoof({ w: 4.6, d: 2.3, h: 1.0, lift: 0.46, tile: C.hueYellow, under: C.hueRed, ridgeColor: '#c98f2a', style: 'vn' }), [0, top + 2.02, 0]))
  p.push(...mosaic(-1.1, 1.1, top + 2.02 + 1.0 + 0.14, 0, 0.14, 0.035))
  p.push(...ridgeDragons(0, top + 2.02 + 1.0, 0, 0.7))
  // upper side pavilions, green, and the pavilions over the two wings (Dực Lâu)
  for (const s of [-1, 1]) {
    p.push(box(2.0, 0.44, 1.3, [s * 4.15, top + 1.62, 0], C.hueRed, 'paint'))
    p.push(...windowPane(1.2, 0.28, [s * 4.15, top + 1.62, 0.66], 0, '#6e1e1a'))
    p.push(...offsetParts(hipRoof({ w: 2.9, d: 2.1, h: 0.78, lift: 0.36, tile: C.hueGreen, under: C.hueRed, ridgeColor: '#2f5f3d', style: 'vn' }), [s * 4.15, top + 1.84, 0]))
    p.push(...mosaic(s * 4.15 - 0.4, s * 4.15 + 0.4, top + 1.84 + 0.78 + 0.1, 0, 0.13, 0.03))
    for (const x of [-0.6, 0.6]) for (const z of [-1.0, 0, 1.0]) p.push(...column(s * wx + x, top, wz + z, 0.95, 0.075, C.hueRed))
    p.push(...offsetParts(hipRoof({ w: 2.9, d: 1.9, h: 0.68, lift: 0.32, tile: C.hueGreen, under: C.hueRed, ridgeColor: '#2f5f3d', style: 'vn' }), [s * wx, top + 0.95, wz], Math.PI / 2))
  }
  return offsetParts(p, [NGOMON.x, 0, NGOMON.z])
}

/** the plaza in front of Ngọ Môn: star-lantern poles, lantern strings, potted mai */
function plazaParts(): Part[] {
  const p: Part[] = []
  const front = NGOMON.z + NGOMON.depth / 2 + NGOMON.wing
  // glazed pots for the mai either side of the central gate
  for (const [x, z] of MAI_POTS) p.push({ g: new THREE.CylinderGeometry(0.3, 0.23, 0.44, 14), c: '#3f6aa8', m: 'ceramic', p: [x, 0.22, z] })
  for (const s of [-1, 1]) {
    // bamboo poles for the đèn ông sao at the plaza entrance
    p.push(cyl(0.035, 2.9, [s * 2.6, 1.45, PLAZA0 - 0.2], '#b9a064', 'wood'))
    // red posts carrying strings of Hội An lanterns toward the wings
    p.push(box(0.12, 3.3, 0.12, [s * STRING_X, 1.65, PLAZA0], C.hueRed, 'paint'))
    p.push(box(0.12, 3.3, 0.12, [s * STRING_X, 1.65, front + 0.2], C.hueRed, 'paint'))
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      pts.push(new THREE.Vector3(s * STRING_X, 3.25 - 0.45 * Math.sin(Math.PI * t), PLAZA0 + t * (front + 0.2 - PLAZA0)))
    }
    p.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.016, 4), c: '#4a3328', m: 'wood' })
    // bronze đỉnh in the courtyard of the U
    p.push(...cauldron([s * (NGOMON_INNER - 0.85), 0, front - NGOMON.wing + 1.2], 0.7, true))
  }
  return p
}

/** Hiển Lâm Các: the three-tiered pavilion of the Huế citadel. */
function hienLamParts(): Part[] {
  const p: Part[] = [box(5.2, 0.45, 4.6, [0, 0.22, 0], C.stone), box(5.4, 0.08, 4.8, [0, 0.46, 0], C.marble)]
  let y = 0.48
  const tiers: [number, number, number][] = [
    [3.8, 3.2, 1.5],
    [3.0, 2.5, 1.2],
    [2.2, 1.8, 1.0],
  ]
  tiers.forEach(([w, d, h], i) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(...column((sx * w) / 2, y, (sz * d) / 2, h, 0.1, C.hueRed))
    p.push(box(w - 0.2, h * 0.9, d - 0.2, [0, y + h * 0.45, 0], '#7a231f', 'paint'))
    for (const f of [1, -1]) p.push(...windowPane(w * 0.55, h * 0.55, [0, y + h * 0.5, f * (d / 2 - 0.08)], f > 0 ? 0 : Math.PI, '#6e1e1a'))
    p.push(box(w + 0.1, 0.12, d + 0.1, [0, y + h, 0], C.gold, 'gold'))
    y += h + 0.05
    const last = i === tiers.length - 1
    p.push(...offsetParts(hipRoof({ w: w + 1.3, d: d + 1.2, h: last ? 1.1 : 0.55, lift: 0.4, tile: C.hueYellow, under: C.hueRed, ridgeColor: '#c98f2a', style: 'vn', ornaments: last }), [0, y, 0]))
    if (!last) p.push(...mosaic(-w / 2, w / 2, y + 0.6, d / 2 + 0.55, 0.2, 0.04))
    y += last ? 0 : 0.35
  })
  p.push({ g: G.sphere, c: C.gold, m: 'gold', p: [0, y + 1.25, 0], s: 0.14 })
  return p
}

function houseParts(h: HouseDef): Part[] {
  if (h.style === 'tower') return hienLamParts()
  const { w, d } = h
  const H = h.h
  const p: Part[] = [box(w + 0.5, 0.3, d + 0.5, [0, 0.15, 0], C.stone)]
  p.push(box(w, H, d, [0, 0.3 + H / 2, 0], C.hueRed, 'paint'))
  for (const x of [-w * 0.3, 0, w * 0.3]) p.push(...windowPane(w * 0.24, H * 0.72, [x, 0.3 + H * 0.45, d / 2 + 0.03], 0, '#6e1e1a'))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(...column((sx * w) / 2, 0.3, (sz * d) / 2, H, 0.12, C.hueRed))
  p.push(...offsetParts(hipRoof({ w: w + 1.4, d: d + 1.4, h: 1.2, lift: 0.45, tile: C.hueYellow, under: C.hueRed, ridgeColor: '#c98f2a', style: 'vn' }), [0, 0.3 + H, 0]))
  return p
}

// ═══════════════════════════════════════════════════════════
//  ĐIỆN THÁI HÒA (backdrop)
// ═══════════════════════════════════════════════════════════
function hallParts(): Part[] {
  const cx = HALL.x
  const ty = HALL.terraceY
  const front = HALL.terraceFront
  const back = HALL.terraceBack
  const tz = (front + back) / 2
  const p: Part[] = []
  p.push(box(14.4, ty, front - back, [cx, ty / 2, tz], '#c9bfae', 'aged'))
  p.push(box(14.6, 0.1, front - back + 0.2, [cx, ty - 0.02, tz], '#ddd5c6', 'aged'))
  p.push(box(14.5, 0.25, front - back + 0.1, [cx, 0.125, tz], C.stoneDk, 'aged'))
  for (let k = 0; k < 5; k++) {
    const h = ty - k * 0.18
    const d = 0.3 * (k + 1)
    p.push(box(3.0, h, 0.3, [cx, h / 2, front + d - 0.15], k % 2 ? '#ddd5c6' : '#d2c9b8', 'aged'))
  }
  // dragon balustrades descending the stairs
  for (const s of [-1, 1]) {
    p.push(box(0.3, ty + 0.1, 1.7, [cx + s * 1.68, (ty + 0.1) / 2, front + 0.8], C.stoneDk, 'aged'))
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => new THREE.Vector3(cx + s * 1.68, ty + 0.25 - t * 0.75 + Math.sin(t * Math.PI * 3) * 0.06, front - 0.1 + t * 1.75))
    p.push({ g: taperTube(pts, 0.05, 0.1, 16, 7), c: C.jade, m: 'ceramic' })
    p.push({ g: G.sphere, c: C.jade, m: 'ceramic', p: [cx + s * 1.68, 0.3, front + 1.75], s: [0.12, 0.13, 0.16] })
    p.push({ g: G.sphereXs, c: C.gold, m: 'gold', p: [cx + s * 1.68, 0.36, front + 1.9], s: 0.04 })
  }
  for (let x = cx - 7.0; x <= cx + 7.01; x += 0.7) {
    if (Math.abs(x - cx) < 1.8) continue
    p.push(box(0.12, 0.5, 0.12, [x, ty + 0.25, front + 0.1], '#ddd5c6', 'aged'))
  }
  for (const s of [-1, 1]) p.push(box(5.2, 0.07, 0.08, [cx + s * 4.43, ty + 0.4, front + 0.1], '#ddd5c6', 'aged'))
  const bf = HALL.bodyFront
  const bb = HALL.bodyBack
  const bz = (bf + bb) / 2
  const colH = 3.05
  for (const x of [-2, 0, 2, 4, 6, 8]) {
    p.push(...column(x + (cx - 3), ty, bf, colH, 0.2, C.hueRed))
    p.push(...column(x + (cx - 3), ty, bb, colH, 0.2, C.hueRed))
  }
  // golden dragons coiling the two central columns
  for (const x of [cx - 1, cx + 1]) {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 24; k++) {
      const t = k / 24
      const a = t * Math.PI * 5
      pts.push(new THREE.Vector3(x + Math.cos(a) * 0.23, ty + 0.3 + t * 2.5, bf + Math.sin(a) * 0.23))
    }
    p.push({ g: taperTube(pts, 0.035, 0.07, 60, 6), c: C.gold, m: 'gold' })
  }
  p.push(box(10.2, colH, 0.3, [cx, ty + colH / 2, bb], '#7a231f', 'paint'))
  for (const s of [-1, 1]) p.push(box(0.3, colH, bf - bb, [cx + s * 5.05, ty + colH / 2, bz], '#7a231f', 'paint'))
  for (const x of [-1, 1, 3, 5, 7]) {
    const px = x + (cx - 3)
    p.push(...windowPane(1.62, 2.35, [px, ty + 1.3, bf - 0.25], 0, '#6e1e1a'))
    p.push(box(1.64, 0.35, 0.1, [px, ty + 0.18, bf - 0.25], '#6e1e1a', 'paint'))
  }
  p.push(box(10.4, 0.45, 0.4, [cx, ty + colH - 0.1, bf], C.hueRed, 'paint'))
  p.push(box(10.4, 0.16, 0.42, [cx, ty + colH - 0.2, bf + 0.01], C.gold, 'gold'))
  for (let i = 0; i <= 28; i++) {
    const x = cx - 5.1 + i * 0.365
    p.push(box(0.2, 0.14, 0.22, [x, ty + colH + 0.2, bf + 0.1], i % 2 ? C.hueRed : C.gold, i % 2 ? 'paint' : 'gold'))
  }
  p.push(box(9.6, 2.9, 4.8, [cx, ty + 1.5, bz], '#ffcf8a', 'paperLit'))
  // double roof in imperial yellow (trùng thiềm điệp ốc)
  p.push(...offsetParts(hipRoof({ w: 13.4, d: 8.0, h: 1.05, lift: 0.5, thick: 0.16, tile: C.hueYellow, under: C.hueRed, fascia: '#6e1e1a', ridgeColor: '#c98f2a', ornaments: false }), [cx, ty + colH + 0.28, bz]))
  p.push(box(9.4, 0.9, 4.2, [cx, ty + colH + 1.2, bz], C.hueRed, 'paint'))
  p.push(box(9.5, 0.14, 4.3, [cx, ty + colH + 0.85, bz], C.gold, 'gold'))
  p.push(...offsetParts(hipRoof({ w: 11.6, d: 6.6, h: 2.2, lift: 0.7, thick: 0.16, tile: C.hueYellow, under: C.hueRed, ridgeColor: '#c98f2a', ridgeR: 0.13, style: 'vn' }), [cx, ty + colH + 1.72, bz]))
  p.push(...ridgeDragons(cx, ty + colH + 1.72 + 2.2 + 0.15, bz, 1.9))
  p.push(...mosaic(cx - 2.5, cx - 0.9, ty + colH + 1.72 + 2.2 + 0.28, bz, 0.16, 0.045))
  p.push(...mosaic(cx + 0.9, cx + 2.5, ty + colH + 1.72 + 2.2 + 0.28, bz, 0.16, 0.045))
  for (const x of [cx - 4.8, cx + 4.8]) p.push(...mosaic(x - 0.6, x + 0.6, ty + colH + 0.28 + 1.05 + 0.12, bz + 2.4, 0.15, 0.04))
  // rank steles (phẩm sơn) lining the Trung Đạo path to the hall
  // (set against the balustrades, and stopping short of the court, where the farewell row stands)
  for (let z = HUE_PONDS[0][3] - 0.4; z >= HUE_PONDS[0][2] + 1.0; z -= 0.95) for (const sx of [-1, 1]) p.push(...phamSon(cx + sx * 1.26, z))
  // two bronze đỉnh urns, after Huế's Nine Dynastic Urns
  p.push(...cauldron([cx - 5.4, 0, front + 0.9], 0.85, true))
  p.push(...cauldron([cx + 5.4, 0, front + 0.9], 0.85, true))
  return p
}

/** the stone path across the lotus ponds, with low balustrades */
function trungDaoParts(): Part[] {
  const p: Part[] = []
  const z0 = HUE_PONDS[0][3]
  const z1 = HUE_PONDS[0][2]
  for (const s of [-1, 1]) {
    for (let z = z0; z >= z1 - 1e-3; z -= 0.55) p.push(box(0.1, 0.34, 0.1, [HALL.x + s * 1.5, 0.17, z], C.marble))
    p.push(box(0.07, 0.06, z0 - z1, [HALL.x + s * 1.5, 0.32, (z0 + z1) / 2], C.marble))
  }
  // bronze nghi môn at the head of the bridge, as you come out of Ngọ Môn: two tall pillars and a cross-beam
  const gz = z0 + 0.45
  for (const s of [-1, 1]) {
    p.push(cyl(0.09, 3.3, [HALL.x + s * 1.3, 1.65, gz], '#6f7f5f', 'bronze'))
    p.push({ g: G.sphere, c: '#8a8a5a', m: 'bronze', p: [HALL.x + s * 1.3, 3.4, gz], s: 0.13 })
  }
  p.push(box(3.0, 0.18, 0.14, [HALL.x, 3.0, gz], '#6f7f5f', 'bronze'))
  p.push({ g: taperTube([new THREE.Vector3(HALL.x - 1.4, 3.1, gz), new THREE.Vector3(HALL.x, 3.55, gz), new THREE.Vector3(HALL.x + 1.4, 3.1, gz)], 0.05, 0.05, 16, 6), c: '#7b8a64', m: 'bronze' })
  return p
}

const FLAG_SPOTS: [number, number][] = [
  [-7.6, PLAZA0 - 0.6],
  [-7.6, PLAZA0 - 4.4],
  [7.6, PLAZA0 - 0.6],
  [7.6, PLAZA0 - 4.4],
]

export function Hue() {
  const bf = HALL.bodyFront
  return (
    <group>
      <KitMesh build={() => [...citadelWall(BOARD.minX + 0.3, NGOMON.x - NGOMON.w / 2, HUE_WALL_Z), ...citadelWall(NGOMON.x + NGOMON.w / 2, BOARD.maxX - 0.3, HUE_WALL_Z)]} />
      <KitMesh build={ngoMonParts} />
      <KitMesh build={plazaParts} />
      <Plaque text={PLAQUES.ngomon} w={1.1} h={0.42} position={[NGOMON.x, NGOMON.h + 0.2 + 1.72, NGOMON.z + 0.79]} tilt={0} style="hue" />
      <Flags spots={FLAG_SPOTS} h={3.8} />
      <KitMesh build={hallParts} />
      <KitMesh build={trungDaoParts} />
      {HOUSES.map((h, i) => (
        <KitMesh key={i} build={() => houseParts(h)} position={[h.x, 0, h.z]} rotation-y={h.ry} />
      ))}
      <Frieze position={[HALL.x, HALL.terraceY + 3.05 + 1.2, bf - 0.595]} w={9.2} h={0.6} />
      <Plaque text={PLAQUES.hall} w={1.7} h={0.66} position={[HALL.x, HALL.terraceY + 4.2, bf - 0.56]} tilt={-0.05} style="hue" />
      <Couplet text={PLAQUES.coupletLeft} position={[HALL.x - 3, HALL.terraceY + 1.75, bf + 0.23]} />
      <Couplet text={PLAQUES.coupletRight} position={[HALL.x + 3, HALL.terraceY + 1.75, bf + 0.23]} />
    </group>
  )
}
