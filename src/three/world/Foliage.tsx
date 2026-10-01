import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { blob, G, mergeKit, rng, type Part, type V3 } from '../lib/kit'
import { cardMat, kitMat } from '../lib/materials'
import { InstancedKit, type Item } from '../lib/InstancedKit'
import { frondTex, leafAtlas, type LeafKind } from '../lib/foliageTex'
import { taperTube } from '../characters/hair'
import { BAMBOO, BUSHES, FLOWERS, GRASS, ROCKS, TREES, type TreeKind } from './placements'
import { HEDGE } from './Village'
import { TOPIARY, VILLAGE_END } from '../layout'
import { RICE, riceKit } from './BinhDinh'

/*
 * Stylised "anime" trees: tapered trunks + canopies made of hundreds of
 * hand-painted leaf/blossom cards. Each card's normal points out of its clump,
 * so a canopy shades like one soft volume (the Ghibli / Genshin trick), and the
 * cel ramp gives it a clean lit/shadow split.
 */

interface Clump {
  c: V3
  r: number
  n: number
  flat?: number
  size?: [number, number]
}

const Y = new THREE.Vector3(0, 1, 0)

function cardCanopy(seed: number, clumps: Clump[], horizontal = false) {
  const r = rng(seed)
  const pos: number[] = []
  const nrm: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ]
  for (const cl of clumps) {
    const [cx, cy, cz] = cl.c
    const flat = cl.flat ?? 1
    const [smin, smax] = cl.size ?? [0.55, 0.85]
    for (let i = 0; i < cl.n; i++) {
      // point on/in the clump, biased to the outer shell and the top
      const th = r() * Math.PI * 2
      const cosPhi = THREE.MathUtils.lerp(-0.55, 1, Math.pow(r(), 0.8))
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi)
      const d = cl.r * (0.5 + 0.5 * Math.sqrt(r()))
      const px = cx + Math.cos(th) * sinPhi * d
      const py = cy + cosPhi * d * flat
      const pz = cz + Math.sin(th) * sinPhi * d
      const s = THREE.MathUtils.lerp(smin, smax, r())
      if (horizontal) q.setFromEuler(e.set(-Math.PI / 2 + (r() - 0.5) * 0.7, r() * 6.28, (r() - 0.5) * 0.7))
      else q.setFromEuler(e.set(r() * 6.28, r() * 6.28, r() * 6.28))
      n.set(px - cx, (py - cy) / Math.max(flat, 0.3), pz - cz).normalize().addScaledVector(Y, 0.35).normalize()
      const cell = Math.floor(r() * 4)
      const u0 = (cell % 2) * 0.5
      const v0 = Math.floor(cell / 2) * 0.5
      const h = THREE.MathUtils.clamp((py - (cy - cl.r * flat)) / (2 * cl.r * flat), 0, 1)
      const shade = 0.72 + 0.32 * h + (r() - 0.5) * 0.08
      const base = pos.length / 3
      for (const [a, b] of corners) {
        v.set(a * s, b * s, 0).applyQuaternion(q)
        pos.push(px + v.x, py + v.y, pz + v.z)
        nrm.push(n.x, n.y, n.z)
        uv.push(u0 + (a + 0.5) * 0.5, v0 + (b + 0.5) * 0.5)
        col.push(shade, shade, shade)
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const bark = (pts: THREE.Vector3[], r0: number, r1: number, c = '#5b3b2e'): Part => ({ g: taperTube(pts, r0, r1, 12, 8), c, m: 'wood' })

interface TreeSpec {
  leaf: LeafKind
  trunk: () => Part[]
  clumps: Clump[]
  horizontal?: boolean
  sway?: number
}

const SPECS: Record<Exclude<TreeKind, 'coconut'>, TreeSpec> = {
  phuong: {
    // phượng vĩ: a low, wide umbrella of feathery leaves set alight with red
    leaf: 'phuong',
    trunk: () => [
      bark([V(0, 0, 0), V(0.1, 0.9, 0.05), V(0.0, 1.7, 0)], 0.2, 0.1, '#6b5a4e'),
      bark([V(0.0, 1.5, 0), V(-0.9, 2.1, 0.2), V(-1.7, 2.45, 0.3)], 0.1, 0.035, '#6b5a4e'),
      bark([V(0.0, 1.6, 0), V(0.9, 2.2, -0.2), V(1.8, 2.5, -0.25)], 0.1, 0.035, '#6b5a4e'),
      bark([V(0.0, 1.7, 0), V(0.2, 2.3, 0.9), V(0.3, 2.55, 1.6)], 0.08, 0.03, '#6b5a4e'),
      bark([V(0.0, 1.7, 0), V(-0.1, 2.35, -0.9), V(-0.2, 2.6, -1.5)], 0.08, 0.03, '#6b5a4e'),
    ],
    clumps: [
      { c: [0, 2.75, 0], r: 1.3, n: 70, flat: 0.45 },
      { c: [-1.6, 2.55, 0.3], r: 1.0, n: 46, flat: 0.45 },
      { c: [1.6, 2.6, -0.2], r: 1.0, n: 46, flat: 0.45 },
      { c: [0.3, 2.65, 1.5], r: 0.9, n: 40, flat: 0.45 },
      { c: [-0.2, 2.7, -1.4], r: 0.9, n: 40, flat: 0.45 },
    ],
    sway: 0.018,
  },
  autumn: {
    // a Hà Nội street tree turned gold
    leaf: 'autumn',
    trunk: () => [
      bark([V(0, 0, 0), V(0.12, 1.2, 0.05), V(-0.1, 2.1, 0), V(0.05, 2.9, 0.1)], 0.17, 0.06, '#5a4638'),
      bark([V(-0.05, 1.7, 0), V(-0.75, 2.4, 0.2), V(-1.05, 2.8, 0.3)], 0.08, 0.03, '#5a4638'),
      bark([V(0.0, 1.9, 0), V(0.75, 2.6, -0.2), V(1.05, 2.95, -0.2)], 0.08, 0.03, '#5a4638'),
    ],
    clumps: [
      { c: [0.05, 3.1, 0], r: 1.25, n: 72 },
      { c: [-1.0, 2.8, 0.3], r: 0.85, n: 44 },
      { c: [1.05, 2.95, -0.2], r: 0.85, n: 44 },
      { c: [0.15, 3.8, -0.1], r: 0.8, n: 38 },
      { c: [-0.3, 3.4, 0.75], r: 0.7, n: 30 },
    ],
    sway: 0.022,
  },
  hoasua: {
    // hoa sữa: a tall trunk with layered, pagoda-like tiers of leaf whorls
    leaf: 'hoasua',
    trunk: () => [bark([V(0, 0, 0), V(0.05, 1.5, 0), V(0, 3.6, 0.05)], 0.16, 0.06, '#6b5a4e')],
    clumps: [
      { c: [0, 1.95, 0], r: 1.35, n: 48, flat: 0.32 },
      { c: [0, 2.75, 0], r: 1.1, n: 40, flat: 0.32 },
      { c: [0, 3.45, 0], r: 0.85, n: 32, flat: 0.34 },
      { c: [0, 4.0, 0], r: 0.55, n: 20, flat: 0.4 },
    ],
    horizontal: true,
    sway: 0.014,
  },
  banyan: {
    // cây đa: a huge fluted trunk with buttress roots and curtains of aerial roots
    leaf: 'banyan',
    trunk: () => {
      const p: Part[] = []
      const BK = '#5f5448'
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        p.push(bark([V(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35), V(Math.cos(a) * 0.22, 1.2, Math.sin(a) * 0.22), V(Math.cos(a) * 0.1, 2.4, Math.sin(a) * 0.1)], 0.26, 0.12, BK))
        // buttress roots flaring over the ground
        p.push(bark([V(Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3), V(Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75), V(Math.cos(a) * 1.15, -0.05, Math.sin(a) * 1.15)], 0.13, 0.04, BK))
      }
      const limbs: [number, number][] = [
        [0.2, 2.6],
        [2.2, 2.4],
        [4.1, 2.5],
        [5.3, 2.3],
      ]
      for (const [a, len] of limbs) {
        const end = V(Math.cos(a) * len, 3.0, Math.sin(a) * len)
        p.push(bark([V(0, 2.2, 0), V(Math.cos(a) * len * 0.5, 2.9, Math.sin(a) * len * 0.5), end], 0.16, 0.06, BK))
        // aerial roots hanging from each limb
        for (let k = 1; k <= 4; k++) {
          const t = k / 5
          const x = Math.cos(a) * len * t
          const z = Math.sin(a) * len * t
          const y = 2.9 - 0.2 * t
          p.push({ g: G.cylXs, c: '#7a6c5c', m: 'wood', p: [x, y / 2, z], s: [0.018, y, 0.018] })
        }
      }
      return p
    },
    clumps: [
      { c: [0, 3.7, 0], r: 1.9, n: 110, flat: 0.62 },
      { c: [2.0, 3.35, 0.4], r: 1.3, n: 60, flat: 0.6 },
      { c: [-1.7, 3.4, -0.6], r: 1.3, n: 60, flat: 0.6 },
      { c: [0.5, 3.4, 2.0], r: 1.2, n: 56, flat: 0.6 },
      { c: [-0.6, 3.5, -2.0], r: 1.2, n: 56, flat: 0.6 },
      { c: [0.2, 4.5, 0.1], r: 1.1, n: 44, flat: 0.6 },
    ],
    sway: 0.01,
  },
  pine: {
    leaf: 'pine',
    horizontal: true,
    trunk: () => [
      bark([V(0, 0, 0), V(0.35, 1.0, 0), V(-0.1, 1.9, 0.1), V(0.3, 2.9, 0), V(0.25, 3.5, 0.1)], 0.18, 0.06, '#4f3a31'),
      bark([V(0.2, 1.4, 0), V(0.8, 1.7, 0.1), V(1.3, 1.95, 0.2)], 0.08, 0.03, '#4f3a31'),
      bark([V(0.0, 2.2, 0.05), V(-0.6, 2.5, 0), V(-1.2, 2.65, -0.1)], 0.07, 0.03, '#4f3a31'),
    ],
    clumps: [
      { c: [1.35, 2.05, 0.2], r: 0.8, n: 34, flat: 0.3, size: [0.5, 0.75] },
      { c: [-1.25, 2.72, -0.1], r: 0.75, n: 30, flat: 0.3, size: [0.5, 0.75] },
      { c: [0.35, 3.1, 0], r: 0.95, n: 42, flat: 0.3, size: [0.5, 0.8] },
      { c: [0.25, 3.62, 0.1], r: 0.58, n: 22, flat: 0.32, size: [0.45, 0.65] },
    ],
    sway: 0.012,
  },
  mai: {
    leaf: 'mai',
    trunk: () => [
      bark([V(0, 0, 0), V(-0.1, 0.9, 0.05), V(-0.35, 1.8, 0.1)], 0.1, 0.035, '#5a3b2e'),
      bark([V(0, 0, 0), V(0.15, 0.9, -0.05), V(0.45, 1.7, -0.1)], 0.09, 0.03, '#5a3b2e'),
      bark([V(0, 0, 0), V(0.05, 1.1, 0.1), V(0.1, 2.3, 0.05)], 0.09, 0.03, '#5a3b2e'),
    ],
    clumps: [
      { c: [0, 2.15, 0], r: 0.95, n: 52 },
      { c: [-0.7, 1.85, 0.3], r: 0.65, n: 32 },
      { c: [0.7, 1.95, -0.2], r: 0.65, n: 32 },
      { c: [0.1, 2.65, 0], r: 0.6, n: 26 },
    ],
    sway: 0.024,
  },
  green: {
    leaf: 'green',
    trunk: () => [bark([V(0, 0, 0), V(0.05, 1.2, 0), V(0, 2.0, 0)], 0.14, 0.06, '#5e4232')],
    clumps: [
      { c: [0, 2.35, 0], r: 1.05, n: 60 },
      { c: [-0.62, 2.05, 0.3], r: 0.7, n: 32 },
      { c: [0.62, 2.12, -0.2], r: 0.72, n: 32 },
      { c: [0.1, 2.95, 0], r: 0.7, n: 30 },
    ],
    sway: 0.018,
  },
}

/** Trunks (instanced, one material) + canopy cards (instanced, one material) per tree kind. */
function TreeKindMesh({ kind, items }: { kind: Exclude<TreeKind, 'coconut'>; items: Item[] }) {
  const meshes = useMemo(() => {
    const spec = SPECS[kind]
    const trunkGeo = mergeKit(spec.trunk()).get('wood')!
    const canopy = cardCanopy(kind.length * 17 + 3, spec.clumps, spec.horizontal)
    const trunk = new THREE.InstancedMesh(trunkGeo, kitMat('wood'), items.length)
    const leaves = new THREE.InstancedMesh(canopy, cardMat(leafAtlas(spec.leaf), kind, spec.sway ?? 0.02), items.length)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    items.forEach((it, i) => {
      const s = typeof it.s === 'number' ? it.s : it.s[0]
      m4.compose(new THREE.Vector3(...it.p), q.setFromEuler(e.set(0, it.ry, 0)), new THREE.Vector3(s, s, s))
      trunk.setMatrixAt(i, m4)
      leaves.setMatrixAt(i, m4)
    })
    for (const m of [trunk, leaves]) {
      m.castShadow = true
      m.receiveShadow = true
      m.computeBoundingSphere()
    }
    return [trunk, leaves]
  }, [kind, items])
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}

/** Bamboo: culms + clusters of blade cards near the tops. */
function Bamboo({ items }: { items: Item[] }) {
  const meshes = useMemo(() => {
    const r = rng(9)
    const culms: Part[] = []
    const clumps: Clump[] = []
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2
      const d = r() * 0.7
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      const h = 3.2 + r() * 1.6
      const lean = (r() - 0.5) * 0.12
      culms.push({ g: G.cylXs, c: i % 3 ? '#86b35e' : '#9cc36b', m: 'wood', p: [x + lean * h * 0.5, h / 2, z], r: [0, 0, -lean], s: [0.05, h, 0.05] })
      for (let y = 0.6; y < h; y += 0.8) culms.push({ g: G.cylXs, c: '#6f9a4c', m: 'wood', p: [x + lean * y, y, z], r: [0, 0, -lean], s: [0.058, 0.035, 0.058] })
      clumps.push({ c: [x + lean * h, h - 0.55, z], r: 0.55, n: 16, flat: 1.3, size: [0.6, 0.9] })
      clumps.push({ c: [x + lean * h * 0.7, h * 0.72, z], r: 0.4, n: 8, size: [0.5, 0.8] })
    }
    const culmGeo = mergeKit(culms).get('wood')!
    const leafGeo = cardCanopy(77, clumps)
    const a = new THREE.InstancedMesh(culmGeo, kitMat('wood'), items.length)
    const b = new THREE.InstancedMesh(leafGeo, cardMat(leafAtlas('bamboo'), 'bamboo', 0.03), items.length)
    const m4 = new THREE.Matrix4()
    items.forEach((it, i) => {
      const s = typeof it.s === 'number' ? it.s : it.s[0]
      m4.compose(new THREE.Vector3(...it.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.ry, 0)), new THREE.Vector3(s, s, s))
      a.setMatrixAt(i, m4)
      b.setMatrixAt(i, m4)
    })
    for (const m of [a, b]) {
      m.castShadow = true
      m.receiveShadow = true
      m.computeBoundingSphere()
    }
    return [a, b]
  }, [items])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}

