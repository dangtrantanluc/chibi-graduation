import * as THREE from 'three'
import type { MatKey } from './kit'
import { agedTex, lacquerTex, thatchTex } from './textures'

/** Shared uniforms, advanced once per frame by <Ticker/>. */
export const uTime = { value: 0 }
/** 0‥1+ — how brightly the paper lanterns / windows glow (finale pushes it up). */
export const uGlow = { value: 1 }
/** 0 (the sunset) ‥ 1 (the dark theme: night) — eased by <Ticker/> when the guest switches theme */
export const uNight = { value: 0 }

interface Features {
  /** read the toon ramp as RGB so the shade colour can be tinted */
  tintRamp?: boolean
  rim?: { color: string; strength: number; power?: number }
  tile?: boolean
  sway?: { amp: number; start: number }
  selfLit?: number
  /** by night, keep this much of the surface's own colour (figures stay readable under the moon) */
  nightLift?: number
  /**
   * world-space weathering, projected along the dominant axis: rain streaks and
   * grime, moss on ledges, at the damp foot of walls and in ragged patches.
   * `grime` / `moss` scale the two (1 = an old wall); `roof` lets moss gather
   * in the channels between roof tiles.
   */
  aged?: boolean | { grime?: number; moss?: number; roof?: boolean }
}

/**
 * Small shader patches on top of MeshStandardMaterial so everything keeps
 * proper lighting, shadows and fog:
 *  • rim   – soft silhouette highlight (toy / figurine feel)
 *  • tile  – procedural glazed roof-tile relief from UVs (no textures)
 *  • sway  – gentle wind bend for foliage
 *  • selfLit – vertex-colour emission for paper lanterns / lit windows
 */
