import * as THREE from 'three'
import { useMemo } from 'react'
import { G, blob, offsetParts, rng, type Part } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { signTex } from '../lib/textures'
import { THIENLY, UNI_BENCH, campusToWorld } from '../layout'
import { PLAQUES } from '../../config'
import { C, bench, box, cyl, flagpole } from './parts'
import { Flags, Sign } from './Common'

/*
 * II · ĐH NÔNG LÂM TP.HCM — Nhà Thiên Lý, after the photograph: six storeys
 * of teal-green glass behind a white concrete grid, an air-conditioner on
 * every bay, a top band pierced by half-moon openings, green rooftop letters,
 * a terracotta portal at the main door with "THIÊN LÝ" over it; in front a
 * clipped round topiary in a bed of red ixora, flagpole, lamps, a pink bench
 * and a row of parked scooters.
 */

const T = { ...THIENLY, x: 0, front: 0 }
const CREAM = '#efe6cc'
const WHITE = '#f6f4ee'
const GLASS = ['#3fae9b', '#46b7a5', '#379e8e', '#58c2b0', '#40a898']
const BAYS = 12

function buildingParts(): Part[] {
  const p: Part[] = []
  const x0 = T.x - T.w / 2
  const H = T.floor * T.floors
  const top = 0.72
  const zf = T.front
  const zc = T.front - T.d / 2
  const bay = T.w / BAYS
  // the concrete body + a flat roof with a parapet
  p.push(box(T.w, H + top, T.d, [T.x, (H + top) / 2, zc], CREAM, 'plaster'))
  p.push(box(T.w + 0.12, 0.12, T.d + 0.12, [T.x, H + top + 0.06, zc], WHITE, 'plaster'))
  p.push(box(T.w + 0.2, 0.3, 0.18, [T.x, 0.15, zf + 0.05], '#d9cfb6', 'stone'))
  // upper floors: glass bays with mullions, behind a deep white grid
  for (let f = 1; f < T.floors; f++) {
    const yb = f * T.floor
    for (let b = 0; b < BAYS; b++) {
      const cx = x0 + (b + 0.5) * bay
      const tint = GLASS[(b * 3 + f * 2) % GLASS.length]
      p.push(box(bay - 0.06, T.floor - 0.1, 0.04, [cx, yb + T.floor / 2, zf + 0.02], tint, 'glass'))
      // 2 × 2 panes + a slim transom
      p.push(box(0.018, T.floor - 0.1, 0.05, [cx, yb + T.floor / 2, zf + 0.04], '#2c6b5f', 'paint'))
      p.push(box(bay - 0.06, 0.018, 0.05, [cx, yb + T.floor * 0.62, zf + 0.04], '#2c6b5f', 'paint'))
      // the air-conditioner sitting on the slab lip of each bay
      if ((b + f) % 5 !== 2) {
        p.push(box(0.24, 0.15, 0.13, [cx + bay * 0.26, yb + 0.14, zf + 0.2], '#f3f3ef', 'plaster'))
        p.push(box(0.2, 0.1, 0.01, [cx + bay * 0.26, yb + 0.14, zf + 0.267], '#c9ccc8', 'plaster'))
      }
    }
  }
  // the white grid: fins + slabs, standing proud of the glass
  for (let b = 0; b <= BAYS; b++) p.push(box(0.09, H - T.floor + 0.08, 0.34, [x0 + b * bay, T.floor + (H - T.floor) / 2, zf + 0.16], WHITE, 'plaster'))
  for (let f = 1; f <= T.floors; f++) p.push(box(T.w + 0.1, 0.09, 0.4, [T.x, f * T.floor, zf + 0.19], WHITE, 'plaster'))
  // crown band: half-moon openings (flat base, round top) over glass
  const band = new THREE.Shape()
  band.moveTo(-T.w / 2, 0)
  band.lineTo(T.w / 2, 0)
  band.lineTo(T.w / 2, top)
  band.lineTo(-T.w / 2, top)
  band.lineTo(-T.w / 2, 0)
  const holes = 5
  for (let i = 0; i < holes; i++) {
    const cx = -T.w / 2 + ((i + 0.5) / holes) * T.w
    const r = Math.min(0.9, (T.w / holes) * 0.36)
    const h = new THREE.Path()
    h.moveTo(cx - r, 0.12)
    h.absarc(cx, 0.12, r, Math.PI, 0, true)
    h.lineTo(cx - r, 0.12)
    band.holes.push(h)
  }
  const bandGeo = new THREE.ExtrudeGeometry(band, { depth: 0.2, bevelEnabled: false, curveSegments: 16 })
  p.push({ g: bandGeo, c: WHITE, m: 'plaster', p: [T.x, H + 0.02, zf + 0.02] })
  p.push(box(T.w - 0.2, top - 0.1, 0.03, [T.x, H + top / 2, zf + 0.0], '#51bba9', 'glass'))
  // ground floor: cream wall, a strip of windows, the main portal + a side door
  for (let b = 0; b < BAYS; b++) {
    const cx = x0 + (b + 0.5) * bay
    if (b === 2 || b === 3 || b === 10) continue
    p.push(box(bay * 0.66, 0.36, 0.03, [cx, 0.52, zf + 0.012], '#4aa596', 'glass'))
    p.push(box(bay * 0.66, 0.02, 0.04, [cx, 0.52, zf + 0.03], '#e9e2cf', 'plaster'))
  }
  const px = x0 + 3 * bay
  const portal: Part[] = [
    box(0.16, 1.18, 0.5, [-0.66, 0.59, 0], '#cf8e6f', 'plaster'),
    box(0.16, 1.18, 0.5, [0.66, 0.59, 0], '#cf8e6f', 'plaster'),
    box(1.48, 0.3, 0.5, [0, 1.33, 0], '#cf8e6f', 'plaster'),
    box(1.54, 0.05, 0.54, [0, 1.49, 0], '#b8765a', 'plaster'),
    box(1.12, 0.84, 0.03, [0, 0.42, -0.2], '#223834', 'glass'),
    box(0.02, 0.84, 0.05, [0, 0.42, -0.18], '#9aa5a2', 'gloss'),
    box(0.8, 0.16, 0.04, [0, 1.0, -0.19], '#101413', 'gloss'),
  ]
  p.push(...offsetParts(portal, [px, 0, zf + 0.25]))
  // entrance steps
  for (let k = 0; k < 3; k++) p.push(box(1.7 + k * 0.2, 0.06, 0.3, [px, 0.03 + (2 - k) * 0.06, zf + 0.55 + k * 0.28], k % 2 ? '#e2dac6' : '#d6cdb6', 'stone'))
  const sx = x0 + 10.5 * bay
  p.push(...offsetParts([box(1.2, 0.06, 0.6, [0, 1.02, 0.1], WHITE, 'plaster'), box(0.06, 1.0, 0.06, [-0.56, 0.5, 0.36], WHITE, 'plaster'), box(0.06, 1.0, 0.06, [0.56, 0.5, 0.36], WHITE, 'plaster'), box(0.9, 0.78, 0.03, [0, 0.39, -0.18], '#223834', 'glass')], [sx, 0, zf + 0.2]))
  // side façades: a column of window strips each floor
  for (const s of [-1, 1]) for (let f = 1; f < T.floors; f++) p.push(box(0.04, T.floor * 0.52, T.d * 0.72, [T.x + s * (T.w / 2 + 0.01), f * T.floor + T.floor / 2, zc], '#48ae9e', 'glass'))
  // rooftop plant room + water tanks (seen from above in the finale)
  p.push(box(2.2, 0.6, 1.4, [T.x + 3.2, H + top + 0.42, zc - 0.3], CREAM, 'plaster'))
  for (const dx of [-3.4, -2.6]) p.push(cyl(0.3, 0.55, [T.x + dx, H + top + 0.4, zc - 0.5], '#d7dbe0', 'gloss'))
  return p
}

