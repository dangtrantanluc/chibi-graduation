import * as THREE from 'three'
import { useMemo } from 'react'
import { G, offsetParts, rng, type Part } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { hipRoof } from '../lib/roof'
import { canvas, toTexture } from '../lib/textures'
import { BIKE, BOARD, DOANMON, FLAG_TOWER } from '../layout'
import { PLAQUES } from '../../config'
import { archRing, archedWall, box, cyl, doorLeaves, dragon, lotusBud, panel, skirting } from './parts'
import { dragonParts } from './dragon'
import { Flags, Plaque, Sign } from './Common'

/*
 * III · HOÀNG THÀNH THĂNG LONG — autumn in Hà Nội.
 * Đoan Môn after the photograph: a massive ochre gate block streaked with
 * rain and moss, five round-arched doors (the central one largest), framed
 * recessed panels and hexagon-lattice windows, a terrace balustrade of
 * "hoa chanh" openwork between lotus-bud posts, and on top a pavilion under
 * two tiers of terracotta mũi hài tiles with stone dragons on the hips.
 * Around it: a vintage bicycle loaded with daisies, a gánh of green cốm,
 * old cast-iron street lamps and park benches under golden trees.
 */

const D = DOANMON
const OCHRE = '#d4a24a'
const OCHRE_LT = '#e0b45e'
const TILE = '#a9573a'

/** openwork balustrade panel: interlocking lozenges ("hoa chanh") */
function lozengeLattice() {
  const [c, g] = canvas(256, 96)
  g.clearRect(0, 0, 256, 96)
  g.strokeStyle = '#c99a44'
  g.lineWidth = 9
  g.strokeRect(4, 4, 248, 88)
  g.lineWidth = 7
  for (let x = -96; x < 300; x += 32) {
    g.beginPath()
    g.moveTo(x, 8)
    g.lineTo(x + 80, 88)
    g.moveTo(x + 80, 8)
    g.lineTo(x, 88)
    g.stroke()
  }
  return toTexture(c)
}

/** hexagon ("mắt cáo") lattice for the small windows */
function hexLattice() {
  const [c, g] = canvas(128, 128)
  g.fillStyle = '#2d2620'
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = '#d8b46a'
  g.lineWidth = 5
  const r = 14
  for (let row = -1; row < 7; row++)
    for (let col = -1; col < 6; col++) {
      const cx = col * r * 1.75 + (row % 2 ? r * 0.87 : 0)
      const cy = row * r * 1.5
      g.beginPath()
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI / 6 + (k / 6) * Math.PI * 2
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }
      g.stroke()
    }
  g.strokeStyle = '#8a6a3a'
  g.lineWidth = 8
  g.strokeRect(4, 4, 120, 120)
  return toTexture(c)
}

const ARCHES: [number, number, number][] = [
  [0, D.archW / 2, D.archH - D.archW / 2],
  [-2.35, 0.5, 0.95],
  [2.35, 0.5, 0.95],
  [-4.35, 0.4, 0.78],
  [4.35, 0.4, 0.78],
]

