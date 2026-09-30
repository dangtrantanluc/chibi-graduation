import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { useUI } from '../../state/store'
import { world } from '../../state/world'
import { SCROLL } from '../layout'
import { canvas, FONT_CJK, FONT_DISPLAY, roundRect, toTexture } from '../lib/textures'
import { uGlow } from '../lib/materials'

const W = 1.8
const L = 2.85
const SEG_Y = 24
const SEG_X = 6

/**
 * The golden list (bảng vàng): in imperial times the names of the laureates
 * were carried out through Ngọ Môn on a yellow scroll. Tonight it carries the
 * guest's name — yellow dragon-and-cloud brocade around cream paper.
 */
function scrollTexture(guest: string) {
  const CW = 1024
  const CH = Math.round((CW * L) / W)
  const [c, g] = canvas(CW, CH)
  // imperial-yellow brocade mounting with woven cloud rounds
  g.fillStyle = '#e8b53a'
  g.fillRect(0, 0, CW, CH)
  g.globalAlpha = 0.35
  g.strokeStyle = '#b8862a'
  g.lineWidth = 3
  for (let y = 20; y < CH; y += 52) {
    for (let x = 20; x < CW; x += 52) {
      const cx0 = x + ((y / 52) % 2) * 26
      g.beginPath()
      g.arc(cx0, y, 12, Math.PI * 0.2, Math.PI * 1.9)
      g.stroke()
      g.beginPath()
      g.arc(cx0 + 8, y - 4, 6, Math.PI, Math.PI * 2.2)
      g.stroke()
    }
  }
  g.globalAlpha = 1
  // red silk borders top and bottom
  g.fillStyle = '#b3262e'
  g.fillRect(0, 96, CW, 40)
  g.fillRect(0, CH - 136, CW, 40)
  // gold pinstripes
  g.fillStyle = '#d9a441'
  g.fillRect(58, 150, CW - 116, 6)
  g.fillRect(58, CH - 156, CW - 116, 6)
  // paper
  const px = 70
  const py = 170
  const pw = CW - 140
  const ph = CH - 340
  const paper = g.createLinearGradient(0, py, 0, py + ph)
  paper.addColorStop(0, '#fbf1da')
  paper.addColorStop(1, '#f1e0bd')
  g.fillStyle = paper
  g.fillRect(px, py, pw, ph)
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(160,120,70,${Math.random() * 0.05})`
    g.fillRect(px + Math.random() * pw, py + Math.random() * ph, Math.random() * 26, 1.2)
  }
  // red border frame on the paper
  g.strokeStyle = 'rgba(184,65,47,0.75)'
  g.lineWidth = 5
  g.strokeRect(px + 34, py + 34, pw - 68, ph - 68)
  g.lineWidth = 2
  g.strokeRect(px + 48, py + 48, pw - 96, ph - 96)

  const cx = CW / 2
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  // seal
  g.fillStyle = '#b8412f'
  roundRect(g, cx - 62, py + 110, 124, 124, 16)
  g.fill()
  g.fillStyle = '#fbe9d0'
  g.font = `96px ${FONT_CJK}`
  g.textBaseline = 'middle'
  g.fillText('邀', cx, py + 176)
  g.textBaseline = 'alphabetic'

  g.fillStyle = '#6b4a3a'
  g.font = `italic 400 96px ${FONT_DISPLAY}`
  g.fillText('Welcome,', cx, py + 420)

  // the name — sized to fit
  const name = guest.trim() || 'Friend'
  let size = 190
  g.font = `700 ${size}px ${FONT_DISPLAY}`
  while (g.measureText(name).width > pw - 150 && size > 60) {
    size -= 6
    g.font = `700 ${size}px ${FONT_DISPLAY}`
  }
  g.fillStyle = '#2b2320'
  g.fillText(name, cx, py + 420 + size * 1.05)

  // ornament
  const oy = py + 420 + size * 1.05 + 110
  g.strokeStyle = '#b8412f'
  g.lineWidth = 4
  g.beginPath()
  g.moveTo(cx - 250, oy)
  g.lineTo(cx - 40, oy)
  g.moveTo(cx + 40, oy)
  g.lineTo(cx + 250, oy)
  g.stroke()
  g.fillStyle = '#d9a441'
  g.beginPath()
  g.moveTo(cx, oy - 22)
  g.lineTo(cx + 22, oy)
  g.lineTo(cx, oy + 22)
  g.lineTo(cx - 22, oy)
  g.closePath()
  g.fill()

  g.fillStyle = '#b8412f'
  g.font = `700 64px ${FONT_DISPLAY}`
  const inv = 'YOU ARE INVITED'
  // manual letter spacing
  const spacing = 10
  const widths = [...inv].map((ch) => g.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (inv.length - 1)
  let x = cx - total / 2
  g.textAlign = 'left'
  ;[...inv].forEach((ch, i) => {
    g.fillText(ch, x, oy + 130)
    x += widths[i] + spacing
  })
  g.textAlign = 'center'

  // auspicious cloud motif: three soft lobes, twice
  g.strokeStyle = 'rgba(217,164,65,0.85)'
  g.lineWidth = 5
  const cloud = (x: number, y: number, s: number) => {
    g.beginPath()
    g.arc(x - s, y, s * 0.7, Math.PI * 0.9, Math.PI * 2.05)
    g.arc(x, y - s * 0.35, s * 0.85, Math.PI * 1.05, Math.PI * 1.95)
    g.arc(x + s, y, s * 0.7, Math.PI * 0.95, Math.PI * 2.1)
    g.stroke()
    g.beginPath()
    g.moveTo(x - s * 1.8, y + s * 0.45)
    g.lineTo(x + s * 1.8, y + s * 0.45)
    g.stroke()
  }
  cloud(cx - 220, py + ph - 190, 34)
  cloud(cx + 220, py + ph - 190, 34)
  g.fillStyle = '#d9a441'
  g.beginPath()
  g.arc(cx, py + ph - 180, 10, 0, Math.PI * 2)
  g.fill()
  return toTexture(c)
}

export function HangingScroll() {
  const guest = useUI((s) => s.guest)
  const tex = useMemo(() => scrollTexture(guest), [guest])
  useEffect(() => () => tex.dispose(), [tex])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.92,
        side: THREE.DoubleSide,
        emissive: '#ffe2b0',
        emissiveIntensity: 0.28,
      }),
    [],
  )
  useEffect(() => {
    mat.map = tex
    mat.emissiveMap = tex
    mat.needsUpdate = true
  }, [mat, tex])

  const { geo, pos, uv } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(W, 1, SEG_X, SEG_Y)
    return { geo, pos: geo.attributes.position as THREE.BufferAttribute, uv: geo.attributes.uv as THREE.BufferAttribute }
  }, [])
  const bottom = useRef<THREE.Group>(null!)
  const roll = useRef<THREE.Mesh>(null!)
  const paper = useRef<THREE.Mesh>(null!)

  useFrame(() => {
    const p = world.scroll
    const t = world.time
    const h = Math.max(0.001, L * p)
    for (let j = 0; j <= SEG_Y; j++) {
      const v = j / SEG_Y // 0 top → 1 bottom
      const y = -v * h
      const sway = Math.sin(t * 1.3 + v * 2.4) * 0.025 * v * p
      const curl = Math.pow(v, 6) * 0.07 * (1 - p * 0.6)
      for (let i = 0; i <= SEG_X; i++) {
        const k = j * (SEG_X + 1) + i
        const u = i / SEG_X
        const x = (u - 0.5) * W
        const ripple = Math.sin(u * Math.PI) * 0.018 * Math.sin(t * 2 + v * 5) * p
        pos.setXYZ(k, x, y, sway + curl + ripple)
        uv.setXY(k, u, 1 - v * p)
      }
    }
    pos.needsUpdate = true
    uv.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    paper.current.visible = p > 0.002
    bottom.current.position.y = -h
    bottom.current.position.z = Math.sin(t * 1.3 + 2.4) * 0.025 * p + 0.07 * (1 - p * 0.6)
    const r = 0.05 + 0.075 * (1 - p)
    roll.current.scale.set(r, 1, r)
    roll.current.rotation.x = -p * 18
    mat.emissiveIntensity = 0.22 * uGlow.value + world.glow.hue * 0.1
  })

  return (
    <group position={[SCROLL.x, SCROLL.top, SCROLL.z]}>
      {/* hanging cord + hook */}
      <mesh position={[0, 0.28, 0]}>
        <torusGeometry args={[0.07, 0.012, 6, 16]} />
        <meshStandardMaterial color="#d9a441" metalness={0.6} roughness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.45, 0.13, 0]} rotation-z={s * 1.15}>
          <cylinderGeometry args={[0.008, 0.008, 1.0, 5]} />
          <meshStandardMaterial color="#b8412f" />
        </mesh>
      ))}
      {/* top rod */}
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.045, 0.045, W + 0.16, 12]} />
        <meshStandardMaterial color="#6b3a24" roughness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.1), 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 0.06, 12]} />
          <meshStandardMaterial color="#d9a441" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <mesh ref={paper} geometry={geo} material={mat} castShadow frustumCulled={false} />
      <group ref={bottom}>
        <mesh ref={roll} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[1, 1, W, 16]} />
          <meshStandardMaterial color="#f3e4c4" roughness={0.9} />
        </mesh>
        <mesh rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.05, 0.05, W + 0.24, 12]} />
          <meshStandardMaterial color="#6b3a24" roughness={0.5} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (W / 2 + 0.14), 0, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.075, 0.075, 0.07, 12]} />
            <meshStandardMaterial color="#d9a441" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
