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
/** light = the sunset the story was painted in; dark = the same journey by night, under lanterns and a moon */
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
  /** 0‥1 warm light wash over the whole screen (walking through the lit gate) */
  flash: number
  quality: Quality
  theme: Theme
  reduced: boolean
  /** number of lazily-mounted scene groups */
  mounted: number
  set: (p: Partial<UIState>) => void
  setTheme: (t: Theme) => void
}

const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4
/** `?q=low` / `?q=high` forces a quality tier (handy for testing on devices). */
const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') : null
/** `?theme=dark` / `?theme=light` in the link wins; otherwise the guest's last choice; otherwise the sunset. */
const initialTheme: Theme = (() => {
  if (typeof window === 'undefined') return 'light'
  const q = new URLSearchParams(window.location.search).get('theme')
  if (q === 'dark' || q === 'light') return q
  try {
    return localStorage.getItem('invite-theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
})()
if (typeof document !== 'undefined') document.documentElement.dataset.theme = initialTheme
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
  flash: 0,
  quality: initialQuality,
  theme: initialTheme,
  reduced: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  mounted: 1,
  set: (p) => set(p),
  setTheme: (theme) => {
    try {
      localStorage.setItem('invite-theme', theme)
    } catch {
      /* private mode */
    }
    document.documentElement.dataset.theme = theme
    set({ theme })
  },
}))

export const ui = () => useUI.getState()
