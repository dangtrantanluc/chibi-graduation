import { useEffect, useState } from 'react'
import { useUI } from '../state/store'

/**
 * `?fps` in the link: a small meter in the corner, for checking the invitation on
 * a real phone (inside Zalo / Messenger too). Shows frames per second averaged
 * over the last second, the lowest second so far, and the quality tier.
 */
export const fpsWanted = () => new URLSearchParams(window.location.search).has('fps')

export function FpsMeter() {
  const quality = useUI((s) => s.quality)
  const step = useUI((s) => s.step)
  const [fps, setFps] = useState(0)
  const [low, setLow] = useState(Infinity)
  useEffect(() => {
    let raf = 0
    let n = 0
    let t0 = performance.now()
    let warm = 0
    const tick = (t: number) => {
      n++
      if (t - t0 >= 1000) {
        const f = Math.round((n * 1000) / (t - t0))
        setFps(f)
        // (the first seconds compile shaders; do not count them as the low)
        if (++warm > 5) setLow((l) => Math.min(l, f))
        n = 0
        t0 = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="fps-meter" aria-hidden="true">
      {fps} fps · min {Number.isFinite(low) ? low : '–'} · {quality} · {step} · dpr {Math.min(window.devicePixelRatio, quality === 'high' ? 1.75 : 1.5)}
    </div>
  )
}