/** a Vietnamese scooter (xe tay ga), chibi-sized */
function scooter(color: string): Part[] {
  const p: Part[] = []
  for (const z of [-0.36, 0.36]) {
    p.push({ g: G.torus, c: '#1d1d22', p: [0, 0.14, z], r: [0, Math.PI / 2, 0], s: [0.13, 0.13, 0.35] })
    p.push(cyl(0.07, 0.06, [0, 0.14, z], '#b9bec6', 'gloss', [0, 0, Math.PI / 2]))
  }
  p.push({ g: G.sphere, c: color, m: 'gloss', p: [0, 0.32, -0.12], s: [0.15, 0.16, 0.36] })
  p.push({ g: G.box, c: color, m: 'gloss', p: [0, 0.22, 0.16], s: [0.14, 0.08, 0.34] })
  p.push({ g: G.sphere, c: color, m: 'gloss', p: [0, 0.42, 0.38], r: [0.35, 0, 0], s: [0.1, 0.24, 0.1] })
  p.push({ g: G.sphere, c: '#1f1f24', p: [0, 0.47, -0.14], s: [0.12, 0.05, 0.3] })
  p.push(cyl(0.012, 0.36, [0, 0.66, 0.42], '#2a2a30', 'gloss', [0, 0, Math.PI / 2]))
  for (const s of [-1, 1]) p.push({ g: G.sphereLo, c: '#2a2a30', p: [s * 0.17, 0.66, 0.42], s: [0.03, 0.025, 0.025] })
  p.push({ g: G.sphereLo, c: '#fff6d8', m: 'paperLit', p: [0, 0.58, 0.49], s: [0.05, 0.04, 0.02] })
  p.push({ g: G.box, c: '#c9ccd2', m: 'gloss', p: [0, 0.54, 0.47], s: [0.2, 0.14, 0.01] })
  return p
}

