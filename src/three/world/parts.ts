import * as THREE from 'three'
import { G, blob, offsetParts, type Part, type V3 } from '../lib/kit'
import { taperTube } from '../characters/hair'
import { dragonHead, dragonParts, type DragonStyle } from './dragon'

/** Shared palette + small architectural parts used by every region. */
export const C = {
  red: '#b8412f',
  redDk: '#7e2a22',
  gold: '#d9a441',
  plaster: '#f2ede2',
  ochre: '#d9a94a',
  ochreDk: '#b88a38',
  wood: '#6b4630',
  woodDk: '#4a3124',
  woodLt: '#a8764f',
  stone: '#bfb4a2',
  stoneDk: '#948a7b',
  paper: '#f6dfb4',
  hueYellow: '#e4b43c',
  hueGreen: '#4f8a5b',
  hueRed: '#a3302a',
  brick: '#8e8173',
  marble: '#ece6da',
  jade: '#3f8f6f',
  terracotta: '#a8583a',
  terracottaDk: '#7a3f2a',
  laterite: '#5b534c',
}

export const box = (w: number, h: number, d: number, p: V3, c: string, m: Part['m'] = 'stone', r?: V3): Part => ({ g: G.box, c, m, p, r, s: [w, h, d] })
export const cyl = (rad: number, h: number, p: V3, c: string, m: Part['m'] = 'paint', r?: V3): Part => ({ g: G.cyl, c, m, p, r, s: [rad, h, rad] })

/** A round column on a stone base; Huế red columns get the lacquered-dragon material. */
export function column(x: number, y: number, z: number, h: number, rad = 0.17, color = C.red): Part[] {
  const hue = color === C.hueRed
  return [
    cyl(rad * 1.45, 0.16, [x, y + 0.08, z], C.stone, 'stone'),
    hue ? { g: G.cyl, c: '#ffffff', m: 'lacquer', p: [x, y + h / 2, z], s: [rad, h, rad] } : cyl(rad, h, [x, y + h / 2, z], color, 'paint'),
    cyl(rad * 1.08, 0.08, [x, y + h - 0.12, z], C.gold, 'gold'),
    ...(hue ? [cyl(rad * 1.12, 0.1, [x, y + 0.2, z], C.gold, 'gold')] : []),
  ]
}

/** "Khảm sành sứ": a row of glazed ceramic-mosaic beads along a ridge. */
export function mosaic(x0: number, x1: number, y: number, z: number, step = 0.18, r = 0.05): Part[] {
  const cols = ['#2f7fb8', '#f4efe6', '#3f9a6b', '#e6b53a', '#c8412b']
  const p: Part[] = []
  let i = 0
  for (let x = x0; x <= x1 + 1e-3; x += step, i++) p.push({ g: G.sphereXs, c: cols[i % cols.length], m: 'ceramic', p: [x, y, z], s: r })
  return p
}

/** Lattice window: paper panes behind a wooden grid. */
export function windowPane(w: number, h: number, p: V3, ry = 0, frame = C.woodDk, paper = C.paper): Part[] {
  const parts: Part[] = [box(w, h, 0.06, [0, 0, 0], paper, 'paperLit')]
  const n = Math.max(2, Math.round(w / 0.24))
  for (let i = 0; i <= n; i++) parts.push(box(0.03, h, 0.08, [-w / 2 + (i / n) * w, 0, 0.01], frame, 'wood'))
  const m = Math.max(2, Math.round(h / 0.3))
  for (let j = 0; j <= m; j++) parts.push(box(w, 0.03, 0.08, [0, -h / 2 + (j / m) * h, 0.01], frame, 'wood'))
  return offsetParts(parts, p, ry)
}

/**
 * The crowning ornament of a palace roof, in ceramic mosaic: two dragons
 * facing a flaming sun ("lưỡng long chầu nhật", Ngọ Môn) or a wine gourd
 * ("lưỡng long triều hồ lô", Điện Thái Hòa). Each dragon rears its head toward
 * the centre and rides the ridge behind it: Nguyễn dragons (the default — these
 * are Huế roofs) in a few strong humps, the tail lifted in a fan of flame.
 */
