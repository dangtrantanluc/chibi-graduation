import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { on, world } from '../../state/world'
import { rng } from '../lib/kit'
import { TREES } from '../world/placements'
import { patchMaterial } from '../lib/materials'

/**
 * Fallen leaves that tumble across the ground, get blown up by gusts (the
 * camera walking past, the North–South express, a friend's high-five) and
 * settle again — plus blossoms and leaves drifting down from the trees:
 * scarlet phượng petals on campus, gold in Hà Nội, yellow mai in Huế.
 */
interface Zone {
  x0: number
  x1: number
  z0: number
  z1: number
  n: number
  cols: string[]
}
const GOLD = ['#f2c230', '#e8963a', '#f6d45a', '#e0a02a', '#d9772a']
const ZONES: Zone[] = [
  { x0: -3.5, x1: 3.5, z0: 6, z1: 12.8, n: 22, cols: ['#b89a5a', '#8faa5e', '#c9a86a'] },
  { x0: -2.4, x1: 6.8, z0: -9.2, z1: -2.8, n: 34, cols: ['#e2413a', '#f06a4a', '#ff8a3a', '#7fb24a'] },
  { x0: -6.2, x1: 6.2, z0: -26.2, z1: -15, n: 90, cols: GOLD },
  { x0: -2.4, x1: 2.4, z0: -38, z1: -29.2, n: 18, cols: ['#8faa5e', '#c9b25a', '#6f9a4a'] },
  { x0: -5.5, x1: 5.5, z0: -48.4, z1: -40.6, n: 22, cols: ['#f2c230', '#ffd36e', '#e8963a'] },
]
const N_LEAF = ZONES.reduce((a, z) => a + z.n, 0)
const N_PETAL = 110
const SHEDS: Record<string, string[]> = {
  autumn: GOLD,
  phuong: ['#e2413a', '#f06a4a', '#ff7a3a'],
  mai: ['#ffd42a', '#f6c52a'],
  hoasua: ['#f4f1d8', '#e2e8b8'],
}
const N = N_LEAF + N_PETAL
const WIND = new THREE.Vector2(0.55, -0.25).normalize()

