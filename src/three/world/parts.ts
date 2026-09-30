import * as THREE from 'three'
import { G, blob, offsetParts, type Part, type V3 } from '../lib/kit'
import { taperTube } from '../characters/hair'

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

/** "Lưỡng long chầu nhật": two dragons facing a flaming sun on a ridge. */
export function ridgeDragons(cx: number, y: number, z: number, span: number, body = C.jade, scale = 1): Part[] {
  const p: Part[] = []
  const k = scale
  p.push({ g: G.cyl, c: '#c8412b', m: 'paint', p: [cx, y + 0.3 * k, z], r: [Math.PI / 2, 0, 0], s: [0.24 * k, 0.06 * k, 0.24 * k] })
  p.push({ g: G.torus, c: C.gold, m: 'gold', p: [cx, y + 0.3 * k, z], s: 0.24 * k })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    p.push({ g: G.cone, c: C.gold, m: 'gold', p: [cx + Math.cos(a) * 0.36 * k, y + (0.3 + Math.sin(a) * 0.36) * k, z], r: [0, 0, a - Math.PI / 2], s: [0.05 * k, 0.14 * k, 0.03 * k] })
  }
  for (const s of [-1, 1]) p.push(...dragon(cx + s * 0.5 * k, y, z, s, span, body, k))
  return p
}

/** A sinuous ridge dragon: a wavy tapering body, a head, horns and spines. */
export function dragon(hx: number, y: number, z: number, dir: number, span: number, body = C.jade, k = 1): Part[] {
  const p: Part[] = []
  const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => new THREE.Vector3(hx + dir * span * t, y + (0.12 + Math.sin(t * Math.PI * 2.5) * 0.12 + (1 - t) * 0.2) * k, z))
  p.push({ g: taperTube(pts, 0.11 * k, 0.04 * k, 18, 7), c: body, m: 'ceramic' })
  p.push({ g: G.sphere, c: body, m: 'ceramic', p: [hx + dir * 0.05 * k, y + 0.45 * k, z], s: [0.14 * k, 0.11 * k, 0.1 * k] })
  p.push({ g: G.cone, c: C.gold, m: 'gold', p: [hx + dir * 0.12 * k, y + 0.6 * k, z], r: [0, 0, -dir * 0.6], s: [0.03 * k, 0.16 * k, 0.03 * k] })
  for (let i = 1; i < 6; i++) p.push({ g: G.sphereXs, c: C.gold, m: 'gold', p: [pts[i].x, pts[i].y + 0.09 * k, z], s: 0.035 * k })
  return p
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
