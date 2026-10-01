import * as THREE from 'three'
import { useMemo } from 'react'
import { G, offsetParts, rng, type Part } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { canvas, toTexture } from '../lib/textures'
import { taperTube } from '../characters/hair'
import { BANYAN, BOARD, CONGLANG, HAYSTACK, HOUSE, VILLAGE_END, WELL, houseToWorld } from '../layout'
import { hipRoof } from '../lib/roof'
import { matTex } from '../characters/garments'
import { PLAQUES } from '../../config'
import { archRing, archedWall, box, cyl, nghe, panel, plinth, skirting } from './parts'
import { Flags, Plaque, Sign } from './Common'

/*
 * IV · A NORTHERN VILLAGE — home.
 * You come in through the village gate, set into the bamboo hedge just
 * behind Đoan Môn. After the photograph: a round-arched central gate of
 * weathered grey plaster, a calligraphy band (地靈人傑) crowned by a "cuốn thư"
 * scroll crest; two tall trụ biểu with lantern-box capitals carrying nghê
 * guardians; lower side walls with "chữ thọ" openwork, small pillars with
 * little lions, and walls that end in a curling scroll.
 * Inside: the herring-bone brick lane, the banyan with its little shrine, the
 * well with its cần vọt lever, the village pond — and on the right bố mẹ's
 * thatched house in its yard, a haystack beside it. At the far end the lane
 * leaves the village under arching bamboo (Foliage.tsx), toward Huế.
 */

const K = CONGLANG
const GREY = '#b5ad9f'
const GREY_DK = '#8f887c'
const GREY_LT = '#c9c2b4'

/** "ô thoáng": square openwork of interlocking key-fret (chữ thọ-like) motifs */
function thoLattice() {
  const [c, g] = canvas(128, 128)
  g.clearRect(0, 0, 128, 128)
  g.strokeStyle = GREY_LT
  g.lineWidth = 9
  g.strokeRect(5, 5, 118, 118)
  g.lineWidth = 7
  for (const [x, y] of [
    [22, 22],
    [70, 22],
    [22, 70],
    [70, 70],
  ]) {
    g.beginPath()
    g.moveTo(x, y + 36)
    g.lineTo(x, y)
    g.lineTo(x + 36, y)
    g.lineTo(x + 36, y + 24)
    g.lineTo(x + 12, y + 24)
    g.lineTo(x + 12, y + 12)
    g.lineTo(x + 24, y + 12)
    g.stroke()
  }
  return toTexture(c)
}

const PX = 1.55 // tall pillar x

/** a tall trụ biểu: stepped plinth, panelled shaft, lantern-box capital, a little roof, a guardian on top */
function truBieu(x: number, h: number, big: boolean, flip: number): Part[] {
  const w = big ? 0.42 : 0.32
  const p: Part[] = [
    ...plinth(x, 0, w, w, 0, [
      [0.26, 0.14],
      [0.16, 0.16],
      [0.06, 0.08],
    ], GREY_DK),
  ]
  const y0 = 0.38
  p.push(box(w, h - y0, w, [x, y0 + (h - y0) / 2, 0], GREY, 'aged'))
  for (const [fx, fz, ry] of [
    [0, w / 2, 0],
    [0, -w / 2, Math.PI],
    [w / 2, 0, Math.PI / 2],
    [-w / 2, 0, -Math.PI / 2],
  ] as const)
    p.push(...panel(w * 0.52, (h - y0) * 0.62, [x + fx, y0 + (h - y0) * 0.45, fz], GREY_LT, GREY_DK, ry, 'aged', 0.03).map((q) => ({ ...q })))
  let y = h
  for (const [grow, hh] of [
    [0.08, 0.06],
    [0.14, 0.06],
  ] as const) {
    p.push(box(w + grow, hh, w + grow, [x, y + hh / 2, 0], GREY_LT, 'aged'))
    y += hh
  }
  // lantern box (lồng đèn) with openings on four sides
  const lb = big ? 0.36 : 0.26
  p.push(box(w * 0.92, lb, w * 0.92, [x, y + lb / 2, 0], GREY, 'aged'))
  for (const [fx, fz] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ])
    p.push(box(fx ? 0.03 : w * 0.46, lb * 0.5, fz ? 0.03 : w * 0.46, [x + (fx * w * 0.47), y + lb / 2, fz * w * 0.47], '#3a3630', 'aged'))
  y += lb
  // mũ cột: a little hipped cap with upturned corners
  p.push(box(w + 0.22, 0.05, w + 0.22, [x, y + 0.025, 0], GREY_LT, 'aged'))
  p.push({ g: new THREE.ConeGeometry((w + 0.2) * 0.72, 0.16, 4), c: GREY_DK, m: 'aged', p: [x, y + 0.13, 0], r: [0, Math.PI / 4, 0] })
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])
    p.push({ g: G.cone, c: GREY_DK, m: 'aged', p: [x + sx * (w / 2 + 0.1), y + 0.1, sz * (w / 2 + 0.1)], r: [sz * 0.9, 0, -sx * 0.9], s: [0.03, 0.12, 0.03] })
  y += 0.2
  p.push(box(w * 0.5, 0.08, w * 0.5, [x, y + 0.04, 0], GREY_LT, 'aged'))
  p.push(...offsetParts(nghe(flip, '#8f887c'), [x, y + 0.08, 0], flip > 0 ? 0.5 : -0.5, big ? 1.05 : 0.7))
  return p
}