/** the plaza in the building's frame (lx along the façade, lz toward the lane) */
function plazaParts(): Part[] {
  const p: Part[] = []
  const TOPIARY = { x: 0.3, z: 4.1, r: 0.95 }
  // topiary planter: a low round kerb
  p.push({ g: new THREE.CylinderGeometry(TOPIARY.r + 0.55, TOPIARY.r + 0.6, 0.18, 32, 1, true), c: '#d8d2c4', m: 'stone', p: [TOPIARY.x, 0.09, TOPIARY.z] })
  p.push({ g: new THREE.TorusGeometry(TOPIARY.r + 0.575, 0.05, 5, 36), c: '#e4dfd3', m: 'stone', p: [TOPIARY.x, 0.18, TOPIARY.z], r: [Math.PI / 2, 0, 0] })
  p.push({ g: new THREE.CylinderGeometry(TOPIARY.r + 0.55, TOPIARY.r + 0.55, 0.12, 32), c: '#6a4a32', m: 'ground', p: [TOPIARY.x, 0.08, TOPIARY.z] })
  p.push({ g: blob(12, 2, 0.04), c: '#3f7a34', m: 'foliage', p: [TOPIARY.x, TOPIARY.r + 0.12, TOPIARY.z], s: [TOPIARY.r * 0.9, TOPIARY.r * 0.86, TOPIARY.r * 0.9] })
  p.push(cyl(0.07, 0.25, [TOPIARY.x, 0.2, TOPIARY.z], C.woodDk, 'wood'))
  // ixora ring: clusters of little red flower heads
  const r = rng(91)
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2
    const d = TOPIARY.r + 0.2 + r() * 0.3
    p.push({ g: G.sphereXs, c: r() < 0.3 ? '#4f8a3f' : r() < 0.65 ? '#e2413a' : '#f06a5a', m: 'toy', p: [TOPIARY.x + Math.cos(a) * d, 0.2 + r() * 0.05, TOPIARY.z + Math.sin(a) * d], s: [0.05 + r() * 0.02, 0.035, 0.05 + r() * 0.02] })
    if (i % 2) p.push({ g: G.sphereXs, c: '#e2413a', m: 'toy', p: [TOPIARY.x + Math.cos(a + 0.05) * (d - 0.12), 0.22, TOPIARY.z + Math.sin(a + 0.05) * (d - 0.12)], s: 0.04 })
  }
  // clipped hedges along the façade
  for (let x = T.x - T.w / 2 + 0.4; x < T.x + T.w / 2 - 0.3; x += 0.9) {
    if (Math.abs(x - (T.x - T.w / 2 + 3.5 * (T.w / BAYS))) < 1.1) continue
    p.push({ g: blob(Math.floor(x * 10), 1, 0.12), c: '#4f8a3f', m: 'foliage', p: [x, 0.22, T.front + 0.75], s: [0.5, 0.26, 0.32] })
  }
  // pink benches (the IT friend's is placed in world space, below)
  p.push(...bench([3.8, 0, 5.4], 0.2, '#e79aa6', '#b8b2a8', 1.2, 'paint'))
  // modern lamp posts with round globes
  for (const [x, z] of [
    [-4.8, 1.5],
    [2.4, 6.9],
    [5.0, 1.6],
  ]) {
    p.push(box(0.2, 0.1, 0.2, [x, 0.05, z], '#9aa0a8'))
    p.push(cyl(0.035, 3.0, [x, 1.55, z], '#6f757d', 'gloss'))
    for (const s of [-1, 1]) {
      p.push(cyl(0.015, 0.4, [x + s * 0.18, 3.0, z], '#6f757d', 'gloss', [0, 0, Math.PI / 2]))
      p.push({ g: G.sphere, c: '#fff4d8', m: 'paperLit', p: [x + s * 0.36, 2.94, z], s: 0.12 })
    }
  }
  // scooters parked by the side entrance
  const cols = ['#f2f2ee', '#c8352e', '#2f5fa8', '#1f2025', '#e6b8c8']
  cols.forEach((c, i) => p.push(...offsetParts(scooter(c), [3.3 + i * 0.62, 0, 1.3 + (i % 2) * 0.1], Math.PI + 0.08 * (i - 2))))
  // the flagpole
  p.push(...flagpole([FLAG[0], 0, FLAG[1]], 3.9))
  // a campus notice board
  p.push(...offsetParts([box(1.2, 0.8, 0.06, [0, 1.0, 0], '#2f6e4a', 'paint'), box(1.1, 0.7, 0.02, [0, 1.0, 0.04], '#f3efe2', 'plaster'), cyl(0.03, 1.4, [-0.5, 0.7, 0], '#6f757d', 'gloss'), cyl(0.03, 1.4, [0.5, 0.7, 0], '#6f757d', 'gloss')], [-4.6, 0, 6.6], 0.5))
  return p
}