export function Leaves() {
  const { mesh, sim } = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, -0.07)
    shape.quadraticCurveTo(0.055, -0.02, 0, 0.07)
    shape.quadraticCurveTo(-0.055, -0.02, 0, -0.07)
    const geo = new THREE.ShapeGeometry(shape, 4)
    geo.rotateX(-Math.PI / 2)
    const mat = patchMaterial(
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }),
      { rim: { color: '#ffe0b0', strength: 0.25 } },
      'leaf',
    )
    const mesh = new THREE.InstancedMesh(geo, mat, N)
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    const r = rng(17)
    const c = new THREE.Color()
    // Hà Nội's golden trees shed the most
    const blossoms = TREES.filter((t) => t.kind in SHEDS).flatMap((t) => (t.kind === 'autumn' ? [t, t, t] : [t]))
    const sim = Array.from({ length: N }, (_, i) => {
      const petal = i >= N_LEAF
      let zi = 0
      if (!petal) {
        let acc = 0
        for (let k = 0; k < ZONES.length; k++) {
          acc += ZONES[k].n
          if (i < acc) {
            zi = k
            break
          }
        }
      }
      const z = ZONES[zi]
      const tree = blossoms[i % blossoms.length]
      const p = petal
        ? new THREE.Vector3(tree.x + (r() - 0.5) * 2.5, 2 + r() * 2, tree.z + (r() - 0.5) * 2.5)
        : new THREE.Vector3(z.x0 + r() * (z.x1 - z.x0), 0.02, z.z0 + r() * (z.z1 - z.z0))
      const pal = petal ? SHEDS[tree.kind] : z.cols
      mesh.setColorAt(i, c.set(pal[Math.floor(r() * pal.length)]))
      return {
        p,
        v: new THREE.Vector3(),
        rot: new THREE.Euler(r() * 0.3, r() * 6.28, r() * 0.3),
        spin: new THREE.Vector3(),
        air: petal,
        petal,
        zone: zi,
        tree: i % Math.max(1, blossoms.length),
        s: petal ? 0.55 + r() * 0.3 : 0.8 + r() * 0.6,
        seed: r() * 100,
        rest: 0,
      }
    })
    return { mesh, sim }
  }, [])

  useEffect(
    () =>
      on((e) => {
        if (e.type !== 'gust') return
        for (const s of sim) {
          const dx = s.p.x - e.x
          const dz = s.p.z - e.z
          const d = Math.hypot(dx, dz)
          if (d > e.radius) continue
          const f = e.strength * (1 - d / e.radius) * (0.6 + Math.random() * 0.8)
          const nx = d > 0.01 ? dx / d : Math.random() - 0.5
          const nz = d > 0.01 ? dz / d : Math.random() - 0.5
          s.v.x += nx * f * 1.6 + (Math.random() - 0.5) * f
          s.v.z += nz * f * 1.6 + (Math.random() - 0.5) * f
          s.v.y += f * (1.2 + Math.random() * 1.4)
          s.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)
          s.air = true
        }
      }),
    [sim],
  )

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), sv: new THREE.Vector3() }), [])
  const sources = useMemo(() => TREES.filter((t) => t.kind in SHEDS).flatMap((t) => (t.kind === 'autumn' ? [t, t, t] : [t])), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const t = world.time
    for (let i = 0; i < N; i++) {
      const s = sim[i]
      if (s.air) {
        s.v.y -= (s.petal ? 0.9 : 2.2) * dt
        s.v.multiplyScalar(Math.exp(-(s.petal ? 1.6 : 1.1) * dt))
        const flutter = Math.sin(t * 3 + s.seed) * 0.35
        s.p.x += (s.v.x + WIND.x * 0.25 + flutter * 0.4) * dt
        s.p.z += (s.v.z + WIND.y * 0.25) * dt
        s.p.y += s.v.y * dt
        s.rot.x += (s.spin.x + flutter) * dt
        s.rot.y += s.spin.y * dt
        s.rot.z += (s.spin.z + Math.cos(t * 2.3 + s.seed)) * dt
        if (s.p.y <= 0.02) {
          s.p.y = 0.02
          s.air = false
          s.v.set(0, 0, 0)
          s.spin.set(0, 0, 0)
          s.rot.x = (Math.random() - 0.5) * 0.3
          s.rot.z = (Math.random() - 0.5) * 0.3
          s.rest = 0
        }
      } else {
        s.rest += dt
        // leaves tumble across the floor in little wind hops
        const g = Math.max(0, Math.sin(t * 0.45 + s.seed * 0.05) - 0.55) * 2.2
        if (!s.petal) {
          s.p.x += WIND.x * g * 0.22 * dt
          s.p.z += WIND.y * g * 0.22 * dt
          s.rot.y += g * 0.8 * dt * Math.sin(s.seed)
          if (g > 0.6 && Math.random() < dt * 0.5) {
            s.v.set(WIND.x * 0.6, 0.6 + Math.random() * 0.4, WIND.y * 0.6)
            s.spin.set(Math.random() * 4, Math.random() * 4, Math.random() * 4)
            s.air = true
          }
          const z = ZONES[s.zone]
          if (s.p.x > z.x1) s.p.x = z.x0
          if (s.p.x < z.x0) s.p.x = z.x1
          if (s.p.z > z.z1) s.p.z = z.z0
          if (s.p.z < z.z0) s.p.z = z.z1
        } else if (s.rest > 6 + (s.seed % 6)) {
          // petal respawns up in its tree
          const tr = sources[s.tree]
          if (tr) s.p.set(tr.x + (Math.random() - 0.5) * 2.4 * tr.s, 2.6 * tr.s + Math.random() * 1.2, tr.z + (Math.random() - 0.5) * 2.4 * tr.s)
          s.v.set(0, 0, 0)
          s.air = true
        }
      }
      tmp.q.setFromEuler(s.rot)
      tmp.m.compose(s.p, tmp.q, tmp.sv.setScalar(s.s))
      mesh.setMatrixAt(i, tmp.m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}
