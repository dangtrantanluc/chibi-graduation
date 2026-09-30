import * as THREE from 'three'
import { useMemo } from 'react'
import { G, offsetParts, rng, type Part } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { canvas, FONT_CJK, toTexture } from '../lib/textures'
import { taperTube } from '../characters/hair'
import { BENCH, BOARD, CHAM, GATE, PADDY } from '../layout'
import { PLAQUES } from '../../config'
import { bench, box, cyl, dragon, lotusBud, plinth } from './parts'
import { Couplet, Sign } from './Common'

/*
 * I · BÌNH ĐỊNH — Lực's home.
 * Cổng thành Hoàng Đế (An Nhơn) after the photograph: two tall ochre pillars
 * inlaid with red lozenge tiles and crowned by lantern caps; round columns
 * wrapped by mosaic dragons flanking the central opening; a lintel of
 * seal-script characters under a fan-shaped crest; latticed side bays with
 * dragons climbing their beams; outer pillars carrying red couplet panels;
 * dark, moss-streaked laterite walls running off to both sides.
 * Around it: Tháp Cánh Tiên (the Cham tower inside the old citadel), coconut
 * palms, a strip of rice paddy with haystacks and a field hut, a lotus pond,
 * and the stone bench where Lực sits.
 */

const OCHRE = '#d4ad4c'
const DARK = '#524c46'
const PINK = '#c7a097'
const LATERITE = '#4d4741'

// ── painted panels ──────────────────────────────────────────
/** Yellow pillar face inlaid with a column of red lozenge tiles. */
function lozengeTex(n: number) {
  const W = 128
  const H = 128 * n
  const [c, g] = canvas(W, H)
  g.fillStyle = OCHRE
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(120,80,20,0.1)' : 'rgba(255,240,190,0.12)'
    g.fillRect(Math.random() * W, Math.random() * H, 3, 2)
  }
  for (let i = 0; i < n; i++) {
    const cy = 64 + i * 128
    const dia = (r: number, fill: string) => {
      g.fillStyle = fill
      g.beginPath()
      g.moveTo(64, cy - r)
      g.lineTo(64 + r * 0.82, cy)
      g.lineTo(64, cy + r)
      g.lineTo(64 - r * 0.82, cy)
      g.closePath()
      g.fill()
    }
    dia(60, '#efe6d2')
    dia(52, '#b8352c')
    dia(38, '#efe6d2')
    dia(32, '#b8352c')
    g.fillStyle = '#efe6d2'
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      g.beginPath()
      g.ellipse(64 + Math.cos(a) * 12, cy + Math.sin(a) * 14, 5, 8, a, 0, Math.PI * 2)
      g.fill()
    }
    g.beginPath()
    g.arc(64, cy, 5, 0, Math.PI * 2)
    g.fillStyle = '#e8c267'
    g.fill()
  }
  return toTexture(c)
}

/** The gate's lintel: seal-style characters in red on white, in a lattice frame. */
function sealTex() {
  const [c, g] = canvas(768, 192)
  g.fillStyle = '#2d2a27'
  g.fillRect(0, 0, 768, 192)
  g.fillStyle = '#efe9dd'
  g.fillRect(18, 18, 732, 156)
  g.strokeStyle = '#b8352c'
  g.lineWidth = 6
  g.strokeRect(30, 30, 708, 132)
  // key-fret borders at both ends
  g.lineWidth = 5
  for (const x0 of [42, 666]) {
    g.beginPath()
    g.moveTo(x0, 150)
    g.lineTo(x0, 42)
    g.lineTo(x0 + 60, 42)
    g.lineTo(x0 + 60, 130)
    g.lineTo(x0 + 18, 130)
    g.lineTo(x0 + 18, 64)
    g.lineTo(x0 + 42, 64)
    g.lineTo(x0 + 42, 108)
    g.stroke()
  }
  g.fillStyle = '#b8352c'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `118px ${FONT_CJK}`
  const t = [...PLAQUES.hoangDe]
  t.forEach((ch, i) => g.fillText(ch, 384 + (i - (t.length - 1) / 2) * 160, 100))
  return toTexture(c)
}

