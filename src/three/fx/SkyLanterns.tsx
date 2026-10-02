import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { world } from '../../state/world'
import { LANTERN_POOL, lanternSlots, useUI } from '../../state/store'
import { canvas, glowTex, toTexture } from '../lib/textures'
import { rng } from '../lib/kit'
import { uTime } from '../lib/materials'
import { LANTERN } from '../layout'
import { inkWish, signature, wishFontReady, wishOr } from './lanternPaper'

/*
 * Đèn trời — after the farewell the guest may write a wish on a paper sky
 * lantern. It stands on the paving beside Lực at the end of the bridge; the
 * words appear on its paper as they are typed; Lực holds the lamp he has
 * carried all the way to its mouth and the flame takes; he picks it up and
 * holds it over his head, the others gather round, and they let it go together
 * — up over Điện Thái Hòa, where a sky of other lanterns is rising from behind
 * the hall.
 *
 * Nothing is stored anywhere but this browser: the other lanterns are scenery,
 * not other guests.
 */

// ── the lantern: a paper bag, narrow at the mouth, widest at the shoulder ──
const BODY = 14 // rings up the body, evenly spaced, so the writing is not stretched
const BODY_H = 0.66
function lanternGeo(seg: number) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= BODY; i++) {
    const y = (i / BODY) * BODY_H
    const r = y <= 0.54 ? 0.13 + 0.12 * Math.sin(((y / 0.54) * Math.PI) / 2) : 0.25 - 0.05 * ((y - 0.54) / 0.12) ** 2
    pts.push(new THREE.Vector2(r, y))
  }
  for (const [r, y] of [
    [0.14, 0.715],
    [0.07, 0.75],
    [0.001, 0.765],
  ])
    pts.push(new THREE.Vector2(r, y))
  // u = 0.5 faces +z (the lens); the seam is at the back
  return new THREE.LatheGeometry(pts, seg, Math.PI, Math.PI * 2)
}

// ── its paper, with the wish written on it (front and back) ──
const TW = 1024
const TH = 512
function paintPaper(g: CanvasRenderingContext2D, wish: string, sign: string) {
  const grd = g.createLinearGradient(0, 0, 0, TH)
  grd.addColorStop(0, '#f6e0b6')
  grd.addColorStop(1, '#fbeed2')
  g.fillStyle = grd
  g.fillRect(0, 0, TW, TH)
  const r = rng(71)
  for (let i = 0; i < 520; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(160,110,60,0.07)' : 'rgba(255,255,255,0.14)'
    g.fillRect(r() * TW, r() * TH, 6 + r() * 30, 1)
  }
  // the glued seams of its four panels (clear of the writing), vermilion rules top and bottom
  g.fillStyle = 'rgba(150,90,50,0.16)'
  for (let k = 0; k < 4; k++) g.fillRect(k * 256 + 126, 0, 4, TH)
  g.fillStyle = 'rgba(200,60,40,0.78)'
  for (const [y, h] of [
    [98, 5],
    [108, 2],
    [455, 2],
    [460, 5],
  ])
    g.fillRect(0, y, TW, h)
  // (the paper is a little taller than it is wide per pixel: widen the writing to match)
  for (const cx of [TW / 2, 0, TW]) {
    g.save()
    g.translate(cx, 0)
    g.scale(1.1, 1)
    inkWish(g, wish, sign, 0, 290, 268, 286, '#4a2416', [56, 50, 44, 38, 33])
    g.restore()
  }
}

const paperVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const paperFrag = /* glsl */ `
  uniform sampler2D map;
  uniform float uLit;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vec3 paper = texture2D(map, vUv).rgb;
    // the flame is at the mouth: its glow climbs the paper as it takes, and stays strongest low down
    float take = smoothstep(0.0, 0.4, uLit * 1.4 - vUv.y);
    float flick = 1.0 + 0.05 * sin(uTime * 11.0) + 0.03 * sin(uTime * 23.0 + 1.3);
    vec3 glow = vec3(1.0, 0.76, 0.44) * (0.92 + 1.1 * pow(1.0 - vUv.y, 2.0)) * flick;
    // unlit, it is pale paper in the moonlight; darker toward the silhouette so that it reads as round
    vec3 col = paper * mix(vec3(0.26, 0.28, 0.42), glow, take) * (0.72 + 0.28 * abs(vN.z));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

// ── the other lanterns: one instanced mesh, moved entirely in the vertex shader ──
const SPAN = 50
const skyVert = /* glsl */ `
  attribute vec3 aHome;
  attribute vec4 aSeed; // delay, climb speed, phase, size
  attribute vec3 aTint;
  uniform float uT;
  varying float vV;
  varying vec3 vTint;
  varying float vFlick;
  void main() {
    float age = uT - aSeed.x;
    float y = mod(max(age, 0.0) * aSeed.y, ${SPAN.toFixed(1)});
    // each grows out of nothing as it comes up, and thins away high overhead before starting again
    float life = step(0.0, age) * smoothstep(0.0, 4.0, y) * (1.0 - smoothstep(${(SPAN - 12).toFixed(1)}, ${SPAN.toFixed(1)}, y));
    float a = aSeed.z * 6.283 + uT * 0.12;
    float c = cos(a), s = sin(a);
    vec3 p = position * aSeed.w * life;
    p.xz = mat2(c, -s, s, c) * p.xz;
    // they sway, and all lean a little on the same breeze
    vec3 at = aHome + vec3(sin(uT * 0.21 + aSeed.z * 20.0) * 0.8 + y * 0.06, y, cos(uT * 0.17 + aSeed.z * 11.0) * 0.8);
    vV = uv.y;
    vTint = aTint;
    vFlick = 1.0 + 0.06 * sin(uT * (7.0 + aSeed.z * 6.0) + aSeed.z * 40.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(at + p, 1.0);
  }
`
const skyFrag = /* glsl */ `
  varying float vV;
  varying vec3 vTint;
  varying float vFlick;
  void main() {
    float low = 1.0 - vV;
    vec3 col = mix(vec3(1.0, 0.34, 0.13), vec3(1.0, 0.8, 0.38), pow(low, 1.5)) * vTint * (0.95 + 1.2 * low * low) * vFlick;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

/** where each of the guest's lanterns ends up, high over the roofs behind the hall */
const STATIONS: [number, number, number][] = [
  [-3.4, 17.5, -90],
  [3.8, 19.5, -88],
  [0.8, 21.5, -93],
]
const SIZE = 1.15
/** it stands here to be written on … */
const GROUND = new THREE.Vector3(LANTERN.x, 0.02, LANTERN.z)
/** … and it is let go from here: over Lực's head, in his raised hands */
const HANDS = new THREE.Vector3(LANTERN.luc[0], LANTERN.holdY, LANTERN.luc[2] + 0.03)

export function SkyLanterns() {
  const quality = useUI((s) => s.quality)
  const wish = useUI((s) => s.wish)
  const released = useUI((s) => s.released)
  const wishCount = useUI((s) => s.wishCount)
  const writing = useUI((s) => s.lantern === 'write')
  const guest = useUI((s) => s.guest)

  const own = useMemo(() => {
    const geo = lanternGeo(28)
    return Array.from({ length: LANTERN_POOL }, (_, i) => {
      const [c, g] = canvas(TW, TH)
      const map = toTexture(c)
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: map }, uLit: { value: 0 }, uTime },
        vertexShader: paperVert,
        fragmentShader: paperFrag,
        side: THREE.DoubleSide,
      })
      const st = STATIONS[i]
      const path = new THREE.CatmullRomCurve3(
        [
          HANDS.clone(),
          new THREE.Vector3(HANDS.x + 0.1, HANDS.y + 2.2, HANDS.z - 0.45),
          new THREE.Vector3(0.3 + st[0] * 0.08, 7.6, -66.6),
          new THREE.Vector3(st[0] * 0.55, 12.8, -74.5),
          new THREE.Vector3(...st),
        ],
        false,
        'centripetal',
      )
      const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.9, 0.7), toneMapped: false, transparent: true })
      const halo = new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb45a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
      return { geo, g, map, mat, path, flame, halo, painted: '' }
    })
  }, [])
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2e1c12' }), [])
  const sparkMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex(), color: '#ffd28a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), [])

  // write the wishes on the paper: those already let go, and the one being written now
  useEffect(() => {
    let alive = true
    const sign = signature(guest)
    const slots = lanternSlots(released, wishCount)
    const texts = own.map((_, i) => (writing && i === slots.next ? wishOr(wish) : slots.wishes[i]))
    const draw = (force: boolean) => {
      own.forEach((o, i) => {
        const text = texts[i]
        if (text === null) return
        const key = `${text}|${sign}`
        if (!force && o.painted === key) return
        o.painted = key
        paintPaper(o.g, text, sign)
        o.map.needsUpdate = true
      })
    }
    draw(false)
    // the display face loads a glyph range only when it is first asked for: draw again once it is in
    wishFontReady(texts.join('') + sign).then(() => alive && draw(true))
    return () => {
      alive = false
    }
  }, [own, wish, released, wishCount, writing, guest])

  const sky = useMemo(() => {
    const n = quality === 'high' ? 56 : 34
    const base = lanternGeo(10)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.setAttribute('position', base.attributes.position)
    geo.setAttribute('uv', base.attributes.uv)
    geo.instanceCount = n
    const r = rng(2026)
    const home: number[] = []
    const seed: number[] = []
    const tint: number[] = []
    const tints = [
      [1, 0.9, 0.85],
      [1, 1, 0.9],
      [1, 0.8, 0.86],
      [1, 0.95, 0.8],
    ]
    for (let i = 0; i < n; i++) {
      // from beyond the back wall of the citadel, the width of the sky
      home.push((r() - 0.5) * 56, -3, -80 - r() * 22)
      seed.push(i < 5 ? r() * 2 : r() * 17, 0.9 + r() * 0.6, r(), 1.7 + r() * 1.1)
      tint.push(...tints[Math.floor(r() * tints.length)])
    }
    geo.setAttribute('aHome', new THREE.InstancedBufferAttribute(new Float32Array(home), 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seed), 4))
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tint), 3))
    const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.visible = false
    return { mesh, mat }
  }, [quality])

  const groups = useRef<(THREE.Group | null)[]>([])
  const spark = useRef<THREE.Sprite>(null!)
  const spin = useRef([0, 0, 0])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = world.time
    if (world.sky.on) world.sky.t += dt
    sky.mesh.visible = world.sky.on
    sky.mat.uniforms.uT.value = world.sky.t

    let latest = -1
    own.forEach((o, i) => {
      const L = world.lanterns[i]
      const grp = groups.current[i]
      if (!grp) return
      grp.visible = L.state > 0
      if (!grp.visible) return
      latest = i
      o.mat.uniforms.uLit.value = L.lit
      o.flame.opacity = L.lit
      o.halo.opacity = 0.55 * L.lit * (1 + 0.06 * Math.sin(t * 11.3))
      if (L.state === 1) {
        // on the ground, then picked up: it comes up beside him first and over his head last
        const h = L.hold
        grp.position.set(
          THREE.MathUtils.lerp(GROUND.x, HANDS.x, h * h),
          THREE.MathUtils.lerp(GROUND.y, HANDS.y, 1 - (1 - h) * (1 - h)),
          THREE.MathUtils.lerp(GROUND.z, HANDS.z, h) + 0.12 * Math.sin(h * Math.PI),
        )
        // its written face toward the lens
        spin.current[i] = Math.atan2(state.camera.position.x - grp.position.x, state.camera.position.z - grp.position.z)
        grp.rotation.set(0, spin.current[i], 0)
        grp.scale.setScalar(SIZE)
      } else {
        o.path.getPoint(L.k, grp.position)
        // it wavers as it climbs, and turns slowly: the wish comes round again
        const air = Math.min(1, L.k * 12)
        grp.position.x += air * 0.1 * Math.sin(t * 0.9 + i * 2)
        spin.current[i] += dt * 0.22 * air
        grp.rotation.set(air * 0.05 * Math.sin(t * 1.1 + i), spin.current[i], air * 0.06 * Math.sin(t * 0.8 + i * 3))
        // (far overhead it would be a speck: it is let grow, so the guest can still find it)
        grp.scale.setScalar(SIZE * (1 + 1.7 * L.k))
      }
    })
    if (latest >= 0) {
      const grp = groups.current[latest]!
      world.lanternPos.set(grp.position.x, grp.position.y + 0.42 * grp.scale.y, grp.position.z)
    }

    // the flame crossing from his lamp to the lantern's mouth (the sky lantern here, or the one in his parents' yard)
    const s = world.spark
    spark.current.visible = s >= 0 && s <= 1
    if (spark.current.visible) {
      const c = world.chars.luc.pos
      const to = world.sparkTo
      const k = s * s * (3 - 2 * s)
      spark.current.position.set(THREE.MathUtils.lerp(c.x + 0.42, to.x, k), THREE.MathUtils.lerp(0.4, to.y, k) + 0.1 * Math.sin(k * Math.PI), THREE.MathUtils.lerp(c.z + 0.1, to.z, k))
      spark.current.scale.setScalar(0.2 + 0.1 * Math.sin(s * Math.PI))
    }
  })

  return (
    <>
      {own.map((o, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
          <mesh geometry={o.geo} material={o.mat} />
          {/* the bamboo hoop at the mouth, the wad of flame in it, and its halo */}
          <mesh position={[0, 0.006, 0]} rotation-x={Math.PI / 2} material={ring}>
            <torusGeometry args={[0.13, 0.008, 5, 24]} />
          </mesh>
          <mesh position={[0, 0.05, 0]} material={o.flame}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
          <sprite position={[0, 0.24, 0]} scale={1.35} material={o.halo} />
        </group>
      ))}
      <sprite ref={spark} material={sparkMat} visible={false} renderOrder={7} />
      <primitive object={sky.mesh} />
    </>
  )
}
