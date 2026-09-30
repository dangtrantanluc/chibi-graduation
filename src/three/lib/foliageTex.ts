import * as THREE from 'three'
import { rng } from './kit'
import { canvas, toTexture } from './textures'

/**
 * Hand-painted leaf / blossom atlases for card foliage (2×2 cells).
 * Drawn once at load — phượng vĩ (the flame tree of school summers), golden
 * autumn leaves, hoa sữa, banyan, pine, mai (Tết apricot blossom), a generic
 * green and bamboo.
 */
export type LeafKind = 'phuong' | 'autumn' | 'hoasua' | 'banyan' | 'pine' | 'mai' | 'green' | 'bamboo'

const CELL = 256
const memo = new Map<LeafKind, THREE.Texture>()

function petalFlower(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, fill: string, edge: string, center: string, notch = true) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  for (let k = 0; k < 5; k++) {
    g.save()
    g.rotate((k / 5) * Math.PI * 2)
    const grd = g.createLinearGradient(0, 0, 0, -r)
    grd.addColorStop(0, center)
    grd.addColorStop(0.35, fill)
    grd.addColorStop(1, edge)
    g.fillStyle = grd
    g.beginPath()
    g.moveTo(0, 0)
    g.bezierCurveTo(r * 0.62, -r * 0.3, r * 0.55, -r * 0.95, notch ? r * 0.14 : 0, -r)
    if (notch) g.lineTo(0, -r * 0.84)
    g.lineTo(notch ? -r * 0.14 : 0, -r)
    g.bezierCurveTo(-r * 0.55, -r * 0.95, -r * 0.62, -r * 0.3, 0, 0)
    g.fill()
    g.restore()
  }
  g.fillStyle = center
  g.beginPath()
  g.arc(0, 0, r * 0.2, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(200,120,40,0.9)'
  g.lineWidth = 1.2
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42)
    g.stroke()
    g.fillStyle = '#ffd35a'
    g.beginPath()
    g.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, 1.6, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

function leaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number, rot: number, fill: string, vein = 'rgba(0,0,0,0.18)') {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.fillStyle = fill
  g.beginPath()
  g.moveTo(0, 0)
  g.quadraticCurveTo(wid, -len * 0.45, 0, -len)
  g.quadraticCurveTo(-wid, -len * 0.45, 0, 0)
  g.fill()
  g.strokeStyle = vein
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(0, -len * 0.92)
  g.stroke()
  g.restore()
}

