import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { world } from '../../state/world'
import { canvas, FONT_UI, roundRect, toTexture } from '../lib/textures'
import { patchMaterial } from '../lib/materials'
import { rng } from '../lib/kit'

/**
 * Foreground objects that sweep right in front of the lens to hide a cut —
 * each one is a beat of Lực's journey:
 *   train  — the North–South express (Bồng Sơn → Sài Gòn) roars past
 *   trainHome — the same train, years later, the other way: Hà Nội → Bồng Sơn
 *   leaves — a gust of Hà Nội autumn leaves fills the frame
 *   bamboo — the camera slips through the culms of the village hedge
 * At p = 0.5 the frame is covered.
 */

/** the side of a Thống Nhất coach: deep blue, a cream band, warm windows, a destination board */
function coachTex(loco: boolean, board = 'BỒNG SƠN – SÀI GÒN') {
  const [c, g] = canvas(1024, 256)
  const body = loco ? '#c8352e' : '#2f4f8f'
  g.fillStyle = body
  g.fillRect(0, 0, 1024, 256)
  const sheen = g.createLinearGradient(0, 0, 0, 256)
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)')
  sheen.addColorStop(0.4, 'rgba(255,255,255,0)')
  sheen.addColorStop(1, 'rgba(0,0,0,0.25)')
  g.fillStyle = sheen
  g.fillRect(0, 0, 1024, 256)
  g.fillStyle = loco ? '#f2c14e' : '#efe6cf'
  g.fillRect(0, 150, 1024, 22)
  g.fillStyle = loco ? '#f2c14e' : '#e8c267'
  g.fillRect(0, 178, 1024, 6)
  if (loco) {
    g.fillStyle = '#1d2433'
    roundRect(g, 820, 40, 170, 80, 12)
    g.fill()
    g.fillStyle = '#f7e7b0'
    g.font = `900 46px ${FONT_UI}`
    g.fillText('D19E', 60, 110)
  } else {
    for (let x = 40; x < 980; x += 92) {
      g.fillStyle = '#1d2433'
      roundRect(g, x, 46, 70, 72, 10)
      g.fill()
      const grd = g.createLinearGradient(0, 50, 0, 116)
      grd.addColorStop(0, '#ffe6a8')
      grd.addColorStop(1, '#f2b25a')
      g.fillStyle = grd
      roundRect(g, x + 5, 51, 60, 62, 7)
      g.fill()
      // little silhouettes of passengers
      if ((x / 92) % 3 < 1.2) {
        g.fillStyle = 'rgba(60,40,40,0.55)'
        g.beginPath()
        g.arc(x + 35, 86, 11, 0, Math.PI * 2)
        g.fill()
        g.fillRect(x + 20, 96, 30, 20)
      }
    }
    // destination board, under the windows in the middle of the coach (the lens sees the coach from
    // the window line down to the stripes)
    g.fillStyle = '#f7f3e8'
    roundRect(g, 292, 126, 440, 52, 9)
    g.fill()
    g.strokeStyle = '#1d2433'
    g.lineWidth = 3
    g.stroke()
    g.fillStyle = '#b8352c'
    g.font = `900 36px ${FONT_UI}`
    g.textAlign = 'center'
    g.fillText(board, 512, 165)
    g.textAlign = 'left'
  }
  return toTexture(c)
}

const LEAF_N = 260

