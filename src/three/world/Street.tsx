import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { G, mergeKit, rng, type Part } from '../lib/kit'
import { KitMesh } from '../lib/KitMesh'
import { kitMat, uTime } from '../lib/materials'
import { canvas, toTexture } from '../lib/textures'
import { taperTube } from '../characters/hair'
import { world } from '../../state/world'
import { grade } from '../grade'
import { BOARD, STREET } from '../layout'
import { box, cyl } from './parts'

/*
 * II-a · THE CITY — the street Lực steps into when he leaves home.
 * A Sài Gòn street in miniature: concrete utility poles under a tangle of
 * wires, sodium lamps, a traffic light at the zebra crossing, a bánh mì cart
 * under its parasol, motorbikes parked on the pavement — and the crowd:
 * people walking both pavements, motorbikes streaming both lanes. They are
 * faceless on purpose. He is the only one with a face; nobody here knows him
 * yet. Everyone gives way to him (nothing ever walks through him), and the
 * traffic stops at the crossing while he is on it.
 *
 * It is a cold place when he first sees it: everything here is painted in
 * greys and tired colours, the lamps are a cold white, the road shines wet
 * under a fine rain. The one warm thing is the lamp in his hand.
 * None of it exists in chapter I (world.city): home is not overlooked by the
 * city, and the gate opens onto a haze of light.
 */

const S = STREET
const CONCRETE = '#a9a79f'

/** a concrete utility pole with a crossarm, insulators, a transformer and a street lamp */
function pole(x: number, z: number, lampSide: number, transformer: boolean): Part[] {
  const p: Part[] = [
    { g: new THREE.CylinderGeometry(0.07, 0.1, 4.4, 8), c: CONCRETE, m: 'stone', p: [x, 2.2, z] },
    box(1.1, 0.07, 0.07, [x, 4.05, z], '#6b665e', 'wood'),
    box(0.8, 0.06, 0.06, [x, 3.6, z], '#6b665e', 'wood'),
  ]
  for (const dx of [-0.5, -0.2, 0.2, 0.5]) p.push({ g: G.cylXs, c: '#e9e4d6', m: 'ceramic', p: [x + dx, 4.14, z], s: [0.03, 0.1, 0.03] })
  for (const dx of [-0.35, 0.35]) p.push({ g: G.cylXs, c: '#e9e4d6', m: 'ceramic', p: [x + dx, 3.68, z], s: [0.03, 0.1, 0.03] })
  if (transformer) {
    p.push({ g: G.cyl, c: '#7d848c', m: 'paint', p: [x + 0.2, 3.1, z], s: [0.18, 0.5, 0.18] })
    p.push(box(0.3, 0.04, 0.3, [x + 0.2, 2.82, z], '#5a5f66', 'paint'))
  }
  // a tangle of coiled spare cable, the way the poles here always have
  p.push({ g: new THREE.TorusGeometry(0.16, 0.035, 5, 12), c: '#2b2b30', m: 'wood', p: [x, 3.25, z + 0.12], r: [0.2, 0, 0.3] })
  p.push({ g: new THREE.TorusGeometry(0.12, 0.03, 5, 12), c: '#2b2b30', m: 'wood', p: [x - 0.05, 3.05, z + 0.11], r: [0.1, 0.3, -0.4] })
  // the street lamp on its arm, out over the road
  p.push({ g: taperTube([new THREE.Vector3(x, 3.3, z), new THREE.Vector3(x, 3.75, z + lampSide * 0.35), new THREE.Vector3(x, 3.8, z + lampSide * 0.9)], 0.03, 0.022, 10, 6), c: '#5a5f66', m: 'paint' })
  p.push({ g: G.sphere, c: '#5a5f66', m: 'paint', p: [x, 3.78, z + lampSide * 1.0], s: [0.1, 0.06, 0.2] })
  p.push({ g: G.sphere, c: '#dfe8f6', m: 'paperLit', p: [x, 3.73, z + lampSide * 1.0], s: [0.075, 0.035, 0.16] })
  return p
}