/** Where the lane leaves the village: bamboo leaning in from both sides until it meets overhead. */
function BambooArch({ z }: { z: number }) {
  const meshes = useMemo(() => {
    const r = rng(41)
    const culms: Part[] = []
    const clumps: Clump[] = []
    for (const s of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const bx = s * (1.55 + r() * 0.6)
        const bz = (r() - 0.5) * 1.1
        const h = 3.4 + r() * 0.9
        const reach = 1.5 + r() * 0.9
        const tz = bz + (r() - 0.5) * 0.5
        const mz = (bz + tz) / 2
        const pts = [new THREE.Vector3(bx, 0, bz), new THREE.Vector3(bx - s * 0.06, h * 0.45, bz), new THREE.Vector3(bx - s * reach * 0.38, h * 0.82, mz), new THREE.Vector3(bx - s * reach, h * 0.94, tz)]
        culms.push({ g: taperTube(pts, 0.05, 0.018, 14, 6), c: i % 3 ? '#86b35e' : '#9cc36b', m: 'wood' })
        clumps.push({ c: [bx - s * reach * 0.9, h * 0.94, tz], r: 0.52, n: 16, flat: 0.75, size: [0.6, 0.9] })
        clumps.push({ c: [bx - s * reach * 0.42, h * 0.87, mz], r: 0.4, n: 9, flat: 0.75, size: [0.5, 0.8] })
      }
    }
    const a = new THREE.Mesh(mergeKit(culms).get('wood')!, kitMat('wood'))
    const b = new THREE.Mesh(cardCanopy(78, clumps), cardMat(leafAtlas('bamboo'), 'bamboo', 0.03))
    for (const m of [a, b]) {
      m.position.set(0, 0, z)
      m.castShadow = true
      m.receiveShadow = true
    }
    return [a, b]
  }, [z])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}

