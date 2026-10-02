import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake, G, type Part } from '../lib/kit'
import { emit, world } from '../../state/world'
import { dragonHead, lyGirth, lyHide, lyLeg, lyTailTuft } from '../world/dragon'
import { DOANMON, NGOMON } from '../layout'

/*
 * Rồng vàng — the golden dragon.
 * In 1010 Lý Thái Tổ saw a golden dragon rise into the sky as his boat came
 * to the citadel, and named the new capital Thăng Long, "the dragon rises".
 * Here it rises from behind Đoan Môn when Lực reaches Hà Nội, winds once
 * about the gate pavilion and is gone into the sky; and when the golden list
 * hangs open at Huế it passes, once more, across the roofs of Ngọ Môn.
 *
 * It is a Lý dragon, whole: the leaf crest and the tusk, the mane, the scaled
 * hide and its belly plates, the low close fin, four slender legs with a tuft
 * at each elbow, the whip of a tail and its tuft — gold that gives its own
 * light, swimming along a path through the air.
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
/** its length, nose to tail, and its girth at the shoulders */
const LENGTH = 10.8
const R = 0.4
const SEG = 72
const RADIAL = 12
const FINS = 64
/** where the legs are, along the body (0 head ‥ 1 tail) */
const LEGS = [0.17, 0.5]
const Y = new THREE.Vector3(0, 1, 0)
const GOLD = '#ffc93c'
const BELLY = '#ffeeb0'
const MANE = '#f08c22'

/** kit parts merged into one vertex-coloured geometry */
function merged(parts: Part[]) {
  const baked = parts.map(bake)
  const g = mergeGeometries(baked, false)!
  baked.forEach((b) => b.dispose())
  return g
}
/** the frame the legs and the tail tuft are modelled in: x left, y up, z toward the tail; one unit = the girth there */
const UNIT = { P: new THREE.Vector3(), S: new THREE.Vector3(1, 0, 0), U: new THREE.Vector3(0, 1, 0), T: new THREE.Vector3(0, 0, 1) }

