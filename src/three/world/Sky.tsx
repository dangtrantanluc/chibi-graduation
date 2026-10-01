import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { blob, rng } from '../lib/kit'
import { patchMaterial, uNight, uTime } from '../lib/materials'
import { Ranges } from './Ranges'

export const SUN_DIR = new THREE.Vector3(-0.62, 0.3, -0.72).normalize()
const CENTER = new THREE.Vector3(0, 0, -31)
const CLOUD_DAY = new THREE.Color('#fff4ec')
const CLOUD_NIGHT = new THREE.Color('#566394')
const CLOUD_GLOW_DAY = new THREE.Color('#f3b9a2')
const CLOUD_GLOW_NIGHT = new THREE.Color('#2a3468')

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
  // the same dome by night (dark theme)
  uniform vec3 uTopN;
  uniform vec3 uMidN;
  uniform vec3 uHorizonN;
  uniform vec3 uLowN;
  uniform vec3 uMoon;
  uniform float uNight;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 c = mix(mix(uHorizon, uHorizonN, uNight), mix(uMid, uMidN, uNight), smoothstep(0.02, 0.28, h));
    c = mix(c, mix(uTop, uTopN, uNight), smoothstep(0.25, 0.75, h));
    c = mix(c, mix(uLow, uLowN, uNight), smoothstep(0.0, -0.25, h));
    float sd = max(dot(dir, uSunDir), 0.0);
    vec3 sun = uSun * (pow(sd, 18.0) * 0.55 + pow(sd, 4.0) * 0.22 + pow(sd, 400.0) * 1.2);
    // the sun's place is taken by a full moon: a crisp disc in a soft halo
    vec3 moon = uMoon * (pow(sd, 90.0) * 0.3 + pow(sd, 12.0) * 0.08 + smoothstep(0.99935, 0.99965, sd) * 1.5);
    c += mix(sun, moon, uNight);
    // stars: one per cell of a grid on the dome, each twinkling at its own pace
    vec3 g = dir * 80.0;
    vec3 id = floor(g);
    float hs = hash(id);
    float star = step(0.986, hs) * smoothstep(0.24, 0.0, length(fract(g) - 0.5));
    float tw = 0.6 + 0.4 * sin(uTime * (1.2 + hs * 3.0) + hs * 40.0);
    c += vec3(0.86, 0.9, 1.0) * star * tw * uNight * smoothstep(0.03, 0.3, h) * (1.0 - smoothstep(0.985, 0.999, sd));
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
          uTopN: { value: new THREE.Color('#070b24') },
          uMidN: { value: new THREE.Color('#141c4a') },
          uHorizonN: { value: new THREE.Color('#33407e') },
          uLowN: { value: new THREE.Color('#1a1f4a') },
          uMoon: { value: new THREE.Color('#dfe8ff') },
          uNight,
          uTime,
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
      const rad = 40 + r() * 26
      add(Math.sin(a) * rad * 0.8 + CENTER.x, -7 - r() * 4, Math.cos(a) * rad + CENTER.z, 5 + r() * 4, 4)
    }
    // … and further out, mist lying among the karst towers
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2
      const rad = 78 + r() * 60
      add(Math.sin(a) * rad + CENTER.x, -16 - r() * 5, Math.cos(a) * rad + CENTER.z, 9 + r() * 6, 5)
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
    const m = mesh.material as THREE.MeshStandardMaterial
    m.color.lerpColors(CLOUD_DAY, CLOUD_NIGHT, uNight.value)
    m.emissive.lerpColors(CLOUD_GLOW_DAY, CLOUD_GLOW_NIGHT, uNight.value)
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
      <Ranges />
      <Clouds />
    </>
  )
}