function gateParts(): Part[] {
  const p: Part[] = []
  // the gate block with five arches, a dark stone skirting and arch rings
  p.push({ g: archedWall(D.w, D.h, D.d, ARCHES), c: OCHRE, m: 'aged' })
  p.push(...skirting(D.w, D.d, 0.32, ARCHES, '#8a7f70'))
  for (const f of [1, -1])
    for (const [cx, hw, sp] of ARCHES) p.push({ g: archRing(cx, hw, sp, 0.13), c: OCHRE_LT, m: 'aged', p: [0, 0, f * (D.d / 2) + (f > 0 ? 0 : -0.06)] })
  // pilaster strips and recessed panels between the arches (front face)
  for (const s of [-1, 1]) {
    for (const x of [1.3, 3.35, 5.25]) {
      p.push(box(0.12, D.h - 0.5, 0.08, [s * x, 0.25 + (D.h - 0.5) / 2, D.d / 2 + 0.04], OCHRE_LT, 'aged'))
    }
    p.push(...panel(0.46, 0.7, [s * 3.35, 1.72, D.d / 2 + 0.02], OCHRE_LT, '#c4923e'))
    p.push(...panel(0.34, 0.95, [s * 5.25, 1.2, D.d / 2 + 0.02], OCHRE_LT, '#c4923e'))
  }
  // Thềm rồng — the emblem of the citadel: a pair of stone dragons flanking the way into the
  // central arch, as dragons flank the steps of Điện Kính Thiên. Lý dragons: slender, hornless,
  // a flame crest, the body in soft bends along a low plinth, the head reared toward whoever comes.
  for (const s of [-1, 1]) {
    const x = s * 1.14
    const z0 = D.d / 2
    p.push(box(0.3, 0.2, 1.62, [x, 0.1, z0 + 0.81], '#8f897b', 'aged'))
    p.push(box(0.36, 0.06, 1.68, [x, 0.03, z0 + 0.81], '#7d776a', 'aged'))
    const R = 0.115
    const pts: THREE.Vector3[] = [new THREE.Vector3(x, 0.2 + R * 4.2, z0 + 1.8), new THREE.Vector3(x, 0.2 + R * 3.1, z0 + 1.54)]
    for (let i = 1; i <= 11; i++) {
      const t = i / 11
      const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 7 - 1.2)
      pts.push(new THREE.Vector3(x + Math.sin(t * Math.PI * 4) * 0.04 * (1 - t), 0.2 + R * (0.95 + 1.3 * wave * (1 - 0.5 * t)), z0 + 1.54 - t * 1.44))
    }
    p.push(...dragonParts({ pts, r: R, style: 'ly', body: '#a9a493', belly: '#bdb8a7', fin: '#989382', mane: '#989382', horn: '#bdb8a7', m: 'aged', accent: 'aged', head: 1.65 }))
  }
  // the ironwood doors of the three middle gateways stand open
  for (const [cx, hw, sp] of ARCHES.slice(0, 3)) p.push(...doorLeaves(cx, hw, sp, D.d / 2 - 0.04, '#5e3122'))
  // cornice
  p.push(box(D.w + 0.22, 0.12, D.d + 0.22, [0, D.h + 0.06, 0], OCHRE_LT, 'aged'))
  p.push(box(D.w + 0.1, 0.06, D.d + 0.1, [0, D.h - 0.06, 0], '#b8883c', 'aged'))
  // balustrade posts with lotus buds around the terrace
  const top = D.h + 0.12
  const postH = 0.46
  const posts: [number, number][] = []
  for (let x = -D.w / 2 + 0.08; x <= D.w / 2 - 0.07; x += (D.w - 0.16) / 10) {
    posts.push([x, D.d / 2 - 0.04])
    posts.push([x, -D.d / 2 + 0.04])
  }
  for (const z of [-0.4, 0.4]) {
    posts.push([-D.w / 2 + 0.08, z])
    posts.push([D.w / 2 - 0.08, z])
  }
  for (const [x, z] of posts) {
    p.push(box(0.14, postH, 0.14, [x, top + postH / 2, z], OCHRE_LT, 'aged'))
    p.push(box(0.18, 0.05, 0.18, [x, top + postH + 0.025, z], '#b8883c', 'aged'))
    p.push(...lotusBud(x, top + postH + 0.05, z, 0.7, '#9c9486'))
  }
  // rails (the openwork panels are textured planes)
  for (const f of [1, -1]) {
    p.push(box(D.w - 0.1, 0.05, 0.1, [0, top + postH - 0.02, f * (D.d / 2 - 0.04)], OCHRE_LT, 'aged'))
    p.push(box(D.w - 0.1, 0.06, 0.12, [0, top + 0.03, f * (D.d / 2 - 0.04)], OCHRE_LT, 'aged'))
  }
  // ── the pavilion (lầu) ──
  const py = top
  const pw = 3.3
  const pd = 2.1
  const ph = 1.15
  p.push(box(pw, ph, pd, [0, py + ph / 2, 0], OCHRE, 'aged'))
  p.push(box(pw + 0.1, 0.1, pd + 0.1, [0, py + 0.05, 0], '#b8883c', 'aged'))
  // arched central window + two lattice windows, front and back
  const pav = new THREE.Shape()
  pav.moveTo(-0.34, 0)
  pav.lineTo(-0.34, 0.42)
  pav.absarc(0, 0.42, 0.34, Math.PI, 0, true)
  pav.lineTo(0.34, 0)
  pav.lineTo(-0.34, 0)
  const arch = new THREE.ExtrudeGeometry(pav, { depth: 0.05, bevelEnabled: false, curveSegments: 14 })
  for (const f of [1, -1]) {
    p.push({ g: arch, c: '#3b2a20', m: 'wood', p: [0, py + 0.1, f * (pd / 2 + 0.01) - (f < 0 ? 0.05 : 0)] })
    p.push({ g: archRing(0, 0.34, 0.42, 0.07, 0.05), c: OCHRE_LT, m: 'aged', p: [0, py + 0.1, f * (pd / 2 + 0.02) - (f < 0 ? 0.05 : 0)] })
  }
  // lower roof (a wide skirt) — terracotta tiles, dragons riding the hips
  p.push(...offsetParts(hipRoof({ w: pw + 1.5, d: pd + 1.5, h: 0.5, lift: 0.34, tile: TILE, under: '#7a4a32', fascia: '#5a3322', ridgeColor: '#6f4a3a', ornaments: false, curve: 1.5 }), [0, py + ph, 0]))
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const d = dragon(sx * (pw / 2 + 0.35), py + ph + 0.12, sz * (pd / 2 + 0.35), -sx, 0.62, '#8c8a82', 0.62)
    p.push(...d.map((q) => ({ ...q, m: 'aged' as const })))
  }
  // upper storey + a hip-and-gable roof whose gable faces the front
  const uy = py + ph + 0.42
  p.push(box(pw * 0.62, 0.62, pd * 0.62, [0, uy + 0.31, 0], OCHRE, 'aged'))
  for (const f of [1, -1]) p.push(box(0.5, 0.34, 0.03, [0, uy + 0.32, f * (pd * 0.31 + 0.01)], '#3b2a20', 'wood'))
  p.push(...offsetParts(hipRoof({ w: pd * 0.62 + 1.2, d: pw * 0.62 + 1.1, h: 0.92, lift: 0.36, tile: TILE, under: '#7a4a32', fascia: '#5a3322', ridgeColor: '#6f4a3a', style: 'vn', gable: 0.5, gableColor: '#c99a4a', bargeColor: '#6f4a3a' }), [0, uy + 0.62, 0], Math.PI / 2))
  // a flame finial on the main ridge and a relief disc in the front gable
  p.push({ g: G.cone, c: '#6f4a3a', m: 'aged', p: [0, uy + 0.62 + 0.92 + 0.28, 0], s: [0.06, 0.3, 0.06] })
  p.push({ g: G.cyl, c: '#e2c27a', m: 'aged', p: [0, uy + 0.62 + 0.62, pw * 0.31 + 0.2], r: [Math.PI / 2, 0, 0], s: [0.14, 0.03, 0.14] })
  return offsetParts(p, [D.x, 0, D.z])
}