/** Openwork transom for the side bays (dark frame, pale key-fret lattice). */
function latticeTex() {
  const [c, g] = canvas(256, 96)
  g.clearRect(0, 0, 256, 96)
  g.strokeStyle = '#2f2b28'
  g.lineWidth = 10
  g.strokeRect(5, 5, 246, 86)
  g.strokeStyle = '#6c655c'
  g.lineWidth = 6
  for (let x = 20; x < 240; x += 44) {
    g.beginPath()
    g.moveTo(x, 78)
    g.lineTo(x, 20)
    g.lineTo(x + 30, 20)
    g.lineTo(x + 30, 60)
    g.lineTo(x + 12, 60)
    g.lineTo(x + 12, 38)
    g.stroke()
  }
  return toTexture(c)
}

// ═══════════════════════════════════════════════════════════
//  the gate
// ═══════════════════════════════════════════════════════════
const CP = 1.25 // central pillar x
const OP = 3.2 // outer pillar x
const RC = 2.72 // round column x (side bay)
const DC = 0.92 // dragon column x

/** a square pillar: dark body, capital mouldings, a lantern-box cap and a finial */
function squarePillar(x: number, w: number, h: number, tall: boolean): Part[] {
  const z = 0
  const p: Part[] = [
    ...plinth(x, z, w, w, 0, [
      [0.36, 0.12],
      [0.26, 0.2],
      [0.18, 0.1],
    ], PINK),
  ]
  const y0 = 0.42
  p.push(box(w, h - y0, w, [x, y0 + (h - y0) / 2, z], DARK, 'aged'))
  // capital: stepped mouldings, a lantern box with little windows, a stepped roof
  let y = h
  for (const [grow, hh] of [
    [0.08, 0.08],
    [0.16, 0.06],
  ] as const) {
    p.push(box(w + grow, hh, w + grow, [x, y + hh / 2, z], '#6b645b', 'aged'))
    y += hh
  }
  const lb = tall ? 0.42 : 0.3
  p.push(box(w - 0.02, lb, w - 0.02, [x, y + lb / 2, z], OCHRE, 'aged'))
  for (const [fx, fz, ry] of [
    [0, w / 2, 0],
    [0, -w / 2, Math.PI],
    [w / 2, 0, Math.PI / 2],
    [-w / 2, 0, -Math.PI / 2],
  ] as const) {
    const win = offsetParts([box(w * 0.5, lb * 0.55, 0.03, [0, 0, 0], '#3a3531', 'aged'), box(w * 0.5, 0.025, 0.04, [0, 0, 0.005], '#a89e8e', 'aged'), box(0.025, lb * 0.55, 0.04, [0, 0, 0.005], '#a89e8e', 'aged')], [x + fx, y + lb / 2, z + fz], ry)
    p.push(...win)
  }
  y += lb
  for (const [grow, hh] of [
    [0.2, 0.06],
    [0.1, 0.06],
    [-0.04, 0.08],
  ] as const) {
    p.push(box(w + grow, hh, w + grow, [x, y + hh / 2, z], '#6b645b', 'aged'))
    y += hh
  }
  if (tall) {
    // a little stupa finial with curling corner leaves
    p.push(box(w * 0.6, 0.16, w * 0.6, [x, y + 0.08, z], OCHRE, 'aged'))
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      p.push({ g: G.cone, c: '#6b645b', m: 'aged', p: [x + sx * w * 0.36, y + 0.2, z + sz * w * 0.36], r: [sz * 0.5, 0, -sx * 0.5], s: [0.04, 0.14, 0.04] })
    p.push(...lotusBud(x, y + 0.16, z, 1.1, '#6b645b'))
  } else {
    p.push({ g: G.sphere, c: '#6b645b', m: 'aged', p: [x, y + 0.14, z], s: [0.14, 0.16, 0.14] })
    p.push({ g: G.cone, c: '#6b645b', m: 'aged', p: [x, y + 0.34, z], s: [0.06, 0.16, 0.06] })
  }
  return p
}

