import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { world } from '../../state/world'
import { grade } from '../grade'

/*
 * Chim Lạc — the long-beaked, long-crested bird of the Đông Sơn bronze drums,
 * the oldest emblem of the Việt. On the drum they fly in a ring, counter-
 * clockwise, round the sun. Here a small flight of them wheels the same way,
 * high over whichever scene the story is in (world.birds says where).
 * Each is a flat bronze-gold silhouette, as on the drum, with two beating wings.
 */

const N = 8

/** the bird in profile, flying toward +x */
function bodyShape() {
  const s = new THREE.Shape()
  const pts: [number, number][] = [
    [1.08, 0.1], // the tip of the long beak
    [0.56, 0.2],
    [0.46, 0.3],
    [0.02, 0.66], // the crest, swept back
    [0.3, 0.3],
    [0.18, 0.2],
    [-0.28, 0.13],
    [-1.18, 0.17], // the long tail
    [-1.34, 0.02],
    [-1.12, -0.06],
    [-0.3, -0.08],
    [0.14, -0.15],
    [0.42, -0.03],
    [0.5, 0.05],
    [0.6, 0.07],
  ]
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  // the round eye of the drum birds
  const eye = new THREE.Path()
  eye.absarc(0.44, 0.19, 0.045, 0, Math.PI * 2, true)
  s.holes.push(eye)
  return s
}
/** one wing, hinged along x, reaching out along +y, its trailing edge cut into feathers */
function wingShape() {
  const s = new THREE.Shape()
  const pts: [number, number][] = [
    [0.3, 0],
    [-0.12, 1.0],
    [-0.36, 0.74],
    [-0.3, 0.58],
    [-0.52, 0.48],
    [-0.42, 0.32],
    [-0.58, 0.18],
    [-0.38, 0],
  ]
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

const DAY = new THREE.Color('#b97f24')
const NIGHT = new THREE.Color('#ffd98a')

export function LacBirds() {
  const sys = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: '#b97f24', side: THREE.DoubleSide, transparent: true, opacity: 0, fog: false })
    const body = new THREE.InstancedMesh(new THREE.ShapeGeometry(bodyShape(), 4), mat, N)
    // wings lie flat (x forward, z outward) and beat about the body's axis
    const wg = new THREE.ShapeGeometry(wingShape(), 1)
    wg.rotateX(Math.PI / 2)
    const wing = new THREE.InstancedMesh(wg, mat, N * 2)
    for (const m of [body, wing]) {
      m.frustumCulled = false
      m.renderOrder = 3
    }
    return { mat, body, wing, c: { x: 0, y: 6, z: 4, r: 5 } }
  }, [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), w: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const b = world.birds
    const c = sys.c
    // the ring drifts to wherever the story has gone
    c.x = THREE.MathUtils.damp(c.x, b.x, 0.9, dt)
    c.y = THREE.MathUtils.damp(c.y, b.y, 0.9, dt)
    c.z = THREE.MathUtils.damp(c.z, b.z, 0.9, dt)
    c.r = THREE.MathUtils.damp(c.r, b.r, 0.9, dt)
    // they keep out of the rain
    sys.mat.opacity = THREE.MathUtils.damp(sys.mat.opacity, b.on * (1 - grade.rain), 2, dt)
    const on = sys.mat.opacity > 0.01
    sys.body.visible = sys.wing.visible = on
    if (!on) return
    sys.mat.color.lerpColors(DAY, NIGHT, grade.night)
    const t = world.time
    for (let i = 0; i < N; i++) {
      // counter-clockwise, seen from above
      const a = (i / N) * Math.PI * 2 - t * 0.2 + Math.sin(i * 2.4) * 0.12
      const r = c.r * (1 + 0.1 * Math.sin(i * 1.7 + t * 0.13))
      const size = 0.42 + 0.06 * Math.sin(i * 3.1)
      tmp.p.set(c.x + Math.cos(a) * r, c.y + Math.sin(t * 0.6 + i * 1.3) * 0.35 + (i % 3) * 0.3, c.z + Math.sin(a) * r)
      // heading: the tangent of the ring (the model flies toward +x)
      tmp.q.setFromEuler(tmp.e.set(0, a + Math.PI / 2, 0.12 * Math.sin(t * 0.7 + i)))
      tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(size))
      sys.body.setMatrixAt(i, tmp.m)
      const flap = Math.sin(t * 5.2 + i * 1.9) * 0.75 + 0.15
      for (const side of [0, 1]) {
        tmp.w.makeRotationX(side ? Math.PI - flap : flap)
        tmp.w.premultiply(tmp.m)
        sys.wing.setMatrixAt(i * 2 + side, tmp.w)
      }
    }
    sys.body.instanceMatrix.needsUpdate = true
    sys.wing.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <primitive object={sys.body} />
      <primitive object={sys.wing} />
    </>
  )
}
