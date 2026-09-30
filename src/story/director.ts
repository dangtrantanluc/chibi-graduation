import gsap from 'gsap'
import * as THREE from 'three'
import { ui, useUI, type Caption, type Step } from '../state/store'
import { act, emit, lookAt, place, walk, world, type Action, type CharId } from '../state/world'
import { BENCH, BIKE, CONGLANG, DOANMON, GATE, MARKS, NGOMON, SCROLL, UNI_BENCH } from '../three/layout'
import { uGlow } from '../three/lib/materials'
import { bell, playZone } from '../audio/music'
import { CAST } from '../config'

/**
 * The story director: Lực's journey, one chapter per tap. Every camera move,
 * character beat and transition is a GSAP timeline mutating `world`.
 *
 *   I   Bình Định — Lực on a bench under the Hoàng Đế gate: he tips his cap
 *       and greets you with a Bình Định martial salute, then walks into the light
 *   II  Nông Lâm — the North–South express carries him to Sài Gòn; his CNTT
 *       friend looks up from her laptop, "</>", a high-five
 *   III Hà Nội — a gust of autumn leaves; by a bicycle loaded with daisies his
 *       Hà Nội friend flashes a V-sign and gives you a bunch of cúc họa mi
 *   IV  the village gate — a court lady greets you in the Huế manner and opens
 *       a sutra; threads of gold light the lanterns up the brick lane
 *   V   Ngọ Môn — through the village gate to Huế: everyone is there, the
 *       princess dances, and the golden list unrolls with your name on it
 */

type V3 = [number, number, number]
const v3 = (a: V3) => new THREE.Vector3(...a)

let tl: gsap.core.Timeline | null = null
let idle: gsap.core.Tween[] = []
let finaleLoop: gsap.core.Tween | null = null

const K = () => (ui().reduced ? 0.7 : 1)
const narrow = () => window.innerWidth / Math.max(1, window.innerHeight) < 0.9

function newTimeline() {
  tl?.kill()
  idle.forEach((t) => t.kill())
  idle = []
  tl = gsap.timeline()
  tl.timeScale(1 / K())
  // any look-around the guest did eases home as the camera moves on
  gsap.to(world.look, { yaw: 0, pitch: 0, zoom: 0, duration: 1.4, ease: 'sine.inOut', overwrite: true })
  return tl
}

function orbit(yaw: number, up: number, down: number, zoom = 0.25) {
  Object.assign(world.cam.orbit, { yaw, up, down, zoom })
}

// ── camera helpers ─────────────────────────────────────────
interface Shot {
  pos: V3
  target: V3
  fov?: number
  focus?: V3
  dof?: number
  tilt?: number
  backoff?: number
  range?: number
}

function setCam(s: Shot) {
  const c = world.cam
  c.pos.set(...s.pos)
  c.target.set(...s.target)
  if (s.fov !== undefined) c.fov = s.fov
  if (s.focus) c.focus.set(...s.focus)
  if (s.dof !== undefined) c.dof = s.dof
  if (s.tilt !== undefined) c.tilt = s.tilt
  if (s.backoff !== undefined) c.backoff = s.backoff
  if (s.range !== undefined) c.range = s.range
}

function camTo(t: gsap.core.Timeline, at: number, dur: number, s: Partial<Shot>, ease = 'sine.inOut') {
  const c = world.cam
  if (s.pos) t.to(c.pos, { x: s.pos[0], y: s.pos[1], z: s.pos[2], duration: dur, ease }, at)
  if (s.target) t.to(c.target, { x: s.target[0], y: s.target[1], z: s.target[2], duration: dur, ease }, at)
  if (s.focus) t.to(c.focus, { x: s.focus[0], y: s.focus[1], z: s.focus[2], duration: dur * 0.8, ease }, at)
  const scalars: Record<string, number> = {}
  if (s.fov !== undefined) scalars.fov = s.fov
  if (s.dof !== undefined) scalars.dof = s.dof
  if (s.tilt !== undefined) scalars.tilt = s.tilt
  if (s.backoff !== undefined) scalars.backoff = s.backoff
  if (s.range !== undefined) scalars.range = s.range
  if (Object.keys(scalars).length) t.to(c, { ...scalars, duration: dur, ease }, at)
}

