import * as THREE from 'three'
import { HEAD_S, R } from './Chibi'

/**
 * Painted anime faces.
 *
 * The single biggest thing that keeps a 3D anime figure reading as "2D" is the
 * face: eyes, brows and mouth are *drawn*, not modelled. Each character owns a
 * small canvas in the head's front orthographic space; it is repainted only
 * when the expression changes (blink, smile, surprise…), exactly like
 * swapping cels.
 */

export type EyeState = 'open' | 'blink' | 'happy' | 'surprised' | 'wink'
export type MouthState = 'smile' | 'open' | 'o' | 'grin' | 'cat' | 'flat'

export interface FaceStyle {
  /** iris gradient: top (dark) → bottom (light) */
  iris: [string, string]
  lash?: string
  brow: string
  /** eye size in head units */
  eyeW?: number
  eyeH?: number
  eyeX?: number
  eyeY?: number
  /** outer-corner slope: + droopy/gentle, − sharp/upturned */
  tilt?: number
  sparkle?: boolean
  whiskers?: boolean
  /** beauty mark under the character's right eye */
  mole?: boolean
  browThick?: number
  /** big toothy grin when happy (instead of an open mouth) */
  grin?: boolean
  /** a sly ":3" cat mouth at rest (fox / cat characters) */
  catMouth?: boolean
  /** coloured eyeliner flick at the outer corner */
  liner?: string
  /** 0‥1 size of the lash wing at the outer corner (boys ≈ 0.3) */
  lashWing?: number
  /** lash line thickness multiplier */
  lashWeight?: number
  /** little freckle dots across the cheeks */
  freckles?: boolean
}

// canvas covers head-local x ∈ [−0.4, 0.4], y ∈ [−0.3, 0.15]
const X0 = -0.4
const X1 = 0.4
const Y0 = -0.3
const Y1 = 0.15
const CW = 512
const CH = Math.round((CW * (Y1 - Y0)) / (X1 - X0))
const PX = CW / (X1 - X0)
const cx = (x: number) => (x - X0) * PX
const cy = (y: number) => (Y1 - y) * PX

