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
import { MAI_POTS } from './layout'

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
  const [dpr, setDpr] = useState(quality === 'high' ? 1.75 : 1.5)

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
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1.25)
          useUI.setState({ quality: 'low' })
        }}
        flipflops={2}
      />
      <Ticker />
      <NightBackdrop />
      <CameraRig />
      <Lighting />
      <Suspense fallback={null}>
        <Sky />
        <Board />
        <BinhDinh />
        <Campus />
        <Street />
        <ThangLong />
        <Village />
        <Hue />
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
