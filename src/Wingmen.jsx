// src/Wingmen.jsx
// Alas do Esquadrão Fênix: Janiele (esquerda) e Fênix 3 (direita).
// Voam em formação NO REFERENCIAL da nave líder (acompanham curvas e loopings) e atiram sozinhos.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, damp, rand, bestTarget } from './gameState'
import { Ship } from './models'
import { sfx } from './audio'

const { lerp, clamp } = THREE.MathUtils
// Janiele (chefe da equipe, Fênix 2) à esquerda e Fênix 3 à direita
const ALLIES = [
  { id: 'janiele', side: -1 },
  { id: 'wing3', side: 1 },
]
const slot = new THREE.Vector3()
const origin = new THREE.Vector3()
const dir = new THREE.Vector3()
const fwd = new THREE.Vector3()
const right = new THREE.Vector3()
const aim = new THREE.Vector3()

export default function Wingmen() {
  const refs = useRef([])
  const banks = useRef([])
  const data = useMemo(
    () =>
      ALLIES.map((a) => ({
        ...a,
        pos: new THREE.Vector3(a.side * 14, 3, 6),
        quat: new THREE.Quaternion(),
        fireT: rand(1, 2),
        bank: 0,
      })),
    []
  )

  useFrame((state, delta) => {
    if (game.phase === 'paused' || game.phase === 'hangar' || game.phase === 'photo') return
    const raw = Math.min(Math.max(delta, 0.0001), 0.05)
    const dt = raw * game.timeScale
    const t = state.clock.elapsedTime

    data.forEach((w, i) => {
      const g = refs.current[i]
      // Posição de formação no espaço LOCAL do líder (lado, um pouco acima e atrás)
      // e levada para o mundo: mundo = posição_líder + rotação_líder · local
      slot
        .set(w.side * 10, 1.2 + Math.sin(t * 0.9 + i * 2) * 0.7, -3 + Math.sin(t * 0.5 + i) * 1.5)
        .applyQuaternion(game.shipQuat)
        .add(game.shipPos)
      // Entre missões e na entrada da atmosfera: ficam grudados na formação
      const tight = game.phase !== 'playing' || game.stage === 'entry'
      w.pos.lerp(slot, tight ? 1 : damp(3, dt))
      // Rotação: segue a do líder com atraso (slerp)
      const before = w.bank
      w.quat.slerp(game.shipQuat, tight ? 1 : damp(3, dt))
      // Inclina na curva conforme a diferença de direção lateral entre a ala e o líder
      right.set(1, 0, 0).applyQuaternion(w.quat)
      fwd.set(0, 0, -1).applyQuaternion(game.shipQuat)
      w.bank = lerp(before, clamp(-fwd.dot(right) * 3 + Math.sin(t * 0.7 + i) * 0.1, -0.8, 0.8), damp(4, dt))
      g.position.copy(w.pos)
      g.quaternion.copy(w.quat)
      banks.current[i].rotation.z = w.bank

      // Tiro automático no alvo mais centralizado à frente da ala
      if (game.phase !== 'playing' || game.stage === 'entry') return
      w.fireT -= dt
      if (w.fireT > 0) return
      fwd.set(0, 0, -1).applyQuaternion(w.quat)
      const tgt = bestTarget(w.pos, fwd, 0.55, 300)
      if (!tgt) {
        w.fireT = 0.4
        return
      }
      // Mira com previsão: alvo + velocidade · tempo de voo do laser
      aim.copy(tgt.pos)
      if (tgt.vel) aim.addScaledVector(tgt.vel, tgt.pos.distanceTo(w.pos) / 190)
      for (const sx of [-1, 1]) {
        origin.set(sx * 2.1, 0, -1.5).applyQuaternion(w.quat).add(w.pos)
        dir.subVectors(aim, origin).normalize()
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
        <group key={a.id} ref={(el) => (refs.current[i] = el)}>
          <group ref={(el) => (banks.current[i] = el)}>
            <Ship kind={a.id} scale={0.44} flipped />
          </group>
        </group>
      ))}
    </>
  )
}
