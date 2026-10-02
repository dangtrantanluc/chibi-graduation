import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CAST, INVITE, MUSIC, PROCLAMATION, SFX } from '../config'
import { useUI, WISH_MAX, type Caption } from '../state/store'
import { world } from '../state/world'
import { advance, closeLantern, openLantern, releaseLantern, replay } from '../story/director'
import { DEFAULT_WISH, wishOr } from '../three/fx/lanternPaper'
import { saveLanternCard } from './lanternCard'
import { flushWishes, sendWish, wishesOn } from './wishPost'
import { setOverview } from './interaction'
import { chime, isMuted, onMute, onSamples, playZone, setMuted, trainReady } from '../audio/music'

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
  // in the map view a tap just goes back to the story
  if (s.overview) {
    setOverview(false)
    return
  }
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
  const overview = useUI((s) => s.overview)
  const lantern = useUI((s) => s.lantern)

  // a wish that could not be posted on an earlier visit goes out now
  useEffect(() => void flushWishes(), [])

  useEffect(() => {
    const tap = () => onGlobalTap()
    const key = (e: KeyboardEvent) => {
      // typing in a field, or a focused button or link: the key is theirs
      if ((e.target as HTMLElement)?.closest?.('input, button, a')) return
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        onGlobalTap()
      } else if (e.key === 'Escape') setOverview(false)
      else if (e.key === 'm' || e.key === 'M') {
        const s = useUI.getState()
        if (s.phase === 'ready' && (s.overview || !s.busy)) setOverview(!s.overview)
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
    <div className={overview ? 'overlay is-overview' : 'overlay'}>
      <div className="flash" style={{ opacity: flash }} aria-hidden="true" />

      {phase === 'loading' && <Loader />}
      {phase === 'ready' && <SoundToggle />}
      {phase === 'ready' && (overview || !busy) && <MapToggle on={overview} />}
      {overview && (
        <p className="map-hint" aria-hidden="true">
          kéo để xoay · chạm để quay lại
        </p>
      )}
      {phase === 'ready' && step === 'intro' && !busy && <IntroTicket />}

      <div className="dialogue-slot" aria-live="polite">
        {showDialogue && <Dialogue key={caption.line} c={caption} ready={canContinue && !busy} />}
      </div>

      {step === 'home' && canContinue && <LookHint />}
      {step === 'hue' && invite && <InviteCard guest={guest} ready={canContinue && !busy} />}
      {finale && lantern === 'off' && <Finale />}
      {finale && (lantern === 'write' || lantern === 'done') && <LanternPanel mode={lantern} />}
    </div>
  )
}

/** Pull back to see the whole board — the journey as a map — and back again. */
function MapToggle({ on }: { on: boolean }) {
  return (
    <button className="sound map" data-interactive aria-label={on ? 'Quay lại câu chuyện' : 'Xem toàn bộ bản đồ'} aria-pressed={on} onClick={() => setOverview(!on)}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
        {on ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13" />}
      </svg>
    </button>
  )
}

/** Music on / off. */
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

const STOPS = ['Bình Định', 'Sài Gòn', 'Hà Nội', 'Về nhà', 'Huế']

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
    world.talk.on = true
    const reduced = useUI.getState().reduced
    const id = window.setInterval(() => {
      setShown((n) => {
        const next = n + (reduced ? 6 : 1)
        if (next >= full.length) {
          window.clearInterval(id)
          bus.typing = false
          world.talk.on = false
          return full.length
        }
        return next
      })
    }, 26)
    bus.finishTyping = () => {
      window.clearInterval(id)
      bus.typing = false
      world.talk.on = false
      setShown(full.length)
    }
    return () => {
      window.clearInterval(id)
      bus.typing = false
      world.talk.on = false
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
      <p className="sr-only">
        Bảng vàng xướng tên tân khoa {CAST.luc}, và kính mời {guest} đến chung vui.
      </p>
      <p className="host">You are invited</p>
      <p className="host-sub">Trân trọng kính mời</p>
      <Details compact={compactInvite()} />
      {ready && (
        <p className="card-cue" aria-hidden="true">
          chạm để cùng vào Đại Nội <b>▼</b>
        </p>
      )}
    </section>
  )
}

function Finale() {
  const hasCal = Boolean(INVITE.startISO && INVITE.endISO)
  const again = useUI((s) => s.wishCount > 0)
  // the recorded train is credited only when its file is there to be heard
  const [trainHeard, setTrainHeard] = useState(trainReady)
  useEffect(() => onSamples(() => setTrainHeard(trainReady())), [])
  return (
    <section className="finale" aria-live="polite">
      <div className="finale-head">
        <h2>See you inside.</h2>
      </div>
      <div className="card finale-card">
        <Details compact />
        <button className="lantern-open" data-interactive onClick={openLantern}>
          <LanternIcon />
          <span>
            {again ? 'Thả thêm một đèn trời' : 'Viết lời chúc, thả đèn trời'}
            <small>{again ? 'thêm một lời chúc nữa' : `gửi ${CAST.luc} một lời chúc`}</small>
          </span>
        </button>
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
          {trainHeard && (
            <span>
              {' · '}
              <a href={SFX.train.url} target="_blank" rel="noreferrer">
                “{SFX.train.title}”
              </a>{' '}
              {SFX.train.author},{' '}
              <a href={SFX.train.licenseUrl} target="_blank" rel="noreferrer">
                {SFX.train.license}
              </a>
            </span>
          )}
        </p>
      </div>
      <p className="finale-cue" aria-hidden="true">
        kéo để nhìn quanh
      </p>
    </section>
  )
}

function LanternIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M8.6 19.5c-.3-2.6-3.1-5.2-3.1-9.4C5.5 6 8.2 3 12 3s6.5 3 6.5 7.1c0 4.2-2.8 6.8-3.1 9.4z" />
      <path d="M12 16.2c-.9-1-.9-2.2 0-3.2.9 1 .9 2.2 0 3.2zM9.8 21.5h4.4" />
    </svg>
  )
}