export function Wipe() {
  const camera = useThree((s) => s.camera)
  const group = useRef<THREE.Group>(null!)
  const train = useRef<THREE.Group>(null!)
  const bamboo = useRef<THREE.Group>(null!)

  const { coach, boards, loco, dark, culmMat, nodeMat, leafMesh, leafSeeds } = useMemo(() => {
    // the destination board: out to Sài Gòn, and home again
    const boards = { train: coachTex(false), trainHome: coachTex(false, 'HÀ NỘI – BỒNG SƠN') }
    const coach = new THREE.MeshStandardMaterial({ map: boards.train, roughness: 0.45, metalness: 0.15 })
    const loco = new THREE.MeshStandardMaterial({ map: coachTex(true), roughness: 0.45, metalness: 0.15 })
    const dark = new THREE.MeshStandardMaterial({ color: '#23262e', roughness: 0.7 })
    const culmMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#86b35e', roughness: 0.55 }), { rim: { color: '#f4ffd0', strength: 0.5, power: 2 } }, 'wipeCulm')
    const nodeMat = new THREE.MeshStandardMaterial({ color: '#6f9a4c', roughness: 0.6 })
    const shape = new THREE.Shape()
    shape.moveTo(0, -0.07)
    shape.quadraticCurveTo(0.055, -0.02, 0, 0.07)
    shape.quadraticCurveTo(-0.055, -0.02, 0, -0.07)
    const leafGeo = new THREE.ShapeGeometry(shape, 4)
    const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, emissive: '#6b3a10', emissiveIntensity: 0.25 }), LEAF_N)
    leafMesh.frustumCulled = false
    const r = rng(61)
    const pal = ['#f2c230', '#e8963a', '#f6d45a', '#e0a02a', '#d9772a', '#c9552f']
    const col = new THREE.Color()
    const leafSeeds = Array.from({ length: LEAF_N }, (_, i) => {
      leafMesh.setColorAt(i, col.set(pal[Math.floor(r() * pal.length)]))
      return { d: 0.45 + r() * 1.4, y: (r() - 0.5) * 2.2, lag: (r() - 0.5) * 0.5, spin: 3 + r() * 8, s: 0.9 + r() * 1.6, ph: r() * 6.3 }
    })
    return { coach, boards, loco, dark, culmMat, nodeMat, leafMesh, leafSeeds }
  }, [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() }), [])

  useFrame(() => {
    const { kind, p } = world.wipe
    const active = kind !== 'none' && p > 0 && p < 1
    group.current.visible = active
    if (!active) return
    group.current.position.copy(camera.position)
    group.current.quaternion.copy(camera.quaternion)
    const persp = camera as THREE.PerspectiveCamera
    const halfH = Math.tan(THREE.MathUtils.degToRad(persp.fov) / 2)
    const halfW = halfH * persp.aspect
    const home = kind === 'trainHome'
    train.current.visible = kind === 'train' || home
    bamboo.current.visible = kind === 'bamboo'
    leafMesh.visible = kind === 'leaves'
    if (kind === 'train' || home) {
      // the whole train passes right → left; the view is covered around p = 0.5
      // (the train home is turned about, engine first the other way: left → right)
      const d = 1.25
      const sc = Math.max(1, (halfH * d * 2.3) / 1.0)
      const reach = halfW * d + (4 * 2.3 * sc) / 2 + 0.3
      train.current.position.set(THREE.MathUtils.lerp(reach, -reach, home ? 1 - p : p), -0.06, -d)
      train.current.rotation.y = home ? Math.PI : 0
      train.current.scale.setScalar(sc)
      coach.map = boards[home ? 'trainHome' : 'train']
    } else if (kind === 'bamboo') {
      bamboo.current.children.forEach((culm, i) => {
        const d = 0.6 + i * 0.22
        const w = halfW * d + 0.5
        const lag = (i - 2) * 0.07
        culm.position.set(THREE.MathUtils.lerp(w, -w, THREE.MathUtils.clamp(p + lag, 0, 1)), 0, -d)
      })
    } else {
      // a swirling gust: every leaf crosses the frame on its own curve
      const t = world.time
      leafSeeds.forEach((l, i) => {
        const q = THREE.MathUtils.clamp((p - 0.5) * 1.6 + 0.5 + l.lag, 0, 1)
        const w = halfW * l.d + 0.3
        const x = THREE.MathUtils.lerp(-w, w, q)
        const y = l.y * halfH * l.d + Math.sin(q * Math.PI * 2 + l.ph) * 0.12 * l.d - (q - 0.5) * 0.4 * l.d
        tmp.q.setFromEuler(tmp.e.set(t * l.spin + l.ph, t * l.spin * 0.7, l.ph))
        tmp.m.compose(tmp.v.set(x, y, -l.d), tmp.q, tmp.s.setScalar(l.s * l.d))
        leafMesh.setMatrixAt(i, tmp.m)
      })
      leafMesh.instanceMatrix.needsUpdate = true
    }
  })

  const coaches = [0, 1, 2, 3]
  return (
    <group ref={group} visible={false}>
      <group ref={train}>
        {coaches.map((i) => (
          <group key={i} position={[(i - 1.5) * 2.3, 0, 0]}>
            <mesh material={i === 0 ? loco : coach}>
              <boxGeometry args={[2.2, 0.95, 0.9]} />
            </mesh>
            {/* roof + skirt + a dark gap between coaches */}
            <mesh position={[0, 0.52, 0]} material={dark}>
              <boxGeometry args={[2.18, 0.1, 0.86]} />
            </mesh>
            <mesh position={[0, -0.55, 0]} material={dark}>
              <boxGeometry args={[2.0, 0.16, 0.8]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={bamboo}>
        {[0, 1, 2, 3, 4].map((i) => (
          <group key={i}>
            <mesh material={culmMat}>
              <cylinderGeometry args={[0.13 + (i % 2) * 0.05, 0.14 + (i % 2) * 0.05, 6, 18]} />
            </mesh>
            {[-1.2, -0.4, 0.4, 1.2].map((y) => (
              <mesh key={y} position-y={y + i * 0.13} material={nodeMat}>
                <cylinderGeometry args={[0.15 + (i % 2) * 0.05, 0.15 + (i % 2) * 0.05, 0.05, 18]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <primitive object={leafMesh} />
    </group>
  )
}
