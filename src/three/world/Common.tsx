import * as THREE from 'three'
import { useMemo } from 'react'
import type { V3 } from '../lib/kit'
import { coupletTex, flagTex, friezeTex, plaqueTex, vnFlagTex } from '../lib/textures'
import { uTime } from '../lib/materials'
import { C } from './parts'

/** Hoành phi — a horizontal calligraphy board with a frame. */
export function Plaque({ text, w, h, position, tilt = -0.08, style = 'wood', ry = 0 }: { text: string; w: number; h: number; position: V3; tilt?: number; style?: 'wood' | 'hue' | 'stone'; ry?: number }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: plaqueTex(text, style, style === 'stone' ? 640 : 512), roughness: style === 'stone' ? 0.95 : 0.4, metalness: style === 'hue' ? 0.1 : 0 })
    m.emissiveMap = m.map
    m.emissive = new THREE.Color(style === 'stone' ? '#000000' : '#ffd89a')
    m.emissiveIntensity = style === 'stone' ? 0 : 0.14
    return m
  }, [text, style])
  const frame = style === 'hue' ? C.gold : style === 'stone' ? '#8f887c' : C.woodDk
  return (
    <group position={position} rotation={[tilt, ry, 0]}>
      <mesh material={mat} position-z={0.031}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[w + 0.06, h + 0.06, 0.06]} />
        <meshStandardMaterial color={frame} metalness={style === 'hue' ? 0.6 : 0} roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Câu đối — a vertical couplet board. */
export function Couplet({ text, position, w = 0.36, h = 1.8, style = 'hue', ry = 0 }: { text: string; position: V3; w?: number; h?: number; style?: 'hue' | 'binhdinh'; ry?: number }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: coupletTex(text, style), roughness: 0.4 })
    m.emissiveMap = m.map
    m.emissive = new THREE.Color('#ffcf8a')
    m.emissiveIntensity = style === 'hue' ? 0.18 : 0.08
    return m
  }, [text, style])
  return (
    <mesh position={position} rotation-y={ry} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/** A flat painted sign / label (text textures, building names). */
export function Sign({ map, w, h, position, ry = 0, glow = 0, transparent = true }: { map: THREE.Texture; w: number; h: number; position: V3; ry?: number; glow?: number; transparent?: boolean }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map, transparent, alphaTest: transparent ? 0.3 : 0, roughness: 0.6 })
    if (glow) {
      m.emissiveMap = map
      m.emissive = new THREE.Color('#ffffff')
      m.emissiveIntensity = glow
    }
    return m
  }, [map, glow, transparent])
  return (
    <mesh position={position} rotation-y={ry} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/** Nhất thi nhất họa frieze panels. */
export function Frieze({ position, w, h }: { position: V3; w: number; h: number }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: friezeTex(), roughness: 0.5 })
    m.emissiveMap = m.map
    m.emissive = new THREE.Color('#ffdca0')
    m.emissiveIntensity = 0.12
    return m
  }, [])
  return (
    <mesh position={position} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

function waveMaterial(map: THREE.Texture, key: string, amp = 0.07) {
  const m = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.8 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float fk = uv.x;
        vec3 fo = modelMatrix[3].xyz;
        float fp = fo.x * 0.7 + fo.z * 0.3;
        transformed.z += sin(uTime * 3.2 - uv.x * 7.0 + fp) * ${amp.toFixed(3)} * fk;
        transformed.y += sin(uTime * 2.1 - uv.x * 5.0 + fp) * ${(amp * 0.3).toFixed(3)} * fk;`,
      )
  }
  m.customProgramCacheKey = () => `wave-${key}`
  return m
}

/**
 * Flags rippling on poles. `vn`: cờ đỏ sao vàng on a slim steel pole;
 * `festival`: five-colour cờ hội on bamboo, as at a northern village festival or in Huế.
 */
export function Flags({ spots, kind = 'festival', h = 3.8, ry = 0 }: { spots: [number, number][]; kind?: 'vn' | 'festival'; h?: number; ry?: number }) {
  const mats = useMemo(() => spots.map((_, i) => waveMaterial(kind === 'vn' ? vnFlagTex() : flagTex(i), kind === 'vn' ? 'vn' : `f${i % 5}`, kind === 'vn' ? 0.05 : 0.07)), [spots, kind])
  const w = kind === 'vn' ? 0.72 : 0.95
  const fh = kind === 'vn' ? 0.48 : 0.52
  return (
    <group>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation-y={ry}>
          <mesh position-y={h / 2} castShadow>
            <cylinderGeometry args={[0.022, 0.032, h, 6]} />
            <meshStandardMaterial color={kind === 'vn' ? '#d8dade' : '#c9a45a'} roughness={kind === 'vn' ? 0.25 : 0.5} metalness={kind === 'vn' ? 0.5 : 0} />
          </mesh>
          <mesh position-y={h + 0.05}>
            {kind === 'vn' ? <sphereGeometry args={[0.045, 10, 8]} /> : <coneGeometry args={[0.07, 0.2, 8]} />}
            <meshStandardMaterial color="#e9c46a" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[w / 2 + 0.02, h - fh / 2 - 0.08, 0]} material={mats[i]}>
            <planeGeometry args={[w, fh, 12, 3]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