export function ridgeDragons(cx: number, y: number, z: number, span: number, body = C.jade, scale = 1, centre: 'sun' | 'gourd' = 'sun', style: DragonStyle = 'nguyen'): Part[] {
  const p: Part[] = []
  const k = scale
  if (centre === 'sun') {
    // a red disc in a gold ring, wreathed in flames, on a little cloud pedestal
    const sy = y + 0.36 * k
    p.push({ g: G.cyl, c: '#c8412b', m: 'paint', p: [cx, sy, z], r: [Math.PI / 2, 0, 0], s: [0.24 * k, 0.07 * k, 0.24 * k] })
    p.push({ g: G.torus, c: C.gold, m: 'gold', p: [cx, sy, z], s: 0.24 * k })
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const long = i % 2 === 0
      p.push({ g: G.cone, c: long ? C.gold : '#e8742e', m: 'gold', p: [cx + Math.cos(a) * (long ? 0.4 : 0.34) * k, sy + Math.sin(a) * (long ? 0.4 : 0.34) * k, z], r: [0, 0, a - Math.PI / 2], s: [0.05 * k, (long ? 0.2 : 0.12) * k, 0.03 * k] })
    }
  } else {
    // hồ lô: a glazed wine gourd on a lotus base, a flame at its mouth, ribbons streaming either side
    p.push({ g: G.sphere, c: '#2f7fb8', m: 'ceramic', p: [cx, y + 0.3 * k, z], s: [0.25 * k, 0.24 * k, 0.2 * k] })
    p.push({ g: G.sphere, c: '#3f9a6b', m: 'ceramic', p: [cx, y + 0.63 * k, z], s: [0.15 * k, 0.15 * k, 0.13 * k] })
    p.push({ g: G.torus, c: C.gold, m: 'gold', p: [cx, y + 0.5 * k, z], r: [Math.PI / 2, 0, 0], s: [0.11 * k, 0.11 * k, 0.2 * k] })
    p.push({ g: G.cyl, c: C.gold, m: 'gold', p: [cx, y + 0.8 * k, z], s: [0.045 * k, 0.1 * k, 0.045 * k] })
    for (const a of [-0.5, 0, 0.5]) p.push({ g: G.cone, c: a ? '#e8742e' : C.gold, m: 'gold', p: [cx + a * 0.12 * k, y + (0.98 - Math.abs(a) * 0.1) * k, z], r: [0, 0, -a * 0.7], s: [0.05 * k, (0.26 - Math.abs(a) * 0.12) * k, 0.03 * k] })
    for (const s of [-1, 1]) {
      p.push({ g: taperTube([new THREE.Vector3(cx + s * 0.1 * k, y + 0.5 * k, z), new THREE.Vector3(cx + s * 0.34 * k, y + 0.66 * k, z), new THREE.Vector3(cx + s * 0.46 * k, y + 0.42 * k, z), new THREE.Vector3(cx + s * 0.36 * k, y + 0.22 * k, z)], 0.035 * k, 0.012 * k, 10, 5, 0.4), c: '#c8412b', m: 'ceramic' })
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      p.push({ g: G.sphereLo, c: i % 2 ? '#f7c3d3' : '#f4efe6', m: 'ceramic', p: [cx + Math.cos(a) * 0.2 * k, y + 0.07 * k, z + Math.sin(a) * 0.14 * k], s: [0.08 * k, 0.05 * k, 0.06 * k] })
    }
  }
  for (const s of [-1, 1]) p.push({ g: G.sphereLo, c: '#f4efe6', m: 'ceramic', p: [cx + s * 0.4 * k, y + 0.06 * k, z], s: [0.14 * k, 0.07 * k, 0.1 * k] })
  const r = Math.min(0.12 * k, span * 0.1)
  for (const s of [-1, 1]) {
    const x0 = cx + s * 0.66 * k
    p.push(...dragonParts({ pts: lyingSpine(x0, y, z, s, span, r, style), r, style, body, belly: '#f4efe6', fin: '#e6b53a', mane: '#e6b53a', horn: C.gold, m: 'ceramic', accent: 'gold', head: 1.6, detail: r > 0.07 ? 'full' : 'low' }))
  }
  return p
}

