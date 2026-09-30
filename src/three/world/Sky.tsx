import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { blob, rng } from '../lib/kit'
import { patchMaterial } from '../lib/materials'

export const SUN_DIR = new THREE.Vector3(-0.62, 0.3, -0.72).normalize()
const CENTER = new THREE.Vector3(0, 0, -26)

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`
const skyFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uLow;
  uniform vec3 uSunDir;
  uniform vec3 uSun;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 c = mix(uHorizon, uMid, smoothstep(0.02, 0.28, h));
    c = mix(c, uTop, smoothstep(0.25, 0.75, h));
    c = mix(c, uLow, smoothstep(0.0, -0.25, h));
    float sd = max(dot(normalize(vDir), uSunDir), 0.0);
    c += uSun * (pow(sd, 18.0) * 0.55 + pow(sd, 4.0) * 0.22 + pow(sd, 400.0) * 1.2);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color('#41508f') },
          uMid: { value: new THREE.Color('#b58db4') },
          uHorizon: { value: new THREE.Color('#ffc7a0') },
          uLow: { value: new THREE.Color('#e7a58f') },
          uSunDir: { value: SUN_DIR },
          uSun: { value: new THREE.Color('#ffd49a') },
        },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ camera }) => ref.current.position.copy(camera.position))
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  )
}

/** Guilin-style karst peaks as layered ink-wash silhouettes. */
function mountainRange(seed: number, width: number, height: number, top: string, base: string) {
  const r = rng(seed)
  const peaks = Array.from({ length: 4 + Math.floor(r() * 3) }, () => ({
    x: (r() - 0.5) * width * 0.9,
    w: width * (0.12 + r() * 0.16),
    h: height * (0.4 + r() * 0.5),
  }))
  const N = 90
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  for (let i = 0; i <= N; i++) {
    const x = -width / 2 + (i / N) * width
    let y = height * 0.08
    for (const p of peaks) {
      const d = (x - p.x) / p.w
      if (Math.abs(d) < 1) y = Math.max(y, p.h * Math.pow(1 - d * d, 1.15))
    }
    shape.lineTo(x, y)
  }
  shape.lineTo(width / 2, 0)
  shape.lineTo(-width / 2, 0)
  const g = new THREE.ShapeGeometry(shape, 1)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const ct = new THREE.Color(top)
  const cb = new THREE.Color(base)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp(pos.getY(i) / height, 0, 1)
    c.copy(cb).lerp(ct, Math.pow(k, 0.7))
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function Mountains() {
  const rings = useMemo(() => {
    const out: { g: THREE.BufferGeometry; p: THREE.Vector3; ry: number }[] = []
    const layers = [
      { r: 125, n: 9, w: 110, h: 34, top: '#6f7aa8', base: '#e9b9a5', y: -26 },
      { r: 175, n: 9, w: 150, h: 52, top: '#8e8bb5', base: '#efc1a7', y: -30 },
      { r: 240, n: 10, w: 200, h: 74, top: '#ab9ec2', base: '#f5c8a8', y: -34 },
    ]
    layers.forEach((L, li) => {
      for (let i = 0; i < L.n; i++) {
        const a = (i / L.n) * Math.PI * 2 + li * 0.35
        const p = new THREE.Vector3(Math.sin(a) * L.r, L.y, Math.cos(a) * L.r).add(CENTER)
        out.push({ g: mountainRange(li * 100 + i + 3, L.w, L.h, L.top, L.base), p, ry: a + Math.PI })
      }
    })
    return out
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }), [])
  return (
    <group>
      {rings.map((m, i) => (
        <mesh key={i} geometry={m.g} material={mat} position={m.p} rotation-y={m.ry} renderOrder={-5 + (i > 18 ? -2 : i > 9 ? -1 : 0)} />
      ))}
    </group>
  )
}

/** Puffy sunset clouds: a sea of cloud below the board + a few drifting above. */
function Clouds() {
  const group = useRef<THREE.Group>(null!)
  const { mesh } = useMemo(() => {
    const geo = blob(7, 2, 0.1)
    const mat = patchMaterial(
      new THREE.MeshStandardMaterial({ color: '#fff4ec', emissive: '#f3b9a2', emissiveIntensity: 0.38, roughness: 1 }),
      { rim: { color: '#ffd9b0', strength: 0.55, power: 2.0 } },
      'cloud',
    )
    const r = rng(42)
    const items: THREE.Matrix4[] = []
    const add = (x: number, y: number, z: number, s: number, puffs: number) => {
      for (let k = 0; k < puffs; k++) {
        const ps = s * (0.55 + r() * 0.5)
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(x + (r() - 0.5) * s * 2.4, y + r() * s * 0.35, z + (r() - 0.5) * s * 1.2),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)),
          new THREE.Vector3(ps * 1.3, ps * 0.7, ps),
        )
        items.push(m)
      }
    }
    // sea of cloud hugging the board
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const rad = 34 + r() * 26
      add(Math.sin(a) * rad * 0.8 + CENTER.x, -7 - r() * 4, Math.cos(a) * rad + CENTER.z, 5 + r() * 4, 4)
    }
    // high clouds
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2
      const rad = 80 + r() * 50
      add(Math.sin(a) * rad, 22 + r() * 22, Math.cos(a) * rad + CENTER.z, 7 + r() * 5, 5)
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.frustumCulled = false
    return { mesh }
  }, [])
  useFrame((_, dt) => {
    group.current.rotation.y += dt * 0.004
  })
  return (
    <group position={CENTER.toArray()}>
      <group ref={group} position={CENTER.clone().negate().toArray()}>
        <primitive object={mesh} />
      </group>
    </group>
  )
}

export function Sky() {
  return (
    <>
      <SkyDome />
      <Mountains />
      <Clouds />
    </>
  )
}
