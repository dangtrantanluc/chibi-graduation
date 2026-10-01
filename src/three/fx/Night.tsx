import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { uNight, uTime } from '../lib/materials'
import { world } from '../../state/world'
import { rng } from '../lib/kit'
import { BANYAN, HALL, HOUSE, HUE_PONDS, POND, VILLAGE_END } from '../layout'

const BG_DAY = new THREE.Color('#e7b9a4')
const BG_NIGHT = new THREE.Color('#141a3c')
const FOG_DAY = new THREE.Color('#e8b8a6')
const FOG_NIGHT = new THREE.Color('#1b2350')

/** The dark theme's backdrop: the far haze and background sink from sunset peach to night blue. */
export function NightBackdrop() {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const n = uNight.value
    if (scene.background instanceof THREE.Color) scene.background.lerpColors(BG_DAY, BG_NIGHT, n)
    if (scene.fog) scene.fog.color.lerpColors(FOG_DAY, FOG_NIGHT, n)
  })
  return null
}

const flyVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uNight;
  uniform float uPx;
  varying float vA;
  void main() {
    // each one wanders a slow, lazy loop around its home
    vec3 p = position;
    float t = uTime * (0.25 + aSeed * 0.3) + aSeed * 40.0;
    p.x += sin(t * 1.3) * 0.45 + sin(t * 0.7 + aSeed * 9.0) * 0.3;
    p.y += sin(t * 1.7 + aSeed * 5.0) * 0.22;
    p.z += cos(t * 1.1) * 0.45;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // they pulse: mostly dim, a slow bright breath now and then
    vA = uNight * (0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (1.4 + aSeed * 2.0) + aSeed * 30.0), 3.0));
    gl_PointSize = uPx * (0.7 + aSeed * 0.6) / max(-mv.z, 0.5);
    gl_Position = projectionMatrix * mv;
  }
`
const flyFrag = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(0.82, 1.0, 0.45) * (1.2 + 2.0 * a * a), a * a * vA);
  }
`

/** Fireflies over the village pond, the yard and the bamboo — only by night. */
export function Fireflies() {
  const gl = useThree((s) => s.gl)
  const points = useMemo(() => {
    const r = rng(404)
    const homes: [number, number, number, number][] = [
      // [x, z, spread, how many]
      [POND.x + 1.5, POND.z, 3.2, 22],
      [BANYAN.x + 0.9, BANYAN.z - 1.4, 2.2, 12],
      [HOUSE.x - 1.4, HOUSE.z + 2.4, 2.4, 14],
      [0, VILLAGE_END + 0.4, 2.0, 12],
      [-8.5, -31.2, 2.8, 10],
      [9.5, -31.6, 2.8, 10],
      // … and a few by the paddies of Bình Định and the lotus ponds of Huế
      [12, 10, 4.5, 14],
      [-4, (HUE_PONDS[0][2] + HUE_PONDS[0][3]) / 2, 2.4, 8],
      [4, (HUE_PONDS[0][2] + HUE_PONDS[0][3]) / 2, 2.4, 8],
      [-9, HALL.terraceFront + 2, 2.6, 6],
      [9, HALL.terraceFront + 2, 2.6, 6],
    ]
    const pos: number[] = []
    const seed: number[] = []
    for (const [x, z, s, n] of homes)
      for (let i = 0; i < n; i++) {
        pos.push(x + (r() - 0.5) * 2 * s, 0.35 + r() * 1.5, z + (r() - 0.5) * 2 * s)
        seed.push(r())
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1))
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uNight, uPx: { value: 60 } },
      vertexShader: flyVert,
      fragmentShader: flyFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const p = new THREE.Points(g, m)
    p.frustumCulled = false
    p.renderOrder = 5
    return p
  }, [])
  useFrame(() => {
    const m = points.material as THREE.ShaderMaterial
    m.uniforms.uPx.value = 34 * gl.getPixelRatio() * (gl.domElement.height / gl.getPixelRatio() / 720)
    // (from the map view they are smaller than a pixel and would only twinkle as noise)
    points.visible = uNight.value > 0.02 && world.overview.k < 0.5
  })
  return <primitive object={points} />
}
