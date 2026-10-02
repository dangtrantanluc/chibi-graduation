import { FONT_DISPLAY } from '../lib/textures'
import { CAST, INVITE } from '../../config'

/*
 * What is written on a sky lantern: the guest's wish in brush-like italics and
 * their name under it. Shared by the lantern in the scene (its paper texture)
 * and by the picture the guest can keep (ui/lanternCard.ts).
 */

type G2 = CanvasRenderingContext2D

/** what goes up if the guest writes nothing */
export const DEFAULT_WISH = `Chúc mừng tân kỹ sư ${CAST.luc}!`
export const wishOr = (w: string) => w.trim() || DEFAULT_WISH
/** the signature under the wish (nothing for a guest who gave no name) */
export const signature = (guest: string) => (guest && guest !== INVITE.defaultGuest ? `— ${guest}` : '')
export const wishFont = (px: number) => `italic 600 ${px}px ${FONT_DISPLAY}`

/** break a line of text so that no line is wider than `maxW` (a word too long for a line is split) */
export function wrapWish(g: G2, text: string, maxW: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width <= maxW) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = word
    while (g.measureText(line).width > maxW && line.length > 1) {
      let n = line.length - 1
      while (n > 1 && g.measureText(line.slice(0, n)).width > maxW) n--
      lines.push(line.slice(0, n))
      line = line.slice(n)
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Write the wish and the signature centred on (cx, cy), inside a box w × h, in
 * the largest of `sizes` that fits.
 */
export function inkWish(g: G2, wish: string, sign: string, cx: number, cy: number, w: number, h: number, ink: string, sizes: number[]) {
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = sizes[sizes.length - 1]
  let lines: string[] = []
  for (const s of sizes) {
    g.font = wishFont(s)
    lines = wrapWish(g, wish, w)
    size = s
    if (lines.length * s * 1.2 + (sign ? s * 0.95 : 0) <= h) break
  }
  const lh = size * 1.2
  const signH = sign ? size * 0.95 : 0
  let y = cy - (lines.length * lh + signH) / 2 + lh / 2
  g.fillStyle = ink
  g.font = wishFont(size)
  for (const l of lines) {
    g.fillText(l, cx, y)
    y += lh
  }
  if (sign) {
    g.font = wishFont(Math.round(size * 0.62))
    g.globalAlpha = 0.8
    g.fillText(sign, cx, y - lh / 2 + signH / 2 + size * 0.08)
    g.globalAlpha = 1
  }
}

/** make sure the display face has the glyphs of this text before it is drawn on a canvas */
export function wishFontReady(text: string) {
  return document.fonts?.load ? document.fonts.load(wishFont(48), text).catch(() => undefined) : Promise.resolve(undefined)
}
