import * as THREE from 'three'
// must run before any material compiles
import './lib/sanitize'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { useUI } from '../state/store'
import { CameraRig, Lighting, Ticker } from './Rig'
import { Effects } from './Effects'
import { Sky } from './world/Sky'
import { Board } from './world/Board'
import { BinhDinh } from './world/BinhDinh'
import { Campus } from './world/Campus'
import { Cow } from './world/Cow'
import { Street } from './world/Street'
import { ThangLong } from './world/ThangLong'
import { Village } from './world/Village'
import { Hue } from './world/Hue'
import { Overgrowth } from './world/Overgrowth'
import { Foliage } from './world/Foliage'
import { Lanterns } from './world/Lanterns'
import { Leaves } from './fx/Leaves'
import { GateLight } from './fx/GateLight'
import { Wipe } from './fx/Wipe'
import { Sparkles } from './fx/Sparkles'
import { HangingScroll } from './fx/HangingScroll'
import { Father, Hanoi, Luc, Mother, Princess, Uni } from './characters/Cast'
import { PottedMai } from './world/Foliage'
import { Fireflies, NightBackdrop } from './fx/Night'
import { CloudDragon } from './fx/CloudDragon'
import { LacBirds } from './fx/LacBirds'
import { SkyLanterns } from './fx/SkyLanterns'
import { MAI_POTS } from './layout'
import { GpuTimer } from './lib/GpuTimer'

/** the most resolution each tier asks for (a phone's 3× screen is drawn at 1.5× and scaled up) */
const DPR_CAP = { high: 1.75, low: 1.5 } as const
/** … and the least it will drop to on a GPU that cannot keep up (SMAA keeps the edges clean) */
const DPR_FLOOR = 0.8

const MAI: [number, number, number][] = MAI_POTS.map(([x, z]) => [x, 0.4, z])

/** Signals "ready" once the first frames have actually been drawn. */
function ReadySignal() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    let raf = 0
    let frames = 0
    if (import.meta.env.DEV) Object.assign(window, { __three: { gl, scene, camera } })
    gl.compile(scene, camera)
    const tick = () => {
      if (++frames > 4) useUI.setState({ phase: 'ready' })
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gl, scene, camera])
  return null
}

/** Characters/effects for later scenes are mounted lazily as the story nears them. */
function Lazy({ at, children }: { at: number; children: ReactNode }) {
  const mounted = useUI((s) => s.mounted)
  return mounted >= at ? <>{children}</> : null
}

/** While the guest reads the intro card, quietly prepare the later scenes. */
function Prewarm() {
  const phase = useUI((s) => s.phase)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (phase !== 'ready') return
    const timers = [2, 3, 4, 5, 6].map((n, i) =>
      setTimeout(() => {
        useUI.setState((s) => ({ mounted: Math.max(s.mounted, n) }))
        requestAnimationFrame(() => gl.compile(scene, camera))
      }, 1400 + i * 900),
    )
    return () => timers.forEach(clearTimeout)
  }, [phase, gl, scene, camera])
  return null
}

export default function Experience() {
  const quality = useUI((s) => s.quality)
  const [dpr, setDpr] = useState<number>(DPR_CAP[quality])

  return (
    <Canvas
      className="stage"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, dpr]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false }}
      camera={{ fov: 30, near: 0.1, far: 900, position: [0, 4.4, 28.5] }}
      aria-hidden="true"
    >
      <color attach="background" args={['#e7b9a4']} />
      <fog attach="fog" args={['#e8b8a6', 70, 280]} />
      {/* When frames run slow, give ground a step at a time: first the high tier's effects, then
          resolution, a fifth at a time, down to 0.8×; and take resolution back if there is room. */}
      <PerformanceMonitor
        onDecline={() => {
          if (useUI.getState().quality === 'high') useUI.setState({ quality: 'low' })
          else setDpr((d) => Math.max(DPR_FLOOR, Math.round((d - 0.2) * 100) / 100))
        }}
        onIncline={() => setDpr((d) => Math.min(DPR_CAP[useUI.getState().quality], Math.round((d + 0.2) * 100) / 100))}
        flipflops={4}
      />
      {import.meta.env.DEV && new URLSearchParams(location.search).has('gputime') && <GpuTimer />}
      <Ticker />
      <NightBackdrop />
      <CameraRig />
      <Lighting />
      <Suspense fallback={null}>
        <Sky />
        <Board />
        <group name="zone-binhdinh">
          <BinhDinh />
        </group>
        <group name="zone-campus">
          <Campus />
          <Street />
        </group>
        <group name="zone-thanglong">
          <ThangLong />
        </group>
        <group name="zone-village">
          <Village />
        </group>
        <group name="zone-hue">
          <Hue />
        </group>
        <Overgrowth />
        <Foliage />
        <Lanterns />
        <Leaves />
        <GateLight />
        <Fireflies />
        <LacBirds />
        <Luc />
        <Sparkles />
        <Lazy at={2}>
          <Uni />
          <Cow />
        </Lazy>
        <Lazy at={3}>
          <Hanoi />
          <CloudDragon />
        </Lazy>
        <Lazy at={4}>
          <Father />
          <Mother />
        </Lazy>
        <Lazy at={5}>
          <Princess />
          <HangingScroll />
          <SkyLanterns />
          {MAI.map((p, i) => (
            <PottedMai key={i} position={p} />
          ))}
        </Lazy>
        <Wipe />
        <ReadySignal />
        <Prewarm />
      </Suspense>
      <Effects />
    </Canvas>
  )
}