/**
 * The spine of a dragon lying along x from its reared head at hx: many soft
 * bends easing toward the tail (Lý), or a few strong humps with the tail
 * lifted (Tây Sơn, Nguyễn).
 */
function lyingSpine(hx: number, y: number, z: number, dir: number, span: number, r: number, style: DragonStyle): THREE.Vector3[] {
  const ly = style === 'ly'
  const pts: THREE.Vector3[] = [new THREE.Vector3(hx - dir * r * 0.6, y + r * (ly ? 3.8 : 4.5), z), new THREE.Vector3(hx + dir * r * 1.1, y + r * (ly ? 2.8 : 3.3), z)]
  const n = ly ? 12 : 7
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const hump = ly ? (0.5 + 0.5 * Math.sin(t * Math.PI * 8 - 1.3)) * (1 - 0.5 * t) * 1.3 : Math.max(0, Math.sin(t * Math.PI * 2.5 - 0.6)) * 1.6
    const lift = ly ? 0 : t > 0.86 ? (t - 0.86) * 22 : 0
    pts.push(new THREE.Vector3(hx + dir * (r * 1.1 + (span - r * 1.1) * t), y + r * (0.95 + hump + lift), z + Math.sin(t * Math.PI * (ly ? 4 : 3)) * r * 0.5 * (1 - t)))
  }
  return pts
}

/**
 * A dragon lying along x: its head at hx, the body running `span` the way of
 * `dir` (ridge beams, wall heads, roof hips). Give it the period of the
 * building it lies on.
 */
export function dragon(hx: number, y: number, z: number, dir: number, span: number, body = C.jade, k = 1, style: DragonStyle = 'ly'): Part[] {
  const r = Math.min(0.115 * k, span * 0.11)
  return dragonParts({ pts: lyingSpine(hx, y, z, dir, span, r, style), r, style, body, m: 'ceramic', accent: 'gold', horn: C.gold, detail: r > 0.075 ? 'full' : 'low', head: 1.55 })
}

/**
 * A pair of palace door leaves standing open inside a gateway: red lacquer,
 * rows of gilt bosses, a ring pull. The gateway is `hw` half-wide at cx; the
 * leaves lie back against its sides, from zFace into the passage.
 */
export function doorLeaves(cx: number, hw: number, h: number, zFace: number, color = '#7a231f'): Part[] {
  const p: Part[] = []
  const w = hw * 0.92
  for (const s of [-1, 1]) {
    const x = cx + s * (hw - 0.04)
    p.push(box(0.05, h, w, [x, h / 2 + 0.02, zFace - 0.08 - w / 2], color, 'paint'))
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) p.push({ g: G.sphereXs, c: C.gold, m: 'gold', p: [x - s * 0.03, h * (0.2 + i * 0.2), zFace - 0.08 - w * (0.2 + j * 0.3)], s: 0.028 })
    p.push({ g: G.torusLo, c: C.gold, m: 'gold', p: [x - s * 0.035, h * 0.5, zFace - 0.08 - w * 0.86], r: [0, Math.PI / 2, 0], s: 0.05 })
  }
  return p
}