/** the "cuốn thư" crest: an unrolled-scroll board with curling ends and a flaming pearl */
function scrollCrest(): Part[] {
  const p: Part[] = []
  const s = new THREE.Shape()
  s.moveTo(-0.95, 0)
  s.lineTo(0.95, 0)
  s.quadraticCurveTo(1.05, 0.28, 0.82, 0.46)
  s.quadraticCurveTo(0.4, 0.52, 0.18, 0.62)
  s.quadraticCurveTo(0, 0.7, -0.18, 0.62)
  s.quadraticCurveTo(-0.4, 0.52, -0.82, 0.46)
  s.quadraticCurveTo(-1.05, 0.28, -0.95, 0)
  p.push({ g: new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 10 }), c: GREY, m: 'aged', p: [0, 0, -0.07] })
  // rolled ends
  for (const sx of [-1, 1]) {
    p.push({ g: G.torus, c: GREY_LT, m: 'aged', p: [sx * 0.88, 0.26, 0.02], r: [0, 0, 0], s: [0.13, 0.13, 0.5] })
    p.push({ g: G.cyl, c: GREY_LT, m: 'aged', p: [sx * 0.88, 0.26, 0.02], r: [Math.PI / 2, 0, 0], s: [0.06, 0.18, 0.06] })
  }
  // central relief: a round "thọ" medallion, and the pearl on top
  p.push({ g: G.cyl, c: GREY_LT, m: 'aged', p: [0, 0.34, 0.08], r: [Math.PI / 2, 0, 0], s: [0.17, 0.04, 0.17] })
  p.push({ g: G.torus, c: GREY_DK, m: 'aged', p: [0, 0.34, 0.1], s: [0.12, 0.12, 0.3] })
  p.push({ g: G.sphere, c: GREY_LT, m: 'aged', p: [0, 0.8, 0], s: 0.1 })
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (0.15 + (k / 4) * 0.7)
    p.push({ g: G.cone, c: GREY, m: 'aged', p: [Math.cos(a) * 0.17, 0.8 + Math.sin(a) * 0.17, 0], r: [0, 0, a - Math.PI / 2], s: [0.035, 0.12, 0.03] })
  }
  return p
}