/** the citadel wall of the Forbidden City, running off to the board edges */
function wallParts(): Part[] {
  const p: Part[] = []
  const H = 2.1
  for (const s of [-1, 1]) {
    const x0 = D.w / 2
    const x1 = BOARD.maxX - 0.3
    const len = x1 - x0
    const cx = s * (x0 + len / 2)
    p.push(box(len, H, 0.8, [cx, H / 2, D.z], '#b89060', 'aged'))
    p.push(box(len + 0.02, 0.28, 0.9, [cx, 0.14, D.z], '#8a7f70', 'aged'))
    p.push(box(len, 0.1, 0.92, [cx, H + 0.05, D.z], '#c9a06a', 'aged'))
    // brick crenellations
    for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.8) p.push(box(0.42, 0.28, 0.82, [s * x, H + 0.24, D.z], '#b89060', 'aged'))
  }
  return p
}

// ── Hà Nội autumn street furniture ─────────────────────────
/** a vintage black bicycle loaded with daisies (xe đạp chở hoa) */
function bikeParts(): Part[] {
  const p: Part[] = []
  const BLACK = '#1f1f24'
  const wheel = (z: number) => {
    p.push({ g: G.torus, c: '#26262b', p: [0, 0.3, z], r: [0, Math.PI / 2, 0], s: [0.3, 0.3, 0.16] })
    p.push({ g: G.torus, c: '#9aa0a8', m: 'gloss', p: [0, 0.3, z], r: [0, Math.PI / 2, 0], s: [0.27, 0.27, 0.06] })
    for (let k = 0; k < 8; k++) p.push(box(0.006, 0.54, 0.006, [0, 0.3, z], '#b9bec6', 'gloss', [(k / 8) * Math.PI, 0, 0]))
    p.push(cyl(0.03, 0.06, [0, 0.3, z], '#b9bec6', 'gloss', [0, 0, Math.PI / 2]))
  }
  wheel(-0.52)
  wheel(0.52)
  const tube = (a: [number, number], b: [number, number], r = 0.02) => {
    const [ay, az] = a
    const [by, bz] = b
    const len = Math.hypot(by - ay, bz - az)
    p.push({ g: G.cyl, c: BLACK, m: 'gloss', p: [0, (ay + by) / 2, (az + bz) / 2], r: [Math.atan2(bz - az, by - ay), 0, 0], s: [r, len, r] })
  }
  tube([0.3, -0.52], [0.66, -0.2])
  tube([0.3, -0.52], [0.34, 0.02])
  tube([0.34, 0.02], [0.66, -0.2])
  tube([0.34, 0.02], [0.72, 0.36])
  tube([0.66, -0.2], [0.72, 0.36])
  tube([0.3, 0.52], [0.8, 0.4])
  tube([0.6, -0.26], [0.72, -0.24], 0.015)
  p.push({ g: G.sphere, c: '#3a2a22', p: [0, 0.78, -0.25], s: [0.08, 0.035, 0.12] })
  p.push(cyl(0.015, 0.5, [0, 0.86, 0.4], BLACK, 'gloss', [0, 0, Math.PI / 2]))
  for (const s of [-1, 1]) p.push({ g: G.sphereLo, c: '#3a2a22', p: [s * 0.25, 0.86, 0.4], s: [0.035, 0.025, 0.025] })
  // chrome lamp + bell
  p.push({ g: G.sphereLo, c: '#e9ecf0', m: 'gloss', p: [0, 0.74, 0.5], s: [0.05, 0.05, 0.04] })
  // rear rack with two big bamboo baskets of daisies, front basket too
  p.push(box(0.36, 0.02, 0.4, [0, 0.66, -0.52], BLACK, 'gloss'))
  const basket = (x: number, z: number, w: number, h: number, dd: number) => {
    p.push(box(w, h, dd, [x, 0.66 + h / 2, z], '#c9a46a', 'wood'))
    for (let k = 0; k < 4; k++) p.push(box(w + 0.01, 0.012, dd + 0.01, [x, 0.66 + (h * (k + 0.5)) / 4, z], '#a8824a', 'wood'))
  }
  basket(0.26, -0.52, 0.2, 0.26, 0.42)
  basket(-0.26, -0.52, 0.2, 0.26, 0.42)
  basket(0, 0.62, 0.3, 0.16, 0.24)
  const r = rng(33)
  const bunch = (cx: number, cy: number, cz: number, n: number, spread: number, cols: string[]) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * spread
      const z = cz + (r() - 0.5) * spread * 1.6
      const y = cy + r() * 0.12
      const col = cols[Math.floor(r() * cols.length)]
      p.push({ g: G.sphereXs, c: col, m: 'toy', p: [x, y, z], s: [0.05, 0.02, 0.05] })
      p.push({ g: G.sphereXs, c: '#f2c230', m: 'toy', p: [x, y + 0.02, z], s: 0.018 })
    }
    for (let i = 0; i < n / 3; i++) p.push({ g: G.sphereXs, c: '#6fa54f', m: 'foliage', p: [cx + (r() - 0.5) * spread, cy - 0.02, cz + (r() - 0.5) * spread * 1.5], s: [0.03, 0.05, 0.02] })
  }
  bunch(0.26, 0.95, -0.52, 26, 0.24, ['#fdfcf6', '#fdfcf6', '#fbe9a6'])
  bunch(-0.26, 0.95, -0.52, 26, 0.24, ['#fdfcf6', '#f6d24a', '#fdfcf6'])
  bunch(0, 0.84, 0.62, 14, 0.2, ['#f6d24a', '#fdfcf6', '#f7b6c8'])
  // kickstand
  p.push(box(0.012, 0.3, 0.012, [0.06, 0.15, -0.1], BLACK, 'gloss', [0, 0, 0.3]))
  return offsetParts(p, [BIKE.x, 0, BIKE.z], BIKE.ry)
}

