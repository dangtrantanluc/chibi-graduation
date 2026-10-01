import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '../lib/kit'
import { grade } from '../grade'

/*
 * The rim of the world: the mountains of northern Việt Nam, three deep.
 *   far    the long ridges of Hoàng Liên Sơn, layer behind layer, paling into haze
 *   middle karst towers (núi đá vôi — Tràng An, Hạ Long, Đồng Văn): sheer grey
 *          limestone with a cap of forest, standing out of the sea of cloud
 *   near   terraced rice hills (ruộng bậc thang — Mù Cang Chải, Sa Pa), gold at
 *          harvest, a few stilt houses on their steps
 * All of it is unlit: light, mist and distance are painted into the vertex
 * colours, so the whole rim costs three draw calls.
 */

const SUN = new THREE.Vector3(-0.62, 0.3, -0.72).normalize()
const CENTER = new THREE.Vector3(0, 0, -31)
const HAZE = new THREE.Color('#f1cbb6') // the peach mist the bases stand in
const AIR = new THREE.Color('#c6b6cf') // what distance does to colour
const WARM = new THREE.Color('#ffd2a0')

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** bake sun, base mist and distance into a surface colour */
function lit(c: THREE.Color, n: THREE.Vector3, mist: number, air: number) {
  const d = Math.max(0, n.dot(SUN))
  c.multiplyScalar(0.6 + 0.4 * d).lerp(WARM, 0.2 * d)
  c.lerp(AIR, air).lerp(HAZE, mist)
  return c
}

/**
 * A karst tower: sheer, lobed sides and a rounded crown. Limestone shows
 * wherever it is too steep for anything to grow; forest caps the top and
 * clings to the ledges.
 */