function gateParts(): Part[] {
  const p: Part[] = []
  // central arched block
  const W = 2.5
  const H = 2.86
  const Dp = 0.9
  const spring = K.archH - K.archW / 2
  p.push({ g: archedWall(W, H, Dp, [[0, K.archW / 2, spring]]), c: GREY, m: 'aged' })
  for (const f of [1, -1]) p.push({ g: archRing(0, K.archW / 2, spring, 0.12), c: GREY_LT, m: 'aged', p: [0, 0, f * (Dp / 2) + (f > 0 ? 0 : -0.06)] })
  p.push(...skirting(W, Dp, 0.26, [[0, K.archW / 2, spring]], GREY_DK, 'aged', 0.06))
  // recessed panels beside the arch
  for (const s of [-1, 1]) p.push(...panel(0.3, 1.2, [s * 0.95, 1.05, Dp / 2 + 0.01], GREY_LT, '#a7a092'))
  // mouldings under and over the calligraphy band
  p.push(box(W + 0.18, 0.1, Dp + 0.12, [0, H + 0.05, 0], GREY_LT, 'aged'))
  p.push(box(W - 0.1, 0.52, Dp - 0.1, [0, H + 0.36, 0], GREY, 'aged'))
  p.push(box(W + 0.14, 0.09, Dp + 0.08, [0, H + 0.665, 0], GREY_LT, 'aged'))
  p.push(...offsetParts(scrollCrest(), [0, H + 0.71, 0]))
  // two tall trụ biểu
  for (const s of [-1, 1]) p.push(...truBieu(s * PX, 3.65, true, s))
  // side wings: lower walls with openwork, small pillars with lions, scroll ends
  for (const s of [-1, 1]) {
    const x0 = PX + 0.21
    const wl = 1.7
    const cx = s * (x0 + wl / 2)
    p.push(box(wl, 1.72, 0.44, [cx, 0.86, 0], GREY, 'aged'))
    p.push(box(wl + 0.04, 0.2, 0.52, [cx, 0.1, 0], GREY_DK, 'aged'))
    p.push(box(wl + 0.08, 0.08, 0.52, [cx, 1.76, 0], GREY_LT, 'aged'))
    // stepped parapet rising toward the tall pillar
    p.push(box(wl * 0.55, 0.36, 0.4, [s * (x0 + wl * 0.275), 1.98, 0], GREY, 'aged'))
    p.push(box(wl * 0.55 + 0.06, 0.06, 0.46, [s * (x0 + wl * 0.275), 2.19, 0], GREY_LT, 'aged'))
    p.push(...panel(0.5, 0.62, [s * (x0 + wl * 0.62), 0.88, 0.23], GREY_LT, '#a7a092'))
    p.push(...panel(0.5, 0.62, [s * (x0 + wl * 0.62), 0.88, -0.23], GREY_LT, '#a7a092', Math.PI))
    p.push(...truBieu(s * (x0 + wl + 0.16), 2.25, false, s))
    // the wall ends in a big curling scroll (cuốn thư) stepping down to the hedge
    const ex = s * (x0 + wl + 0.55)
    p.push(box(0.6, 1.0, 0.38, [ex, 0.5, 0], GREY, 'aged'))
    p.push({ g: G.torus, c: GREY_LT, m: 'aged', p: [ex + s * 0.12, 1.02, 0], r: [0, 0, 0], s: [0.3, 0.3, 1.5] })
    p.push({ g: G.cyl, c: GREY, m: 'aged', p: [ex + s * 0.12, 1.02, 0], r: [Math.PI / 2, 0, 0], s: [0.2, 0.36, 0.2] })
  }
  return offsetParts(p, [K.x, 0, K.z])
}

/** the village well: a round laterite ring, a bucket, and the cần vọt lever */
function wellParts(): Part[] {
  const p: Part[] = []
  p.push({ g: new THREE.CylinderGeometry(0.62, 0.66, 0.46, 20, 1, true), c: '#8a7b68', m: 'aged', p: [0, 0.23, 0] })
  p.push({ g: new THREE.CylinderGeometry(0.5, 0.5, 0.46, 20, 1, true), c: '#6f6353', m: 'aged', p: [0, 0.23, 0] })
  p.push({ g: new THREE.TorusGeometry(0.56, 0.08, 6, 24), c: '#9c8d78', m: 'aged', p: [0, 0.47, 0], r: [Math.PI / 2, 0, 0] })
  p.push({ g: new THREE.CylinderGeometry(0.5, 0.5, 0.02, 20), c: '#2f5058', m: 'ceramic', p: [0, 0.2, 0] })
  // a paved apron
  p.push({ g: new THREE.CylinderGeometry(1.0, 1.05, 0.06, 24), c: '#9a8a74', m: 'stone', p: [0, 0.03, 0] })
  // cần vọt: pivot post, long pole, stone counterweight, bucket on a rope
  p.push(cyl(0.05, 1.7, [0.9, 0.85, -0.2], '#6b4a32', 'wood'))
  p.push({ g: G.cyl, c: '#b9924e', m: 'wood', p: [0.55, 1.62, -0.2], r: [0, 0, 1.12], s: [0.03, 2.6, 0.03] })
  p.push({ g: G.sphere, c: '#7f7a70', m: 'stone', p: [1.72, 1.12, -0.2], s: [0.16, 0.13, 0.14] })
  p.push(cyl(0.008, 0.7, [-0.58, 1.8, -0.2], '#4a3a2a', 'wood'))
  p.push({ g: new THREE.CylinderGeometry(0.1, 0.08, 0.16, 12), c: '#8a6a3a', m: 'wood', p: [-0.58, 1.38, -0.2] })
  return offsetParts(p, [WELL.x, 0, WELL.z], -0.4)
}

