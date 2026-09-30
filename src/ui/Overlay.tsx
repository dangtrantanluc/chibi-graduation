import { useEffect, useRef, useState, type FormEvent } from 'react'
import { INVITE, MUSIC } from '../config'
import { useUI, type Caption } from '../state/store'
import { advance, replay } from '../story/director'
import { chime, isMuted, onMute, playZone, setMuted } from '../audio/music'

/*
 * The HTML layer. There are no "next" buttons: the guest taps anywhere on the
 * scene to continue and drags to look around (see ui/interaction.ts). Text is
 * real HTML for accessibility; captions are also announced via aria-live.
 */

// shared between the global tap handler and the components that own the state
const bus = {
  introSubmit: null as null | (() => void),
  typing: false,
  finishTyping: null as null | (() => void),
}

function onGlobalTap() {
  const s = useUI.getState()
  if (s.phase !== 'ready') return
  if (s.step === 'intro' && !s.busy) {
    bus.introSubmit?.()
    return
  }
  if (bus.typing) {
    bus.finishTyping?.()
    return
  }
  if (s.canContinue && !s.busy && s.step !== 'finale') {
    chime()
    advance()
  }
}

export function Overlay({ webgl }: { webgl: boolean }) {
  const phase = useUI((s) => s.phase)
  const step = useUI((s) => s.step)
  const busy = useUI((s) => s.busy)
  const canContinue = useUI((s) => s.canContinue)
  const caption = useUI((s) => s.caption)
  const invite = useUI((s) => s.invite)
  const finale = useUI((s) => s.finale)
  const flash = useUI((s) => s.flash)
  const guest = useUI((s) => s.guest)

  useEffect(() => {
    const tap = () => onGlobalTap()
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        onGlobalTap()
      }
    }
    window.addEventListener('village-tap', tap)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('village-tap', tap)
      window.removeEventListener('keydown', key)
    }
  }, [])

  if (!webgl) return <Fallback />

  const showDialogue = caption && !(step === 'hue' && invite)
  return (
    <div className="overlay">
      <div className="flash" style={{ opacity: flash }} aria-hidden="true" />

      {phase === 'loading' && <Loader />}
      {phase === 'ready' && <SoundToggle />}
      {phase === 'ready' && step === 'intro' && !busy && <IntroTicket />}

      <div className="dialogue-slot" aria-live="polite">
        {showDialogue && <Dialogue key={caption.line} c={caption} ready={canContinue && !busy} />}
      </div>

      {step === 'home' && canContinue && <LookHint />}
      {step === 'hue' && invite && <InviteCard guest={guest} ready={canContinue && !busy} />}
      {finale && <Finale />}
    </div>
  )
}

/** The one small control on screen: music on / off. */
function SoundToggle() {
  const [m, setM] = useState(isMuted())
  useEffect(() => onMute(setM), [])
  return (
    <button className="sound" data-interactive aria-label={m ? 'Bật nhạc' : 'Tắt nhạc'} aria-pressed={!m} onClick={() => setMuted(!m)}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V5l11-2v11.5a2.5 2.5 0 1 1-2-2.45V6.2L9 7.5z" fill="currentColor" />
        {m && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
      </svg>
    </button>
  )
}

function Loader() {
  return (
    <div className="loader" role="status">
      <div className="loader-star" aria-hidden="true" />
      <p>Đang dựng hành trình…</p>
    </div>
  )
}

/** Falling phượng petals and golden leaves (pure CSS) behind the ticket. */
function Petals({ n = 14 }: { n?: number }) {
  return (
    <div className="petals" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ left: `${(i * 73) % 100}%`, animationDelay: `${(i * 0.83) % 7}s`, animationDuration: `${7 + (i % 5)}s` }} />
      ))}
    </div>
  )
}

const STOPS = ['Bình Định', 'Sài Gòn', 'Hà Nội', 'Cổng làng', 'Huế']

/**
 * Name entry, on a journey ticket: the guest becomes the passenger on Lực's
 * route. Type, then tap anywhere (or press Enter) to board.
 */
function IntroTicket() {
  const fromLink = useUI((s) => s.guestFromLink)
  const guest = useUI((s) => s.guest)
  const [name, setName] = useState(guest)
  const [nudge, setNudge] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const nameRef = useRef(name)
  nameRef.current = name

  useEffect(() => {
    bus.introSubmit = () => {
      const clean = nameRef.current.trim().slice(0, 28)
      if (!clean && !fromLink && nudge === 0) {
        // first empty tap: gently point at the ticket instead of starting
        setNudge(1)
        input.current?.focus()
        return
      }
      useUI.setState({ guest: clean || INVITE.defaultGuest })
      // music may only start from a user gesture — this tap is it
      playZone('journey', 3)
      setLeaving(true)
      input.current?.blur()
      setTimeout(advance, 420)
    }
    return () => {
      bus.introSubmit = null
    }
  }, [fromLink, nudge])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    bus.introSubmit?.()
  }

  return (
    <section className={`intro ${leaving ? 'leaving' : ''}`} aria-labelledby="intro-title">
      <Petals />
      <p className="greet">
        <span>Xin chào</span>
        <span className="dot">·</span>
        <span lang="en">Welcome</span>
      </p>
      <h1 id="intro-title">Một hành trình nhỏ đang chờ bạn</h1>
      <form className={`ticket ${nudge ? 'nudge' : ''} ${leaving ? 'punched' : ''}`} onSubmit={submit} data-interactive>
        <div className="ticket-main">
          <p className="ticket-head">
            <span>Vé hành trình</span>
            <span className="ticket-no">No. 2026</span>
          </p>
          <ol className="route" aria-label="Lộ trình">
            {STOPS.map((st) => (
              <li key={st}>{st}</li>
            ))}
          </ol>
          <label htmlFor="guest-name" className="ticket-label">
            Hành khách
          </label>
          {fromLink ? (
            <p className="ticket-name">{guest}</p>
          ) : (
            <input
              id="guest-name"
              ref={input}
              value={name}
              maxLength={28}
              autoComplete="given-name"
              enterKeyHint="go"
              placeholder="viết tên bạn…"
              onChange={(e) => {
                setName(e.target.value)
                setNudge(0)
              }}
            />
          )}
        </div>
        <div className="ticket-stub" aria-hidden="true">
          <span className="stamp">MỜI</span>
          <span className="stub-seat">Ghế · VIP</span>
        </div>
      </form>
      <p className="tap-hint" aria-hidden="true">
        {nudge ? 'Viết tên bạn — hoặc chạm lần nữa để lên tàu' : 'Chạm vào màn hình để lên tàu'}
        <span className="pulse" />
      </p>
    </section>
  )
}

