import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BOARD, CHAM, CONGLANG, DOANMON, GATE, HALL, HAYSTACK, HOUSE, HUE_PONDS, HUE_WALL_Z, NGOMON, PADDY, PATH, POND, RANGDONG, TOPIARY, VILLAGE_END, houseToWorld } from '../layout'
import { blob, G, mergeKit, rng, type Part } from '../lib/kit'
import { kitMat } from '../lib/materials'
import { canvas, toTexture, waterNormalTex } from '../lib/textures'
import { BAMBOO, BUSHES, HOUSES, TREES } from './placements'
import { HEDGE } from './Village'
import { world } from '../../state/world'

const TW = 1536
const TH = 3072
const BW = BOARD.maxX - BOARD.minX
const BD = BOARD.maxZ - BOARD.minZ
const px = (x: number) => ((x - BOARD.minX) / BW) * TW
const py = (z: number) => ((BOARD.maxZ - z) / BD) * TH
const SX = TW / BW
const SZ = TH / BD

function boardShape(grow = 0) {
  const s = new THREE.Shape()
  const x0 = BOARD.minX - grow
  const x1 = BOARD.maxX + grow
  // shape y = -z (after rotateX(-π/2))
  const y0 = -BOARD.maxZ - grow
  const y1 = -BOARD.minZ + grow
  const r = BOARD.corner + grow
  s.moveTo(x0 + r, y0)
  s.lineTo(x1 - r, y0)
  s.quadraticCurveTo(x1, y0, x1, y0 + r)
  s.lineTo(x1, y1 - r)
  s.quadraticCurveTo(x1, y1, x1 - r, y1)
  s.lineTo(x0 + r, y1)
  s.quadraticCurveTo(x0, y1, x0, y1 - r)
  s.lineTo(x0, y0 + r)
  s.quadraticCurveTo(x0, y0, x0 + r, y0)
  return s
}