export function patchMaterial<T extends THREE.MeshStandardMaterial>(mat: T, f: Features, key: string): T {
  if (f.tile) mat.defines = { ...(mat.defines ?? {}), USE_UV: '' }
  mat.customProgramCacheKey = () => key
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime
    sh.uniforms.uGlow = uGlow
    sh.uniforms.uNight = uNight
    let vs = sh.vertexShader
    let fs = sh.fragmentShader
    vs = vs.replace('#include <common>', '#include <common>\nuniform float uTime;')
    fs = fs.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uGlow;\nuniform float uNight;')

    if (f.tintRamp) fs = fs.replace('#include <gradientmap_pars_fragment>', TINT_RAMP)

    if (f.aged) {
      const ag = typeof f.aged === 'object' ? f.aged : {}
      const GRIME = (ag.grime ?? 1).toFixed(3)
      const MOSS = (ag.moss ?? 1).toFixed(3)
      // on a roof, moss takes hold more readily, thickest in the channels between the tiles and along
      // their lower edges, and black mould runs down the channels
      const ROOF = ag.roof
        ? `mUp = smoothstep(0.35, 0.8, vAgedN.y) * smoothstep(0.46, 0.6, mN + 0.07 * (1.0 - tChan)) * mix(1.0, 0.55, tChan) * mix(0.8, 1.0, 1.0 - tRow);
            diffuseColor.rgb *= 1.0 - 0.4 * (1.0 - tChan) * smoothstep(0.4, 0.62, a.b * 0.55 + b.g * 0.5);`
        : ''
      sh.uniforms.uAged = { value: agedTex() }
      vs = vs
        .replace('#include <common>', '#include <common>\nvarying vec3 vAgedP;\nvarying vec3 vAgedN;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 agedW = vec4(transformed, 1.0);
          vec3 agedN = objectNormal;
          #ifdef USE_INSTANCING
            agedW = instanceMatrix * agedW;
            agedN = mat3(instanceMatrix) * agedN;
          #endif
          vAgedP = (modelMatrix * agedW).xyz;
          vAgedN = normalize(mat3(modelMatrix) * agedN);`,
        )
      fs = fs
        .replace('#include <common>', '#include <common>\nuniform sampler2D uAged;\nvarying vec3 vAgedP;\nvarying vec3 vAgedN;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float agedM = 0.0;
          {
            vec3 an = abs(vAgedN);
            an /= (an.x + an.y + an.z + 1e-4);
            // streaks run down walls: stretch the lookup along y on vertical faces
            vec4 tx = texture2D(uAged, vec2(vAgedP.z * 0.3, vAgedP.y * 0.22));
            vec4 tz = texture2D(uAged, vec2(vAgedP.x * 0.3, vAgedP.y * 0.22 + 0.37));
            vec4 ty = texture2D(uAged, vAgedP.xz * 0.3);
            vec4 a = tx * an.x + tz * an.z + ty * an.y;
            // a second, broader lookup shapes the big patches and hides the repeat; on walls it is
            // stretched downward, the way damp runs
            vec4 b = mix(texture2D(uAged, vec2(vAgedP.x - vAgedP.z, vAgedP.y * 0.55) * 0.14 + 0.21), texture2D(uAged, vAgedP.zx * 0.14 + 0.5), an.y);
            float low = 1.0 - smoothstep(0.0, 1.4, vAgedP.y);
            // r = 0.87 is clean plaster; lower is grime and rain streaks
            float grime = clamp(1.0 - a.r / 0.87, 0.0, 1.0);
            diffuseColor.rgb *= (1.0 + 0.04 * ${GRIME} - grime * 0.95 * ${GRIME}) * (1.0 - 0.28 * low * ${GRIME});
            // black mould in broad, ragged stains
            diffuseColor.rgb *= 1.0 - 0.34 * ${GRIME} * smoothstep(0.52, 0.7, b.b * 0.6 + a.g * 0.45);
            // moss (g: where it takes hold, b: breakup of its edges): on whatever faces the sky,
            // along the damp foot of a wall in a ragged band, and in patches higher up
            float mN = b.g * 0.62 + a.g * 0.38 + (a.b - 0.5) * 0.22;
            float mUp = smoothstep(0.35, 0.8, vAgedN.y) * smoothstep(0.5, 0.58, mN);
            float mFoot = 1.0 - smoothstep(0.0, 0.06, vAgedP.y - (0.08 + 1.5 * smoothstep(0.42, 0.72, mN)));
            float mPatch = smoothstep(0.565, 0.63, mN + 0.06 * low);
            ${ROOF}
            float m = clamp(max(mPatch * 0.85, max(mFoot, mUp * 0.92)) * ${MOSS}, 0.0, 1.0);
            vec3 mossC = mix(vec3(0.13, 0.22, 0.07), vec3(0.40, 0.47, 0.14), smoothstep(0.3, 0.75, a.b * 0.7 + a.g * 0.4));
            diffuseColor.rgb = mix(diffuseColor.rgb, mossC, m * 0.88);
            agedM = m;
          }`,
        )
        // moss is matt, whatever it grows on (glazed tiles, lacquer)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n          roughnessFactor = mix(roughnessFactor, 1.0, agedM * 0.9);')
    }

    if (f.sway) {
      vs = vs.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 swayO = modelMatrix[3].xyz;
        #ifdef USE_INSTANCING
          swayO += instanceMatrix[3].xyz;
        #endif
        float swayH = max(transformed.y - ${f.sway.start.toFixed(3)}, 0.0);
        float swayP = dot(swayO.xz + transformed.xz * 0.12, vec2(0.37, 0.61));
        float swayK = ${f.sway.amp.toFixed(4)} * pow(swayH, 1.5);
        transformed.x += (sin(uTime * 1.3 + swayP) + 0.35 * sin(uTime * 3.1 + swayP * 2.0)) * swayK;
        transformed.z += cos(uTime * 1.07 + swayP * 1.3) * swayK * 0.6;`,
      )
    }

    if (f.tile) {
      fs = fs.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float tChan = abs(sin(vUv.x * 3.14159 * 4.5));
        float tRowF = fract(vUv.y * 3.6);
        float tRow = smoothstep(0.0, 0.75, tRowF) * (1.0 - smoothstep(0.88, 1.0, tRowF));
        float tileH = tChan * 0.65 + tRow * 0.35;
        diffuseColor.rgb *= mix(0.72, 1.06, tileH);`,
      )
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 dH = vec2(dFdx(tileH), dFdy(tileH)) * 0.035;
          vec3 sX = dFdx(-vViewPosition);
          vec3 sY = dFdy(-vViewPosition);
          vec3 R1 = cross(sY, normal);
          vec3 R2 = cross(normal, sX);
          float det = dot(sX, R1) * faceDirection;
          vec3 grad = sign(det) * (dH.x * R1 + dH.y * R2);
          // at grazing angles the screen-space derivatives can cancel out:
          // never normalise a zero vector (NaN would bloom into a black frame)
          vec3 bumped = abs(det) * normal - grad;
          float bl = length(bumped);
          normal = bl > 1e-6 ? bumped / bl : normal;
        }`,
      )
    }

    if (f.rim || f.selfLit || f.nightLift) {
      let add = ''
      if (f.rim) {
        sh.uniforms.uRimColor = { value: new THREE.Color(f.rim.color) }
        sh.uniforms.uRim = { value: f.rim.strength }
        fs = fs.replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRim;')
        add += `
        float rimNV = 1.0 - saturate(dot(normalize(vViewPosition), normal));
        // by night the warm rim cools to moonlight and all but fades
        totalEmissiveRadiance += mix(uRimColor, vec3(0.6, 0.7, 1.0), uNight * 0.8) * (0.45 + 0.55 * diffuseColor.rgb) * uRim * mix(1.0, 0.3, uNight) * pow(rimNV, ${(f.rim.power ?? 2.8).toFixed(2)});`
      }
      if (f.selfLit) {
        add += `
        // lit paper and windows burn brighter against the dark
        totalEmissiveRadiance += diffuseColor.rgb * ${f.selfLit.toFixed(3)} * uGlow * (1.0 + 0.3 * uNight);`
      }
      if (f.nightLift) {
        add += `
        // (a warm lift, so moonlit skin does not go chalk-blue)
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.9, 0.8) * ${f.nightLift.toFixed(3)} * uNight;`
      }
      fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${add}`)
    }

    sh.vertexShader = vs
    sh.fragmentShader = fs
  }
  return mat
}

