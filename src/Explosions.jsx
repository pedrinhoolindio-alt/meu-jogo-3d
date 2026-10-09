// src/Explosions.jsx
// Sistema de partículas para explosões, faíscas e ondas de choque.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, frameDt, rand } from './gameState'

const MAX = 1200
const RINGS = 10
const dummy = new THREE.Object3D()
const col = new THREE.Color()
const dir = new THREE.Vector3()
const C = (r, g, b) => new THREE.Color(r, g, b)

const PALETTES = {
  fire: [C(4, 2.4, 0.8), C(4, 1.2, 0.3), C(3.2, 3, 2.6), C(2.2, 0.5, 0.1)],
  rock: [C(1.3, 1, 0.7), C(0.7, 0.6, 0.45), C(3, 1.6, 0.5)],
  bomb: [C(2.5, 3, 4), C(4, 4, 4), C(1, 2, 4), C(4, 2, 0.6)],
  green: [C(0.6, 4, 0.8), C(2, 4, 2)],
  blue: [C(0.6, 2, 4), C(2, 3, 4)],
  orange: [C(4, 1.8, 0.4), C(4, 3, 1.5)],
  smoke: [C(0.55, 0.55, 0.6), C(0.8, 0.75, 0.7), C(3, 1.6, 0.5)],
}
const DEBRIS = C(0.18, 0.18, 0.2)

export default function Explosions() {
  const mesh = useRef()
  const light = useRef()
  const ringRefs = useRef([])
  const flash = useRef(0)

  // Partículas guardadas de forma compacta: as vivas ficam em [0, n). Ao morrer, a última
  // ocupa o lugar da que morreu (swap-remove) → o loop só percorre as vivas.
  const parts = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(),
        drag: 2.2,
      })),
    []
  )
  const count = useRef(0)
  const rings = useMemo(
    () =>
      Array.from({ length: RINGS }, () => ({
        active: false,
        pos: new THREE.Vector3(),
        t: 0,
        maxT: 0.6,
        size: 1,
        mat: new THREE.MeshBasicMaterial({
          color: new THREE.Color(2.5, 2, 1.6),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      })),
    []
  )

  useLayoutEffect(() => {
    mesh.current.setColorAt(0, col.setRGB(1, 1, 1))
    mesh.current.count = 0
  }, [])

  function add(pos, vel, life, size, color, drag = 2.2) {
    if (count.current >= MAX) return
    const p = parts[count.current++]
    p.pos.copy(pos)
    p.vel.copy(vel)
    p.life = p.maxLife = life
    p.size = size
    p.color.copy(color)
    p.drag = drag
  }

  useEffect(() => {
    game.fx.explode = (pos, { size = 1, palette = 'fire' } = {}) => {
      const pal = PALETTES[palette] || PALETTES.fire
      const n = Math.min(160, Math.round(30 + size * 30))
      for (let i = 0; i < n; i++) {
        // Direção aleatória na esfera × velocidade (explosões maiores espalham mais)
        dir.randomDirection().multiplyScalar(rand(4, 20) * Math.pow(size, 0.6))
        add(pos, dir, rand(0.35, 1.0) * (0.8 + size * 0.25), rand(0.5, 1.4) * size * 0.75, pal[(Math.random() * pal.length) | 0])
      }
      // Destroços escuros, mais lentos e duradouros
      for (let i = 0; i < 6 + size * 3; i++) {
        dir.randomDirection().multiplyScalar(rand(3, 9) * size)
        add(pos, dir, rand(1, 1.8), rand(0.3, 0.6) * size, DEBRIS, 0.8)
      }
      // Clarão de luz
      flash.current = Math.min(2, flash.current + 0.6 + size * 0.3)
      light.current.position.copy(pos)
      if (size >= 1.5) game.fx.shockwave(pos, size * 0.6)
    }
    game.fx.sparks = (pos, palette = 'orange', n = 8) => {
      const pal = PALETTES[palette] || PALETTES.orange
      for (let i = 0; i < n; i++) {
        dir.randomDirection().multiplyScalar(rand(6, 16))
        add(pos, dir, rand(0.15, 0.35), rand(0.2, 0.4), pal[(Math.random() * pal.length) | 0], 4)
      }
    }
    game.fx.shockwave = (pos, size = 1) => {
      const r = rings.find((q) => !q.active) || rings[0]
      r.active = true
      r.pos.copy(pos)
      r.t = 0
      r.maxT = 0.5 + size * 0.1
      r.size = size
    }
  }, [parts, rings])

  useFrame((state, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    const m = mesh.current

    // ---- Partículas ----
    for (let i = 0; i < count.current; i++) {
      const p = parts[i]
      p.life -= dt
      if (p.life <= 0) {
        // swap-remove: traz a última viva para esta posição
        const last = parts[--count.current]
        parts[count.current] = p
        parts[i] = last
        i--
        continue
      }
      // Integração simples: pos += vel·dt ; arrasto exponencial: vel *= (1 - drag·dt)
      p.pos.addScaledVector(p.vel, dt)
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt))
      const k = p.life / p.maxLife // 1 → 0 ao longo da vida
      dummy.position.copy(p.pos)
      dummy.rotation.set(p.life * 7, p.life * 5, 0)
      dummy.scale.setScalar(p.size * (0.25 + 0.75 * k))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, col.copy(p.color).multiplyScalar(0.2 + 0.8 * k))
    }
    m.count = count.current
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true

    // ---- Ondas de choque (anéis que crescem e somem, sempre virados para a câmera) ----
    rings.forEach((r, i) => {
      const ref = ringRefs.current[i]
      if (!r.active) {
        ref.visible = false
        return
      }
      r.t += dt
      const k = r.t / r.maxT
      if (k >= 1) {
        r.active = false
        ref.visible = false
        return
      }
      ref.visible = true
      ref.position.copy(r.pos)
      ref.quaternion.copy(state.camera.quaternion)
      ref.scale.setScalar(1 + k * r.size * 12)
      r.mat.opacity = (1 - k) * 0.9
    })

    // ---- Clarão ----
    flash.current = Math.max(0, flash.current - dt * 4)
    light.current.intensity = flash.current * 120
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[null, null, MAX]} frustumCulled={false}>
        <icosahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {rings.map((r, i) => (
        <mesh key={i} ref={(el) => (ringRefs.current[i] = el)} material={r.mat} visible={false}>
          <ringGeometry args={[0.85, 1, 48]} />
        </mesh>
      ))}
      <pointLight ref={light} color="#ffb070" intensity={0} distance={90} decay={1.4} />
    </>
  )
}