/** Voi đá: a Cham stone elephant, standing, on a low plinth (the pair before the Hoàng Đế citadel). */
export function stoneElephant(x: number, z: number, ry: number, s = 1, c = '#8d867a'): Part[] {
  const p: Part[] = [
    box(1.0, 0.12, 1.5, [0, 0.06, 0], '#77716a', 'aged'),
    { g: G.sphere, c, m: 'aged', p: [0, 0.74, -0.08], s: [0.4, 0.42, 0.6] },
    { g: G.sphere, c, m: 'aged', p: [0, 0.92, 0.5], s: [0.3, 0.32, 0.3] },
    // the domed brow, the ears lying back
    { g: G.sphereLo, c, m: 'aged', p: [0, 1.14, 0.46], s: [0.2, 0.14, 0.2] },
    { g: G.sphereLo, c, m: 'aged', p: [0.3, 0.92, 0.36], r: [0, 0.5, 0.15], s: [0.06, 0.26, 0.22] },
    { g: G.sphereLo, c, m: 'aged', p: [-0.3, 0.92, 0.36], r: [0, -0.5, -0.15], s: [0.06, 0.26, 0.22] },
    // trunk curling in at the tip, tusks, tail
    { g: taperTube([new THREE.Vector3(0, 0.86, 0.74), new THREE.Vector3(0, 0.6, 0.9), new THREE.Vector3(0, 0.3, 0.86), new THREE.Vector3(0, 0.2, 0.74)], 0.12, 0.05, 12, 7), c, m: 'aged' },
    { g: G.cone, c: '#d6cfc0', m: 'aged', p: [0.13, 0.7, 0.8], r: [1.9, 0, -0.15], s: [0.035, 0.26, 0.035] },
    { g: G.cone, c: '#d6cfc0', m: 'aged', p: [-0.13, 0.7, 0.8], r: [1.9, 0, 0.15], s: [0.035, 0.26, 0.035] },
    { g: taperTube([new THREE.Vector3(0, 0.84, -0.66), new THREE.Vector3(0, 0.56, -0.76), new THREE.Vector3(0, 0.34, -0.7)], 0.035, 0.015, 8, 5), c, m: 'aged' },
    // a carved saddle cloth and a bell collar
    box(0.5, 0.03, 0.5, [0, 1.14, -0.1], '#9a9386', 'aged'),
    { g: G.torusLo, c: '#9a9386', m: 'aged', p: [0, 0.86, 0.3], r: [0.2, 0, 0], s: [0.3, 0.3, 0.2] },
    { g: G.sphereXs, c: '#2a2422', m: 'aged', p: [0.2, 1.0, 0.72], s: 0.03 },
    { g: G.sphereXs, c: '#2a2422', m: 'aged', p: [-0.2, 1.0, 0.72], s: 0.03 },
  ]
  for (const [lx, lz] of [
    [0.22, 0.3],
    [-0.22, 0.3],
    [0.22, -0.42],
    [-0.22, -0.42],
  ]) {
    p.push({ g: G.cyl, c, m: 'aged', p: [lx, 0.34, lz], s: [0.13, 0.5, 0.13] })
    p.push({ g: G.cyl, c: '#9a9386', m: 'aged', p: [lx, 0.14, lz], s: [0.145, 0.05, 0.145] })
  }
  return offsetParts(p, [x, 0, z], ry, s)
}

/**
 * Kỳ lân: the gilt-bronze qilin that guard the court of Điện Thái Hòa — a
 * dragon's head on the body of a hoofed beast, standing four-square on a
 * stone plinth, flames at its shoulders and a flame for a tail.
 */