/**
 * Bố mẹ's house: a thatched cottage of mud walls on a low earth platform —
 * plank door, a barred window, corner posts, and a thick two-layer thatch
 * with a shaggy straw fringe and a bound ridge.
 */
function houseParts(): Part[] {
  const p: Part[] = []
  const MUD = '#b08a5c'
  const POST = '#5a3f2a'
  const W = 3.0
  const Dd = 2.2
  const WH = 1.25
  p.push(box(W + 0.5, 0.12, Dd + 0.5, [0, 0.06, 0], '#8a6a48', 'aged'))
  p.push(box(W, WH, Dd, [0, 0.12 + WH / 2, 0], MUD, 'aged'))
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
    [0, 1],
  ])
    p.push(box(0.1, WH, 0.1, [(sx * W) / 2, 0.12 + WH / 2, (sz * Dd) / 2 + sz * 0.01], POST, 'wood'))
  p.push(box(W + 0.05, 0.08, 0.1, [0, 0.12 + WH - 0.04, Dd / 2 + 0.01], POST, 'wood'))
  // plank door with its frame
  const dz = Dd / 2 + 0.02
  p.push(box(0.72, 1.06, 0.05, [-0.62, 0.12 + 0.53, dz], POST, 'wood'))
  for (let k = 0; k < 5; k++) p.push(box(0.11, 0.98, 0.03, [-0.62 - 0.24 + k * 0.12, 0.12 + 0.53, dz + 0.03], k % 2 ? '#6e4c33' : '#7a553a', 'wood'))
  p.push(box(0.6, 0.05, 0.03, [-0.62, 0.12 + 0.3, dz + 0.05], '#5a3f2a', 'wood'))
  p.push(box(0.6, 0.05, 0.03, [-0.62, 0.12 + 0.8, dz + 0.05], '#5a3f2a', 'wood'))
  // window with vertical wooden bars (song cửa)
  p.push(box(0.8, 0.5, 0.04, [0.65, 0.12 + 0.72, dz], '#2e241c', 'wood'))
  p.push(box(0.9, 0.07, 0.07, [0.65, 0.12 + 1.0, dz + 0.02], POST, 'wood'))
  p.push(box(0.9, 0.07, 0.07, [0.65, 0.12 + 0.44, dz + 0.02], POST, 'wood'))
  for (let k = 0; k < 7; k++) p.push(box(0.035, 0.5, 0.035, [0.65 - 0.33 + k * 0.11, 0.12 + 0.72, dz + 0.03], '#7a553a', 'wood'))
  // thatch: two thick layered hipped roofs of straw (strands run down the slope)
  const straw = (parts: Part[]) => parts.map((q) => ({ ...q, m: q.m === 'tile' ? ('thatch' as const) : ('wood' as const) }))
  const ey = 0.12 + WH
  p.push(...straw(offsetParts(hipRoof({ w: W + 1.4, d: Dd + 1.4, h: 1.55, lift: 0.0, curve: 1.0, thick: 0.34, tile: '#e0bd72', under: '#9a7a44', fascia: '#c29c56', ridgeColor: '#b8944e', ornaments: false, hipCaps: false }), [0, ey - 0.04, 0])))
  p.push(...straw(offsetParts(hipRoof({ w: W + 0.6, d: Dd + 0.6, h: 1.2, lift: 0.0, curve: 1.0, thick: 0.28, tile: '#ecc97e', under: '#9a7a44', fascia: '#c9a45e', ridgeColor: '#b8944e', ornaments: false, hipCaps: false }), [0, ey + 0.42, 0])))
  // the shaggy straw fringe hanging from the eaves, two staggered rows
  const ew = (W + 1.4) / 2
  const ed = (Dd + 1.4) / 2
  const rnd = rng(606)
  // ragged straw ends: flat blades of uneven length, each at its own slant
  const fringe = (x: number, z: number, row: number, along: number) =>
    p.push({
      g: G.coneLo,
      c: ['#b8944e', '#a88442', '#c9a45e', '#96763a'][Math.floor(rnd() * 4)],
      m: 'thatch',
      p: [x, ey - 0.16 - row * 0.06 - rnd() * 0.04, z],
      r: [Math.PI + (rnd() - 0.5) * 0.3, along + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.3],
      s: [0.1, 0.3 + rnd() * 0.22, 0.03],
    })
  for (let row = 0; row < 3; row++) {
    const off = row * 0.035
    for (let x = -ew + off; x <= ew + 1e-3; x += 0.065) {
      fringe(x, ed - row * 0.04, row, 0)
      fringe(x, -ed + row * 0.04, row, 0)
    }
    for (let z = -ed + 0.065 + off; z < ed; z += 0.065) {
      fringe(ew - row * 0.04, z, row, Math.PI / 2)
      fringe(-ew + row * 0.04, z, row, Math.PI / 2)
    }
  }
  // bound ridge roll with bamboo ties
  const rl = W + 0.6 - (Dd + 0.6) + 0.5
  const ry = ey + 0.42 + 1.2 + 0.08
  p.push({ g: G.cyl, c: '#b8944e', m: 'thatch', p: [0, ry, 0], r: [0, 0, Math.PI / 2], s: [0.14, rl, 0.14] })
  for (const x of [-rl / 2 + 0.1, 0, rl / 2 - 0.1]) p.push({ g: G.torusLo, c: '#6f5a32', m: 'wood', p: [x, ry, 0], r: [0, Math.PI / 2, 0], s: [0.15, 0.15, 0.25] })
  return offsetParts(p, [HOUSE.x, 0, HOUSE.z], HOUSE.ry, HOUSE.s)
}