/** Move along smooth splines (current pose → given points). */
function camPath(t: gsap.core.Timeline, at: number, dur: number, pos: V3[], tgt: V3[], ease = 'sine.inOut', gusts = true) {
  const o = { k: 0 }
  let cp: THREE.CatmullRomCurve3
  let ct: THREE.CatmullRomCurve3
  let lastGust = -1
  t.to(
    o,
    {
      k: 1,
      duration: dur,
      ease,
      onStart: () => {
        cp = new THREE.CatmullRomCurve3([world.cam.pos.clone(), ...pos.map(v3)], false, 'centripetal')
        ct = new THREE.CatmullRomCurve3([world.cam.target.clone(), ...tgt.map(v3)], false, 'centripetal')
      },
      onUpdate: () => {
        cp.getPointAt(o.k, world.cam.pos)
        ct.getPointAt(o.k, world.cam.target)
        // the visitor's passage stirs leaves and lanterns
        if (gusts && o.k - lastGust > 0.08) {
          lastGust = o.k
          emit({ type: 'gust', x: world.cam.pos.x, z: world.cam.pos.z, strength: 0.55, radius: 3.2 })
        }
      },
    },
    at,
  )
}

function lightSlot(t: gsap.core.Timeline, at: number, i: number, pos: V3, intensity: number, dur = 1.5, color = '#ffb46b', distance = 9) {
  const l = world.lights[i]
  t.call(
    () => {
      l.pos.set(...pos)
      l.color.set(color)
      l.distance = distance
    },
    undefined,
    at,
  )
  t.to(l, { intensity, duration: dur, ease: 'sine.inOut' }, at)
}

function caption(t: gsap.core.Timeline, at: number, c: Caption | null) {
  t.call(() => useUI.setState({ caption: c }), undefined, at)
}
function setStep(t: gsap.core.Timeline, at: number, step: Step) {
  t.call(() => useUI.setState({ step }), undefined, at)
}
function allowContinue(t: gsap.core.Timeline, at: number) {
  t.call(() => useUI.setState({ busy: false, canContinue: true }), undefined, at)
}
function beat(t: gsap.core.Timeline, at: number, fn: () => void) {
  t.call(fn, undefined, at)
}
function mount(n: number) {
  useUI.setState({ mounted: Math.max(ui().mounted, n) })
}
/** a flash of warm light over the whole screen (walking into the light, a cut) */
function flash(t: gsap.core.Timeline, at: number, peak: number, up: number, down: number) {
  const fl = { f: 0 }
  const apply = () => useUI.setState({ flash: fl.f })
  t.to(fl, { f: peak, duration: up, ease: 'sine.in', onUpdate: apply }, at)
  t.to(fl, { f: 0, duration: down, ease: 'sine.out', onUpdate: apply }, at + up)
}
/** a small looping flourish while the guest reads (cancelled by the next scene) */
function fidget(id: CharId, list: Action[], every = 3.4) {
  idle.push(
    gsap.to(
      {},
      {
        duration: every,
        repeat: -1,
        onRepeat: () => {
          if (world.chars[id].action === 'none') act(id, list[Math.floor(Math.random() * list.length)])
        },
      },
    ),
  )
}
const name = () => ui().guest || 'bạn'

