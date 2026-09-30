import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { emit, world } from '../../state/world'
import { LANTERNS } from '../world/Lanterns'

/**
 * Threads of golden light: as Lực's graduation notice opens, a soft thread
 * reaches from the paper to each village lantern in turn and it ignites.
 */
const targets = LANTERNS.map((l, i) => ({ l, i })).filter(({ l }) => l.zone === 'village')

function boltGeometry(a: THREE.Vector3, b: THREE.Vector3) {
  const pts: THREE.Vector3[] = []
  const n = 9
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const p = a.clone().lerp(b, t)
    if (k > 0 && k < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18))
    pts.push(p)
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'chordal'), 24, 0.0065, 4)
}

export function Lightning() {
  const group = useRef<THREE.Group>(null!)
  const st = useMemo(() => ({ fired: new Set<number>(), bolts: [] as { mesh: THREE.Mesh; t: number }[] }), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), [])
  const camera = useThree((s) => s.camera)

  useFrame((_, dt) => {
    const w = world.villageWave
    if (w <= 0.001 && st.fired.size) st.fired.clear()
    targets.forEach(({ l }, k) => {
      const th = (l.idx ?? 0) / targets.length
      if (w > 0.002 && w > th - 0.02 && !st.fired.has(k)) {
        st.fired.add(k)
        const from = world.diplomaPos.clone()
        const to = new THREE.Vector3(l.a[0], l.a[1] - l.len - 0.2, l.a[2])
        // bolts that would pass right across the lens would just be a white smear
        const near = to.distanceTo(camera.position) < 2.2 || from.distanceTo(camera.position) < 1.2
        for (let b = 0; b < (near ? 0 : 2); b++) {
          const mesh = new THREE.Mesh(boltGeometry(from, to), mat)
          group.current.add(mesh)
          st.bolts.push({ mesh, t: 0 })
        }
        emit({ type: 'sparkle', pos: to, count: 8, color: '#ffe3a0' })
      }
    })
    for (let i = st.bolts.length - 1; i >= 0; i--) {
      const b = st.bolts[i]
      b.t += dt
      b.mesh.visible = b.t < 0.28 && Math.sin(b.t * 90) > -0.3
      if (b.t > 0.4) {
        group.current.remove(b.mesh)
        b.mesh.geometry.dispose()
        st.bolts.splice(i, 1)
      }
    }
  })
  return <group ref={group} />
}
