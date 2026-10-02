import { CAST, PROCLAMATION } from '../config'
import { rng } from '../three/lib/kit'
import { FONT_UI } from '../three/lib/textures'
import { inkWish, signature, wishFont, wishFontReady } from '../three/fx/lanternPaper'

/*
 * The picture the guest keeps of the lantern they let go: the wish on a lit
 * lantern over the roofs of Điện Thái Hòa, among the others. It is painted on
 * a plain 2D canvas (not grabbed from the scene), so it comes out the same on
 * every device — and it is how the wish actually reaches Lực: nothing is sent
 * anywhere, the guest passes the picture on.
 */

type G2 = CanvasRenderingContext2D
const W = 1080
const H = 1350

/** the outline of a sky lantern: narrow at the mouth, widest at the shoulder, a domed top */
function lanternPath(g: G2, cx: number, top: number, w: number, h: number) {
  const bot = top + h
  const sh = top + h * 0.3
  g.beginPath()
  g.moveTo(cx - w * 0.3, bot)
  g.bezierCurveTo(cx - w * 0.34, bot - h * 0.3, cx - w * 0.5, sh + h * 0.22, cx - w * 0.5, sh)
  g.bezierCurveTo(cx - w * 0.5, top + h * 0.08, cx - w * 0.3, top, cx, top)
  g.bezierCurveTo(cx + w * 0.3, top, cx + w * 0.5, top + h * 0.08, cx + w * 0.5, sh)
  g.bezierCurveTo(cx + w * 0.5, sh + h * 0.22, cx + w * 0.34, bot - h * 0.3, cx + w * 0.3, bot)
  g.closePath()
}

function glow(g: G2, x: number, y: number, r: number, color: string, a: number) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r)
  grd.addColorStop(0, color)
  grd.addColorStop(1, 'rgba(255,170,80,0)')
  g.globalAlpha = a
  g.fillStyle = grd
  g.fillRect(x - r, y - r, r * 2, r * 2)
  g.globalAlpha = 1
}

function lantern(g: G2, cx: number, top: number, w: number, h: number, bright: number) {
  glow(g, cx, top + h * 0.6, w * 1.5, 'rgba(255,190,110,0.9)', 0.5 * bright)
  lanternPath(g, cx, top, w, h)
  const grd = g.createLinearGradient(0, top, 0, top + h)
  grd.addColorStop(0, '#ee8a3e')
  grd.addColorStop(0.5, '#ffc56c')
  grd.addColorStop(1, '#fff0b8')
  g.fillStyle = grd
  g.globalAlpha = bright
  g.fill()
  g.globalAlpha = 1
}

/** the two-tiered roof of Điện Thái Hòa against the sky, its lit front below */
function hall(g: G2) {
  const base = H - 150
  g.fillStyle = '#0d102a'
  const roof = (y: number, half: number, rise: number, tip: number) => {
    g.beginPath()
    g.moveTo(W / 2 - half - 60, y + tip)
    g.quadraticCurveTo(W / 2 - half + 30, y - 4, W / 2 - half * 0.62, y - rise)
    g.lineTo(W / 2 + half * 0.62, y - rise)
    g.quadraticCurveTo(W / 2 + half - 30, y - 4, W / 2 + half + 60, y + tip)
    g.quadraticCurveTo(W / 2 + half - 20, y + 26, W / 2 + half - 90, y + 30)
    g.lineTo(W / 2 - half + 90, y + 30)
    g.quadraticCurveTo(W / 2 - half + 20, y + 26, W / 2 - half - 60, y + tip)
    g.closePath()
    g.fill()
  }
  roof(base - 96, 330, 92, -22)
  g.fillRect(W / 2 - 300, base - 70, 600, 60)
  roof(base, 450, 46, -26)
  g.fillRect(W / 2 - 400, base + 24, 800, H - base)
  // the gourd on the ridge
  g.beginPath()
  g.arc(W / 2, base - 198, 11, 0, Math.PI * 2)
  g.arc(W / 2, base - 214, 7, 0, Math.PI * 2)
  g.fill()
  // lamplight through the lattice doors
  const win = g.createLinearGradient(0, base + 40, 0, H)
  win.addColorStop(0, 'rgba(255,214,140,0.95)')
  win.addColorStop(1, 'rgba(255,170,90,0.55)')
  g.fillStyle = win
  for (let k = -3; k <= 3; k++) g.fillRect(W / 2 + k * 104 - 40, base + 44, 80, H - base)
  // … their lattice, and the terrace in front
  g.fillStyle = 'rgba(13,16,42,0.55)'
  for (let k = -3; k <= 3; k++) {
    for (let i = 1; i < 4; i++) g.fillRect(W / 2 + k * 104 - 40 + i * 20 - 1, base + 44, 2, H - base)
    for (let y = base + 62; y < H; y += 18) g.fillRect(W / 2 + k * 104 - 40, y, 80, 2)
  }
  g.fillStyle = '#0d102a'
  g.fillRect(0, H - 34, W, 34)
}

