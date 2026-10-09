// src/Environment.jsx
// Cenário em movimento: naves capitais ao fundo, batalha distante, rastros de velocidade e poeira.
// (Céu, Sol e planetas reais ficam em Space.jsx)
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, rand } from './gameState'
import { Ship, M } from './models'

const dummy = new THREE.Object3D()
const Z_AXIS = new THREE.Vector3(0, 0, 1)

// Delta do cenário: congela só na pausa (no menu continua animando)
const envDt = (delta) => (game.phase === 'paused' ? 0 : Math.min(delta, 0.05))

// ---------------------------------------------------------------------------
// Texturas procedurais (canvas)
// ---------------------------------------------------------------------------
function glowTexture() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.5)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}

// ---------------------------------------------------------------------------
// Naves capitais ao fundo: cruzador aliado Aurora e encouraçado inimigo (modelos 3D)
// ---------------------------------------------------------------------------
function CapitalShips() {
  const ally = useRef()
  const enemy = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    ally.current.position.set(210 + Math.sin(t * 0.05) * 15, 55 + Math.sin(t * 0.1) * 4, -430)
    enemy.current.position.set(-230 - Math.sin(t * 0.04) * 20, 120, -560)
  })
  return (
    <>
      {/* Aurora: navega de lado, mostrando o perfil */}
      <group ref={ally} rotation={[0.08, -1.25, 0.05]}>
        <Ship kind="allyCruiser" scale={7} glowColor="#7fb2ff" fog={false} />
      </group>
      <group ref={enemy} rotation={[-0.05, 1.9, 0]}>
        <Ship kind="enemyCruiser" scale={9} flameMat={M.enemyFlame} glowColor="#ff6040" fog={false} />
      </group>
    </>
  )
}

// ---------------------------------------------------------------------------
// Batalha distante: rajadas vermelhas (aliados) e verdes (inimigos) + clarões
// ---------------------------------------------------------------------------
const BOLTS = 40
const FLASHES = 8
function DistantBattle() {
  const mesh = useRef()
  const flashRefs = useRef([])
  const glow = useMemo(glowTexture, [])
  const bolts = useMemo(
    () => Array.from({ length: BOLTS }, () => ({ active: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(), life: 0 })),
    []
  )
  const flashes = useMemo(() => Array.from({ length: FLASHES }, () => ({ t: 1, pos: new THREE.Vector3(), size: 10 })), [])
  const spawnT = useRef(0)
  const red = useMemo(() => new THREE.Color(3, 0.4, 0.3), [])
  const green = useMemo(() => new THREE.Color(0.5, 3, 0.6), [])

  // Cria o buffer de cores por instância antes do primeiro render
  useLayoutEffect(() => {
    for (let i = 0; i < BOLTS; i++) mesh.current.setColorAt(i, red)
  }, [red])

  useFrame((_, delta) => {
    const dt = envDt(delta)
    if (!dt) return
    spawnT.current -= dt
    if (spawnT.current <= 0) {
      spawnT.current = rand(0.05, 0.25)
      const b = bolts.find((q) => !q.active)
      if (b) {
        b.active = true
        b.life = rand(0.5, 1)
        b.pos.set(rand(-280, 280), rand(-60, 200), rand(-560, -380))
        b.dir.set(rand(-1, 1), rand(-0.3, 0.3), rand(-0.3, 0.3)).normalize()
        const i = bolts.indexOf(b)
        mesh.current.setColorAt(i, Math.random() < 0.5 ? red : green)
        mesh.current.instanceColor.needsUpdate = true
      }
      if (Math.random() < 0.12) {
        const f = flashes.find((q) => q.t >= 1)
        if (f) {
          f.t = 0
          f.pos.set(rand(-280, 280), rand(-40, 200), rand(-580, -420))
          f.size = rand(14, 40)
        }
      }
    }
    bolts.forEach((b, i) => {
      if (b.active) {
        b.life -= dt
        b.pos.addScaledVector(b.dir, 260 * dt)
        if (b.life <= 0) b.active = false
      }
      dummy.position.copy(b.pos)
      dummy.quaternion.setFromUnitVectors(Z_AXIS, b.dir)
      dummy.scale.setScalar(b.active ? 1 : 0)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    flashes.forEach((f, i) => {
      const s = flashRefs.current[i]
      f.t = Math.min(1, f.t + dt * 1.8)
      s.visible = f.t < 1
      s.position.copy(f.pos)
      s.scale.setScalar(f.size * (0.4 + f.t))
      s.material.opacity = (1 - f.t) * 0.9
    })
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[null, null, BOLTS]} frustumCulled={false}>
        <boxGeometry args={[0.8, 0.8, 16]} />
        <meshBasicMaterial toneMapped={false} fog={false} />
      </instancedMesh>
      {flashes.map((_, i) => (
        <sprite key={i} ref={(el) => (flashRefs.current[i] = el)} visible={false}>
          <spriteMaterial map={glow} color="#ffd9a0" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Rastros de velocidade (esticam no turbo)
// ---------------------------------------------------------------------------
const STREAKS = 160
function Streaks() {
  const mesh = useRef()
  const data = useMemo(
    () => Array.from({ length: STREAKS }, () => new THREE.Vector3(rand(-45, 45), rand(-28, 28), rand(-200, 20))),
    []
  )
  useFrame((_, delta) => {
    const dt = envDt(delta)
    if (!dt) return
    const speed = CONFIG.worldSpeed * 1.6 * game.worldMul
    const len = 0.8 + (game.worldMul - 1) * 14 // comprimento cresce com o turbo
    data.forEach((p, i) => {
      p.z += speed * dt
      if (p.z > 20) {
        p.set(rand(-45, 45), rand(-28, 28), -200)
        // Evita rastros no meio da tela (onde está a nave)
        if (Math.abs(p.x) < 6 && Math.abs(p.y) < 4) p.x += 12 * Math.sign(p.x || 1)
      }
      dummy.position.copy(p)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, len)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[null, null, STREAKS]} frustumCulled={false}>
      <boxGeometry args={[0.035, 0.035, 1]} />
      <meshBasicMaterial color={[0.7, 0.85, 1.4]} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}

// ---------------------------------------------------------------------------
// Poeira espacial: pontinhos passando em +Z
// ---------------------------------------------------------------------------
const DUST_COUNT = 600
function SpaceDust() {
  const ref = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(DUST_COUNT * 3)
    for (let i = 0; i < DUST_COUNT; i++) {
      arr[i * 3] = THREE.MathUtils.randFloatSpread(90)
      arr[i * 3 + 1] = THREE.MathUtils.randFloatSpread(55)
      arr[i * 3 + 2] = THREE.MathUtils.randFloat(-200, 20)
    }
    return arr
  }, [])
  useFrame((_, delta) => {
    const dt = envDt(delta)
    if (!dt) return
    const v = CONFIG.worldSpeed * game.worldMul
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3 + 2] += v * dt // z = z + v * dt
      if (positions[i * 3 + 2] > 20) positions[i * 3 + 2] -= 220
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.12} color="#9fb6ff" transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}

export default function Environment() {
  return (
    <>
      <CapitalShips />
      <DistantBattle />
      <Streaks />
      <SpaceDust />
    </>
  )
}