/** a carrying pole resting on the ground with two baskets of cốm in lotus leaves */
function ganhParts(): Part[] {
  const p: Part[] = []
  for (const s of [-1, 1]) {
    p.push({ g: new THREE.CylinderGeometry(0.24, 0.2, 0.26, 14, 1, true), c: '#b99256', m: 'wood', p: [s * 0.62, 0.13, 0] })
    p.push({ g: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), c: '#a8824a', m: 'wood', p: [s * 0.62, 0.02, 0] })
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      p.push({ g: G.sphere, c: k % 2 ? '#4f8a3f' : '#5c9a48', m: 'foliage', p: [s * 0.62 + Math.cos(a) * 0.1, 0.28, Math.sin(a) * 0.1], s: [0.1, 0.05, 0.1] })
      p.push({ g: G.sphereLo, c: '#9cc75a', m: 'toy', p: [s * 0.62 + Math.cos(a) * 0.1, 0.31, Math.sin(a) * 0.1], s: [0.05, 0.025, 0.05] })
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      p.push(box(0.01, 0.62, 0.01, [s * 0.62 + Math.cos(a) * 0.16, 0.52, Math.sin(a) * 0.16], '#7a5a32', 'wood', [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25 * s]))
    }
  }
  p.push({ g: G.cyl, c: '#c9a46a', m: 'wood', p: [0, 0.82, 0], r: [0, 0, Math.PI / 2 + 0.06], s: [0.025, 1.7, 0.025] })
  // a nón lá resting against it
  p.push({ g: new THREE.ConeGeometry(0.28, 0.14, 20, 1, true), c: '#e9d9a8', m: 'wood', p: [0.25, 0.1, 0.3], r: [1.1, 0.4, 0] })
  return offsetParts(p, [2.6, 0, -19.6], -0.4)
}

