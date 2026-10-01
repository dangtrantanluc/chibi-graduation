import { lazy, Suspense, useEffect, useState } from 'react'
import { guestFromUrl, INVITE } from './config'
import { useUI } from './state/store'
import { skipToInvite, startIntro } from './story/director'
import { installInteraction } from './ui/interaction'
import { loadFonts } from './three/lib/textures'
import { Overlay } from './ui/Overlay'

const Experience = lazy(() => import('./three/Experience'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function App() {
  const [fonts, setFonts] = useState(false)
  const [webgl] = useState(hasWebGL)
  const phase = useUI((s) => s.phase)

  useEffect(() => {
    const g = guestFromUrl()
    if (g) useUI.setState({ guest: g, guestFromLink: true })
    loadFonts(g ?? '').then(() => setFonts(true))
  }, [])

  useEffect(() => installInteraction(), [])

  useEffect(() => {
    if (phase !== 'ready') return
    startIntro()
    // returning guests can jump straight to the invitation with ?skip
    if (new URLSearchParams(window.location.search).has('skip')) {
      useUI.setState({ guest: useUI.getState().guest || INVITE.defaultGuest })
      skipToInvite()
    }
  }, [phase])

  return (
    <>
      {webgl && fonts && (
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      )}
      <Overlay webgl={webgl} />
    </>
  )
}