/** Paint each region's ground: sand, paddies, campus concrete, autumn paving, village bricks, Huế terracotta. */
function paintGround() {
  const [c, g] = canvas(TW, TH)
  const r = rng(3)
  g.fillStyle = '#74a04e'
  g.fillRect(0, 0, TW, TH)
  const mott = ['#84b25a', '#65914a', '#7caa54', '#5c8744', '#90bc64', '#6e9a4b']
  for (let i = 0; i < 1300; i++) {
    const x = r() * TW
    const y = r() * TH
    const rad = 16 + r() * 80
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    const col = mott[Math.floor(r() * mott.length)]
    grd.addColorStop(0, hexA(col, 0.32))
    grd.addColorStop(1, hexA(col, 0))
    g.fillStyle = grd
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  // regional tints: sun-warmed central coast, gold of a Hà Nội autumn
  const tint = (z0: number, z1: number, col: string, a: number) => {
    const grd = g.createLinearGradient(0, py(z1), 0, py(z0))
    grd.addColorStop(0, hexA(col, 0))
    grd.addColorStop(0.15, hexA(col, a))
    grd.addColorStop(0.85, hexA(col, a))
    grd.addColorStop(1, hexA(col, 0))
    g.fillStyle = grd
    g.fillRect(0, py(z1), TW, py(z0) - py(z1))
  }
  tint(4, BOARD.maxZ + 1, '#c9b86a', 0.2)
  tint(-28.5, -13.5, '#d8b44a', 0.3)
  tint(VILLAGE_END - 0.1, -28.5, '#4f8a3c', 0.22)

  const soft = (x0: number, z0: number, x1: number, z1: number, spread: number, alpha: number) => {
    for (let k = 7; k >= 0; k--) {
      const e = (spread * k) / 7
      g.fillStyle = `rgba(52,48,30,${alpha / 8})`
      g.fillRect(px(x0 - e), py(z1 + e), (x1 - x0 + 2 * e) * SX, (z1 - z0 + 2 * e) * SZ)
    }
  }
  const spot = (x: number, z: number, rad: number, alpha: number) => {
    const grd = g.createRadialGradient(px(x), py(z), 0, px(x), py(z), rad * SX)
    grd.addColorStop(0, `rgba(45,50,25,${alpha})`)
    grd.addColorStop(1, 'rgba(45,50,25,0)')
    g.fillStyle = grd
    g.beginPath()
    g.ellipse(px(x), py(z), rad * SX, rad * SZ, 0, 0, Math.PI * 2)
    g.fill()
  }
  const rect = (x0: number, z0: number, x1: number, z1: number, col: string) => {
    g.fillStyle = col
    g.fillRect(px(x0), py(z1), (x1 - x0) * SX, (z1 - z0) * SZ)
  }
  const paving = (x0: number, z0: number, x1: number, z1: number, base: string, tw: number, td = tw, joint = 'rgba(110,90,70,0.4)', stagger = false) => {
    rect(x0, z0, x1, z1, base)
    let row = 0
    for (let z = z0; z < z1 - 0.01; z += td, row++) {
      const off = stagger && row % 2 ? tw / 2 : 0
      for (let x = x0 - off; x < x1 - 0.01; x += tw) {
        const v = r()
        g.fillStyle = v < 0.33 ? 'rgba(255,248,230,0.16)' : v < 0.66 ? 'rgba(120,100,80,0.08)' : 'rgba(0,0,0,0)'
        g.fillRect(px(Math.max(x, x0)) + 1, py(z + td) + 1, (Math.min(x + tw, x1) - Math.max(x, x0)) * SX - 2, td * SZ - 2)
        g.strokeStyle = joint
        g.lineWidth = 1.4
        g.strokeRect(px(Math.max(x, x0)), py(z + td), (Math.min(x + tw, x1) - Math.max(x, x0)) * SX, td * SZ)
      }
    }
    g.strokeStyle = 'rgba(90,75,60,0.5)'
    g.lineWidth = 3
    g.strokeRect(px(x0), py(z1), (x1 - x0) * SX, (z1 - z0) * SZ)
  }
  const pathStroke = (pts: [number, number][], width: number, style: string) => {
    g.strokeStyle = style
    g.lineWidth = width * SX
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), py(z)) : g.moveTo(px(x), py(z))))
    g.stroke()
  }

  // ── I · Bình Định: a sandy dirt lane, then the paddies ──
  const lane = PATH.filter(([, z]) => z > GATE.z - 1)
  pathStroke(lane, 3.4, 'rgba(160,130,85,0.35)')
  pathStroke(lane, 2.4, '#dcc79c')
  for (let i = 0; i < 260; i++) {
    const z = GATE.z + r() * (BOARD.maxZ - GATE.z - 0.5)
    const x = (r() - 0.5) * 2.4
    g.fillStyle = r() < 0.5 ? 'rgba(255,245,215,0.35)' : 'rgba(140,110,70,0.25)'
    g.fillRect(px(x), py(z), 3, 3)
  }
  // paddies: water glinting between rows of rice
  rect(PADDY.x0, PADDY.z0, PADDY.x1, PADDY.z1, '#7f9a5a')
  for (let z = PADDY.z0 + 0.2; z < PADDY.z1; z += 0.42) {
    g.fillStyle = 'rgba(160,200,215,0.45)'
    g.fillRect(px(PADDY.x0), py(z + 0.1), (PADDY.x1 - PADDY.x0) * SX, 0.12 * SZ)
  }
  // ── II · Nông Lâm: concrete plaza, a drive around the topiary, lawns ──
  paving(-0.6, RANGDONG.zc - RANGDONG.w / 2 - 0.4, RANGDONG.xf, RANGDONG.zc + RANGDONG.w / 2 + 0.4, '#d6d3ca', 0.8, 0.8, 'rgba(120,115,105,0.35)')
  g.fillStyle = '#bdb9b0'
  g.beginPath()
  g.ellipse(px(TOPIARY.x), py(TOPIARY.z), (TOPIARY.r + 1.4) * SX, (TOPIARY.r + 1.4) * SZ, 0, 0, Math.PI * 2)
  g.fill()
  pathStroke(
    PATH.filter(([, z]) => z <= GATE.z && z > -14),
    2.3,
    '#d2cec4',
  )
  // ── III · Thăng Long: great stone slabs in front of Đoan Môn, fallen gold leaves ──
  paving(-6.2, DOANMON.z + DOANMON.d / 2, 6.2, -17.6, '#cfc4ae', 0.9, 0.62, 'rgba(110,95,75,0.35)', true)
  pathStroke(
    PATH.filter(([, z]) => z <= -13 && z >= -18),
    2.3,
    '#cfc4ae',
  )
  for (let i = 0; i < 1500; i++) {
    const x = BOARD.minX + r() * (BOARD.maxX - BOARD.minX)
    const z = -27 + r() * 13.5
    g.fillStyle = ['rgba(242,194,48,0.8)', 'rgba(232,150,58,0.75)', 'rgba(214,120,40,0.6)', 'rgba(246,212,90,0.8)'][Math.floor(r() * 4)]
    g.save()
    g.translate(px(x), py(z))
    g.rotate(r() * 6.3)
    g.beginPath()
    g.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  // ── IV · the village: the packed-earth yard of the house, a herringbone brick lane ──
  {
    const [yx, yz] = houseToWorld(0.2, 1.9)
    for (const [rx, rz, a] of [
      [4.7, 3.5, 0.5],
      [4.2, 3.0, 0.45],
    ] as const) {
      g.fillStyle = `rgba(196,167,122,${a})`
      g.beginPath()
      g.ellipse(px(yx - 0.5), py(yz - 0.4), rx * SX, rz * SZ, -HOUSE.ry, 0, Math.PI * 2)
      g.fill()
    }
  }
  {
    const x0 = -1.15
    const x1 = 1.15
    const z0 = VILLAGE_END - 0.9
    const z1 = DOANMON.z - DOANMON.d / 2 - 0.2
    rect(x0, z0, x1, z1, '#9a5a3e')
    g.save()
    g.beginPath()
    g.rect(px(x0), py(z1), (x1 - x0) * SX, (z1 - z0) * SZ)
    g.clip()
    const bw = 0.22
    for (let z = z0 - 1; z < z1 + 1; z += bw * 0.72) {
      for (let x = x0 - 1; x < x1 + 1; x += bw * 1.44) {
        for (const [dx, rot] of [
          [0, 0.785],
          [bw * 0.72, -0.785],
        ] as const) {
          g.save()
          g.translate(px(x + dx), py(z))
          g.rotate(rot)
          const v = r()
          g.fillStyle = v < 0.3 ? '#b06a48' : v < 0.6 ? '#a45e40' : '#8f5038'
          g.fillRect(-bw * 0.5 * SX, -bw * 0.25 * SZ, bw * SX - 1.5, bw * 0.5 * SZ - 1.5)
          g.restore()
        }
      }
    }
    g.restore()
    g.strokeStyle = 'rgba(80,60,40,0.55)'
    g.lineWidth = 3
    g.strokeRect(px(x0), py(z1), (x1 - x0) * SX, (z1 - z0) * SZ)
  }
  // ── V · Huế: Bát Tràng terracotta before Ngọ Môn, the courtyard behind ──
  const ngFront = NGOMON.z + NGOMON.depth / 2
  paving(-NGOMON.w / 2 - 0.9, ngFront, NGOMON.w / 2 + 0.9, VILLAGE_END - 0.9, '#c78e6a', 0.6)
  paving(-8.6, HALL.terraceFront, 8.6, NGOMON.z - NGOMON.depth / 2, '#c9936c', 0.6)
  rect(-1.5, HALL.terraceFront, 1.5, NGOMON.z - NGOMON.depth / 2, '#dcd3c2')
  for (const [x0, x1, z0, z1] of HUE_PONDS) rect(x0, z0, x1, z1, '#35626a')

  // pond bed (ao làng)
  g.save()
  g.translate(px(POND.x), py(POND.z))
  g.scale(1, (POND.rz * SZ) / (POND.rx * SX))
  const pr = POND.rx * SX
  const pg = g.createRadialGradient(0, 0, 0, 0, 0, pr * 1.08)
  pg.addColorStop(0, '#2f5b63')
  pg.addColorStop(0.6, '#4b7f7b')
  pg.addColorStop(0.9, '#9b9570')
  pg.addColorStop(1, 'rgba(150,140,100,0)')
  g.fillStyle = pg
  g.beginPath()
  g.arc(0, 0, pr * 1.08, 0, Math.PI * 2)
  g.fill()
  g.restore()

  // moss creeping out over the paving from the foot of the old walls and the pond kerbs
  const mossBand = (x0: number, z0: number, x1: number, z1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0)
      const z = z0 + r() * (z1 - z0)
      const rad = (0.1 + r() * 0.28) * SX
      const col = ['70,58,38', '84,82,44', '56,70,40', '92,76,46'][Math.floor(r() * 4)]
      const grd = g.createRadialGradient(px(x), py(z), 0, px(x), py(z), rad)
      grd.addColorStop(0, `rgba(${col},${0.45 + r() * 0.35})`)
      grd.addColorStop(0.6, `rgba(${col},0.2)`)
      grd.addColorStop(1, `rgba(${col},0)`)
      g.fillStyle = grd
      g.fillRect(px(x) - rad, py(z) - rad, rad * 2, rad * 2)
    }
  }
  {
    // Đoan Môn, both faces
    const dz = DOANMON.z + DOANMON.d / 2
    mossBand(-6.2, dz, 6.2, dz + 0.6, 150)
    mossBand(-6.2, dz - DOANMON.d - 0.6, 6.2, dz - DOANMON.d, 90)
    // Ngọ Môn: the foot of the front face, round the inside of the U, and the back
    const nf = NGOMON.z + NGOMON.depth / 2
    const wi = NGOMON.w / 2 - 2
    mossBand(-wi, nf, wi, nf + 0.55, 110)
    for (const s of [-1, 1]) {
      mossBand(s > 0 ? wi - 0.5 : -wi, nf, s > 0 ? wi : -wi + 0.5, nf + NGOMON.wing, 60)
      mossBand(s > 0 ? wi : -NGOMON.w / 2 - 0.4, nf + NGOMON.wing, s > 0 ? NGOMON.w / 2 + 0.4 : -wi, nf + NGOMON.wing + 0.5, 45)
    }
    mossBand(-8.4, nf - NGOMON.depth - 0.6, 8.4, nf - NGOMON.depth, 130)
    // Điện Thái Hòa: the foot of the terrace either side of the stairs, and round the lotus ponds
    for (const s of [-1, 1]) mossBand(s > 0 ? 1.9 : -8.4, HALL.terraceFront, s > 0 ? 8.4 : -1.9, HALL.terraceFront + 0.6, 75)
    for (const [x0, x1, z0, z1] of HUE_PONDS) {
      const outer = x0 < 0
      mossBand(x0 - 0.2, z0 - 0.6, x1 + 0.2, z0 - 0.2, 45)
      mossBand(x0 - 0.2, z1 + 0.2, x1 + 0.2, z1 + 0.6, 45)
      mossBand(outer ? x0 - 0.6 : x1 + 0.2, z0, outer ? x0 - 0.2 : x1 + 0.6, z1, 35)
    }
  }

  // baked contact shadows (cheap ambient occlusion)
  soft(BOARD.minX, GATE.z - 0.4, BOARD.maxX, GATE.z + 0.5, 0.8, 0.5)
  soft(RANGDONG.xf - 0.2, RANGDONG.zc - RANGDONG.w / 2, RANGDONG.xf + RANGDONG.d, RANGDONG.zc + RANGDONG.w / 2, 0.9, 0.55)
  soft(-DOANMON.w / 2, DOANMON.z - DOANMON.d / 2, DOANMON.w / 2, DOANMON.z + DOANMON.d / 2, 0.9, 0.5)
  soft(BOARD.minX, DOANMON.z - 0.5, BOARD.maxX, DOANMON.z + 0.5, 0.7, 0.45)
  soft(-3.8, CONGLANG.z - 0.5, 3.8, CONGLANG.z + 0.5, 0.6, 0.45)
  soft(BOARD.minX, HUE_WALL_Z - 0.4, BOARD.maxX, HUE_WALL_Z + 0.4, 0.8, 0.5)
  soft(NGOMON.x - NGOMON.w / 2, NGOMON.z - NGOMON.depth / 2, NGOMON.x + NGOMON.w / 2, NGOMON.z + NGOMON.depth / 2 + NGOMON.wing, 0.9, 0.45)
  soft(HALL.x - 7.2, HALL.terraceBack, HALL.x + 7.2, HALL.terraceFront, 1.0, 0.55)
  spot(CHAM.x, CHAM.z, 2.4, 0.5)
  spot(HOUSE.x, HOUSE.z, 2.5, 0.5)
  spot(HAYSTACK.x, HAYSTACK.z, 1.0, 0.45)
  for (const h of HOUSES) spot(h.x, h.z, Math.max(h.w, h.d) * 0.68, 0.45)
  for (const t of TREES) spot(t.x, t.z, (t.kind === 'banyan' ? 2.6 : 1.35) * t.s, 0.42)
  for (const [x, z, s] of BAMBOO) spot(x, z, 1.4 * s, 0.35)
  for (const [x, z, s] of HEDGE) spot(x, z, 1.3 * s, 0.35)
  for (const [x, z, s] of BUSHES) spot(x, z, 0.9 * s, 0.3)

  // fine grain
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,230,0.07)' : 'rgba(40,50,20,0.07)'
    g.fillRect(r() * TW, r() * TH, 2, 2)
  }
  const tex = toTexture(c)
  tex.anisotropy = 8
  return tex
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function layer(shape: THREE.Shape, y0: number, y1: number, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: y1 - y0,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y0, 0)
  return g
}

