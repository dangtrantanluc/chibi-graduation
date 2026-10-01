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
  reduced: boolean
  /** number of lazily-mounted scene groups */
  mounted: number
  set: (p: Partial<UIState>) => void
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
  flash: 0,
  quality: initialQuality,
  reduced: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  mounted: 1,
  set: (p) => set(p),
}))

export const ui = () => useUI.getState()