/**
 * Cột cờ Hà Nội (1812): three stepped square terraces of brick, an octagonal
 * tower with small star- and fan-shaped windows, a lookout at the top, and the
 * flag above it.
 */
export const FLAG_TOWER_H = 8.3
function flagTowerParts(): Part[] {
  const BR = '#8f6a55'
  const BR_DK = '#73513f'
  const p: Part[] = []
  let y = 0
  for (const [w, h] of [
    [4.4, 0.85],
    [3.3, 0.85],
    [2.3, 0.95],
  ]) {
    // battered walls: a wider foot
    p.push(box(w + 0.16, 0.16, w + 0.16, [0, y + 0.08, 0], BR_DK, 'aged'))
    p.push(box(w, h, w, [0, y + h / 2, 0], BR, 'aged'))
    p.push(box(w + 0.1, 0.07, w + 0.1, [0, y + h, 0], '#a88a74', 'aged'))
    // a parapet of little brick merlons
    for (let k = -w / 2 + 0.2; k <= w / 2 - 0.19; k += 0.4)
      for (const [dx, dz] of [
        [k, w / 2 - 0.07],
        [k, -w / 2 + 0.07],
        [w / 2 - 0.07, k],
        [-w / 2 + 0.07, k],
      ])
        p.push(box(0.2, 0.16, 0.12, [dx, y + h + 0.11, dz], BR, 'aged', Math.abs(dz) > Math.abs(dx) ? undefined : [0, Math.PI / 2, 0]))
    y += h
  }
  // doorways on the terraces (the east one is "Nghênh Húc", to greet the morning sun)
  for (const [ry, wy] of [
    [0, 0.85],
    [Math.PI / 2, 1.7],
  ] as const) {
    const g = new THREE.Shape()
    g.moveTo(-0.22, 0)
    g.lineTo(-0.22, 0.34)
    g.absarc(0, 0.34, 0.22, Math.PI, 0, true)
    g.lineTo(0.22, 0)
    const door = new THREE.ExtrudeGeometry(g, { depth: 0.04, bevelEnabled: false, curveSegments: 10 })
    const half = wy < 1 ? 1.65 : 1.15
    p.push({ g: door, c: '#2e2420', m: 'aged', p: [Math.sin(ry) * (half - 0.01), wy + 0.02, Math.cos(ry) * (half - 0.01)], r: [0, ry, 0] })
  }
  // the octagonal tower, tapering, with its windows
  const th = 3.5
  p.push({ g: new THREE.CylinderGeometry(0.4, 0.54, th, 8), c: BR, m: 'aged', p: [0, y + th / 2, 0], r: [0, Math.PI / 8, 0] })
  for (let k = 0; k < 4; k++)
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const yy = y + 0.6 + k * 0.72
      const rr = 0.52 - (yy - y) * (0.14 / th) - 0.02
      p.push({ g: G.box, c: '#2e2420', m: 'aged', p: [Math.sin(a + (k % 2) * (Math.PI / 4)) * rr, yy, Math.cos(a + (k % 2) * (Math.PI / 4)) * rr], r: [0, a + (k % 2) * (Math.PI / 4), 0], s: [0.1, 0.16, 0.06] })
    }
  y += th
  // the lookout: an octagonal room wider than the shaft, a window on every face, a flat cap
  p.push({ g: new THREE.CylinderGeometry(0.56, 0.5, 0.12, 8), c: '#a88a74', m: 'aged', p: [0, y + 0.06, 0], r: [0, Math.PI / 8, 0] })
  p.push({ g: new THREE.CylinderGeometry(0.5, 0.5, 0.52, 8), c: BR, m: 'aged', p: [0, y + 0.38, 0], r: [0, Math.PI / 8, 0] })
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    p.push({ g: G.box, c: '#2e2420', m: 'aged', p: [Math.sin(a) * 0.47, y + 0.4, Math.cos(a) * 0.47], r: [0, a, 0], s: [0.16, 0.26, 0.04] })
  }
  p.push({ g: new THREE.CylinderGeometry(0.6, 0.56, 0.1, 8), c: '#a88a74', m: 'aged', p: [0, y + 0.69, 0], r: [0, Math.PI / 8, 0] })
  p.push({ g: new THREE.CylinderGeometry(0.14, 0.2, 0.3, 8), c: BR_DK, m: 'aged', p: [0, y + 0.89, 0] })
  return offsetParts(p, [FLAG_TOWER.x, 0, FLAG_TOWER.z])
}

