import { MUSIC } from '../config'

/*
 * Background music + a few synthesized sound touches.
 *
 * Browsers only allow audio after a user gesture, so nothing plays until the
 * guest taps to enter. Tracks run through Web Audio gain nodes (iOS ignores
 * <audio>.volume), which also gives smooth crossfades between the journey
 * theme and the Huế theme. The tracks share one bus, so the music can be
 * hushed under a bell without hushing the bell.
 */
type Zone = keyof typeof MUSIC.tracks

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bus: GainNode | null = null
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
  bus = ctx.createGain()
  bus.connect(master)
  return ctx
}

function channel(zone: Zone) {
  const c = ensure()
  if (!c || !bus) return null
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
    c.createMediaElementSource(el).connect(gain).connect(bus)
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

/** Let the current track die away (the next playZone starts from silence). */
export function fadeOutMusic(fade = 3) {
  if (!ctx || !current) return
  const old = chans.get(current)
  current = null
  if (!old) return
  const now = ctx.currentTime
  old.gain.gain.cancelScheduledValues(now)
  old.gain.gain.setValueAtTime(old.gain.gain.value, now)
  old.gain.gain.linearRampToValueAtTime(0, now + fade)
  const el = old.el
  setTimeout(() => {
    // unless that track has been asked for again in the meantime
    if (chans.get(current as Zone)?.el !== el) el.pause()
  }, fade * 1000 + 100)
}

/** Hush the music to `to` (0‥1) over `dur` seconds — and back up with to = 1. */
export function duckMusic(to: number, dur = 1.5) {
  if (!ctx || !bus) return
  const now = ctx.currentTime
  bus.gain.cancelScheduledValues(now)
  bus.gain.setValueAtTime(bus.gain.value, now)
  bus.gain.linearRampToValueAtTime(to, now + dur)
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

let noiseBuf: AudioBuffer | null = null
/** two seconds of white noise, the raw material for wind and footsteps */
function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  return src
}

/** A breath of wind through the bamboo: band-passed noise that swells and dies away. */
export function wind(dur = 4, level = 0.1) {
  const c = ensure()
  if (!c || !master || muted) return
  const now = c.currentTime
  const src = noise(c)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.7
  bp.frequency.setValueAtTime(380, now)
  bp.frequency.linearRampToValueAtTime(900, now + dur * 0.45)
  bp.frequency.linearRampToValueAtTime(460, now + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(level, now + dur * 0.4)
  g.gain.linearRampToValueAtTime(level * 0.6, now + dur * 0.7)
  g.gain.linearRampToValueAtTime(0, now + dur)
  src.connect(bp).connect(g).connect(master)
  src.start(now)
  src.stop(now + dur + 0.1)
}

/** Soft footsteps on a brick lane: `n` low thuds, `gap` seconds apart. */
export function footsteps(n = 8, gap = 0.4, level = 0.22) {
  const c = ensure()
  if (!c || !master || muted) return
  const now = c.currentTime
  for (let i = 0; i < n; i++) {
    const t = now + i * gap + (Math.random() - 0.5) * 0.03
    const src = noise(c)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = i % 2 ? 420 : 340
    lp.Q.value = 1.2
    const g = c.createGain()
    // each step a little quieter: he is walking away
    const a = level * (1 - (i / n) * 0.55)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(a, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    src.connect(lp).connect(g).connect(master)
    src.start(t, Math.random())
    src.stop(t + 0.16)
  }
}
