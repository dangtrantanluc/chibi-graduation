import gsap from 'gsap'
import * as THREE from 'three'
import { keepWish, lanternSlots, ui, useUI, WISH_MAX, type Caption, type Step } from '../state/store'
import { act, emit, lookAt, place, walk, world, type Action, type CharId } from '../state/world'
import { BENCH, BIKE, CONGLANG, DOANMON, GATE, HALL, LANTERN, MARKS, NGOMON, SCROLL, SCROLL_HALF, STREET, UNI_BENCH, VILLAGE_END, YARD_LAMP } from '../three/layout'
import { uGlow } from '../three/lib/materials'
import { bell, drum, duckMusic, fadeOutMusic, footsteps, moo, playZone, train, trainReady, wind } from '../audio/music'
import { CAST, INVITE } from '../config'
import { setGrade } from '../three/grade'
import { wishOr } from '../three/fx/lanternPaper'

/**
 * The story director: Lực's journey, one chapter per tap. Every camera move,
 * character beat and transition is a GSAP timeline mutating `world`.
 *
 *   I   Bình Định — Lực on a bench under the Hoàng Đế gate: a shy grin, a
 *       Bình Định martial salute, then he walks into the light
 *   II  Nông Lâm — the North–South express carries him to Sài Gòn; his CNTT
 *       friend looks up from her laptop, "</>", a high-five
 *   III Hà Nội — a gust of autumn leaves. The first journey he chose for himself,
 *       far and alone: the street's high, wide frame again, but this time he
 *       does not stop — and as he walks on a golden dragon rises from behind
 *       Đoan Môn (Thăng Long, 'the dragon rises'). By a bicycle loaded with
 *       daisies his Hà Nội friend teaches the shy boy her V-sign, and gives
 *       you a bunch of cúc họa mi
 *   IV  home — through Đoan Môn; the train passes again, the other way (Hà Nội –
 *       Bồng Sơn), and he is back in Bình Định: the village gate, his parents
 *       waiting in the yard of their thatched house. He greets them, shows
 *       his diploma, and lights the lantern at the mouth of the yard from the
 *       lamp he has carried all the way — the lane's lanterns take from it,
 *       one after another; then they step to either side of the lane to see
 *       him off
 *   V   Ngọ Môn — out under the bamboo to Huế (the journey theme dies away:
 *       footsteps, wind, a small bell, then the Huế theme); everyone is there.
 *       News of a degree was once proclaimed at the capital, so the golden
 *       list is lowered like the old rite (lễ Truyền lô): a hush, three drum
 *       beats, a band of gold; half open it proclaims Lực, and he bows to it;
 *       then it unrolls the rest of the way and invites you by name
 *
 * The capital is the thread: the Hoàng Đế citadel was the Tây Sơn capital,
 * Thăng Long the capital of a thousand years, Huế the last one — and his
 * parents hear the news first, before it is told to everyone there.
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
let dragonTween: gsap.core.Tween | null = null
/**
 * Send the golden dragon along one of its routes (0 Thăng Long, 1 Huế). It flies on its own
 * clock, not the chapter's: if the guest moves on, it finishes its flight.
 */