export function kyLan(x: number, z: number, ry: number, s = 1): Part[] {
  const B = '#b98f3e'
  const F = '#dcb558'
  const p: Part[] = [
    box(0.74, 0.3, 1.2, [0, 0.15, 0], '#bdb2a1', 'aged'),
    box(0.84, 0.06, 1.3, [0, 0.03, 0], '#948a7b', 'aged'),
    box(0.8, 0.05, 1.26, [0, 0.31, 0], '#d6cdbc', 'aged'),
    // barrel, chest and the rise of the neck
    { g: G.sphere, c: B, m: 'bronze', p: [0, 0.82, -0.06], s: [0.2, 0.2, 0.36] },
    { g: G.sphere, c: B, m: 'bronze', p: [0, 0.9, 0.2], s: [0.19, 0.22, 0.2] },
    { g: taperTube([new THREE.Vector3(0, 0.94, 0.24), new THREE.Vector3(0, 1.12, 0.34), new THREE.Vector3(0, 1.26, 0.36)], 0.14, 0.11, 8, 8), c: B, m: 'bronze' },
    // a saddle cloth with a gilt border, a bell at the breast
    box(0.44, 0.02, 0.3, [0, 1.02, -0.08], '#a3302a', 'paint'),
    box(0.46, 0.015, 0.32, [0, 1.012, -0.08], C.gold, 'gold'),
    { g: G.sphereLo, c: C.gold, m: 'gold', p: [0, 0.78, 0.4], s: 0.05 },
  ]
  for (const [lx, lz] of [
    [0.13, 0.22],
    [-0.13, 0.22],
    [0.13, -0.3],
    [-0.13, -0.3],
  ]) {
    p.push({ g: G.cyl, c: B, m: 'bronze', p: [lx, 0.56, lz], s: [0.055, 0.44, 0.055] })
    p.push({ g: G.cyl, c: '#8a6a2c', m: 'bronze', p: [lx, 0.365, lz + 0.01], s: [0.07, 0.06, 0.08] })
    // a tuft of flame at each elbow
    p.push({ g: G.coneLo, c: F, m: 'gold', p: [lx * 1.25, 0.74, lz - 0.08], r: [-1.0, 0, -Math.sign(lx) * 0.4], s: [0.04, 0.2, 0.025] })
  }
  // flames along the spine, and the tail
  for (let i = 0; i < 5; i++) p.push({ g: G.coneLo, c: F, m: 'gold', p: [0, 1.04 - i * 0.012, 0.16 - i * 0.12], r: [-0.6, 0, 0], s: [0.035, 0.16, 0.02] })
  for (const k of [-1, 0, 1]) p.push({ g: G.coneLo, c: F, m: 'gold', p: [k * 0.07, 1.0 - Math.abs(k) * 0.05, -0.5], r: [-0.75, 0, -k * 0.4], s: [0.05, 0.4, 0.025] })
  // the head: a dragon's, mane streaming
  const h = 0.2
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(h, 0, 0), new THREE.Vector3(0, h, 0), new THREE.Vector3(0, 0, h)).setPosition(0, 1.34, 0.4)
  p.push(...dragonHead(M, 'nguyen', { body: B, belly: '#d2b06a', mane: F, horn: '#f3d98a' }, 'bronze', 'gold', true, false))
  return offsetParts(p, [x, 0, z], ry, s)
}

/** Bronze đỉnh urn (after Huế's Nine Dynastic Urns). */
export function cauldron(p: V3, s = 1, lid = false): Part[] {
  const bowl = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.42, 0.02],
      [0.55, 0.2],
      [0.58, 0.45],
      [0.62, 0.55],
      [0.5, 0.55],
      [0.48, 0.5],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    20,
  )
  const parts: Part[] = [{ g: bowl, c: '#6f7f5f', m: 'bronze', p: [0, 0.35, 0] }]
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    parts.push({ g: G.cyl, c: '#5f6f52', m: 'bronze', p: [Math.cos(a) * 0.35, 0.18, Math.sin(a) * 0.35], s: [0.06, 0.4, 0.06] })
  }
  for (const sx of [-1, 1]) parts.push({ g: G.torus, c: '#6f7f5f', m: 'bronze', p: [sx * 0.42, 1.0, 0], r: [0, Math.PI / 2, 0], s: 0.16 })
  if (lid) {
    parts.push({ g: G.sphere, c: '#6f7f5f', m: 'bronze', p: [0, 0.95, 0], s: [0.5, 0.22, 0.5] })
    parts.push({ g: G.sphere, c: '#8a8a5a', m: 'bronze', p: [0, 1.2, 0], s: 0.1 })
  }
  parts.push({ g: G.box, c: C.stoneDk, m: 'stone', p: [0, 0.04, 0], s: [1.2, 0.08, 1.2] })
  return offsetParts(parts, p, 0, s)
}

