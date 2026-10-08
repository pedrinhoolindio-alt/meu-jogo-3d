// src/App.jsx
import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import Player from './Player'
import Lasers from './Lasers'
import Asteroids from './Asteroids'
import { game, BOUNDS, CONFIG } from './gameState'

// ---------------------------------------------------------------------------
// Entrada (mouse + teclado) → escreve no estado global `game`
// ---------------------------------------------------------------------------
function useInput() {
  useEffect(() => {
    const onKeyDown = (e) => {
      game.keys[e.code] = true
      if (e.code === 'Space') {
        e.preventDefault()
        game.wantsToFire = true
      }
    }
    const onKeyUp = (e) => {
      game.keys[e.code] = false
      if (e.code === 'Space') game.wantsToFire = false
    }

    // Converte o mouse de pixels para coordenadas normalizadas (-1..1)
    // e mapeia direto para o "quadrado" de movimento da nave.
    const onMouseMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1 // esquerda -1 → direita +1
      const ny = -((e.clientY / window.innerHeight) * 2 - 1) // baixo -1 → cima +1 (Y da tela é invertido)
      game.target.set(nx * BOUNDS.x, ny * BOUNDS.y)
    }
    const onMouseDown = (e) => {
      if (e.button === 0) game.wantsToFire = true
    }
    const onMouseUp = (e) => {
      if (e.button === 0) game.wantsToFire = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Poeira espacial: pontinhos passando em +Z → sensação de velocidade
// (as <Stars/> ficam "no infinito" e não dão sensação de avanço sozinhas)
// ---------------------------------------------------------------------------
const DUST_COUNT = 500
function SpaceDust() {
  const ref = useRef()
  const positions = useRef(
    (() => {
      const arr = new Float32Array(DUST_COUNT * 3)
      for (let i = 0; i < DUST_COUNT; i++) {
        arr[i * 3] = THREE.MathUtils.randFloatSpread(80)
        arr[i * 3 + 1] = THREE.MathUtils.randFloatSpread(50)
        arr[i * 3 + 2] = THREE.MathUtils.randFloat(-200, 20)
      }
      return arr
    })()
  ).current

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3 + 2] += CONFIG.worldSpeed * dt // z = z + v * dt
      if (positions[i * 3 + 2] > 20) positions[i * 3 + 2] -= 220 // volta para o fundo
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.12} color="#9fb6ff" transparent opacity={0.7} />
    </points>
  )
}

// ---------------------------------------------------------------------------
// HUD (DOM por cima do Canvas). Lê o estado global 10x por segundo.
// ---------------------------------------------------------------------------
function Hud() {
  const [stats, setStats] = useState({ score: 0, hits: 0 })
  useEffect(() => {
    const id = setInterval(() => setStats({ score: game.score, hits: game.hits }), 100)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="hud">
      <div>PONTOS: {stats.score}</div>
      <div>DANOS: {stats.hits}</div>
      <div className="hint">Mouse / WASD para mover · Clique / Espaço para atirar</div>
    </div>
  )
}

export default function App() {
  useInput()

  return (
    <>
      <Canvas camera={{ position: [0, 2.8, 11], fov: 70, near: 0.1, far: 1000 }} dpr={[1, 2]}>
        <color attach="background" args={['#02030a']} />
        <fog attach="fog" args={['#02030a', 80, 240]} />

        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 10, 5]} intensity={1.6} />

        <Stars radius={200} depth={80} count={7000} factor={5} saturation={0} fade speed={1} />
        <SpaceDust />

        <Player />
        <Lasers />
        <Asteroids />
      </Canvas>
      <Hud />
    </>
  )
}
