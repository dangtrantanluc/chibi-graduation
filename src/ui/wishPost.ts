import { WISHES } from '../config'
import { useUI } from '../state/store'

/*
 * Sending a wish to Lực. Each wish a guest lets go is posted to the endpoint in
 * WISHES (a Google Apps Script that appends a row to his private sheet — see
 * docs/wishes-apps-script.gs). It is write-only: nothing is ever read back, so
 * no guest sees another's wish.
 *
 * A wish goes into an outbox in this browser first and leaves it only once it
 * has been posted, so a dropped connection costs nothing: it is sent again the
 * next time the invitation is opened. Each carries an id, and the script
 * ignores an id it has already written.
 */

interface Letter {
  id: string
  name: string
  wish: string
}

const OUTBOX = 'invite-wishes-outbox'
const TIMEOUT = 12000

export const wishesOn = () => Boolean(WISHES.endpoint)

function outbox(): Letter[] {
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX) ?? '[]')
    return Array.isArray(v) ? v.filter((l) => l && typeof l.id === 'string' && typeof l.wish === 'string').slice(-20) : []
  } catch {
    return []
  }
}
function keep(list: Letter[]) {
  try {
    if (list.length) localStorage.setItem(OUTBOX, JSON.stringify(list))
    else localStorage.removeItem(OUTBOX)
  } catch {
    // private mode: what cannot be kept is simply tried once
  }
}

async function post(l: Letter) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT)
  try {
    // (a "simple" request, so the script needs no CORS preflight; its answer is opaque and not needed)
    await fetch(WISHES.endpoint, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(l), signal: ctl.signal })
  } finally {
    clearTimeout(timer)
  }
}

let busy = false
/** post whatever is waiting, oldest first; stop at the first that will not go */
export async function flushWishes() {
  // (a round already under way re-reads the outbox each time, so it takes a new letter too)
  if (!wishesOn() || busy) return
  busy = true
  try {
    for (let list = outbox(); list.length; list = outbox()) {
      await post(list[0])
      keep(outbox().filter((l) => l.id !== list[0].id))
    }
    if (useUI.getState().wishPost === 'sending') useUI.setState({ wishPost: 'sent' })
  } catch {
    if (useUI.getState().wishPost === 'sending') useUI.setState({ wishPost: 'later' })
  } finally {
    busy = false
  }
}

/** the guest has let a lantern go: its wish is on its way to Lực */
export function sendWish(name: string, wish: string) {
  if (!wishesOn()) return
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  keep([...outbox(), { id, name: name.slice(0, 40), wish: wish.slice(0, 80) }])
  useUI.setState({ wishPost: 'sending' })
  void flushWishes()
}
