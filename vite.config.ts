import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * The 3D scene is a lazy chunk, so the browser would only ask for it once the
 * first chunk has arrived and run. Name it in the page itself, so both come
 * down together.
 */
function preloadScene(): Plugin {
  return {
    name: 'preload-scene',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find((c) => c.type === 'chunk' && c.isDynamicEntry && c.facadeModuleId?.endsWith('/three/Experience.tsx'))
        if (!chunk) return html
        return { html, tags: [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${chunk.fileName}` }, injectTo: 'head' }] }
      },
    },
  }
}

export default defineConfig({
  // relative asset URLs so the build works under any sub-path (e.g. GitHub Pages /<repo>/)
  base: './',
  plugins: [react(), preloadScene()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
  },
})
