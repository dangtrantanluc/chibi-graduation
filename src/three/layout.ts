/**
 * World layout — one continuous miniature board: Lực's journey, told as five
 * gates on a single axis. The guest starts at the front (+z) in his hometown
 * and walks toward the Imperial City of Huế at the back (−z).
 *
 *           z = −70 ┌────────────────────────────┐
 *                   │  ĐIỆN THÁI HÒA             │       the farewell, "see you inside"
 *                   │  Thái Dịch lotus ponds     │
 *           z = −50 │═══════ NGỌ MÔN ════════════│  V   Huế — the invitation
 *                   │   Ngọ Môn plaza (U)        │
 *           z = −39 │≋≋≋≋ lũy tre, a bamboo arch ≋│      the way out of the village
 *                   │ banyan · well · HOME, yard │  IV  his parents' house
 *           z = −31 │≋≋≋≋ CỔNG LÀNG in lũy tre ≋≋│      the way into the village
 *           z = −28 │═══════ ĐOAN MÔN ═══════════│  III Hoàng thành Thăng Long (autumn)
 *                   │ autumn esplanade, bicycle  │
 *           z = −11 │  campus   ▣ RẠNG ĐÔNG      │  II  ĐH Nông Lâm TP.HCM
 *                   │ topiary · flags · phượng   │
 *           z = +5  │═══ CỔNG THÀNH HOÀNG ĐẾ ════│  I   Bình Định (home)
 *                   │ bench · coconuts · paddy   │
 *           z = +14 └────────────────────────────┘
 */

export const BOARD = { minX: -20, maxX: 20, minZ: -70, maxZ: 14, corner: 5 }

// ── I · Bình Định ───────────────────────────────────────────
/** Cổng thành Hoàng Đế (An Nhơn): a four-pillar gate in the dark laterite wall */
export const GATE = { z: 5, y: 0, openW: 2.1, openH: 2.9 }
export const BENCH = { x: 1.55, z: 7.35 }
/** Tháp Cánh Tiên — the Cham tower that stands inside the old citadel */
export const CHAM = { x: -12.2, z: 9.2 }
export const PADDY = { x0: 6.5, x1: 18.8, z0: 7.2, z1: 13 }

// ── II · Nông Lâm ───────────────────────────────────────────
/**
 * Giảng đường Rạng Đông, ĐH Nông Lâm TP.HCM — one of the campus's old lecture
 * halls. It stands on the right of the lane and faces it (−x): the front of
 * its corridors is at x = xf, centred on z = zc. Campus props are authored in
 * the building's own frame (lx along the façade, lz out from it toward the
 * lane) and mapped with campusToWorld().
 */
export const RANGDONG = { xf: 8.3, zc: -5.6, w: 11.6, d: 3.1, floor: 0.8, floors: 4, ry: -Math.PI / 2 }
export function campusToWorld(lx: number, lz: number): [number, number] {
  return [RANGDONG.xf - lz, RANGDONG.zc + lx]
}
const TOP = campusToWorld(0.3, 4.1)
export const TOPIARY = { x: TOP[0], z: TOP[1], r: 0.62 }
/** the pink bench where the IT friend sits (local −2.1, 5.7), facing the lane */
const UNI = campusToWorld(-2.1, 5.7)
export const UNI_BENCH = { x: UNI[0], z: UNI[1], ry: RANGDONG.ry + 0.45 }

// ── III · Thăng Long ────────────────────────────────────────
/** Đoan Môn — south gate of the Forbidden City, Hoàng thành Thăng Long */
export const DOANMON = { x: 0, z: -27.6, w: 11.2, d: 2.4, h: 2.55, archW: 1.5, archH: 2.05 }
export const BIKE = { x: -3.1, z: -20.4, ry: 0.5 }

// ── IV · Làng Bắc Bộ ────────────────────────────────────────
/** the village gate, set into the bamboo hedge (lũy tre) right behind Đoan Môn: the way INTO the village */
export const CONGLANG = { x: 0, z: -31.2, archW: 1.25, archH: 2.1 }
/** where the village ends: a second line of lũy tre; the lane leaves under arching bamboo, toward Huế */
export const VILLAGE_END = -39.4
export const BANYAN = { x: -5.4, z: -34.8 }
export const WELL = { x: -3.5, z: -37.4 }
/**
 * Bố mẹ's thatched house, inside the village on the right of the lane, turned
 * toward the gate so whoever comes home sees its door first. Yard props are
 * authored in the house's own frame (lx along the front, lz out from it) and
 * mapped with houseToWorld().
 */