function paintCell(g: CanvasRenderingContext2D, kind: LeafKind, cell: number, r: () => number) {
  const cx = CELL / 2
  const cy = CELL / 2
  const within = () => {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * CELL * 0.36
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d] as const
  }
  switch (kind) {
    case 'phuong': {
      // feathery bipinnate leaves + clusters of scarlet flowers (one streaked petal each)
      for (let i = 0; i < 9; i++) {
        const [x, y] = within()
        const rot = r() * 6.3
        g.save()
        g.translate(x, y)
        g.rotate(rot)
        g.strokeStyle = '#5f8f3a'
        g.lineWidth = 1.5
        g.beginPath()
        g.moveTo(0, 0)
        g.lineTo(0, -60)
        g.stroke()
        for (let k = 0; k < 11; k++) for (const s of [-1, 1]) leaf(g, 0, -6 - k * 5, 9, 3, s * 1.2, r() < 0.5 ? '#7fb24a' : '#93c05a', 'rgba(0,0,0,0)')
        g.restore()
      }
      for (let i = 0; i < 10 + cell * 2; i++) {
        const [x, y] = within()
        petalFlower(g, x, y, 13 + r() * 8, r() * 6.3, '#f04a2a', '#d8321f', '#ff8a3a', false)
        g.fillStyle = 'rgba(255,240,200,0.9)'
        g.beginPath()
        g.ellipse(x + 3, y - 6, 3, 6, r(), 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'autumn': {
      const pal = cell === 3 ? ['#f2c230', '#e8963a', '#f6d45a'] : cell === 2 ? ['#e8a23a', '#d9772a', '#f2c230'] : ['#f6d45a', '#e8b83a', '#c9c24a']
      for (let i = 0; i < 20; i++) {
        const [x, y] = within()
        leaf(g, x, y, 30 + r() * 14, 13, r() * 6.3, pal[Math.floor(r() * pal.length)], 'rgba(120,60,10,0.3)')
      }
      break
    }
    case 'hoasua': {
      // whorls of long dark leaves around creamy-green flower clusters
      for (let w = 0; w < 4; w++) {
        const [x, y] = within()
        for (let k = 0; k < 6; k++) leaf(g, x, y, 42 + r() * 10, 11, (k / 6) * Math.PI * 2 + r() * 0.3, r() < 0.5 ? '#3f6f3a' : '#4f7f42', 'rgba(0,0,0,0.2)')
        for (let k = 0; k < 16; k++) {
          const a = r() * 6.3
          const d = r() * 16
          g.fillStyle = r() < 0.5 ? '#f4f1d8' : '#e2e8b8'
          g.beginPath()
          g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + r() * 2, 0, Math.PI * 2)
          g.fill()
        }
      }
      break
    }
    case 'banyan': {
      for (let i = 0; i < 22; i++) {
        const [x, y] = within()
        const col = ['#2f5f33', '#3f7040', '#27502c', '#4a7a44'][Math.floor(r() * 4)]
        leaf(g, x, y, 30 + r() * 10, 15, r() * 6.3, col, 'rgba(200,230,180,0.35)')
        // a glossy highlight on some leaves
        if (r() < 0.4) {
          g.fillStyle = 'rgba(255,255,255,0.18)'
          g.beginPath()
          g.ellipse(x, y - 8, 3, 8, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
      // little figs
      for (let i = 0; i < 5; i++) {
        const [x, y] = within()
        g.fillStyle = '#b8783a'
        g.beginPath()
        g.arc(x, y, 3.5, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'mai': {
      g.strokeStyle = '#5a3b2e'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(cx - 90, cy + 80)
      g.quadraticCurveTo(cx, cy, cx + 80, cy - 90)
      g.stroke()
      for (let i = 0; i < 6; i++) {
        const [x, y] = within()
        leaf(g, x, y, 24, 8, r() * 6.3, '#7fa84a')
      }
      for (let i = 0; i < 15; i++) {
        const [x, y] = within()
        petalFlower(g, x, y, 15 + r() * 10, r() * 6.3, '#ffd42a', '#ffc400', '#f59a1b', false)
      }
      for (let i = 0; i < 6; i++) {
        const [x, y] = within()
        g.fillStyle = '#e8a93a'
        g.beginPath()
        g.ellipse(x, y, 5, 7, r() * 3, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'pine': {
      for (let t = 0; t < 7; t++) {
        const [x, y] = within()
        for (let i = 0; i < 38; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 2.4
          const len = 26 + r() * 22
          g.strokeStyle = r() < 0.5 ? '#2f5a3a' : r() < 0.5 ? '#3f6f45' : '#5a8a50'
          g.lineWidth = 2.2
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
          g.stroke()
        }
      }
      break
    }
    case 'bamboo': {
      for (let i = 0; i < 12; i++) {
        const [x, y] = within()
        leaf(g, x, y, 60 + r() * 30, 9, r() * 6.3, r() < 0.5 ? '#6aa84f' : '#8cc063', 'rgba(40,70,30,0.3)')
      }
      break
    }
    case 'green':
    default: {
      for (let i = 0; i < 22; i++) {
        const [x, y] = within()
        leaf(g, x, y, 28 + r() * 16, 13, r() * 6.3, ['#5f9a45', '#7fb356', '#4a7f3a', '#8fbf62'][Math.floor(r() * 4)])
      }
    }
  }
}

export function leafAtlas(kind: LeafKind): THREE.Texture {
  const hit = memo.get(kind)
  if (hit) return hit
  const [c, g] = canvas(CELL * 2, CELL * 2)
  const r = rng(kind.length * 31 + kind.charCodeAt(0))
  for (let cell = 0; cell < 4; cell++) {
    g.save()
    g.translate((cell % 2) * CELL, Math.floor(cell / 2) * CELL)
    g.beginPath()
    g.rect(0, 0, CELL, CELL)
    g.clip()
    paintCell(g, kind, cell, r)
    g.restore()
  }
  const t = toTexture(c)
  t.anisotropy = 4
  memo.set(kind, t)
  return t
}

/** A pinnate coconut frond: rachis down the middle, drooping leaflets; alpha-tested. */
export function frondTex(): THREE.Texture {
  const key = 'frond' as unknown as LeafKind
  const hit = memo.get(key)
  if (hit) return hit
  const [c, g] = canvas(128, 512)
  g.clearRect(0, 0, 128, 512)
  const r = rng(808)
  for (let i = 0; i < 44; i++) {
    const y = 20 + i * 11
    const len = 58 * Math.sin(Math.min(1, (i + 3) / 40) * Math.PI * 0.95)
    for (const s of [-1, 1]) {
      g.save()
      g.translate(64, y)
      g.rotate(s * (0.55 + r() * 0.2) + Math.PI)
      g.fillStyle = r() < 0.5 ? '#5f9a3a' : r() < 0.5 ? '#6fa84a' : '#4f8a34'
      g.beginPath()
      g.moveTo(0, 0)
      g.quadraticCurveTo(5, len * 0.5, 0, len)
      g.quadraticCurveTo(-4, len * 0.5, 0, 0)
      g.fill()
      g.restore()
    }
  }
  g.strokeStyle = '#8a8a3a'
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(64, 0)
  g.lineTo(64, 512)
  g.stroke()
  const t = toTexture(c)
  memo.set(key, t)
  return t
}