/** wires sagging from pole to pole: several, at different heights, never quite parallel */
function wires(xs: number[], z: number): Part[] {
  const p: Part[] = []
  const r = rng(808)
  for (let i = 0; i < xs.length - 1; i++) {
    for (const [y, dz, sag, rad] of [
      [4.2, -0.5, 0.35, 0.012],
      [4.2, -0.2, 0.42, 0.012],
      [4.2, 0.2, 0.38, 0.012],
      [4.2, 0.5, 0.45, 0.012],
      [3.74, -0.35, 0.5, 0.016],
      [3.74, 0.35, 0.56, 0.016],
      [3.3, 0.1, 0.7, 0.03],
    ] as const) {
      const a = xs[i]
      const b = xs[i + 1]
      const s2 = sag * (0.85 + r() * 0.3)
      const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => new THREE.Vector3(a + (b - a) * t, y - s2 * Math.sin(Math.PI * t), z + dz * (0.4 + 0.6 * Math.abs(1 - 2 * t))))
      p.push({ g: taperTube(pts, rad, rad, 14, 4), c: '#232327', m: 'wood' })
    }
  }
  return p
}

/** the light at the crossing */
function trafficLight(x: number, z: number): Part[] {
  return [
    cyl(0.05, 2.5, [x, 1.25, z], '#3a3d42', 'paint'),
    box(0.2, 0.52, 0.16, [x, 2.66, z], '#2a2c30', 'paint'),
    { g: G.sphereLo, c: '#5a2a26', m: 'paint', p: [x, 2.82, z - 0.08], s: 0.055 },
    { g: G.sphereLo, c: '#5a4a22', m: 'paint', p: [x, 2.66, z - 0.08], s: 0.055 },
    { g: G.sphereLo, c: '#a9e6d0', m: 'paperLit', p: [x, 2.5, z - 0.08], s: 0.058 },
  ]
}

/** xe bánh mì: a glass-fronted cart under a striped parasol */
function cart(x: number, z: number): Part[] {
  const p: Part[] = [
    box(0.9, 0.5, 0.5, [x, 0.5, z], '#7d5650', 'paint'),
    box(0.94, 0.05, 0.54, [x, 0.77, z], '#bdb8ac', 'paint'),
    box(0.86, 0.34, 0.46, [x, 0.97, z], '#cfe6ee', 'glass'),
    box(0.94, 0.05, 0.54, [x, 1.16, z], '#7d5650', 'paint'),
    box(0.9, 0.2, 0.03, [x, 1.3, z - 0.24], '#a59a72', 'paint'),
    cyl(0.02, 2.0, [x + 0.3, 1.0, z + 0.2], '#8a8f98', 'gloss'),
  ]
  for (const sx of [-1, 1]) {
    p.push({ g: G.torus, c: '#2a2b30', m: 'wood', p: [x + sx * 0.32, 0.17, z + 0.27], s: [0.15, 0.15, 0.25] })
    p.push(box(0.05, 0.26, 0.05, [x + sx * 0.4, 0.13, z - 0.2], '#8a8f98', 'gloss'))
  }
  // parasol: eight gores, red and white
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2
    p.push({ g: new THREE.ConeGeometry(0.85, 0.3, 3, 1, true, a0, Math.PI / 4), c: k % 2 ? '#b9b6ae' : '#7d5650', m: 'paint', p: [x + 0.3, 2.02, z + 0.2] })
  }
  // loaves on top
  for (const dx of [-0.25, -0.05, 0.15]) p.push({ g: G.sphereLo, c: '#a8926a', m: 'toy', p: [x + dx, 0.84, z + 0.05], r: [0, 0.4, 0], s: [0.09, 0.04, 0.045] })
  return p
}

/** a motorbike on its stand, parked on the pavement */
function parkedBike(x: number, z: number, ry: number, color: string): Part[] {
  return bikeParts(color, false).map((q) => {
    const g = (q.g as THREE.BufferGeometry).clone()
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z))
    return { ...q, g }
  })
}

