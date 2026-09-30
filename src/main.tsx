import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/yuji-boku/400.css'
import './ui/styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  // handy for poking at the scene from the browser console
  Promise.all([import('./story/director'), import('./state/world'), import('./state/store'), import('gsap'), import('three')]).then(([d, w, s, g, T]) => {
    Object.assign(window, { __dbg: { ...d, world: w.world, useUI: s.useUI, gsap: g.default, THREE: T } })
  })
}