const FLAG: [number, number] = [-1.3, 2.3]
/** everything above, moved into place beside the lane */
const toWorld = (parts: Part[]) => offsetParts(parts, [THIENLY.xf, 0, THIENLY.zc], THIENLY.ry)

export function Campus() {
  const sign = useMemo(() => signTex(PLAQUES.campusSign, { w: 2048, h: 96, color: '#1f8a4c', weight: 900, spacing: 6 }), [])
  const name = useMemo(() => signTex(PLAQUES.thienLy, { w: 512, h: 96, color: '#1f8a4c', weight: 900, spacing: 8 }), [])
  const H = T.floor * T.floors + 0.72
  const bay = T.w / BAYS
  const px = -T.w / 2 + 3 * bay
  const flag = campusToWorld(...FLAG)
  return (
    <group>
      <KitMesh build={() => toWorld(buildingParts())} />
      <KitMesh build={() => toWorld(plazaParts())} />
      <KitMesh build={() => bench([UNI_BENCH.x, 0, UNI_BENCH.z], UNI_BENCH.ry, '#e79aa6', '#b8b2a8', 1.2, 'paint')} />
      <group position={[THIENLY.xf, 0, THIENLY.zc]} rotation-y={THIENLY.ry}>
        <Sign map={sign} w={T.w * 0.78} h={0.36} position={[0, H + 0.3, 0.06]} />
        <Sign map={name} w={1.2} h={0.22} position={[px, 1.62, 0.52]} />
      </group>
      <Flags spots={[flag]} kind="vn" h={3.9} ry={THIENLY.ry + Math.PI / 2} />
    </group>
  )
}

/** Tree spots on campus: phượng vĩ (the graduation tree) and tall shade trees. */
export const CAMPUS_TREES: { x: number; z: number; s: number; kind: 'phuong' | 'green' }[] = [
  { x: -3.6, z: -3.2, s: 1.05, kind: 'phuong' },
  { x: 2.2, z: -0.9, s: 1.0, kind: 'phuong' },
  { x: 1.9, z: -12.4, s: 1.1, kind: 'phuong' },
  { x: -5.6, z: -10.4, s: 1.2, kind: 'green' },
  { x: 14.6, z: -12.6, s: 1.25, kind: 'green' },
  { x: 13.8, z: 1.4, s: 1.0, kind: 'green' },
  { x: -8.2, z: -4.8, s: 1.05, kind: 'phuong' },
]