/** one motorbike facing +z, origin on the ground under its middle; `rider`: with someone on it */
function bikeParts(color: string, rider: boolean): Part[] {
  const bake = (g: THREE.BufferGeometry, m: THREE.Matrix4) => g.clone().applyMatrix4(m)
  const T = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))
  const p: Part[] = []
  // wheels
  for (const z of [-0.3, 0.3]) p.push({ g: bake(new THREE.TorusGeometry(0.13, 0.045, 6, 14), T(0, 0.175, z, 1, 1, 1, 0, Math.PI / 2, 0)), c: '#1f2024', m: 'toy' })
  // body: floorboard, front shield, seat hump, tail
  p.push({ g: bake(G.box, T(0, 0.22, 0, 0.16, 0.07, 0.5)), c: color, m: 'toy' })
  p.push({ g: bake(G.sphere, T(0, 0.38, 0.27, 0.11, 0.2, 0.08)), c: color, m: 'toy' })
  p.push({ g: bake(G.sphere, T(0, 0.36, -0.16, 0.12, 0.13, 0.26)), c: color, m: 'toy' })
  p.push({ g: bake(G.box, T(0, 0.47, -0.14, 0.17, 0.05, 0.36)), c: '#2a2b30', m: 'toy' })
  // handlebar and mirrors
  p.push({ g: bake(G.cylXs, T(0, 0.58, 0.25, 0.018, 0.34, 0.018, 0, 0, Math.PI / 2)), c: '#3a3d42', m: 'toy' })
  p.push({ g: bake(G.cylXs, T(0, 0.48, 0.26, 0.022, 0.22, 0.022, 0.2, 0, 0)), c: '#3a3d42', m: 'toy' })
  if (rider) {
    // someone riding it: no face, a helmet
    p.push({ g: bake(new THREE.CapsuleGeometry(0.13, 0.16, 4, 10), T(0, 0.7, -0.08, 1, 1, 1, 0.12, 0, 0)), c: '#ffffff', m: 'plaster' })
    p.push({ g: bake(G.sphere, T(0, 1.02, -0.03, 0.17, 0.165, 0.17)), c: '#ffffff', m: 'plaster' })
    p.push({ g: bake(G.sphere, T(0, 1.06, -0.035, 0.18, 0.13, 0.185)), c: '#d6dbe2', m: 'gloss' })
    for (const sx of [-1, 1]) {
      p.push({ g: bake(new THREE.CapsuleGeometry(0.04, 0.2, 3, 8), T(sx * 0.14, 0.7, 0.1, 1, 1, 1, 1.15, 0, 0)), c: '#ffffff', m: 'plaster' })
      p.push({ g: bake(new THREE.CapsuleGeometry(0.055, 0.16, 3, 8), T(sx * 0.11, 0.42, 0.04, 1, 1, 1, 1.0, 0, 0)), c: '#3a3f4a', m: 'toy' })
    }
  }
  return p
}

function propParts(): Part[] {
  const p: Part[] = []
  const xs = [-20.5, -11.5, -3.2, 5.6, 13.8, 21]
  xs.forEach((x, i) => p.push(...pole(x, 4.3, -1, i % 2 === 1)))
  p.push(...wires(xs, 4.3))
  p.push(...trafficLight(S.cross + 0.5, S.z1 + 0.25))
  p.push(...cart(-6.6, 4.05))
  p.push(...parkedBike(8.8, 4.15, 1.2, '#55647c'))
  p.push(...parkedBike(9.5, 4.2, 1.35, '#7a5650'))
  p.push(...parkedBike(-15.2, 4.15, 1.9, '#9a9da3'))
  // a bus stop sign on the campus side
  p.push(cyl(0.03, 2.1, [10.6, 1.05, 0.95], '#8a8f98', 'gloss'))
  p.push({ g: G.cyl, c: '#51627e', m: 'paint', p: [10.6, 2.05, 0.95], r: [Math.PI / 2, 0, 0], s: [0.2, 0.03, 0.2] })
  return p
}