/** Bonsai (cây cảnh) in a glazed pot on a wooden stand. */
export function bonsai(p: V3, s = 1, pot = '#3f6aa8'): Part[] {
  return offsetParts(
    [
      box(0.7, 0.5, 0.7, [0, 0.25, 0], C.woodDk, 'wood'),
      box(0.6, 0.18, 0.42, [0, 0.59, 0], pot, 'ceramic'),
      { g: G.cyl, c: C.wood, m: 'wood', p: [0.05, 0.85, 0], r: [0, 0, -0.4], s: [0.04, 0.4, 0.04] },
      { g: blob(4, 1, 0.15), c: '#4f7f4a', m: 'foliage', p: [0.16, 1.07, 0], s: [0.3, 0.12, 0.26] },
      { g: blob(5, 1, 0.15), c: '#5f8f52', m: 'foliage', p: [-0.1, 0.92, 0.05], s: [0.2, 0.1, 0.18] },
    ],
    p,
    0,
    s,
  )
}

/** A carved lotus-bud finial (búp sen) — tops pillars and balustrade posts. */
export function lotusBud(x: number, y: number, z: number, s: number, c: string, m: Part['m'] = 'aged'): Part[] {
  return [
    { g: G.cyl, c, m, p: [x, y + 0.03 * s, z], s: [0.09 * s, 0.06 * s, 0.09 * s] },
    { g: G.sphere, c, m, p: [x, y + 0.12 * s, z], s: [0.1 * s, 0.1 * s, 0.1 * s] },
    { g: G.cone, c, m, p: [x, y + 0.26 * s, z], s: [0.075 * s, 0.16 * s, 0.075 * s] },
  ]
}

/** Stepped moulding: a pile of slabs, each a little larger than the one above. */
export function plinth(x: number, z: number, w: number, d: number, y0: number, steps: [number, number][], c: string, m: Part['m'] = 'aged'): Part[] {
  const p: Part[] = []
  let y = y0
  for (const [grow, h] of steps) {
    p.push(box(w + grow, h, d + grow, [x, y + h / 2, z], c, m))
    y += h
  }
  return p
}

/** Arched-opening wall slab (extruded, with round-arched holes). */
export function archedWall(W: number, H: number, D: number, arches: [number, number, number][], curve = 18): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-W / 2, 0)
  shape.lineTo(W / 2, 0)
  shape.lineTo(W / 2, H)
  shape.lineTo(-W / 2, H)
  shape.lineTo(-W / 2, 0)
  for (const [cx, hw, spring] of arches) {
    const hole = new THREE.Path()
    hole.moveTo(cx - hw, 0.02)
    hole.lineTo(cx - hw, spring)
    hole.absarc(cx, spring, hw, Math.PI, 0, true)
    hole.lineTo(cx + hw, 0.02)
    hole.lineTo(cx - hw, 0.02)
    shape.holes.push(hole)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: curve })
  g.translate(0, 0, -D / 2)
  return g
}

/** A flat arch ring (voussoir band) framing an arched opening, on one face. */
export function archRing(cx: number, hw: number, spring: number, band: number, depth = 0.06): THREE.BufferGeometry {
  const sh = new THREE.Shape()
  sh.moveTo(cx - hw - band, 0.02)
  sh.lineTo(cx - hw - band, spring)
  sh.absarc(cx, spring, hw + band, Math.PI, 0, true)
  sh.lineTo(cx + hw + band, 0.02)
  sh.lineTo(cx + hw, 0.02)
  sh.lineTo(cx + hw, spring)
  sh.absarc(cx, spring, hw, 0, Math.PI, false)
  sh.lineTo(cx - hw, 0.02)
  sh.lineTo(cx - hw - band, 0.02)
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 20 })
}

/** Recessed panel: a raised frame around a slightly darker inset. */
export function panel(w: number, h: number, p: V3, c: string, inset: string, ry = 0, m: Part['m'] = 'aged', frame = 0.05): Part[] {
  const parts: Part[] = [
    box(w, h, 0.03, [0, 0, 0], inset, m),
    box(w + frame * 2, frame, 0.06, [0, h / 2 + frame / 2, 0.01], c, m),
    box(w + frame * 2, frame, 0.06, [0, -h / 2 - frame / 2, 0.01], c, m),
    box(frame, h, 0.06, [-w / 2 - frame / 2, 0, 0.01], c, m),
    box(frame, h, 0.06, [w / 2 + frame / 2, 0, 0.01], c, m),
  ]
  return offsetParts(parts, p, ry)
}