/** half the span of the lantern string in front of Đoan Môn */
export const LAMP_X = 4.9

/** old Hà Nội cast-iron street lamp (the green ones around Hoàn Kiếm) */
export function hanoiLamp(x: number, z: number): Part[] {
  const G1 = '#2f4a3a'
  const p: Part[] = [
    box(0.26, 0.22, 0.26, [0, 0.11, 0], G1, 'paint'),
    { g: G.cyl, c: G1, m: 'paint', p: [0, 0.34, 0], s: [0.07, 0.26, 0.07] },
    { g: G.cyl, c: G1, m: 'paint', p: [0, 1.5, 0], s: [0.035, 2.1, 0.035] },
    { g: G.torus, c: G1, m: 'paint', p: [0, 0.9, 0], r: [Math.PI / 2, 0, 0], s: 0.06 },
    { g: G.torus, c: G1, m: 'paint', p: [0, 2.3, 0], r: [Math.PI / 2, 0, 0], s: 0.05 },
    // four-sided glass lantern with a little crown
    box(0.2, 0.04, 0.2, [0, 2.58, 0], G1, 'paint'),
    { g: new THREE.CylinderGeometry(0.13, 0.09, 0.3, 4), c: '#fff1cc', m: 'paperLit', p: [0, 2.75, 0], r: [0, Math.PI / 4, 0] },
    { g: new THREE.ConeGeometry(0.18, 0.16, 4), c: G1, m: 'paint', p: [0, 2.98, 0], r: [0, Math.PI / 4, 0] },
    { g: G.sphereXs, c: '#c9a45a', m: 'gold', p: [0, 3.09, 0], s: 0.03 },
  ]
  return offsetParts(p, [x, 0, z])
}