function karst(seed: number, R: number, H: number, air: number): THREE.BufferGeometry {
  const r = rng(seed)
  const NA = 24
  const NY = 13
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28]
  const lean = [(r() - 0.5) * 0.3 * R, (r() - 0.5) * 0.3 * R]
  const sharp = 1.7 + r() * 1.6
  const pos: number[] = []
  for (let j = 0; j <= NY; j++) {
    const t = j / NY
    const prof = Math.pow(Math.max(0, 1 - Math.pow(t, sharp)), 0.5) * (1 + 0.38 * Math.pow(1 - t, 3))
    for (let i = 0; i <= NA; i++) {
      const th = (i / NA) * Math.PI * 2
      const lobes = 1 + 0.17 * Math.sin(th * 2 + ph[0] + t * 2) + 0.1 * Math.sin(th * 3 + ph[1]) + 0.07 * Math.sin(th * 5 + ph[2] + t * 4)
      const rad = R * prof * lobes
      pos.push(Math.cos(th) * rad + lean[0] * t, t * H * (1 + 0.05 * Math.sin(th * 2 + ph[3])), Math.sin(th) * rad + lean[1] * t)
    }
  }
  const idx: number[] = []
  const row = NA + 1
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NA; i++) {
      const a = j * row + i
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const nrm = g.attributes.normal as THREE.BufferAttribute
  const col = new Float32Array((pos.length / 3) * 3)
  const c = new THREE.Color()
  const rock = new THREE.Color()
  const veg = new THREE.Color()
  const n = new THREE.Vector3()
  for (let j = 0; j <= NY; j++) {
    const t = j / NY
    for (let i = 0; i <= NA; i++) {
      const k = j * row + i
      const th = (i / NA) * Math.PI * 2
      n.fromBufferAttribute(nrm, k)
      // limestone: pale grey, streaked dark where water runs down it
      const streak = 0.5 + 0.5 * Math.sin(th * 9 + ph[2]) * Math.sin(th * 4 + ph[0])
      rock.set('#9a9cae').lerp(c.set('#6f728a'), smooth(0.45, 0.95, streak))
      veg.set('#4a7a4e').lerp(c.set('#7da25a'), 0.5 + 0.5 * Math.sin(th * 6 + t * 7 + ph[1]))
      // forest on the crown, and in shrubby patches on ledges lower down
      const cling = smooth(0.55, 0.85, Math.sin(th * 5 + t * 11 + ph[3]) * Math.sin(t * 13 + ph[0]))
      const green = Math.max(smooth(0.3, 0.62, n.y), smooth(0.6, 0.9, t), cling * 0.75)
      c.copy(rock).lerp(veg, green)
      lit(c, n, 1 - smooth(0.04, 0.46, t), air).toArray(col, k * 3)
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.deleteAttribute('normal')
  return g
}

const FIELDS = ['#f0c648', '#f0c648', '#e6b53a', '#f3d267', '#b7cf52', '#8fb648', '#c3dbe0', '#d9b064']

/**
 * A terraced rice hill: dozens of narrow contour terraces stepping up a broad,
 * lobed slope — treads of ripe rice, green seedlings or flooded mirrors, a
 * dark grassy bank between each — under a cap of forest, with a few stilt
 * houses (nhà sàn). The summit sits off-centre and the contours wander, so it
 * reads as a hillside, not a pyramid.
 */
function terraced(seed: number, R: number, H: number, steps: number, air: number): THREE.BufferGeometry {
  const r = rng(seed)
  const NA = 64
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28]
  const drift = [(r() - 0.5) * 0.5 * R, (r() - 0.5) * 0.5 * R]
  const contour = (th: number, k: number) =>
    1 + 0.26 * Math.sin(th * 2 + ph[0] + k * 0.02) + 0.15 * Math.sin(th * 3 + ph[1]) + 0.08 * Math.sin(th * 5 + ph[2] + k * 0.05) + 0.04 * Math.sin(th * 9 + ph[3])
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()
  const n = new THREE.Vector3()
  // open ground catches the low sun: treads are shaded as if tipped a little toward it
  const open = new THREE.Vector3(0, 0.6, 0).addScaledVector(SUN, 0.8).normalize()
  // gentle, wide terraces low down; steeper and narrower toward the top
  // (the terraces stop at a broad shoulder; a rounded, wooded crown sits on it)
  const radius = (k: number) => R * (1 - 0.76 * Math.pow(k / steps, 0.88))
  const height = (k: number) => H * 0.82 * Math.pow(k / steps, 1.15)
  const centre = (k: number): [number, number] => {
    const t = Math.pow(k / steps, 1.5)
    return [drift[0] * t, drift[1] * t]
  }
  /** one ring of vertices on terrace k; returns the index of its first vertex */
  const ring = (k: number, rad: number, y: number, paint: (th: number) => THREE.Color, normal: (th: number) => THREE.Vector3) => {
    const start = pos.length / 3
    const [cx, cz] = centre(k)
    for (let i = 0; i <= NA; i++) {
      const th = (i / NA) * Math.PI * 2
      const rr = rad * contour(th, k)
      pos.push(cx + Math.cos(th) * rr, y, cz + Math.sin(th) * rr)
      lit(paint(th), normal(th), (1 - smooth(0.0, 0.26, y / H)) * 0.9, air).toArray(col, col.length)
    }
    return start
  }
  const band = (a: number, b: number) => {
    for (let i = 0; i < NA; i++) idx.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1)
  }
  for (let k = 0; k < steps; k++) {
    // the fields of one terrace: a patchwork, each plot a few degrees of arc
    const plots = 7 + ((k * 5) % 6)
    const hue = Array.from({ length: plots }, () => FIELDS[Math.floor(r() * FIELDS.length)])
    const field = (th: number) => c.set(hue[Math.floor(((th / (Math.PI * 2)) * plots + k * 0.37) % plots)])
    const bank = () => c.set('#4d7436')
    const flat = () => n.copy(open)
    const out = (th: number) => n.set(Math.cos(th), 0.2, Math.sin(th)).normalize()
    const y0 = height(k)
    const y1 = height(k + 1)
    // tread, then the bank up to the next one
    band(ring(k, radius(k), y0, field, flat), ring(k, radius(k + 1), y0, field, flat))
    band(ring(k, radius(k + 1), y0, bank, out), ring(k + 1, radius(k + 1), y1, bank, out))
  }
  // the wooded crown: a smooth dome over the shoulder
  const DOME = 6
  let prev = -1
  for (let j = 0; j <= DOME; j++) {
    const a = (j / DOME) * (Math.PI / 2)
    const rad = radius(steps) * Math.cos(a) * (j === DOME ? 0.02 : 1)
    const y = height(steps) + H * 0.24 * Math.sin(a)
    const tone = j % 2 ? '#3f7448' : '#4f8450'
    const cur = ring(steps, rad, y, () => c.set(tone), (th) => n.set(Math.cos(th) * Math.cos(a), 0.35 + Math.sin(a), Math.sin(th) * Math.cos(a)).normalize())
    if (prev >= 0) band(prev, cur)
    prev = cur
  }
  // stilt houses on a few of the lower terraces: a dark thatch roof over a timber box
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    const s = pos.length / 3
    for (const [dx, dy, dz] of [
      [-1, 0, -1],
      [1, 0, -1],
      [1, 0, 1],
      [-1, 0, 1],
      [-1, 1, -1],
      [1, 1, -1],
      [1, 1, 1],
      [-1, 1, 1],
    ]) {
      pos.push(x + (dx * w) / 2, y + dy * h, z + (dz * d) / 2)
      lit(c.set(color), n.set(dx, dy ? 0.8 : 0.1, dz).normalize(), 0, air).toArray(col, col.length)
    }
    for (const f of [
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
      [4, 5, 6, 7],
    ])
      idx.push(s + f[0], s + f[2], s + f[1], s + f[0], s + f[3], s + f[2])
  }
  for (let h = 0; h < 8; h++) {
    const k = 5 + Math.floor(r() * (steps - 12))
    const th = r() * Math.PI * 2
    const [cx, cz] = centre(k)
    const rr = ((radius(k) + radius(k + 1)) / 2) * contour(th, k)
    const x = cx + Math.cos(th) * rr
    const z = cz + Math.sin(th) * rr
    const y = height(k)
    const s = R * 0.026
    box(x, y + s * 0.5, z, s * 1.5, s * 0.7, s * 1.1, '#8a6846')
    box(x, y + s * 1.2, z, s * 2.0, s * 0.55, s * 1.6, '#4c3b30')
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

/** One stretch of a far range, as an ink-wash silhouette: pointed summits, shoulders, a serrated crest. */
function ridge(seed: number, width: number, height: number, top: string, base: string): THREE.BufferGeometry {
  const r = rng(seed)
  const peaks = Array.from({ length: 6 + Math.floor(r() * 4) }, () => ({
    x: (r() - 0.5) * width * 0.92,
    w: width * (0.1 + r() * 0.16),
    h: height * (0.42 + r() * 0.58),
    e: 1.2 + r() * 0.9,
  }))
  const ph = [r() * 6.28, r() * 6.28]
  const N = 140
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  for (let i = 0; i <= N; i++) {
    const x = -width / 2 + (i / N) * width
    let y = height * 0.1
    for (const p of peaks) {
      const d = Math.abs(x - p.x) / p.w
      if (d < 1) y = Math.max(y, p.h * Math.pow(1 - d, p.e))
    }
    // the crest is never smooth: spurs and notches
    y += height * (0.025 * Math.sin(x * 0.21 + ph[0]) + 0.016 * Math.sin(x * 0.53 + ph[1])) * (0.4 + y / height)
    // the range sinks away at both ends, so stretches overlap without a seam
    y *= smooth(0, 0.12, i / N) * smooth(0, 0.12, 1 - i / N)
    shape.lineTo(x, Math.max(y, 0))
  }
  shape.lineTo(width / 2, 0)
  shape.lineTo(-width / 2, 0)
  const g = new THREE.ShapeGeometry(shape, 1)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const ct = new THREE.Color(top)
  const cb = new THREE.Color(base)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp(pos.getY(i) / height, 0, 1)
    c.copy(cb).lerp(ct, Math.pow(k, 0.65)).toArray(col, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  return g
}

const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z))