/** Chibi nghê / stone lion sitting on a pillar top (guardian of village gates and temples). */
export function nghe(flip: number, c = '#8f8a80', m: Part['m'] = 'aged'): Part[] {
  const p: Part[] = [
    { g: G.sphere, c, m, p: [0, 0.14, -0.03], s: [0.12, 0.13, 0.15] },
    { g: G.sphere, c, m, p: [0, 0.3, 0.04], s: [0.13, 0.12, 0.12] },
    { g: G.sphere, c, m, p: [0, 0.27, 0.14], s: [0.07, 0.05, 0.05] },
    { g: G.sphereXs, c: '#2b2626', m: 'gloss', p: [0.05, 0.33, 0.14], s: [0.02, 0.025, 0.012] },
    { g: G.sphereXs, c: '#2b2626', m: 'gloss', p: [-0.05, 0.33, 0.14], s: [0.02, 0.025, 0.012] },
    // flame-like mane curls and a curling tail
    { g: G.cone, c, m, p: [0, 0.44, -0.02], r: [-0.4, 0, 0], s: [0.05, 0.12, 0.04] },
    { g: G.cone, c, m, p: [flip * 0.08, 0.41, -0.03], r: [-0.3, 0, -flip * 0.5], s: [0.04, 0.1, 0.035] },
    { g: G.cone, c, m, p: [-flip * 0.08, 0.41, -0.03], r: [-0.3, 0, flip * 0.5], s: [0.04, 0.1, 0.035] },
    { g: taperTube([new THREE.Vector3(0, 0.12, -0.16), new THREE.Vector3(0, 0.28, -0.24), new THREE.Vector3(0, 0.36, -0.16)], 0.04, 0.012, 8, 5), c, m },
    { g: G.sphereLo, c, m, p: [flip * 0.07, 0.04, 0.08], s: [0.04, 0.04, 0.06] },
    { g: G.sphereLo, c, m, p: [-flip * 0.07, 0.04, 0.08], s: [0.04, 0.04, 0.06] },
  ]
  return p
}

/** Hand-made wooden bench / stone bench. */
export function bench(p: V3, ry: number, seat: string, leg: string, w = 1.1, m: Part['m'] = 'stone'): Part[] {
  return offsetParts(
    [
      box(w, 0.07, 0.34, [0, 0.235, 0], seat, m),
      box(w + 0.04, 0.02, 0.36, [0, 0.27, 0], seat, m),
      box(0.12, 0.2, 0.28, [-w / 2 + 0.14, 0.1, 0], leg, m),
      box(0.12, 0.2, 0.28, [w / 2 - 0.14, 0.1, 0], leg, m),
    ],
    p,
    ry,
  )
}

/** Tall flagpole (the flag itself is a waving mesh, see Common.tsx). */
export function flagpole(p: V3, h = 3.6): Part[] {
  return offsetParts(
    [
      box(0.34, 0.12, 0.34, [0, 0.06, 0], C.stoneDk),
      { g: new THREE.CylinderGeometry(0.022, 0.03, h, 8), c: '#d8dade', m: 'gloss', p: [0, h / 2, 0] },
      { g: G.sphereLo, c: C.gold, m: 'gold', p: [0, h + 0.03, 0], s: 0.045 },
    ],
    p,
  )
}

/** A plinth band along a wall face, broken wherever an arch opens. */
export function skirting(W: number, D: number, h: number, arches: [number, number, number][], c: string, m: Part['m'] = 'aged', grow = 0.08): Part[] {
  const cuts = arches.map(([cx, hw]) => [cx - hw, cx + hw]).sort((a, b) => a[0] - b[0])
  const p: Part[] = []
  let x = -W / 2 - grow / 2
  for (const [a, b] of cuts) {
    if (a > x) p.push(box(a - x, h, D + grow, [(x + a) / 2, h / 2, 0], c, m))
    x = b
  }
  const end = W / 2 + grow / 2
  if (end > x) p.push(box(end - x, h, D + grow, [(x + end) / 2, h / 2, 0], c, m))
  return p
}
