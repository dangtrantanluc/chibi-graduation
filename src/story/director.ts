import gsap from 'gsap'
import * as THREE from 'three'
import { ui, useUI, type Caption, type Step } from '../state/store'
import { act, emit, lookAt, place, walk, world, type Action, type CharId } from '../state/world'
import { BENCH, BIKE, CONGLANG, DOANMON, GATE, HALL, MARKS, NGOMON, SCROLL, UNI_BENCH, VILLAGE_END } from '../three/layout'
import { uGlow } from '../three/lib/materials'
import { bell, duckMusic, fadeOutMusic, footsteps, playZone, wind } from '../audio/music'
import { CAST } from '../config'

/**
 * The story director: Lực's journey, one chapter per tap. Every camera move,
 * character beat and transition is a GSAP timeline mutating `world`.
 *
 *   I   Bình Định — Lực on a bench under the Hoàng Đế gate: a shy grin, a
 *       Bình Định martial salute, then he walks into the light
 *   II  Nông Lâm — the North–South express carries him to Sài Gòn; his CNTT
 *       friend looks up from her laptop, "</>", a high-five
 *   III Hà Nội — a gust of autumn leaves; by a bicycle loaded with daisies his
 *       Hà Nội friend flashes a V-sign and gives you a bunch of cúc họa mi
 *   IV  home — through Đoan Môn and the village gate to his parents, waiting
 *       in the yard of their thatched house; he greets them, shows his
 *       diploma (the lane's lanterns light up), and they step to either side
 *       of the lane to see him off
 *   V   Ngọ Môn — out under the bamboo to Huế (the journey theme dies away:
 *       footsteps, wind, a small bell, then the Huế theme); everyone is there,
 *       and the golden list is lowered like a rite: a hush, a bell, a band of
 *       gold, a second bell, then your name
 *   ·   the farewell — the list rolls up, and they all walk in through Ngọ Môn
 *       to stand before Điện Thái Hòa: "see you inside"
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
  let cp: THREE.CatmullRomCurve3 | undefined
  let ct: THREE.CatmullRomCurve3 | undefined
  let lastGust = -1
  t.to(
    o,
    {
      k: 1,
      duration: dur,
      ease,
      onUpdate: () => {
        // built on the first tick, from wherever the camera is by then (GSAP may
        // render a tween's very first frame without firing onStart)
        cp ??= new THREE.CatmullRomCurve3([world.cam.pos.clone(), ...pos.map(v3)], false, 'centripetal')
        ct ??= new THREE.CatmullRomCurve3([world.cam.target.clone(), ...tgt.map(v3)], false, 'centripetal')
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

/** show a line of dialogue (or clear it); `who` are the ones whose mouths move while it is typed */
function caption(t: gsap.core.Timeline, at: number, c: Caption | null, who: CharId[] = []) {
  t.call(
    () => {
      world.talk.who = who
      useUI.setState({ caption: c })
    },
    undefined,
    at,
  )
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
    line: `Ê ${name()}, tới Nông Lâm rồi nè! Khoa CNTT không chỉ là code — mà còn là những người bạn tuyệt vời.`,
  }),
  hanoi: () => ({
    chapter: 'III',
    place: 'Hà Nội · Hoàng thành Thăng Long',
    line: `${name()} ơi! Thu Hà Nội đẹp lắm luôn. Tặng bạn bó cúc họa mi nè. Cùng nhau đi thật xa nhé!`,
  }),
  village: () => ({
    chapter: 'IV',
    place: 'Về nhà · Làng quê',
    speaker: CAST.luc,
    color: '#34353b',
    line: 'Con chào bố mẹ ạ! Con tốt nghiệp rồi — bằng của con đây ạ!',
  }),
  parents: () => ({
    chapter: 'IV',
    place: 'Về nhà · Làng quê',
    speaker: CAST.parents,
    color: '#8a5a32',
    line: `Giỏi lắm con trai! ${name()} đi cùng Lực vào Huế nhé — cả kinh thành đang đợi hai đứa đấy!`,
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
  intro: { pos: [0.4, 5.0, 26.5], target: [0.2, 0.3, 4.2], fov: 31, focus: [1.55, 0.8, 7.35], dof: 0.6, tilt: 0.35, backoff: 1, range: 10 } as Shot,
  home: { pos: [2.6, 1.55, 11.5], target: [0.9, 1.25, 6.4], fov: 32, focus: [1.5, 0.85, 7.4], dof: 1, tilt: 0.1, range: 3.2, backoff: 0.8 } as Shot,
  campus: { pos: [-1.9, 1.62, -3.9], target: [4.6, 1.55, -9.2], fov: 34, focus: [2.2, 0.75, -7.4], dof: 1, tilt: 0.1, range: 3.4, backoff: 0.6 } as Shot,
  hanoi: { pos: [1.6, 1.6, -16.2], target: [-1.9, 1.45, -23.4], fov: 34, focus: [-1.2, 0.8, -21.8], dof: 1, tilt: 0.1, range: 3.4, backoff: 0.6 } as Shot,
}

/** IV: from just inside the village gate, across the lane into the yard — the family in a row, the house behind them */
function yardPose(): Shot {
  return narrow()
    ? { pos: [-1.7, 1.75, -32.0], target: [2.2, 1.15, -35.65], fov: 58, focus: [2.4, 0.9, -35.4], dof: 0.8, tilt: 0.1, range: 3.6, backoff: 0 }
    : { pos: [-1.2, 1.6, -32.4], target: [2.6, 1.05, -35.6], fov: 40, focus: [2.4, 0.9, -35.4], dof: 0.9, tilt: 0.1, range: 3.8, backoff: 0 }
}
/** … then down the lane: his parents either side of it, the bamboo arch and Ngọ Môn beyond */
function lanePose(): Shot {
  return narrow()
    ? { pos: [0, 1.9, -31.9], target: [0, 1.2, -39.5], fov: 46, focus: [0, 0.9, -37.2], dof: 0.7, tilt: 0.1, range: 4.5, backoff: 0 }
    : { pos: [0.2, 1.6, -32.6], target: [0, 1.15, -39.5], fov: 38, focus: [0, 0.9, -37.2], dof: 0.9, tilt: 0.1, range: 4.2, backoff: 0 }
}
/** how far from the middle of the lane his parents stand to see him off */
const asideX = () => (narrow() ? 1.0 : 1.3)

function huePose(): Shot {
  // wide screens: just past the bamboo, close on the row before the gate.
  // phones: from back in the lane, through the bamboo — all of Ngọ Môn, the six of them small beneath the list
  return narrow()
    ? { pos: [0, 2.2, VILLAGE_END + 1.5], target: [0, 1.6, NGOMON.z + 1.2], fov: 52, focus: [0, 1.2, -47.2], dof: 0.4, backoff: 0, range: 8 }
    : { pos: [0, 2.85, VILLAGE_END - 1.4], target: [0, 1.95, NGOMON.z - 1], fov: 46, focus: [0, 1.3, -47.2], dof: 0.55, backoff: 0, range: 7 }
}
/** where everyone stands before Ngọ Môn: a row, closed up a little on phones */
const hueMarks = () => (narrow() ? MARKS.hueTall : MARKS.hue)

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
  beat(t, 4.2, () => act('luc', 'scratch'))
  caption(t, 4.6, CAPTIONS.home(), ['luc'])
  // the Bình Định salute — fist into palm, a crisp bow
  beat(t, 5.9, () => act('luc', 'omQuyen'))
  beat(t, 8.1, () => act('luc', 'wave'))
  allowContinue(t, 8.4)
  beat(t, 10.5, () => fidget('luc', ['smile', 'scratch', 'think'], 3.8))
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
    walk('luc', [[0.8, 0, -5.4], [2.4, 0, -6.0], [...MARKS.lucCampus] as V3], 1.2, -0.9)
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
  caption(t, 7.6, CAPTIONS.campus(), ['uni'])
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
    fidget('luc', ['smile', 'laugh', 'scratch'], 4.1)
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
  caption(t, 4.8, CAPTIONS.hanoi(), ['hanoi'])
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
    fidget('luc', ['smile', 'scratch'], 4.4)
  })
}