const RIM_WARM = '#ffd7a6'

const TINT_RAMP = /* glsl */ `
#ifdef USE_GRADIENTMAP
  uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float dotNL = dot( normal, lightDirection );
  vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
  #ifdef USE_GRADIENTMAP
    return texture2D( gradientMap, coord ).rgb;
  #else
    return vec3( 1.0 );
  #endif
}
`

function std(params: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, ...params })
}

const cache = new Map<string, THREE.Material>()

/** Materials for kit geometry (vertex-coloured). */
export function kitMat(key: MatKey): THREE.Material {
  const hit = cache.get(key)
  if (hit) return hit
  let m: THREE.MeshStandardMaterial
  switch (key) {
    case 'wood':
      m = patchMaterial(std({ roughness: 0.82 }), { rim: { color: RIM_WARM, strength: 0.18 } }, 'wood')
      break
    case 'paint':
      // old paint: dulled and grimy, a little moss where it meets the ground or faces the sky
      m = patchMaterial(std({ roughness: 0.56 }), { aged: { grime: 0.5, moss: 0.45 }, rim: { color: RIM_WARM, strength: 0.14 } }, 'paint')
      break
    case 'tile':
      // old glazed tiles: mould streaks, moss in the channels
      m = patchMaterial(std({ roughness: 0.42, envMapIntensity: 1.1 }), { tile: true, aged: { grime: 0.75, moss: 0.7, roof: true } }, 'tile')
      break
    case 'trim':
      m = std({ roughness: 0.62 })
      break
    case 'stone':
      m = std({ roughness: 0.95 })
      break
    case 'plaster':
      m = std({ roughness: 0.93 })
      break
    case 'gold':
      m = std({ roughness: 0.32, metalness: 0.6, envMapIntensity: 1.4 })
      break
    case 'bronze':
      m = std({ roughness: 0.48, metalness: 0.45 })
      break
    case 'lacquer':
      m = patchMaterial(std({ roughness: 0.5, map: lacquerTex() }), { aged: { grime: 0.6, moss: 0.3 }, rim: { color: RIM_WARM, strength: 0.16 } }, 'lacquer')
      break
    case 'aged':
      m = patchMaterial(std({ roughness: 0.96 }), { aged: true, rim: { color: RIM_WARM, strength: 0.08 } }, 'aged')
      break
    case 'moss':
      // moss cushions, weeds and creepers on old masonry (no wind sway: they cling)
      m = patchMaterial(std({ roughness: 1 }), { rim: { color: '#e8f0a8', strength: 0.22, power: 2.4 } }, 'moss')
      break
    case 'thatch': {
      const map = thatchTex()
      map.repeat.set(1.6, 2.2)
      m = patchMaterial(std({ roughness: 1, map }), { rim: { color: '#ffe6a8', strength: 0.3, power: 2.2 } }, 'thatch')
      break
    }
    case 'glass':
      m = patchMaterial(std({ roughness: 0.2, metalness: 0.15, envMapIntensity: 1.6 }), { selfLit: 0.12, rim: { color: '#d8f3ff', strength: 0.35, power: 2 } }, 'glass')
      break
    case 'ceramic':
      m = std({ roughness: 0.16, envMapIntensity: 1.3 })
      break
    case 'foliage':
      m = patchMaterial(
        std({ roughness: 0.9 }),
        { rim: { color: '#fff1c4', strength: 0.3, power: 2.2 }, sway: { amp: 0.012, start: 0.6 } },
        'foliage',
      )
      break
    case 'toy':
      m = patchMaterial(std({ roughness: 0.6 }), { rim: { color: RIM_WARM, strength: 0.42, power: 2.6 } }, 'toy')
      break
    case 'gloss':
      m = patchMaterial(std({ roughness: 0.12, envMapIntensity: 1.5 }), { rim: { color: '#ffffff', strength: 0.15 } }, 'gloss')
      break
    case 'paperLit':
      m = patchMaterial(std({ roughness: 0.9 }), { selfLit: 0.85 }, 'paperLit')
      break
    case 'ground':
    default:
      m = std({ roughness: 0.95 })
  }
  cache.set(key, m)
  return m
}