// ── Dialogue ───────────────────────────────────────────────
const CAPTIONS: Record<string, () => Caption> = {
  home: () => ({
    chapter: 'I',
    place: 'Bình Định · Cổng thành Hoàng Đế',
    speaker: CAST.luc,
    color: '#34353b',
    line: `Chào ${name()}! Đây là quê mình — Bình Định, đất võ trời văn. Small steps, big dreams… đi cùng mình một chuyến nhé!`,
  }),
  campus: () => ({
    chapter: 'II',
    place: 'Sài Gòn · ĐH Nông Lâm',
    speaker: CAST.uni,
    color: '#2f6fd6',
    line: `Ê ${name()}, tới Nông Lâm rồi nè! Khoa CNTT không chỉ là code — mà còn là những người bạn tuyệt vời.`,
  }),
  hanoi: () => ({
    chapter: 'III',
    place: 'Hà Nội · Hoàng thành Thăng Long',
    speaker: CAST.hanoi,
    color: '#d9a02a',
    line: `${name()} ơi! Thu Hà Nội đẹp lắm luôn. Tặng bạn bó cúc họa mi nè — good vibes only, cùng nhau đi thật xa nhé!`,
  }),
  village: () => ({
    chapter: 'IV',
    place: 'Làng Bắc Bộ · Cổng làng',
    speaker: CAST.lady,
    color: '#2e6b66',
    line: `Kính chào ${name()}. Mời người bước qua cổng làng — kinh thành Huế đã thắp đèn chờ sẵn.`,
  }),
  hue: () => ({
    chapter: 'V',
    place: 'Huế · Ngọ Môn',
    speaker: CAST.princess,
    color: '#b3262e',
    line: `Chào mừng ${name()} đến Ngọ Môn! Mọi người đã đông đủ — và bảng vàng này là lời mời dành riêng cho bạn.`,
  }),
}

// ── Shots (authored for ~16:9; the rig adapts to portrait) ─
const SHOTS = {
  intro: { pos: [0.4, 5.0, 26.5], target: [0.2, 1.9, 4.2], fov: 31, focus: [1.55, 0.8, 7.35], dof: 0.6, tilt: 0.35, backoff: 1, range: 10 } as Shot,
  home: { pos: [2.6, 1.55, 11.5], target: [0.9, 1.25, 6.4], fov: 32, focus: [1.5, 0.85, 7.4], dof: 1, tilt: 0.1, range: 3.2, backoff: 0.8 } as Shot,
  campus: { pos: [-1.9, 1.62, -3.9], target: [4.6, 1.55, -9.2], fov: 34, focus: [2.2, 0.75, -7.4], dof: 1, tilt: 0.1, range: 3.4, backoff: 0.6 } as Shot,
  hanoi: { pos: [1.6, 1.6, -16.2], target: [-1.9, 1.45, -23.4], fov: 34, focus: [-1.2, 0.8, -21.8], dof: 1, tilt: 0.1, range: 3.4, backoff: 0.6 } as Shot,
  village: { pos: [0.9, 1.5, -29.9], target: [-0.1, 1.45, -37.2], fov: 34, focus: [0.3, 0.9, -35.0], dof: 1, tilt: 0.1, range: 3.6, backoff: 0.3 } as Shot,
}

function huePose(): Shot {
  const z = CONGLANG.z - 1.4
  return narrow()
    ? { pos: [0, 3.6, z], target: [0, 1.2, NGOMON.z - 1], fov: 46, focus: [0, 1.2, -47.2], dof: 0.55, backoff: 0, range: 7 }
    : { pos: [0, 2.85, z], target: [0, 1.95, NGOMON.z - 1], fov: 46, focus: [0, 1.3, -47.2], dof: 0.55, backoff: 0, range: 7 }
}

const tight = () => (narrow() ? 0.66 : 1)

