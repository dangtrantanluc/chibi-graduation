import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import { useUI } from '../state/store'
import { world } from '../state/world'
import { uTime } from './lib/materials'
import { SUN_DIR } from './world/Sky'

/** Advances the shared clock (world.time + shader time). Runs first. */
export function Ticker() {
  useFrame((_, dt) => {
    world.time += Math.min(dt, 0.1)
    uTime.value = world.time
  }, -2)
  return null
}

/**
 * Applies the director's camera state with:
 *  • aspect-aware framing (portrait phones dolly back + widen the lens)
 *  • a slow "handheld" float and gentle pointer parallax
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const reduced = useUI((s) => s.reduced)
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 })
  const tmp = useMemo(
    () => ({ base: new THREE.Vector3(), dir: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), tgt: new THREE.Vector3(), axis: new THREE.Vector3(), Y: new THREE.Vector3(0, 1, 0) }),
    [],
  )

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const c = world.cam
    const aspect = size.width / Math.max(1, size.height)
    const narrow = THREE.MathUtils.clamp((1.35 - aspect) / (1.35 - 0.46), 0, 1)
    const back = 1 + 0.6 * narrow * c.backoff
    const fov = c.fov + 17 * narrow

    tmp.dir.subVectors(c.pos, c.target).multiplyScalar(back)
    // the guest's drag-to-look: orbit around the shot's target, lean in/out
    const L = world.look
    if (L.yaw || L.pitch || L.zoom) {
      tmp.dir.applyAxisAngle(tmp.Y, L.yaw)
      tmp.axis.crossVectors(tmp.Y, tmp.dir).normalize()
      if (tmp.axis.lengthSq() > 0.5) tmp.dir.applyAxisAngle(tmp.axis, -L.pitch)
      tmp.dir.multiplyScalar(1 + L.zoom)
    }
    tmp.base.copy(c.target).add(tmp.dir)
    tmp.dir.divideScalar(back)

    const t = world.time
    const drift = reduced ? 0 : c.drift
    const p = pointer.current
    p.sx = THREE.MathUtils.damp(p.sx, p.x, 2.2, dt)
    p.sy = THREE.MathUtils.damp(p.sy, p.y, 2.2, dt)
    tmp.right.setFromMatrixColumn(camera.matrixWorld, 0)
    tmp.up.setFromMatrixColumn(camera.matrixWorld, 1)
    const d = tmp.dir.length() * back
    const par = Math.min(0.35, d * 0.03) * drift * (world.look.active ? 0 : 0.6)

    camera.position
      .copy(tmp.base)
      .addScaledVector(tmp.right, Math.sin(t * 0.31) * 0.05 * drift + p.sx * par)
      .addScaledVector(tmp.up, (Math.sin(t * 0.23 + 1) * 0.035 - p.sy * par * 0.5) * drift)
    camera.position.y += Math.sin(t * 0.17) * 0.03 * drift
    tmp.tgt.copy(c.target)
    tmp.tgt.y += Math.sin(t * 0.29 + 2) * 0.02 * drift
    camera.lookAt(tmp.tgt)
    camera.rotateZ(Math.sin(t * 0.21) * 0.004 * drift)

    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
  }, -1)
  return null
}

/** Sunset key light, sky/bounce fill, and three pooled lantern point lights. */
export function Lighting() {
  const quality = useUI((s) => s.quality)
  const sun = useRef<THREE.DirectionalLight>(null!)
  const target = useMemo(() => new THREE.Object3D(), [])
  const pts = useRef<THREE.PointLight[]>([])
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    scene.add(target)
    sun.current.target = target
    return () => void scene.remove(target)
  }, [scene, target])

  useEffect(() => {
    const s = sun.current.shadow
    s.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024)
    s.map?.dispose()
    s.map = null as never
  }, [quality])

  const focus = useMemo(() => new THREE.Vector3(0, 0, 4), [])
  useFrame((_, dt) => {
    focus.lerp(world.shadowFocus, Math.min(1, dt * 1.5))
    const cam = sun.current.shadow.camera
    const sz = world.shadowSize
    if (cam.right !== sz) {
      cam.left = -sz
      cam.right = sz
      cam.top = sz
      cam.bottom = -sz
      cam.updateProjectionMatrix()
    }
    // snap to shadow texels to avoid shimmering while the camera travels
    const texel = (2 * sz) / sun.current.shadow.mapSize.x
    target.position.set(Math.round(focus.x / texel) * texel, 0, Math.round(focus.z / texel) * texel)
    sun.current.position.copy(target.position).addScaledVector(SUN_DIR, 60)
    target.updateMatrixWorld()
    // low tier: a single point light borrows whichever slot is brightest
    const slots = quality === 'high' ? world.lights : [world.lights.reduce((a, b) => (b.intensity > a.intensity ? b : a))]
    slots.forEach((l, i) => {
      const p = pts.current[i]
      if (!p) return
      p.position.copy(l.pos)
      p.color.copy(l.color)
      p.intensity = l.intensity
      p.distance = l.distance
    })
  })

  return (
    <>
      <hemisphereLight args={['#b9c5f2', '#d9a27e', 0.85]} />
      <directionalLight
        ref={sun}
        color="#ffc28a"
        intensity={3.4}
        castShadow
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
      <directionalLight color="#9fb2e8" intensity={0.38} position={[30, 20, 40]} />
      {(quality === 'high' ? [0, 1, 2] : [0]).map((i) => (
        <pointLight key={`${quality}${i}`} ref={(el) => void (pts.current[i] = el!)} intensity={0} decay={2} distance={9} />
      ))}
      <Environment resolution={64} frames={1} environmentIntensity={0.45}>
        <color attach="background" args={['#c9a9b8']} />
        <Lightformer form="rect" intensity={2.5} color="#ffd2a0" position={SUN_DIR.clone().multiplyScalar(8).toArray()} scale={[10, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#9fb4ff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[16, 16, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffb48a" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[16, 16, 1]} />
      </Environment>
    </>
  )
}
