/**
 * World layout — one continuous miniature board: Lực's journey, told as five
 * gates on a single axis. The guest starts at the front (+z) in his hometown
 * and walks toward the Imperial City of Huế at the back (−z).
 *
 *           z = −70 ┌────────────────────────────┐
 *                   │  ĐIỆN THÁI HÒA (backdrop)  │
 *                   │  Thái Dịch lotus ponds     │
 *           z = −50 │═══════ NGỌ MÔN ════════════│  V   Huế — the invitation
 *                   │   Ngọ Môn plaza (U)        │
 *           z = −39 │≋≋≋≋ CỔNG LÀNG in lũy tre ≋≋│  IV  a northern village gate
 *                   │ banyan · well · lanterns   │
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
/** the village gate set into the bamboo hedge (lũy tre) */
export const CONGLANG = { x: 0, z: -38.6, archW: 1.25, archH: 2.1 }
export const BANYAN = { x: -4.6, z: -35.6 }
export const WELL = { x: -6.4, z: -31.2 }
/** the parents' thatched house, just behind them on the right of the lane, facing the guest */
export const HOUSE = { x: 4.15, z: -36.95, ry: 0 }
/** ao làng — the village pond by the banyan */
export const POND = { x: -10.6, z: -33.4, rx: 3.0, rz: 2.0 }

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
  [-6.4, -1.6, -57.6, -53.2],
  [1.6, 6.4, -57.6, -53.2],
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
  [0, -40],
]

// ── Character marks ──────────────────────────────────────────
export const MARKS = {
  lucSit: [BENCH.x, 0, BENCH.z] as const,
  /** where the IT friend sits with her laptop, on the pink campus bench */
  uniSit: [UNI[0], 0.265, UNI[1]] as const,
  hanoi: [-1.75, 0, -21.4] as const,
  /** Lực stands at her side, a step behind, so the camera sees them both */
  lucHanoi: [-0.55, 0, -22.25] as const,
  /** the parents wait side by side in the lane, then step aside to let him pass */
  father: [-0.55, 0, -35.3] as const,
  mother: [0.55, 0, -35.3] as const,
  fatherAside: [-1.5, 0, -36.4] as const,
  motherAside: [2.25, 0, -35.9] as const,
  lucVillage: [0.95, 0, -33.9] as const,
  princess: [0, 0, -46.7] as const,
  // Ngọ Môn formation, inside the U of the gate (x relative to the axis, z absolute)
  // Lực and the princess at the centre, his parents either side, the friends at the ends
  hue: {
    uni: [-2.65, -46.95],
    father: [-1.55, -47.25],
    luc: [-0.5, -46.75],
    princess: [0.55, -46.7],
    mother: [1.6, -47.25],
    hanoi: [2.65, -46.95],
  } as Record<string, [number, number]>,
}
