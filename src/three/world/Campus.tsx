import * as THREE from 'three'
import { useMemo } from 'react'
import { G, blob, offsetParts, rng, type Part } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { hipRoof } from '../lib/roof'
import { canvas, signTex, toTexture } from '../lib/textures'
import { RANGDONG, UNI_BENCH, campusToWorld } from '../layout'
import { PLAQUES } from '../../config'
import { C, bench, box, cyl, flagpole } from './parts'
import { Flags } from './Common'

/*
 * II · ĐH NÔNG LÂM TP.HCM — Giảng đường Rạng Đông, after the photographs:
 * an old four-storey lecture hall in faded butter-yellow. Two long wings of
 * open corridors behind white balustrades and slim white columns, red-tiled
 * awnings over the ground-floor windows, a terracotta skirting; in the middle
 * a taller cream block with a curved bay of brown-framed glass rising three
 * floors, "GIẢNG ĐƯỜNG RẠNG ĐÔNG" in blue letters on its band, a white
 * front-facing gable on top; at its foot a porch under brown tiles with a
 * weathered orange frame standing in front. Before it a round shrub island in
 * the drive, concrete benches, old lamp posts and the flag.
 */

const T = RANGDONG
const H = T.floor * T.floors
const TW = 3.0 // central block width
const TF = 0.3 // central block front (it stands a little proud of the corridors)
const WING = (T.w - TW) / 2
const YELLOW = '#ecd896'
const CREAM = '#efe7d2'
const WHITE = '#f3f0e6'
const TERRA = '#c9825a'
const CORR = 0.9 // corridor depth
/** height of the curved band that carries the building's name (third floor, above the porch) */
const SIGN_Y = T.floor * 2 + 0.72

/** the inner wall of an open corridor: windows and doors in brown frames */
function corridorWallTex(ground: boolean) {
  const W = 1024
  const Hh = 192
  const [c, g] = canvas(W, Hh)
  g.fillStyle = YELLOW
  g.fillRect(0, 0, W, Hh)
  const r = rng(ground ? 17 : 23)
  // faded paint, damp stains running down from the slab
  for (let i = 0; i < 40; i++) {
    const x = r() * W
    const grd = g.createLinearGradient(0, 0, 0, Hh)
    grd.addColorStop(0, 'rgba(120,100,50,0.2)')
    grd.addColorStop(1, 'rgba(120,100,50,0)')
    g.fillStyle = grd
    g.fillRect(x, 0, 6 + r() * 26, Hh * (0.3 + r() * 0.6))
  }
  const bays = 4
  const bw = W / bays
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw
    const door = (b + (ground ? 1 : 0)) % 2 === 0
    if (door) {
      // a panelled wooden door with a glazed top, and a vent grille above it
      g.fillStyle = '#6e4630'
      g.fillRect(x0 + bw * 0.18, 40, bw * 0.3, Hh - 48)
      g.fillStyle = '#9fb6c6'
      g.fillRect(x0 + bw * 0.21, 50, bw * 0.24, 40)
      g.strokeStyle = '#4a2e20'
      g.lineWidth = 3
      g.strokeRect(x0 + bw * 0.21, 100, bw * 0.24, 70)
      for (let k = 0; k < 6; k++) {
        g.fillStyle = 'rgba(90,70,40,0.55)'
        g.fillRect(x0 + bw * 0.19 + k * 12, 18, 8, 14)
      }
    }
    // a window of 2 × 3 panes, brown frame, pale blue glass
    const wx = x0 + (door ? bw * 0.56 : bw * 0.22)
    const ww = door ? bw * 0.34 : bw * 0.56
    g.fillStyle = '#7a4a2e'
    g.fillRect(wx, 48, ww, 92)
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const pw = (ww - 16) / 3
        g.fillStyle = (i + j) % 2 ? '#a9bfcf' : '#95afc2'
        g.fillRect(wx + 4 + i * (pw + 4), 52 + j * 43, pw, 39)
      }
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.fillRect(wx + 8, 56, 4, 30)
  }
  // terracotta skirting at the bottom
  g.fillStyle = '#a25a42'
  g.fillRect(0, Hh - 14, W, 14)
  return toTexture(c)
}

