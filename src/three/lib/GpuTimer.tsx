import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'

/**
 * Development only (`?gputime`): the GPU time of each whole frame — every pass, the shadow
 * map and the post-processing — from a timer query opened before anything is drawn and closed
 * after the composer has finished. Exposed as `window.__gpu` (average and p95 in ms over the
 * last 120 frames). FPS alone is too noisy to judge a change by.
 */
export function GpuTimer() {
  const gl = useThree((s) => s.gl)
  const st = useMemo(() => {
    const ctx = gl.getContext() as WebGL2RenderingContext
    const ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2')
    return { ctx, ext, pending: [] as WebGLQuery[], cur: null as WebGLQuery | null, ms: [] as number[] }
  }, [gl])
  useFrame(() => {
    const { ctx, ext } = st
    if (!ext) return
    // collect what has finished
    while (st.pending.length && ctx.getQueryParameter(st.pending[0], ctx.QUERY_RESULT_AVAILABLE)) {
      const q = st.pending.shift()!
      if (!ctx.getParameter(ext.GPU_DISJOINT_EXT)) st.ms.push(ctx.getQueryParameter(q, ctx.QUERY_RESULT) / 1e6)
      ctx.deleteQuery(q)
      if (st.ms.length > 120) st.ms.shift()
    }
    const s = [...st.ms].sort((a, b) => a - b)
    ;(window as unknown as { __gpu: unknown }).__gpu = s.length ? { avg: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), n: s.length } : null
    st.cur = ctx.createQuery()!
    ctx.beginQuery(ext.TIME_ELAPSED_EXT, st.cur)
  }, -1000)
  useFrame(() => {
    if (!st.ext || !st.cur) return
    st.ctx.endQuery(st.ext.TIME_ELAPSED_EXT)
    st.pending.push(st.cur)
    st.cur = null
  }, 1000)
  return null
}
