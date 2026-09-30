import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake, G, type Part } from './kit'

/**
 * Chinese hip roof with a concave profile and upturned eave corners.
 * The ridge runs along X. Origin = centre of the eave rectangle (y = 0).
 *
 * Returns kit parts: the glazed tile surface ('tile' material, UVs in world units
 * so the tile shader can draw channels) and the trim (underside rafters, fascia,
 * ridge caps and corner curls) pre-coloured in one 'trim' geometry.
 */
export interface RoofOpts {
  w: number
  d: number
  h: number
  ridge?: number
  lift?: number
  flare?: number
  curve?: number
  thick?: number
  tile?: string
  under?: string
  fascia?: string
  ridgeColor?: string
  ridgeR?: number
  segU?: number
  segV?: number
  ornaments?: boolean
  /** ridge-end ornament style: Japanese onigawara blocks or Vietnamese curls */
  style?: 'jp' | 'vn'
  /** irimoya (hip-and-gable): fraction of the rise taken by a gable triangle */
  gable?: number
  gableColor?: string
  bargeColor?: string
}

type P2 = [number, number]

export function hipRoof(o: RoofOpts): Part[] {
  const W = o.w
  const D = o.d
  const H = o.h
  const R = o.ridge ?? Math.max(W - D, W * 0.12)
  const lift = o.lift ?? H * 0.35
  const flare = o.flare ?? 0.06
  const curve = o.curve ?? 1.75
  const thick = o.thick ?? 0.12
  const segU = o.segU ?? 12
  const segV = o.segV ?? 7
  const ridgeR = o.ridgeR ?? Math.max(0.07, H * 0.06)

  const FL: P2 = [-W / 2, D / 2]
  const FR: P2 = [W / 2, D / 2]
  const BR: P2 = [W / 2, -D / 2]
  const BL: P2 = [-W / 2, -D / 2]
  const RL: P2 = [-R / 2, 0]
  const RR: P2 = [R / 2, 0]
  const slopes: [P2, P2, P2, P2][] = [
    [FL, FR, RL, RR],
    [FR, BR, RR, RR],
    [BR, BL, RR, RL],
    [BL, FL, RL, RL],
  ]

  const point = (s: [P2, P2, P2, P2], u: number, v: number, out = new THREE.Vector3()) => {
    const [e0, e1, r0, r1] = s
    const ex = e0[0] + (e1[0] - e0[0]) * u
    const ez = e0[1] + (e1[1] - e0[1]) * u
    const rx = r0[0] + (r1[0] - r0[0]) * u
    const rz = r0[1] + (r1[1] - r0[1]) * u
    let x = ex + (rx - ex) * v
    let z = ez + (rz - ez) * v
    const corner = Math.pow(Math.abs(2 * u - 1), 3)
    const k = (1 - v) * (1 - v)
    const f = 1 + flare * corner * k
    x *= f
    z *= f
    const y = H * Math.pow(v, curve) + lift * corner * Math.pow(1 - v, 2.2)
    return out.set(x, y, z)
  }

  const tileGeos: THREE.BufferGeometry[] = []
  const trimGeos: THREE.BufferGeometry[] = []
  const under = new THREE.Color(o.under ?? '#8a3b2a')
  const underDark = under.clone().multiplyScalar(0.72)
  const fasciaC = new THREE.Color(o.fascia ?? '#5a2a20')
  const ridgeC = new THREE.Color(o.ridgeColor ?? '#3d4a4f')
  const tileC = new THREE.Color(o.tile ?? '#40585e')

  const p = new THREE.Vector3()
  for (const s of slopes) {
    const eaveLen = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1])
    const slopeLen = Math.hypot(H, D / 2) * 1.05
    const top: number[] = []
    const bot: number[] = []
    const uv: number[] = []
    const colT: number[] = []
    const colB: number[] = []
    for (let j = 0; j <= segV; j++) {
      for (let i = 0; i <= segU; i++) {
        const u = i / segU
        const v = j / segV
        point(s, u, v, p)
        top.push(p.x, p.y, p.z)
        bot.push(p.x, p.y - thick, p.z)
        uv.push((u - 0.5) * eaveLen * (1 - v * 0.55), v * slopeLen)
        colT.push(tileC.r, tileC.g, tileC.b)
        const c = i % 2 === 0 ? under : underDark
        colB.push(c.r, c.g, c.b)
      }
    }
    const idxT: number[] = []
    const idxB: number[] = []
    const row = segU + 1
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = j * row + i
        const b = a + 1
        const c = a + row
        const d = c + 1
        idxT.push(a, b, c, b, d, c)
        idxB.push(a, c, b, b, c, d)
      }
    }
    const gt = new THREE.BufferGeometry()
    gt.setAttribute('position', new THREE.Float32BufferAttribute(top, 3))
    gt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    gt.setAttribute('color', new THREE.Float32BufferAttribute(colT, 3))
    gt.setIndex(idxT)
    gt.computeVertexNormals()
    tileGeos.push(gt.toNonIndexed())

    const gb = new THREE.BufferGeometry()
    gb.setAttribute('position', new THREE.Float32BufferAttribute(bot, 3))
    gb.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((bot.length / 3) * 2).fill(0), 2))
    gb.setAttribute('color', new THREE.Float32BufferAttribute(colB, 3))
    gb.setIndex(idxB)
    gb.computeVertexNormals()
    trimGeos.push(gb.toNonIndexed())

    // Fascia strip along the eave (v = 0)
    const fp: number[] = []
    const fc: number[] = []
    const fi: number[] = []
    for (let i = 0; i <= segU; i++) {
      const t = i * 3
      fp.push(top[t], top[t + 1] + 0.01, top[t + 2], bot[t], bot[t + 1] - 0.02, bot[t + 2])
      fc.push(fasciaC.r, fasciaC.g, fasciaC.b, fasciaC.r, fasciaC.g, fasciaC.b)
      if (i < segU) {
        const a = i * 2
        fi.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
      }
    }
    const gf = new THREE.BufferGeometry()
    gf.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3))
    gf.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((fp.length / 3) * 2).fill(0), 2))
    gf.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3))
    gf.setIndex(fi)
    gf.computeVertexNormals()
    trimGeos.push(gf.toNonIndexed())

    // Hip ridge cap along u = 0, with a curl beyond the corner
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 10; k++) {
      const v = k / 10
      pts.push(point(s, 0, v).add(new THREE.Vector3(0, ridgeR * 0.7, 0)))
    }
    const c0 = pts[0]
    const c1 = pts[1]
    const dir = c0.clone().sub(c1).setY(0).normalize()
    pts.unshift(c0.clone().addScaledVector(dir, ridgeR * 2.2).add(new THREE.Vector3(0, ridgeR * 2.6, 0)))
    const hip = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.reverse()), 20, ridgeR * 0.75, 6, false)
    trimGeos.push(colorize(hip, ridgeC))
  }

  // Main ridge
  const ridgeLen = Math.max(R, 0.001)
  if (R > 0.05) {
    const rg = new THREE.CylinderGeometry(ridgeR * 1.25, ridgeR * 1.25, ridgeLen + ridgeR * 2, 8)
    rg.rotateZ(Math.PI / 2)
    rg.translate(0, H + ridgeR * 0.9, 0)
    trimGeos.push(colorize(rg, ridgeC))
  }
  if (o.gable && R > 0.2) {
    // irimoya: a vertical gable triangle sitting on the hips at each ridge end
    const g = o.gable
    const yb = H * (1 - g)
    const vb = Math.pow(1 - g, 1 / curve)
    const zb = (D / 2) * (1 - vb) * 0.97
    const gc = new THREE.Color(o.gableColor ?? '#6b4a36')
    const bc = new THREE.Color(o.bargeColor ?? '#f1ece2')
    for (const sx of [-1, 1]) {
      const x = (sx * R) / 2 + sx * 0.01
      const tri = new THREE.BufferGeometry()
      tri.setAttribute('position', new THREE.Float32BufferAttribute([x, H, 0, x, yb, zb, x, yb, -zb], 3))
      tri.setIndex(sx > 0 ? [0, 1, 2] : [0, 2, 1])
      tri.computeVertexNormals()
      trimGeos.push(colorize(tri, gc))
      for (const sz of [-1, 1]) {
        const board = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x + sx * 0.02, H + ridgeR * 0.5, 0), new THREE.Vector3(x + sx * 0.02, yb - 0.04, sz * (zb + 0.06))), 4, ridgeR * 0.55, 5)
        trimGeos.push(colorize(board, bc))
      }
      // little gable-top ornament
      const gegyo = new THREE.SphereGeometry(ridgeR * 1.3, 8, 6)
      gegyo.translate(x + sx * 0.03, H - (H - yb) * 0.25, 0)
      trimGeos.push(colorize(gegyo, new THREE.Color('#d9a441')))
    }
  }
  if (o.ornaments !== false) {
    for (const sx of [-1, 1]) {
      if (o.style === 'jp') {
        // onigawara: a chunky demon-tile block standing at each ridge end
        const oni = new THREE.BoxGeometry(ridgeR * 2.2, ridgeR * 3.6, ridgeR * 3.2)
        oni.translate((sx * R) / 2 + sx * ridgeR * 0.6, H + ridgeR * 2.1, 0)
        trimGeos.push(colorize(oni, ridgeC))
        const fin = new THREE.ConeGeometry(ridgeR * 0.9, ridgeR * 2.4, 6)
        fin.rotateZ(-sx * 0.5)
        fin.translate((sx * R) / 2 + sx * ridgeR * 1.4, H + ridgeR * 4.2, 0)
        trimGeos.push(colorize(fin, ridgeC))
      } else {
        // upturned curls (Vietnamese / Chinese ridge ends)
        const curl = new THREE.TorusGeometry(ridgeR * 2.2, ridgeR * 0.9, 6, 12, Math.PI * 1.25)
        curl.rotateY(sx > 0 ? 0 : Math.PI)
        curl.translate((sx * R) / 2, H + ridgeR * 3.1, 0)
        trimGeos.push(colorize(curl, ridgeC))
      }
    }
  }

  const tile = mergeGeometries(tileGeos, false)!
  const trim = mergeGeometries(
    trimGeos.map((g) => stripTo(g)),
    false,
  )!
  return [
    { g: tile, m: 'tile', keep: true },
    { g: trim, m: 'trim', keep: true },
  ]
}