function wingParts(side: 1 | -1): Part[] {
  const p: Part[] = []
  const x0 = side * (TW / 2)
  const x1 = side * (T.w / 2)
  const cx = (x0 + x1) / 2
  const len = Math.abs(x1 - x0)
  // the rooms behind the corridors, and the corridor floor slabs
  p.push(box(len, H, T.d - CORR, [cx, H / 2, -CORR - (T.d - CORR) / 2], YELLOW, 'aged'))
  for (let f = 1; f <= T.floors; f++) {
    const y = f * T.floor
    p.push(box(len + 0.02, 0.1, CORR + 0.08, [cx, y, -CORR / 2 + 0.04], WHITE, 'aged'))
  }
  // flat roof with a low parapet, and a gutter line of stains
  p.push(box(len + 0.08, 0.16, T.d + 0.1, [cx, H + 0.08, -T.d / 2 + 0.04], WHITE, 'aged'))
  p.push(box(len + 0.08, 0.12, 0.08, [cx, H + 0.22, 0.05], WHITE, 'aged'))
  // slim white columns along the corridor edge
  const n = 5
  for (let i = 0; i < n; i++) {
    const x = x0 + (side * len * (i + 0.5)) / n
    p.push(box(0.12, H, 0.12, [x, H / 2, -0.02], WHITE, 'aged'))
  }
  // balustrades on the upper corridors: top rail, bottom rail, balusters
  for (let f = 1; f < T.floors; f++) {
    const y = f * T.floor
    p.push(box(len, 0.05, 0.07, [cx, y + 0.44, 0.0], WHITE, 'aged'))
    p.push(box(len, 0.05, 0.06, [cx, y + 0.1, 0.0], WHITE, 'aged'))
    for (let x = Math.min(x0, x1) + 0.06; x < Math.max(x0, x1) - 0.04; x += 0.11) p.push(box(0.024, 0.3, 0.024, [x, y + 0.27, 0.0], WHITE, 'aged'))
  }
  // red-tiled awnings over the ground-floor windows, between the columns
  for (let i = 0; i < n; i++) {
    const x = x0 + (side * len * (i + 0.5)) / n + side * (len / n) * 0.5
    if (i === n - 1) continue
    p.push(box(len / n - 0.14, 0.05, 0.55, [x - side * 0.0, 0.66, 0.12], '#b5563f', 'tile', [0.42, 0, 0]))
  }
  p.push(box(len, 0.06, 0.6, [cx, 0.62, 0.14], '#b5563f', 'tile', [0.42, 0, 0]))
  // terracotta plinth and a step along the corridor
  p.push(box(len, 0.12, CORR + 0.1, [cx, 0.06, -CORR / 2 + 0.05], '#bfb5a2', 'stone'))
  p.push(box(len, 0.08, 0.12, [cx, 0.04, 0.12], '#a25a42', 'aged'))
  return p
}

