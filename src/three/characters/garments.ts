import * as THREE from 'three'
import { canvas, FONT_UI, roundRect, toTexture } from '../lib/textures'
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
//  Áo đối khâm — parallel-collar gown over a red yếm and dark skirt
// ═══════════════════════════════════════════════════════════
export const doiKhamTex = () =>
  once('doikham', () => {
    const [c, g] = canvas(W, H)
    silk(g, '#2e6b66')
    // woven lozenge-and-flower brocade
    scatter(g, 0, 0, W, Y(0.08), 34, (x, y, i) => {
      g.strokeStyle = 'rgba(214,190,120,0.45)'
      g.lineWidth = 1.4
      g.beginPath()
      g.moveTo(x, y - 9)
      g.lineTo(x + 9, y)
      g.lineTo(x, y + 9)
      g.lineTo(x - 9, y)
      g.closePath()
      g.stroke()
      if (i % 3 === 0) {
        g.fillStyle = 'rgba(232,194,103,0.55)'
        g.beginPath()
        g.arc(x, y, 2.6, 0, Math.PI * 2)
        g.fill()
      }
    })
    // hem band
    band(g, 0, Y(0.08), W, H * 0.08, '#e9d8a6', '#b3262e', 4)
    scatter(g, 0, Y(0.08), W, H, 26, (x, y) => cloud(g, x, y + 4, 6, 'rgba(160,60,40,0.7)', 1.2))
    // the front: red yếm above, dark skirt below, framed by the parallel collar bands (nẹp)
    frontStrip(g, 40, 0, H, (x, w, y0, y1) => {
      g.fillStyle = '#2a2228'
      g.fillRect(x, y0, w, y1 - y0)
      g.fillStyle = '#c8342b'
      g.fillRect(x, 0, w, Y(0.62))
      g.fillStyle = 'rgba(243,217,138,0.9)'
      g.fillRect(x, Y(0.62) - 3, w, 3)
    })
    for (const cx of [W * 0.043, W * 0.957]) {
      band(g, cx - 13, 0, 26, H, '#e9d8a6', '#b3262e', 3)
      for (let y = 18; y < H; y += 30) {
        g.fillStyle = 'rgba(179,38,46,0.7)'
        g.beginPath()
        g.arc(cx, y, 3.2, 0, Math.PI * 2)
        g.fill()
      }
    }
    return toTexture(c)
  })

export const doiKhamSleeve = () =>
  once('doikham-sleeve', () => {
    const [c, g] = canvas(256, 256)
    silk(g, '#2e6b66', 256, 256)
    band(g, 0, 200, 256, 56, '#e9d8a6', '#b3262e', 4)
    for (let x = 16; x < 256; x += 32) cloud(g, x, 230, 7, 'rgba(160,60,40,0.7)', 1.2)
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
//  LỰC — black coach jacket over a navy hoodie
// ═══════════════════════════════════════════════════════════
export const lucJacketTex = () =>
  once('luc-jacket', () => {
    const [c, g] = canvas(W, H)
    cotton(g, '#232429', W, H, 0.045, 3)
    // nylon sheen: two broad soft highlights where the light rolls over the chest and back
    for (const x of [W * 0.12, W * 0.62]) {
      const grd = g.createRadialGradient(x, Y(0.62), 10, x, Y(0.62), 220)
      grd.addColorStop(0, 'rgba(160,170,200,0.12)')
      grd.addColorStop(1, 'rgba(160,170,200,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
    }
    // ribbed drawcord hem
    g.fillStyle = '#1b1c20'
    g.fillRect(0, Y(0.07), W, H * 0.07)
    for (let x = 0; x < W; x += 6) {
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(x, Y(0.07), 2, H * 0.07)
    }
    // cord toggles either side of the zip
    for (const x of [44, W - 44]) {
      g.fillStyle = '#e9e6de'
      roundRect(g, x - 6, Y(0.05) - 4, 12, 22, 4)
      g.fill()
      g.strokeStyle = '#e9e6de'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(x, Y(0.05) + 18)
      g.lineTo(x + (x < W / 2 ? -8 : 8), Y(0.0) - 2)
      g.stroke()
    }
    // welt pockets, slanted
    for (const [x, dir] of [
      [W * 0.115, 1],
      [W * 0.885, -1],
    ]) {
      g.save()
      g.translate(x, Y(0.3))
      g.rotate(dir * 0.35)
      g.fillStyle = '#131418'
      roundRect(g, -34, -6, 68, 12, 4)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.1)'
      g.fillRect(-32, -7, 64, 2)
      g.restore()
    }
    // folds from the armpits toward the waist, and a sag across the back
    folds(g, [
      [W * 0.2, Y(0.72), W * 0.18, Y(0.5), W * 0.14, Y(0.35)],
      [W * 0.8, Y(0.72), W * 0.82, Y(0.5), W * 0.86, Y(0.35)],
      [W * 0.4, Y(0.55), W * 0.5, Y(0.47), W * 0.6, Y(0.55)],
      [W * 0.42, Y(0.3), W * 0.5, Y(0.24), W * 0.58, Y(0.3)],
    ])
    // back yoke seam with top-stitching
    stitch(g, W * 0.3, Y(0.82), W * 0.7, Y(0.82), 'rgba(255,255,255,0.22)')
    // tiny white print on the left chest
    g.fillStyle = '#f1efe9'
    g.font = `800 15px ${FONT_UI}`
    g.textAlign = 'center'
    g.fillText('SMALL STEPS', W * 0.075, Y(0.74))
    g.fillRect(W * 0.075 - 22, Y(0.74) + 5, 44, 2)
    // the zip: tape, teeth and the pull near the collar
    const zip = (x: number) => {
      g.fillStyle = '#16171b'
      g.fillRect(x - 7, 0, 14, H)
      for (let y = 0; y < Y(0.07); y += 5) {
        g.fillStyle = '#8f949c'
        g.fillRect(x - 3, y, 6, 2.4)
      }
    }
    zip(0)
    zip(W)
    stitch(g, 12, 0, 12, H, 'rgba(255,255,255,0.18)')
    stitch(g, W - 12, 0, W - 12, H, 'rgba(255,255,255,0.18)')
    return toTexture(c)
  })

export const lucSleeve = () =>
  once('luc-sleeve', () => {
    const [c, g] = canvas(256, 256)
    cotton(g, '#232429', 256, 256, 0.045, 5)
    folds(g, [
      [40, 120, 90, 100, 150, 130],
      [110, 150, 160, 135, 220, 160],
    ])
    // elastic cuff
    g.fillStyle = '#1a1b1f'
    g.fillRect(0, 214, 256, 42)
    for (let x = 0; x < 256; x += 6) {
      g.fillStyle = 'rgba(255,255,255,0.06)'
      g.fillRect(x, 214, 2, 42)
    }
    return toTexture(c)
  })

/** "NY" monogram for the cap (stylised serif, white embroidery). */
export const nyTex = () =>
  once('ny', () => {
    const [c, g] = canvas(128, 128)
    g.clearRect(0, 0, 128, 128)
    g.fillStyle = '#f7f5ef'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `italic 700 78px Georgia, "Times New Roman", serif`
    g.fillText('N', 54, 60)
    g.font = `italic 700 70px Georgia, "Times New Roman", serif`
    g.fillText('Y', 76, 72)
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
