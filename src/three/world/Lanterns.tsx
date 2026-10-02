import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { on, world } from '../../state/world'
import { mergeKit, G, type Part } from '../lib/kit'
import { glowTex, silkTex } from '../lib/textures'
import { uGlow, uNight } from '../lib/materials'
import { NGOMON, YARD_LAMP } from '../layout'
import { VILLAGE_POLES } from './Village'
import { PLAZA0, STRING_X } from './Hue'
import { LAMP_X } from './ThangLong'

/*
 * Every lantern in the world, two kinds:
 *   hoian — round silk lanterns (Hội An style; plain red ones in the village)
 *   star  — đèn ông sao, the Mid-Autumn star lantern (Hà Nội in autumn, Huế)
 * All hang from strings, swing as damped pendulums and react to gusts.
 */

type Zone = 'hanoi' | 'village' | 'hue'
type Style = 'hoian' | 'star'
interface LanternDef {
  a: [number, number, number]
  len: number
  size: number
  zone: Zone
  style: Style
  color?: string
  idx?: number
}

const HOIAN = ['#e8453a', '#f2a93b', '#f7d046', '#e9577f', '#8e5fc7', '#3fa36b', '#ef7b3a']

export const LANTERNS: LanternDef[] = (() => {
  const L: LanternDef[] = []
  let h = 0
  // Hà Nội, Mid-Autumn: a string of star and round lanterns across the esplanade
  for (let k = 0; k < 9; k++) {
    const t = (k + 0.5) / 9
    const x = -LAMP_X + t * 2 * LAMP_X
    const y = 2.62 - 0.42 * Math.sin(Math.PI * t)
    L.push({ a: [x, y, -24.8], len: 0.1, size: k % 2 ? 0.7 : 0.8, zone: 'hanoi', style: k % 2 ? 'hoian' : 'star', color: k % 2 ? HOIAN[h++ % HOIAN.length] : ['#e8453a', '#f2c14e', '#e9577f'][k % 3] })
  }
  // the village: red lanterns on bamboo arms. The first is the low one at the edge of the lane,
  // which Lực lights from his own lamp; the others take from it, the nearest first
  L.push({ a: [YARD_LAMP.x, YARD_LAMP.y, YARD_LAMP.z], len: 0.04, size: 0.6, zone: 'village', style: 'hoian', color: '#d8352c', idx: 0 })
  const near = VILLAGE_POLES.map(([x, z], i) => ({ i, d: Math.hypot(x - YARD_LAMP.x, z - YARD_LAMP.z) })).sort((a, b) => a.d - b.d)
  VILLAGE_POLES.forEach(([x, z], i) => L.push({ a: [x - Math.sign(x) * 0.46, 2.28, z], len: 0.1, size: 0.72, zone: 'village', style: 'hoian', color: '#d8352c', idx: 1 + near.findIndex((n) => n.i === i) }))
  // Huế: lanterns under Lầu Ngũ Phụng, along the two strings, stars on bamboo poles
  for (const x of [-3.6, -1.6, 1.6, 3.6]) L.push({ a: [x, NGOMON.h + 1.3, NGOMON.z + 0.95], len: 0.3, size: 1.05, zone: 'hue', style: 'hoian', color: HOIAN[h++ % HOIAN.length] })
  const front = NGOMON.z + NGOMON.depth / 2 + NGOMON.wing + 0.2
  for (const s of [-1, 1]) {
    for (let k = 1; k <= 6; k++) {
      const t = k / 7
      const z = PLAZA0 + t * (front - PLAZA0)
      L.push({ a: [s * STRING_X, 3.25 - 0.45 * Math.sin(Math.PI * t), z], len: 0.1, size: 0.72, zone: 'hue', style: 'hoian', color: HOIAN[h++ % HOIAN.length] })
    }
  }
  for (const s of [-1, 1]) L.push({ a: [s * 2.6, 2.95, PLAZA0 - 0.2], len: 0.14, size: 1.0, zone: 'hue', style: 'star', color: s > 0 ? '#e8453a' : '#f2a93b' })
  return L
})()

const BODY_H = 0.34

