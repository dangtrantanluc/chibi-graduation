import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake, blob, G } from '../lib/kit'
import { emit, world } from '../../state/world'
import { dragonHead } from '../world/dragon'
import { DOANMON, NGOMON } from '../layout'

/*
 * Rồng vàng — the golden dragon.
 * In 1010 Lý Thái Tổ saw a golden dragon rise into the sky as his boat came
 * to the citadel, and named the new capital Thăng Long, "the dragon rises".
 * Here it rises from behind Đoan Môn when Lực reaches Hà Nội, winds once
 * about the gate pavilion and is gone into the sky; and when the golden list
 * hangs open at Huế it passes, once more, across the roofs of Ngọ Môn.
 *
 * It is a Lý dragon (slender, a flame crest, a long mane, a pearl) made of
 * light and cloud: a chain of glowing puffs following a path, the head at the
 * front, flame fins along the back.
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const DZ = DOANMON.z
const NZ = NGOMON.z
const ROUTES = [
  // 0 · Thăng Long: up from behind the gate, once round its pavilion, and away into the sky
  new THREE.CatmullRomCurve3(
    [V(5.2, 0.8, DZ - 4.2), V(3.4, 3.6, DZ - 3.0), V(0.2, 5.4, DZ - 2.2), V(-3.2, 5.8, DZ - 0.4), V(-2.4, 6.2, DZ + 2.2), V(1.6, 6.6, DZ + 2.4), V(3.4, 7.4, DZ - 0.2), V(0.8, 8.6, DZ - 2.6), V(-2.6, 10.2, DZ - 1.2), V(-3.6, 12.6, DZ - 4.2), V(-6.5, 16.5, DZ - 9.5)],
    false,
    'centripetal',
  ),
  // 1 · Huế: in from the left behind the wall, across the front of Lầu Ngũ Phụng, and up over the far wing
  new THREE.CatmullRomCurve3([V(-12, 2.2, NZ - 3.6), V(-8.6, 4.2, NZ + 0.4), V(-4.4, 5.2, NZ + 2.2), V(0, 5.5, NZ + 2.4), V(4.4, 5.2, NZ + 2.1), V(8.0, 6.4, NZ + 0.2), V(10.5, 9.6, NZ - 4), V(13, 14.5, NZ - 9)], false, 'centripetal'),
]
const N = 46
const SPACING = 0.235
const R = 0.4
const Y = new THREE.Vector3(0, 1, 0)

export function CloudDragon() {
  const group = useRef<THREE.Group>(null!)
  const sys = useMemo(() => {
    // gold that glows: lit by the scene a little, mostly its own light
    const mk = (vertexColors: boolean) => new THREE.MeshStandardMaterial({ vertexColors, color: '#ffffff', emissive: '#ff7a14', emissiveIntensity: 0.42, roughness: 0.7, transparent: true, opacity: 0, fog: false })
    const bodyMat = mk(false)
    const headMat = mk(true)
    const body = new THREE.InstancedMesh(blob(1010, 1, 0.16), bodyMat, N)
    const finGeo = G.coneLo.clone()
    const fin = new THREE.InstancedMesh(finGeo, bodyMat, N)
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) {
      // paler along the belly end of the gradient, deeper gold toward the tail
      // (alternate puffs a shade apart, so the body reads as rows of scales)
      body.setColorAt(i, c.set('#ffc93c').lerp(new THREE.Color('#f08a1c'), i / N).multiplyScalar(i % 2 ? 0.86 : 1))
      fin.setColorAt(i, c.set(i % 2 ? '#d8402a' : '#ee6a2a'))
    }
    const parts = dragonHead(new THREE.Matrix4(), 'ly', { body: '#ffc93c', belly: '#ffeeb0', mane: '#d8402a', horn: '#fff0c4' }, 'toy', 'toy', true, true)
    const baked = parts.map(bake)
    const headGeo = mergeGeometries(baked, false)!
    baked.forEach((g) => g.dispose())
    const head = new THREE.Mesh(headGeo, headMat)
    for (const m of [body, fin, head]) {
      m.frustumCulled = false
      m.renderOrder = 4
    }
    return { body, fin, head, bodyMat, headMat }
  }, [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), s: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), zero: new THREE.Matrix4().makeScale(0, 0, 0), acc: 0 }), [])

  useFrame((_, rawDt) => {
    const d = world.dragon
    const on = d.k >= 0
    group.current.visible = on
    if (!on) return
    const curve = ROUTES[d.route]
    const len = curve.getLength()
    const bodyLen = (N * SPACING) / len
    // the head runs from the start of the path to beyond its end, so the whole body passes
    const uh = d.k * (1 + bodyLen)
    const time = world.time
    // it comes out of nothing and goes back into it
    const fade = THREE.MathUtils.smoothstep(d.k, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(d.k, 0.86, 1))
    sys.bodyMat.opacity = sys.headMat.opacity = fade
    const frameAt = (u: number, i: number) => {
      curve.getPointAt(u, tmp.p)
      curve.getTangentAt(u, tmp.t)
      tmp.u.copy(Y).addScaledVector(tmp.t, -tmp.t.y).normalize()
      tmp.s.crossVectors(tmp.u, tmp.t).normalize()
      // the body swims: a wave runs down it from head to tail
      const w = i * 0.42 - time * 3.2
      const amp = 0.34 * Math.min(1, i / 6)
      tmp.p.addScaledVector(tmp.s, Math.sin(w) * amp).addScaledVector(tmp.u, Math.cos(w * 0.8) * amp * 0.45)
    }
    for (let i = 0; i < N; i++) {
      const u = uh - (i + 1.2) * (SPACING / len)
      if (u <= 0 || u >= 1) {
        sys.body.setMatrixAt(i, tmp.zero)
        sys.fin.setMatrixAt(i, tmp.zero)
        continue
      }
      frameAt(u, i)
      const t = i / (N - 1)
      const r = R * (0.72 + 0.28 * Math.min(1, i / 5)) * (t < 0.25 ? 1 : THREE.MathUtils.lerp(1, 0.14, Math.pow((t - 0.25) / 0.75, 1.1)))
      // puffs: longer along the body than across it
      tmp.m.makeBasis(tmp.x.copy(tmp.s).multiplyScalar(r), tmp.y.copy(tmp.u).multiplyScalar(r), tmp.z.copy(tmp.t).multiplyScalar(r * 1.25)).setPosition(tmp.p)
      sys.body.setMatrixAt(i, tmp.m)
      // a flame fin on its back, leaning toward the tail
      tmp.y.copy(tmp.u).multiplyScalar(0.8).addScaledVector(tmp.t, -0.6).normalize()
      tmp.z.copy(tmp.s)
      tmp.x.crossVectors(tmp.y, tmp.z)
      const fh = r * (i % 2 ? 0.9 : 1.25)
      tmp.p.addScaledVector(tmp.u, r * 0.75).addScaledVector(tmp.y, fh / 2)
      tmp.m.makeBasis(tmp.x.multiplyScalar(r * 0.42), tmp.y.multiplyScalar(fh), tmp.z.multiplyScalar(r * 0.1)).setPosition(tmp.p)
      sys.fin.setMatrixAt(i, tmp.m)
    }
    sys.body.instanceMatrix.needsUpdate = true
    sys.fin.instanceMatrix.needsUpdate = true
    // the head, facing the way it flies
    const u0 = Math.min(0.999, Math.max(0.001, uh))
    sys.head.visible = uh > 0.001 && uh < 1
    frameAt(u0, 0)
    const h = R * 1.55
    tmp.x.crossVectors(tmp.u, tmp.t).normalize()
    tmp.m.makeBasis(tmp.x.multiplyScalar(h), tmp.y.copy(tmp.u).multiplyScalar(h), tmp.z.copy(tmp.t).multiplyScalar(h)).setPosition(tmp.p)
    sys.head.matrix.copy(tmp.m)
    world.dragonPos.copy(tmp.p)
    // motes of gold fall from it as it goes
    tmp.acc += Math.min(rawDt, 0.1) * 16 * fade
    while (tmp.acc > 1) {
      tmp.acc -= 1
      const u = uh - Math.random() * bodyLen
      if (u <= 0 || u >= 1) continue
      curve.getPointAt(u, tmp.p)
      emit({ type: 'sparkle', pos: tmp.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.9)), count: 1, color: Math.random() < 0.6 ? '#ffd98a' : '#fff4d6' })
    }
  })

  return (
    <group ref={group} visible={false}>
      <primitive object={sys.body} />
      <primitive object={sys.fin} />
      <primitive object={sys.head} matrixAutoUpdate={false} />
    </group>
  )
}