/** Clipped shrubs (green box and flowering hibiscus) as small card clumps. */
function Bushes({ items }: { items: Item[] }) {
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = []
    const groups: [LeafKind, Item[]][] = [
      ['green', items.filter((_, i) => i % 3 !== 0)],
      ['phuong', items.filter((_, i) => i % 3 === 0)],
    ]
    for (const [leaf, list] of groups) {
      if (!list.length) continue
      const geo = cardCanopy(leaf.length * 5, [
        { c: [0, 0.42, 0], r: 0.55, n: 26, flat: 0.75, size: [0.3, 0.45] },
        { c: [0.42, 0.3, 0.12], r: 0.38, n: 14, flat: 0.75, size: [0.28, 0.4] },
        { c: [-0.38, 0.28, -0.1], r: 0.36, n: 14, flat: 0.75, size: [0.28, 0.4] },
      ])
      const m = new THREE.InstancedMesh(geo, cardMat(leafAtlas(leaf), `bush-${leaf}`, 0.008), list.length)
      const m4 = new THREE.Matrix4()
      list.forEach((it, i) => {
        const s = typeof it.s === 'number' ? it.s : it.s[0]
        m4.compose(new THREE.Vector3(...it.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.ry, 0)), new THREE.Vector3(s * 1.2, s, s * 1.2))
        m.setMatrixAt(i, m4)
      })
      m.castShadow = true
      m.receiveShadow = true
      m.computeBoundingSphere()
      out.push(m)
    }
    return out
  }, [items])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}

