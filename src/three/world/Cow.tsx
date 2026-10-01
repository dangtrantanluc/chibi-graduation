import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { G, mergeKit, type Part } from '../lib/kit'
import { canvas, FONT_UI, roundRect, toTexture } from '../lib/textures'
import { Cel } from '../characters/Chibi'
import { world } from '../../state/world'
import { COW } from '../layout'

/*
 * II · the Nông Lâm cow. Everyone teases that Nông Lâm is "the university with
 * the cows", so one of them is here: a small bò vàng (the yellow cattle that
 * really graze the campus lawns — tan coat, cream belly, a little hump, short
 * horns), drawn like the cast: cel-shaded, inked, moving on twos. It wears a
 * bell on a ribbon in the IT faculty's blue and a phượng flower at its ear,
 * grazes by itself, lifts its head when Lực walks in, and has one line.
 */

const COAT = '#d99a52'
const COAT_DK = '#c08040'
const CREAM = '#f4e2bd'
const MUZZLE = '#f6d6c2'
const INK = '#2a2030'
const HOOF = '#5b4636'
const HORN = '#f1e8d2'
const BLUE = '#2f6fd6'

/** the neck turns on the shoulders here (in the cow's own frame: forward is +z) */
const NECK: [number, number, number] = [0, 0.6, 0.3]
/** head pitch when grazing, chewing with the head up, and thrown back to moo */
const GRAZE = 1.3
const CHEW = 0.14
const MOO = -0.4
/** shown at 12 fps and held in between, like the cast */
const STEP = 1 / 12

function bodyParts(): Part[] {
  const p: Part[] = []
  p.push({ g: G.sphere, c: COAT, p: [0, 0.47, -0.05], s: [0.3, 0.27, 0.44] })
  p.push({ g: G.sphere, c: CREAM, p: [0, 0.385, -0.03], s: [0.262, 0.2, 0.37] })
  // the hump over the shoulders, and a rounder rump
  p.push({ g: G.sphere, c: COAT_DK, p: [0, 0.7, 0.2], s: [0.13, 0.1, 0.16] })
  p.push({ g: G.sphere, c: COAT, p: [0, 0.5, -0.3], s: [0.27, 0.24, 0.2] })
  for (const x of [-0.17, 0.17])
    for (const z of [0.2, -0.3]) {
      p.push({ g: G.cyl, c: COAT, p: [x, 0.19, z], s: [0.075, 0.26, 0.075] })
      p.push({ g: G.cyl, c: CREAM, p: [x, 0.1, z], s: [0.079, 0.07, 0.079] })
      p.push({ g: G.cyl, c: HOOF, p: [x, 0.035, z], s: [0.084, 0.07, 0.084] })
    }
  return p
}

function headParts(): Part[] {
  const p: Part[] = []
  p.push({ g: G.sphere, c: COAT, p: [0, 0.08, 0.1], s: [0.15, 0.17, 0.17] })
  p.push({ g: G.sphere, c: COAT, p: [0, 0.2, 0.26], s: [0.25, 0.225, 0.23] })
  p.push({ g: G.sphere, c: MUZZLE, p: [0, 0.115, 0.43], s: [0.165, 0.118, 0.125] })
  p.push({ g: G.sphereLo, c: COAT_DK, p: [0, 0.415, 0.3], s: [0.07, 0.04, 0.06] })
  for (const s of [-1, 1]) {
    p.push({ g: G.sphereLo, c: '#b9806a', p: [s * 0.055, 0.14, 0.548], s: [0.02, 0.014, 0.012] })
    // big dark eyes with a catch-light, and a blush under them
    p.push({ g: G.sphere, c: INK, p: [s * 0.125, 0.25, 0.445], s: [0.038, 0.05, 0.022] })
    p.push({ g: G.sphereLo, c: '#ffffff', p: [s * 0.113, 0.268, 0.464], s: 0.013 })
    p.push({ g: G.sphereLo, c: '#f2a08a', p: [s * 0.178, 0.165, 0.412], r: [0, s * 0.7, 0], s: [0.042, 0.026, 0.012] })
    p.push({ g: G.cone, c: HORN, p: [s * 0.15, 0.455, 0.23], r: [0.15, 0, -s * 0.6], s: [0.05, 0.19, 0.05] })
    // ears held out sideways, pink inside
    p.push({ g: G.sphere, c: COAT, p: [s * 0.29, 0.26, 0.21], r: [0, 0, s * 0.3], s: [0.12, 0.05, 0.07] })
    p.push({ g: G.sphereLo, c: '#f0b6a0', p: [s * 0.295, 0.262, 0.238], r: [0, 0, s * 0.3], s: [0.08, 0.03, 0.045] })
  }
  // the ribbon round its neck and the bell under it
  p.push({ g: G.torus, c: BLUE, p: [0, 0.05, 0.08], r: [-0.66, 0, 0], s: 0.172 })
  p.push({ g: G.sphere, c: '#f2c230', p: [0, -0.1, 0.2], s: 0.055 })
  p.push({ g: G.sphereLo, c: '#b98a1c', p: [0, -0.148, 0.212], s: 0.018 })
  // a phượng flower tucked in at the ear
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    p.push({ g: G.sphereLo, c: '#e2413a', p: [0.21 + Math.cos(a) * 0.036, 0.385 + Math.sin(a) * 0.036, 0.33], s: [0.027, 0.027, 0.014] })
  }
  p.push({ g: G.sphereLo, c: '#ffd36e', p: [0.21, 0.385, 0.342], s: 0.014 })
  return p
}