// ── Scenes ─────────────────────────────────────────────────
export function startIntro() {
  resetWorld()
  const t = newTimeline()
  setCam(SHOTS.intro)
  orbit(0.6, 0.3, 0.1, 0.3)
  lightSlot(t, 0, 0, [0, 1.6, 3.6], 0, 0.1)
  // slow, dreamy drift while the guest writes their name
  idle.push(gsap.to(world.cam.pos, { x: 1.8, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  idle.push(gsap.to(world.cam.target, { x: 0.7, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  fidget('luc', ['think', 'smile'], 4.2)
  useUI.setState({ step: 'intro', busy: false, canContinue: false, caption: null, invite: false, finale: false, flash: 0 })
}

/** I · Bình Định */
function playHome() {
  const t = newTimeline()
  useUI.setState({ step: 'home', busy: true, canContinue: false })
  orbit(0.45, 0.25, 0.1)
  act('luc', 'none')
  camTo(t, 0, 4.6, SHOTS.home, 'power2.inOut')
  for (const [at, z] of [
    [0.4, 13.5],
    [1.6, 12],
    [3.0, 10.4],
  ] as const)
    beat(t, at, () => emit({ type: 'gust', x: 0.5, z, strength: 0.45, radius: 3.4 }))
  beat(t, 2.3, () => {
    lookAt('luc', 'camera')
    act('luc', 'surprise')
  })
  beat(t, 3.3, () => act('luc', 'standUp'))
  t.to(world.chars.luc.pos, { y: 0, duration: 0.32, ease: 'sine.out' }, 3.34)
  beat(t, 4.2, () => act('luc', 'capTip'))
  caption(t, 4.6, CAPTIONS.home())
  // the Bình Định salute — fist into palm, a crisp bow
  beat(t, 5.9, () => act('luc', 'omQuyen'))
  beat(t, 8.1, () => act('luc', 'wave'))
  allowContinue(t, 8.4)
  beat(t, 10.5, () => fidget('luc', ['smile', 'capTip', 'think'], 3.8))
}

/** II · Nông Lâm — the train to Sài Gòn */
function playCampus() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false })
  caption(t, 0, null)
  // Lực turns and walks into the light of the gate; the camera follows
  beat(t, 0.1, () => {
    lookAt('luc', null)
    act('luc', 'none')
    walk('luc', [[0.7, 0, 6.5], [0.05, 0, 5.6], [0, 0, 4.4]], 1.25)
  })
  camPath(t, 0.2, 3.2, [[1.3, 1.6, 9.6], [0.3, 1.5, 7.9]], [[0.6, 1.3, 5.6], [0, 1.45, 3.8]], 'sine.inOut')
  t.to(world.gate, { light: 1, duration: 2.2, ease: 'sine.in' }, 0.9)
  lightSlot(t, 0.9, 0, [0, 1.7, GATE.z - 0.6], 12, 2.2, '#ffd9a0')
  flash(t, 2.2, 0.62, 1.2, 1.6)
  // the North–South express rushes past the lens: cut to Sài Gòn behind it
  beat(t, 2.9, () => (world.wipe.kind = 'train'))
  t.fromTo(world.wipe, { p: 0 }, { p: 1, duration: 1.8, ease: 'sine.inOut' }, 2.9)
  beat(t, 3.2, () => bell(523, 0.12))
  beat(t, 3.8, () => {
    mount(3)
    setCam({ ...SHOTS.campus, pos: [-2.6, 1.8, -1.6], target: [3.4, 1.6, -9.0] })
    world.gate.light = 0
    world.lights[0].intensity = 0
    world.shadowFocus.set(3, 0, -6)
    orbit(0.5, 0.28, 0.1)
    place('luc', [-0.6, 0, -3.6], Math.PI * 0.75)
    walk('luc', [[0.8, 0, -5.4], [2.3, 0, -6.2], [3.15, 0, -6.95]], 1.2, -0.9)
    lookAt('uni', null)
    act('uni', 'type')
    world.laptop = 1
  })
  beat(t, 4.7, () => (world.wipe.kind = 'none'))
  camTo(t, 3.8, 3.4, SHOTS.campus, 'power2.out')
  setStep(t, 4.4, 'campus')
  beat(t, 5.6, () => act('uni', 'type'))
  // she notices him: "!!", looks up, waves
  beat(t, 6.4, () => {
    act('uni', 'surprise')
    lookAt('uni', 'luc')
    lookAt('luc', 'uni')
  })
  t.to(world, { laptop: 0.35, duration: 0.6, ease: 'sine.inOut' }, 6.5)
  beat(t, 7.1, () => {
    lookAt('uni', 'camera')
    act('uni', 'wave')
    act('luc', 'wave')
  })
  t.to(world, { bubble: 1, duration: 0.5, ease: 'back.out(2)' }, 7.4)
  caption(t, 7.6, CAPTIONS.campus())
  // a high-five
  beat(t, 9.0, () => {
    act('uni', 'hi5')
    act('luc', 'hi5')
  })
  beat(t, 10.2, () => {
    lookAt('uni', 'camera')
    lookAt('luc', 'camera')
    act('uni', 'peace')
    act('luc', 'laugh')
  })
  allowContinue(t, 10.4)
  beat(t, 12.4, () => {
    fidget('uni', ['type', 'smile', 'laugh'], 3.4)
    fidget('luc', ['smile', 'laugh', 'capTip'], 4.1)
  })
}

/** III · Hà Nội — a gust of autumn leaves */
function playHanoi() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false })
  caption(t, 0, null)
  beat(t, 0, () => {
    act('uni', 'wave')
    act('luc', 'wave')
  })
  t.to(world, { bubble: 0, duration: 0.4 }, 0.2)
  camTo(t, 0.2, 1.6, { pos: [-0.6, 2.2, -1.8], target: [-1.4, 2.4, -10] }, 'sine.in')
  beat(t, 0.6, () => emit({ type: 'gust', x: 1, z: -5, strength: 1.1, radius: 6 }))
  beat(t, 0.7, () => (world.wipe.kind = 'leaves'))
  t.fromTo(world.wipe, { p: 0 }, { p: 1, duration: 2.4, ease: 'sine.inOut' }, 0.7)
  flash(t, 1.35, 0.3, 0.5, 0.9)
  beat(t, 1.9, () => {
    mount(4)
    setCam({ ...SHOTS.hanoi, pos: [2.8, 2.1, -13.8], target: [-0.6, 1.6, -22.6] })
    world.shadowFocus.set(-1, 0, -21)
    orbit(0.5, 0.28, 0.1)
    place('luc', [1.2, 0, -18.4], Math.PI * 0.85)
    walk('luc', [[0.4, 0, -20.4], [...MARKS.lucHanoi] as V3], 1.2, 0.2)
    lookAt('hanoi', null)
    world.chars.hanoi.faceY = BIKE.ry
    world.glow.hanoi = 0.35
    world.laptop = 0
  })
  beat(t, 3.1, () => (world.wipe.kind = 'none'))
  camTo(t, 1.9, 3.6, SHOTS.hanoi, 'power2.out')
  setStep(t, 2.6, 'hanoi')
  for (const at of [3.0, 4.6, 6.4]) beat(t, at, () => emit({ type: 'gust', x: -1 + Math.random() * 2, z: -21 + Math.random() * 2, strength: 0.7, radius: 4 }))
  // she spots them, hops, waves big
  beat(t, 4.0, () => {
    lookAt('hanoi', 'camera')
    world.chars.hanoi.faceY = 0.9
    act('hanoi', 'hop')
    lookAt('luc', 'hanoi')
  })
  beat(t, 4.6, () => act('hanoi', 'wave'))
  caption(t, 4.8, CAPTIONS.hanoi())
  beat(t, 6.4, () => act('hanoi', 'peace'))
  beat(t, 6.9, () => act('luc', 'smile'))
  // … and holds out the daisies to you
  beat(t, 8.6, () => {
    act('hanoi', 'offer')
    const p = world.chars.hanoi.pos
    emit({ type: 'sparkle', pos: new THREE.Vector3(p.x + 0.3, 0.85, p.z + 0.3), count: 10, color: '#fff6d0' })
  })
  allowContinue(t, 9.0)
  beat(t, 11.8, () => {
    fidget('hanoi', ['peace', 'hop', 'laugh', 'wave'], 3.2)
    fidget('luc', ['smile', 'capTip'], 4.4)
  })
}

