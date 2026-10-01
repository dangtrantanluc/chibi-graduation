import * as THREE from 'three'
import { canvas, FONT_CJK, FONT_DISPLAY, FONT_UI, roundRect, toTexture } from '../lib/textures'
import { CAST } from '../../config'
import { rng } from '../lib/kit'

/*
 * Hand-painted garment textures. The torso is a lathe, so its UVs wrap around
 * the body: u = 0 (and 1) is the front centre, 0.25 the character's left,
 * 0.5 the back, 0.75 the right; v runs from the hem (0) to the collar (1).
 * The canvas is 1024 × 512, so canvas-x = u·1024 and canvas-y = (1 − v)·512.
 */

const W = 1024
const H = 512
type G2 = CanvasRenderingContext2D
const memo = new Map<string, THREE.Texture>()
const once = (k: string, f: () => THREE.Texture) => memo.get(k) ?? (memo.set(k, f()), memo.get(k)!)
const Y = (v: number) => (1 - v) * H

/** Silk base with a soft vertical sheen and a faint weave. */
function silk(g: G2, base: string, w = W, h = H) {
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  const sheen = g.createLinearGradient(0, 0, w, 0)
  for (let i = 0; i <= 8; i++) sheen.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)')
  g.fillStyle = sheen
  g.fillRect(0, 0, w, h)
  const r = rng(w + h)
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    g.fillRect(r() * w, r() * h, 1 + r() * 10, 1)
  }
}

/** Repeat a motif on a staggered grid inside a rect. */
function scatter(_g: G2, x0: number, y0: number, x1: number, y1: number, step: number, draw: (x: number, y: number, i: number) => void) {
  let i = 0
  for (let y = y0 + step / 2, row = 0; y < y1; y += step * 0.87, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x < x1; x += step) draw(x, y, i++)
  }
}

/** Vietnamese "vân mây" auspicious cloud. */
export function cloud(g: G2, x: number, y: number, s: number, color: string, lw = 2) {
  g.strokeStyle = color
  g.lineWidth = lw
  g.beginPath()
  g.arc(x - s * 0.55, y, s * 0.42, Math.PI * 0.2, Math.PI * 1.9)
  g.stroke()
  g.beginPath()
  g.arc(x + s * 0.2, y - s * 0.18, s * 0.5, Math.PI * 0.9, Math.PI * 2.15)
  g.stroke()
  g.beginPath()
  g.arc(x + s * 0.2, y - s * 0.18, s * 0.22, Math.PI * 1.2, Math.PI * 2.4)
  g.stroke()
  g.beginPath()
  g.moveTo(x - s, y + s * 0.42)
  g.quadraticCurveTo(x, y + s * 0.2, x + s * 0.9, y + s * 0.42)
  g.stroke()
}

/** Chữ Thọ-style round longevity medallion (stylised). */
function medallion(g: G2, x: number, y: number, r: number, color: string) {
  g.strokeStyle = color
  g.lineWidth = 2
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.moveTo(x - r * 0.6, y - r * 0.3)
  g.lineTo(x + r * 0.6, y - r * 0.3)
  g.moveTo(x - r * 0.6, y + r * 0.3)
  g.lineTo(x + r * 0.6, y + r * 0.3)
  g.moveTo(x, y - r * 0.7)
  g.lineTo(x, y + r * 0.7)
  g.moveTo(x - r * 0.3, y - r * 0.3)
  g.lineTo(x - r * 0.3, y + r * 0.3)
  g.moveTo(x + r * 0.3, y - r * 0.3)
  g.lineTo(x + r * 0.3, y + r * 0.3)
  g.stroke()
}

/** Hải thủy — the rolling-wave hem of Vietnamese court robes. */
function seaWaveHem(g: G2, y0: number, y1: number, cols: string[]) {
  const h = y1 - y0
  const n = cols.length
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i]
    g.fillRect(0, y0 + (i / n) * h * 0.55, W, (h * 0.55) / n + 1)
  }
  // diagonal "li thủy" stripes
  g.save()
  g.beginPath()
  g.rect(0, y0, W, h * 0.55)
  g.clip()
  g.strokeStyle = 'rgba(255,255,255,0.35)'
  g.lineWidth = 3
  for (let x = -h; x < W + h; x += 14) {
    g.beginPath()
    g.moveTo(x, y0)
    g.lineTo(x + h * 0.55, y0 + h * 0.55)
    g.stroke()
  }
  g.restore()
  // wave crests
  const wy = y0 + h * 0.55
  g.fillStyle = cols[0]
  g.fillRect(0, wy, W, y1 - wy)
  g.strokeStyle = '#f3d98a'
  g.lineWidth = 2.5
  for (let x = 0; x < W + 40; x += 40) {
    g.beginPath()
    g.arc(x, wy + 18, 16, Math.PI, Math.PI * 1.9)
    g.stroke()
    g.beginPath()
    g.arc(x + 4, wy + 18, 8, Math.PI, Math.PI * 1.9)
    g.stroke()
  }
  g.fillStyle = '#e8c267'
  g.fillRect(0, y1 - 6, W, 6)
}