/** Front patch of the head ellipsoid, UV-mapped by orthographic projection. */
export function facePatchGeometry(off = 0.0045) {
  const a = R * HEAD_S[0]
  const b = R * HEAD_S[1]
  const c = R * HEAD_S[2]
  const NX = 36
  const NY = 22
  const pos: number[] = []
  const uv: number[] = []
  const nrm: number[] = []
  const valid: boolean[] = []
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = X0 + ((X1 - X0) * i) / NX
      const y = Y0 + ((Y1 - Y0) * j) / NY
      const k = 1 - (x / a) ** 2 - (y / b) ** 2
      const ok = k > 0.06
      const z = c * Math.sqrt(Math.max(k, 0.0001))
      const n = new THREE.Vector3(x / (a * a), y / (b * b), z / (c * c)).normalize()
      pos.push(x + n.x * off, y + n.y * off, z + n.z * off)
      nrm.push(n.x, n.y, n.z)
      uv.push(i / NX, j / NY)
      valid.push(ok)
    }
  }
  const idx: number[] = []
  const row = NX + 1
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const q = [j * row + i, j * row + i + 1, (j + 1) * row + i, (j + 1) * row + i + 1]
      if (q.every((v) => valid[v])) idx.push(q[0], q[1], q[2], q[1], q[3], q[2])
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export class FacePainter {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  tex: THREE.CanvasTexture
  key = ''
  private gaze = 0
  constructor(public s: FaceStyle) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = CW
    this.canvas.height = CH
    this.ctx = this.canvas.getContext('2d')!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.tex.anisotropy = 4
    this.draw('open', 'smile')
  }

  /** gaze: −1 (glance to the character's right) · 0 · 1 (their left) */
  draw(eyes: EyeState, mouth: MouthState, gaze = 0) {
    const key = `${eyes}|${mouth}|${gaze}`
    if (key === this.key) return
    this.key = key
    this.gaze = gaze
    const g = this.ctx
    const s = this.s
    g.clearRect(0, 0, CW, CH)
    const ew = (s.eyeW ?? 0.136) * PX
    const eh = (s.eyeH ?? 0.178) * PX
    const ex = s.eyeX ?? 0.152
    const ey = s.eyeY ?? -0.048

    // cheeks: soft blush with a few hatch strokes
    for (const side of [-1, 1]) {
      const bx = cx(side * 0.225)
      const by = cy(-0.118)
      const grd = g.createRadialGradient(bx, by, 0, bx, by, 0.07 * PX)
      grd.addColorStop(0, 'rgba(255,120,135,0.55)')
      grd.addColorStop(1, 'rgba(255,140,150,0)')
      g.fillStyle = grd
      g.beginPath()
      g.ellipse(bx, by, 0.08 * PX, 0.05 * PX, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(232,96,110,0.55)'
      g.lineWidth = 2.2
      g.lineCap = 'round'
      for (let k = -1; k <= 1; k++) {
        g.beginPath()
        g.moveTo(bx + k * 9 - 3, by + 6)
        g.lineTo(bx + k * 9 + 3, by - 6)
        g.stroke()
      }
    }
    if (s.freckles) {
      g.fillStyle = 'rgba(190,110,80,0.55)'
      for (const side of [-1, 1])
        for (const [dx, dy] of [
          [-0.03, 0.01],
          [0, -0.012],
          [0.03, 0.006],
        ]) {
          g.beginPath()
          g.arc(cx(side * 0.2 + dx), cy(-0.1 + dy), 2.4, 0, Math.PI * 2)
          g.fill()
        }
    }
    if (s.whiskers) {
      g.strokeStyle = 'rgba(90,50,40,0.85)'
      g.lineWidth = 3
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const y = -0.092 - k * 0.028
          g.beginPath()
          g.moveTo(cx(side * 0.2), cy(y + 0.004 * k))
          g.lineTo(cx(side * 0.3), cy(y - 0.006 + 0.01 * k))
          g.stroke()
        }
      }
    }

    for (const side of [-1, 1]) {
      // a wink closes the character's left eye (canvas right)
      const st: EyeState = eyes === 'wink' ? (side > 0 ? 'happy' : 'open') : eyes
      this.eye(cx(side * ex), cy(ey), ew, eh, side, st)
    }

    if (s.mole) {
      g.fillStyle = '#3a2430'
      g.beginPath()
      g.arc(cx(-ex - 0.035), cy(ey - 0.1), 3.2, 0, Math.PI * 2)
      g.fill()
    }
    this.mouth(mouth)
    this.tex.needsUpdate = true
  }

  private eye(x: number, y: number, w: number, h: number, side: number, state: EyeState) {
    const g = this.ctx
    const s = this.s
    const lash = s.lash ?? '#241826'
    const out = side // outer corner direction on the canvas
    const tilt = (s.tilt ?? 0) * h
    g.lineCap = 'round'
    g.lineJoin = 'round'

    // brows
    const lift = state === 'surprised' ? -0.2 * h : state === 'happy' ? -0.06 * h : 0
    g.strokeStyle = s.brow
    g.lineWidth = (s.browThick ?? 1) * h * 0.075
    g.beginPath()
    g.moveTo(x - out * w * 0.42, y - h * 0.8 + lift)
    g.quadraticCurveTo(x, y - h * 0.98 + lift, x + out * w * 0.5, y - h * 0.8 + lift + tilt * 0.4)
    g.stroke()

    if (state === 'blink') {
      g.strokeStyle = lash
      g.lineWidth = h * 0.1
      g.beginPath()
      g.moveTo(x - out * w * 0.5, y + h * 0.02)
      g.quadraticCurveTo(x, y + h * 0.26, x + out * w * 0.52, y + tilt * 0.3)
      g.stroke()
      g.lineWidth = h * 0.07
      g.beginPath()
      g.moveTo(x + out * w * 0.48, y + tilt * 0.3)
      g.lineTo(x + out * w * 0.68, y - h * 0.08 + tilt * 0.3)
      g.stroke()
      return
    }
    if (state === 'happy') {
      g.strokeStyle = lash
      g.lineWidth = h * 0.11
      g.beginPath()
      g.moveTo(x - w * 0.5, y + h * 0.16)
      g.quadraticCurveTo(x, y - h * 0.42, x + w * 0.5, y + h * 0.16)
      g.stroke()
      return
    }

    const wide = state === 'surprised'
    // sclera
    g.save()
    g.beginPath()
    g.ellipse(x, y, w * 0.5, h * 0.52, 0, 0, Math.PI * 2)
    g.fillStyle = '#ffffff'
    g.fill()
    g.clip()
    // iris
    const ir = wide ? 0.33 : 0.43
    const ih = wide ? 0.36 : 0.5
    const iy = y + h * (wide ? 0.02 : 0.06)
    // eyes follow the head a little further when glancing sideways (+1 = toward her left)
    x += this.gaze * w * 0.13
    const grd = g.createLinearGradient(0, iy - h * ih, 0, iy + h * ih)
    grd.addColorStop(0, s.iris[0])
    grd.addColorStop(0.55, s.iris[0])
    grd.addColorStop(1, s.iris[1])
    g.fillStyle = grd
    g.beginPath()
    g.ellipse(x, iy, w * ir, h * ih, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(20,10,30,0.55)'
    g.lineWidth = 2.5
    g.stroke()
    // pupil
    g.fillStyle = 'rgba(18,10,26,0.9)'
    g.beginPath()
    g.ellipse(x, iy - h * 0.04, w * ir * 0.42, h * ih * 0.5, 0, 0, Math.PI * 2)
    g.fill()
    // lower glow band
    g.fillStyle = 'rgba(255,255,255,0.28)'
    g.beginPath()
    g.ellipse(x, iy + h * ih * 0.55, w * ir * 0.7, h * ih * 0.25, 0, 0, Math.PI * 2)
    g.fill()
    // lid shadow
    g.fillStyle = 'rgba(40,20,50,0.28)'
    g.fillRect(x - w, y - h * 0.6, w * 2, h * 0.24)
    g.restore()
    x -= this.gaze * w * 0.13
    // highlights (light from upper-left for both eyes)
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.ellipse(x - w * 0.14, y - h * 0.16, w * 0.15, h * 0.13, -0.5, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.arc(x + w * 0.15, y + h * 0.24, w * 0.065, 0, Math.PI * 2)
    g.fill()
    if (s.sparkle) {
      g.save()
      g.translate(x + w * 0.12, y - h * 0.02)
      g.beginPath()
      for (let k = 0; k < 8; k++) {
        const r = k % 2 ? w * 0.03 : w * 0.1
        const a = (k / 8) * Math.PI * 2
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      g.closePath()
      g.fill()
      g.restore()
    }
    // upper lash line with a little wing at the outer corner
    const wing = s.lashWing ?? 1
    g.strokeStyle = lash
    g.lineWidth = h * 0.13 * (s.lashWeight ?? 1)
    g.beginPath()
    g.moveTo(x - out * w * 0.5, y - h * 0.18)
    g.quadraticCurveTo(x - out * w * 0.05, y - h * 0.66, x + out * w * 0.52, y - h * 0.34 + tilt)
    g.stroke()
    if (wing > 0) {
      g.lineWidth = h * 0.08 * Math.max(0.6, wing)
      g.beginPath()
      g.moveTo(x + out * w * 0.46, y - h * 0.36 + tilt)
      g.lineTo(x + out * w * (0.46 + 0.24 * wing), y - h * (0.36 + 0.1 * wing) + tilt * 1.3)
      g.stroke()
    }
    if (s.liner) {
      g.strokeStyle = s.liner
      g.lineWidth = h * 0.06
      g.beginPath()
      g.moveTo(x + out * w * 0.42, y - h * 0.24 + tilt)
      g.quadraticCurveTo(x + out * w * 0.72, y - h * 0.2 + tilt, x + out * w * 0.86, y - h * 0.4 + tilt)
      g.stroke()
    }
    // second, tiny catch-light for extra sparkle
    g.fillStyle = 'rgba(255,255,255,0.9)'
    g.beginPath()
    g.arc(x - w * 0.02, y + h * 0.05, w * 0.035, 0, Math.PI * 2)
    g.fill()
    // lower lash hint
    g.lineWidth = h * 0.035
    g.beginPath()
    g.moveTo(x + out * w * 0.12, y + h * 0.5)
    g.quadraticCurveTo(x + out * w * 0.38, y + h * 0.44, x + out * w * 0.47, y + h * 0.28)
    g.stroke()
  }

  private mouth(m: MouthState) {
    const g = this.ctx
    const x = cx(0)
    const y = cy(-0.158)
    const u = PX
    g.lineCap = 'round'
    g.strokeStyle = '#5a2430'
    g.lineWidth = 3.2
    if (m === 'smile') {
      g.beginPath()
      g.moveTo(x - 0.028 * u, y - 0.004 * u)
      g.quadraticCurveTo(x, y + 0.02 * u, x + 0.028 * u, y - 0.004 * u)
      g.stroke()
      return
    }
    if (m === 'flat') {
      g.beginPath()
      g.moveTo(x - 0.018 * u, y + 0.002 * u)
      g.lineTo(x + 0.018 * u, y + 0.002 * u)
      g.stroke()
      return
    }
    if (m === 'cat') {
      g.beginPath()
      g.moveTo(x - 0.03 * u, y - 0.006 * u)
      g.quadraticCurveTo(x - 0.015 * u, y + 0.016 * u, x, y - 0.002 * u)
      g.quadraticCurveTo(x + 0.015 * u, y + 0.016 * u, x + 0.03 * u, y - 0.006 * u)
      g.stroke()
      return
    }
    if (m === 'o') {
      g.fillStyle = '#6e2632'
      g.beginPath()
      g.ellipse(x, y + 0.004 * u, 0.017 * u, 0.022 * u, 0, 0, Math.PI * 2)
      g.fill()
      return
    }
    const wide = m === 'grin' ? 0.05 : 0.036
    const deep = m === 'grin' ? 0.036 : 0.042
    g.beginPath()
    g.moveTo(x - wide * u, y - 0.006 * u)
    g.quadraticCurveTo(x, y + 0.004 * u, x + wide * u, y - 0.006 * u)
    g.quadraticCurveTo(x + wide * 0.6 * u, y + deep * u, x, y + deep * u)
    g.quadraticCurveTo(x - wide * 0.6 * u, y + deep * u, x - wide * u, y - 0.006 * u)
    g.closePath()
    g.fillStyle = '#8a2f3c'
    g.fill()
    g.save()
    g.clip()
    if (m === 'grin') {
      g.fillStyle = '#ffffff'
      g.fillRect(x - wide * u, y - 0.01 * u, wide * 2 * u, 0.016 * u)
    } else {
      g.fillStyle = '#ff8b95'
      g.beginPath()
      g.ellipse(x, y + deep * u, 0.024 * u, 0.018 * u, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
    g.stroke()
  }
}