/** Visual-novel style dialogue box with a typewriter reveal and a ▼ cue. */
function Dialogue({ c, ready }: { c: Caption; ready: boolean }) {
  const [shown, setShown] = useState(0)
  const full = c.line
  useEffect(() => {
    setShown(0)
    bus.typing = true
    const reduced = useUI.getState().reduced
    const id = window.setInterval(() => {
      setShown((n) => {
        const next = n + (reduced ? 6 : 1)
        if (next >= full.length) {
          window.clearInterval(id)
          bus.typing = false
          return full.length
        }
        return next
      })
    }, 26)
    bus.finishTyping = () => {
      window.clearInterval(id)
      bus.typing = false
      setShown(full.length)
    }
    return () => {
      window.clearInterval(id)
      bus.typing = false
      bus.finishTyping = null
    }
  }, [full])
  const done = shown >= full.length
  return (
    <figure className="dialogue" style={{ ['--tag' as string]: c.color ?? '#b8412f' }}>
      <figcaption className="chapter">
        <span className="numeral">{c.chapter}</span>
        {c.place}
      </figcaption>
      {c.speaker && <span className="nameplate">{c.speaker}</span>}
      <p>
        <span className="sr-only">{full}</span>
        <span aria-hidden="true">
          {full.slice(0, shown)}
          <span className="ghost">{full.slice(shown)}</span>
        </span>
      </p>
      {done && ready && (
        <span className="next-cue" aria-hidden="true">
          chạm <b>▼</b>
        </span>
      )}
    </figure>
  )
}

function LookHint() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 5200)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div className="look-hint" aria-hidden="true">
      <span className="hand">✥</span> Kéo để nhìn quanh
    </div>
  )
}

function Details({ compact = false }: { compact?: boolean }) {
  const rows: [string, string][] = [
    ['Sự kiện', INVITE.event],
    ['Ngày', INVITE.date],
    ['Giờ', INVITE.time],
    ['Địa điểm', INVITE.location],
  ]
  return (
    <dl className={compact ? 'details compact' : 'details'}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const compactInvite = () => window.matchMedia('(max-width: 720px)').matches

function InviteCard({ guest, ready }: { guest: string; ready: boolean }) {
  return (
    <section className="card invite" aria-live="polite">
      <p className="sr-only">Bảng vàng ghi: Welcome, {guest}. You are invited.</p>
      <p className="host">You are invited</p>
      <p className="host-sub">Trân trọng kính mời</p>
      <Details compact={compactInvite()} />
      {ready && (
        <p className="card-cue" aria-hidden="true">
          chạm để lùi ra xem toàn cảnh <b>▼</b>
        </p>
      )}
    </section>
  )
}

function Finale() {
  const hasCal = Boolean(INVITE.startISO && INVITE.endISO)
  return (
    <section className="finale" aria-live="polite">
      <div className="finale-head">
        <h2>See you inside.</h2>
      </div>
      <div className="card finale-card">
        <Details compact />
        <div className="links">
          {hasCal && (
            <a href="#" onClick={(e) => (e.preventDefault(), downloadIcs())}>
              Thêm vào lịch
            </a>
          )}
          <a href="#" onClick={(e) => (e.preventDefault(), replay())}>
            ↺ Đi lại hành trình
          </a>
        </div>
        <p className="credits">
          ♪{' '}
          {Object.values(MUSIC.tracks).map((t, i) => (
            <span key={t.src}>
              {i > 0 && ' · '}
              <a href={t.url} target="_blank" rel="noreferrer">
                “{t.title}”
              </a>{' '}
              {t.author},{' '}
              <a href={t.licenseUrl} target="_blank" rel="noreferrer">
                {t.license}
              </a>
            </span>
          ))}
        </p>
      </div>
      <p className="finale-cue" aria-hidden="true">
        kéo để nhìn quanh
      </p>
    </section>
  )
}

function downloadIcs() {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => `\\${m}`)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//miniature-village-invite//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@invite`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(INVITE.startISO)}`,
    `DTEND:${fmt(INVITE.endISO)}`,
    `SUMMARY:${esc(INVITE.event)}`,
    `LOCATION:${esc(INVITE.location)}`,
    'DESCRIPTION:You are invited',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'invitation.ics'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** No WebGL: the invitation still arrives, as a painted paper card. */
function Fallback() {
  const guest = useUI((s) => s.guest) || INVITE.defaultGuest
  return (
    <main className="fallback">
      <section className="card invite solo">
        <span className="seal big">招</span>
        <p className="greet">Welcome,</p>
        <h1>{guest}</h1>
        <p className="invited">You are invited</p>
        <Details />
        <p className="sign">See you inside.</p>
      </section>
    </main>
  )
}
