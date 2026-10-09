// src/Environment.jsx
// Cenário em movimento: naves capitais ao fundo, batalha distante, rastros de velocidade e poeira.
// (Céu, Sol e planetas reais ficam em Space.jsx)
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, rand } from './gameState'
import { useUI } from './store'
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
    // Fora da área de combate (raio 750), visíveis de longe
    ally.current.position.set(620 + Math.sin(t * 0.05) * 15, 140 + Math.sin(t * 0.1) * 4, -1050)
    enemy.current.position.set(-900 - Math.sin(t * 0.04) * 20, 260, -900)
  })
  return (
    <>
      {/* Aurora: navega de lado, mostrando o perfil */}
      <group ref={ally} rotation={[0.08, -1.25, 0.05]}>
        <Ship kind="allyCruiser" scale={12} glowColor="#7fb2ff" fog={false} />
      </group>
      <group ref={enemy} rotation={[-0.05, 1.9, 0]}>
        <Ship kind="enemyCruiser" scale={14} flameMat={M.enemyFlame} glowColor="#ff6040" fog={false} />
      </group>
    </>
  )
}

// ---------------------------------------------------------------------------
// Batalha distante: rajadas vermelhas (aliados) e verdes (inimigos) + clarões
// ---------------------------------------------------------------------------
// Ponto aleatório numa casca esférica distante (900–1300) em volta do centro da arena
function randomFar(out) {
  const a = rand(0, Math.PI * 2)
  const el = rand(-0.3, 0.5)
  return out.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(rand(900, 1300))
}

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
        randomFar(b.pos)
        b.dir.set(rand(-1, 1), rand(-0.3, 0.3), rand(-0.3, 0.3)).normalize()
        const i = bolts.indexOf(b)
        mesh.current.setColorAt(i, Math.random() < 0.5 ? red : green)
        mesh.current.instanceColor.needsUpdate = true
      }
      if (Math.random() < 0.12) {
        const f = flashes.find((q) => q.t >= 1)
        if (f) {
          f.t = 0
          randomFar(f.pos)
          f.size = rand(30, 80)
        }
      }
    }
    bolts.forEach((b, i) => {
      if (b.active) {
        b.life -= dt
        b.pos.addScaledVector(b.dir, 420 * dt)
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
        <boxGeometry args={[1.6, 1.6, 30]} />
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
// Poeira e rastros de velocidade em VOO LIVRE: as partículas ficam paradas no mundo dentro de um
// "cubo" que acompanha a nave. Quando uma sai do cubo, reaparece do lado oposto (módulo):
//   p = centro + ((p − centro + metade) mod tamanho) − metade
// Assim a nave sempre voa através delas, em qualquer direção.
// ---------------------------------------------------------------------------
const wrap = (v, c, size) => {
  const h = size / 2
  return c + ((((v - c + h) % size) + size) % size) - h
}

const STREAKS = 140
const STREAK_BOX = 160
function Streaks({ color = [0.7, 0.85, 1.4], opacity = 0.5 }) {
  const mesh = useRef()
  const data = useMemo(() => Array.from({ length: STREAKS }, () => new THREE.Vector3(rand(-80, 80), rand(-80, 80), rand(-80, 80))), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame(() => {
    const c = game.shipPos
    // Comprimento cresce com a velocidade: parado = invisível; turbo = riscos longos
    const len = Math.max(0.001, (game.speed - 20) * 0.09 + (game.worldMul - 1) * 9)
    // Os riscos ficam alinhados com o movimento (eixo Z do box → direção da velocidade)
    if (game.shipVel.lengthSq() > 1) q.setFromUnitVectors(Z_AXIS, tmpDir.copy(game.shipVel).normalize())
    data.forEach((p, i) => {
      p.set(wrap(p.x, c.x, STREAK_BOX), wrap(p.y, c.y, STREAK_BOX), wrap(p.z, c.z, STREAK_BOX))
      dummy.position.copy(p)
      // Não desenha riscos colados na câmera (atrapalham a visão)
      const near = p.distanceToSquared(c) < 100
      dummy.quaternion.copy(q)
      dummy.scale.set(1, 1, near ? 0.001 : len)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[null, null, STREAKS]} frustumCulled={false}>
      <boxGeometry args={[0.035, 0.035, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </instancedMesh>
  )
}
const tmpDir = new THREE.Vector3()

const DUST_COUNT = 900
const DUST_BOX = 120
function SpaceDust({ color = '#9fb6ff', size = 0.12 }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(DUST_COUNT * 3)
    for (let i = 0; i < DUST_COUNT * 3; i++) arr[i] = THREE.MathUtils.randFloatSpread(DUST_BOX)
    return arr
  }, [])
  useFrame(() => {
    const c = game.shipPos
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = wrap(positions[i * 3], c.x, DUST_BOX)
      positions[i * 3 + 1] = wrap(positions[i * 3 + 1], c.y, DUST_BOX)
      positions[i * 3 + 2] = wrap(positions[i * 3 + 2], c.z, DUST_BOX)
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}

export default function Environment() {
  const stage = useUI((s) => s.stage)
  // Na órbita: naves capitais, batalha distante e poeira espacial.
  // Na atmosfera: só os riscos de vento (o cenário fica em Surface.jsx)
  if (stage === 'surface') return <Streaks color={[1.4, 1.4, 1.5]} opacity={0.28} />
  return (
    <>
      <CapitalShips />
      <DistantBattle />
      <Streaks />
      <SpaceDust />
    </>
  )
}
