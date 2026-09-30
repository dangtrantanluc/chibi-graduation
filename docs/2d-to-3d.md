# Turning 2D anime characters into 3D without losing the 2D feel

Research notes (checked September 2026) and what this project does with them.

## What makes 3D read as 2D

Shipped games converge on the same toolkit:

- **Guilty Gear Xrd** (Arc System Works, GDC 2015) — "kill everything 3D":
  a hard `step()` light threshold, shade colours painted rather than computed,
  inverted-hull outlines, hand-edited normals (especially faces), and
  *limited animation*: every frame is a key, no in-betweening.
  [talk script](https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf) ·
  [GDC Vault](https://www.gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The)
- **Genshin Impact** (HoYoverse) — separate character/scene pipelines, a face
  light map, artist-controlled shadows
  ([GDC 2021 slides](https://media.gdcvault.com/GDC+2021/2021GDC+_+Haoyu+Cai+_+presentation+file.pdf)).
  Community reverse-engineering adds per-material shadow ramps, SDF face
  shadows, hair highlight strips and a fixed-width rim
  ([PrimoToon](https://github.com/festivities/PrimoToon)) — note these details
  are not confirmed by HoYoverse.
- **Spider-Verse** — animated on twos, no motion blur, hand-drawn line work
  converted to geometry ([Imageworks](https://www.imageworks.com/our-craft/feature-animation/movies/spider-man-spider-verse)).

## What this project implements

| Technique | Where |
| --- | --- |
| Hard two-tone cel ramp, **tinted** (lilac) shade instead of darkening | `three/lib/materials.ts` → `toonRamp`, `celMat` |
| Inverted-hull ink outlines, constant screen width, tinted by the surface colour | `outlineMat()` |
| **Painted faces**: eyes, brows, mouth, blush drawn on a canvas and swapped per expression, like cels; irises follow idle glances | `three/characters/face.ts` |
| Limited animation: pose sampled at **12 fps** and held (root travel stays smooth) | `three/characters/Chibi.tsx` (`ANIME_STEP`) |
| Anime hair: flat overlapping fringe blades, grooved long-hair curtains, "angel ring" shine band | `three/characters/hair.ts`, `Cast.tsx` |
| Foliage as hand-painted leaf cards with clump normals (soft "Ghibli" volume) | `three/lib/foliageTex.ts`, `three/world/Foliage.tsx` |

The characters are original procedural chibis built from character sheets
(key art, turnaround, expressions, details, palette): the sheet's silhouette
and palette become primitives and vertex colours, its expressions become face
"cels", its detail call-outs become props and painted garment textures, and
its poses become actions. See [`story-design.md`](story-design.md).

## Upgrade paths for higher-fidelity characters

1. **VRoid Studio → VRM → three-vrm.** Build each character in
   [VRoid Studio](https://vroid.com/en/studio) (free, commercial use of your own
   models allowed), export VRM, load with
   [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm) (v3.5.x supports
   three r18x) — its MToon shader is the standard anime toon material. Keep
   stepped animation (Mixamo / VRMA clips sampled at 12 fps).
2. **Image → 3D generators**, then clean up in Blender:
   [TRELLIS.2](https://huggingface.co/microsoft/TRELLIS.2-4B) (MIT, 24 GB+ GPU),
   [Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) (region-restricted licence),
   anime-specific [StdGEN](https://github.com/hyz317/StdGEN) (separates body/clothes/hair) or
   [CharacterGen](https://github.com/zjp-shadow/CharacterGen); paid:
   [Meshy](https://www.meshy.ai/features/ai-auto-rigging), [Tripo](https://developers.tripo3d.ai/en/models/rig) (both auto-rig).
   Expect fused meshes and baked lighting — flatten the textures, split hair,
   fix face normals, rig ([UniRig](https://github.com/VAST-AI-Research/UniRig) / Mixamo), export VRM
   with the [Blender VRM add-on](https://github.com/saturday06/VRM-Addon-for-Blender).
3. **HD-2D** (2D sprites in a 3D diorama, as in Octopath Traveler) keeps the
   original drawings pixel-perfect, but characters can't be orbited — this
   project lets the guest drag the camera, so full 3D fits better.

**Rights:** only publish characters you have the right to use. HoYoverse's
official Genshin MMD models are non-commercial and may not be redistributed,
so a public site should not serve them.