function bodyGeometry(style: Style) {
  if (style === 'star') {
    const s = new THREE.Shape()
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2
      const r = i % 2 ? 0.1 : 0.24
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.03, bevelSegments: 2 })
    g.translate(0, 0, -0.03)
    return g
  }
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const y = (t - 0.5) * BODY_H
    const r = 0.22 * Math.pow(Math.sin(Math.PI * (0.05 + t * 0.9)), 1.3) * (1 + 0.06 * Math.cos(t * Math.PI * 6))
    pts.push(new THREE.Vector2(Math.max(r, 0.05), y))
  }
  return new THREE.LatheGeometry(pts, 12)
}

function trimGeometry(style: Style) {
  const top = BODY_H / 2 + 0.01
  const p: Part[] =
    style === 'hoian'
        ? [
            { g: G.cyl, c: '#d9a441', p: [0, top, 0], s: [0.06, 0.05, 0.06] },
            { g: G.cyl, c: '#d9a441', p: [0, -top, 0], s: [0.06, 0.05, 0.06] },
            { g: G.cone, c: '#c8342b', p: [0, -top - 0.16, 0], r: [Math.PI, 0, 0], s: [0.04, 0.26, 0.04] },
            { g: G.sphereLo, c: '#d9a441', p: [0, -top - 0.03, 0], s: 0.025 },
          ]
        : [
            { g: G.cone, c: '#f2c14e', p: [0, -0.34, 0], r: [Math.PI, 0, 0], s: [0.03, 0.18, 0.03] },
            { g: G.sphereLo, c: '#f2c14e', p: [0, 0.26, 0], s: 0.03 },
          ]
  return mergeKit(p).get('toy')!
}

const haloVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vTint;
  void main() {
    vUv = uv;
    vTint = instanceColor;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(instanceMatrix[0].xyz);
    mv.xy += position.xy * s;
    mv.z += 0.15;
    gl_Position = projectionMatrix * mv;
  }
`
const haloFrag = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vTint;
  void main() {
    float a = texture2D(uMap, vUv).a;
    gl_FragColor = vec4(vTint * a, a);
  }
`

function bodyMaterial(style: Style) {
  const map = style === 'hoian' ? silkTex() : null
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: style === 'star' ? 0.9 : 1.6, roughness: 0.8 })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow * vColor.rgb;')
  }
  m.customProgramCacheKey = () => `lantern-${style}`
  return m
}

