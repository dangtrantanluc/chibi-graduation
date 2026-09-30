import { useEffect, useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import { mergeKit, type Part } from './kit'
import { kitMat } from './materials'

type Props = ThreeElements['group'] & {
  build: () => Part[]
  castShadow?: boolean
  receiveShadow?: boolean
}

/** Renders a kit (list of parts) as one merged mesh per material. */
export function KitMesh({ build, castShadow = true, receiveShadow = true, ...props }: Props) {
  // build functions are module-level / stable; bake once per mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geos = useMemo(() => mergeKit(build()), [])
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos])
  return (
    <group {...props}>
      {[...geos].map(([k, g]) => (
        <mesh
          key={k}
          geometry={g}
          material={kitMat(k)}
          castShadow={castShadow && k !== 'paperLit'}
          receiveShadow={receiveShadow}
        />
      ))}
    </group>
  )
}
