import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { world } from '../../state/world'
import { GATE } from '../layout'
import { canvas, glowTex, toTexture } from '../lib/textures'
import { grade } from '../grade'

/** Vertical fade texture for light shafts. */
function shaftTex() {
  const [c, g] = canvas(64, 256)
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, 'rgba(255,255,255,0)')
  grd.addColorStop(0.15, 'rgba(255,255,255,0.9)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 256)
  const h = g.createLinearGradient(0, 0, 64, 0)
  h.addColorStop(0, 'rgba(0,0,0,1)')
  h.addColorStop(0.5, 'rgba(0,0,0,0)')
  h.addColorStop(1, 'rgba(0,0,0,1)')
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = h
  g.fillRect(0, 0, 64, 256)
  return toTexture(c)
}

const WHITE = new THREE.Color('#ffffff')

/**
 * The veil: mist with light behind it. Brightest in the middle of the opening,
 * a shade deeper toward the jambs and the ground (so it reads as depth, not as
 * a white wall), and never quite opaque — the nearest shapes beyond are ghosts.
 */
function veilTex() {
  const S = 128
  const [c, g] = canvas(S, S)
  const img = g.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / (S - 1) - 0.5
      const v = y / (S - 1) // 0 = lintel, 1 = ground
      const edge = Math.min(1, Math.abs(u) * 2)
      // light: falls off toward the jambs and toward the ground
      const light = 1 - 0.3 * edge * edge - 0.22 * v * v
      // density: mist lies thickest on the ground and thins toward the lintel, where the
      // crowns of the trees beyond still show through
      const a = 0.5 + 0.46 * Math.pow(v, 0.7) + 0.05 * (1 - edge)
      const i = (y * S + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * light)
      img.data[i + 3] = Math.round(255 * Math.min(1, a))
    }
  }
  g.putImageData(img, 0, 0)
  return toTexture(c)
}

/**
 * Warm "volumetric" morning light pouring through the central opening of the
 * Hoàng Đế gate as Lực sets off: a glow filling the opening, soft shafts
 * fanning toward the viewer, and pools of light on the lane.
 */
export function GateLight() {
  const group = useRef<THREE.Group>(null!)
  const mats = useMemo(() => {
    const add = (map: THREE.Texture, color: string) =>
      new THREE.MeshBasicMaterial({
        map,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        opacity: 0,
        fog: false,
      })
    return { shaft: add(shaftTex(), '#ffc98a'), glow: add(glowTex(), '#ffd9a0'), pool: add(glowTex(), '#ffb86b') }
  }, [])
  // the veil: in chapter I the gate opens onto a haze of light — the world beyond is not shown yet
  const veil = useMemo(() => new THREE.MeshBasicMaterial({ map: veilTex(), transparent: true, depthWrite: false, opacity: 0, fog: false }), [])
  const veilG = useRef<THREE.Group>(null!)
  const shafts = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: (i - 3) * 0.24,
        yaw: (i - 3) * 0.12,
        pitch: 1.0 + (i % 2) * 0.12,
        w: 0.55 + (i % 3) * 0.2,
        seed: i * 1.7,
      })),
    [],
  )
  const refs = useRef<THREE.Mesh[]>([])

  useFrame(() => {
    const L = world.gate.light
    const t = world.time
    // it takes the colour of the hour, lifted most of the way to white
    // (hardly at all before dawn: then it is only a paler dark)
    veil.color.copy(grade.fog).lerp(WHITE, 0.38 * (1 - grade.night))
    veil.opacity = world.veil
    veilG.current.visible = world.veil > 0.01
    group.current.visible = L > 0.002
    mats.glow.opacity = L * 0.95
    mats.pool.opacity = L * 0.75
    mats.shaft.opacity = L * 0.32
    refs.current.forEach((m, i) => {
      if (!m) return
      const s = shafts[i]
      const k = 0.8 + 0.2 * Math.sin(t * 0.9 + s.seed)
      m.scale.set(s.w * k, 3.2, 1)
    })
  })

  const z = GATE.z + 0.4
  return (
    <>
      <group ref={veilG} position={[0, GATE.y, GATE.z - 0.32]}>
        {/* the central opening, and the two side bays */}
        <mesh position={[0, 1.49, 0]} material={veil} renderOrder={3}>
          <planeGeometry args={[2.12, 2.98]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 2.24, 1.16, 0]} material={veil} renderOrder={3}>
            <planeGeometry args={[1.6, 2.32]} />
          </mesh>
        ))}
      </group>
      <group ref={group} visible={false}>
        {/* the doorway itself glowing */}
        <mesh position={[0, GATE.y + 1.45, z - 0.35]} material={mats.glow}>
          <planeGeometry args={[2.6, 3.6]} />
        </mesh>
        {/* shafts fanning out toward the viewer, lying over the steps */}
        {shafts.map((s, i) => (
          <group key={i} position={[s.x, GATE.y + 1.25, z]} rotation={[0, s.yaw, 0]}>
            <mesh ref={(el) => void (refs.current[i] = el!)} rotation-x={s.pitch} position={[0, -0.7, 1.3]} material={mats.shaft}>
              <planeGeometry args={[1, 1]} />
            </mesh>
          </group>
        ))}
        {/* pool of light on platform + steps */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, z + 1.4]} material={mats.pool}>
          <planeGeometry args={[3.2, 3.6]} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, z - 1.6]} material={mats.pool}>
          <planeGeometry args={[3.0, 3.0]} />
        </mesh>
      </group>
    </>
  )
}