export const HOUSE = { x: 5.58, z: -36.82, ry: -0.6435, s: 0.85 }
export function houseToWorld(lx: number, lz: number): [number, number] {
  const c = Math.cos(HOUSE.ry)
  const sn = Math.sin(HOUSE.ry)
  return [HOUSE.x + (lx * c + lz * sn) * HOUSE.s, HOUSE.z + (-lx * sn + lz * c) * HOUSE.s]
}
/** cây rơm — the haystack beside the house */
export const HAYSTACK = { x: 2.9, z: -38.1 }
/** ao làng — the village pond by the banyan */
export const POND = { x: -11.2, z: -35.8, rx: 3.0, rz: 2.0 }

// ── V · Huế ─────────────────────────────────────────────────
export const HUE_WALL_Z = -50.2
/** Ngọ Môn — the U-shaped Meridian Gate; wings reach forward to z + d/2 + wing */
export const NGOMON = { x: 0, z: -50.2, depth: 2.2, w: 13, h: 3.1, archW: 2.0, archH: 2.62, wing: 3.2 }

export const HALL = {
  x: 0,
  terraceY: 0.9,
  terraceFront: -59.2,
  terraceBack: -68.4,
  bodyFront: -61,
  bodyBack: -66.4,
}
/** Thái Dịch lotus ponds behind Ngọ Môn: [x0, x1, z0, z1] */
export const HUE_PONDS: [number, number, number, number][] = [
  [-6.4, -1.6, -56.7, -53.2],
  [1.6, 6.4, -56.7, -53.2],
]
/** potted mai on the piers either side of Ngọ Môn's central arch (clear of the hanging scroll) */
export const MAI_POTS: [number, number][] = [
  [-1.8, NGOMON.z + NGOMON.depth / 2 + 0.6],
  [1.8, NGOMON.z + NGOMON.depth / 2 + 0.6],
]
/** the golden list (bảng vàng) hangs from the balcony of Lầu Ngũ Phụng */
export const SCROLL = { x: 0, top: 3.86, z: NGOMON.z + NGOMON.depth / 2 + 0.2 }

/** The main walking path (painted into the ground), front to back. */
export const PATH: [number, number][] = [
  [0, 15],
  [0, 8],
  [0, 3],
  [-0.6, -2],
  [-1.2, -8],
  [-1.2, -13],
  [-0.4, -18],
  [0, -24],
  [0, -30],
  [0, -36],
  [0, -41],
]

// ── Character marks ──────────────────────────────────────────
export const MARKS = {
  lucSit: [BENCH.x, 0, BENCH.z] as const,
  /** where the IT friend sits with her laptop, on the pink campus bench */
  uniSit: [UNI[0], 0.265, UNI[1]] as const,
  /** Lực stands beside her bench, an arm's length away */
  lucCampus: [3.42, 0, -6.66] as const,
  hanoi: [-1.75, 0, -21.4] as const,
  /** Lực stands at her side, a step behind, so the camera sees them both */
  lucHanoi: [-0.55, 0, -22.25] as const,
  /**
   * IV: the family meets in the yard, in a row square to the lens with the
   * house behind them — Lực on the left, then his father and mother
   */
  lucVillage: [1.63, 0, -36.34] as const,
  father: [2.4, 0, -35.42] as const,
  mother: [3.08, 0, -34.62] as const,
  /** then Lực stands in the lane and his parents step to either side of it, to see him off */
  lucLane: [0, 0, -36.9] as const,
  fatherAside: [-1.3, 0, -37.6] as const,
  motherAside: [1.3, 0, -37.6] as const,
  princess: [0, 0, -46.7] as const,
  // Ngọ Môn formation, inside the U of the gate (x relative to the axis, z absolute)
  // Lực and the princess at the centre, his parents either side, the friends at the ends
  hue: {
    uni: [-2.95, -46.95],
    father: [-1.8, -47.25],
    luc: [-0.62, -46.75],
    princess: [0.62, -46.7],
    mother: [1.8, -47.25],
    hanoi: [2.95, -46.95],
  } as Record<string, [number, number]>,
  // the same on a phone, closed up so the row fits the narrow frame
  hueTall: {
    uni: [-2.42, -47.0],
    father: [-1.5, -47.45],
    luc: [-0.52, -46.9],
    princess: [0.52, -46.9],
    mother: [1.5, -47.45],
    hanoi: [2.42, -47.0],
  } as Record<string, [number, number]>,
  // the farewell before Điện Thái Hòa: three on the terrace at the head of the stairs, three in the court below
  hall: {
    father: [-1.12, HALL.terraceY, HALL.terraceFront - 0.5],
    princess: [0, HALL.terraceY, HALL.terraceFront - 0.5],
    mother: [1.12, HALL.terraceY, HALL.terraceFront - 0.5],
    uni: [-1.18, 0, HALL.terraceFront + 1.9],
    luc: [0, 0, HALL.terraceFront + 1.9],
    hanoi: [1.18, 0, HALL.terraceFront + 1.9],
  } as Record<string, [number, number, number]>,
}
