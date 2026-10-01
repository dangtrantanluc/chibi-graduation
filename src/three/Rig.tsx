import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import { useUI } from '../state/store'
import { world, type LightSlot } from '../state/world'
import { uTime } from './lib/materials'
import { grade, sunDir } from './grade'
import { BOARD } from './layout'

/** Advances the shared clock (world.time + shader time). Runs first. */
export function Ticker() {
  useFrame((_, dt) => {
    world.time += Math.min(dt, 0.1)
    uTime.value = world.time
  }, -2)
  return null
}

// ── the map view ──
const MAP_CENTRE = new THREE.Vector3((BOARD.minX + BOARD.maxX) / 2, 1.5, (BOARD.minZ + BOARD.maxZ) / 2)
/** what has to stay in frame: the board, and the tallest roofs on it */
const MAP_CORNERS = [BOARD.minX - 1.5, BOARD.maxX + 1.5].flatMap((x) => [BOARD.minZ - 1.5, BOARD.maxZ + 1.5].flatMap((z) => [-1, 9].map((y) => new THREE.Vector3(x, y, z))))
const ease = (k: number) => k * k * (3 - 2 * k)

/**
 * Applies the director's camera state with:
 *  • aspect-aware framing (portrait phones dolly back + widen the lens)
 *  • a slow "handheld" float and gentle pointer parallax
 *  • the map view: blended over the story camera, so the story's own moves carry on underneath
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const scene = useThree((s) => s.scene)
  const reduced = useUI((s) => s.reduced)
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 })
  const tmp = useMemo(
    () => ({ base: new THREE.Vector3(), dir: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), tgt: new THREE.Vector3(), axis: new THREE.Vector3(), Y: new THREE.Vector3(0, 1, 0), d: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), v: new THREE.Vector3(), map: new THREE.Vector3() }),
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
    let fov = c.fov + 17 * narrow
    const ov = world.overview
    ov.k = THREE.MathUtils.damp(ov.k, ov.on ? 1 : 0, 2.6, dt)
    if (!ov.on && ov.k < 0.002) ov.k = 0
    const e = ease(ov.k)

    tmp.dir.subVectors(c.pos, c.target).multiplyScalar(back)
    // the guest's drag-to-look: orbit around the shot's target, lean in/out
    // (in the map view the same drag turns the map instead)
    const L = world.look
    if (e < 1 && (L.yaw || L.pitch || L.zoom)) {
      tmp.dir.applyAxisAngle(tmp.Y, L.yaw * (1 - e))
      tmp.axis.crossVectors(tmp.Y, tmp.dir).normalize()
      if (tmp.axis.lengthSq() > 0.5) tmp.dir.applyAxisAngle(tmp.axis, -L.pitch * (1 - e))
      tmp.dir.multiplyScalar(1 + L.zoom * (1 - e))
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
    if (e > 0) {
      // from the front and a little to one side on wide screens; steeper and square-on on phones,
      // where the long board then runs up the tall screen
      const az = THREE.MathUtils.lerp(0.42, 0, narrow) + L.yaw * e
      const el = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.62, 1.12, narrow) - L.pitch * e, 0.32, 1.4)
      const mapFov = THREE.MathUtils.lerp(38, 46, narrow)
      tmp.d.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      tmp.r.crossVectors(tmp.Y, tmp.d).normalize()
      tmp.u.crossVectors(tmp.d, tmp.r)
      // back off until every corner of the board is inside the frame
      const tv = Math.tan(THREE.MathUtils.degToRad(mapFov) / 2)
      const th = tv * aspect
      let dist = 0
      for (const corner of MAP_CORNERS) {
        tmp.v.subVectors(corner, MAP_CENTRE)
        const z = tmp.v.dot(tmp.d)
        dist = Math.max(dist, z + Math.abs(tmp.v.dot(tmp.r)) / th, z + Math.abs(tmp.v.dot(tmp.u)) / tv)
      }
      dist *= 1.09 * (1 + L.zoom * e)
      tmp.map.copy(MAP_CENTRE).addScaledVector(tmp.d, dist)
      camera.position.lerp(tmp.map, e)
      tmp.tgt.lerp(MAP_CENTRE, e)
      fov = THREE.MathUtils.lerp(fov, mapFov, e)
    }
    // from that far off the haze would wash the board out: push it back
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = THREE.MathUtils.lerp(70, 260, e)
      scene.fog.far = THREE.MathUtils.lerp(280, 700, e)
    }
    camera.lookAt(tmp.tgt)
    camera.rotateZ(Math.sin(t * 0.21) * 0.004 * drift * (1 - e))

    // From far off, a near plane of 0.1 leaves the depth buffer too coarse to tell the painted ground
    // from the board just under it (they flicker in stripes). Nothing is close to the lens in the map
    // view, so the near plane moves out with it.
    const near = THREE.MathUtils.lerp(0.1, 6, e)
    if (Math.abs(camera.fov - fov) > 0.01 || Math.abs(camera.near - near) > 0.001) {
      camera.fov = fov
      camera.near = near
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
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const fill = useRef<THREE.DirectionalLight>(null!)
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
  const lamp = useMemo<LightSlot>(() => ({ pos: new THREE.Vector3(), color: new THREE.Color('#ffb060'), intensity: 0, distance: 5 }), [])
  useFrame((_, dt) => {
    // in the map view the shadow map is stretched over the whole board
    const map = world.overview.on
    focus.lerp(map ? MAP_CENTRE : world.shadowFocus, Math.min(1, dt * (map ? 4 : 1.5)))
    const cam = sun.current.shadow.camera
    const wide = map || world.overview.k > 0.5
    const sz = wide ? 58 : world.shadowSize
    // … whose texels are then several times the size (more so on the low tier's smaller map):
    // the bias has to grow with them, or the lawns come out striped
    const tx = (2 * sz) / sun.current.shadow.mapSize.x
    sun.current.shadow.normalBias = wide ? tx * 3.6 : 0.035
    sun.current.shadow.bias = wide ? -0.0016 : -0.0004
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
    sun.current.position.copy(target.position).addScaledVector(sunDir, 60)
    target.updateMatrixWorld()
    // The lamp in Lực's hand is one more candidate for the pooled point lights: it sits at his
    // chest, a little ahead of him, and matters only when the light is poor. The brightest
    // candidates get the real lights (three on the high tier, one on the low).
    const luc = world.chars.luc
    lamp.pos.set(luc.pos.x + Math.sin(luc.rotY) * 0.5 + Math.cos(luc.rotY) * 0.3, luc.pos.y + 0.5, luc.pos.z + Math.cos(luc.rotY) * 0.5 - Math.sin(luc.rotY) * 0.3)
    lamp.intensity = 0.85 * grade.lamp * grade.lamp * (1 + 0.07 * Math.sin(world.time * 11.3) + 0.05 * Math.sin(world.time * 23.7 + 1.3))
    const count = quality === 'high' ? 3 : 1
    const slots = [...world.lights, lamp].sort((a, b) => b.intensity - a.intensity).slice(0, count)
    // the time of day (grade.ts): by night the sun becomes a cool moon and the sky light sinks to
    // deep blue; the lantern pools are turned down a little, because against the dark they bloom
    // much more readily
    const n = grade.night
    sun.current.color.copy(grade.sun)
    sun.current.intensity = grade.sunI
    hemi.current.color.copy(grade.hemiSky)
    hemi.current.groundColor.copy(grade.hemiGround)
    hemi.current.intensity = grade.hemiI
    fill.current.intensity = grade.fillI
    scene.environmentIntensity = grade.envI
    slots.forEach((l, i) => {
      const p = pts.current[i]
      if (!p) return
      p.position.copy(l.pos)
      p.color.copy(l.color)
      p.intensity = l.intensity * (1 - 0.3 * n)
      p.distance = l.distance * (1 + 0.25 * n)
    })
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#b9c5f2', '#d9a27e', 0.85]} />
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
      <directionalLight ref={fill} color="#9fb2e8" intensity={0.38} position={[30, 20, 40]} />
      {(quality === 'high' ? [0, 1, 2] : [0]).map((i) => (
        <pointLight key={`${quality}${i}`} ref={(el) => void (pts.current[i] = el!)} intensity={0} decay={2} distance={9} />
      ))}
      <Environment resolution={64} frames={1} environmentIntensity={0.45}>
        <color attach="background" args={['#c9a9b8']} />
        <Lightformer form="rect" intensity={2.5} color="#ffd2a0" position={[-5.2, 2.4, -6.1]} scale={[10, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#9fb4ff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[16, 16, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffb48a" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[16, 16, 1]} />
      </Environment>
    </>
  )
}
