import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { emit, world } from '../../state/world'
import { canvas, FONT_CJK, roundRect, toTexture } from '../lib/textures'

/**
 * A lacquered sutra (kinh) held in both hands. Closed, it shows its red-and-
 * gold cover; as it opens toward the guest, loose leaves fan out between the
 * boards and two pages written in gold begin to glow, releasing golden motes.
 */
const PW = 0.2
const PH = 0.27
const CHARS = '福壽康寧吉祥如意平安喜樂金玉滿堂心誠光明'

function pagesTexture() {
  const [c, g] = canvas(512, 352)
  const grd = g.createLinearGradient(0, 0, 512, 0)
  grd.addColorStop(0, '#efdfbd')
  grd.addColorStop(0.48, '#fbf3e1')
  grd.addColorStop(0.5, '#d9c69c')
  grd.addColorStop(0.52, '#fbf3e1')
  grd.addColorStop(1, '#efdfbd')
  g.fillStyle = grd
  g.fillRect(0, 0, 512, 352)
  for (const x0 of [0, 256]) {
    g.strokeStyle = '#b8412f'
    g.lineWidth = 4
    g.strokeRect(x0 + 14, 14, 228, 324)
    g.strokeStyle = 'rgba(200,150,60,0.9)'
    g.lineWidth = 1.5
    g.strokeRect(x0 + 22, 22, 212, 308)
    g.fillStyle = '#b8861f'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `40px ${FONT_CJK}`
    for (let col = 0; col < 3; col++)
      for (let row = 0; row < 5; row++) g.fillText(CHARS[(x0 / 16 + col * 5 + row) % CHARS.length], x0 + 196 - col * 68, 60 + row * 58)
  }
  g.fillStyle = '#c8342b'
  roundRect(g, 290, 290, 36, 36, 6)
  g.fill()
  return toTexture(c)
}

function coverTexture() {
  const [c, g] = canvas(256, 352)
  g.fillStyle = '#8e1f1c'
  g.fillRect(0, 0, 256, 352)
  g.strokeStyle = '#e8c267'
  g.lineWidth = 8
  g.strokeRect(10, 10, 236, 332)
  g.lineWidth = 2
  g.strokeRect(22, 22, 212, 308)
  for (const [x, y] of [
    [34, 34],
    [222, 34],
    [34, 318],
    [222, 318],
  ]) {
    g.fillStyle = '#e8c267'
    g.beginPath()
    g.arc(x, y, 8, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#e8c267'
  roundRect(g, 88, 70, 80, 212, 10)
  g.fill()
  g.fillStyle = '#8e1f1c'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `64px ${FONT_CJK}`
  g.fillText('金', 128, 130)
  g.fillText('經', 128, 220)
  return toTexture(c)
}

function half(left: boolean) {
  const g = new THREE.PlaneGeometry(PW, PH)
  g.translate(left ? -PW / 2 : PW / 2, 0, 0)
  const uv = g.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setX(k, (left ? 0 : 0.5) + uv.getX(k) * 0.5)
  return g
}

export function SutraBook({ handL, handR }: { handL: RefObject<THREE.Group | null>; handR: RefObject<THREE.Group | null> }) {
  const group = useRef<THREE.Group>(null!)
  const leftBoard = useRef<THREE.Group>(null!)
  const leaves = useRef<THREE.Mesh[]>([])
  const { pageMat, coverMat, leafMat, geoL, geoR, leafGeo, coverGeoL, coverGeoR } = useMemo(() => {
    const map = pagesTexture()
    const pageMat = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffe2a0', emissiveIntensity: 0.2, roughness: 0.85 })
    const coverMat = new THREE.MeshStandardMaterial({ map: coverTexture(), roughness: 0.28, metalness: 0.2 })
    const leafMat = new THREE.MeshStandardMaterial({ color: '#f6ead0', roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffe2a0', emissiveIntensity: 0.15 })
    const coverGeoL = new THREE.BoxGeometry(PW + 0.012, PH + 0.012, 0.012).translate(-PW / 2, 0, -0.008)
    const coverGeoR = new THREE.BoxGeometry(PW + 0.012, PH + 0.012, 0.012).translate(PW / 2, 0, -0.008)
    const leafGeo = new THREE.PlaneGeometry(PW * 0.96, PH * 0.94).translate(-PW * 0.48, 0, 0)
    return { pageMat, coverMat, leafMat, geoL: half(true), geoR: half(false), leafGeo, coverGeoL, coverGeoR }
  }, [])

  const tmp = useMemo(
    () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(), m: new THREE.Matrix4(), acc: 0, scale: 0 }),
    [],
  )

  useFrame((_, dt) => {
    const lady = world.chars.lady
    const show = lady.action === 'book'
    tmp.scale = THREE.MathUtils.damp(tmp.scale, show ? 1 : 0, 8, dt)
    group.current.visible = tmp.scale > 0.01
    if (!group.current.visible || !handL.current || !handR.current) return
    const s = world.handScroll
    handL.current.getWorldPosition(tmp.a)
    handR.current.getWorldPosition(tmp.b)
    tmp.x.subVectors(tmp.a, tmp.b).setY(0).normalize()
    tmp.y.set(0, 1, 0)
    tmp.z.crossVectors(tmp.x, tmp.y).normalize()
    // z points out of her chest, toward the guest: she shows the pages to you
    tmp.m.makeBasis(tmp.x, tmp.y, tmp.z)
    group.current.position.copy(tmp.a).add(tmp.b).multiplyScalar(0.5).addScaledVector(tmp.z, 0.07)
    group.current.position.y += 0.06
    group.current.quaternion.setFromRotationMatrix(tmp.m)
    // tilt the book back a little so the pages catch the light
    group.current.rotateX(-0.35)
    group.current.scale.setScalar(tmp.scale)

    // the left board swings open around the spine: closed (π) → flat (≈0.12)
    const psi = THREE.MathUtils.lerp(Math.PI * 0.98, 0.14, s)
    leftBoard.current.rotation.y = -psi
    group.current.position.addScaledVector(tmp.x, -(PW / 2) * (1 - s) * tmp.scale)
    const t = world.time
    leaves.current.forEach((l, i) => {
      if (!l) return
      const k = (i + 1) / (leaves.current.length + 1)
      l.rotation.y = -psi * (1 - k) - Math.sin(t * 3 + i) * 0.05 * s
      l.visible = s > 0.05 && s < 0.97
    })
    pageMat.emissiveIntensity = 0.2 + s * 1.1

    if (s > 0.55) {
      tmp.acc += dt * (8 + 12 * s)
      while (tmp.acc > 1) {
        tmp.acc -= 1
        const p = group.current.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * PW * 2, 0.12, (Math.random() - 0.5) * 0.1))
        emit({ type: 'sparkle', pos: p, count: 1, color: Math.random() < 0.7 ? '#ffd98a' : '#fff4d6' })
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      {/* right board: page on the front, lacquer cover behind */}
      <mesh geometry={geoR} material={pageMat} position-z={0.001} />
      <mesh geometry={coverGeoR} material={coverMat} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => void (leaves.current[i] = el!)} geometry={leafGeo} material={leafMat} />
      ))}
      <group ref={leftBoard}>
        <mesh geometry={geoL} material={pageMat} position-z={0.001} />
        <mesh geometry={coverGeoL} material={coverMat} />
      </group>
    </group>
  )
}
