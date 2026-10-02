import { create } from 'zustand'

/** intro → I Bình Định → II Nông Lâm → III Thăng Long → IV về nhà → V Ngọ Môn → finale (Điện Thái Hòa) */
export type Step = 'intro' | 'home' | 'campus' | 'hanoi' | 'village' | 'hue' | 'finale'
export const STEP_ORDER: Step[] = ['intro', 'home', 'campus', 'hanoi', 'village', 'hue', 'finale']

export interface Caption {
  chapter: string
  place: string
  speaker?: string
  /** name-tag colour for the speaker */
  color?: string
  line: string
}

export type Quality = 'high' | 'low'
/** the paper UI: cream by day, indigo and gold after dark — it follows the story's time of day (three/grade.ts) */
export type Theme = 'light' | 'dark'

interface UIState {
  phase: 'loading' | 'ready'
  step: Step
  /** true while the camera is travelling — the continue button is hidden */
  busy: boolean
  canContinue: boolean
  guest: string
  guestFromLink: boolean
  caption: Caption | null
  invite: boolean
  finale: boolean
  /** thả đèn trời, after the farewell: writing the wish, the lantern going up, done */
  lantern: 'off' | 'write' | 'fly' | 'done'
  /** the wish being written on the lantern */
  wish: string
  /** the wishes of this guest's lanterns that are still in the sky — the latest few (kept in this browser only) */
  released: string[]
  /** how many lanterns this guest has let go in all */
  wishCount: number
  /** the latest wish on its way to Lực (ui/wishPost.ts): being posted, posted, or held to be sent on the next visit */
  wishPost: 'none' | 'sending' | 'sent' | 'later'
  /** 0‥1 warm light wash over the whole screen (walking through the lit gate) */
  flash: number
  quality: Quality
  theme: Theme
  /** the map view is open (see world.overview) */
  overview: boolean
  reduced: boolean
  /** number of lazily-mounted scene groups */
  mounted: number
  set: (p: Partial<UIState>) => void
}

/**
 * A guest may let go as many lanterns as they like; this many of their own are in the sky at once
 * (each is a lantern with its wish written on it). One more, and the oldest makes way for it.
 */
export const LANTERN_POOL = 3
export const WISH_MAX = 60
const WISHES_KEY = 'invite-wishes'
function storedWishes(): { released: string[]; wishCount: number } {
  try {
    const v = JSON.parse(localStorage.getItem(WISHES_KEY) ?? '[]')
    // (an earlier version kept a plain list)
    const list: unknown = Array.isArray(v) ? v : v?.last
    const released = Array.isArray(list) ? list.filter((w): w is string => typeof w === 'string').map((w) => w.slice(0, WISH_MAX)).slice(-LANTERN_POOL) : []
    const n = Array.isArray(v) ? 0 : Math.floor(Number(v?.n))
    return { released, wishCount: Math.max(released.length, Number.isFinite(n) ? n : 0) }
  } catch {
    return { released: [], wishCount: 0 }
  }
}
/** remember a released wish in this browser, so the lantern is still in the sky on the next visit */
export function keepWish(w: string) {
  const s = useUI.getState()
  const released = [...s.released, w].slice(-LANTERN_POOL)
  const wishCount = s.wishCount + 1
  useUI.setState({ released, wishCount })
  try {
    localStorage.setItem(WISHES_KEY, JSON.stringify({ n: wishCount, last: released }))
  } catch {
    // private mode: the lantern still flies, it is just not remembered
  }
}
/**
 * Which of the pooled lanterns carries what: `next` is the one the next wish will be written on,
 * `wishes[i]` the wish lantern i is carrying in the sky (null: it is not up).
 */
export function lanternSlots(released: string[], wishCount: number) {
  const wishes: (string | null)[] = Array.from({ length: LANTERN_POOL }, () => null)
  released.forEach((w, m) => (wishes[(wishCount - released.length + m) % LANTERN_POOL] = w))
  return { next: wishCount % LANTERN_POOL, wishes }
}

const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4
/** `?q=low` / `?q=high` forces a quality tier (handy for testing on devices). */
const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') : null
const initialQuality: Quality = forced === 'low' || forced === 'high' ? forced : coarse || cores <= 4 ? 'low' : 'high'

export const useUI = create<UIState>((set) => ({
  phase: 'loading',
  step: 'intro',
  busy: false,
  canContinue: false,
  guest: '',
  guestFromLink: false,
  caption: null,
  invite: false,
  finale: false,
  lantern: 'off',
  wish: '',
  wishPost: 'none',
  ...(typeof window !== 'undefined' ? storedWishes() : { released: [], wishCount: 0 }),
  flash: 0,
  quality: initialQuality,
  // the story opens before dawn
  theme: 'dark',
  overview: false,
  reduced: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  mounted: 1,
  set: (p) => set(p),
}))

export const ui = () => useUI.getState()
if (typeof document !== 'undefined') document.documentElement.dataset.theme = 'dark'