/** IV · home — through Đoan Môn and the village gate, to his parents in the yard of their house */
function playVillage() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false })
  caption(t, 0, null)
  // goodbye to the Hà Nội friend
  beat(t, 0, () => {
    act('hanoi', 'wave')
    act('luc', 'wave')
    lookAt('luc', 'hanoi')
  })
  beat(t, 0.3, () => {
    mount(5)
    // his parents wait in the yard, looking toward the gate for him
    place('father', [...MARKS.father] as V3, -0.7)
    place('mother', [...MARKS.mother] as V3, -0.75)
    lookAt('father', null)
    lookAt('mother', null)
  })
  // he walks off through the great central arch, then the village gate; the camera follows him
  const z = DOANMON.z
  const gz = CONGLANG.z
  const yp = yardPose()
  beat(t, 0.7, () => {
    lookAt('luc', null)
    walk('luc', [[0.1, 0, -24.2], [0, 0, -26.4], [0, 0, z - 1.6], [0, 0, gz + 0.8], [0, 0, gz - 1.6], [0.95, 0, -35.0], [...MARKS.lucVillage] as V3], 2.4, 0.25)
  })
  camPath(
    t,
    1.5,
    7.2,
    [
      [0.6, 1.6, -21.4],
      [0, 1.5, z + 2.6],
      [0, 1.45, z + 0.2],
      [0, 1.45, z - 1.7],
      [0, 1.4, gz + 0.2],
      [0, 1.45, gz - 0.85],
      yp.pos,
    ],
    [
      [0, 1.3, -27],
      [0, 1.3, z - 3],
      [0, 1.3, z - 5],
      [0, 1.3, gz - 2],
      [0.2, 1.3, gz - 3.2],
      [1.4, 1.3, -35.2],
      yp.target,
    ],
    'sine.inOut',
  )
  camTo(t, 1.5, 7.2, { fov: yp.fov, focus: yp.focus, dof: yp.dof, backoff: 0, range: yp.range })
  beat(t, 3.8, () => {
    world.shadowFocus.set(2.5, 0, -35.5)
    world.glow.hanoi = 0
    orbit(0.28, 0.2, 0.08, 0.15)
  })
  lightSlot(t, 5.0, 2, [2.3, 2.2, -35.0], 4, 1.2)
  setStep(t, 7.0, 'village')
  // they see him coming: a wave, a smile
  beat(t, 5.4, () => {
    lookAt('father', 'luc')
    lookAt('mother', 'luc')
    act('father', 'wave')
    act('mother', 'smile')
  })
  // khoanh tay chào: arms folded, a bow to his parents — the three of them half-turned to the lens
  beat(t, 8.1, () => {
    lookAt('luc', null)
    lookAt('father', null)
    lookAt('mother', null)
    world.chars.father.faceY = -1.35
    world.chars.mother.faceY = -1.3
    act('luc', 'greet')
  })
  caption(t, 8.3, CAPTIONS.village(), ['luc'])
  // … and out comes his diploma, unrolled for them to read
  beat(t, 10.5, () => act('luc', 'present'))
  t.to(world, { diploma: 1, duration: 1.7, ease: 'power2.out' }, 10.8)
  beat(t, 11.0, () => bell(523, 0.14))
  beat(t, 12.1, () => {
    act('mother', 'clap')
    act('father', 'cheer')
  })
  // the lanterns along the lane come alight, one after another
  t.to(world, { villageWave: 1, duration: 3.4, ease: 'sine.inOut' }, 12.3)
  lightSlot(t, 12.3, 2, [2.4, 2.3, -35.6], 9, 2, '#ffcf80')
  beat(t, 12.5, () => emit({ type: 'gust', x: 2.2, z: -35.6, strength: 0.4, radius: 3 }))
  // he turns to show it to you too
  beat(t, 13.5, () => {
    lookAt('luc', 'camera')
    world.chars.luc.faceY = -0.8
  })
  // then he steps back into the lane, and they go to either side of it to send him on
  const ax = asideX()
  beat(t, 15.0, () => {
    act('luc', 'none')
    lookAt('luc', null)
    walk('luc', [[...MARKS.lucLane] as V3], 1.5, 0)
    world.shadowFocus.set(0, 0, -36.5)
  })
  t.to(world, { diploma: 0, duration: 0.8 }, 15.0)
  beat(t, 15.4, () => {
    // his father crosses the lane behind him; his mother stays on the house side
    walk('father', [[1.0, 0, -37.75], [-ax, 0, -38.0], [-ax, 0, MARKS.fatherAside[2]]], 1.9, 0.2)
    walk('mother', [[ax, 0, -36.2], [ax, 0, MARKS.motherAside[2]]], 1.5, -0.2)
    lookAt('father', null)
    lookAt('mother', null)
  })
  camTo(t, 15.0, 2.8, lanePose())
  lightSlot(t, 15.4, 2, [0, 2.4, -36.6], 8, 2, '#ffcf80')
  beat(t, 16.6, () => {
    lookAt('luc', 'camera')
    act('luc', 'smile')
  })
  beat(t, 17.6, () => {
    lookAt('father', 'camera')
    lookAt('mother', 'camera')
  })
  caption(t, 18.0, CAPTIONS.parents(), ['father', 'mother'])
  beat(t, 19.0, () => {
    act('father', 'usher')
    act('mother', 'usher')
  })
  allowContinue(t, 19.6)
  beat(t, 21.8, () => {
    fidget('father', ['usher', 'cheer', 'smile'], 3.6)
    fidget('mother', ['clap', 'usher', 'smile'], 3.9)
    fidget('luc', ['smile', 'scratch'], 4.4)
  })
}