export function Board() {
  const { ground, parts } = useMemo(() => {
    const top = new THREE.ShapeGeometry(boardShape(), 12)
    top.rotateX(-Math.PI / 2)
    const pos = top.attributes.position
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - BOARD.minX) / BW
      uv[i * 2 + 1] = (pos.getZ(i) - BOARD.minZ) / BD
    }
    top.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    const mat = new THREE.MeshStandardMaterial({ map: paintGround(), roughness: 0.96 })
    const ground = { geo: top, mat }

    const s0 = boardShape()
    const r = rng(8)
    const parts: Part[] = [
      // (its top sits clearly below the painted ground: almost-coplanar faces flicker in stripes from afar)
      { g: layer(s0, -0.32, -0.03), c: '#5f8a40', m: 'stone' },
      { g: layer(boardShape(-0.02), -1.75, -0.32), c: '#9a6a48', m: 'stone' },
      { g: layer(boardShape(-0.04), -2.25, -1.75), c: '#85766c', m: 'stone' },
      { g: layer(boardShape(0.62), -3.25, -2.36, 0.08), c: '#6b4430', m: 'wood' },
      { g: layer(boardShape(0.7), -2.36, -2.26), c: '#d9a441', m: 'gold' },
    ]
    // stones and roots peeking out of the soil cross-section
    const perim = boardShape().getSpacedPoints(90)
    perim.forEach((p, i) => {
      if (r() < 0.45) return
      const y = -0.5 - r() * 1.4
      const s = 0.12 + r() * 0.2
      parts.push({ g: blob(i, 1, 0.2), c: r() < 0.7 ? '#b5a898' : '#8c7d70', m: 'stone', p: [p.x, y, -p.y], s: [s * 1.3, s, s] })
    })
    // grass lip tufts hanging over the edge
    perim.forEach((p, i) => {
      if (i % 2) return
      parts.push({ g: blob(i + 300, 1, 0.25), c: '#6a9a46', m: 'foliage', p: [p.x, -0.12, -p.y], s: [0.35, 0.18, 0.35] })
    })
    return { ground, parts }
  }, [])

  const kit = useMemo(() => mergeKit(parts), [parts])

  return (
    <group>
      <mesh geometry={ground.geo} material={ground.mat} receiveShadow position-y={0.001} />
      {[...kit].map(([k, g]) => (
        <mesh key={k} geometry={g} material={kitMat(k)} receiveShadow castShadow={false} />
      ))}
      <Pond />
    </group>
  )
}