/** IV · the village gate — through Đoan Môn's central arch */
function playVillage() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false })
  caption(t, 0, null)
  beat(t, 0, () => act('hanoi', 'wave'))
  beat(t, 0.4, () => {
    mount(5)
    place('luc', [...MARKS.lucVillage] as V3, -0.4)
    lookAt('lady', null)
  })
  // walk the camera straight through the great central arch
  const z = DOANMON.z
  camPath(
    t,
    0.3,
    5.0,
    [
      [0.6, 1.5, -20.2],
      [0, 1.45, z + 3.2],
      [0, 1.4, z + 0.4],
      [0, 1.42, z - 1.9],
      SHOTS.village.pos,
    ],
    [
      [0, 1.4, -27],
      [0, 1.4, z - 3],
      [0, 1.4, z - 6],
      [0, 1.42, -37],
      SHOTS.village.target,
    ],
    'sine.inOut',
  )
  camTo(t, 0.3, 5.0, { fov: SHOTS.village.fov, focus: SHOTS.village.focus, dof: 1, backoff: 0.3, range: SHOTS.village.range })
  beat(t, 2.6, () => {
    world.shadowFocus.set(0, 0, -34)
    world.glow.hanoi = 0
    orbit(0.3, 0.22, 0.08, 0.18)
  })
  lightSlot(t, 3.5, 2, [0, 2.2, -35], 4, 1.2)
  setStep(t, 5.0, 'village')
  // the Huế court greeting: hands clasped, raised to the brow, a slow bow
  beat(t, 5.1, () => {
    lookAt('lady', 'camera')
    act('lady', 'vai')
  })
  beat(t, 5.5, () => {
    lookAt('luc', 'lady')
    act('luc', 'bow')
  })
  caption(t, 5.5, CAPTIONS.village())
  // she opens the sutra; threads of gold light the lanterns up the lane
  beat(t, 8.3, () => {
    act('lady', 'book')
    lookAt('lady', null)
  })
  t.to(world, { handScroll: 1, duration: 2.6, ease: 'power2.out' }, 8.6)
  t.to(world, { villageWave: 1, duration: 3.8, ease: 'sine.inOut' }, 9.4)
  lightSlot(t, 9.4, 2, [0, 2.3, -35.4], 9, 2, '#ffcf80')
  beat(t, 9.6, () => emit({ type: 'gust', x: 0, z: -35, strength: 0.4, radius: 3 }))
  beat(t, 11.2, () => lookAt('luc', 'camera'))
  allowContinue(t, 11.4)
}