/**
 * V · Huế — out of the village under the bamboo, to Ngọ Môn.
 * `bridge`: play the passage from the journey theme into the Huế theme
 * (skipped when a returning guest jumps straight here).
 */
function playHue(bridge = true) {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false })
  caption(t, 0, null)
  beat(t, 0, () => mount(6))
  const marks = hueMarks()
  const ve = VILLAGE_END
  // his parents cheer as he walks between them toward the bamboo
  beat(t, 0.3, () => {
    lookAt('father', 'luc')
    lookAt('mother', 'luc')
    act('father', 'cheer')
    act('mother', 'clap')
  })
  beat(t, 0.4, () => {
    // the friends and the princess are already waiting at Ngọ Môn (seen through the bamboo); Lực leads the way
    for (const id of ['uni', 'hanoi', 'princess'] as CharId[]) {
      const [x, z] = marks[id]
      place(id, [x, 0, z], 0)
      lookAt(id, 'camera')
    }
    act('princess', 'dance')
    const [lx, lz] = marks.luc
    lookAt('luc', null)
    walk('luc', [[0, 0, ve + 0.6], [0, 0, ve - 1.6], [lx, 0, lz]], 1.9, 0)
  })
  const hp = huePose()
  if (narrow())
    camPath(t, 0.3, 7.4, [[0, 1.7, -34.6], [0, 1.95, -36.4], hp.pos], [[0, 1.4, -42], [0, 1.5, -46], hp.target], 'sine.inOut')
  else
    camPath(
      t,
      0.3,
      7.4,
      [
        [0, 1.55, -35.6],
        [0, 1.5, ve + 1.2],
        [0, 1.5, ve - 0.3],
        [0, 1.8, ve - 0.9],
        hp.pos,
      ],
      [
        [0, 1.35, -41],
        [0, 1.45, ve - 4],
        [0, 1.7, ve - 6],
        [0, 2.0, -48],
        hp.target,
      ],
      'sine.inOut',
    )
  camTo(t, 0.3, 7.4, { fov: hp.fov, dof: hp.dof, backoff: hp.backoff, range: hp.range, tilt: 0.1 })
  // the music changes region rather than track: the journey theme dies away
  // behind his footsteps, wind in the bamboo, one small bell — then Huế begins
  if (bridge) {
    beat(t, 0.3, () => fadeOutMusic(3))
    beat(t, 0.7, () => footsteps(8, 0.4))
    beat(t, 1.6, () => wind(4.4))
    beat(t, 4.6, () => bell(784, 0.07))
    beat(t, 4.9, () => playZone('hue', 4))
  }
  camTo(t, 3.6, 3.6, { focus: hp.focus })
  lightSlot(t, 3.4, 2, [0, 3.2, NGOMON.z + 4], 10, 2)
  lightSlot(t, 3.4, 0, [-3, 2.2, -45], 6, 2)
  lightSlot(t, 3.4, 1, [3, 2.2, -45], 6, 2)
  beat(t, 3.8, () => {
    act('princess', 'dance')
    world.villageWave = 1
    world.shadowFocus.set(0, 0, -46)
    world.laptop = 0
  })
  // once the lens has gone by, his parents follow: they come in from either side and take their places
  beat(t, 4.9, () => {
    for (const id of ['father', 'mother'] as CharId[]) {
      const s = id === 'father' ? -1 : 1
      const [x, z] = marks[id]
      lookAt(id, null)
      act(id, 'none')
      walk(id, [[s * 1.15, 0, ve + 0.4], [s * 1.2, 0, ve - 2.2], [x, 0, z]], 2.7, 0)
    }
  })
  beat(t, 6.6, () => {
    lookAt('luc', 'camera')
    orbit(0.5, 0.28, 0.12, 0.25)
  })
  setStep(t, 7.6, 'hue')
  caption(t, 7.7, CAPTIONS.hue(), ['princess'])
  beat(t, 7.7, () => {
    lookAt('princess', 'camera')
    act('princess', 'dance')
  })
  beat(t, 8.8, () => {
    lookAt('father', 'camera')
    lookAt('mother', 'camera')
  })
  t.to(world.glow, { hue: 0.35, duration: 2 }, 7.5)
  // ── the golden list is lowered from Lầu Ngũ Phụng, as a rite ──
  // a hush, and a breath of wind across the plaza
  const up: V3 = [hp.target[0], hp.target[1] + (narrow() ? 1.6 : 1.45), hp.target[2]]
  const down: V3 = [hp.target[0], hp.target[1] + 0.3, hp.target[2]]
  beat(t, 9.8, () => {
    duckMusic(0.3, 1.2)
    wind(3, 0.06)
    emit({ type: 'gust', x: 0, z: -46.5, strength: 0.5, radius: 7 })
  })
  // the first bell: every eye, and the lens, goes up to the balcony
  beat(t, 10.6, () => bell(330, 0.3))
  camTo(t, 10.6, 2.0, { target: up, pos: [hp.pos[0], hp.pos[1], hp.pos[2] - 0.3] })
  // a band of gold appears at the rail …
  t.to(world, { scroll: 0.08, duration: 1.0, ease: 'power2.out' }, 11.8)
  beat(t, 12.0, () => emit({ type: 'sparkle', pos: new THREE.Vector3(SCROLL.x, SCROLL.top - 0.1, SCROLL.z + 0.1), count: 10, color: '#fff2b8' }))
  // … the second bell, and it comes down slowly, the lens following it
  beat(t, 13.0, () => bell(440, 0.26))
  t.to(world, { scroll: 1, duration: 4.8, ease: 'sine.inOut' }, 13.2)
  camTo(t, 13.2, 4.8, { target: down })
  // everyone reacts as the name comes into view
  beat(t, 16.0, () => {
    act('father', 'cheer')
    act('mother', 'clap')
  })
  beat(t, 16.3, () => act('luc', 'omQuyen'))
  beat(t, 16.6, () => act('uni', 'peace'))
  beat(t, 16.9, () => act('hanoi', 'cheer'))
  beat(t, 17.2, () => {
    act('princess', 'dance')
    for (let i = 0; i < 6; i++) {
      gsap.delayedCall(i * 0.4, () => {
        const n = world.chars.princess.pos
        emit({ type: 'sparkle', pos: new THREE.Vector3(n.x, 0.8, n.z), count: 8, color: i % 2 ? '#ffd98a' : '#ffc2d8' })
      })
      gsap.delayedCall(0.2 + i * 0.35, () => emit({ type: 'sparkle', pos: new THREE.Vector3(SCROLL.x + (Math.random() - 0.5) * 1.6, SCROLL.top - Math.random() * 2.4, SCROLL.z + 0.1), count: 3, color: '#fff2b8' }))
    }
  })
  beat(t, 17.4, () => duckMusic(1, 2.5))
  // it hangs open: a last soft bell, and light runs down the writing
  beat(t, 18.0, () => bell(523, 0.16))
  t.fromTo(world, { scrollSheen: -0.1 }, { scrollSheen: 1.1, duration: 1.7, ease: 'sine.inOut' }, 18.0)
  beat(t, 19.75, () => (world.scrollSheen = -1))
  t.to(world.glow, { hue: 1.25, duration: 2.5, ease: 'sine.inOut' }, 18.4)
  t.to(uGlow, { value: 1.25, duration: 2.5, ease: 'sine.inOut' }, 18.4)
  // the princess turns to you — and the invitation appears
  beat(t, 19.3, () => {
    lookAt('princess', 'camera')
    act('princess', 'beckon')
  })
  beat(t, 19.9, () => useUI.setState({ invite: true }))
  allowContinue(t, 21.0)
}