function blockParts(): Part[] {
  const p: Part[] = []
  const BH = H + 0.9
  const zc = TF - (T.d + TF) / 2
  p.push(box(TW, BH, T.d + TF, [0, BH / 2, zc], CREAM, 'aged'))
  // the curved glass bay rising three floors, banded at each floor
  const R = 0.98
  const y0 = T.floor + 0.1
  const y1 = BH - 0.35
  const glass = new THREE.CylinderGeometry(R, R, y1 - y0, 28, 1, true, -Math.PI / 2, Math.PI)
  p.push({ g: glass, c: '#8fb0c6', m: 'glass', p: [0, (y0 + y1) / 2, TF] })
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI
    p.push(box(0.035, y1 - y0, 0.04, [Math.sin(a) * (R + 0.01), (y0 + y1) / 2, TF + Math.cos(a) * (R + 0.01)], '#7a4a2e', 'paint', [0, a, 0]))
  }
  for (const [y, t, rr] of [
    [y0, 0.12, R + 0.1],
    [y0 + T.floor * 0.5, 0.03, R + 0.02],
    [y0 + T.floor * 1.0, 0.08, R + 0.08],
    [SIGN_Y, 0.26, R + 0.12],
    [y0 + T.floor * 2.2, 0.03, R + 0.02],
    [y1, 0.14, R + 0.12],
  ] as const)
    p.push({ g: new THREE.CylinderGeometry(rr, rr, t, 28, 1, false, -Math.PI / 2, Math.PI), c: t > 0.05 ? CREAM : '#7a4a2e', m: t > 0.05 ? 'aged' : 'paint', p: [0, y, TF] })
  // flat glazed grids either side of the bay
  for (const s of [-1, 1]) {
    p.push(box(0.46, y1 - y0, 0.04, [s * 1.24, (y0 + y1) / 2, TF + 0.01], '#94b1c3', 'glass'))
    for (let k = 0; k <= 3; k++) p.push(box(0.03, y1 - y0, 0.05, [s * (1.02 + k * 0.15), (y0 + y1) / 2, TF + 0.02], '#7a4a2e', 'paint'))
    for (let k = 0; k <= 6; k++) p.push(box(0.46, 0.03, 0.05, [s * 1.24, y0 + (k / 6) * (y1 - y0), TF + 0.02], '#7a4a2e', 'paint'))
  }
  // the front-facing gable: a white triangle with a trim, the roof running back
  const gw = TW + 0.3
  const gh = 1.0
  const tri = new THREE.Shape()
  tri.moveTo(-gw / 2, 0)
  tri.lineTo(gw / 2, 0)
  tri.lineTo(0, gh)
  tri.lineTo(-gw / 2, 0)
  p.push({ g: new THREE.ExtrudeGeometry(tri, { depth: 0.16, bevelEnabled: false }), c: WHITE, m: 'aged', p: [0, BH, TF - 0.1] })
  const slope = Math.atan2(gh, gw / 2)
  const sl = Math.hypot(gh, gw / 2) + 0.12
  for (const s of [-1, 1]) {
    p.push(box(sl, 0.08, T.d + TF + 0.3, [(s * gw) / 4, BH + gh / 2 + 0.02, zc], '#8e8a80', 'stone', [0, 0, -s * slope]))
    // a raised white trim along the gable edge
    p.push(box(sl, 0.1, 0.12, [(s * gw) / 4, BH + gh / 2 + 0.04, TF + 0.1], WHITE, 'aged', [0, 0, -s * slope]))
  }
  p.push(box(gw + 0.2, 0.1, 0.18, [0, BH + 0.02, TF + 0.02], WHITE, 'aged'))
  // entrance doors at the foot of the bay
  p.push(box(1.2, 0.78, 0.04, [0, 0.45, TF + 0.02], '#3a4a4c', 'glass'))
  p.push(box(0.03, 0.78, 0.05, [0, 0.45, TF + 0.04], '#7a4a2e', 'paint'))
  return p
}

