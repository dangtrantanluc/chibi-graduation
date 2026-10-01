import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { emit, world } from '../../state/world'
import { diplomaTex } from '../characters/garments'

/**
 * Lực's diploma, made in the manner of a sớ: warm yellow paper in a
 * red double border, 文憑 / 畢業 in red columns at the ends, rolled on two
 * lacquered rods with gold caps. He holds a rod in each hand; as his hands
 * part the paper unrolls from the middle outward, then it glows and sheds
 * golden motes.
 */
const PH = 0.21 // paper height
const FULL = PH * (1024 / 400) // paper width when fully open

export function Diploma({ handL, handR }: { handL: RefObject<THREE.Group | null>; handR: RefObject<THREE.Group | null> }) {
  const group = useRef<THREE.Group>(null!)
  const paper = useRef<THREE.Mesh>(null!)
  const rodL = useRef<THREE.Group>(null!)
  const rodR = useRef<THREE.Group>(null!)
  const { mat, geo } = useMemo(() => {
    const map = diplomaTex()
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#fff0c0', emissiveIntensity: 0.15, roughness: 0.85, side: THREE.DoubleSide })
    const geo = new THREE.PlaneGeometry(1, PH, 12, 1)
    return { mat, geo }
  }, [])
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(), m: new THREE.Matrix4(), acc: 0, show: 0 }), [])

  useFrame((_, dt) => {
    const luc = world.chars.luc
    const on = luc.action === 'present'
    tmp.show = THREE.MathUtils.damp(tmp.show, on ? 1 : 0, 9, dt)
    group.current.visible = tmp.show > 0.02
    if (!group.current.visible || !handL.current || !handR.current) return
    handL.current.getWorldPosition(tmp.a)
    handR.current.getWorldPosition(tmp.b)
    tmp.x.subVectors(tmp.a, tmp.b).setY(0)
    const span = tmp.x.length()
    tmp.x.normalize()
    tmp.y.set(0, 1, 0)
    tmp.z.crossVectors(tmp.x, tmp.y).normalize()
    tmp.m.makeBasis(tmp.x, tmp.y, tmp.z)
    group.current.position.copy(tmp.a).add(tmp.b).multiplyScalar(0.5).addScaledVector(tmp.z, 0.05)
    group.current.position.y += 0.03
    group.current.quaternion.setFromRotationMatrix(tmp.m)
    group.current.rotateX(-0.12)
    group.current.scale.setScalar(tmp.show)

    // the paper spans the hands; its UV window opens from the centre
    const w = THREE.MathUtils.clamp(span - 0.02, 0.02, FULL)
    paper.current.scale.set(w, 1, 1)
    const k = w / FULL
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      const u0 = (geo.attributes.position as THREE.BufferAttribute).getX(i) + 0.5
      uv.setX(i, 0.5 + (u0 - 0.5) * k)
    }
    uv.needsUpdate = true
    // the paper bows a touch between the rods
    rodL.current.position.set(w / 2 + 0.012, 0, 0)
    rodR.current.position.set(-w / 2 - 0.012, 0, 0)
    // rods stay fat while most of the paper is still wound on them
    const wound = 1 + 1.6 * (1 - world.diploma)
    rodL.current.scale.set(wound, 1, wound)
    rodR.current.scale.set(wound, 1, wound)
    mat.emissiveIntensity = 0.15 + 0.9 * THREE.MathUtils.smoothstep(world.diploma, 0.6, 1)

    if (world.diploma > 0.7) {
      tmp.acc += dt * 10
      while (tmp.acc > 1) {
        tmp.acc -= 1
        const p = group.current.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * w, 0.14 + Math.random() * 0.08, (Math.random() - 0.5) * 0.1))
        emit({ type: 'sparkle', pos: p, count: 1, color: Math.random() < 0.7 ? '#ffd98a' : '#fff4d6' })
      }
    }
  })

  const rod = (
    <>
      <mesh castShadow>
        <cylinderGeometry args={[0.016, 0.016, PH + 0.05, 10]} />
        <meshStandardMaterial color="#9a2a22" roughness={0.35} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position-y={s * (PH / 2 + 0.035)}>
          <cylinderGeometry args={[0.022, 0.018, 0.024, 10]} />
          <meshStandardMaterial color="#e1b04a" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </>
  )
  return (
    <group ref={group} visible={false}>
      <mesh ref={paper} geometry={geo} material={mat} />
      <group ref={rodL}>{rod}</group>
      <group ref={rodR}>{rod}</group>
    </group>
  )
}