// ── Pond: water, lotus, koi ────────────────────────────────
function Pond() {
  const water = useMemo(() => {
    const n = waterNormalTex()
    n.repeat.set(3, 3)
    return new THREE.MeshStandardMaterial({
      color: '#5d9ea2',
      roughness: 0.07,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8,
      normalMap: n,
      normalScale: new THREE.Vector2(0.28, 0.28),
      envMapIntensity: 1.6,
    })
  }, [])
  const lotus = useMemo(() => {
    const r = rng(31)
    const p: Part[] = []
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2
      const d = 0.35 + Math.sqrt(r()) * 0.55
      const x = POND.x + Math.cos(a) * POND.rx * d
      const z = POND.z + Math.sin(a) * POND.rz * d
      const s = 0.22 + r() * 0.2
      p.push({ g: new THREE.CylinderGeometry(1, 1, 0.02, 16, 1, false, 0.3, Math.PI * 2 - 0.6), c: r() < 0.5 ? '#5f9a55' : '#6fa860', m: 'foliage', p: [x, 0.05, z], r: [0, r() * 6, 0], s: [s, 1, s] })
      if (r() < 0.35) {
        for (let k = 0; k < 6; k++) {
          const pa = (k / 6) * Math.PI * 2
          p.push({ g: G.sphereLo, c: k % 2 ? '#f7b6c8' : '#fbd3de', m: 'toy', p: [x + Math.cos(pa) * 0.05, 0.12, z + Math.sin(pa) * 0.05], r: [Math.cos(pa) * 0.5, 0, -Math.sin(pa) * 0.5], s: [0.045, 0.1, 0.03] })
        }
        p.push({ g: G.sphereLo, c: '#f5d36b', m: 'toy', p: [x, 0.13, z], s: 0.035 })
      }
    }
    return mergeKit(p)
  }, [])
  const koi = useRef<THREE.Group[]>([])
  const koiParts = useMemo(
    () =>
      ['#f08a3a', '#ffffff', '#e8562e'].map((col) =>
        mergeKit([
          { g: G.sphere, c: col, s: [0.08, 0.05, 0.2] },
          { g: G.sphereLo, c: '#fbfbf5', p: [0, 0.03, 0.02], s: [0.05, 0.02, 0.1] },
          { g: G.cone, c: col, p: [0, 0, -0.23], r: [-Math.PI / 2, 0, 0], s: [0.07, 0.12, 0.02] },
        ]),
      ),
    [],
  )
  useFrame(() => {
    const t = world.time
    water.normalMap!.offset.set(t * 0.012, t * 0.008)
    koi.current.forEach((k, i) => {
      if (!k) return
      const sp = 0.22 + i * 0.05
      const a = t * sp + i * 2.1
      const rx = POND.rx * (0.45 + i * 0.12)
      const rz = POND.rz * (0.4 + i * 0.12)
      k.position.set(POND.x + Math.cos(a) * rx, -0.02, POND.z + Math.sin(a) * rz)
      k.rotation.y = Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz)
      k.rotation.z = Math.sin(t * 6 + i) * 0.15
    })
  })
  const huePonds = useMemo(() => {
    const r = rng(52)
    const p: Part[] = []
    for (const [x0, x1, z0, z1] of HUE_PONDS) {
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      const w = x1 - x0
      const d = z1 - z0
      p.push({ g: G.box, c: '#a59a88', m: 'stone', p: [cx, 0.1, z0 - 0.1], s: [w + 0.4, 0.2, 0.2] })
      p.push({ g: G.box, c: '#a59a88', m: 'stone', p: [cx, 0.1, z1 + 0.1], s: [w + 0.4, 0.2, 0.2] })
      p.push({ g: G.box, c: '#a59a88', m: 'stone', p: [x0 - 0.1, 0.1, cz], s: [0.2, 0.2, d] })
      p.push({ g: G.box, c: '#a59a88', m: 'stone', p: [x1 + 0.1, 0.1, cz], s: [0.2, 0.2, d] })
      for (let i = 0; i < 9; i++) {
        const x = x0 + 0.35 + r() * (w - 0.7)
        const z = z0 + 0.35 + r() * (d - 0.7)
        const s = 0.2 + r() * 0.16
        p.push({ g: new THREE.CylinderGeometry(1, 1, 0.02, 14, 1, false, 0.3, Math.PI * 2 - 0.6), c: r() < 0.5 ? '#5f9a55' : '#6fa860', m: 'foliage', p: [x, 0.06, z], r: [0, r() * 6, 0], s: [s, 1, s] })
        if (r() < 0.5) {
          for (let k = 0; k < 6; k++) {
            const pa = (k / 6) * Math.PI * 2
            p.push({ g: G.sphereLo, c: k % 2 ? '#f7b6c8' : '#fbd3de', m: 'toy', p: [x + Math.cos(pa) * 0.05, 0.14, z + Math.sin(pa) * 0.05], r: [Math.cos(pa) * 0.5, 0, -Math.sin(pa) * 0.5], s: [0.045, 0.1, 0.03] })
          }
        }
      }
    }
    return mergeKit(p)
  }, [])
  return (
    <group>
      {HUE_PONDS.map(([x0, x1, z0, z1], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, 0.04, (z0 + z1) / 2]} material={water} receiveShadow>
          <planeGeometry args={[x1 - x0, z1 - z0]} />
        </mesh>
      ))}
      {[...huePonds].map(([k, g]) => (
        <mesh key={`hp${k}`} geometry={g} material={kitMat(k)} receiveShadow />
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[POND.x, 0.035, POND.z]} scale={[POND.rx, POND.rz, 1]} material={water} receiveShadow>
        <circleGeometry args={[1, 48]} />
      </mesh>
      {[...lotus].map(([k, g]) => (
        <mesh key={k} geometry={g} material={kitMat(k)} />
      ))}
      {koiParts.map((geos, i) => (
        <group key={i} ref={(el) => void (koi.current[i] = el!)}>
          {[...geos].map(([k, g]) => (
            <mesh key={k} geometry={g} material={kitMat(k)} />
          ))}
        </group>
      ))}
    </group>
  )
}