/** wishes offered to those who would rather not type */
const SUGGEST = [DEFAULT_WISH, 'Vững bước trên đường mới nhé!', `Tự hào về ${CAST.luc} lắm!`, 'Thành công rực rỡ nha!']

/**
 * Thả đèn trời. While the guest writes, the words appear on the lantern in the
 * scene; when it is let go the wish is posted to Lực (ui/wishPost.ts — to him
 * alone; with no endpoint configured nothing is sent), and afterwards they can
 * keep a picture of it.
 */
function LanternPanel({ mode }: { mode: 'write' | 'done' }) {
  const wish = useUI((s) => s.wish)
  const released = useUI((s) => s.released)
  const guest = useUI((s) => s.guest)
  const input = useRef<HTMLInputElement>(null)
  const post = useUI((s) => s.wishPost)
  const [saved, setSaved] = useState<'' | 'busy' | 'done' | 'failed'>('')

  useEffect(() => {
    // (not on a phone: the keyboard would cover the lantern before it has been seen)
    if (mode === 'write' && !window.matchMedia('(pointer: coarse)').matches) input.current?.focus({ preventScroll: true })
  }, [mode])

  if (mode === 'write') {
    const submit = (e: FormEvent) => {
      e.preventDefault()
      input.current?.blur()
      chime()
      sendWish(guest, wishOr(wish))
      releaseLantern()
    }
    return (
      <form className="card lantern-card" onSubmit={submit} data-interactive>
        <p className="host-sub">Đèn trời</p>
        <label htmlFor="wish" className="lantern-title">
          Viết lời chúc lên đèn
        </label>
        <input id="wish" ref={input} value={wish} maxLength={WISH_MAX} autoComplete="off" enterKeyHint="send" placeholder={DEFAULT_WISH} onChange={(e) => useUI.setState({ wish: e.target.value })} />
        <div className="chips" aria-label="Lời chúc gợi ý">
          {SUGGEST.map((s) => (
            <button type="button" key={s} aria-pressed={wish === s} onClick={() => useUI.setState({ wish: s })}>
              {s}
            </button>
          ))}
        </div>
        {wishesOn() && <p className="lantern-note">Lời chúc được gửi riêng tới {CAST.luc} — chỉ {CAST.luc} đọc được.</p>}
        <div className="lantern-actions">
          <button type="button" className="quiet" onClick={closeLantern}>
            Để sau
          </button>
          <span className="count" aria-hidden="true">
            {wish.length}/{WISH_MAX}
          </span>
          <button type="submit" className="go">
            Thả đèn
          </button>
        </div>
      </form>
    )
  }

  const last = released[released.length - 1] ?? DEFAULT_WISH
  const name = guest || INVITE.defaultGuest
  const note =
    saved === 'failed'
      ? 'Chưa lưu được ảnh, bạn thử lại nhé.'
      : post === 'sending'
        ? `Đang gửi lời chúc tới ${CAST.luc}…`
        : post === 'sent'
          ? `Lời chúc đã gửi tới ${CAST.luc} — chỉ ${CAST.luc} đọc được.`
          : post === 'later'
            ? 'Mạng đang chập chờn: lời chúc sẽ tự gửi lại khi bạn mở thiệp lần sau.'
            : `Lưu ảnh chiếc đèn rồi gửi cho ${CAST.luc} nhé — lời chúc chỉ nằm trên máy của bạn.`
  const save = async () => {
    if (saved === 'busy') return
    setSaved('busy')
    try {
      const how = await saveLanternCard(last, guest)
      setSaved(how === 'cancelled' ? '' : 'done')
    } catch {
      setSaved('failed')
    }
  }
  return (
    <section className="card lantern-card done" data-interactive aria-live="polite">
      <p className="host-sub">Đèn đã bay lên</p>
      <p className="lantern-title">Cảm ơn {name} đã gửi lời chúc.</p>
      <p className="lantern-wish">“{last}”</p>
      <p className="lantern-note">{note}</p>
      <div className="lantern-actions">
        <button className="quiet" onClick={closeLantern}>
          Xem lại thiệp
        </button>
        <button className="quiet" onClick={openLantern}>
          Thả thêm
        </button>
        <button className="go" onClick={save}>
          {saved === 'busy' ? 'Đang vẽ…' : saved === 'done' ? 'Đã lưu ảnh ✓' : 'Lưu ảnh đèn'}
        </button>
      </div>
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
        <p className="greet">{PROCLAMATION.invite}</p>
        <h1>{guest.charAt(0).toLocaleUpperCase('vi') + guest.slice(1)}</h1>
        <p className="invited">
          {PROCLAMATION.closing} cùng {CAST.luc}
        </p>
        <Details />
        <p className="sign">See you inside.</p>
      </section>
    </main>
  )
}