export async function drawLanternCard(wish: string, guest: string): Promise<HTMLCanvasElement> {
  const sign = signature(guest)
  await wishFontReady(wish + sign + CAST.luc)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  // the night over Huế
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#090c26')
  sky.addColorStop(0.55, '#1c2356')
  sky.addColorStop(0.86, '#40305f')
  sky.addColorStop(1, '#7a4658')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  const r = rng(909)
  for (let i = 0; i < 150; i++) {
    g.globalAlpha = 0.25 + r() * 0.6
    g.fillStyle = '#fff6e0'
    const s = 1 + r() * 2.2
    g.fillRect(r() * W, r() * H * 0.8, s, s)
  }
  g.globalAlpha = 1
  // the other lanterns, far off
  for (let i = 0; i < 26; i++) {
    const x = r() * W
    const y = 40 + r() * (H - 420)
    const w = 16 + r() * 34
    // (keep the middle of the picture for the guest's own)
    if (Math.abs(x - W / 2) < 330 && y > 150 && y < 900) continue
    lantern(g, x, y, w, w * 1.25, 0.55 + r() * 0.4)
  }
  hall(g)
  // the guest's lantern, and the wish on it
  const lw = 520
  const lh = 640
  const top = 210
  lantern(g, W / 2, top, lw, lh, 1)
  g.save()
  lanternPath(g, W / 2, top, lw, lh)
  g.clip()
  g.fillStyle = 'rgba(200,60,40,0.7)'
  for (const [y, h] of [
    [top + 96, 6],
    [top + 108, 2],
    [top + lh - 62, 2],
    [top + lh - 56, 6],
  ])
    g.fillRect(0, y, W, h)
  g.restore()
  inkWish(g, wish, sign, W / 2, top + lh * 0.5, 350, 380, '#4a2416', [66, 58, 50, 44, 38, 32])
  // the flame at its mouth
  glow(g, W / 2, top + lh + 6, 150, 'rgba(255,236,170,1)', 0.95)
  g.fillStyle = '#fff6d8'
  g.beginPath()
  g.ellipse(W / 2, top + lh + 4, 34, 14, 0, 0, Math.PI * 2)
  g.fill()
  // whose it is for
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#fff3da'
  g.shadowColor = 'rgba(10,8,30,0.9)'
  g.shadowBlur = 18
  g.font = wishFont(50)
  g.fillText(`Một ngọn đèn gửi ${CAST.luc}`, W / 2, H - 258)
  g.font = `800 20px ${FONT_UI}`
  g.fillStyle = 'rgba(255,243,218,0.85)'
  const sub = `TÂN ${PROCLAMATION.title} · ${PROCLAMATION.lines[PROCLAMATION.lines.length - 1]}`.toLocaleUpperCase('vi')
  g.fillText(sub.split('').join(' '), W / 2, H - 212)
  g.shadowBlur = 0
  return c
}

/**
 * Hand the picture to the guest: the share sheet on a phone (so it can go
 * straight to a chat), a download elsewhere.
 */
export async function saveLanternCard(wish: string, guest: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const c = await drawLanternCard(wish, guest)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error('could not draw the lantern')
  const file = new File([blob], 'den-troi.png', { type: 'image/png' })
  const phone = window.matchMedia?.('(pointer: coarse)').matches
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Một ngọn đèn gửi ${CAST.luc}` })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
      // sharing refused for another reason: fall through to a plain download
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'saved'
}