/** V · Huế — through the village gate to Ngọ Môn */
function playHue() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false })
  caption(t, 0, null)
  beat(t, 0, () => {
    lookAt('lady', 'camera')
    mount(6)
  })
  t.to(world, { handScroll: 0, duration: 1.0 }, 0)
  beat(t, 0.4, () => {
    act('lady', 'none')
    walk('lady', [[-0.9, 0, -35.8]], 1.1, Math.PI / 2)
    // the friends are already waiting at Ngọ Môn (seen through the arch); Lực leads the way
    const k = tight()
    for (const id of ['uni', 'hanoi'] as CharId[]) {
      const [x, z] = MARKS.hue[id]
      place(id, [x * k, 0, z], 0)
      lookAt(id, 'camera')
    }
    const [lx, lz] = MARKS.hue.luc
    lookAt('luc', null)
    walk('luc', [[0.2, 0, CONGLANG.z + 0.8], [0.1, 0, CONGLANG.z - 1.2], [lx * k, 0, lz]], 1.45, 0)
  })
  const hp = huePose()
  const gz = CONGLANG.z
  camPath(
    t,
    0.3,
    7.4,
    [
      [0.3, 1.5, -33.4],
      [0, 1.45, gz + 1.6],
      [0, 1.4, gz - 0.2],
      [0, 1.6, gz - 1.1],
      hp.pos,
    ],
    [
      [0, 1.4, -38],
      [0, 1.45, gz - 3],
      [0, 1.7, gz - 6],
      [0, 2.0, -48],
      hp.target,
    ],
    'sine.inOut',
  )
  camTo(t, 0.3, 7.4, { fov: hp.fov, dof: 0.55, backoff: hp.backoff, range: 7 })
  // through the gate the music turns to Huế
  beat(t, 3.4, () => playZone('hue', 3.5))
  camTo(t, 3.6, 3.6, { focus: hp.focus })
  lightSlot(t, 3.4, 2, [0, 3.2, NGOMON.z + 4], 10, 2)
  lightSlot(t, 3.4, 0, [-3, 2.2, -45], 6, 2)
  lightSlot(t, 3.4, 1, [3, 2.2, -45], 6, 2)
  // everyone gathers (off camera, while it's in the arch) on the Ngọ Môn plaza
  beat(t, 0.2, () => act('princess', 'dance'))
  beat(t, 4.2, () => {
    // the lady slips in behind the camera
    const [x, z] = MARKS.hue.lady
    place('lady', [x * tight(), 0, z], 0)
    lookAt('lady', 'camera')
    lookAt('luc', 'camera')
    world.villageWave = 1
    world.shadowFocus.set(0, 0, -46)
    world.laptop = 0
    orbit(0.5, 0.28, 0.12, 0.25)
  })
  beat(t, 3.8, () => act('princess', 'dance'))
  setStep(t, 7.6, 'hue')
  caption(t, 7.7, CAPTIONS.hue())
  beat(t, 7.7, () => {
    lookAt('princess', 'camera')
    act('princess', 'dance')
  })
  t.to(world.glow, { hue: 0.35, duration: 2 }, 7.5)
  // the golden list unrolls from Lầu Ngũ Phụng
  t.to(world, { scroll: 1, duration: 3.8, ease: 'power1.inOut' }, 8.1)
  beat(t, 8.1, () => bell(330, 0.3))
  beat(t, 11.6, () => bell(440, 0.22))
  camTo(t, 8.1, 6, { pos: [hp.pos[0], hp.pos[1] + 0.12, hp.pos[2] - 0.3], target: [hp.target[0], hp.target[1] + 0.3, hp.target[2]] }, 'sine.inOut')
  // everyone reacts as the name appears
  beat(t, 9.8, () => act('lady', 'vai'))
  beat(t, 10.2, () => act('luc', 'omQuyen'))
  beat(t, 10.5, () => act('uni', 'peace'))
  beat(t, 10.8, () => act('hanoi', 'cheer'))
  beat(t, 11.0, () => {
    act('princess', 'dance')
    for (let i = 0; i < 6; i++) {
      gsap.delayedCall(i * 0.4, () => {
        const n = world.chars.princess.pos
        emit({ type: 'sparkle', pos: new THREE.Vector3(n.x, 0.8, n.z), count: 8, color: i % 2 ? '#ffd98a' : '#ffc2d8' })
      })
      gsap.delayedCall(0.2 + i * 0.35, () => emit({ type: 'sparkle', pos: new THREE.Vector3(SCROLL.x + (Math.random() - 0.5) * 1.6, SCROLL.top - Math.random() * 2.4, SCROLL.z + 0.1), count: 3, color: '#fff2b8' }))
    }
  })
  t.to(world.glow, { hue: 1.25, duration: 2.5, ease: 'sine.inOut' }, 11.5)
  t.to(uGlow, { value: 1.25, duration: 2.5, ease: 'sine.inOut' }, 11.5)
  beat(t, 11.7, () => useUI.setState({ invite: true }))
  allowContinue(t, 12.9)
}