/**
 * Coconut palms (Bình Định, "xứ dừa"): a leaning ringed trunk, a clutch of
 * nuts, and a crown of long arching fronds — alpha-tested pinnate cards.
 */
function CoconutPalms({ items }: { items: Item[] }) {
  const meshes = useMemo(() => {
    const top = V(0.75, 3.45, 0.1)
    const pts = [V(0, 0, 0), V(0.12, 1.2, 0.04), V(0.4, 2.4, 0.08), top]
    const trunk: Part[] = [{ g: taperTube(pts, 0.14, 0.085, 12, 7), c: '#8a7560', m: 'wood' }]
    const curve = new THREE.CatmullRomCurve3(pts)
    for (let k = 1; k < 11; k++) {
      const pt = curve.getPointAt(k / 11)
      trunk.push({ g: G.torusLo, c: '#6f5e4c', m: 'wood', p: [pt.x, pt.y, pt.z], r: [Math.PI / 2, 0, 0], s: [0.13 - k * 0.003, 0.13 - k * 0.003, 0.15] })
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      trunk.push({ g: G.sphereXs, c: k % 2 ? '#7a9a3a' : '#8a6a3a', m: 'wood', p: [top.x + Math.cos(a) * 0.12, top.y - 0.12, top.z + Math.sin(a) * 0.12], s: 0.1 })
    }
    const trunkGeo = mergeKit(trunk).get('wood')!
    // fronds: arching strips, u across the leaf, v from base to tip
    const pos: number[] = []
    const nrm: number[] = []
    const uv: number[] = []
    const col: number[] = []
    const idx: number[] = []
    const N = 12
    const SEG = 10
    for (let f = 0; f < N; f++) {
      const a = (f / N) * Math.PI * 2 + (f % 2) * 0.2
      const up = f % 3 === 0 ? 0.55 : 0.25
      const len = 1.55 + (f % 2) * 0.25
      const dir = V(Math.cos(a), 0, Math.sin(a))
      const side = V(-Math.sin(a), 0, Math.cos(a))
      for (let j = 0; j <= SEG; j++) {
        const t = j / SEG
        const c = top.clone().addScaledVector(dir, len * t)
        c.y += up * t * 1.4 - 1.25 * t * t
        const w = 0.34 * Math.sin(Math.min(1, t * 1.15) * Math.PI) + 0.04
        for (const s of [-1, 1]) {
          const q = c.clone().addScaledVector(side, s * w)
          pos.push(q.x, q.y, q.z)
          const n = V(0, 1, 0).addScaledVector(dir, 0.3).normalize()
          nrm.push(n.x, n.y, n.z)
          uv.push(s < 0 ? 0 : 1, 1 - t)
          const sh = 0.8 + 0.25 * (1 - t)
          col.push(sh, sh, sh)
        }
        if (j < SEG) {
          const b = (f * (SEG + 1) + j) * 2
          idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
        }
      }
    }
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    fg.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    fg.setIndex(idx)
    fg.computeBoundingSphere()
    const a = new THREE.InstancedMesh(trunkGeo, kitMat('wood'), items.length)
    const b = new THREE.InstancedMesh(fg, cardMat(frondTex(), 'frond', 0.03), items.length)
    const m4 = new THREE.Matrix4()
    items.forEach((it, i) => {
      const s = typeof it.s === 'number' ? it.s : it.s[0]
      m4.compose(new THREE.Vector3(...it.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.ry, 0)), new THREE.Vector3(s, s, s))
      a.setMatrixAt(i, m4)
      b.setMatrixAt(i, m4)
    })
    for (const m of [a, b]) {
      m.castShadow = true
      m.receiveShadow = true
      m.computeBoundingSphere()
    }
    return [a, b]
  }, [items])
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}