/** Non-vertex-coloured toy material (single colour), shared by colour. */
export function toyMat(color: string, rough = 0.6, rim = 0.42): THREE.MeshStandardMaterial {
  const k = `toy:${color}:${rough}:${rim}`
  const hit = cache.get(k)
  if (hit) return hit as THREE.MeshStandardMaterial
  const m = patchMaterial(
    new THREE.MeshStandardMaterial({ color, roughness: rough }),
    { rim: { color: RIM_WARM, strength: rim, power: 2.6 } },
    'toySolid',
  )
  cache.set(k, m)
  return m
}

// ═══════════════════════════════════════════════════════════
//  Anime / NPR materials — "3D that still reads as 2D"
//   • cel shading: a hard two-tone light ramp (lit / shadow)
//   • a thin warm rim so figures separate from the background
//   • inverted-hull ink outlines, width constant in screen space
// ═══════════════════════════════════════════════════════════

let rampTex: THREE.DataTexture | null = null
/** 8-step light ramp: shadow tone below the terminator, flat light above. */
export function toonRamp() {
  if (rampTex) return rampTex
  // shade tone is a cool lilac, lit tone a warm white — shadows are *tinted*, as in hand-painted cels
  const v: [number, number, number][] = [
    [128, 112, 150],
    [134, 118, 156],
    [142, 126, 162],
    [156, 140, 172],
    [244, 238, 236],
    [252, 248, 244],
    [255, 253, 250],
    [255, 255, 255],
  ]
  const data = new Uint8Array(v.length * 4)
  v.forEach((c, i) => data.set([...c, 255], i * 4))
  rampTex = new THREE.DataTexture(data, v.length, 1, THREE.RGBAFormat)
  rampTex.minFilter = rampTex.magFilter = THREE.NearestFilter
  rampTex.generateMipmaps = false
  rampTex.needsUpdate = true
  return rampTex
}