/** the yard in front of the house (in the house's own frame): two nón lá, a basket of corn, a big chum */
function yardParts(): Part[] {
  const p: Part[] = []
  const nonLa = (x: number, z: number, tilt: number, ry: number) => {
    const cone = new THREE.ConeGeometry(0.28, 0.14, 24, 1, true)
    p.push({ g: cone, c: '#e2cf9a', m: 'wood', p: [x, 0.08, z], r: [tilt, ry, 0] })
    for (let k = 1; k <= 3; k++) p.push({ g: G.torusLo, c: '#c9b27a', m: 'wood', p: [x, 0.08 + 0.07 - k * 0.035, z], r: [Math.PI / 2 + tilt, 0, 0], s: [0.28 * (k / 4), 0.28 * (k / 4), 0.1] })
  }
  nonLa(MAT[0] - 0.3, MAT[1] - 0.1, 0, 0)
  nonLa(MAT[0] + 0.28, MAT[1] + 0.22, 0.5, 0.6)
  // a basket of corn cobs in their husks
  const bx = 1.3
  const bz = 1.9
  for (let k = 0; k < 4; k++) p.push({ g: new THREE.CylinderGeometry(0.22 + k * 0.015, 0.2 + k * 0.015, 0.05, 18, 1, true), c: k % 2 ? '#c9a45a' : '#b38a44', m: 'wood', p: [bx, 0.03 + k * 0.05, bz] })
  p.push({ g: G.torus, c: '#a8803e', m: 'wood', p: [bx, 0.22, bz], r: [Math.PI / 2, 0, 0], s: [0.27, 0.27, 0.3] })
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    const x = bx + Math.cos(a) * 0.1
    const z = bz + Math.sin(a) * 0.1
    p.push({ g: G.cyl, c: '#f2c230', m: 'toy', p: [x, 0.26, z], r: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], s: [0.045, 0.24, 0.045] })
    p.push({ g: G.coneLo, c: '#9cbc5a', m: 'foliage', p: [x + Math.cos(a) * 0.1, 0.24, z + Math.sin(a) * 0.1], r: [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3], s: [0.05, 0.22, 0.02] })
  }
  // the big clay chum by the house corner
  const jar = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.26, 0.02],
      [0.4, 0.3],
      [0.42, 0.52],
      [0.34, 0.74],
      [0.24, 0.82],
      [0.25, 0.86],
    ].map(([a, b]) => new THREE.Vector2(a, b)),
    20,
  )
  p.push({ g: jar, c: '#8a5a3c', m: 'aged', p: [2.0, 0, 1.4] })
  p.push({ g: G.torusLo, c: '#6f4630', m: 'aged', p: [2.0, 0.55, 1.4], r: [Math.PI / 2, 0, 0], s: [0.42, 0.42, 0.2] })
  return offsetParts(p, [HOUSE.x, 0, HOUSE.z], HOUSE.ry, HOUSE.s)
}
/** where the sedge mat lies, in the house's frame */
const MAT: [number, number] = [1.2, 3.2]

