# Five Gates — a tiny journey (graduation invitation)

An interactive invitation that tells Lực's journey as a hand-built miniature
world. The guest boards on a journey ticket and walks through five gates, one
per chapter, all on one axis of the diorama:

| Chapter | Place | Who | What happens |
| --- | --- | --- | --- |
| I | Bình Định · Cổng thành Hoàng Đế | Lực | sitting on a stone bench under his home town's gate, he grins shyly, greets you with a Bình Định martial salute (ôm quyền) and walks into the light |
| II | Sài Gòn · ĐH Nông Lâm, giảng đường Rạng Đông | his CNTT friends | the North–South express carries him south; his friend in the Khoa CNTT polo looks up from her stickered laptop, "`</>`", a high-five — and the campus cow on the lawn has the last word ("ụm bò~") |
| III | Hà Nội · Hoàng thành Thăng Long (autumn) | his Hà Nội friends | a gust of golden leaves; by a bicycle loaded with daisies she flashes a V-sign and offers you a bunch of cúc hoạ mi |
| IV | Home · the village | Bố & Mẹ | he says goodbye to his Hà Nội friend and walks through Đoan Môn and the village gate to his parents, waiting in the yard of their thatched house; arms folded, he bows, then unrolls his diploma (made like a sớ) — the lanterns along the lane light up — and his parents step to either side of the lane to see him off toward Huế |
| V | Huế · Ngọ Môn | Công nương (áo nhật bình) + everyone | out of the village under arching bamboo to Ngọ Môn. News of a degree was once proclaimed at the capital (lễ Truyền lô), so the princess, as herald, has the golden list (bảng vàng) lowered from Lầu Ngũ Phụng — a hush, three drum beats, a band of gold. Half open it proclaims the graduate ("TÂN KHOA · Lực") and he salutes it; then it unrolls the rest of the way: "KÍNH MỜI · {name} · đến chung vui" |

Then the golden list rolls back up and they all walk in through Ngọ Môn, over
the Trung Đạo bridge, to stand before Điện Thái Hòa — "See you inside."

The two friends speak without a name tag: their lines are headed only by the
place (Sài Gòn, Hà Nội).

The design analysis — character sheets → 3D, landmarks → models, and why each
animation and transition was chosen — is in
[`docs/story-design.md`](docs/story-design.md) (Vietnamese).

The characters are original chibis built from character sheets and rendered
with an anime/NPR pipeline (cel ramp, ink outlines, painted faces, painted
garment textures, animation on twos). See [`docs/2d-to-3d.md`](docs/2d-to-3d.md).

React + Vite · Three.js / React Three Fiber · drei · postprocessing · GSAP.
Everything — buildings, characters, costume and leaf textures — is generated in
code; the app loads no 3D model or image files. The only assets are two music
tracks in `public/audio/`.

## Controls

- **Tap / click anywhere** — continue. Tapping while a line is still typing finishes it.
- **Drag** (mouse or one finger) — look around the current scene.
- **Scroll / pinch** — lean in or out a little.
- Keyboard: Enter / Space / → continue.
- A map button (top right, also the `M` key) pulls the lens back until the whole
  board is in frame; drag to turn it, tap anywhere (or `Esc`) to return to the
  story where it was.
- ♪ (beside it) mutes/unmutes the music; the choice is remembered.

The light is part of the story and is not a setting: the journey opens before
dawn with one lamp alight, the sun rises over Bình Định, the city is grey
until a friend calls his name, Hà Nội is a gold afternoon, he reaches home at
sunset, and Huế is all lanterns at night (`src/three/grade.ts`).

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:phone    # same, exposed on your LAN to test on a phone
npm run build        # static site in dist/ — host anywhere (Netlify, Vercel, GitHub Pages…)
```

## Personalise

Everything a host needs is in **`src/config.ts`**:

| Field | What it does |
| --- | --- |
| `event`, `date`, `time`, `location` | The invitation details (currently `[EVENT]` etc.) |
| `startISO`, `endISO` | Optional. When both are set, an "Add to calendar" (.ics) link appears |
| `defaultGuest` | What the guest is called when the ticket is left empty (`bạn` — it is read inside Vietnamese sentences) |
| `PROCLAMATION` | The words on the golden list: the heading over the graduate's name (`TÂN KHOA`; or `TÂN CỬ NHÂN`, `TÂN KỸ SƯ`), faculty and university, `KÍNH MỜI`, the closing words |
| `CAST` | The dialogue name tags (Lực, Bố & Mẹ, Công nương) |
| `PLAQUES` | Calligraphy and signs: the Hoàng Đế lintel and couplets, the Rạng Đông name, Đoan Môn, the village gate, Ngọ Môn, the hall and its couplets (graduation wishes 金榜題名 / 前程萬里) |

| `MUSIC` | Volume and the two tracks (village, Huế) with their credits |

Dialogue lines live in `src/story/director.ts` (`CAPTIONS`).

**Personal links:** `https://your-site/?to=Tân` writes the guest's name on the
ticket for them (`?name=` / `?guest=` also work). Vietnamese diacritics render
correctly everywhere, including the golden list.
`?skip` jumps straight to the invitation (for returning guests);
`?q=low` / `?q=high` forces a quality tier.