// ── the crowd ──
interface Agent {
  /** 0 = pedestrian, 1 = motorbike */
  kind: 0 | 1
  x: number
  z: number
  dir: 1 | -1
  v0: number
  v: number
  phase: number
  s: number
}
const HALF = BOARD.maxX - 0.7
const MUTED = ['#7f8898', '#8e98a8', '#6f7a8c', '#9aa2ae', '#5f6b80', '#a8a49c', '#8a7f78', '#74808f']
// tired paint: the reds, blues and greens of the real thing with most of the colour gone
const BIKES = ['#74524e', '#4f5d74', '#9a9da3', '#2f3238', '#55685f', '#857a5c']
const HELMETS = ['#b5b2aa', '#6f5754', '#55627a', '#2a2c30']

function Crowd() {
  const sys = useMemo(() => {
    const r = rng(1975)
    const agents: Agent[] = []
    const lane = (kind: 0 | 1, z: number, dir: 1 | -1, n: number, v: number) => {
      for (let i = 0; i < n; i++) agents.push({ kind, x: -HALF + ((i + r() * 0.6) / n) * 2 * HALF, z: z + (r() - 0.5) * (kind ? 0.1 : 0.12), dir, v0: v * (0.8 + r() * 0.4), v: 0, phase: r() * 6.28, s: kind ? 0.92 + r() * 0.1 : 0.82 + r() * 0.2 })
    }
    lane(1, S.laneA, 1, 9, 3.0)
    lane(1, S.laneB, -1, 9, 3.0)
    lane(0, S.walkA - 0.12, 1, 8, 0.75)
    lane(0, S.walkA + 0.14, -1, 7, 0.7)
    lane(0, S.walkB + 0.14, -1, 8, 0.75)
    lane(0, S.walkB - 0.12, 1, 7, 0.7)
    const peds = agents.filter((a) => a.kind === 0)
    const bikes = agents.filter((a) => a.kind === 1)

    // a walker: no face, hands in pockets, head a little down
    const pedGeo = mergeKit([
      { g: G.sphere, c: '#ffffff', m: 'plaster', p: [0, 0.94, 0.02], s: [0.2, 0.19, 0.2] },
      { g: new THREE.CapsuleGeometry(0.15, 0.24, 4, 10), c: '#ffffff', m: 'plaster', p: [0, 0.52, 0] },
      { g: new THREE.CapsuleGeometry(0.06, 0.14, 3, 8), c: '#ffffff', m: 'plaster', p: [0.075, 0.16, 0] },
      { g: new THREE.CapsuleGeometry(0.06, 0.14, 3, 8), c: '#ffffff', m: 'plaster', p: [-0.075, 0.16, 0] },
    ]).get('plaster')!
    const ped = new THREE.InstancedMesh(pedGeo, kitMat('plaster'), peds.length)
    const bikeGeos = mergeKit(bikeParts('#ffffff', true))
    const bikeBody = new THREE.InstancedMesh(bikeGeos.get('toy')!, kitMat('toy'), bikes.length)
    const bikeRider = new THREE.InstancedMesh(bikeGeos.get('plaster')!, kitMat('plaster'), bikes.length)
    const bikeHelm = new THREE.InstancedMesh(bikeGeos.get('gloss')!, kitMat('gloss'), bikes.length)
    // headlights: unlit and bright, so they bloom after dark and under the grey sky
    const lampGeo = new THREE.SphereGeometry(0.055, 8, 6)
    lampGeo.scale(1, 1, 0.5)
    lampGeo.translate(0, 0.5, 0.36)
    const lampMat = new THREE.MeshBasicMaterial({ color: '#e6eeff', toneMapped: false })
    const bikeLamp = new THREE.InstancedMesh(lampGeo, lampMat, bikes.length)
    const c = new THREE.Color()
    peds.forEach((_, i) => ped.setColorAt(i, c.set(MUTED[Math.floor(r() * MUTED.length)])))
    bikes.forEach((_, i) => {
      bikeBody.setColorAt(i, c.set(BIKES[Math.floor(r() * BIKES.length)]))
      bikeRider.setColorAt(i, c.set(MUTED[Math.floor(r() * MUTED.length)]))
      bikeHelm.setColorAt(i, c.set(HELMETS[Math.floor(r() * HELMETS.length)]))
    })
    const meshes = [ped, bikeBody, bikeRider, bikeHelm, bikeLamp]
    for (const m of meshes) {
      m.frustumCulled = false
      // (only the walkers and the machines throw shadows: half the cost, and nobody misses the rest)
      m.castShadow = m === ped || m === bikeBody
      m.receiveShadow = m !== bikeLamp
    }
    return { agents, peds, bikes, ped, bikeBody, bikeRider, bikeHelm, bikeLamp, lampMat, meshes }
  }, [])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const luc = world.chars.luc.pos
    const onTheMove = world.chars.luc.path.length > 0
    const { agents } = sys
    for (const a of agents) {
      let target = a.v0
      // Give way to Lực. A lane holds for him while he is in it, or walking up to it; standing
      // on the refuge between the lanes he holds nobody up, and the traffic streams past both sides.
      const dz = Math.abs(luc.z - a.z)
      const his = dz < (a.kind ? 0.47 : 0.5) || (onTheMove && dz < (a.kind ? 1.05 : 0.9))
      if (his) {
        const ahead = (luc.x - a.x) * a.dir
        // whoever has not reached him yet waits a little way off; whoever is already passing hurries on
        if (ahead > (a.kind ? 0.75 : 0.5) && ahead < (a.kind ? 3.4 : 1.6)) target = 0
        else if (ahead > -0.6 && ahead <= (a.kind ? 0.75 : 0.5)) target = a.v0 * 1.7
      }
      // … and keep off whoever is in front, in the same lane and direction
      for (const b of agents) {
        if (b === a || b.dir !== a.dir || b.kind !== a.kind || Math.abs(b.z - a.z) > 0.2) continue
        const gap = (b.x - a.x) * a.dir
        if (gap > 0 && gap < (a.kind ? 1.3 : 0.7)) target = Math.min(target, b.v * 0.9)
      }
      a.v = THREE.MathUtils.damp(a.v, target, a.kind ? 7 : 8, dt)
      a.x += a.v * a.dir * dt
      if (a.x * a.dir > HALF) a.x = -HALF * a.dir
      a.phase += a.v * dt * (a.kind ? 0 : 9)
    }
    const put = (a: Agent) => {
      // they grow out of nothing at one edge of the board and shrink away at the other
      const edge = THREE.MathUtils.clamp((HALF - Math.abs(a.x)) / 1.6, 0, 1)
      const bob = a.kind ? 0 : Math.abs(Math.sin(a.phase)) * 0.035
      tmp.q.setFromEuler(tmp.e.set(0, a.dir > 0 ? Math.PI / 2 : -Math.PI / 2, a.kind ? 0 : Math.sin(a.phase) * 0.05))
      tmp.m.compose(tmp.p.set(a.x, bob, a.z), tmp.q, tmp.s.setScalar(a.s * edge))
      return tmp.m
    }
    sys.peds.forEach((a, i) => sys.ped.setMatrixAt(i, put(a)))
    sys.bikes.forEach((a, i) => {
      const m = put(a)
      sys.bikeBody.setMatrixAt(i, m)
      sys.bikeRider.setMatrixAt(i, m)
      sys.bikeHelm.setMatrixAt(i, m)
      sys.bikeLamp.setMatrixAt(i, m)
    })
    for (const m of sys.meshes) m.instanceMatrix.needsUpdate = true
    // headlights are on whenever the light is poor — a cold white, never warm
    const on = Math.max(grade.night, grade.lamp)
    sys.lampMat.color.setRGB(0.45 + 1.7 * on, 0.5 + 1.9 * on, 0.58 + 2.2 * on)
  })

  return (
    <>
      {sys.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}

/** where the wet shows: an alpha map of broad puddles and thinner sheen, tiling along the street */
function wetTex() {
  const [c, g] = canvas(512, 64)
  g.fillStyle = 'rgb(96,96,96)'
  g.fillRect(0, 0, 512, 64)
  const r = rng(31)
  for (let i = 0; i < 46; i++) {
    const x = r() * 512
    const y = r() * 64
    const rx = 14 + r() * 46
    const ry = 4 + r() * 12
    for (const dx of [-512, 0, 512]) {
      const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, rx)
      const v = r() < 0.6 ? 235 : 20
      grd.addColorStop(0, `rgba(${v},${v},${v},0.9)`)
      grd.addColorStop(1, `rgba(${v},${v},${v},0)`)
      g.save()
      g.translate(x + dx, y)
      g.scale(1, ry / rx)
      g.translate(-(x + dx), -y)
      g.fillStyle = grd
      g.fillRect(x + dx - rx, y - rx, rx * 2, rx * 2)
      g.restore()
    }
  }
  const t = toTexture(c, false, true)
  t.repeat.set(3, 1)
  return t
}