/** Gold-and-colour border band. */
function band(g: G2, x: number, y: number, w: number, h: number, fill: string, edge = '#e8c267', ew = 4) {
  g.fillStyle = edge
  g.fillRect(x, y, w, h)
  g.fillStyle = fill
  g.fillRect(x + ew, y + ew, w - ew * 2, h - ew * 2)
}

/** Stylised phoenix: long curling tail feathers and a small head. */
function phoenix(g: G2, x: number, y: number, s: number, color: string, flip = 1) {
  g.save()
  g.translate(x, y)
  g.scale(flip * s, s)
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = 1.6 / s
  g.beginPath()
  g.ellipse(0, 0, 10, 5, -0.4, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.arc(9, -7, 3.2, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.moveTo(11, -8)
  g.lineTo(16, -7)
  g.stroke()
  for (let k = 0; k < 4; k++) {
    g.beginPath()
    g.moveTo(-8, 2)
    g.bezierCurveTo(-20, 6 + k * 5, -28, -4 + k * 6, -34 - k * 3, 8 + k * 7)
    g.stroke()
    g.beginPath()
    g.arc(-34 - k * 3, 8 + k * 7, 2.4, 0, Math.PI * 2)
    g.stroke()
  }
  g.beginPath()
  g.moveTo(-2, -3)
  g.quadraticCurveTo(2, -16, 10, -14)
  g.stroke()
  g.restore()
}

/** Draw a vertical strip at the front seam (straddles u = 0 / 1). */
function frontStrip(_g: G2, halfW: number, y0: number, y1: number, draw: (x: number, w: number, y0: number, y1: number) => void) {
  draw(W - halfW, halfW * 2, y0, y1)
  draw(-halfW, halfW * 2, y0, y1)
}

// ═══════════════════════════════════════════════════════════
//  Áo nhật bình — royal Huế robe with the square "nhật bình" collar
// ═══════════════════════════════════════════════════════════
export const nhatBinhTex = () =>
  once('nhatbinh', () => {
    const [c, g] = canvas(W, H)
    silk(g, '#b3262e')
    // gold cloud & phoenix brocade over the red silk
    scatter(g, 0, Y(0.95), W, Y(0.2), 68, (x, y, i) => {
      if (i % 5 === 0) phoenix(g, x, y, 0.9, 'rgba(240,198,96,0.85)', i % 2 ? 1 : -1)
      else if (i % 3 === 0) medallion(g, x, y, 11, 'rgba(240,198,96,0.8)')
      else cloud(g, x, y, 11, 'rgba(240,198,96,0.7)', 1.8)
    })
    seaWaveHem(g, Y(0.2), H, ['#23457d', '#2f6fae', '#e8c267', '#23457d', '#7fb2dd'])
    // the two front bands of the nhật bình collar, down to the hem
    for (const cx of [W * 0.07, W * 0.93]) {
      band(g, cx - 34, 0, 68, H, '#23457d', '#e8c267', 5)
      for (let y = 40; y < H - 20; y += 70) {
        phoenix(g, cx + 4, y, 0.6, '#f3d98a', y % 140 ? 1 : -1)
        cloud(g, cx, y + 36, 8, 'rgba(243,217,138,0.85)', 1.5)
      }
    }
    // front opening: inner yellow robe
    frontStrip(g, 12, 0, H, (x, w, y0, y1) => {
      g.fillStyle = '#f2c14e'
      g.fillRect(x, y0, w, y1 - y0)
    })
    return toTexture(c)
  })

export const nhatBinhSleeve = () =>
  once('nhatbinh-sleeve', () => {
    const [c, g] = canvas(256, 256)
    silk(g, '#b3262e', 256, 256)
    scatter(g, 0, 0, 256, 190, 44, (x, y) => cloud(g, x, y, 9, 'rgba(240,198,96,0.75)', 1.5))
    // layered cuff: blue, gold, white
    band(g, 0, 190, 256, 30, '#23457d', '#e8c267', 4)
    g.fillStyle = '#f7ecd2'
    g.fillRect(0, 220, 256, 36)
    g.fillStyle = '#e8c267'
    g.fillRect(0, 222, 256, 3)
    return toTexture(c)
  })

// ═══════════════════════════════════════════════════════════
//  Shared fabric helpers for the modern outfits
// ═══════════════════════════════════════════════════════════
/** Matte cotton / nylon: flat base, soft vertical folds, fine grain. */
function cotton(g: G2, base: string, w = W, h = H, grain = 0.05, seed = 1) {
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  const r = rng(seed * 97 + w)
  for (let i = 0; i < 26; i++) {
    const x = r() * w
    const grd = g.createLinearGradient(x - 30, 0, x + 30, 0)
    grd.addColorStop(0, 'rgba(0,0,0,0)')
    grd.addColorStop(0.5, r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(x - 30, 0, 60, h)
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${grain})` : `rgba(0,0,0,${grain})`
    g.fillRect(r() * w, r() * h, 1.5, 1.5)
  }
}

/** A few soft cloth folds (curved darker strokes with a lit edge). */
function folds(g: G2, list: [number, number, number, number, number, number][], dark = 'rgba(0,0,0,0.16)', lit = 'rgba(255,255,255,0.08)') {
  g.lineCap = 'round'
  for (const [x0, y0, cx, cy, x1, y1] of list) {
    g.strokeStyle = dark
    g.lineWidth = 7
    g.beginPath()
    g.moveTo(x0, y0)
    g.quadraticCurveTo(cx, cy, x1, y1)
    g.stroke()
    g.strokeStyle = lit
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(x0 + 5, y0 - 3)
    g.quadraticCurveTo(cx + 5, cy - 3, x1 + 5, y1 - 3)
    g.stroke()
  }
}

/** Dashed top-stitching along a line. */
function stitch(g: G2, x0: number, y0: number, x1: number, y1: number, color: string) {
  g.save()
  g.strokeStyle = color
  g.lineWidth = 1.6
  g.setLineDash([6, 5])
  g.beginPath()
  g.moveTo(x0, y0)
  g.lineTo(x1, y1)
  g.stroke()
  g.restore()
}

// ═══════════════════════════════════════════════════════════
//  LỰC — a navy crew-neck T-shirt
// ═══════════════════════════════════════════════════════════
const NAVY = '#26324f'
export const lucTeeTex = () =>
  once('luc-tee', () => {
    const [c, g] = canvas(W, H)
    cotton(g, NAVY, W, H, 0.05, 3)
    // soft jersey folds under the arms and across the belly
    folds(g, [
      [W * 0.2, Y(0.75), W * 0.18, Y(0.5), W * 0.15, Y(0.2)],
      [W * 0.8, Y(0.75), W * 0.82, Y(0.5), W * 0.85, Y(0.2)],
      [W * 0.42, Y(0.36), W * 0.5, Y(0.3), W * 0.58, Y(0.36)],
      [W * 0.9, Y(0.3), W * 0.96, Y(0.24), W * 1.02, Y(0.3)],
    ])
    // double-needle hem
    stitch(g, 0, Y(0.05), W, Y(0.05), 'rgba(255,255,255,0.18)')
    stitch(g, 0, Y(0.035), W, Y(0.035), 'rgba(255,255,255,0.12)')
    // a small print on the left chest: a mountain and "small steps · big dreams"
    const x = W * 0.085
    const y = Y(0.72)
    g.strokeStyle = '#f3efe4'
    g.fillStyle = '#f3efe4'
    g.lineWidth = 2.4
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(x - 22, y + 8)
    g.lineTo(x - 8, y - 10)
    g.lineTo(x, y - 2)
    g.lineTo(x + 9, y - 14)
    g.lineTo(x + 24, y + 8)
    g.closePath()
    g.stroke()
    g.beginPath()
    g.arc(x + 14, y - 16, 3.5, 0, Math.PI * 2)
    g.fill()
    g.font = `800 10px ${FONT_UI}`
    g.textAlign = 'center'
    g.fillText('SMALL STEPS', x, y + 22)
    g.font = `700 8px ${FONT_UI}`
    g.fillText('BIG DREAMS', x, y + 32)
    // shoulder seams
    for (const u of [0.25, 0.75]) stitch(g, W * u - 30, Y(0.93), W * u + 30, Y(0.93), 'rgba(255,255,255,0.1)')
    return toTexture(c)
  })

export const lucTeeSleeve = () =>
  once('luc-tee-sleeve', () => {
    const [c, g] = canvas(256, 256)
    cotton(g, NAVY, 256, 256, 0.05, 5)
    folds(g, [[40, 110, 110, 90, 200, 120]])
    stitch(g, 0, 214, 256, 214, 'rgba(255,255,255,0.18)')
    g.fillStyle = 'rgba(0,0,0,0.12)'
    g.fillRect(0, 222, 256, 34)
    return toTexture(c)
  })

/** Woven label on the backpack. */
export const anipTex = () =>
  once('anip', () => {
    const [c, g] = canvas(128, 64)
    g.fillStyle = '#17181c'
    roundRect(g, 0, 0, 128, 64, 10)
    g.fill()
    g.strokeStyle = '#c9933f'
    g.lineWidth = 3
    roundRect(g, 6, 6, 116, 52, 7)
    g.stroke()
    g.fillStyle = '#e0a24a'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `800 30px ${FONT_UI}`
    g.fillText('ANIP', 64, 34)
    return toTexture(c)
  })

// ═══════════════════════════════════════════════════════════
//  IT GIRL — Khoa CNTT black polo: roundel logo + circuit print
// ═══════════════════════════════════════════════════════════
/** The faculty roundel (stylised): blue ring, lettering dots, a chip + swoosh. */
function fitRoundel(g: G2, x: number, y: number, r: number) {
  g.save()
  g.translate(x, y)
  g.fillStyle = '#f4f7ff'
  g.beginPath()
  g.arc(0, 0, r * 1.06, 0, Math.PI * 2)
  g.fill()
  const grd = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r)
  grd.addColorStop(0, '#5aa2ff')
  grd.addColorStop(1, '#1d56c8')
  g.fillStyle = grd
  g.beginPath()
  g.arc(0, 0, r, 0, Math.PI * 2)
  g.fill()
  // lettering ring
  g.fillStyle = 'rgba(255,255,255,0.85)'
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2
    g.fillRect(Math.cos(a) * r * 0.82 - 1, Math.sin(a) * r * 0.82 - 1, 2.4, 2.4)
  }
  g.strokeStyle = '#ffffff'
  g.lineWidth = 1.6
  g.beginPath()
  g.arc(0, 0, r * 0.68, 0, Math.PI * 2)
  g.stroke()
  // a little chip with pins, crossed by a swoosh
  g.fillStyle = '#ffffff'
  roundRect(g, -r * 0.26, -r * 0.3, r * 0.52, r * 0.46, 3)
  g.fill()
  g.fillStyle = '#1d56c8'
  g.font = `900 ${r * 0.3}px ${FONT_UI}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('IT', 0, -r * 0.07)
  g.strokeStyle = '#ffffff'
  g.lineWidth = 1.4
  for (let k = -1; k <= 1; k++) {
    g.beginPath()
    g.moveTo(k * r * 0.14, -r * 0.3)
    g.lineTo(k * r * 0.14, -r * 0.42)
    g.moveTo(k * r * 0.14, r * 0.16)
    g.lineTo(k * r * 0.14, r * 0.28)
    g.stroke()
  }
  g.strokeStyle = '#bfe0ff'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(-r * 0.55, r * 0.42)
  g.quadraticCurveTo(0, r * 0.15, r * 0.55, r * 0.34)
  g.stroke()
  g.restore()
}

/** Printed-circuit traces: 45° jogs ending in round pads. */
function circuit(g: G2, x0: number, x1: number, y0: number, y1: number, n: number, seed: number, color = '#4a8dff') {
  const r = rng(seed)
  g.save()
  g.shadowColor = 'rgba(80,150,255,0.6)'
  g.shadowBlur = 4
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = 3
  g.lineJoin = 'round'
  for (let i = 0; i < n; i++) {
    let x = x0 + ((i + 0.5) / n) * (x1 - x0)
    let y = y1
    g.beginPath()
    g.moveTo(x, y)
    const top = y0 + r() * (y1 - y0) * 0.6
    while (y > top) {
      const seg = 20 + r() * 40
      y -= seg
      g.lineTo(x, y)
      if (r() < 0.5) {
        const j = (r() < 0.5 ? -1 : 1) * (10 + r() * 14)
        x += j
        y -= Math.abs(j)
        g.lineTo(x, y)
      }
    }
    g.stroke()
    g.beginPath()
    g.arc(x, y, 5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1b1c22'
    g.beginPath()
    g.arc(x, y, 2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = color
  }
  g.restore()
}

export const uniPoloTex = () =>
  once('uni-polo', () => {
    const [c, g] = canvas(W, H)
    cotton(g, '#1d1e25', W, H, 0.05, 7)
    // piqué knit: a faint dotted weave
    g.fillStyle = 'rgba(255,255,255,0.035)'
    for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) g.fillRect(x, y, 1.4, 1.4)
    folds(g, [
      [W * 0.2, Y(0.7), W * 0.17, Y(0.45), W * 0.15, Y(0.2)],
      [W * 0.8, Y(0.7), W * 0.83, Y(0.45), W * 0.85, Y(0.2)],
      [W * 0.45, Y(0.4), W * 0.5, Y(0.33), W * 0.55, Y(0.4)],
    ])
    // side vents at the hem
    for (const x of [W * 0.25, W * 0.75]) {
      g.fillStyle = '#121318'
      g.fillRect(x - 2, Y(0.06), 4, H * 0.06)
    }
    stitch(g, 0, Y(0.035), W, Y(0.035), 'rgba(255,255,255,0.14)')
    // the circuit print climbing the lower front (her right side) …
    circuit(g, W * 0.86, W * 0.985, Y(0.62), Y(0.02), 6, 41)
    // … and a few traces wrapping onto the back
    circuit(g, W * 0.6, W * 0.7, Y(0.4), Y(0.02), 3, 43, '#3a7be8')
    // button placket with three white buttons
    const placket = (x: number) => {
      g.fillStyle = '#23252e'
      g.fillRect(x - 17, 0, 34, Y(0.7))
      g.strokeStyle = 'rgba(255,255,255,0.12)'
      g.lineWidth = 1.5
      g.strokeRect(x - 17, -2, 34, Y(0.7) + 2)
    }
    placket(0)
    placket(W)
    for (const v of [0.94, 0.86, 0.78]) {
      for (const x of [0, W]) {
        g.fillStyle = '#f2f2ee'
        g.beginPath()
        g.arc(x, Y(v), 6, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(x - 3, Y(v) - 0.7, 6, 1.4)
      }
    }
    // faculty roundel + a tiny caption on the left chest
    fitRoundel(g, W * 0.085, Y(0.69), 30)
    g.fillStyle = 'rgba(240,244,255,0.85)'
    g.font = `800 9px ${FONT_UI}`
    g.textAlign = 'center'
    g.fillText('KHOA CÔNG NGHỆ THÔNG TIN', W * 0.085, Y(0.69) + 44)
    return toTexture(c)
  })

export const uniSleeve = () =>
  once('uni-sleeve', () => {
    const [c, g] = canvas(256, 256)
    cotton(g, '#1d1e25', 256, 256, 0.05, 9)
    circuit(g, 150, 230, 20, 200, 3, 47)
    // ribbed cuff with a blue tipping line
    g.fillStyle = '#16171c'
    g.fillRect(0, 196, 256, 60)
    for (let x = 0; x < 256; x += 5) {
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(x, 196, 2, 60)
    }
    g.fillStyle = '#3f7fe6'
    g.fillRect(0, 222, 256, 8)
    return toTexture(c)
  })

/** Laptop lid (brushed silver + stickers) and screen (code, syntax colours). */
export const laptopLidTex = () =>
  once('laptop-lid', () => {
    const [c, g] = canvas(256, 176)
    const grd = g.createLinearGradient(0, 0, 256, 176)
    grd.addColorStop(0, '#dcdfe5')
    grd.addColorStop(0.5, '#c4c8d0')
    grd.addColorStop(1, '#d6d9df')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 176)
    for (let y = 0; y < 176; y += 2) {
      g.fillStyle = `rgba(255,255,255,${0.04 + ((y * 7) % 5) * 0.01})`
      g.fillRect(0, y, 256, 1)
    }
    // stickers: </> badge, a star, a cat face, a blue heart
    g.fillStyle = '#2f6fd6'
    roundRect(g, 26, 30, 78, 40, 12)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = `900 26px ui-monospace, Menlo, Consolas, monospace`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('</>', 65, 51)
    g.fillStyle = '#ffd35a'
    g.beginPath()
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2
      const rr = k % 2 ? 9 : 21
      g.lineTo(190 + Math.cos(a) * rr, 50 + Math.sin(a) * rr)
    }
    g.fill()
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(70, 124, 22, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2a2a33'
    g.beginPath()
    g.arc(62, 122, 3, 0, Math.PI * 2)
    g.arc(78, 122, 3, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(52, 108)
    g.lineTo(56, 96)
    g.lineTo(64, 104)
    g.moveTo(88, 108)
    g.lineTo(84, 96)
    g.lineTo(76, 104)
    g.fillStyle = '#ffffff'
    g.fill()
    g.fillStyle = '#4a8dff'
    g.beginPath()
    g.moveTo(190, 140)
    g.bezierCurveTo(166, 122, 172, 100, 190, 112)
    g.bezierCurveTo(208, 100, 214, 122, 190, 140)
    g.fill()
    return toTexture(c)
  })

export const laptopScreenTex = () =>
  once('laptop-screen', () => {
    const [c, g] = canvas(256, 176)
    g.fillStyle = '#141a2e'
    g.fillRect(0, 0, 256, 176)
    g.fillStyle = '#1d2540'
    g.fillRect(0, 0, 256, 14)
    for (const [x, col] of [
      [8, '#ff6b6b'],
      [18, '#ffd35a'],
      [28, '#5fd38a'],
    ] as [number, string][]) {
      g.fillStyle = col
      g.beginPath()
      g.arc(x, 7, 3, 0, Math.PI * 2)
      g.fill()
    }
    const r = rng(12)
    const cols = ['#7fb2ff', '#c792ea', '#5fd3c8', '#ffd35a', '#f78c6c', '#e6edf3']
    for (let row = 0; row < 11; row++) {
      let x = 10 + (row % 4 === 0 ? 0 : 14 * (1 + (row % 3)))
      const y = 26 + row * 13
      const n = 2 + Math.floor(r() * 4)
      for (let k = 0; k < n; k++) {
        const w = 12 + r() * 40
        g.fillStyle = cols[Math.floor(r() * cols.length)]
        roundRect(g, x, y, w, 6, 3)
        g.fill()
        x += w + 6
        if (x > 230) break
      }
    }
    g.fillStyle = '#e6edf3'
    g.fillRect(96, 26 + 11 * 13 - 2, 7, 10)
    return toTexture(c)
  })

/** A comic speech bubble with "</>" in it. */
export const bubbleTex = () =>
  once('bubble', () => {
    const [c, g] = canvas(256, 200)
    g.fillStyle = '#ffffff'
    g.strokeStyle = '#2a2436'
    g.lineWidth = 7
    roundRect(g, 10, 10, 236, 140, 60)
    g.fill()
    g.stroke()
    g.beginPath()
    g.moveTo(96, 146)
    g.lineTo(80, 190)
    g.lineTo(132, 148)
    g.closePath()
    g.fill()
    g.stroke()
    g.fillStyle = '#ffffff'
    g.fillRect(92, 138, 44, 12)
    g.fillStyle = '#2f6fd6'
    g.font = `900 78px ui-monospace, Menlo, Consolas, monospace`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('</>', 128, 82)
    return toTexture(c)
  })

// ═══════════════════════════════════════════════════════════
//  HÀ NỘI FRIEND — butter-yellow shirt worn open over a white tank
// ═══════════════════════════════════════════════════════════
export const hanoiShirtTex = () =>
  once('hanoi-shirt', () => {
    const [c, g] = canvas(W, H)
    cotton(g, '#f6e6a2', W, H, 0.04, 11)
    // linen slub: short horizontal flecks
    const r = rng(19)
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(190,160,70,0.12)'
      g.fillRect(r() * W, r() * H, 6 + r() * 16, 1.2)
    }
    folds(
      g,
      [
        [W * 0.18, Y(0.78), W * 0.2, Y(0.5), W * 0.16, Y(0.18)],
        [W * 0.82, Y(0.78), W * 0.8, Y(0.5), W * 0.84, Y(0.18)],
        [W * 0.38, Y(0.62), W * 0.5, Y(0.52), W * 0.62, Y(0.62)],
        [W * 0.4, Y(0.25), W * 0.5, Y(0.2), W * 0.6, Y(0.25)],
      ],
      'rgba(170,130,40,0.2)',
      'rgba(255,255,255,0.3)',
    )
    // back yoke + breast pocket on her left
    stitch(g, W * 0.32, Y(0.84), W * 0.68, Y(0.84), 'rgba(160,120,40,0.45)')
    g.strokeStyle = 'rgba(160,120,40,0.45)'
    g.lineWidth = 2
    roundRect(g, W * 0.12 - 26, Y(0.72), 52, 58, 6)
    g.stroke()
    stitch(g, W * 0.12 - 24, Y(0.72) + 10, W * 0.12 + 24, Y(0.72) + 10, 'rgba(160,120,40,0.5)')
    // the open front: white tank, a scoop neckline, skin in the open collar, a fine necklace
    const open = (x: number, half: number) => {
      g.fillStyle = '#fbfaf5'
      g.fillRect(x - half, Y(0.84), half * 2, H)
      g.fillStyle = 'rgba(0,0,0,0.05)'
      for (let y = Y(0.84); y < H; y += 7) g.fillRect(x - half, y, half * 2, 1)
      // neckline scoop and the skin above it
      g.fillStyle = '#fde3cf'
      g.beginPath()
      g.moveTo(x - half, Y(1))
      g.lineTo(x + half, Y(1))
      g.lineTo(x + half, Y(0.84))
      g.quadraticCurveTo(x, Y(0.76), x - half, Y(0.84))
      g.closePath()
      g.fill()
      g.strokeStyle = '#e9e5da'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(x - half, Y(0.84))
      g.quadraticCurveTo(x, Y(0.76), x + half, Y(0.84))
      g.stroke()
      g.strokeStyle = '#d9a441'
      g.lineWidth = 1.6
      g.beginPath()
      g.moveTo(x - half, Y(0.95))
      g.quadraticCurveTo(x, Y(0.86), x + half, Y(0.95))
      g.stroke()
      g.fillStyle = '#e8c267'
      g.beginPath()
      g.moveTo(x, Y(0.885) - 2)
      g.lineTo(x + 5, Y(0.885) + 5)
      g.lineTo(x, Y(0.885) + 12)
      g.lineTo(x - 5, Y(0.885) + 5)
      g.closePath()
      g.fill()
    }
    open(0, 58)
    open(W, 58)
    // the shirt's front edges: a folded placket with buttons on her right side
    for (const x of [58, W - 58]) {
      g.fillStyle = 'rgba(200,160,60,0.35)'
      g.fillRect(x - 3, 0, 6, H)
      g.fillStyle = 'rgba(255,255,255,0.4)'
      g.fillRect(x + (x < W / 2 ? 3 : -5), 0, 2, H)
    }
    for (let v = 0.12; v < 0.8; v += 0.16) {
      g.fillStyle = '#fffdf6'
      g.beginPath()
      g.arc(W - 70, Y(v), 5.5, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(180,140,60,0.5)'
      g.lineWidth = 1
      g.stroke()
    }
    return toTexture(c)
  })

export const hanoiSleeve = () =>
  once('hanoi-sleeve', () => {
    const [c, g] = canvas(256, 256)
    cotton(g, '#f6e6a2', 256, 256, 0.04, 13)
    folds(g, [[30, 90, 110, 70, 200, 100]], 'rgba(170,130,40,0.18)', 'rgba(255,255,255,0.3)')
    // rolled-up cuff
    g.fillStyle = '#f9ecbb'
    g.fillRect(0, 186, 256, 70)
    g.fillStyle = 'rgba(170,130,40,0.35)'
    g.fillRect(0, 184, 256, 4)
    g.fillRect(0, 222, 256, 3)
    return toTexture(c)
  })

// ═══════════════════════════════════════════════════════════
//  BỐ — áo cánh nâu (homespun, cloth-knot buttons, a patch)
// ═══════════════════════════════════════════════════════════
/** coarse homespun: visible cross-weave */
function homespun(g: G2, base: string, w = W, h = H, seed = 1) {
  cotton(g, base, w, h, 0.06, seed)
  g.globalAlpha = 0.07
  g.fillStyle = '#000'
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1)
  g.fillStyle = '#fff'
  for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h)
  g.globalAlpha = 1
}

export const fatherShirtTex = () =>
  once('father-shirt', () => {
    const [c, g] = canvas(W, H)
    homespun(g, '#7b5a3c', W, H, 31)
    folds(
      g,
      [
        [W * 0.2, Y(0.8), W * 0.17, Y(0.5), W * 0.14, Y(0.15)],
        [W * 0.8, Y(0.8), W * 0.83, Y(0.5), W * 0.86, Y(0.15)],
        [W * 0.4, Y(0.4), W * 0.5, Y(0.33), W * 0.6, Y(0.4)],
      ],
      'rgba(40,25,10,0.22)',
      'rgba(255,230,190,0.1)',
    )
    // faded patches where the sun and work have worn it
    for (const [x, y, r] of [
      [W * 0.3, Y(0.55), 60],
      [W * 0.62, Y(0.7), 80],
    ]) {
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      grd.addColorStop(0, 'rgba(200,170,120,0.18)')
      grd.addColorStop(1, 'rgba(200,170,120,0)')
      g.fillStyle = grd
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // a mended patch on the back, stitched round
    g.fillStyle = '#8a6a48'
    g.fillRect(W * 0.52, Y(0.62), 70, 56)
    stitch(g, W * 0.52, Y(0.62), W * 0.52 + 70, Y(0.62), 'rgba(40,25,10,0.6)')
    stitch(g, W * 0.52, Y(0.62) + 56, W * 0.52 + 70, Y(0.62) + 56, 'rgba(40,25,10,0.6)')
    stitch(g, W * 0.52, Y(0.62), W * 0.52, Y(0.62) + 56, 'rgba(40,25,10,0.6)')
    stitch(g, W * 0.52 + 70, Y(0.62), W * 0.52 + 70, Y(0.62) + 56, 'rgba(40,25,10,0.6)')
    // two patch pockets on the lower front
    for (const x of [W * 0.11, W * 0.89]) {
      g.fillStyle = 'rgba(60,40,20,0.18)'
      g.fillRect(x - 32, Y(0.36), 64, 58)
      stitch(g, x - 32, Y(0.36), x + 32, Y(0.36), 'rgba(40,25,10,0.5)')
    }
    // the front slit and cloth-knot buttons (cúc vải) down from the neck
    for (const x of [0, W]) {
      g.fillStyle = 'rgba(40,25,10,0.35)'
      g.fillRect(x - 2, 0, 4, Y(0.55))
      for (const v of [0.93, 0.83, 0.73, 0.63]) {
        g.fillStyle = '#5a3f28'
        g.beginPath()
        g.arc(x, Y(v), 6, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = '#3a2818'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(x - 12, Y(v))
        g.lineTo(x + 12, Y(v))
        g.stroke()
      }
    }
    return toTexture(c)
  })

export const fatherSleeve = () =>
  once('father-sleeve', () => {
    const [c, g] = canvas(256, 256)
    homespun(g, '#7b5a3c', 256, 256, 33)
    // sleeves rolled up to the elbow
    g.fillStyle = '#8c6a48'
    g.fillRect(0, 180, 256, 76)
    g.fillStyle = 'rgba(40,25,10,0.3)'
    g.fillRect(0, 178, 256, 4)
    g.fillRect(0, 218, 256, 3)
    return toTexture(c)
  })

/** black-and-white gingham for his khăn */
export const ginghamTex = () =>
  once('gingham', () => {
    const [c, g] = canvas(128, 128)
    g.fillStyle = '#f1ede4'
    g.fillRect(0, 0, 128, 128)
    const n = 8
    const s = 128 / n
    g.fillStyle = 'rgba(40,38,40,0.55)'
    for (let i = 0; i < n; i += 2) {
      g.fillRect(i * s, 0, s, 128)
      g.fillRect(0, i * s, 128, s)
    }
    g.fillStyle = 'rgba(30,28,30,0.55)'
    for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) g.fillRect(i * s, j * s, s, s)
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(3, 3)
    return t
  })

// ═══════════════════════════════════════════════════════════
//  MẸ — áo tứ thân in faded indigo over a red yếm and a green skirt
// ═══════════════════════════════════════════════════════════
export const motherCoatTex = () =>
  once('mother-coat', () => {
    const [c, g] = canvas(W, H)
    homespun(g, '#4d5a8c', W, H, 41)
    // indigo fades unevenly
    const r = rng(43)
    for (let i = 0; i < 30; i++) {
      const x = r() * W
      const y = r() * H
      const rad = 30 + r() * 90
      const grd = g.createRadialGradient(x, y, 0, x, y, rad)
      grd.addColorStop(0, r() < 0.5 ? 'rgba(120,130,170,0.16)' : 'rgba(20,25,50,0.16)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    folds(
      g,
      [
        [W * 0.22, Y(0.8), W * 0.2, Y(0.45), W * 0.17, Y(0.05)],
        [W * 0.78, Y(0.8), W * 0.8, Y(0.45), W * 0.83, Y(0.05)],
        [W * 0.45, Y(0.5), W * 0.5, Y(0.25), W * 0.55, Y(0.05)],
      ],
      'rgba(10,15,40,0.25)',
      'rgba(200,210,255,0.08)',
    )
    // the open front: red yếm above the sash, dark green skirt below
    const open = (x: number, half: number) => {
      g.fillStyle = '#b04a36'
      g.fillRect(x - half, 0, half * 2, Y(0.5))
      g.fillStyle = 'rgba(255,200,170,0.15)'
      g.fillRect(x - half, 0, half * 2, 6)
      g.fillStyle = '#4c5a3b'
      g.fillRect(x - half, Y(0.46), half * 2, H - Y(0.46))
      g.fillStyle = 'rgba(0,0,0,0.12)'
      for (let y = Y(0.46); y < H; y += 9) g.fillRect(x - half, y, half * 2, 1.5)
    }
    open(0, 46)
    open(W, 46)
    // the coat's front edges (nẹp) in a darker indigo
    for (const x of [46, W - 46]) {
      g.fillStyle = '#34406a'
      g.fillRect(x - 7, 0, 14, H)
    }
    // hem
    g.fillStyle = '#34406a'
    g.fillRect(0, H - 12, W, 12)
    return toTexture(c)
  })

export const motherSleeve = () =>
  once('mother-sleeve', () => {
    const [c, g] = canvas(256, 256)
    homespun(g, '#4d5a8c', 256, 256, 45)
    folds(g, [[30, 120, 120, 100, 220, 130]], 'rgba(10,15,40,0.25)', 'rgba(200,210,255,0.08)')
    g.fillStyle = '#34406a'
    g.fillRect(0, 226, 256, 30)
    return toTexture(c)
  })

// ═══════════════════════════════════════════════════════════
//  The diploma (bằng tốt nghiệp), made in the manner of a sớ
// ═══════════════════════════════════════════════════════════
export const diplomaTex = () =>
  once('diploma', () => {
    const DW = 1024
    const DH = 400
    const [c, g] = canvas(DW, DH)
    // warm yellow sớ paper with fibres
    const grd = g.createLinearGradient(0, 0, 0, DH)
    grd.addColorStop(0, '#f6e6b4')
    grd.addColorStop(1, '#efd99a')
    g.fillStyle = grd
    g.fillRect(0, 0, DW, DH)
    const r = rng(77)
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(160,120,60,${0.04 + r() * 0.06})`
      g.fillRect(r() * DW, r() * DH, 4 + r() * 22, 1)
    }
    // red double border with gold cloud corners
    g.strokeStyle = '#b3262e'
    g.lineWidth = 10
    g.strokeRect(16, 16, DW - 32, DH - 32)
    g.lineWidth = 3
    g.strokeRect(32, 32, DW - 64, DH - 64)
    for (const [x, y] of [
      [48, 48],
      [DW - 48, 48],
      [48, DH - 48],
      [DW - 48, DH - 48],
    ])
      cloud(g, x + (x < DW / 2 ? 16 : -16), y + (y < DH / 2 ? 10 : -6), 12, '#c8962e', 3)
    // vertical Hán columns at both ends: 文憑 (diploma) and 畢業 (graduation)
    const col = (x: number, text: string) => {
      g.fillStyle = '#b3262e'
      g.fillRect(x - 34, 66, 68, DH - 132)
      g.fillStyle = '#f6e6b4'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `52px ${FONT_CJK}`
      ;[...text].forEach((ch, i) => g.fillText(ch, x, 130 + i * 70))
    }
    col(DW - 96, '文憑')
    col(96, '畢業')
    // the body, centred
    g.fillStyle = '#b3262e'
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.font = `900 50px ${FONT_UI}`
    g.fillText('BẰNG TỐT NGHIỆP', DW / 2, 106)
    g.fillStyle = '#3a2418'
    g.font = `700 22px ${FONT_UI}`
    g.fillText('TRƯỜNG ĐẠI HỌC NÔNG LÂM TP. HỒ CHÍ MINH', DW / 2, 146)
    g.fillText('KHOA CÔNG NGHỆ THÔNG TIN', DW / 2, 176)
    g.font = `italic 400 30px ${FONT_DISPLAY}`
    g.fillText('Sinh viên', DW / 2 - 150, 236)
    g.font = `700 44px ${FONT_DISPLAY}`
    g.fillText(CAST.luc, DW / 2 + 40, 238)
    g.font = `italic 400 24px ${FONT_DISPLAY}`
    g.fillText('đã hoàn thành chương trình đào tạo đại học', DW / 2, 286)
    // a big red seal, slightly askew
    g.save()
    g.translate(DW / 2 + 322, 306)
    g.rotate(-0.18)
    g.strokeStyle = 'rgba(190,30,36,0.85)'
    g.lineWidth = 6
    g.beginPath()
    g.arc(0, 0, 44, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = 'rgba(190,30,36,0.85)'
    g.font = `40px ${FONT_CJK}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('印', 0, 2)
    g.restore()
    return toTexture(c)
  })

/** a woven sedge mat (chiếu) with red border stripes */
export const matTex = () =>
  once('chieu', () => {
    const [c, g] = canvas(256, 192)
    g.fillStyle = '#d9c08a'
    g.fillRect(0, 0, 256, 192)
    for (let y = 0; y < 192; y += 4) {
      for (let x = (y / 4) % 2 ? 0 : 4; x < 256; x += 8) {
        g.fillStyle = 'rgba(150,110,50,0.35)'
        g.fillRect(x, y, 4, 3)
      }
    }
    for (const y of [14, 22, 170, 178]) {
      g.fillStyle = '#b8453a'
      g.fillRect(0, y, 256, 4)
    }
    return toTexture(c)
  })
