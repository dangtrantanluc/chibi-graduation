import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  N8AO,
  TiltShift2,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode, type DepthOfFieldEffect, type HueSaturationEffect } from 'postprocessing'
import { grade } from './grade'
import { useUI } from '../state/store'
import { world } from '../state/world'

type TiltRef = { blur: number }

/**
 * Cinematic finish. High tier: soft AO, bokeh depth of field that tracks the
 * director's focus point, gentle bloom on lanterns. Low tier (phones): a cheap
 * tilt-shift blur instead of DOF/AO — it also sells the miniature look.
 */
export function Effects() {
  const quality = useUI((s) => s.quality)
  // by night the lanterns and lit windows bloom wider, and the frame closes in a little
  const dark = useUI((s) => s.theme === 'dark')
  const dof = useRef<DepthOfFieldEffect>(null)
  const tilt = useRef<TiltRef>(null)
  const hue = useRef<HueSaturationEffect>(null)
  const high = quality === 'high'

  useFrame(() => {
    const c = world.cam
    // the map view: no depth of field, a strong tilt-shift instead — the board as a miniature
    const map = world.overview.k
    if (dof.current) {
      dof.current.target = c.focus
      dof.current.bokehScale = 3.2 * c.dof * (1 - map)
      dof.current.cocMaterial.worldFocusRange = c.range
    }
    // the grey city drains the colour out of the picture; it comes back with the sun
    if (hue.current) hue.current.saturation = grade.sat
    if (tilt.current) tilt.current.blur = (high ? 0.22 * c.tilt : 0.1 + 0.18 * Math.max(c.tilt, c.dof * 0.5)) * (1 - map) + 0.16 * map
  })

  if (high) {
    return (
      <EffectComposer multisampling={4} stencilBuffer={false}>
        <N8AO halfRes aoRadius={1.1} distanceFalloff={0.7} intensity={2.4} quality="performance" color="#3b2432" />
        <DepthOfField ref={dof} worldFocusRange={3.2} bokehScale={3} resolutionScale={0.5} />
        <TiltShift2 ref={tilt as never} blur={0} taper={0.6} samples={8} />
        <Bloom mipmapBlur intensity={dark ? 0.95 : 0.55} luminanceThreshold={dark ? 0.7 : 0.92} luminanceSmoothing={0.25} radius={dark ? 0.8 : 0.72} />
        <HueSaturation ref={hue} saturation={0.06} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.28} darkness={dark ? 0.66 : 0.5} />
      </EffectComposer>
    )
  }
  return (
    <EffectComposer multisampling={0} stencilBuffer={false}>
      <TiltShift2 ref={tilt as never} blur={0.12} taper={0.6} samples={6} />
      <Bloom mipmapBlur intensity={dark ? 0.9 : 0.5} luminanceThreshold={dark ? 0.7 : 0.92} luminanceSmoothing={0.25} radius={dark ? 0.75 : 0.65} />
      <HueSaturation ref={hue} saturation={0.06} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={dark ? 0.66 : 0.5} />
    </EffectComposer>
  )
}