/** the porch under brown tiles, and the old orange frame in front of it */
function porchParts(): Part[] {
  const p: Part[] = []
  const z0 = TF + 0.55
  for (const x of [-0.8, 0.8]) for (const z of [z0, z0 + 1.0]) p.push(box(0.14, 1.12, 0.14, [x, 0.56, z], TERRA, 'aged'))
  p.push(...offsetParts(hipRoof({ w: 2.5, d: 1.9, h: 0.42, lift: 0.08, curve: 1.2, tile: '#6e4234', under: '#5a3a2c', fascia: '#3f3028', ridgeColor: '#4a3228', ornaments: false }), [0, 1.2, z0 + 0.5]))
  // the carved (and stained) fascia band under the eaves
  p.push(box(2.3, 0.14, 0.05, [0, 1.12, z0 + 1.42], '#4a3a30', 'aged'))
  p.push(box(2.3, 0.14, 0.05, [0, 1.12, z0 - 0.42], '#4a3a30', 'aged'))
  // the tall orange frame (two posts and a lintel), faded and streaked
  for (const x of [-1.42, 1.42]) p.push(box(0.2, 1.84, 0.22, [x, 0.92, z0 + 1.62], TERRA, 'aged'))
  p.push(box(3.24, 0.22, 0.3, [0, 1.86, z0 + 1.62], '#b56f4c', 'aged'))
  p.push(box(3.3, 0.06, 0.34, [0, 1.99, z0 + 1.62], '#9a5e42', 'aged'))
  // steps
  for (let k = 0; k < 2; k++) p.push(box(2.0 - k * 0.2, 0.06, 0.4, [0, 0.03 + k * 0.06, z0 + 0.8 - k * 0.1], k ? '#d6cdb6' : '#c9bfa6', 'stone'))
  return p
}

/** the drive in front: a round shrub island, benches, lamps, the flagpole */
function plazaParts(): Part[] {
  const p: Part[] = []
  const I = { x: 0.3, z: 4.1, r: 0.95 }
  p.push({ g: new THREE.CylinderGeometry(I.r + 0.55, I.r + 0.6, 0.18, 32, 1, true), c: '#cfc8b6', m: 'aged', p: [I.x, 0.09, I.z] })
  p.push({ g: new THREE.TorusGeometry(I.r + 0.575, 0.05, 5, 36), c: '#ddd6c4', m: 'aged', p: [I.x, 0.18, I.z], r: [Math.PI / 2, 0, 0] })
  p.push({ g: new THREE.CylinderGeometry(I.r + 0.55, I.r + 0.55, 0.12, 32), c: '#6a4a32', m: 'ground', p: [I.x, 0.08, I.z] })
  p.push(cyl(0.07, 0.25, [I.x, 0.2, I.z], C.woodDk, 'wood'))
  // a ring of low shrubs and a few spiky agaves around the clipped centre
  const r = rng(91)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.2
    const d = I.r + 0.25
    p.push({ g: blob(i + 40, 1, 0.15), c: r() < 0.5 ? '#4f8a3f' : '#6a9a48', m: 'foliage', p: [I.x + Math.cos(a) * d, 0.24, I.z + Math.sin(a) * d], s: [0.26, 0.18, 0.26] })
  }
  for (const a of [0.6, 2.4, 4.2]) {
    const ax = I.x + Math.cos(a) * (I.r + 0.3)
    const az = I.z + Math.sin(a) * (I.r + 0.3)
    for (let k = 0; k < 7; k++) {
      const b = (k / 7) * Math.PI * 2
      p.push({ g: G.coneLo, c: '#7fa06a', m: 'foliage', p: [ax + Math.cos(b) * 0.06, 0.32, az + Math.sin(b) * 0.06], r: [Math.sin(b) * 0.7, 0, -Math.cos(b) * 0.7], s: [0.035, 0.34, 0.035] })
    }
  }
  // clipped hedges along the wings
  for (let x = -T.w / 2 + 0.4; x < T.w / 2 - 0.3; x += 0.9) {
    if (Math.abs(x) < 1.9) continue
    p.push({ g: blob(Math.floor(x * 10) + 60, 1, 0.12), c: '#4f8a3f', m: 'foliage', p: [x, 0.22, 0.75], s: [0.46, 0.24, 0.3] })
  }
  // concrete benches painted green, the old campus way
  p.push(...bench([3.9, 0, 5.2], 0.2, '#86a88a', '#b8b2a8', 1.2, 'aged'))
  p.push(...bench([-3.4, 0, 5.8], -0.25, '#86a88a', '#b8b2a8', 1.2, 'aged'))
  // old street lamps: a bent arm and a single shade
  for (const [x, z] of [
    [-4.8, 1.6],
    [2.4, 6.9],
    [5.2, 1.7],
  ]) {
    p.push(box(0.2, 0.12, 0.2, [x, 0.06, z], '#8f8a80', 'aged'))
    p.push(cyl(0.035, 2.8, [x, 1.46, z], '#5f6a66', 'paint'))
    p.push(cyl(0.02, 0.5, [x + 0.22, 2.82, z], '#5f6a66', 'paint', [0, 0, Math.PI / 2 - 0.25]))
    p.push({ g: new THREE.ConeGeometry(0.14, 0.12, 10, 1, true), c: '#5f6a66', m: 'paint', p: [x + 0.45, 2.86, z] })
    p.push({ g: G.sphereLo, c: '#fff1c8', m: 'paperLit', p: [x + 0.45, 2.8, z], s: 0.07 })
  }
  p.push(...flagpole([FLAG[0], 0, FLAG[1]], 3.9))
  // a campus notice board
  p.push(...offsetParts([box(1.2, 0.8, 0.06, [0, 1.0, 0], '#2f6e4a', 'paint'), box(1.1, 0.7, 0.02, [0, 1.0, 0.04], '#f3efe2', 'plaster'), cyl(0.03, 1.4, [-0.5, 0.7, 0], '#6f757d', 'gloss'), cyl(0.03, 1.4, [0.5, 0.7, 0], '#6f757d', 'gloss')], [-4.6, 0, 6.6], 0.5))
  return p
}