/** round column wrapped by a coiling mosaic dragon (red body, white belly scales) */
function dragonColumn(x: number, h: number): Part[] {
  const z = 0.02
  const p: Part[] = [
    ...plinth(x, z, 0.26, 0.26, 0, [
      [0.16, 0.12],
      [0.08, 0.14],
    ], PINK),
    cyl(0.12, h - 0.26, [x, 0.26 + (h - 0.26) / 2, z], '#c9c1b2', 'aged'),
    box(0.3, 0.08, 0.3, [x, h + 0.04, z], '#6b645b', 'aged'),
  ]
  const pts: THREE.Vector3[] = []
  const turns = 3.2
  for (let k = 0; k <= 40; k++) {
    const t = k / 40
    const a = t * Math.PI * 2 * turns + (x > 0 ? Math.PI : 0)
    pts.push(new THREE.Vector3(x + Math.cos(a) * 0.15, 0.4 + t * (h - 0.75), z + Math.sin(a) * 0.15))
  }
  p.push({ g: taperTube(pts, 0.045, 0.075, 90, 7), c: '#c4453a', m: 'ceramic' })
  for (let k = 2; k < 40; k += 2) p.push({ g: G.sphereXs, c: k % 4 ? '#f2ede2' : '#3f9a6b', m: 'ceramic', p: [pts[k].x, pts[k].y + 0.05, pts[k].z], s: 0.03 })
  // the head rears at the top, facing the opening
  const top = pts[pts.length - 1]
  const dir = x > 0 ? -1 : 1
  p.push({ g: G.sphere, c: '#c4453a', m: 'ceramic', p: [top.x + dir * 0.06, top.y + 0.12, top.z + 0.1], s: [0.1, 0.08, 0.13] })
  p.push({ g: G.sphere, c: '#f2ede2', m: 'ceramic', p: [top.x + dir * 0.06, top.y + 0.08, top.z + 0.2], s: [0.06, 0.04, 0.06] })
  for (const s of [-1, 1]) p.push({ g: G.cone, c: '#e0b04a', m: 'gold', p: [top.x + dir * 0.06 + s * 0.04, top.y + 0.22, top.z + 0.04], r: [-0.6, 0, s * 0.3], s: [0.02, 0.12, 0.02] })
  return p
}

function gateParts(): Part[] {
  const p: Part[] = []
  // central pillars (the tallest), outer pillars
  for (const s of [-1, 1]) {
    p.push(...squarePillar(s * CP, 0.44, 3.85, true))
    p.push(...squarePillar(s * OP, 0.38, 2.9, false))
    p.push(...dragonColumn(s * DC, 2.75))
    // grey round column in each side bay, with a bulb capital
    p.push(...plinth(s * RC, 0.02, 0.24, 0.24, 0, [[0.14, 0.14]], PINK))
    p.push(cyl(0.11, 2.3, [s * RC, 0.14 + 1.15, 0.02], '#a49c90', 'aged'))
    p.push({ g: G.sphere, c: '#7b746a', m: 'aged', p: [s * RC, 2.52, 0.02], s: [0.16, 0.1, 0.16] })
    // side-bay frame: two dark beams with a latticed transom between (lattice is a textured plane)
    const bx = (CP + OP) / 2 * s
    const bw = OP - CP - 0.38
    p.push(box(bw, 0.12, 0.2, [bx, 2.35, 0], '#35312d', 'aged'))
    p.push(box(bw, 0.14, 0.22, [bx, 2.84, 0], '#35312d', 'aged'))
    p.push(box(bw + 0.1, 0.05, 0.28, [bx, 2.93, 0], '#5c554c', 'aged'))
    // a mosaic dragon climbs each side beam toward the centre
    p.push(...dragon(s * (CP + 0.55), 2.93, 0, s, 1.25, '#3f8f6f', 0.95))
    // and a small phoenix-crest on the outer pillar side
    p.push({ g: G.sphere, c: '#c4453a', m: 'ceramic', p: [s * (OP - 0.45), 3.1, 0], s: [0.1, 0.07, 0.06] })
    for (let k = 0; k < 4; k++) p.push({ g: G.cone, c: k % 2 ? '#e0b04a' : '#3f9a6b', m: 'ceramic', p: [s * (OP - 0.45 - 0.1 * k), 3.18 + k * 0.02, 0], r: [0, 0, s * (0.9 + k * 0.2)], s: [0.03, 0.2, 0.02] })
  }
  // central lintel: a dark frame holding the seal-script panel
  p.push(box(2.1, 0.12, 0.34, [0, 3.0, 0], '#35312d', 'aged'))
  p.push(box(2.1, 0.62, 0.26, [0, 3.36, 0], '#35312d', 'aged'))
  p.push(box(2.2, 0.08, 0.36, [0, 3.71, 0], '#5c554c', 'aged'))
  // hổ phù crest: a fan of rays around a sun disc, on a little stepped base
  p.push(box(0.6, 0.12, 0.2, [0, 3.81, 0], '#5c554c', 'aged'))
  const fan = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 18, 1, false, -Math.PI / 2, Math.PI)
  fan.rotateX(Math.PI / 2)
  fan.rotateZ(Math.PI / 2)
  p.push({ g: fan, c: '#7d766c', m: 'aged', p: [0, 3.87, 0], r: [0, 0, 0] })
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI
    p.push({ g: G.cone, c: '#6b645b', m: 'aged', p: [Math.cos(a) * 0.52, 3.87 + Math.sin(a) * 0.52, 0], r: [0, 0, a - Math.PI / 2], s: [0.05, 0.16, 0.04] })
  }
  p.push({ g: G.sphere, c: '#d9c7a0', m: 'aged', p: [0, 4.07, 0.05], s: [0.13, 0.13, 0.07] })
  p.push({ g: G.sphereLo, c: '#c4453a', m: 'ceramic', p: [0, 4.07, 0.1], s: 0.05 })
  // a lamp on a bracket above the crest (as in the photo)
  p.push(cyl(0.012, 0.3, [0.28, 4.25, 0.02], '#2f2b28', 'gloss'))
  p.push({ g: G.sphere, c: '#f0ead8', m: 'paperLit', p: [0.28, 4.44, 0.04], s: [0.07, 0.05, 0.07] })
  return offsetParts(p, [0, GATE.y, GATE.z])
}