export function Ranges() {
  const meshes = useMemo(() => {
    const r = rng(1954)
    // ── far: three ranges, each a ring of overlapping stretches, paler with distance ──
    const far: THREE.BufferGeometry[] = []
    const layers = [
      { rad: 185, n: 9, w: 170, h: 66, top: '#5d6f9c', base: '#e8bfae', y: -34 },
      { rad: 250, n: 10, w: 220, h: 96, top: '#8088b4', base: '#efc5ad', y: -40 },
      { rad: 330, n: 11, w: 280, h: 132, top: '#a79fc6', base: '#f5cbae', y: -46 },
    ]
    layers.forEach((L, li) => {
      for (let i = 0; i < L.n; i++) {
        const a = (i / L.n) * Math.PI * 2 + li * 0.37
        far.push(place(ridge(li * 100 + i + 7, L.w, L.h * (0.75 + r() * 0.4), L.top, L.base), Math.sin(a) * L.rad + CENTER.x, L.y, Math.cos(a) * L.rad + CENTER.z, a + Math.PI))
      }
    })
    // ── middle: karst towers in clusters all round, thickest behind Huế (−z), where most shots look ──
    const towers: THREE.BufferGeometry[] = []
    const clusters = 13
    for (let k = 0; k < clusters; k++) {
      const a = (k / clusters) * Math.PI * 2 + (r() - 0.5) * 0.25
      const back = 0.5 - 0.5 * Math.cos(a) // 1 behind Huế, 0 in front of Bình Định
      const count = 2 + Math.floor(r() * 2 + back * 2.2)
      const dist = 92 + r() * 38
      for (let i = 0; i < count; i++) {
        const aa = a + (r() - 0.5) * 0.3
        const d = dist + (r() - 0.5) * 34
        const R = 6 + r() * 9
        const H = (30 + r() * 30) * (0.8 + 0.35 * back)
        towers.push(place(karst(k * 31 + i * 7 + 3, R, H, THREE.MathUtils.clamp((d - 70) / 240, 0.06, 0.38)), Math.sin(aa) * d * 0.92 + CENTER.x, -23, Math.cos(aa) * d + CENTER.z, r() * 6.28))
      }
    }
    // ── near: terraced hills beside and behind the board ──
    const hills: THREE.BufferGeometry[] = []
    const HILLS: [number, number, number, number, number][] = [
      // x, z, radius, height, base y
      [72, -4, 38, 24, -12],
      [-74, -26, 40, 26, -13],
      [76, -62, 42, 27, -13],
      [-68, -86, 36, 23, -12],
      [42, -150, 46, 27, -14],
      [-50, -142, 38, 23, -13],
      [-54, 50, 36, 21, -12],
    ]
    HILLS.forEach(([x, z, R, H, y], i) => hills.push(place(terraced(71 + i * 13, R, H, 34, 0.05 + Math.hypot(x, z + 31) / 1100), x, y, z, r() * 6.28)))
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })
    const flat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })
    const mk = (geos: THREE.BufferGeometry[], m: THREE.Material, order: number) => {
      const mesh = new THREE.Mesh(mergeGeometries(geos), m)
      mesh.renderOrder = order
      mesh.frustumCulled = false
      geos.forEach((g) => g.dispose())
      return mesh
    }
    return { list: [mk(far, flat, -6), mk(towers, mat, -4), mk(hills, mat, -3)], mats: [mat, flat] }
  }, [])
  // the painted rim takes the tint of the hour; by night it sinks to deep blue silhouettes
  useFrame(() => meshes.mats.forEach((m) => m.color.copy(grade.range)))
  return (
    <>
      {meshes.list.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}