const FLAG: [number, number] = [-2.3, 2.3]
/** everything above, moved into place beside the lane */
const toWorld = (parts: Part[]) => offsetParts(parts, [T.xf, 0, T.zc], T.ry)

export function Campus() {
  const name = useMemo(() => signTex(PLAQUES.rangDong, { w: 1024, h: 96, color: '#2f63b8', weight: 900, spacing: 3 }), [])
  const walls = useMemo(() => ({ ground: corridorWallTex(true), upper: corridorWallTex(false) }), [])
  const wallMats = useMemo(() => {
    const mk = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.92 })
    return { ground: mk(walls.ground), upper: mk(walls.upper) }
  }, [walls])
  // the name runs round the curved band of the bay
  const bandGeo = useMemo(() => new THREE.CylinderGeometry(1.105, 1.105, 0.2, 40, 1, true, -Math.PI * 0.36, Math.PI * 0.72), [])
  const bandMat = useMemo(() => new THREE.MeshStandardMaterial({ map: name, transparent: true, alphaTest: 0.3, roughness: 0.6 }), [name])
  const flag = campusToWorld(...FLAG)
  const panels = useMemo(() => {
    const out: { x: number; y: number; w: number; ground: boolean }[] = []
    for (const s of [-1, 1]) for (let f = 0; f < T.floors; f++) out.push({ x: s * (TW / 2 + WING / 2), y: f * T.floor + T.floor / 2 + 0.05, w: WING, ground: f === 0 })
    return out
  }, [])
  return (
    <group>
      <KitMesh build={() => toWorld([...wingParts(-1), ...wingParts(1), ...blockParts(), ...porchParts()])} />
      <KitMesh build={() => toWorld(plazaParts())} />
      <KitMesh build={() => bench([UNI_BENCH.x, 0, UNI_BENCH.z], UNI_BENCH.ry, '#86a88a', '#b8b2a8', 1.2, 'aged')} />
      <group position={[T.xf, 0, T.zc]} rotation-y={T.ry}>
        {panels.map((pn, i) => (
          <mesh key={i} position={[pn.x, pn.y, -CORR + 0.012]} material={pn.ground ? wallMats.ground : wallMats.upper}>
            <planeGeometry args={[pn.w, T.floor - 0.1]} />
          </mesh>
        ))}
        <mesh geometry={bandGeo} material={bandMat} position={[0, SIGN_Y, TF]} />
      </group>
      <Flags spots={[flag]} kind="vn" h={3.9} ry={T.ry + Math.PI / 2} />
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
  { x: 6.6, z: 0.9, s: 1.15, kind: 'green' },
]