/** The farewell — the list rolls up, and they all go in through Ngọ Môn to stand before Điện Thái Hòa. */
function playFinale() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false, invite: false, caption: null, step: 'finale' })
  const tall = narrow()
  const H = MARKS.hall
  const back = NGOMON.z - NGOMON.depth / 2 // the inner face of Ngọ Môn
  const foot = HALL.terraceFront + 1.5 // the foot of the stairs
  // the golden list rolls back up: the way in is open
  world.scrollSheen = -1
  t.to(world, { scroll: 0, duration: 1.5, ease: 'power2.inOut' }, 0)
  beat(t, 0.1, () => bell(392, 0.2))
  // in single file through the central arch, over the Trung Đạo bridge, up to the hall
  const file = (id: CharId, at: number, side: number, speed = 2.3) =>
    beat(t, at, () => {
      const [x, y, z] = H[id]
      const lane = side * 0.3
      const pts: V3[] = [
        [lane, 0, NGOMON.z + NGOMON.depth / 2 + 0.6],
        [lane, 0, back - 0.4],
        [lane, 0, foot + 1.2],
      ]
      // the back row climbs the stairs to the terrace
      if (y > 0) pts.push([x * 0.6, 0, foot + 0.05], [x * 0.9, y, HALL.terraceFront - 0.05])
      pts.push([x, y, z])
      act(id, 'none')
      lookAt(id, null)
      walk(id, pts, speed, 0)
    })
  beat(t, 0.5, () => {
    lookAt('princess', 'camera')
    act('princess', 'beckon')
  })
  file('princess', 1.2, 0)
  file('father', 1.6, -1)
  file('mother', 2.05, 1)
  file('uni', 2.1, -1)
  file('hanoi', 2.55, 1)
  // Lực waves you in, then runs after them
  beat(t, 1.4, () => {
    lookAt('luc', 'camera')
    act('luc', 'beckon')
  })
  file('luc', 3.6, 0)
  // the lens follows well behind them, and stops just inside: the two rows, the great hall above
  // (on wide screens it stands a little to the left, so the group clears the card in the corner)
  const end: V3 = tall ? [0, 1.75, back - 0.3] : [-0.9, 1.6, back - 1.6]
  const look: V3 = tall ? [0, 1.25, HALL.bodyFront] : [-0.9, 1.8, HALL.bodyFront]
  camPath(t, 2.5, 7.3, [[0, 2.2, -44.6], [0, 1.6, NGOMON.z + NGOMON.depth / 2 + 0.9], [0, 1.5, NGOMON.z], end], [[0, 1.6, -50], [0, 1.5, back - 3], [0, 1.7, foot], look], 'sine.inOut', false)
  camTo(t, 2.5, 7.3, { fov: tall ? 50 : 54, dof: 0.45, tilt: 0, backoff: 0, range: 7 }, 'sine.inOut')
  camTo(t, 4.2, 5, { focus: [0, 1, foot] })
  beat(t, 3.6, () => {
    world.shadowSize = 22
    world.shadowFocus.set(0, 0, -57)
  })
  lightSlot(t, 4.0, 0, [0, 2.6, foot + 0.6], 8, 2.5, '#ffcf80', 10)
  lightSlot(t, 4.0, 1, [-3, 2.6, HALL.terraceFront - 0.6], 5, 2.5)
  lightSlot(t, 4.0, 2, [3, 2.6, HALL.terraceFront - 0.6], 5, 2.5)
  // they turn to you and wave goodbye
  const ids: CharId[] = ['uni', 'father', 'luc', 'princess', 'mother', 'hanoi']
  beat(t, 8.5, () => ids.forEach((id) => lookAt(id, 'camera')))
  beat(t, 9.2, () => {
    act('luc', 'wave')
    act('uni', 'wave')
  })
  beat(t, 9.7, () => {
    act('hanoi', 'peace')
    act('father', 'cheer')
    act('mother', 'clap')
    act('princess', 'dance')
  })
  beat(t, 10.2, () => {
    orbit(0.3, 0.16, 0.1, 0.12)
    useUI.setState({ finale: true, busy: false })
  })
  beat(t, 10.8, () => {
    idle.push(gsap.to(world.cam.pos, { x: end[0] + 0.4, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
    const acts: Record<string, readonly Action[]> = {
      luc: ['wave', 'scratch', 'omQuyen', 'laugh'],
      uni: ['wave', 'peace', 'hop'],
      hanoi: ['peace', 'hop', 'wave', 'cheer'],
      father: ['cheer', 'wave', 'usher'],
      mother: ['clap', 'smile', 'wave'],
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
            emit({ type: 'sparkle', pos: new THREE.Vector3(c.x, c.y + 1.2, c.z), count: 6, color: '#ffd98a' })
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
  place('luc', [...MARKS.lucLane] as V3, 0)
  place('father', [-asideX(), 0, MARKS.fatherAside[2]], 0.2)
  place('mother', [asideX(), 0, MARKS.motherAside[2]], -0.2)
  setCam(lanePose())
  playHue(false)
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
  place('father', [...MARKS.father] as V3, -0.7)
  place('mother', [...MARKS.mother] as V3, -0.75)
  place('princess', [...MARKS.princess] as V3, 0)
  for (const id of Object.keys(world.chars) as CharId[]) world.chars[id].look = null
  world.gate.light = 0
  world.glow.hanoi = world.glow.village = world.glow.hue = 0
  uGlow.value = 1
  world.villageWave = 0
  world.scroll = 0
  world.scrollSheen = -1
  duckMusic(1, 0.3)
  world.diploma = 0
  world.laptop = 0.9
  world.bubble = 0
  world.wipe.kind = 'none'
  world.wipe.p = 0
  world.cam.drift = 1
  world.shadowFocus.set(0, 0, 5)
  world.shadowSize = 14
  world.lights.forEach((l) => (l.intensity = 0))
}
