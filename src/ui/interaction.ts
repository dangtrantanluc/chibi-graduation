import gsap from 'gsap'
import { world } from '../state/world'
import { useUI } from '../state/store'

/**
 * One gesture vocabulary for the whole experience — no buttons needed:
 *   • tap / click anywhere       → continue (fires `village-tap`)
 *   • drag (mouse or one finger) → look around the current scene
 *   • wheel / pinch              → lean in or out a little
 * In the map view (setOverview) a drag turns the whole board and a tap goes back.
 */
const INTERACTIVE = 'input, textarea, button, a, [data-interactive]'

export function installInteraction() {
  let down: { x: number; y: number; t: number; id: number } | null = null
  let dragging = false
  const pts = new Map<number, { x: number; y: number }>()
  let pinch0 = 0

  const clampLook = () => {
    const l = world.look
    if (world.overview.on) {
      // the map turns freely; tilt and zoom within reason
      l.pitch = Math.max(-0.5, Math.min(0.4, l.pitch))
      l.zoom = Math.max(-0.4, Math.min(0.25, l.zoom))
      return
    }
    const o = world.cam.orbit
    l.yaw = Math.max(-o.yaw, Math.min(o.yaw, l.yaw))
    l.pitch = Math.max(-o.down, Math.min(o.up, l.pitch))
    l.zoom = Math.max(-o.zoom, Math.min(o.zoom, l.zoom))
  }

  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest?.(INTERACTIVE)) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y)
      down = null
      return
    }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
    dragging = false
  }

  const onMove = (e: PointerEvent) => {
    const prev = pts.get(e.pointerId)
    if (!prev) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch0 > 0) {
        world.look.zoom -= ((d - pinch0) / window.innerHeight) * 0.9
        clampLook()
      }
      pinch0 = d
      return
    }
    if (!down || down.id !== e.pointerId) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) {
      dragging = true
      world.look.active = true
      gsap.killTweensOf(world.look)
      document.body.classList.add('is-dragging')
    }
    if (dragging) {
      const k = 2.6 / Math.max(window.innerWidth, window.innerHeight)
      world.look.yaw -= dx * k
      world.look.pitch += dy * k * 0.8
      clampLook()
    }
  }

  const onUp = (e: PointerEvent) => {
    const had = pts.delete(e.pointerId)
    if (!had) return
    if (pts.size) return
    pinch0 = 0
    document.body.classList.remove('is-dragging')
    world.look.active = false
    if (down && down.id === e.pointerId && !dragging && performance.now() - down.t < 600) {
      window.dispatchEvent(new CustomEvent('village-tap'))
    }
    down = null
    dragging = false
  }

  const onWheel = (e: WheelEvent) => {
    if ((e.target as HTMLElement)?.closest?.(INTERACTIVE)) return
    world.look.zoom += e.deltaY * 0.0012
    clampLook()
  }

  window.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('wheel', onWheel, { passive: true })
  return () => {
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('wheel', onWheel)
  }
}

/** Open or close the map view: the lens pulls back until the whole board is in frame. */
export function setOverview(on: boolean) {
  if (world.overview.on === on) return
  world.overview.on = on
  useUI.setState({ overview: on })
  // whatever looking-around was going on eases home, in either direction
  gsap.to(world.look, { yaw: 0, pitch: 0, zoom: 0, duration: 0.9, ease: 'sine.inOut', overwrite: true })
}
