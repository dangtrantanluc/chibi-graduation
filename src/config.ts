// ─────────────────────────────────────────────────────────────
//  Invitation content — edit this file to personalise the site.
// ─────────────────────────────────────────────────────────────

export const INVITE = {
  event: '[EVENT]',
  date: '[DATE]',
  time: '[TIME]',
  location: '[LOCATION]',

  /**
   * Optional. Fill both (ISO 8601 with timezone, e.g. '2026-10-18T18:00:00+07:00')
   * to show an "Add to calendar" button on the final screen.
   */
  startISO: '',
  endISO: '',

  /** Used when no name is given in the link or typed by the guest. */
  defaultGuest: 'Friend',
}

/**
 * Background music. Files live in /public/audio. The journey track plays from
 * the first tap; the Huế track fades in as the guest steps through the village
 * gate toward Ngọ Môn. Keep the credit lines if a track's licence asks for it.
 */
export const MUSIC = {
  volume: 0.55,
  tracks: {
    // solo zither, close in voice to the Vietnamese đàn tranh — CC BY 4.0
    journey: {
      src: `${import.meta.env.BASE_URL}audio/journey.mp3`,
      title: 'Ripples',
      author: 'Kevin MacLeod (incompetech.com)',
      url: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100691',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    // erhu / pipa / yangqin for the Huế citadel — CC BY 4.0 (attribution required)
    hue: {
      src: `${import.meta.env.BASE_URL}audio/hue.mp3`,
      title: 'Shenyang',
      author: 'Kevin MacLeod (incompetech.com)',
      url: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600066',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
}

/**
 * Who speaks in each chapter (the dialogue name tags). The two friends stand
 * for whole groups of friends — rename them to anyone you like.
 */
export const CAST = {
  luc: 'Lực',
  uni: 'Hội bạn CNTT',
  hanoi: 'Hội bạn Hà Nội',
  father: 'Bố',
  mother: 'Mẹ',
  /** the name tag when both parents speak together */
  parents: 'Bố & Mẹ',
  princess: 'Công nương',
}

/** Calligraphy and signs in the world. */
export const PLAQUES = {
  /** Bình Định — the lintel of the Hoàng Đế citadel gate: "Hoàng Đế Thành" */
  hoangDe: '皇帝城',
  /** red couplet panels on the gate's outer pillars: "love of one's home runs deep" / "a heart set on the four directions" */
  hoangDeLeft: '鄉情深厚',
  hoangDeRight: '志在四方',
  /** ĐH Nông Lâm — the name on the curved glass bay of the old lecture hall */
  rangDong: 'GIẢNG ĐƯỜNG RẠNG ĐÔNG',
  /** Hoàng thành Thăng Long — the stone plaque of Đoan Môn */
  doanMon: '端門',
  /** the village gate: "a sacred land breeds outstanding people" */
  village: '地靈人傑',
  /** Huế — Ngọ Môn and the hall behind it */
  ngomon: '午門',
  hall: '太和殿',
  /** couplet boards (câu đối) — graduation wishes: "name on the golden list", "a bright road ten thousand miles long" */
  coupletLeft: '金榜題名',
  coupletRight: '前程萬里',
}

/**
 * Guests can receive a personal link: https://your-site/?to=Tan
 * (`?name=` and `?guest=` also work).
 */
export function guestFromUrl(): string | null {
  const q = new URLSearchParams(window.location.search)
  const raw = q.get('to') ?? q.get('name') ?? q.get('guest')
  const clean = raw?.trim().slice(0, 28)
  return clean ? clean : null
}