/** The street after rain: a dark, glossy film over the asphalt that catches the sky — and his lamp. */
function WetRoad() {
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#151a22', roughness: 0.05, metalness: 0, transparent: true, opacity: 0, alphaMap: wetTex(), depthWrite: false, envMapIntensity: 1.4 }), [])
  useFrame(() => {
    mat.opacity = 0.8 * grade.rain
    mesh.current.visible = grade.rain > 0.01
  })
  const w = BOARD.maxX - BOARD.minX - 0.6
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, 0.008, (S.z0 + S.z1) / 2]} material={mat} receiveShadow visible={false}>
      <planeGeometry args={[w, S.z1 - S.z0]} />
    </mesh>
  )
}

const rainVert = /* glsl */ `
  attribute vec2 aSeed;
  uniform float uTime;
  varying float vA;
  void main() {
    vec3 p = position;
    // each streak falls on its own clock and starts again at the top
    float fall = mod(aSeed.x * 9.0 - uTime * (6.5 + aSeed.y * 3.0), 9.0);
    p.y += fall;
    p.x += fall * 0.06;
    vA = smoothstep(0.0, 0.8, fall) * (0.5 + 0.5 * aSeed.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const rainFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vA;
  void main() {
    gl_FragColor = vec4(0.78, 0.83, 0.9, vA * uOpacity);
  }
`