function colorize(g: THREE.BufferGeometry, c: THREE.Color) {
  return bake({ g, c, m: 'trim' })
}

function stripTo(g: THREE.BufferGeometry) {
  const out = g.index ? g.toNonIndexed() : g
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) out.deleteAttribute(k)
  if (!out.attributes.uv) {
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2))
  }
  return out
}

/** A long wall-cap roof (gable prism) along X with tile UVs — for garden walls. */
export function wallCap(len: number, width: number, h: number, tile = '#45575c', ridge = '#3a474b'): Part[] {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.quadraticCurveTo(-width * 0.18, h * 0.35, 0, h)
  shape.quadraticCurveTo(width * 0.18, h * 0.35, width / 2, 0)
  shape.lineTo(-width / 2, 0)
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 5 })
  g.translate(0, 0, -len / 2)
  g.rotateY(Math.PI / 2)
  // UVs: x along the slope direction ~ z, y along the wall length
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i)
    uv[i * 2 + 1] = Math.abs(pos.getZ(i)) * 1.2
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return [
    { g, c: tile, m: 'tile' },
    { g: G.cylLo, c: ridge, m: 'trim', p: [0, h + 0.03, 0], r: [0, 0, Math.PI / 2], s: [0.07, len + 0.1, 0.07] },
  ]
}