export function CloudDragon() {
  const group = useRef<THREE.Group>(null!)
  const sys = useMemo(() => {
    // gold that glows: lit by the scene a little, mostly its own light
    const mk = (vertexColors: boolean) => new THREE.MeshStandardMaterial({ vertexColors, color: '#ffffff', emissive: '#ff7a14', emissiveIntensity: 0.42, roughness: 0.7, transparent: true, opacity: 0, fog: false })
    const finMat = mk(false)
    const mat = mk(true)
    // the hide: scale by scale, deeper gold toward the tail; moved every frame as the body swims
    const hide = lyHide(SEG, RADIAL, GOLD, BELLY, '#f08a1c')
    const body = new THREE.Mesh(hide.g, mat)
    const fin = new THREE.InstancedMesh(G.coneLo.clone(), finMat, FINS)
    const c = new THREE.Color()
    for (let i = 0; i < FINS; i++) fin.setColorAt(i, c.set(i % 2 ? '#e8791f' : '#f6a43a'))
    const head = new THREE.Mesh(merged(dragonHead(new THREE.Matrix4(), 'ly', { body: GOLD, belly: BELLY, mane: MANE, horn: '#fff0c4' }, 'toy', 'toy', true, true)), mat)
    const legGeo = merged([-1, 1].flatMap((side) => lyLeg(UNIT, 1, side, { body: GOLD, mane: MANE, claw: '#fff6e0' }, 'toy', 'toy', true)))
    const legs = LEGS.map(() => new THREE.Mesh(legGeo, mat))
    const tuft = new THREE.Mesh(merged(lyTailTuft(UNIT, 1, MANE, 'toy', true)), mat)
    const all = [body, fin, head, tuft, ...legs]
    for (const m of all) {
      m.frustumCulled = false
      m.renderOrder = 4
    }
    for (const m of [head, tuft, ...legs]) m.matrixAutoUpdate = false
    return { hide, body, fin, head, legs, tuft, finMat, mat, all }
  }, [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), s: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), zero: new THREE.Matrix4().makeScale(0, 0, 0), acc: 0 }), [])

  useFrame((_, rawDt) => {
    const d = world.dragon
    const on = d.k >= 0
    group.current.visible = on
    if (!on) return
    const curve = ROUTES[d.route]
    const len = curve.getLength()
    const bodyLen = LENGTH / len
    // the head runs from the start of the path to beyond its end, so the whole body passes
    const uh = d.k * (1 + bodyLen)
    const time = world.time
    // it comes out of nothing and goes back into it
    const fade = THREE.MathUtils.smoothstep(d.k, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(d.k, 0.86, 1))
    sys.finMat.opacity = sys.mat.opacity = fade
    /**
     * the body at `t` along it (0 head ‥ 1 tail): tmp.p its centre, tmp.t the way it is going there,
     * tmp.u its back, tmp.s its left. False where that part has not come out of the path's start
     * yet, or has already gone past its end.
     */
    const frameAt = (t: number) => {
      const u = uh - (0.03 + t) * bodyLen
      const uc = Math.min(0.999, Math.max(0.001, u))
      curve.getPointAt(uc, tmp.p)
      curve.getTangentAt(uc, tmp.t)
      tmp.u.copy(Y).addScaledVector(tmp.t, -tmp.t.y).normalize()
      tmp.s.crossVectors(tmp.u, tmp.t).normalize()
      // the body swims: a wave runs down it from head to tail
      const w = t * 19 - time * 3.2
      const amp = 0.34 * Math.min(1, t * 7.5)
      tmp.p.addScaledVector(tmp.s, Math.sin(w) * amp).addScaledVector(tmp.u, Math.cos(w * 0.8) * amp * 0.45)
      return u > 0 && u < 1
    }
    /** a part modelled in the UNIT frame, set on the body at `t`, `k` units to the girth */
    const mount = (mesh: THREE.Mesh, t: number, k: number) => {
      mesh.visible = frameAt(t)
      // (x: the body's left looking from above with the tail ahead, which is −s; z: toward the tail, −t)
      mesh.matrix.makeBasis(tmp.x.copy(tmp.s).multiplyScalar(-k), tmp.y.copy(tmp.u).multiplyScalar(k), tmp.z.copy(tmp.t).multiplyScalar(-k)).setPosition(tmp.p)
    }

    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG
      const there = frameAt(t)
      sys.hide.set(i, tmp.p, tmp.u, tmp.x.copy(tmp.s).negate(), there ? R * lyGirth(t) : 0)
    }
    sys.hide.commit()

    // the fin: small close flames all the way down the back, long as a mane on the neck
    for (let i = 0; i < FINS; i++) {
      const t = 0.05 + (i / FINS) * 0.94
      if (!frameAt(t)) {
        sys.fin.setMatrixAt(i, tmp.zero)
        continue
      }
      const rr = R * lyGirth(t)
      const h = (0.62 * rr + 0.1 * R) * (i % 2 ? 0.72 : 1) * (1 + 1.5 * Math.max(0, 1 - t / 0.24))
      tmp.y.copy(tmp.u).multiplyScalar(0.62).addScaledVector(tmp.t, -0.78).normalize()
      tmp.z.copy(tmp.s)
      tmp.x.crossVectors(tmp.y, tmp.z)
      tmp.p.addScaledVector(tmp.u, rr * 0.82).addScaledVector(tmp.y, h / 2)
      tmp.m.makeBasis(tmp.x.multiplyScalar(0.34 * rr + 0.06 * R), tmp.y.multiplyScalar(h), tmp.z.multiplyScalar(rr * 0.12 + 0.01 * R)).setPosition(tmp.p)
      sys.fin.setMatrixAt(i, tmp.m)
    }
    sys.fin.instanceMatrix.needsUpdate = true

    LEGS.forEach((t, i) => mount(sys.legs[i], t, R * lyGirth(t) * (t > 0.4 ? 1.15 : 1) * 0.9))
    mount(sys.tuft, 0.985, R)

    // the head, facing the way it flies
    sys.head.visible = uh > 0.001 && uh < 1
    const u0 = Math.min(0.999, Math.max(0.001, uh))
    curve.getPointAt(u0, tmp.p)
    curve.getTangentAt(u0, tmp.t)
    tmp.u.copy(Y).addScaledVector(tmp.t, -tmp.t.y).normalize()
    const h = R * 1.6
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
      {sys.all.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}