/** dark laterite walls, stepped caps, and a big dragon on each wall head */
function wallParts(): Part[] {
  const p: Part[] = []
  const H = 1.95
  for (const s of [-1, 1]) {
    const x0 = OP + 0.19
    const x1 = BOARD.maxX - 0.3
    const len = x1 - x0
    const cx = s * (x0 + len / 2)
    p.push(box(len, H, 0.5, [cx, H / 2, GATE.z], LATERITE, 'aged'))
    p.push(box(len + 0.02, 0.3, 0.6, [cx, 0.15, GATE.z], '#3f3a35', 'aged'))
    p.push(box(len, 0.12, 0.62, [cx, H + 0.06, GATE.z], '#6b645b', 'aged'))
    p.push(box(len, 0.1, 0.46, [cx, H + 0.17, GATE.z], '#5c554c', 'aged'))
    // pilasters every few metres
    for (let x = x0 + 2.2; x < x1 - 0.5; x += 3.2) p.push(box(0.3, H + 0.05, 0.6, [s * x, (H + 0.05) / 2, GATE.z], '#58514a', 'aged'))
    // wall head: a stepped block carrying a rearing dragon, facing outward
    p.push(box(0.7, H + 0.25, 0.72, [s * (x0 + 0.35), (H + 0.25) / 2, GATE.z], '#58514a', 'aged'))
    const d = dragon(s * (x0 + 0.2), H + 0.25, GATE.z, s, 1.1, '#6f8a74', 1.25)
    p.push(...d.map((q) => ({ ...q, m: 'aged' as const })))
  }
  return p
}