/** Cel-shaded vertex-coloured material for characters. */
export function celMat(key: 'skin' | 'cloth' | 'gloss' = 'cloth', map?: THREE.Texture | null): THREE.MeshToonMaterial {
  const k = `cel:${key}:${map?.uuid ?? ''}`
  const hit = cache.get(k)
  if (hit) return hit as THREE.MeshToonMaterial
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), map: map ?? null })
  // a touch of self-light keeps shadow sides from going muddy (anime shadows are tinted, not black)
  m.emissive = new THREE.Color(key === 'gloss' ? '#262233' : '#1d1520')
  patchMaterial(m as unknown as THREE.MeshStandardMaterial, { tintRamp: true, nightLift: 0.34, rim: { color: '#fff1dc', strength: key === 'gloss' ? 0.2 : 0.38, power: 4.5 } }, `cel-${key}`)
  cache.set(k, m)
  return m
}

const outlineVert = /* glsl */ `
  uniform float uWidth;
  varying vec3 vCol;
  void main() {
    #ifdef USE_COLOR
      vCol = color;
    #else
      vCol = vec3(0.3);
    #endif
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    float d = clamp(-mv.z, 0.6, 60.0);
    mv.xyz += n * uWidth * d;
    gl_Position = projectionMatrix * mv;
  }
`
const outlineFrag = /* glsl */ `
  uniform vec3 uInk;
  varying vec3 vCol;
  void main() {
    // coloured line-art: ink tinted by the surface colour, like hand-inked anime
    gl_FragColor = vec4(mix(uInk, vCol * 0.32, 0.5), 1.0);
    #include <colorspace_fragment>
  }
`
let outline: THREE.ShaderMaterial | null = null
export function outlineMat() {
  if (outline) return outline
  outline = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: 0.0019 }, uInk: { value: new THREE.Color('#1c1424') } },
    vertexShader: outlineVert,
    fragmentShader: outlineFrag,
    side: THREE.BackSide,
    vertexColors: true,
  })
  return outline
}

/**
 * Leaf-card foliage: alpha-tested painted cards, cel-shaded, with normals that
 * point out of each clump (so a tree shades like one soft volume, not 200 cards).
 */
export function cardMat(map: THREE.Texture, key: string, sway = 0.02) {
  const k = `card:${key}`
  const hit = cache.get(k)
  if (hit) return hit as THREE.MeshToonMaterial
  const m = new THREE.MeshToonMaterial({
    map,
    vertexColors: true,
    gradientMap: toonRamp(),
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  })
  m.emissive = new THREE.Color('#2a1c26')
  m.customProgramCacheKey = () => `card-${sway}`
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime
    sh.uniforms.uNight = uNight
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 swO = modelMatrix[3].xyz;
        #ifdef USE_INSTANCING
          swO += instanceMatrix[3].xyz;
        #endif
        float swH = max(transformed.y - 0.8, 0.0);
        float swP = dot(swO.xz, vec2(0.37, 0.61)) + dot(transformed.xz, vec2(1.3, 0.9));
        transformed.x += (sin(uTime * 1.4 + swP) * 0.6 + sin(uTime * 3.3 + swP * 1.7) * 0.4) * ${sway.toFixed(3)} * swH;
        transformed.z += cos(uTime * 1.1 + swP) * ${(sway * 0.7).toFixed(3)} * swH;
        transformed.y += sin(uTime * 2.6 + swP * 2.0) * ${(sway * 0.35).toFixed(3)} * swH;`,
      )
    // keep the clump normal on both faces of a card (no back-face flip)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <gradientmap_pars_fragment>', TINT_RAMP)
      .replace(
        '#include <normal_fragment_begin>',
        `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
        vec3 normal = normalize( vNormal );
        vec3 nonPerturbedNormal = normal;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float cardRim = 1.0 - saturate(dot(normalize(vViewPosition), normal));
        totalEmissiveRadiance += diffuseColor.rgb * pow(cardRim, 3.0) * 0.55 * mix(1.0, 0.25, uNight);`,
      )
  }
  cache.set(k, m)
  return m
}
