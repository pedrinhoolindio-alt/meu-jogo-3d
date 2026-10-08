// src/Wingmen.jsx
// Alas do Esquadrão Fênix: Faísca (esquerda) e Bigorna (direita).
// Voam em formação com o jogador e atiram sozinhos nos inimigos.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, damp, rand } from './gameState'
import { PlayerShip } from './models'
import { sfx } from './audio'

const { lerp, clamp } = THREE.MathUtils
const ALLIES = [
  { id: 'faisca', side: -1, stripe: '#1e88e5' },
  { id: 'ramos', side: 1, stripe: '#f57c00' },
]
const target = new THREE.Vector3()
const prev = new THREE.Vector3()
const origin = new THREE.Vector3()
const dir = new THREE.Vector3()
const aimPos = new THREE.Vector3()

// Escolhe o alvo mais próximo à frente (inimigo ou parte do chefe)
function findTarget(from) {
  let best = null
  let bestD = Infinity
  for (const e of game.enemies) {
    if (!e.active || e.pos.z > from.z - 8 || e.pos.z < -120) continue
    const d = e.pos.distanceToSquared(from)
    if (d < bestD) {
      bestD = d
      best = e.pos
    }
  }
  const b = game.boss
  if (!best && b && b.active && b.state === 'fight') {
    const tu = b.turrets.find((t) => t.alive)
    aimPos.copy(b.pos).add(tu ? tu.offset : b.coreOffset)
    best = aimPos
  }
  return best
}

export default function Wingmen() {
  const refs = useRef([])
  const data = useMemo(
    () => ALLIES.map((a) => ({ ...a, pos: new THREE.Vector3(a.side * 14, 3, 6), fireT: rand(1, 2), bank: 0 })),
    []
  )

  useFrame((state, delta) => {
    if (game.phase === 'paused') return
    const raw = Math.min(Math.max(delta, 0.0001), 0.05)
    const dt = raw * game.timeScale
    const t = state.clock.elapsedTime

    data.forEach((w, i) => {
      const g = refs.current[i]
      // Posição de formação: segue parte do movimento do líder + ondulação senoidal
      target.set(
        game.shipPos.x * 0.45 + w.side * 8.5,
        game.shipPos.y * 0.4 + 2 + Math.sin(t * 0.9 + i * 2) * 0.8,
        -6 + Math.sin(t * 0.5 + i) * 1.5
      )
      prev.copy(w.pos)
      w.pos.lerp(target, damp(2.2, dt))
      const vx = (w.pos.x - prev.x) / dt
      w.bank = lerp(w.bank, clamp(-vx * 0.08 + Math.sin(t * 0.7 + i) * 0.12, -0.7, 0.7), damp(4, dt))
      g.position.copy(w.pos)
      g.rotation.set(0, 0, w.bank)

      // Tiro automático
      if (game.phase !== 'playing') return
      w.fireT -= dt
      if (w.fireT > 0) return
      const tgt = findTarget(w.pos)
      if (!tgt) {
        w.fireT = 0.4
        return
      }
      for (const sx of [-1, 1]) {
        origin.set(w.pos.x + sx * 2.1, w.pos.y, w.pos.z - 1)
        dir.subVectors(tgt, origin).normalize()
        dir.x += rand(-0.02, 0.02)
        dir.y += rand(-0.02, 0.02)
        game.firePlayerLaser(origin, dir, { owner: 'wing', dmg: 0.5 })
      }
      sfx.wingLaser()
      w.fireT = rand(0.9, 1.7)
    })
  })

  return (
    <>
      {ALLIES.map((a, i) => (
        <group key={a.id} ref={(el) => (refs.current[i] = el)} scale={0.78}>
          <PlayerShip stripe={a.stripe} />
        </group>
      ))}
    </>
  )
}