/** cây rơm: a haystack built around a bamboo pole, bound with straw ropes */
function haystackParts(): Part[] {
  const stack = new THREE.LatheGeometry(
    [
      [0.5, 0],
      [0.64, 0.12],
      [0.66, 0.55],
      [0.58, 0.95],
      [0.4, 1.28],
      [0.16, 1.5],
      [0.04, 1.56],
    ].map(([a, b]) => new THREE.Vector2(a, b)),
    18,
  )
  // finer straw: the thatch texture is authored for the long slopes of a roof
  const uv = stack.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.6, uv.getY(i) * 0.9)
  const p: Part[] = [{ g: stack, c: '#ecc97e', m: 'thatch' }, cyl(0.028, 2.0, [0, 1.0, 0], '#8f7a44', 'wood')]
  for (const [y, r] of [
    [0.5, 0.67],
    [1.0, 0.56],
  ])
    p.push({ g: G.torusLo, c: '#a8803e', m: 'wood', p: [0, y, 0], r: [Math.PI / 2, 0, 0], s: [r, r, 0.12] })
  // loose straw at its foot
  const rnd = rng(717)
  for (let k = 0; k < 22; k++) {
    const a = rnd() * Math.PI * 2
    const d = 0.6 + rnd() * 0.3
    p.push({ g: G.coneLo, c: ['#c9a45e', '#b8944e', '#e0bd72'][k % 3], m: 'thatch', p: [Math.cos(a) * d, 0.03, Math.sin(a) * d], r: [Math.PI / 2 + (rnd() - 0.5) * 0.3, 0, a + (rnd() - 0.5)], s: [0.05, 0.3 + rnd() * 0.2, 0.02] })
  }
  return offsetParts(p, [HAYSTACK.x, 0, HAYSTACK.z])
}

/**
 * bamboo lantern poles along the brick lane (the lanterns themselves live in
 * Lanterns.tsx). The right of the lane is kept clear in front of the yard.
 */
export const VILLAGE_POLES: [number, number][] = [
  [-1.6, -35.4],
  [-1.6, -37.6],
  [-1.6, -39.8],
  [-1.6, -42.0],
  [1.6, -42.3],
]
function poleParts(): Part[] {
  const p: Part[] = []
  for (const [x, z] of VILLAGE_POLES) {
    p.push(cyl(0.03, 2.35, [x, 1.17, z], '#b8a064', 'wood'))
    for (let y = 0.4; y < 2.3; y += 0.45) p.push(cyl(0.034, 0.03, [x, y, z], '#8f7a44', 'wood'))
    // a crooked bamboo arm holding the lantern out over the path
    p.push({ g: taperTube([new THREE.Vector3(x, 2.2, z), new THREE.Vector3(x - Math.sign(x) * 0.25, 2.34, z), new THREE.Vector3(x - Math.sign(x) * 0.48, 2.3, z)], 0.022, 0.016, 8, 5), c: '#b8a064', m: 'wood' })
  }
  return p
}

