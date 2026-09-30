import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { mergeKit, type Part, type V3 } from './kit'
import { kitMat } from './materials'

export interface Item {
  p: V3
  ry: number
  s: number | V3
}

/** One InstancedMesh per material for a kit repeated many times. */
export function InstancedKit({ build, items, shadow = true }: { build: () => Part[]; items: Item[]; shadow?: boolean }) {
  const meshes = useMemo(() => {
    const geos = mergeKit(build())
    const out: THREE.InstancedMesh[] = []
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const sv = new THREE.Vector3()
    const pv = new THREE.Vector3()
    for (const [k, g] of geos) {
      const im = new THREE.InstancedMesh(g, kitMat(k), items.length)
      items.forEach((it, i) => {
        const s = it.s
        if (typeof s === 'number') sv.set(s, s, s)
        else sv.set(...s)
        m4.compose(pv.set(...it.p), q.setFromEuler(e.set(0, it.ry, 0)), sv)
        im.setMatrixAt(i, m4)
      })
      im.castShadow = shadow
      im.receiveShadow = true
      im.computeBoundingSphere()
      out.push(im)
    }
    return out
  }, [build, items, shadow])
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}