function playFinale() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false, invite: false, caption: null, step: 'finale' })
  const tall = narrow()
  // pull back high over the village and Hà Nội, looking back at Ngọ Môn: the journey laid out as a map
  const end: V3 = tall ? [6.2, 15.5, -30.5] : [8.6, 12.6, -32.2]
  const look: V3 = tall ? [0, 0, -45.5] : [0, 0.6, -46.4]
  camPath(t, 0, 11, [[1.5, 3.6, -39.8], [4.2, 7.0, -37.2], [6.8, 10.0, -34.4], end], [[0, 2.2, -49], [0, 1.4, -48], [0, 0.9, -47], look], 'power2.inOut', false)
  camTo(t, 0, 11, { fov: tall ? 44 : 40, dof: 0.35, tilt: 0.6, backoff: 0.35, range: 30 }, 'power2.inOut')
  camTo(t, 1, 8, { focus: [0, 0.8, -44.6] })
  beat(t, 1.2, () => {
    world.shadowSize = 36
    world.shadowFocus.set(0, 0, -38)
  })
  // everyone steps forward in a line, turns to the camera and waves goodbye
  const ids: CharId[] = ['uni', 'luc', 'princess', 'hanoi', 'lady']
  const face = Math.atan2(end[0], end[2] + 44)
  beat(t, 1.6, () => {
    ids.forEach((id, i) => {
      const x = (i - 2) * (tall ? 0.85 : 1.05)
      walk(id, [[x, 0, -43.8 - (i % 2) * 0.4]], 1.4, face)
      lookAt(id, null)
    })
  })
  beat(t, 5.2, () => ids.forEach((id) => lookAt(id, 'camera')))
  beat(t, 7.2, () => {
    act('luc', 'wave')
    act('uni', 'wave')
  })
  beat(t, 7.9, () => {
    act('hanoi', 'peace')
    act('lady', 'vai')
    act('princess', 'dance')
  })
  beat(t, 8.8, () => {
    orbit(0.75, 0.3, 0.2, 0.3)
    useUI.setState({ finale: true, busy: false })
  })
  beat(t, 11, () => {
    idle.push(gsap.to(world.cam.pos, { x: end[0] - 2, y: end[1] + 0.8, duration: 12, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
    const acts: Record<string, readonly Action[]> = {
      luc: ['wave', 'capTip', 'omQuyen', 'laugh'],
      uni: ['wave', 'peace', 'hop'],
      hanoi: ['peace', 'hop', 'wave', 'cheer'],
      lady: ['vai', 'smile'],
      princess: ['dance', 'smile'],
    }
    finaleLoop = gsap.to(
      {},
      {
        duration: 2.6,
        repeat: -1,
        onRepeat: () => {
          const id = ids[Math.floor(Math.random() * ids.length)]
          const list = acts[id]
          act(id, list[Math.floor(Math.random() * list.length)])
          if (Math.random() < 0.4) {
            const c = world.chars.princess.pos
            emit({ type: 'sparkle', pos: new THREE.Vector3(c.x, 1.2, c.z), count: 6, color: '#ffd98a' })
          }
        },
      },
    )
  })
}

// ── public API ─────────────────────────────────────────────
export function advance() {
  const s = ui()
  if (s.busy) return
  switch (s.step) {
    case 'intro':
      return playHome()
    case 'home':
      return playCampus()
    case 'campus':
      return playHanoi()
    case 'hanoi':
      return playVillage()
    case 'village':
      return playHue()
    case 'hue':
      return playFinale()
  }
}

/** Jump straight to the invitation (`?skip` in the link, for returning guests). */
export function skipToInvite() {
  playZone('hue', 1)
  const t = newTimeline()
  t.kill()
  world.gate.light = 0
  world.villageWave = 1
  world.wipe.kind = 'none'
  world.laptop = 0
  world.bubble = 0
  useUI.setState({ mounted: 6, caption: null, flash: 0 })
  place('luc', [...MARKS.lucVillage] as V3, -0.4)
  place('lady', [...MARKS.lady] as V3, 0)
  setCam({ ...SHOTS.village })
  playHue()
}

export function replay() {
  finaleLoop?.kill()
  startIntro()
  playZone('journey')
}

export function resetWorld() {
  finaleLoop?.kill()
  finaleLoop = null
  gsap.killTweensOf(world.cam.pos)
  gsap.killTweensOf(world.cam.target)
  // Lực sits on the stone bench under the gate; his friends wait in their cities
  place('luc', [BENCH.x, 0.265, BENCH.z], 0, 'sit')
  place('uni', [...MARKS.uniSit] as V3, UNI_BENCH.ry, 'sit')
  place('hanoi', [...MARKS.hanoi] as V3, BIKE.ry)
  place('lady', [...MARKS.lady] as V3, 0)
  place('princess', [...MARKS.princess] as V3, 0)
  for (const id of Object.keys(world.chars) as CharId[]) world.chars[id].look = null
  world.gate.light = 0
  world.glow.hanoi = world.glow.village = world.glow.hue = 0
  uGlow.value = 1
  world.villageWave = 0
  world.scroll = 0
  world.handScroll = 0
  world.laptop = 0.9
  world.bubble = 0
  world.wipe.kind = 'none'
  world.wipe.p = 0
  world.cam.drift = 1
  world.shadowFocus.set(0, 0, 5)
  world.shadowSize = 14
  world.lights.forEach((l) => (l.intensity = 0))
}