const grassKit = (): Part[] => [
  { g: G.coneLo, c: '#5f8f3e', m: 'foliage', p: [0, 0.13, 0], r: [0, 0, 0.2], s: [0.04, 0.26, 0.04] },
  { g: G.coneLo, c: '#74a548', m: 'foliage', p: [0.05, 0.1, 0.03], r: [0.2, 0, -0.35], s: [0.035, 0.2, 0.035] },
  { g: G.coneLo, c: '#4f7f36', m: 'foliage', p: [-0.05, 0.09, -0.02], r: [-0.25, 0, 0.4], s: [0.035, 0.18, 0.035] },
]
const rockKit = (): Part[] => [{ g: blob(81, 1, 0.22), c: '#a79d8f', m: 'stone', p: [0, 0.35, 0], s: [1, 0.7, 0.85] }]
const stemKit = (): Part[] => [
  { g: G.cylXs, c: '#6f9a4c', m: 'foliage', p: [0, 0.12, 0], s: [0.012, 0.24, 0.012] },
  { g: G.sphereXs, c: '#6f9a4c', m: 'foliage', p: [0.04, 0.08, 0], s: [0.045, 0.015, 0.025] },
]

/** Flat five-petal blossom (a scalloped disc, slightly cupped). */
function petalDisc() {
  const shape = new THREE.Shape()
  const n = 5
  for (let i = 0; i <= n * 6; i++) {
    const a = (i / (n * 6)) * Math.PI * 2
    const rr = 0.055 * (0.62 + 0.38 * Math.abs(Math.sin((a * n) / 2)))
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  const g = new THREE.ShapeGeometry(shape, 1)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i), pos.getZ(i))
    pos.setY(i, d * d * 6)
  }
  g.computeVertexNormals()
  return g
}