// ═══════════════════════════════════════════════════════════
//  Tháp Cánh Tiên — a Cham brick tower (kalan)
// ═══════════════════════════════════════════════════════════
function chamTower(): Part[] {
  const BR = '#9a5a45'
  const BR2 = '#86503e'
  const p: Part[] = []
  p.push(...plinth(0, 0, 2.6, 2.6, 0, [
    [0.5, 0.18],
    [0.25, 0.22],
  ], '#8f7f6f'))
  // one storey: a square body with pilasters and a false door on every face
  const storey = (y: number, w: number, h: number, door: boolean) => {
    p.push(box(w, h, w, [0, y + h / 2, 0], BR, 'aged'))
    for (const [fx, fz, ry] of [
      [0, 1, 0],
      [0, -1, Math.PI],
      [1, 0, Math.PI / 2],
      [-1, 0, -Math.PI / 2],
    ] as const) {
      const face: Part[] = []
      // pilasters
      for (const px of [-0.42, -0.26, 0.26, 0.42]) face.push(box(0.08 * w, h * 0.92, 0.06, [px * w, 0, 0.02], BR2, 'aged'))
      // false door: stacked frames under a flame-shaped (lotus-petal) pediment
      if (door) {
        for (const [dw, dh, dz] of [
          [0.3, 0.6, 0.06],
          [0.24, 0.55, 0.1],
          [0.17, 0.5, 0.13],
        ] as const)
          face.push(box(dw * w, dh * h, 0.04, [0, -h * 0.12, dz], dz > 0.1 ? '#6e3c2e' : BR2, 'aged'))
        const flame = new THREE.CylinderGeometry(0.2 * w, 0.2 * w, 0.05, 3)
        flame.rotateX(Math.PI / 2)
        face.push({ g: flame, c: BR2, m: 'aged', p: [0, h * 0.27, 0.08], r: [0, 0, Math.PI / 2] })
        face.push({ g: G.cone, c: BR2, m: 'aged', p: [0, h * 0.44, 0.07], s: [0.06 * w, 0.2 * h, 0.04] })
      }
      // cornice band
      face.push(box(w * 1.02, 0.06, 0.08, [0, h / 2 - 0.04, 0.03], '#b06a52', 'aged'))
      p.push(...offsetParts(face, [fx * (w / 2), y + h / 2, fz * (w / 2)], ry))
    }
    // corner ornaments: miniature towers
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      p.push(box(0.14 * w, 0.2 * h, 0.14 * w, [sx * w * 0.45, y + h + 0.1 * h, sz * w * 0.45], BR, 'aged'))
      p.push({ g: G.cone, c: BR2, m: 'aged', p: [sx * w * 0.45, y + h + 0.28 * h, sz * w * 0.45], s: [0.08 * w, 0.18 * h, 0.08 * w] })
    }
    p.push(box(w * 1.06, 0.1, w * 1.06, [0, y + h + 0.05, 0], '#b06a52', 'aged'))
  }
  storey(0.4, 2.1, 2.5, true)
  storey(2.95, 1.55, 1.0, true)
  storey(4.05, 1.15, 0.72, true)
  storey(4.87, 0.82, 0.5, false)
  // stone finial
  p.push({ g: G.sphere, c: '#a89c8a', m: 'aged', p: [0, 5.6, 0], s: [0.22, 0.2, 0.22] })
  p.push({ g: G.cone, c: '#a89c8a', m: 'aged', p: [0, 5.88, 0], s: [0.12, 0.32, 0.12] })
  // a vestibule on the east face (toward the path)
  const ves: Part[] = [
    box(0.9, 1.6, 0.8, [0, 1.2, 0], BR, 'aged'),
    box(0.44, 1.05, 0.1, [0, 0.93, 0.36], '#2e211c', 'aged'),
    box(1.0, 0.1, 0.9, [0, 2.05, 0], '#b06a52', 'aged'),
    { g: G.cone, c: BR2, m: 'aged', p: [0, 2.35, 0], s: [0.34, 0.5, 0.3] },
  ]
  p.push(...offsetParts(ves, [1.4, 0, 0], Math.PI / 2))
  return offsetParts(p, [CHAM.x, 0, CHAM.z], -0.35)
}