/** Mưa bụi: a fine rain over the street, thin grey streaks. */
function Rain() {
  const lines = useMemo(() => {
    const r = rng(77)
    const N = 900
    const pos = new Float32Array(N * 6)
    const seed = new Float32Array(N * 4)
    for (let i = 0; i < N; i++) {
      const x = -15 + r() * 30
      const z = -4.5 + r() * 12
      const len = 0.16 + r() * 0.14
      pos.set([x, 0, z, x + len * 0.06, len, z], i * 6)
      const a = r()
      const b = r()
      seed.set([a, b, a, b], i * 4)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2))
    const m = new THREE.ShaderMaterial({ uniforms: { uTime, uOpacity: { value: 0 } }, vertexShader: rainVert, fragmentShader: rainFrag, transparent: true, depthWrite: false })
    const l = new THREE.LineSegments(g, m)
    l.frustumCulled = false
    l.renderOrder = 6
    return l
  }, [])
  useFrame(() => {
    const m = lines.material as THREE.ShaderMaterial
    m.uniforms.uOpacity.value = 0.42 * grade.rain
    lines.visible = grade.rain > 0.01
  })
  return <primitive object={lines} />
}

export function Street() {
  // the city is not there in chapter I
  const group = useRef<THREE.Group>(null!)
  useFrame(() => {
    group.current.visible = world.city
  })
  return (
    <group ref={group} visible={false}>
      <KitMesh build={propParts} />
      <Crowd />
      <WetRoad />
      <Rain />
    </group>
  )
}