export function Lanterns() {
  const sys = useMemo(() => {
    const styles: Style[] = ['hoian', 'star']
    const byStyle = new Map<Style, { body: THREE.InstancedMesh; trim: THREE.InstancedMesh; glow: THREE.InstancedBufferAttribute; slots: number[] }>()
    const tint = new THREE.Color()
    for (const st of styles) {
      const slots = LANTERNS.map((l, i) => (l.style === st ? i : -1)).filter((i) => i >= 0)
      if (!slots.length) continue
      const geo = bodyGeometry(st)
      const glow = new THREE.InstancedBufferAttribute(new Float32Array(slots.length).fill(1), 1)
      geo.setAttribute('aGlow', glow)
      const body = new THREE.InstancedMesh(geo, bodyMaterial(st), slots.length)
      const trim = new THREE.InstancedMesh(trimGeometry(st), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 }), slots.length)
      slots.forEach((li, k) => body.setColorAt(k, tint.set(LANTERNS[li].color ?? '#ffffff')))
      for (const m of [body, trim]) {
        m.frustumCulled = false
        m.castShadow = true
      }
      byStyle.set(st, { body, trim, glow, slots })
    }
    const strGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4)
    strGeo.translate(0, -0.5, 0)
    const string = new THREE.InstancedMesh(strGeo, new THREE.MeshStandardMaterial({ color: '#3b2a22', roughness: 0.9 }), LANTERNS.length)
    const halo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({ uniforms: { uMap: { value: glowTex() } }, vertexShader: haloVert, fragmentShader: haloFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      LANTERNS.length,
    )
    LANTERNS.forEach((_, i) => halo.setColorAt(i, tint.setScalar(0)))
    string.frustumCulled = halo.frustumCulled = false
    halo.renderOrder = 4
    const slotOf = LANTERNS.map((l) => byStyle.get(l.style)!.slots.indexOf(LANTERNS.indexOf(l)))
    const sim = LANTERNS.map((l, i) => ({ ax: 0, az: 0, vx: 0, vz: 0, phase: i * 1.37, anchor: new THREE.Vector3(...l.a), tint: new THREE.Color(l.color ?? '#ffb46b') }))
    return { byStyle, string, halo, sim, slotOf }
  }, [])

  useEffect(
    () =>
      on((e) => {
        if (e.type !== 'gust') return
        LANTERNS.forEach((l, i) => {
          const dx = l.a[0] - e.x
          const dz = l.a[2] - e.z
          const d = Math.hypot(dx, dz)
          if (d > e.radius) return
          const f = e.strength * (1 - d / e.radius) * (0.7 + Math.random() * 0.6)
          const nx = d > 0.01 ? dx / d : Math.random() - 0.5
          const nz = d > 0.01 ? dz / d : Math.random() - 0.5
          sys.sim[i].vx -= nz * f * 1.6
          sys.sim[i].vz += nx * f * 1.6
        })
      }),
    [sys],
  )

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const t = world.time
    for (let i = 0; i < LANTERNS.length; i++) {
      const l = LANTERNS[i]
      const s = sys.sim[i]
      const k = (9.8 * 0.32) / (l.len + BODY_H * l.size * 0.6)
      const windX = 0.1 * Math.sin(t * 0.7 + s.phase) + 0.05 * Math.sin(t * 1.9 + s.phase * 2)
      const windZ = 0.08 * Math.sin(t * 0.55 + s.phase * 1.3)
      s.vx += (-k * Math.sin(s.ax) - 0.9 * s.vx + windX) * dt
      s.vz += (-k * Math.sin(s.az) - 0.9 * s.vz + windZ) * dt
      s.ax += s.vx * dt
      s.az += s.vz * dt

      let g = 1
      if (l.zone === 'hanoi') g = 0.9 + world.glow.hanoi
      else if (l.zone === 'hue') g = 0.95 + world.glow.hue
      else {
        // (unlit until the flame reaches it: the first by villageWave ≈ 0.15, the last by 1)
        const th = ((l.idx ?? 0) + 0.4) / (VILLAGE_POLES.length + 1)
        const w = THREE.MathUtils.smoothstep(world.villageWave, th - 0.05, th + 0.08)
        g = 0.05 + 1.3 * w + world.glow.village
      }
      g *= uGlow.value * (1 + 0.7 * uNight.value) * (1 + 0.035 * Math.sin(t * 11 + i * 2.1) + 0.02 * Math.sin(t * 23 + i))

      tmp.q.setFromEuler(tmp.e.set(s.ax, 0, s.az))
      tmp.m.compose(s.anchor, tmp.q, tmp.s.set(1, l.len, 1))
      sys.string.setMatrixAt(i, tmp.m)
      const drop = l.len + (BODY_H / 2 + 0.05) * l.size
      tmp.v.set(0, -drop, 0).applyQuaternion(tmp.q).add(s.anchor)
      tmp.m.compose(tmp.v, tmp.q, tmp.s.setScalar(l.size))
      const st = sys.byStyle.get(l.style)!
      const k2 = sys.slotOf[i]
      st.body.setMatrixAt(k2, tmp.m)
      st.trim.setMatrixAt(k2, tmp.m)
      st.glow.setX(k2, Math.max(0.06, g))
      const hs = l.size * (1.0 + 0.25 * Math.min(g, 2))
      tmp.m.compose(tmp.v, tmp.q.identity(), tmp.s.setScalar(hs))
      sys.halo.setMatrixAt(i, tmp.m)
      sys.halo.setColorAt(i, tmp.c.copy(s.tint).multiplyScalar(Math.min(1, 0.34 * g)))
    }
    for (const st of sys.byStyle.values()) {
      st.body.instanceMatrix.needsUpdate = true
      st.trim.instanceMatrix.needsUpdate = true
      st.glow.needsUpdate = true
    }
    sys.string.instanceMatrix.needsUpdate = true
    sys.halo.instanceMatrix.needsUpdate = true
    sys.halo.instanceColor!.needsUpdate = true
  })

  return (
    <>
      <primitive object={sys.string} />
      {[...sys.byStyle.values()].map((st, i) => (
        <group key={i}>
          <primitive object={st.body} />
          <primitive object={st.trim} />
        </group>
      ))}
      <primitive object={sys.halo} />
    </>
  )
}