function FlowerHeads() {
  const mesh = useMemo(() => {
    const parts: Part[] = [
      { g: petalDisc(), c: '#ffffff', m: 'toy', p: [0, 0.245, 0], s: [1.25, 1, 1.25] },
      { g: G.sphereXs, c: '#ffe08a', m: 'toy', p: [0, 0.255, 0], s: 0.022 },
    ]
    const g = mergeKit(parts).get('toy')!
    const im = new THREE.InstancedMesh(g, kitMat('toy'), FLOWERS.length)
    const m4 = new THREE.Matrix4()
    const c = new THREE.Color()
    const r = rng(12)
    FLOWERS.forEach(([x, z, col], i) => {
      const s = 0.8 + r() * 0.6
      m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, s, s))
      im.setMatrixAt(i, m4)
      im.setColorAt(i, c.set(col))
    })
    im.computeBoundingSphere()
    return im
  }, [])
  return <primitive object={mesh} />
}

export function Foliage() {
  const byKind = useMemo(() => {
    const out: Record<TreeKind, Item[]> = { coconut: [], phuong: [], green: [], autumn: [], hoasua: [], banyan: [], mai: [], pine: [] }
    for (const t of TREES) out[t.kind].push({ p: [t.x, 0, t.z], ry: t.ry, s: t.s })
    return out
  }, [])
  const bamboo = useMemo<Item[]>(() => [...BAMBOO, ...HEDGE].map(([x, z, s], i) => ({ p: [x, 0, z], ry: i * 1.3, s })), [])
  const rice = useMemo<Item[]>(() => RICE.map(([x, z, s], i) => ({ p: [x, 0, z], ry: i * 0.9, s })), [])
  const bushes = useMemo<Item[]>(() => BUSHES.map(([x, z, s], i) => ({ p: [x, 0, z], ry: i * 0.9, s })), [])
  const grass = useMemo<Item[]>(() => GRASS.map(([x, z, s], i) => ({ p: [x, 0, z], ry: i * 2.4, s })), [])
  const rocks = useMemo<Item[]>(() => ROCKS.map(([x, z, s], i) => ({ p: [x, -0.08, z], ry: i * 1.7, s })), [])
  const stems = useMemo<Item[]>(() => FLOWERS.map(([x, z], i) => ({ p: [x, 0, z], ry: i * 0.7, s: 1 })), [])

  return (
    <group>
      {(Object.keys(SPECS) as Exclude<TreeKind, 'coconut'>[]).map((k) => (byKind[k].length ? <TreeKindMesh key={k} kind={k} items={byKind[k]} /> : null))}
      {byKind.coconut.length > 0 && <CoconutPalms items={byKind.coconut} />}
      <Bamboo items={bamboo} />
      <BambooArch z={VILLAGE_END} />
      <InstancedKit build={riceKit} items={rice} shadow={false} />
      <Bushes items={bushes} />
      <InstancedKit build={grassKit} items={grass} shadow={false} />
      <InstancedKit build={rockKit} items={rocks} />
      <InstancedKit build={stemKit} items={stems} shadow={false} />
      <FlowerHeads />
      <Topiary x={TOPIARY.x} z={TOPIARY.z} r={TOPIARY.r} />
    </group>
  )
}

/** A clipped round topiary (campus): a dense shell of small leaf cards. */
export function Topiary({ x, z, r }: { x: number; z: number; r: number }) {
  const mesh = useMemo(() => {
    const geo = cardCanopy(515, [{ c: [0, r + 0.12, 0], r: r * 1.02, n: 260, size: [0.2, 0.3] }])
    const m = new THREE.Mesh(geo, cardMat(leafAtlas('green'), 'topiary', 0.004))
    m.position.set(x, 0, z)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }, [x, z, r])
  return <primitive object={mesh} />
}

/** A potted mai tree (for the piers of Ngọ Môn). */
export function PottedMai({ position }: { position: V3 }) {
  const items = useMemo<Item[]>(() => [{ p: position, ry: 0.4, s: 0.46 }], [position])
  return <TreeKindMesh kind="mai" items={items} />
}