// ═══════════════════════════════════════════════════════════
//  countryside: paddy dykes, haystacks, a field hut, the bench
// ═══════════════════════════════════════════════════════════
function countryParts(): Part[] {
  const p: Part[] = []
  // dykes (bờ ruộng) between paddy plots
  for (let x = PADDY.x0; x <= PADDY.x1 + 0.01; x += (PADDY.x1 - PADDY.x0) / 3) p.push(box(0.22, 0.1, PADDY.z1 - PADDY.z0, [x, 0.05, (PADDY.z0 + PADDY.z1) / 2], '#8b9a58', 'ground'))
  for (const z of [PADDY.z0, (PADDY.z0 + PADDY.z1) / 2, PADDY.z1]) p.push(box(PADDY.x1 - PADDY.x0, 0.1, 0.22, [(PADDY.x0 + PADDY.x1) / 2, 0.05, z], '#8b9a58', 'ground'))
  // haystacks (đụn rơm): a round stack with a domed top, a pole through it, rope bands
  for (const [x, z, sc] of [
    [PADDY.x0 - 1.4, PADDY.z0 + 0.6, 1],
    [PADDY.x1 + 0.2, PADDY.z1 + 0.6, 0.8],
  ] as const) {
    const hay: Part[] = [
      { g: new THREE.CylinderGeometry(0.5, 0.56, 0.6, 16), c: '#d6ad58', m: 'foliage', p: [0, 0.3, 0] },
      { g: G.sphere, c: '#dcb862', m: 'foliage', p: [0, 0.6, 0], s: [0.53, 0.5, 0.53] },
      { g: G.cone, c: '#c9a04e', m: 'foliage', p: [0, 1.08, 0], s: [0.2, 0.22, 0.2] },
      cyl(0.022, 0.5, [0, 1.3, 0], '#8a6a3a', 'wood'),
      { g: new THREE.TorusGeometry(0.52, 0.02, 4, 24), c: '#9a7a3a', m: 'wood', p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0] },
      { g: new THREE.TorusGeometry(0.47, 0.02, 4, 24), c: '#9a7a3a', m: 'wood', p: [0, 0.8, 0], r: [Math.PI / 2, 0, 0] },
    ]
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      hay.push({ g: G.cone, c: '#e4c36e', m: 'foliage', p: [Math.cos(a) * 0.54, 0.06, Math.sin(a) * 0.54], r: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], s: [0.05, 0.14, 0.05] })
    }
    p.push(...offsetParts(hay, [x, 0, z], 0, sc))
  }
  // chòi canh — a stilted thatched field hut at the far corner
  const hut: Part[] = []
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])
    hut.push(cyl(0.05, 1.7, [sx * 0.55, 0.85, sz * 0.5], '#8a6a3a', 'wood'))
  hut.push(box(1.3, 0.08, 1.2, [0, 0.85, 0], '#b08a52', 'wood'))
  for (let i = 0; i < 8; i++) hut.push(box(1.3, 0.02, 0.1, [0, 0.9, -0.52 + i * 0.15], '#c9a46a', 'wood'))
  const roof = new THREE.ConeGeometry(1.1, 0.9, 4, 1)
  roof.rotateY(Math.PI / 4)
  hut.push({ g: roof, c: '#c9a45a', m: 'foliage', p: [0, 2.05, 0], s: [1.15, 1, 1.05] })
  hut.push({ g: roof, c: '#b58f4a', m: 'foliage', p: [0, 1.97, 0], s: [1.2, 0.9, 1.1] })
  hut.push(box(0.08, 0.8, 0.08, [0.55, 0.4, 0.8], '#8a6a3a', 'wood', [0.5, 0, 0]))
  p.push(...offsetParts(hut, [PADDY.x1 - 1.2, 0, PADDY.z1 - 1.4], 0.3))
  // Lực's stone bench under the gate, and a low stone planter
  p.push(...bench([BENCH.x, 0, BENCH.z], 0, '#d9d3c7', '#b9b1a3', 1.15))
  p.push(...bench([-1.9, 0, 7.6], 0, '#d9d3c7', '#b9b1a3', 1.15))
  // Bình Định's coconut-shell water jars by the hut
  const r = rng(71)
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.LatheGeometry(
      [
        [0.0, 0],
        [0.16, 0.02],
        [0.22, 0.18],
        [0.2, 0.32],
        [0.12, 0.38],
        [0.13, 0.42],
      ].map(([a, b]) => new THREE.Vector2(a, b)),
      14,
    )
    p.push({ g: jar, c: r() < 0.5 ? '#7a4a34' : '#8a5a3c', m: 'ceramic', p: [PADDY.x1 - 2.3 + i * 0.42, 0, PADDY.z1 - 0.3], s: 0.9 + r() * 0.3 })
  }
  return p
}

