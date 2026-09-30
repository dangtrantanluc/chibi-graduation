import { MUSIC } from '../config'

/*
 * Background music + a few synthesized sound touches.
 *
 * Browsers only allow audio after a user gesture, so nothing plays until the
 * guest taps to enter. Tracks run through Web Audio gain nodes (iOS ignores
 * <audio>.volume), which also gives smooth crossfades between the Japanese
 * village and the Huế citadel.
 */
type Zone = keyof typeof MUSIC.tracks

let ctx: AudioContext | null = null
let master: GainNode | null = null
const chans = new Map<Zone, { el: HTMLAudioElement; gain: GainNode }>()
let current: Zone | null = null
let muted = (() => {
  try {
    return localStorage.getItem('invite-muted') === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<(m: boolean) => void>()

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : MUSIC.volume
  master.connect(ctx.destination)
  return ctx
}

function channel(zone: Zone) {
  const c = ensure()
  if (!c || !master) return null
  let ch = chans.get(zone)
  if (!ch) {
    const t = MUSIC.tracks[zone]
    if (!t?.src) return null
    const el = new Audio(t.src)
    el.loop = true
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    const gain = c.createGain()
    gain.gain.value = 0
    c.createMediaElementSource(el).connect(gain).connect(master)
    ch = { el, gain }
    chans.set(zone, ch)
  }
  return ch
}

/** Start (or switch to) a zone's track with a gentle crossfade. */
export function playZone(zone: Zone, fade = 2.5) {
  const c = ensure()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  if (current === zone) return
  const now = c.currentTime
  if (current) {
    const old = chans.get(current)
    if (old) {
      old.gain.gain.cancelScheduledValues(now)
      old.gain.gain.setValueAtTime(old.gain.gain.value, now)
      old.gain.gain.linearRampToValueAtTime(0, now + fade)
      const el = old.el
      setTimeout(() => el.pause(), fade * 1000 + 100)
    }
  }
  current = zone
  const ch = channel(zone)
  if (!ch) return
  void ch.el.play().catch(() => undefined)
  ch.gain.gain.cancelScheduledValues(now)
  ch.gain.gain.setValueAtTime(ch.gain.gain.value, now)
  ch.gain.gain.linearRampToValueAtTime(1, now + fade)
}

export function isMuted() {
  return muted
}
export function onMute(fn: (m: boolean) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem('invite-muted', m ? '1' : '0')
  } catch {
    /* private mode */
  }
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.linearRampToValueAtTime(m ? 0 : MUSIC.volume, ctx.currentTime + 0.4)
  }
  listeners.forEach((f) => f(m))
}

/** A soft temple bell (synthesized): a few inharmonic partials with long decay. */
export function bell(pitch = 392, level = 0.35) {
  const c = ensure()
  if (!c || !master || muted) return
  const now = c.currentTime
  const out = c.createGain()
  out.gain.value = level
  out.connect(master)
  for (const [k, amp, dec] of [
    [1, 1, 4.5],
    [2.76, 0.45, 2.6],
    [5.4, 0.25, 1.4],
    [8.93, 0.12, 0.8],
  ]) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = pitch * k
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(amp, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dec)
    o.connect(g).connect(out)
    o.start(now)
    o.stop(now + dec + 0.1)
  }
}

/** Two quick pentatonic plucks — used when the guest taps onward. */
export function chime() {
  const c = ensure()
  if (!c || !master || muted) return
  const now = c.currentTime
  const notes = [659.25, 783.99, 880, 1046.5]
  const pick = notes[Math.floor(Math.random() * notes.length)]
  ;[pick, pick * 1.5].forEach((f, i) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'triangle'
    o.frequency.value = f
    const t = now + i * 0.09
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    o.connect(g).connect(master!)
    o.start(t)
    o.stop(t + 1)
  })
}
