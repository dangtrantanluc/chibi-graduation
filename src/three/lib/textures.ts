import * as THREE from 'three'
import { PLAQUES } from '../../config'

export const FONT_DISPLAY = '"Fraunces Variable", Georgia, serif'
export const FONT_UI = '"Nunito", system-ui, sans-serif'
export const FONT_CJK = '"Yuji Boku", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif'

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return [c, ctx] as const
}

export function toTexture(c: HTMLCanvasElement, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

const memo = new Map<string, THREE.Texture>()
function once(key: string, make: () => THREE.Texture) {
  let t = memo.get(key)
  if (!t) {
    t = make()
    memo.set(key, t)
  }
  return t
}

/** Soft radial glow used for lantern halos, light pools and particles. */
export const glowTex = () =>
  once('glow', () => {
    const [c, g] = canvas(128, 128)
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    return toTexture(c)
  })

export const blushTex = () =>
  once('blush', () => {
    const [c, g] = canvas(64, 64)
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(255,128,140,0.85)')
    grd.addColorStop(0.55, 'rgba(255,140,150,0.35)')
    grd.addColorStop(1, 'rgba(255,150,160,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    return toTexture(c)
  })

/** Soft blob shadow for characters and props (toy-on-a-table grounding). */
export const shadowTex = () =>
  once('shadow', () => {
    const [c, g] = canvas(64, 64)
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(40,20,30,0.55)')
    grd.addColorStop(0.5, 'rgba(40,20,30,0.25)')
    grd.addColorStop(1, 'rgba(40,20,30,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    return toTexture(c)
  })

/**
 * Calligraphy plaques (hoành phi).
 *  `wood`  dark wood with gilt letters
 *  `hue`   red-and-black lacquer with a gold frame (Huế palaces)
 *  `stone` weathered plaster with raised, darker characters (village gates)
 */
export function plaqueTex(text: string, style: 'wood' | 'hue' | 'stone' = 'wood', w = 512, h = 220) {
  return once(`plaque:${style}:${text}:${w}`, () => {
    const [c, g] = canvas(w, h)
    const frame = style === 'hue' ? '#d9a441' : style === 'stone' ? '#8f887c' : '#6b4a2e'
    const field = style === 'hue' ? '#7a1f1b' : style === 'stone' ? '#b9b2a4' : '#2a2320'
    g.fillStyle = frame
    roundRect(g, 0, 0, w, h, style === 'stone' ? 8 : 22)
    g.fill()
    g.fillStyle = field
    roundRect(g, 16, 16, w - 32, h - 32, style === 'stone' ? 4 : 14)
    g.fill()
    if (style === 'stone') {
      for (let i = 0; i < 900; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(60,55,45,0.12)' : 'rgba(255,255,255,0.1)'
        g.fillRect(16 + Math.random() * (w - 32), 16 + Math.random() * (h - 32), 2 + Math.random() * 6, 2)
      }
    }
    g.strokeStyle = style === 'hue' ? 'rgba(240,200,110,0.8)' : style === 'stone' ? 'rgba(90,82,70,0.6)' : 'rgba(233,196,106,0.55)'
    g.lineWidth = 4
    roundRect(g, 28, 28, w - 56, h - 56, 10)
    g.stroke()
    g.fillStyle = style === 'hue' ? '#f3cf6a' : style === 'stone' ? '#4a443c' : '#f1d58a'
    g.shadowColor = style === 'stone' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'
    g.shadowBlur = style === 'stone' ? 0 : 6
    g.shadowOffsetY = style === 'stone' ? -2 : 3
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const size = Math.min(h * 0.6, (w * 0.8) / Math.max(1, text.length))
    g.font = `${size}px ${FONT_CJK}`
    g.fillText(text, w / 2, h / 2 + size * 0.04)
    return toTexture(c)
  })
}

/** Vertical lacquered couplet board (câu đối) with gold characters. */
export function coupletTex(text: string, style: 'hue' | 'binhdinh' = 'hue') {
  return once(`couplet:${style}:${text}`, () => {
    const W = 128
    const H = 640
    const [c, g] = canvas(W, H)
    g.fillStyle = style === 'hue' ? '#d9a441' : '#e9dfc8'
    roundRect(g, 0, 0, W, H, style === 'hue' ? 18 : 6)
    g.fill()
    g.fillStyle = style === 'hue' ? '#8a1f1a' : '#b8352c'
    roundRect(g, 9, 9, W - 18, H - 18, style === 'hue' ? 12 : 4)
    g.fill()
    g.fillStyle = style === 'hue' ? '#f3cf6a' : '#fbf1e0'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const chars = [...text]
    const step = (H - 80) / chars.length
    g.font = `${Math.min(92, step * 0.86)}px ${FONT_CJK}`
    chars.forEach((ch, i) => g.fillText(ch, W / 2, 40 + step * (i + 0.5)))
    return toTexture(c)
  })
}

/** Hội An silk lantern panel — white silk (tinted per lantern) with gilt ribs. */
export const silkTex = () =>
  once('silk', () => {
    const [c, g] = canvas(512, 256)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 512, 256)
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`
      g.fillRect(Math.random() * 512, Math.random() * 256, 12, 1)
    }
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * 512
      g.fillStyle = '#e9c46a'
      g.fillRect(x - 2, 0, 5, 256)
      g.fillStyle = 'rgba(120,70,20,0.35)'
      g.fillRect(x + 3, 0, 2, 256)
    }
    g.fillStyle = '#e9c46a'
    g.fillRect(0, 0, 512, 14)
    g.fillRect(0, 242, 512, 14)
    return toTexture(c)
  })

/** Wooden lattice over warm paper — windows and hall doors. */
export const latticeTex = () =>
  once('lattice', () => {
    const [c, g] = canvas(256, 256)
    const grd = g.createRadialGradient(128, 150, 10, 128, 128, 190)
    grd.addColorStop(0, '#ffe9c2')
    grd.addColorStop(1, '#f2c98f')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = '#6b2f22'
    g.lineWidth = 7
    g.strokeRect(4, 4, 248, 248)
    g.lineWidth = 5
    const n = 5
    for (let i = 1; i < n; i++) {
      const p = (i / n) * 256
      g.beginPath()
      g.moveTo(p, 0)
      g.lineTo(p, 256)
      g.moveTo(0, p)
      g.lineTo(256, p)
      g.stroke()
    }
    // a little diamond motif in the centre
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(128, 78)
    g.lineTo(178, 128)
    g.lineTo(128, 178)
    g.lineTo(78, 128)
    g.closePath()
    g.stroke()
    return toTexture(c)
  })

/** Tileable water ripple normal map (sum of sines). */
export const waterNormalTex = () =>
  once('waterN', () => {
    const S = 128
    const [c, g] = canvas(S, S)
    const img = g.createImageData(S, S)
    const hgt = (x: number, y: number) => {
      const u = (x / S) * Math.PI * 2
      const v = (y / S) * Math.PI * 2
      return (
        Math.sin(u * 3 + Math.sin(v * 2) * 0.8) * 0.5 +
        Math.sin(v * 4 + u * 1) * 0.35 +
        Math.sin((u + v) * 5) * 0.15
      )
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = hgt(x + 1, y) - hgt(x - 1, y)
        const dy = hgt(x, y + 1) - hgt(x, y - 1)
        const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize()
        const i = (y * S + x) * 4
        img.data[i] = (n.x * 0.5 + 0.5) * 255
        img.data[i + 1] = (n.y * 0.5 + 0.5) * 255
        img.data[i + 2] = (n.z * 0.5 + 0.5) * 255
        img.data[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    return toTexture(c, false, true)
  })

export function numberTex(text: string, bg: string, fg: string) {
  return once(`num:${text}:${bg}:${fg}`, () => {
    const [c, g] = canvas(128, 128)
    g.fillStyle = bg
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `800 84px ${FONT_UI}`
    g.fillText(text, 64, 70)
    return toTexture(c)
  })
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Wait for the web fonts that canvas textures depend on. */
export async function loadFonts(guest: string) {
  const jobs = [
    document.fonts.load(`700 80px "Fraunces Variable"`, guest || 'Welcome'),
    document.fonts.load(`italic 400 80px "Fraunces Variable"`, 'Welcome'),
    document.fonts.load(`800 40px "Nunito"`, '10'),
    document.fonts.load(`80px "Yuji Boku"`, Object.values(PLAQUES).join('') + '招邀榜文憑畢業印'),
  ]
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 3500))])
}

/** Red lacquer with gilded dragon-and-cloud scrolls — Huế palace columns. */
export const lacquerTex = () =>
  once('lacquer', () => {
    const [c, g] = canvas(256, 512)
    const grd = g.createLinearGradient(0, 0, 256, 0)
    grd.addColorStop(0, '#8e2420')
    grd.addColorStop(0.5, '#b3322b')
    grd.addColorStop(1, '#8e2420')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 512)
    g.strokeStyle = 'rgba(236,190,90,0.9)'
    g.lineWidth = 5
    g.lineCap = 'round'
    // a dragon body spiralling up the column
    g.beginPath()
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      const x = ((t * 2.3 * 256) % 256) + Math.sin(t * 40) * 6
      const y = 500 - t * 480
      if (i === 0 || x < 8) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
    // scale dots along it and cloud curls around
    g.fillStyle = 'rgba(236,190,90,0.85)'
    for (let i = 0; i < 60; i++) {
      const t = i / 60
      g.beginPath()
      g.arc(((t * 2.3 * 256) % 256) + 8, 500 - t * 480 - 8, 3, 0, Math.PI * 2)
      g.fill()
    }
    g.lineWidth = 3
    for (let k = 0; k < 14; k++) {
      const x = (k * 97) % 256
      const y = (k * 61) % 512
      g.beginPath()
      g.arc(x, y, 12, Math.PI * 0.2, Math.PI * 1.8)
      g.stroke()
      g.beginPath()
      g.arc(x + 14, y - 4, 7, Math.PI, Math.PI * 2.2)
      g.stroke()
    }
    // gilded bands top and bottom
    g.fillStyle = '#e1b04a'
    g.fillRect(0, 0, 256, 16)
    g.fillRect(0, 496, 256, 16)
    const t = toTexture(c)
    t.wrapS = THREE.RepeatWrapping
    return t
  })

/**
 * "Nhất thi nhất họa" — the Huế frieze of alternating poem panels (gold
 * characters on lacquer) and little painted landscapes.
 */
export const friezeTex = () =>
  once('frieze', () => {
    const [c, g] = canvas(1024, 96)
    g.fillStyle = '#e1b04a'
    g.fillRect(0, 0, 1024, 96)
    const n = 12
    const w = 1024 / n
    const poems = '春花秋月夏雨冬雪山高水長福壽康寧吉祥如意'
    for (let i = 0; i < n; i++) {
      const x = i * w + 5
      const pw = w - 10
      if (i % 2) {
        g.fillStyle = '#6e1e1a'
        g.fillRect(x, 8, pw, 80)
        g.fillStyle = '#f3cf6a'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.font = `26px ${FONT_CJK}`
        g.fillText(poems[(i * 2) % poems.length], x + pw / 2, 30)
        g.fillText(poems[(i * 2 + 1) % poems.length], x + pw / 2, 64)
      } else {
        g.fillStyle = '#f4ead2'
        g.fillRect(x, 8, pw, 80)
        // tiny landscape: blue hills, a lotus, a bird
        g.fillStyle = '#6f93b8'
        g.beginPath()
        g.moveTo(x, 80)
        g.lineTo(x + pw * 0.3, 40)
        g.lineTo(x + pw * 0.55, 70)
        g.lineTo(x + pw * 0.8, 34)
        g.lineTo(x + pw, 80)
        g.fill()
        g.fillStyle = '#3f8f6f'
        g.fillRect(x, 78, pw, 10)
        g.fillStyle = '#e98aa0'
        g.beginPath()
        g.arc(x + pw * 0.3, 74, 6, Math.PI, 0)
        g.fill()
        g.strokeStyle = '#2a2320'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(x + pw * 0.62, 26)
        g.quadraticCurveTo(x + pw * 0.68, 20, x + pw * 0.74, 26)
        g.quadraticCurveTo(x + pw * 0.8, 20, x + pw * 0.86, 26)
        g.stroke()
      }
      g.strokeStyle = '#8a5a1a'
      g.lineWidth = 2
      g.strokeRect(x, 8, pw, 80)
    }
    return toTexture(c)
  })

/** Five-colour festival flag (cờ ngũ sắc). */
export function flagTex(i: number) {
  return once(`flag${i}`, () => {
    const [c, g] = canvas(256, 128)
    const cols = ['#d8433e', '#e6b53a', '#2f6fae', '#3f9a6b', '#f4efe6']
    const main = cols[i % cols.length]
    g.fillStyle = main
    g.fillRect(0, 0, 256, 128)
    // bordered centre panel with a sun disc
    g.fillStyle = cols[(i + 1) % cols.length]
    g.fillRect(0, 0, 256, 14)
    g.fillRect(0, 114, 256, 14)
    g.fillStyle = cols[(i + 2) % cols.length]
    for (let x = 0; x < 256; x += 32) {
      g.beginPath()
      g.moveTo(x, 114)
      g.lineTo(x + 16, 128)
      g.lineTo(x + 32, 114)
      g.fill()
    }
    g.fillStyle = '#f7d46a'
    g.beginPath()
    g.arc(90, 64, 22, 0, Math.PI * 2)
    g.fill()
    return toTexture(c)
  })
}

/**
 * Weathering atlas for the 'aged' material. R: grime (dark blotches and
 * rain streaks, 1 = clean), G: moss mask. Tileable in both directions.
 */
export const agedTex = () =>
  once('aged', () => {
    const S = 256
    const [c, g] = canvas(S, S)
    g.fillStyle = 'rgb(222,0,0)'
    g.fillRect(0, 0, S, S)
    const r = mulberry(5)
    const wrap = (draw: (dx: number, dy: number) => void) => {
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(dx, dy)
    }
    g.globalCompositeOperation = 'source-over'
    // grime blotches — large, soft, overlapping
    for (let i = 0; i < 55; i++) {
      const x = r() * S
      const y = r() * S
      const rad = 14 + r() * 46
      const v = 60 + r() * 100
      wrap((dx, dy) => {
        const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad)
        grd.addColorStop(0, `rgba(${v},0,0,0.65)`)
        grd.addColorStop(0.6, `rgba(${v},0,0,0.25)`)
        grd.addColorStop(1, `rgba(${v},0,0,0)`)
        g.fillStyle = grd
        g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2)
      })
    }
    // a few rain streaks, each hanging from a blotch
    for (let i = 0; i < 26; i++) {
      const x = r() * S
      const y = r() * S
      const len = 40 + r() * 110
      const w = 3 + r() * 9
      wrap((dx, dy) => {
        const grd = g.createLinearGradient(0, y + dy, 0, y + dy + len)
        grd.addColorStop(0, `rgba(${50 + r() * 60},0,0,0.6)`)
        grd.addColorStop(1, 'rgba(160,0,0,0)')
        g.fillStyle = grd
        g.beginPath()
        g.moveTo(x + dx - w / 2, y + dy)
        g.lineTo(x + dx + w / 2, y + dy)
        g.lineTo(x + dx + w * 0.2, y + dy + len)
        g.lineTo(x + dx - w * 0.2, y + dy + len)
        g.closePath()
        g.fill()
      })
    }
    // speckle
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,0,0,0.25)' : 'rgba(100,0,0,0.25)'
      g.fillRect(r() * S, r() * S, 1.5, 1.5)
    }
    // green = where moss takes hold, blue = fine breakup for its edges: tileable fractal noise,
    // so patches come out ragged and organic rather than as round blots
    const img = g.getImageData(0, 0, S, S)
    const lattice = (cells: number, seed: number) => {
      const rr = mulberry(seed)
      const v = Float32Array.from({ length: cells * cells }, () => rr())
      return (x: number, y: number) => {
        const fx = (x / S) * cells
        const fy = (y / S) * cells
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const tx = fx - x0
        const ty = fy - y0
        const sx = tx * tx * (3 - 2 * tx)
        const sy = ty * ty * (3 - 2 * ty)
        const at = (i: number, j: number) => v[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)]
        const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx
        const bot = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx
        return top * (1 - sy) + bot * sy
      }
    }
    const coarse = [lattice(4, 11), lattice(8, 12), lattice(16, 13), lattice(32, 14)]
    const fine = [lattice(16, 21), lattice(32, 22), lattice(64, 23)]
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const m = coarse[0](x, y) * 0.5 + coarse[1](x, y) * 0.27 + coarse[2](x, y) * 0.15 + coarse[3](x, y) * 0.08
        const f = fine[0](x, y) * 0.5 + fine[1](x, y) * 0.3 + fine[2](x, y) * 0.2
        const i = (y * S + x) * 4
        img.data[i + 1] = Math.round(m * 255)
        img.data[i + 2] = Math.round(f * 255)
      }
    }
    g.putImageData(img, 0, 0)
    const t = toTexture(c, false, true)
    return t
  })

function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Plain text on a transparent (or tinted) board — shop signs, building names. */
export function signTex(text: string, o: { w?: number; h?: number; color?: string; bg?: string; font?: string; weight?: number; spacing?: number } = {}) {
  const w = o.w ?? 1024
  const h = o.h ?? 96
  return once(`sign:${text}:${w}:${h}:${o.color}:${o.bg}:${o.font}`, () => {
    const [c, g] = canvas(w, h)
    if (o.bg) {
      g.fillStyle = o.bg
      g.fillRect(0, 0, w, h)
    }
    g.fillStyle = o.color ?? '#1f8a4c'
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    let size = h * 0.78
    const font = (sz: number) => `${o.weight ?? 800} ${sz}px ${o.font ?? FONT_UI}`
    g.font = font(size)
    const sp = o.spacing ?? 0
    const measure = () => [...text].reduce((a, ch) => a + g.measureText(ch).width + sp, -sp)
    while (measure() > w * 0.96 && size > 8) {
      size -= 2
      g.font = font(size)
    }
    let x = (w - measure()) / 2
    for (const ch of text) {
      g.fillText(ch, x, h / 2 + size * 0.04)
      x += g.measureText(ch).width + sp
    }
    return toTexture(c)
  })
}

/** Cờ đỏ sao vàng. */
export const vnFlagTex = () =>
  once('vnflag', () => {
    const [c, g] = canvas(192, 128)
    g.fillStyle = '#da251d'
    g.fillRect(0, 0, 192, 128)
    g.fillStyle = '#ffdf00'
    g.beginPath()
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2
      const rr = k % 2 ? 16 : 40
      g.lineTo(96 + Math.cos(a) * rr, 66 + Math.sin(a) * rr)
    }
    g.closePath()
    g.fill()
    return toTexture(c)
  })

/** Straw thatch: dense strands running down the slope, bundles and shadows. */
export const thatchTex = () =>
  once('thatch', () => {
    const S = 256
    const [c, g] = canvas(S, S)
    g.fillStyle = '#c9a45e'
    g.fillRect(0, 0, S, S)
    const r = mulberry(12)
    // bundle bands (courses) across the slope
    for (let y = 0; y < S; y += 32) {
      const grd = g.createLinearGradient(0, y, 0, y + 32)
      grd.addColorStop(0, 'rgba(255,240,190,0.25)')
      grd.addColorStop(0.8, 'rgba(90,60,20,0.1)')
      grd.addColorStop(1, 'rgba(60,40,15,0.45)')
      g.fillStyle = grd
      g.fillRect(0, y, S, 32)
    }
    // strands
    for (let i = 0; i < 1400; i++) {
      const x = r() * S
      const y = r() * S
      const len = 10 + r() * 30
      g.strokeStyle = r() < 0.5 ? `rgba(110,75,30,${0.2 + r() * 0.3})` : `rgba(255,236,170,${0.2 + r() * 0.35})`
      g.lineWidth = 1 + r() * 1.5
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (r() - 0.5) * 4, y + len)
      g.stroke()
    }
    return toTexture(c, true, true)
  })