export function BinhDinh() {
  const loz = useMemo(() => ({ big: lozengeTex(7), small: lozengeTex(5) }), [])
  const seal = useMemo(() => sealTex(), [])
  const lat = useMemo(() => latticeTex(), [])
  const faceMat = useMemo(() => {
    const mk = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.85 })
    return { big: mk(loz.big), small: mk(loz.small) }
  }, [loz])
  // the ochre panels on the pillar faces (front + back of each pillar)
  const faces = useMemo(() => {
    const out: { p: [number, number, number]; ry: number; w: number; h: number; big: boolean }[] = []
    for (const s of [-1, 1]) {
      for (const f of [1, -1]) {
        out.push({ p: [s * CP, GATE.y + 0.42 + (3.85 - 0.42) / 2, GATE.z + f * 0.225], ry: f > 0 ? 0 : Math.PI, w: 0.32, h: 3.25, big: true })
        out.push({ p: [s * CP + f * 0.225, GATE.y + 0.42 + (3.85 - 0.42) / 2, GATE.z], ry: f > 0 ? Math.PI / 2 : -Math.PI / 2, w: 0.32, h: 3.25, big: true })
      }
    }
    return out
  }, [])
  return (
    <group>
      <KitMesh build={gateParts} />
      <KitMesh build={wallParts} />
      <KitMesh build={chamTower} />
      <KitMesh build={countryParts} />
      {faces.map((f, i) => (
        <mesh key={i} position={f.p} rotation-y={f.ry} material={f.big ? faceMat.big : faceMat.small}>
          <planeGeometry args={[f.w, f.h]} />
        </mesh>
      ))}
      {/* seal-script lintel, both faces */}
      <Sign map={seal} w={1.86} h={0.48} position={[0, GATE.y + 3.36, GATE.z + 0.135]} transparent={false} />
      <Sign map={seal} w={1.86} h={0.48} position={[0, GATE.y + 3.36, GATE.z - 0.135]} ry={Math.PI} transparent={false} />
      {/* latticed transoms in the side bays */}
      {[-1, 1].flatMap((s) =>
        [1, -1].map((f) => <Sign key={`${s}${f}`} map={lat} w={OP - CP - 0.42} h={0.36} position={[((CP + OP) / 2) * s, GATE.y + 2.595, GATE.z + f * 0.05]} ry={f > 0 ? 0 : Math.PI} />),
      )}
      {/* red couplet panels on the outer pillars */}
      <Couplet text={PLAQUES.hoangDeLeft} style="binhdinh" w={0.24} h={1.55} position={[-OP, GATE.y + 1.62, GATE.z + 0.195]} />
      <Couplet text={PLAQUES.hoangDeRight} style="binhdinh" w={0.24} h={1.55} position={[OP, GATE.y + 1.62, GATE.z + 0.195]} />
      <Couplet text={PLAQUES.hoangDeRight} style="binhdinh" w={0.24} h={1.55} position={[-OP, GATE.y + 1.62, GATE.z - 0.195]} ry={Math.PI} />
      <Couplet text={PLAQUES.hoangDeLeft} style="binhdinh" w={0.24} h={1.55} position={[OP, GATE.y + 1.62, GATE.z - 0.195]} ry={Math.PI} />
    </group>
  )
}

/** Rice-plant tufts for the paddies: short, bright green-gold. */
export const RICE: [number, number, number][] = (() => {
  const r = rng(404)
  const out: [number, number, number][] = []
  for (let x = PADDY.x0 + 0.35; x < PADDY.x1 - 0.2; x += 0.52)
    for (let z = PADDY.z0 + 0.35; z < PADDY.z1 - 0.2; z += 0.46) {
      if (Math.abs(((x - PADDY.x0) % ((PADDY.x1 - PADDY.x0) / 3)) - 0) < 0.25) continue
      out.push([x + (r() - 0.5) * 0.08, z + (r() - 0.5) * 0.08, 0.8 + r() * 0.35])
    }
  return out
})()

export const riceKit = (): Part[] => {
  const p: Part[] = []
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    p.push({ g: G.coneLo, c: k % 2 ? '#9cbc4a' : '#b7c95a', m: 'foliage', p: [Math.cos(a) * 0.03, 0.16, Math.sin(a) * 0.03], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], s: [0.024, 0.34, 0.024] })
  }
  // a drooping golden ear of rice
  p.push({ g: G.coneLo, c: '#e2c35a', m: 'foliage', p: [0.06, 0.3, 0], r: [0, 0, 2.2], s: [0.022, 0.12, 0.022] })
  return p
}