function flyDragon(route: 0 | 1, duration: number) {
  dragonTween?.kill()
  world.dragon.route = route
  world.dragon.k = 0
  dragonTween = gsap.to(world.dragon, { k: 1, duration, ease: 'none', onComplete: () => void (world.dragon.k = -1) })
  wind(Math.min(duration, 5), 0.07)
  bell(196, 0.2)
}
/** move the flight of Lạc birds to wheel over (x, z) at height y, radius r */
function birdsTo(x: number, y: number, z: number, r: number) {
  Object.assign(world.birds, { x, y, z, r })
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
const name = () => ui().guest || INVITE.defaultGuest
/** the guest's name where it opens a sentence */
const Name = () => name().charAt(0).toLocaleUpperCase('vi') + name().slice(1)

// ── Dialogue ───────────────────────────────────────────────
const CAPTIONS: Record<string, () => Caption> = {
  home: () => ({
    chapter: 'I',
    place: 'Bình Định · Cổng thành Hoàng Đế',
    speaker: CAST.luc,
    color: '#34353b',
    line: `${Name()} tới rồi à! Đi với mình một chuyến nhé.`,
  }),
  campus: () => ({
    chapter: 'II',
    place: 'Sài Gòn · ĐH Nông Lâm',
    line: `Ê ${CAST.luc}! Bốn năm rồi đó. Đập tay cái nào!`,
  }),
  hanoi: () => ({
    chapter: 'III',
    place: 'Hà Nội · Hoàng thành Thăng Long',
    line: 'Ngày đầu ra đây cậu nhát lắm. Cười lên xem nào!',
  }),
  village: () => ({
    chapter: 'IV',
    place: 'Về nhà · Bình Định',
    speaker: CAST.luc,
    color: '#34353b',
    line: 'Bố mẹ ơi… con làm được rồi.',
  }),
  parents: () => ({
    chapter: 'IV',
    place: 'Về nhà · Bình Định',
    speaker: CAST.parents,
    color: '#8a5a32',
    line: 'Về là mừng rồi. Đi đi con, mọi người đang đợi.',
  }),
  // V: the princess is the herald — one line, the graduate's name (xướng danh).
  // The invitation is left to the golden list itself, as it unrolls.
  proclaim: () => ({
    chapter: 'V',
    place: 'Huế · Ngọ Môn',
    speaker: CAST.princess,
    color: '#b3262e',
    line: `Tân Kỹ Sư ${CAST.luc}!`,
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
    ? { pos: [-1.1, 1.75, -35.5], target: [2.8, 1.15, -39.15], fov: 58, focus: [3.0, 0.9, -38.9], dof: 0.8, tilt: 0.1, range: 3.6, backoff: 0 }
    : { pos: [-0.6, 1.6, -35.9], target: [3.2, 1.05, -39.1], fov: 40, focus: [3.0, 0.9, -38.9], dof: 0.9, tilt: 0.1, range: 3.8, backoff: 0 }
}
/** … then down the lane: his parents either side of it, the bamboo arch and Ngọ Môn beyond */
function lanePose(): Shot {
  return narrow()
    ? { pos: [0, 1.9, -35.4], target: [0, 1.2, -43], fov: 46, focus: [0, 0.9, -40.7], dof: 0.7, tilt: 0.1, range: 4.5, backoff: 0 }
    : { pos: [0.2, 1.6, -36.1], target: [0, 1.15, -43], fov: 38, focus: [0, 0.9, -40.7], dof: 0.9, tilt: 0.1, range: 4.2, backoff: 0 }
}
/** … and before that, close on the two of them at the edge of the lane: Lực, and the lantern he lights */
function kindlePose(): Shot {
  const mid = (YARD_LAMP.x + YARD_LAMP.luc[0]) / 2
  return narrow()
    ? { pos: [mid + 0.15, 1.45, YARD_LAMP.z + 3.9], target: [mid + 0.03, 0.6, YARD_LAMP.z], fov: 38, focus: [YARD_LAMP.x, 0.4, YARD_LAMP.z], dof: 0.6, tilt: 0, range: 2, backoff: 0 }
    : { pos: [mid + 0.45, 1.25, YARD_LAMP.z + 3.4], target: [mid + 0.39, 0.78, YARD_LAMP.z], fov: 34, focus: [YARD_LAMP.x, 0.4, YARD_LAMP.z], dof: 0.8, tilt: 0, range: 2, backoff: 0 }
}
/**
 * III: the frame of the street again — high and far, Lực small in a wide place, alone. But there
 * the lens drew away from him; here it comes down to him as he walks on.
 */
function alonePose(): [Shot, Shot] {
  // (from over the lane behind him, between the crowns of the trees that line it: the gate ahead, he small before it)
  const fov = narrow() ? 50 : 40
  return [
    { pos: [0.3, 8.0, -10.8], target: [0, 0.6, -21.4], fov, focus: [0.6, 0.8, -18.6], dof: 0.3, tilt: 0.55, range: 9, backoff: 0 },
    { pos: [0.5, 5.8, -12.4], target: [-0.1, 0.9, -22.0], fov },
  ]
}
/** IV: the way his father faces in the yard — square to the lens, so his right hand is toward his son */
const FACE_LENS = -0.873
/** … and the way Lực faces to bow to him */
const TO_FATHER = 0.704
/** how far from the middle of the lane his parents stand to see him off */
const asideX = () => (narrow() ? 1.15 : 1.5)

function huePose(): Shot {
  // wide screens: just past the bamboo, close on the row before the gate.
  // phones: from back in the lane, through the bamboo — all of Ngọ Môn, the six of them small beneath the list
  return narrow()
    ? { pos: [0, 2.2, VILLAGE_END + 1.5], target: [0, 1.6, NGOMON.z + 1.2], fov: 52, focus: [0, 1.2, MARKS.princess[2] - 0.5], dof: 0.4, backoff: 0, range: 8 }
    : { pos: [0, 2.85, VILLAGE_END - 1.4], target: [0, 1.95, NGOMON.z - 1], fov: 46, focus: [0, 1.3, MARKS.princess[2] - 0.5], dof: 0.55, backoff: 0, range: 7 }
}
/** where everyone stands before Ngọ Môn: a row, closed up a little on phones */
const hueMarks = () => (narrow() ? MARKS.hueTall : MARKS.hue)

// ── Scenes ─────────────────────────────────────────────────
export function startIntro() {
  resetWorld()
  // before dawn: the board asleep under the stars, one lamp alight on the bench beside him
  setGrade('predawn')
  birdsTo(0, 5.7, 3.4, 5.6)
  const t = newTimeline()
  setCam(SHOTS.intro)
  orbit(0.6, 0.3, 0.1, 0.3)
  lightSlot(t, 0, 0, [0, 1.6, 3.6], 0, 0.1)
  // slow, dreamy drift while the guest writes their name
  idle.push(gsap.to(world.cam.pos, { x: 1.8, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  idle.push(gsap.to(world.cam.target, { x: 0.7, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  fidget('luc', ['think', 'smile'], 4.2)
  useUI.setState({ step: 'intro', busy: false, canContinue: false, caption: null, invite: false, finale: false, lantern: 'off', wish: '', flash: 0 })
}

/** I · Bình Định */
function playHome() {
  const t = newTimeline()
  useUI.setState({ step: 'home', busy: true, canContinue: false })
  orbit(0.45, 0.25, 0.1)
  act('luc', 'none')
  // the sun comes up over his home town as the lens glides in
  beat(t, 0.3, () => setGrade('dawn', 5.5))
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
  // its sound is a recording made on Vietnam's railways (begun early, so that it is loudest as the
  // coaches fill the frame); a small bell stands in while that file is not there
  beat(t, 2.2, () => train())
  beat(t, 3.2, () => trainReady() || bell(523, 0.12))
  // II-a · the first years — lost in the crowd. Behind the train is not the campus but the
  // street: a grey sky, people and motorbikes streaming past, nobody who knows him. He stops on
  // the refuge in the middle of the crossing, small, with his lamp, and looks one way and the other.
  beat(t, 3.8, () => {
    mount(3)
    setGrade('overcast')
    birdsTo(5, 7.4, -7, 6)
    world.city = true
    world.veil = 0
    // (from over the heads of the people on the near pavement)
    setCam({ pos: [-2.1, 2.2, -0.7], target: [0.1, 0.7, 3.4], fov: 36, focus: [0, 0.9, 3.2], dof: 0.8, tilt: 0.1, range: 3.5, backoff: 0.3 })
    world.gate.light = 0
    world.lights[0].intensity = 0
    world.shadowFocus.set(0, 0, 2)
    orbit(0.3, 0.2, 0.1, 0.2)
    place('luc', [0, 0, 4.35], Math.PI)
    walk('luc', [[0, 0, 3.3], [...MARKS.lucStreet] as V3], 0.85, Math.PI)
    lookAt('uni', null)
    act('uni', 'type')
    world.laptop = 1
    world.cow.up = 0
    world.cow.moo = 0
  })
  beat(t, 4.7, () => (world.wipe.kind = 'none'))
  setStep(t, 4.4, 'campus')
  // the lens rises and draws back: the street grows, he shrinks
  camTo(t, 4.9, 5.6, { pos: [-5.6, 5.8, -3.8], target: [0.3, 0.4, STREET.mid], fov: 40, focus: [0, 0.8, STREET.mid], dof: 0.3, tilt: 0.55, backoff: 0.3, range: 9 })
  beat(t, 6.6, () => act('luc', 'lookAbout'))
  // … until someone calls his name. The sun comes through.
  beat(t, 9.9, () => {
    act('uni', 'surprise')
    lookAt('uni', 'luc')
  })
  t.to(world, { laptop: 0.35, duration: 0.6, ease: 'sine.inOut' }, 10.0)
  beat(t, 10.3, () => {
    act('uni', 'wave')
    lookAt('luc', 'uni')
    act('luc', 'surprise')
    world.chars.luc.faceY = 2.2
    setGrade('noon', 3.2)
    bell(659, 0.1)
  })
  t.to(world, { bubble: 1, duration: 0.5, ease: 'back.out(2)' }, 10.4)
  // II-b · he crosses to her
  beat(t, 11.3, () => {
    lookAt('luc', null)
    walk('luc', [[0, 0, 1.0], [0.6, 0, -1.6], [2.4, 0, -6.0], [...MARKS.lucCampus] as V3], 2.3, -0.9)
    world.shadowFocus.set(3, 0, -6)
    orbit(0.5, 0.28, 0.1)
  })
  camPath(t, 11.3, 4.8, [[-3.6, 2.7, -2.4], [-2.4, 1.8, -3.5], SHOTS.campus.pos], [[0.8, 1.1, -0.6], [3.2, 1.45, -7.4], SHOTS.campus.target], 'sine.inOut')
  camTo(t, 11.3, 4.8, { fov: SHOTS.campus.fov, focus: SHOTS.campus.focus, dof: 1, tilt: 0.1, range: SHOTS.campus.range, backoff: 0.6 })
  // out on the lawn the campus cow lifts its head from the grass to see who has come
  beat(t, 13.4, () => (world.cow.up = 1))
  beat(t, 15.9, () => {
    lookAt('uni', 'camera')
    lookAt('luc', 'uni')
    act('uni', 'wave')
    act('luc', 'wave')
  })
  caption(t, 16.2, CAPTIONS.campus(), ['uni'])
  // a high-five
  beat(t, 17.6, () => {
    act('uni', 'hi5')
    act('luc', 'hi5')
  })
  // … and has the last word. (Nông Lâm, everyone says, is the university with the cows.)
  beat(t, 18.3, () => moo())
  t.to(world.cow, { moo: 1, duration: 0.45, ease: 'back.out(2)' }, 18.3)
  beat(t, 18.8, () => {
    lookAt('uni', 'camera')
    lookAt('luc', 'camera')
    act('uni', 'peace')
    act('luc', 'laugh')
  })
  allowContinue(t, 19.0)
  t.to(world.cow, { moo: 0, duration: 0.4 }, 21.6)
  beat(t, 22.2, () => (world.cow.up = 0))
  beat(t, 21.0, () => {
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
  t.to(world.cow, { moo: 0, duration: 0.4 }, 0.2)
  beat(t, 0.2, () => (world.cow.up = 0))
  camTo(t, 0.2, 1.6, { pos: [-0.6, 2.2, -1.8], target: [-1.4, 2.4, -10] }, 'sine.in')
  beat(t, 0.6, () => emit({ type: 'gust', x: 1, z: -5, strength: 1.1, radius: 6 }))
  beat(t, 0.7, () => (world.wipe.kind = 'leaves'))
  t.fromTo(world.wipe, { p: 0 }, { p: 1, duration: 2.4, ease: 'sine.inOut' }, 0.7)
  flash(t, 1.35, 0.3, 0.5, 0.9)
  // He is alone again in a place he does not know — the street's frame, high and far — but this
  // was the journey he chose and paid for himself, and he does not stop: he walks straight on.
  const [alone, closer] = alonePose()
  beat(t, 1.9, () => {
    mount(4)
    setGrade('autumn')
    birdsTo(-6, 7.2, -22, 6.5)
    setCam(alone)
    world.shadowFocus.set(-1, 0, -20)
    orbit(0.3, 0.2, 0.1, 0.2)
    place('luc', [1.2, 0, -16.8], Math.PI * 0.9)
    walk('luc', [[0.4, 0, -20.0], [...MARKS.lucHanoi] as V3], 1.3, 0.2)
    lookAt('hanoi', null)
    world.chars.hanoi.faceY = BIKE.ry
    world.glow.hanoi = 0.35
    world.laptop = 0
  })
  beat(t, 3.1, () => (world.wipe.kind = 'none'))
  // (where the lens drew away from him in the street, here it comes down to him)
  camTo(t, 1.9, 2.7, closer, 'sine.out')
  setStep(t, 2.6, 'hanoi')
  for (const at of [3.0, 4.6, 6.4, 9.0, 12.5]) beat(t, at, () => emit({ type: 'gust', x: -1 + Math.random() * 2, z: -21 + Math.random() * 2, strength: 0.7, radius: 4 }))
  // Thăng Long — "the dragon rises". As he walks on, a golden dragon lifts out from behind the
  // gate ahead of him, winds once about the pavilion and is gone into the autumn sky. They both
  // look up; so does the lens.
  beat(t, 4.0, () => flyDragon(0, 7))
  beat(t, 4.5, () => {
    act('hanoi', 'surprise')
    world.chars.hanoi.faceY = -2.6
    world.chars.hanoi.look = world.dragonPos
    world.chars.luc.look = world.dragonPos
  })
  camTo(t, 4.7, 2.2, { pos: [1.9, 1.15, -15.2], target: [-0.6, 4.6, -27.4], fov: 46, focus: [0, 5, -27], dof: 0.25, tilt: 0.1, backoff: 0.6, range: 12 })
  beat(t, 6.6, () => act('luc', 'surprise'))
  beat(t, 7.7, () => act('hanoi', 'cheer'))
  beat(t, 9.0, () => orbit(0.5, 0.28, 0.1))
  camTo(t, 9.0, 2.0, SHOTS.hanoi)
  // The friend who changed him. She turns to him with a hop: he was so shy, the first time …
  beat(t, 10.4, () => {
    world.chars.hanoi.faceY = 0.9
    lookAt('hanoi', 'luc')
    act('hanoi', 'hop')
    lookAt('luc', 'hanoi')
  })
  caption(t, 10.9, CAPTIONS.hanoi(), ['hanoi'])
  beat(t, 11.6, () => act('luc', 'scratch'))
  // … so: like this. Her V-sign, to you, with a wink —
  beat(t, 13.2, () => {
    lookAt('hanoi', 'camera')
    act('hanoi', 'peace')
  })
  // — and his: a first try with one eye still on her, to see if he has it right; she laughs;
  beat(t, 14.4, () => act('luc', 'peace'))
  beat(t, 15.5, () => {
    lookAt('hanoi', 'luc')
    act('hanoi', 'laugh')
  })
  // then the two of them together, to you. He keeps it: it is his from here to the end.
  beat(t, 16.6, () => {
    lookAt('hanoi', 'camera')
    lookAt('luc', 'camera')
    act('hanoi', 'peace')
    act('luc', 'peace')
  })
  // … and she holds out the daisies to you
  beat(t, 18.9, () => {
    act('hanoi', 'offer')
    const p = world.chars.hanoi.pos
    emit({ type: 'sparkle', pos: new THREE.Vector3(p.x + 0.3, 0.85, p.z + 0.3), count: 10, color: '#fff6d0' })
  })
  allowContinue(t, 19.2)
  beat(t, 22.0, () => {
    fidget('hanoi', ['peace', 'hop', 'laugh', 'wave'], 3.2)
    fidget('luc', ['smile', 'scratch', 'peace'], 4.4)
  })
}

/** IV · home — through Đoan Môn, the train back to Bình Định, the village gate: to his parents in the yard of their house */
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
    walk('luc', [[0.1, 0, -24.2], [0, 0, -26.4], [0, 0, z - 1.6], [0, 0, gz + 0.8], [0, 0, gz - 1.6], [1.55, 0, -38.5], [...MARKS.lucVillage] as V3], 2.9, TO_FATHER)
  })
  // the afternoon goes down toward sunset as he comes through the gates
  beat(t, 2.2, () => {
    setGrade('sunset', 5)
    birdsTo(3, 6.4, -40, 6)
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
      [2.0, 1.3, -38.7],
      yp.target,
    ],
    'sine.inOut',
  )
  camTo(t, 1.5, 7.2, { fov: yp.fov, focus: yp.focus, dof: yp.dof, backoff: 0, range: yp.range })
  // Out of Đoan Môn, and the North–South express goes by once more — the other way this time,
  // Hà Nội – Bồng Sơn: the train that took him from home brings him back to it.
  beat(t, 5.2, () => (world.wipe.kind = 'trainHome'))
  t.fromTo(world.wipe, { p: 0 }, { p: 1, duration: 1.9, ease: 'sine.inOut' }, 5.2)
  beat(t, 4.55, () => train(true))
  beat(t, 5.4, () => trainReady() || bell(523, 0.12))
  beat(t, 7.15, () => (world.wipe.kind = 'none'))
  beat(t, 3.8, () => {
    world.shadowFocus.set(3.1, 0, -39)
    world.glow.hanoi = 0
    orbit(0.28, 0.2, 0.08, 0.15)
  })
  lightSlot(t, 5.0, 2, [2.9, 2.2, -38.5], 4, 1.2)
  setStep(t, 7.0, 'village')
  // they see him coming: a wave, a smile
  beat(t, 5.4, () => {
    lookAt('father', 'luc')
    lookAt('mother', 'luc')
    act('father', 'wave')
    act('mother', 'smile')
  })
  // He bows to them, deeply, arms folded. Hardly a word: his father lays a hand on his head,
  // his mother's eyes fill.
  beat(t, 8.1, () => {
    lookAt('luc', null)
    lookAt('father', null)
    lookAt('mother', null)
    world.chars.father.faceY = FACE_LENS
    world.chars.mother.faceY = FACE_LENS - 0.2
    act('luc', 'bowDeep')
  })
  caption(t, 8.3, CAPTIONS.village(), ['luc'])
  beat(t, 9.2, () => {
    lookAt('father', 'luc')
    act('father', 'pat')
  })
  beat(t, 9.9, () => {
    lookAt('mother', 'luc')
    act('mother', 'tear')
  })
  // … then out comes his diploma, unrolled for them to read
  beat(t, 12.3, () => {
    lookAt('father', null)
    lookAt('mother', null)
    world.chars.father.faceY = -1.35
    world.chars.mother.faceY = -1.3
    act('luc', 'present')
  })
  t.to(world, { diploma: 1, duration: 1.7, ease: 'power2.out' }, 12.6)
  beat(t, 12.8, () => bell(523, 0.14))
  beat(t, 13.9, () => {
    act('mother', 'clap')
    act('father', 'cheer')
  })
  beat(t, 14.3, () => emit({ type: 'gust', x: 2.8, z: -39.1, strength: 0.4, radius: 3 }))
  // he turns to show it to you too
  beat(t, 15.3, () => {
    lookAt('luc', 'camera')
    world.chars.luc.faceY = -0.8
  })
  // Then the lamp. He has carried its flame the whole way; now he brings it home: he goes to the
  // low lantern at the edge of the lane and lights it from his own — and the lanterns along the lane
  // take from it, one after another.
  const KINDLE = 16.6
  caption(t, KINDLE, null)
  beat(t, KINDLE, () => {
    act('luc', 'none')
    lookAt('luc', null)
    walk('luc', [[...YARD_LAMP.luc]], 1.5, 0.3)
    world.shadowFocus.set(0.4, 0, -39.4)
    world.sparkTo.set(YARD_LAMP.x - 0.02, YARD_LAMP.mouth, YARD_LAMP.z)
    world.spark = -1
  })
  t.to(world, { diploma: 0, duration: 0.8 }, KINDLE)
  beat(t, KINDLE + 0.3, () => {
    world.chars.father.faceY = -1.7
    world.chars.mother.faceY = -1.9
    lookAt('father', 'luc')
    lookAt('mother', 'luc')
  })
  camTo(t, KINDLE, 2.2, kindlePose())
  beat(t, KINDLE + 1.8, () => {
    // (his eyes on the lantern, but not so far round that the lens loses his face)
    lookAt('luc', [YARD_LAMP.x - 0.3, 0.55, YARD_LAMP.z + 1.1])
    act('luc', 'kindle')
  })
  t.fromTo(world, { spark: 0 }, { spark: 1, duration: 0.55, ease: 'none' }, KINDLE + 2.4)
  beat(t, KINDLE + 2.96, () => {
    world.spark = -1
    bell(784, 0.1)
    emit({ type: 'sparkle', pos: new THREE.Vector3(YARD_LAMP.x, YARD_LAMP.mouth + 0.1, YARD_LAMP.z), count: 8, color: '#ffd28a' })
  })
  t.to(world, { villageWave: 0.16, duration: 0.7, ease: 'sine.out' }, KINDLE + 2.95)
  lightSlot(t, KINDLE + 2.95, 2, [YARD_LAMP.x + 0.35, 0.35, YARD_LAMP.z + 0.1], 1.4, 1.4, '#ffcf80', 3.5)
  // (the lane's lanterns, nearest first)
  t.to(world, { villageWave: 1, duration: 3.2, ease: 'sine.inOut' }, KINDLE + 3.8)
  beat(t, KINDLE + 3.9, () => {
    emit({ type: 'gust', x: 0.6, z: -39.4, strength: 0.4, radius: 3.5 })
    lookAt('luc', 'camera')
    act('luc', 'smile')
    act('mother', 'clap')
  })
  // then he steps into the lane, and they go to either side of it to send him on:
  // his mother comes round behind him to the far side, his father down the house side
  const LANE = KINDLE + 4.7
  const ax = asideX()
  beat(t, LANE, () => {
    act('luc', 'none')
    lookAt('luc', null)
    walk('luc', [[...MARKS.lucLane] as V3], 1.5, 0)
    world.shadowFocus.set(0, 0, -40)
  })
  beat(t, LANE + 0.2, () => {
    walk('father', [[2.2, 0, -40.3], [ax, 0, MARKS.fatherAside[2]]], 1.9, -0.2)
    lookAt('father', null)
  })
  beat(t, LANE + 0.5, () => {
    walk('mother', [[3.0, 0, -39.4], [2.4, 0, -41.3], [1.4, 0, -42.0], [0, 0, -41.95], [-ax, 0, -41.6], [-ax, 0, MARKS.motherAside[2]]], 2.9, 0.2)
    lookAt('mother', null)
  })
  camTo(t, LANE, 3.0, lanePose())
  lightSlot(t, LANE + 0.4, 2, [0, 2.4, -40.1], 8, 2, '#ffcf80')
  beat(t, LANE + 1.7, () => {
    lookAt('luc', 'camera')
    act('luc', 'smile')
  })
  beat(t, LANE + 3.3, () => {
    lookAt('father', 'camera')
    lookAt('mother', 'camera')
  })
  caption(t, LANE + 3.6, CAPTIONS.parents(), ['father', 'mother'])
  beat(t, LANE + 4.6, () => {
    act('father', 'usher')
    act('mother', 'usher')
  })
  allowContinue(t, LANE + 5.2)
  beat(t, LANE + 7.4, () => {
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
  /** how long the send-off takes before he sets out (nothing, when a returning guest jumps straight here) */
  const SHIFT = bridge ? 3.1 : 0
  // He steps on between them — and his mother comes in behind him: two pats on the back. Go on.
  if (bridge) {
    beat(t, 0.2, () => {
      lookAt('luc', null)
      act('luc', 'none')
      walk('luc', [[...MARKS.lucGo] as V3], 1.6, Math.PI)
      lookAt('father', 'luc')
      lookAt('mother', 'luc')
    })
    beat(t, 0.9, () => {
      lookAt('mother', null)
      walk('mother', [[...MARKS.motherPat] as V3], 1.7, Math.PI)
      act('father', 'usher')
    })
    // from above and behind: two backs, and her hand on his pack
    camTo(t, 0.2, 2.4, narrow() ? { pos: [0.1, 2.5, -37.8], target: [-0.2, 0.7, -41.4], focus: [-0.2, 0.8, -41.2] } : { pos: [0.2, 2.35, -38.3], target: [-0.2, 0.7, -41.4], fov: 34, focus: [-0.2, 0.8, -41.2] })
    beat(t, 2.3, () => act('mother', 'patBack'))
    beat(t, 2.62, () => act('luc', 'nudge'))
  }
  beat(t, 0.4, () => {
    // the friends and the princess are already waiting at Ngọ Môn (seen through the bamboo)
    for (const id of ['uni', 'hanoi', 'princess'] as CharId[]) {
      const [x, z] = marks[id]
      place(id, [x, 0, z], 0)
      lookAt(id, 'camera')
    }
    act('princess', 'dance')
  })
  // … and he goes, the lamp ahead of him; she steps back out of the lane and they cheer him on
  beat(t, SHIFT + 0.2, () => {
    if (bridge) walk('mother', [[-asideX(), 0, -41.2]], 2.0, 0.3)
  })
  beat(t, SHIFT + 0.4, () => {
    const [lx, lz] = marks.luc
    walk('luc', [[0, 0, ve + 0.6], [0, 0, ve - 1.6], [lx, 0, lz]], 2.35, 0)
    lookAt('mother', 'luc')
    act('father', 'cheer')
  })
  beat(t, SHIFT + 1.1, () => act('mother', 'wave'))
  // night comes on as he leaves the village: by Ngọ Môn it is all lanterns
  beat(t, SHIFT + 1.4, () => {
    setGrade('night', 5)
    birdsTo(0, 8.6, NGOMON.z + 3, 8)
  })
  const hp = huePose()
  if (narrow())
    camPath(t, SHIFT + 0.3, 7.4, [[0, 1.7, -38.1], [0, 1.95, -39.9], hp.pos], [[0, 1.4, -48], [0, 1.5, -52], hp.target], 'sine.inOut')
  else
    camPath(
      t,
      SHIFT + 0.3,
      7.4,
      [
        [0, 1.55, -39.1],
        [0, 1.5, ve + 1.2],
        [0, 1.5, ve - 0.3],
        [0, 1.8, ve - 0.9],
        hp.pos,
      ],
      [
        [0, 1.35, -45.5],
        [0, 1.45, ve - 4],
        [0, 1.7, ve - 6],
        [0, 2.0, -54],
        hp.target,
      ],
      'sine.inOut',
    )
  camTo(t, SHIFT + 0.3, 7.4, { fov: hp.fov, dof: hp.dof, backoff: hp.backoff, range: hp.range, tilt: 0.1 })
  // the music changes region rather than track: the journey theme dies away
  // behind his footsteps, wind in the bamboo, one small bell — then Huế begins
  if (bridge) {
    beat(t, SHIFT + 0.3, () => fadeOutMusic(3))
    beat(t, SHIFT + 0.7, () => footsteps(8, 0.4))
    beat(t, SHIFT + 1.6, () => wind(4.4))
    beat(t, SHIFT + 4.6, () => bell(784, 0.07))
    beat(t, SHIFT + 4.9, () => playZone('hue', 4))
  }
  camTo(t, SHIFT + 3.6, 3.6, { focus: hp.focus })
  lightSlot(t, SHIFT + 3.4, 2, [0, 3.2, NGOMON.z + 4], 10, 2)
  lightSlot(t, SHIFT + 3.4, 0, [-3.3, 2.2, -51], 6, 2)
  lightSlot(t, SHIFT + 3.4, 1, [3.3, 2.2, -51], 6, 2)
  beat(t, SHIFT + 3.8, () => {
    act('princess', 'dance')
    world.villageWave = 1
    world.shadowFocus.set(0, 0, -52)
    world.laptop = 0
  })
  // once the lens has gone by, his parents follow: they come in from either side and take their places
  beat(t, SHIFT + 4.9, () => {
    for (const id of ['father', 'mother'] as CharId[]) {
      const s = id === 'father' ? 1 : -1
      const [x, z] = marks[id]
      lookAt(id, null)
      act(id, 'none')
      walk(id, [[s * 1.3, 0, ve + 0.4], [s * 1.35, 0, ve - 2.2], [x, 0, z]], 3.4, 0)
    }
  })
  beat(t, SHIFT + 6.6, () => {
    lookAt('luc', 'camera')
    orbit(0.5, 0.28, 0.12, 0.25)
  })
  setStep(t, SHIFT + 7.6, 'hue')
  // the princess is the herald: a courtly bow to the guest — no words yet
  beat(t, SHIFT + 7.7, () => {
    lookAt('princess', 'camera')
    act('princess', 'bow')
  })
  beat(t, SHIFT + 8.8, () => {
    lookAt('father', 'camera')
    lookAt('mother', 'camera')
  })
  t.to(world.glow, { hue: 0.35, duration: 2 }, SHIFT + 7.5)

  // ── the golden list is lowered from Lầu Ngũ Phụng, after the old rite of proclamation (lễ Truyền lô) ──
  const up: V3 = [hp.target[0], hp.target[1] + (narrow() ? 1.6 : 1.45), hp.target[2]]
  const down: V3 = [hp.target[0], hp.target[1] + 0.3, hp.target[2]]
  // while the list is read, the lens tilts down so that it and the six below it all sit above the dialogue box
  // (on phones the far, tall framing already holds both)
  const watch: V3 = narrow()
    ? [hp.target[0], (up[1] + down[1]) / 2 + 0.2, hp.target[2]]
    : (() => {
        // pitch the lens so the row's feet sit just above the dialogue box (0.234 rad below the centre of frame)
        const toRow = hp.pos[2] - marks.luc[1]
        const pitch = Math.atan(hp.pos[1] / toRow) - 0.234
        return [hp.target[0], hp.pos[1] - (hp.pos[2] - hp.target[2]) * Math.tan(pitch), hp.target[2]] as V3
      })()
  const others: CharId[] = ['uni', 'father', 'mother', 'hanoi']
  // a hush, and a breath of wind across the plaza
  beat(t, SHIFT + 9.9, () => {
    duckMusic(0.3, 1.2)
    wind(3, 0.06)
    emit({ type: 'gust', x: 0, z: -52.5, strength: 0.5, radius: 7 })
  })
  // three beats of the court drum: the lens goes up to the balcony
  beat(t, SHIFT + 10.7, () => {
    drum(0.5, 0)
    drum(0.5, 0.75)
    drum(0.62, 1.5)
  })
  camTo(t, SHIFT + 10.7, 2.0, { target: up, pos: [hp.pos[0], hp.pos[1], hp.pos[2] - 0.3] })
  // a band of gold appears at the rail …
  t.to(world, { scroll: 0.08, duration: 1.0, ease: 'power2.out' }, SHIFT + 12.6)
  beat(t, SHIFT + 12.8, () => emit({ type: 'sparkle', pos: new THREE.Vector3(SCROLL.x, SCROLL.top - 0.1, SCROLL.z + 0.1), count: 10, color: '#fff2b8' }))
  // … a bell, and it comes down half-way: the proclamation
  beat(t, SHIFT + 13.6, () => bell(440, 0.26))
  t.to(world, { scroll: SCROLL_HALF, duration: 2.6, ease: 'sine.inOut' }, SHIFT + 13.8)
  camTo(t, SHIFT + 13.8, 2.6, { target: watch })
  // xướng danh: the princess reads out his name, and Lực turns to the list and salutes it
  caption(t, SHIFT + 16.1, CAPTIONS.proclaim(), ['princess'])
  beat(t, SHIFT + 16.1, () => act('princess', 'usher'))
  beat(t, SHIFT + 16.6, () => {
    lookAt('luc', null)
    world.chars.luc.faceY = Math.PI
    for (const id of others) lookAt(id, 'luc')
  })
  beat(t, SHIFT + 17.3, () => act('luc', 'omQuyen'))
  beat(t, SHIFT + 17.7, () => {
    act('father', 'cheer')
    act('mother', 'clap')
  })
  beat(t, SHIFT + 18, () => act('uni', 'clap'))
  beat(t, SHIFT + 18.3, () => act('hanoi', 'cheer'))
  // he turns back to you with a shy grin
  beat(t, SHIFT + 19.5, () => {
    world.chars.luc.faceY = 0
    lookAt('luc', 'camera')
  })
  beat(t, SHIFT + 20.1, () => act('luc', 'scratch'))
  // then the list unrolls the rest of the way: the invitation, by name
  caption(t, SHIFT + 20.5, null)
  beat(t, SHIFT + 20.7, () => bell(392, 0.18))
  t.to(world, { scroll: 1, duration: 3.0, ease: 'sine.inOut' }, SHIFT + 20.7)
  if (narrow()) camTo(t, SHIFT + 20.7, 3.0, { target: down })
  // everyone turns to you
  beat(t, SHIFT + 22.7, () => {
    for (const id of others) lookAt(id, 'camera')
    act('uni', 'peace')
    act('hanoi', 'wave')
    act('father', 'usher')
    act('mother', 'clap')
    // (the V-sign his Hà Nội friend taught him)
    act('luc', 'peace')
  })
  beat(t, SHIFT + 23.1, () => {
    act('princess', 'dance')
    for (let i = 0; i < 6; i++) {
      gsap.delayedCall(i * 0.4, () => {
        const n = world.chars.princess.pos
        emit({ type: 'sparkle', pos: new THREE.Vector3(n.x, 0.8, n.z), count: 8, color: i % 2 ? '#ffd98a' : '#ffc2d8' })
      })
      gsap.delayedCall(0.2 + i * 0.35, () => emit({ type: 'sparkle', pos: new THREE.Vector3(SCROLL.x + (Math.random() - 0.5) * 1.6, SCROLL.top - Math.random() * 2.4, SCROLL.z + 0.1), count: 3, color: '#fff2b8' }))
    }
  })
  beat(t, SHIFT + 23.3, () => duckMusic(1, 2.5))
  // … and the golden dragon of Thăng Long passes once more, across the roofs of Ngọ Môn
  beat(t, SHIFT + 25.4, () => flyDragon(1, 7))
  // it hangs open: a last soft bell, and light runs down the writing
  beat(t, SHIFT + 23.9, () => bell(523, 0.16))
  t.fromTo(world, { scrollSheen: -0.1 }, { scrollSheen: 1.1, duration: 1.7, ease: 'sine.inOut' }, SHIFT + 23.9)
  beat(t, SHIFT + 25.65, () => (world.scrollSheen = -1))
  t.to(world.glow, { hue: 1.25, duration: 2.5, ease: 'sine.inOut' }, SHIFT + 24.3)
  t.to(uGlow, { value: 1.25, duration: 2.5, ease: 'sine.inOut' }, SHIFT + 24.3)
  // the invitation card appears, and the lens rises again to take in the gate
  if (!narrow()) camTo(t, SHIFT + 24.9, 2.6, { target: down })
  beat(t, SHIFT + 25.7, () => useUI.setState({ invite: true }))
  allowContinue(t, SHIFT + 26.7)
}

/** The farewell — the list rolls up, and they all go in through Ngọ Môn to stand before Điện Thái Hòa. */
function playFinale() {
  const t = newTimeline()
  useUI.setState({ busy: true, canContinue: false, invite: false, caption: null, step: 'finale' })
  const tall = narrow()
  const H = MARKS.hall
  const back = NGOMON.z - NGOMON.depth / 2 // the inner face of Ngọ Môn
  // the golden list rolls back up: the way in is open
  world.scrollSheen = -1
  restoreLanterns()
  birdsTo(0, 6.0, HALL.bodyFront + 1.5, 6.2)
  t.to(world, { scroll: 0, duration: 1.5, ease: 'power2.inOut' }, 0)
  beat(t, 0.1, () => bell(392, 0.2))
  // in single file through the central arch, over the Trung Đạo bridge, up to the hall
  const file = (id: CharId, at: number, side: number, speed = 2.9) =>
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
  file('mother', 1.6, -1)
  file('father', 2.05, 1)
  file('uni', 2.1, -1)
  file('hanoi', 2.55, 1)
  // Lực waves you in, then runs after them
  beat(t, 1.4, () => {
    lookAt('luc', 'camera')
    act('luc', 'beckon')
  })
  file('luc', 3.6, 0)
  // the lens follows well behind them, and stops just inside: the two rows, the great hall above
  const { pos: end, target: look } = hallPose()
  camPath(t, 2.5, 7.3, [[0, 2.2, -50.6], [0, 1.6, NGOMON.z + NGOMON.depth / 2 + 0.9], [0, 1.5, NGOMON.z], end], [[0, 1.6, -56], [0, 1.5, back - 3], [0, 1.7, foot], look], 'sine.inOut', false)
  camTo(t, 2.5, 7.3, { fov: tall ? 50 : 54, dof: 0.45, tilt: 0, backoff: 0, range: 7 }, 'sine.inOut')
  camTo(t, 4.2, 5, { focus: [0, 1, foot] })
  beat(t, 3.6, () => {
    world.shadowSize = 22
    world.shadowFocus.set(0, 0, -64)
  })
  lightSlot(t, 4.0, 0, HALL_LIGHT, 8, 2.5, '#ffcf80', 10)
  lightSlot(t, 4.0, 1, [-3, 2.6, HALL.terraceFront - 0.6], 5, 2.5)
  lightSlot(t, 4.0, 2, [3, 2.6, HALL.terraceFront - 0.6], 5, 2.5)
  // they turn to you and wave goodbye
  const ids = CAST_IDS
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
  beat(t, 10.8, () => finaleIdle(end[0]))
}

const CAST_IDS: CharId[] = ['uni', 'father', 'luc', 'princess', 'mother', 'hanoi']
const foot = HALL.terraceFront + 1.5 // the foot of the hall's stairs
const HALL_LIGHT: V3 = [0, 2.6, foot + 0.6]
/**
 * Where the lens rests at the end: just inside Ngọ Môn, the two rows and the great hall above.
 * (On wide screens it stands a little to the left, so the group clears the card in the corner.)
 */
function hallPose(): { pos: V3; target: V3; fov: number } {
  const back = NGOMON.z - NGOMON.depth / 2
  return narrow() ? { pos: [0, 1.75, back - 0.3], target: [0, 1.25, HALL.bodyFront], fov: 50 } : { pos: [-0.9, 1.6, back - 1.6], target: [-0.9, 1.8, HALL.bodyFront], fov: 54 }
}
/** while the guest lingers at the end: the lens drifts, and now one of them, now another does something */
function finaleIdle(x: number) {
  idle.push(gsap.to(world.cam.pos, { x: x + 0.4, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  const acts: Record<string, readonly Action[]> = {
    luc: ['wave', 'scratch', 'omQuyen', 'laugh', 'peace'],
    uni: ['wave', 'peace', 'hop'],
    hanoi: ['peace', 'hop', 'wave', 'cheer'],
    father: ['cheer', 'wave', 'usher'],
    mother: ['clap', 'smile', 'wave'],
    princess: ['dance', 'smile'],
  }
  finaleLoop?.kill()
  finaleLoop = gsap.to(
    {},
    {
      duration: 2.6,
      repeat: -1,
      onRepeat: () => {
        const id = CAST_IDS[Math.floor(Math.random() * CAST_IDS.length)]
        const list = acts[id]
        act(id, list[Math.floor(Math.random() * list.length)])
        if (Math.random() < 0.4) {
          const c = world.chars.princess.pos
          emit({ type: 'sparkle', pos: new THREE.Vector3(c.x, c.y + 1.2, c.z), count: 6, color: '#ffd98a' })
        }
      },
    },
  )
}

// ── đèn trời: the guest writes a wish on a sky lantern and lets it go ──────────
let lanternTweens: gsap.core.Tween[] = []
/** the one the next wish goes on (there is no limit: past the pool, the oldest in the sky makes way) */
const nextLantern = () => world.lanterns[lanternSlots(ui().released, ui().wishCount).next]
/** the lanterns this guest has let go (on an earlier visit too) are up there */
function restoreLanterns() {
  const { wishes } = lanternSlots(ui().released, ui().wishCount)
  const n = ui().released.length
  world.lanterns.forEach((L, i) => {
    // (one that is still on its way up keeps climbing)
    if (wishes[i] !== null && L.state === 2) return
    Object.assign(L, wishes[i] !== null ? { state: 2, lit: 1, hold: 1, k: 1 } : { state: 0, lit: 0, hold: 0, k: 0 })
  })
  if (n) {
    world.sky.on = true
    world.sky.t = Math.max(world.sky.t, 45)
  }
}
/** the lens follows the lantern up (eased, so it trails a little behind it) */
function followLantern() {
  const want = new THREE.Vector3()
  return () => {
    const p = world.lanternPos
    want.set(p.x * 0.6, p.y * 0.92 + 0.35, p.z)
    world.cam.target.lerp(want, 0.045)
    world.cam.focus.lerp(p, 0.08)
  }
}

/** the back row's way down the hall's stairs to a place in the court (and, reversed, back up) */
function stairs(id: 'father' | 'mother', down: boolean, to: V3): V3[] {
  const [x, y] = MARKS.hall[id]
  const steps: V3[] = [
    [x * 0.9, y, HALL.terraceFront - 0.05],
    [x * 0.6, 0, foot + 0.05],
  ]
  return down ? [...steps, to] : [...steps.reverse(), to]
}

/** A new lantern is stood on the paving at the end of the bridge; Lực comes to stand by it. */
export function openLantern() {
  const s = ui()
  if (!s.finale || s.lantern === 'write' || s.lantern === 'fly') return
  finaleLoop?.kill()
  finaleLoop = null
  const again = s.lantern === 'done'
  const t = newTimeline()
  const L = nextLantern()
  gsap.killTweensOf(L)
  Object.assign(L, { state: 1, lit: 0, hold: 0, k: 0 })
  world.spark = -1
  useUI.setState({ lantern: 'write', wish: '', busy: true })
  bell(523, 0.1)
  emit({ type: 'sparkle', pos: new THREE.Vector3(LANTERN.x, 0.5, LANTERN.z), count: 10, color: '#ffe2a8' })
  act('luc', 'none')
  lookAt('luc', null)
  walk('luc', [[...LANTERN.luc]], 1.5, 0.3)
  // his friends stand out to either side: while it is written on, the lantern has the court to itself
  // (and after an earlier lantern, his parents go back up to the terrace)
  for (const [id, face] of [
    ['uni', 0.9],
    ['hanoi', -0.85],
  ] as const) {
    act(id, 'none')
    walk(id, [[...LANTERN.aside[id]]], 1.7, face)
  }
  if (again)
    for (const id of ['father', 'mother'] as const) {
      act(id, 'none')
      walk(id, stairs(id, false, MARKS.hall[id]), 2.2, 0)
    }
  CAST_IDS.forEach((id) => id !== 'luc' && (world.chars[id].look = world.lanternPos))
  orbit(0.22, 0.12, 0.06, 0.1)
  // close on the two of them: the lantern, and Lực with his lamp beside it
  // (on a phone the panel is at the top and the keyboard below: the lantern sits in the band between)
  const mid = (LANTERN.x + LANTERN.luc[0]) / 2
  camTo(
    t,
    0,
    2.2,
    narrow()
      ? { pos: [mid + 0.15, 1.45, -58.85], target: [mid + 0.03, 0.42, LANTERN.z], fov: 36, focus: [LANTERN.x, 0.4, LANTERN.z], dof: 0.6, tilt: 0, backoff: 0, range: 1.8 }
      : { pos: [mid + 0.45, 1.25, -59.5], target: [mid + 0.39, 0.78, LANTERN.z], fov: 34, focus: [LANTERN.x, 0.4, LANTERN.z], dof: 0.8, tilt: 0, backoff: 0, range: 1.8 },
  )
  lightSlot(t, 0.4, 0, [LANTERN.x, 1.7, LANTERN.z + 1.3], 6, 1.6, '#ffd9a0', 7)
  // he looks at what is being written, then up at whoever is writing it
  beat(t, 1.3, () => (world.chars.luc.look = world.lanternPos))
  beat(t, 2.4, () => {
    let at = 0
    idle.push(gsap.to({}, { duration: 3.2, repeat: -1, onRepeat: () => void (world.chars.luc.look = at++ % 2 ? world.lanternPos : 'camera') }))
  })
}

/**
 * The wish is written. Lực lights the lantern from his lamp, picks it up and holds it over his
 * head; the others come and stand round him; and they let it go together, up over the hall.
 */
export function releaseLantern() {
  const s = ui()
  if (s.lantern !== 'write') return
  const L = nextLantern()
  keepWish(wishOr(s.wish).slice(0, WISH_MAX))
  useUI.setState({ lantern: 'fly', wish: '' })
  const t = newTimeline()
  const tall = narrow()
  const ring = tall ? LANTERN.ringTall : LANTERN.ring
  const others = CAST_IDS.filter((id) => id !== 'luc')
  beat(t, 0, () => {
    world.chars.luc.look = world.lanternPos
    others.forEach((id) => {
      act(id, 'none')
      world.chars[id].look = world.lanternPos
    })
  })
  // the flame he has carried the whole way is held to its mouth, and takes
  beat(t, 0.3, () => {
    world.sparkTo.set(LANTERN.x - 0.04, 0.1, LANTERN.z)
    act('luc', 'kindle')
  })
  t.fromTo(world, { spark: 0 }, { spark: 1, duration: 0.55, ease: 'none' }, 0.9)
  beat(t, 1.46, () => {
    world.spark = -1
    bell(784, 0.1)
    emit({ type: 'sparkle', pos: new THREE.Vector3(LANTERN.x, 0.2, LANTERN.z), count: 8, color: '#ffd28a' })
  })
  t.to(L, { lit: 1, duration: 1.5, ease: 'sine.inOut' }, 1.45)
  lightSlot(t, 1.45, 0, [LANTERN.x + 0.5, 0.7, LANTERN.z + 0.5], 4.5, 1.5, '#ffc27a', 6)
  // the lens draws back, and everyone comes in to stand round him: his friends from either side,
  // his parents down the stairs (the princess watches from the terrace)
  camTo(t, 2.5, 2.6, { pos: [0, 1.5, tall ? -58.0 : -59.2], target: [0, 1.45, LANTERN.z], fov: tall ? 58 : 50, focus: [0, 1.2, LANTERN.z], dof: 0.25, range: 9 })
  beat(t, 2.6, () => {
    walk('uni', [[...ring.uni]], 2.2, 0.75)
    walk('hanoi', [[...ring.hanoi]], 2.2, -0.75)
    walk('mother', stairs('mother', true, ring.mother), 2.6, 0.3)
    walk('father', stairs('father', true, ring.father), 2.6, -0.3)
  })
  // he picks it up (the lamp goes on its hook) and holds it over his head
  beat(t, 3.3, () => {
    world.chars.luc.faceY = 0
    lookAt('luc', 'camera')
    act('luc', 'lift')
  })
  t.to(L, { hold: 1, duration: 1.15, ease: 'sine.inOut' }, 3.5)
  lightSlot(t, 3.5, 0, [0, 2.3, LANTERN.z + 1.0], 5, 1.2, '#ffc27a', 7)
  // … and together they let it go. From behind the hall the rest of the sky's lanterns are coming up too.
  beat(t, 5.3, () => {
    bell(392, 0.16)
    others.forEach((id) => act(id, id === 'princess' ? 'dance' : 'cheer'))
  })
  beat(t, 5.7, () => {
    L.state = 2
    // (the first of them are already on their way up behind the roofs: they clear the ridge as the lens looks up)
    if (!world.sky.on) world.sky.t = 11
    world.sky.on = true
    wind(5, 0.06)
    lanternTweens.push(gsap.to(L, { k: 1, duration: 17, ease: (p: number) => 0.25 * p * p + 0.75 * p }))
  })
  // (the lens waits a moment — all of them, and the lantern leaving his hands — before it follows it up)
  const follow = followLantern()
  t.to({}, { duration: 6.6, onUpdate: follow }, 7.1)
  lightSlot(t, 6.6, 0, HALL_LIGHT, 8, 2.5, '#ffcf80', 10)
  // his thanks to you, in the way of his home town; then he turns to watch it go with the rest of them
  beat(t, 7.2, () => act('luc', 'omQuyen'))
  beat(t, 9.5, () => {
    world.chars.luc.faceY = Math.PI
    world.chars.luc.look = world.lanternPos
  })
  beat(t, 13.2, () => {
    orbit(0.3, 0.16, 0.12, 0.12)
    useUI.setState({ lantern: 'done', busy: false })
  })
  beat(t, 13.7, () => idle.push(gsap.to({}, { duration: 1, repeat: -1, onUpdate: follow })))
}

/** Back to the farewell and its card (an unlit lantern that was never let go is put away). */
export function closeLantern() {
  const s = ui()
  if (s.lantern !== 'write' && s.lantern !== 'done') return
  // (from the writing panel his parents never left the terrace; after a lantern they are down in the court)
  const gathered = s.lantern === 'done'
  if (s.lantern === 'write') {
    // the unlit one is put away (and if it had taken the place of an old one, that one is back in the sky)
    nextLantern().state = 0
    restoreLanterns()
  }
  world.spark = -1
  const t = newTimeline()
  useUI.setState({ lantern: 'off', wish: '', busy: true })
  const { pos, target, fov } = hallPose()
  for (const id of ['luc', 'uni', 'hanoi'] as const) {
    act(id, 'none')
    walk(id, [[...MARKS.hall[id]]], 1.6, 0)
  }
  if (gathered)
    for (const id of ['father', 'mother'] as const) {
      act(id, 'none')
      walk(id, stairs(id, false, MARKS.hall[id]), 2.2, 0)
    }
  CAST_IDS.forEach((id) => lookAt(id, 'camera'))
  camTo(t, 0, 2.4, { pos, target, fov, focus: [0, 1, foot], dof: 0.45, tilt: 0, backoff: 0, range: 7 })
  lightSlot(t, 0, 0, HALL_LIGHT, 8, 1.5, '#ffcf80', 10)
  beat(t, 2.4, () => {
    orbit(0.3, 0.16, 0.1, 0.12)
    useUI.setState({ busy: false })
    finaleIdle(pos[0])
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
  world.cow.up = world.cow.moo = 0
  useUI.setState({ mounted: 6, caption: null, flash: 0 })
  setGrade('night')
  world.city = true
  world.veil = 0
  place('luc', [...MARKS.lucGo] as V3, Math.PI)
  place('father', [asideX(), 0, MARKS.fatherAside[2]], -0.2)
  place('mother', [-asideX(), 0, MARKS.motherAside[2]], 0.2)
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
  world.cow.up = world.cow.moo = 0
  lanternTweens.forEach((tw) => tw.kill())
  lanternTweens = []
  world.lanterns.forEach((L) => Object.assign(L, { state: 0, lit: 0, hold: 0, k: 0 }))
  world.spark = -1
  world.sky.on = false
  world.sky.t = 0
  world.wipe.kind = 'none'
  world.wipe.p = 0
  world.city = false
  world.veil = 1
  dragonTween?.kill()
  world.dragon.k = -1
  world.cam.drift = 1
  world.shadowFocus.set(0, 0, 5)
  world.shadowSize = 14
  world.lights.forEach((l) => (l.intensity = 0))
}