## Music

Music starts on the guest's first tap (browsers block audio before a gesture).
Leaving the village, the journey theme dies away behind footsteps, wind in the
bamboo and one small bell before the Huế theme rises — the music changes
region rather than track. The music is hushed while the golden list is
lowered: three beats of a court drum as the lens looks up, a bell as it comes
down, another when it hangs open. Bells, the drum, the tap chime, footsteps
and wind are synthesized — no files.

| Part | Track | License |
| --- | --- | --- |
| The journey (I–IV) | "Ripples" by Kevin MacLeod — solo zither, close to the đàn tranh — [incompetech.com](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100691) | CC BY 4.0 |
| Huế (V + finale) | "Shenyang" by Kevin MacLeod — [incompetech.com](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600066) | CC BY 4.0 |

Attribution (required; also shown in the finale card):

> "Ripples" Kevin MacLeod (incompetech.com)
> "Shenyang" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0
> https://creativecommons.org/licenses/by/4.0/

Both files were re-encoded to 96 kbps and loudness-matched (~2.5 and ~1.8 MB).
To use your own music, replace the files and update `MUSIC` in `src/config.ts`;
if a track is CC BY, keep its credit visible.

## How it's put together

```
src/
  config.ts              invitation content + calligraphy
  story/director.ts      every camera move, character beat, line of dialogue (GSAP)
  state/                 UI store (zustand) + per-frame world state and event bus
  audio/music.ts         Web Audio music (crossfade by zone), bell, tap chime, mute
  ui/                    journey-ticket name entry, visual-novel dialogue, invitation, finale;
                         interaction.ts = tap / drag / pinch gestures
  three/
    Experience.tsx       canvas, scene graph, lazy-mounted scenes
    Rig.tsx              camera rig (portrait framing, drag-to-look, handheld float), lights
    Effects.tsx          DOF / AO / bloom (desktop) or tilt-shift (phones)
    layout.ts            where everything sits on the board
    characters/          chibi rig + face painter + the cast + painted garment textures
    world/               one file per region: BinhDinh, Campus, ThangLong, Village, Hue;
                         shared parts, board & ponds, sky, card foliage, lanterns
    fx/                  gate light, falling leaves/petals, sparkles, golden threads,
                         sutra book, golden list, wipes (train / leaf gust / bamboo)
    lib/                 geometry kits, Vietnamese roofs, cel, outline, weathered and
                         glass materials, painted leaf atlases
```

- **Transitions** are beats of the journey: the North–South express rushes past
  the lens (Diêu Trì → Sài Gòn), a gust of golden leaves fills the frame (to Hà
  Nội in autumn); the camera also physically walks through Đoan Môn's central
  arch and the village gate.
- **Small physics:** lanterns are damped pendulums; leaves and petals react to
  gusts from the camera and the characters; keychains and bag charms swing
  with inertia when their owner turns or walks; cloth ribbons are verlet strips.
- **Weathering:** old stone and plaster (the Hoàng Đế gate, the Cham tower,
  Đoan Môn, the village gate, Ngọ Môn) use a world-space material that adds
  grime, rain streaks and moss.
- **Performance:** buildings are merged per material; trees, palms, bamboo, rice, flowers,
  grass and lanterns are instanced; later scenes mount lazily. Touch devices
  start on the low tier (tilt-shift instead of DOF/AO, one point light, capped
  pixel ratio) and a performance monitor steps desktop down if needed.
- **Accessibility:** all text is real HTML with `aria-live` captions,
  `prefers-reduced-motion` shortens moves and typing, and a paper-card fallback
  shows when WebGL isn't available.

**Rights:** the three friends are original characters from the host's own
character sheets. The Nông Lâm building, its signs and the faculty roundel are
depicted for a private invitation among its own students.
