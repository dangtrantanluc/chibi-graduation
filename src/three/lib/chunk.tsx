import * as THREE from 'three'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { world } from '../../state/world'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake, type MatKey, type Part } from './kit'
import { kitMat } from './materials'

/*
 * Spatial chunking. A mesh merged out of things spread over the whole board has a bounding
 * sphere the size of the board, so it can never be frustum-culled: every frame draws all of it,
 * in the main pass and again in the shadow pass. Cut into cells, only the cells in view (and,
 * for the shadow, in the sun's small window round the action) are drawn.
 */

/** the default cell, in metres: about one scene's worth of the board */
export const CELL = 15

/**
 * Small dressing (moss, weeds, grass, flowers) is not drawn beyond this far from the lens —
 * measured to the near edge of its cell. A tuft a hand high is a few pixels there, dark on a
 * dark wall; and from the start of the board the lens looks down all of it.
 */
export const DETAIL_DIST = 26

const _s = new THREE.Sphere()
/**
 * Every few frames, show only those of `list` whose bounding sphere comes within `maxDist` of the
 * camera (all of them in the map view, which is far from everything).
 */
function useDistanceCull(list: () => THREE.Object3D[], maxDist: number | undefined) {
  const n = useRef(0)
  useFrame(({ camera }) => {
    if (maxDist === undefined || n.current++ % 6) return
    const all = world.overview.k > 0
    for (const o of list()) {
      const m = o as THREE.Mesh
      const bs = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).boundingSphere : m.geometry?.boundingSphere
      if (!bs) continue
      _s.copy(bs).applyMatrix4(o.matrixWorld)
      o.visible = all || camera.position.distanceTo(_s.center) - _s.radius < maxDist
    }
  })
}

const cellOf = (x: number, z: number, cell: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`

/** Like mergeKit, but one merged geometry per (cell, material). */
export function mergeKitChunked(parts: Part[], cell = CELL): { key: string; mat: MatKey; geo: THREE.BufferGeometry }[] {
  const groups = new Map<string, { mat: MatKey; list: THREE.BufferGeometry[] }>()
  const box = new THREE.Box3()
  const c = new THREE.Vector3()
  for (const part of parts) {
    const g = bake(part)
    box.setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute).getCenter(c)
    const mat = part.m ?? 'toy'
    const key = `${cellOf(c.x, c.z, cell)}|${mat}`
    let e = groups.get(key)
    if (!e) groups.set(key, (e = { mat, list: [] }))
    e.list.push(g)
  }
  const out: { key: string; mat: MatKey; geo: THREE.BufferGeometry }[] = []
  for (const [key, { mat, list }] of groups) {
    const geo = mergeGeometries(list, false)
    list.forEach((g) => g.dispose())
    if (!geo) continue
    geo.computeBoundingSphere()
    out.push({ key, mat, geo })
  }
  return out
}

/** KitMesh, cut into cells so that what is out of view is not drawn. */
export function ChunkedKitMesh({ build, cell = CELL, castShadow = true, receiveShadow = true, maxDist }: { build: () => Part[]; cell?: number; castShadow?: boolean; receiveShadow?: boolean; maxDist?: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chunks = useMemo(() => mergeKitChunked(build(), cell), [])
  useEffect(() => () => chunks.forEach((c) => c.geo.dispose()), [chunks])
  const ref = useRef<THREE.Group>(null!)
  useDistanceCull(() => ref.current?.children ?? [], maxDist)
  return (
    <group ref={ref}>
      {chunks.map(({ key, mat, geo }) => (
        <mesh key={key} geometry={geo} material={kitMat(mat)} castShadow={castShadow && mat !== 'paperLit'} receiveShadow={receiveShadow} />
      ))}
    </group>
  )
}

/**
 * Split a static InstancedMesh spread over the board into one InstancedMesh per cell. The pieces
 * share its geometry and material (no extra GPU memory for either), and keep its colours.
 */
export function splitInstanced(im: THREE.InstancedMesh, cell = CELL): THREE.InstancedMesh[] {
  const m = new THREE.Matrix4()
  const p = new THREE.Vector3()
  const buckets = new Map<string, number[]>()
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m)
    p.setFromMatrixPosition(m)
    const k = cellOf(p.x, p.z, cell)
    let b = buckets.get(k)
    if (!b) buckets.set(k, (b = []))
    b.push(i)
  }
  const c = new THREE.Color()
  const out: THREE.InstancedMesh[] = []
  for (const idx of buckets.values()) {
    const part = new THREE.InstancedMesh(im.geometry, im.material, idx.length)
    idx.forEach((src, j) => {
      im.getMatrixAt(src, m)
      part.setMatrixAt(j, m)
      if (im.instanceColor) {
        im.getColorAt(src, c)
        part.setColorAt(j, c)
      }
    })
    part.castShadow = im.castShadow
    part.receiveShadow = im.receiveShadow
    part.renderOrder = im.renderOrder
    part.layers.mask = im.layers.mask
    part.frustumCulled = true
    part.computeBoundingSphere()
    out.push(part)
  }
  return out
}

/**
 * Wrap static instanced dressing (trees, bushes, grass…): once it has mounted, every
 * InstancedMesh in it that spreads wider than a cell is replaced by per-cell pieces.
 * (Only for things whose instances never move after they are built.)
 */
export function Chunked({ children, cell = CELL, maxDist }: { children: ReactNode; cell?: number; maxDist?: number }) {
  const ref = useRef<THREE.Group>(null!)
  // the meshes whose visibility is this wrapper's to decide: the pieces it cut, and any instanced
  // mesh small enough to have been left whole (never a source it has hidden)
  const managed = useRef<THREE.Object3D[]>([])
  useDistanceCull(() => managed.current, maxDist)
  useLayoutEffect(() => {
    managed.current = []
    const done: { parent: THREE.Object3D; src: THREE.InstancedMesh; parts: THREE.InstancedMesh[] }[] = []
    const found: THREE.InstancedMesh[] = []
    ref.current.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) found.push(o as THREE.InstancedMesh)
    })
    for (const im of found) {
      // (skip what an inner Chunked has already cut up and hidden)
      if (!im.parent || !im.visible || im.count < 6) continue
      if (!im.boundingSphere) im.computeBoundingSphere()
      if (im.boundingSphere!.radius < cell) {
        managed.current.push(im)
        continue
      }
      const parts = splitInstanced(im, cell)
      if (parts.length < 2) {
        parts.forEach((x) => x.dispose())
        managed.current.push(im)
        continue
      }
      managed.current.push(...parts)
      // (the pieces are added beside it, in the same parent: they inherit its transform)
      parts.forEach((x) => im.parent!.add(x))
      im.visible = false
      done.push({ parent: im.parent, src: im, parts })
    }
    return () => {
      for (const { parent, src, parts } of done) {
        parts.forEach((x) => {
          parent.remove(x)
          // (dispose only the per-instance buffers: geometry and material are the source's)
          x.dispose()
        })
        src.visible = true
      }
      managed.current = []
    }
  }, [cell])
  return <group ref={ref}>{children}</group>
}