/** a tiny roadside shrine (miếu) at the foot of the banyan */
function mieuParts(): Part[] {
  const p: Part[] = [
    box(0.5, 0.36, 0.44, [0, 0.18, 0], '#a89f90', 'aged'),
    box(0.44, 0.34, 0.38, [0, 0.53, 0], '#c8423a', 'paint'),
    box(0.2, 0.22, 0.02, [0, 0.52, 0.2], '#3a2a20', 'wood'),
    { g: new THREE.ConeGeometry(0.42, 0.24, 4), c: '#8a4a32', m: 'tile', p: [0, 0.82, 0], r: [0, Math.PI / 4, 0] },
    { g: G.sphereXs, c: '#e9c46a', m: 'gold', p: [0, 0.96, 0], s: 0.035 },
    // incense pot
    cyl(0.06, 0.06, [0, 0.39, 0.26], '#6f7f5f', 'bronze'),
  ]
  return offsetParts(p, [BANYAN.x + 1.7, 0, BANYAN.z - 0.7], 1.2)
}

/** the woven sedge mat (chiếu) spread in the yard */
function ChieuMat() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: matTex(), roughness: 0.95 }), [])
  const [x, z] = houseToWorld(...MAT)
  return (
    <mesh position={[x, 0.018, z]} rotation={[-Math.PI / 2, 0, HOUSE.ry + 0.1]} scale={HOUSE.s} material={mat} receiveShadow>
      <planeGeometry args={[1.35, 1.0]} />
    </mesh>
  )
}

export function Village() {
  const tho = useMemo(() => thoLattice(), [])
  return (
    <group>
      <KitMesh build={gateParts} />
      <KitMesh build={wellParts} />
      <KitMesh build={houseParts} />
      <KitMesh build={yardParts} />
      <KitMesh build={haystackParts} />
      <ChieuMat />
      <KitMesh build={poleParts} />
      <KitMesh build={mieuParts} />
      {[-1, 1].flatMap((s) =>
        [1, -1].map((f) => <Sign key={`${s}${f}`} map={tho} w={0.5} h={0.34} position={[K.x + s * (PX + 0.21 + 1.7 * 0.275), 1.98, K.z + f * 0.205]} ry={f > 0 ? 0 : Math.PI} />),
      )}
      <Plaque text={PLAQUES.village} w={2.0} h={0.44} position={[K.x, 3.22, K.z + 0.41]} tilt={0} style="stone" />
      <Plaque text={PLAQUES.village} w={2.0} h={0.44} position={[K.x, 3.22, K.z - 0.41]} tilt={0} style="stone" ry={Math.PI} />
      <Flags
        spots={[
          [-2.9, K.z + 1.15],
          [2.9, K.z + 1.15],
        ]}
        h={3.6}
      />
    </group>
  )
}

/**
 * Lũy tre: bamboo clumps along the two hedge lines that enclose the village —
 * one either side of the gate, one at the far end, where it leaves a gap for
 * the lane (spanned by the bamboo arch) and steps back behind the house.
 */
export const HEDGE: [number, number, number][] = (() => {
  const out: [number, number, number][] = []
  for (let x = 5.3; x < BOARD.maxX - 0.5; x += 1.7) {
    out.push([x, K.z + Math.sin(x * 1.7) * 0.2, 0.95 + 0.15 * Math.sin(x * 3.1)])
    out.push([-x, K.z + Math.cos(x * 1.3) * 0.2, 0.95 + 0.15 * Math.cos(x * 2.3)])
  }
  // the corner of the thatch nearest the hedge
  const [hx, hz] = houseToWorld(-2.2, -1.8)
  for (let x = 3.1; x < BOARD.maxX - 0.5; x += 1.6) {
    const behindHouse = x > 2.4 && x < 7.4
    const z = VILLAGE_END - (behindHouse ? 0.3 : 0) + Math.sin(x * 1.7) * (behindHouse ? 0.05 : 0.25)
    // a clump that would grow through the eave stands a step aside instead
    const hit = Math.hypot(x - hx, z - hz) < 1.35
    out.push([hit ? x - 0.75 : x, hit ? z - 0.2 : z, 0.95 + 0.15 * Math.sin(x * 3.1)])
    out.push([-x, VILLAGE_END + Math.cos(x * 1.3) * 0.25, 0.95 + 0.15 * Math.cos(x * 2.3)])
  }
  return out
})()