/** slatted wooden park bench on cast-iron legs */
function parkBench(x: number, z: number, ry: number): Part[] {
  const p: Part[] = []
  for (let k = 0; k < 3; k++) p.push(box(1.1, 0.03, 0.08, [0, 0.26, -0.1 + k * 0.1], '#8a5a3a', 'wood'))
  for (let k = 0; k < 2; k++) p.push(box(1.1, 0.07, 0.03, [0, 0.42 + k * 0.1, -0.2], '#8a5a3a', 'wood', [-0.2, 0, 0]))
  for (const s of [-1, 1]) {
    p.push(box(0.04, 0.26, 0.3, [s * 0.46, 0.13, 0], '#2a2c30', 'paint'))
    p.push(box(0.04, 0.3, 0.04, [s * 0.46, 0.4, -0.2], '#2a2c30', 'paint', [-0.2, 0, 0]))
  }
  return offsetParts(p, [x, 0, z], ry)
}

function streetParts(): Part[] {
  return [
    ...bikeParts(),
    ...ganhParts(),
    // the two lamps that carry the lantern string stand wide, clear of the pair by the bicycle
    ...hanoiLamp(-LAMP_X, -24.8),
    ...hanoiLamp(LAMP_X, -24.8),
    {
      g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 21 }, (_, i) => new THREE.Vector3(-LAMP_X + (i / 20) * 2 * LAMP_X, 2.62 - 0.42 * Math.sin((Math.PI * i) / 20), -24.8))), 40, 0.012, 4),
      c: '#3b2a22',
      m: 'wood',
    },
    ...hanoiLamp(-3.2, -16.4),
    ...parkBench(-5.6, -22.4, 0.9),
    ...parkBench(5.4, -21.8, -0.9),
  ]
}

export function ThangLong() {
  const lat = useMemo(() => lozengeLattice(), [])
  const hex = useMemo(() => hexLattice(), [])
  const top = D.h + 0.12
  const rails = useMemo(() => {
    const out: { p: [number, number, number]; w: number; ry: number }[] = []
    const n = 10
    const step = (D.w - 0.16) / n
    for (let i = 0; i < n; i++) {
      const x = -D.w / 2 + 0.08 + step * (i + 0.5)
      for (const f of [1, -1]) out.push({ p: [D.x + x, top + 0.23, D.z + f * (D.d / 2 - 0.04)], w: step - 0.14, ry: f > 0 ? 0 : Math.PI })
    }
    return out
  }, [top])
  return (
    <group>
      <KitMesh build={gateParts} />
      <KitMesh build={wallParts} />
      <KitMesh build={streetParts} />
      <KitMesh build={flagTowerParts} />
      <Flags spots={[[FLAG_TOWER.x, FLAG_TOWER.z]]} kind="vn" h={FLAG_TOWER_H} />
      {rails.map((r, i) => (
        <Sign key={i} map={lat} w={r.w} h={0.36} position={r.p} ry={r.ry} />
      ))}
      {/* hexagon-lattice windows under the side panels */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Sign map={hex} w={0.34} h={0.34} position={[D.x + s * 3.35, 0.95, D.z + D.d / 2 + 0.03]} transparent={false} />
          <Sign map={hex} w={0.28} h={0.28} position={[D.x + s * 5.25, 2.02, D.z + D.d / 2 + 0.03]} transparent={false} />
        </group>
      ))}
      <Plaque text={PLAQUES.doanMon} w={0.9} h={0.36} position={[D.x, 2.3, D.z + D.d / 2 + 0.05]} tilt={0} style="stone" />
    </group>
  )
}

export const HANOI_LAMPS: [number, number, number][] = [
  [-LAMP_X, 2.75, -24.8],
  [LAMP_X, 2.75, -24.8],
  [-3.2, 2.75, -16.4],
]