function tailParts(): Part[] {
  return [
    { g: G.cylLo, c: COAT_DK, p: [0, -0.17, 0], s: [0.018, 0.34, 0.018] },
    { g: G.sphereLo, c: HOOF, p: [0, -0.37, 0], s: [0.045, 0.075, 0.045] },
  ]
}

/** its one line */
function mooTex() {
  const [c, g] = canvas(320, 220)
  g.fillStyle = '#ffffff'
  g.strokeStyle = INK
  g.lineWidth = 7
  roundRect(g, 10, 10, 300, 150, 64)
  g.fill()
  g.stroke()
  // the tail of the bubble, down to the right: the bubble stands up and to the left of the head
  g.beginPath()
  g.moveTo(190, 156)
  g.lineTo(250, 210)
  g.lineTo(236, 156)
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = '#ffffff'
  g.fillRect(194, 148, 40, 12)
  g.fillStyle = '#9a5f24'
  g.font = `800 72px ${FONT_UI}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('ụm bò~', 160, 88)
  return toTexture(c)
}

export function Cow() {
  const root = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const tail = useRef<THREE.Group>(null!)
  const bubble = useRef<THREE.Sprite>(null!)
  const geos = useMemo(() => ({ body: mergeKit(bodyParts()), head: mergeKit(headParts()), tail: mergeKit(tailParts()) }), [])
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: mooTex(), transparent: true, alphaTest: 0.35 }), [])
  const cur = useRef({ pitch: GRAZE, yaw: 0, lift: 0, stepT: 0 })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const cow = world.cow
    const t = world.time
    const a = cur.current
    // its own round: head down in the grass, then up for a while to chew and look about —
    // unless the story has it watching Lực
    const round = (t % 11) / 11
    const watching = cow.up > 0.5
    const up = watching || round > 0.6
    let pitch = up ? CHEW : GRAZE
    let yaw = up ? 0.4 * Math.sin(t * 0.55) : 0.14 * Math.sin(t * 0.8)
    if (watching) {
      const L = world.chars.luc.pos
      yaw = THREE.MathUtils.clamp(Math.atan2(L.x - COW.x, L.z - COW.z) - COW.ry, -0.9, 0.9)
    }
    if (cow.moo > 0.3) pitch = MOO
    a.pitch = THREE.MathUtils.damp(a.pitch, pitch, cow.moo > 0.3 ? 9 : 3.2, dt)
    a.yaw = THREE.MathUtils.damp(a.yaw, yaw, 3.2, dt)
    a.lift = THREE.MathUtils.damp(a.lift, cow.moo > 0.3 ? 1 : 0, 9, dt)

    const b = cow.moo
    bubble.current.visible = b > 0.01
    if (b > 0.01) {
      const pop = b < 1 ? b * (1 + 0.35 * Math.sin(b * Math.PI)) : 1 + 0.03 * Math.sin(t * 4)
      bubble.current.scale.set(1.0 * pop, 0.69 * pop, 1)
      mat.opacity = Math.min(1, b * 1.5)
    }

    a.stepT += dt
    if (a.stepT < STEP) return
    a.stepT %= STEP
    const lowered = THREE.MathUtils.smoothstep(a.pitch, CHEW, GRAZE)
    // tearing at the grass when the head is down; chewing sideways when it is up
    const nibble = lowered * 0.05 * Math.sin(t * 6.5)
    const chew = (1 - lowered) * (1 - a.lift) * 0.05 * Math.sin(t * 7.5)
    head.current.rotation.set(a.pitch + nibble, a.yaw, chew)
    // the tail swings, with a quick flick now and then
    const flick = Math.max(0, Math.sin(t * 0.9 + 1)) ** 8
    tail.current.rotation.set(0.16, 0, 0.3 * Math.sin(t * 2.1) + 0.5 * flick * Math.sin(t * 13))
    // breathing; and it rises a little on its legs to moo
    root.current.scale.set(COW.s, COW.s * (1 + 0.012 * Math.sin(t * 1.6) + 0.045 * a.lift), COW.s)
  })

  return (
    <group ref={root} position={[COW.x, 0, COW.z]} rotation-y={COW.ry} scale={COW.s}>
      <Cel geos={geos.body} />
      <group ref={head} position={NECK} rotation-order="YXZ">
        <Cel geos={geos.head} />
      </group>
      <group ref={tail} position={[0, 0.6, -0.5]}>
        <Cel geos={geos.tail} />
      </group>
      <sprite ref={bubble} material={mat} center={[0.78, 0.04]} position={[0.05, 1.2, 0.42]} visible={false} renderOrder={6} />
    </group>
  )
}
