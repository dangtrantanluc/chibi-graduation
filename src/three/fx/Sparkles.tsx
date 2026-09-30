import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { on, world } from '../../state/world'
import { glowTex } from '../lib/textures'

/**
 * Tiny glowing motes that float upward (AI magic, the final celebration).
 * One instanced, camera-facing quad per mote — a single draw call.
 */
const MAX = 220

const vert = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  varying vec3 vCol;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vAlpha = aAlpha;
    #ifdef USE_INSTANCING_COLOR
      vCol = instanceColor;
    #else
      vCol = vec3(1.0);
    #endif
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(instanceMatrix[0].xyz);
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vCol;
  varying vec2 vUv;
  void main() {
    float a = texture2D(uMap, vUv).a * vAlpha;
    gl_FragColor = vec4(vCol * a * 1.6, a);
  }
`

export function Sparkles() {
  const sim = useMemo(() => {
    const alpha = new Float32Array(MAX)
    return {
      pos: Array.from({ length: MAX }, () => new THREE.Vector3()),
      vel: Array.from({ length: MAX }, () => new THREE.Vector3()),
      life: new Float32Array(MAX),
      max: new Float32Array(MAX).fill(1),
      size: new Float32Array(MAX),
      alpha,
      attr: new THREE.InstancedBufferAttribute(alpha, 1),
      next: 0,
    }
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: glowTex() } },
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.setAttribute('aAlpha', sim.attr)
    return g
  }, [sim])

  const inst = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, MAX)
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    const c = new THREE.Color('#ffd89a')
    for (let i = 0; i < MAX; i++) {
      m.setMatrixAt(i, zero)
      m.setColorAt(i, c)
    }
    m.frustumCulled = false
    m.renderOrder = 5
    return m
  }, [geo, mat])
  const mesh = useRef(inst)

  useEffect(() => {
    const m = mesh.current
    const c = new THREE.Color()
    const palette = ['#ffd89a', '#fff1c9', '#a8f0dc', '#ffc27a']
    return on((e) => {
      if (e.type !== 'sparkle') return
      for (let k = 0; k < e.count; k++) {
        const i = sim.next
        sim.next = (sim.next + 1) % MAX
        sim.pos[i].copy(e.pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.1, (Math.random() - 0.5) * 0.3))
        sim.vel[i].set((Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.45, (Math.random() - 0.5) * 0.25)
        sim.life[i] = 0
        sim.max[i] = 1.8 + Math.random() * 1.8
        sim.size[i] = 0.08 + Math.random() * 0.1
        m.setColorAt(i, c.set(e.color ?? palette[(Math.random() * palette.length) | 0]))
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })
  }, [sim])

  const tmp = useMemo(() => new THREE.Matrix4(), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const m = mesh.current
    const t = world.time
    for (let i = 0; i < MAX; i++) {
      if (sim.life[i] >= sim.max[i]) {
        if (sim.alpha[i] !== 0) {
          sim.alpha[i] = 0
          m.setMatrixAt(i, tmp.makeScale(0, 0, 0))
        }
        continue
      }
      sim.life[i] += dt
      const p = sim.pos[i]
      const v = sim.vel[i]
      v.x += Math.sin(t * 2 + i) * 0.15 * dt
      v.y *= 0.995
      p.addScaledVector(v, dt)
      const k = sim.life[i] / sim.max[i]
      sim.alpha[i] = Math.min(1, k * 6) * (1 - k) * (0.75 + 0.25 * Math.sin(t * 9 + i * 1.7))
      const s = sim.size[i] * (1 + k * 0.4)
      tmp.makeScale(s, s, s).setPosition(p)
      m.setMatrixAt(i, tmp)
    }
    m.instanceMatrix.needsUpdate = true
    sim.attr.needsUpdate = true
  })

  return <primitive object={inst} />
}
