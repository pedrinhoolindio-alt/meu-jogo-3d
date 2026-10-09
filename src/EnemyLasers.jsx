// src/EnemyLasers.jsx
// Tiros da Armada do Caos: lasers verdes ("bolt"), plasma laranja lento e forte ("plasma"),
// disparo carregado ("heavy") e plasma TELEGUIADO roxo ("seeker", pode ser abatido a tiros).
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, frameDt, hitsShip, damagePlayer, segmentSphere } from './gameState'
import { sfx } from './audio'

const MAX = 220
const UP = new THREE.Vector3(0, 1, 0)
const dummy = new THREE.Object3D()
const mid = new THREE.Vector3()
const dirTmp = new THREE.Vector3()
const want = new THREE.Vector3()
const COLORS = {
  bolt: new THREE.Color(0.5, 3.4, 0.6),
  plasma: new THREE.Color(3.6, 1.4, 0.3),
  heavy: new THREE.Color(4, 0.5, 2.6), // disparo carregado do Ferrão
  seeker: new THREE.Color(2.6, 0.6, 4), // plasma teleguiado da Arraia/Tormenta
}

export default function EnemyLasers() {
  const mesh = useRef()
  const pool = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        active: false,
        pos: new THREE.Vector3(),
        prev: new THREE.Vector3(),
        vel: new THREE.Vector3(), // velocidade = direção * rapidez
        life: 0,
        kind: 'bolt',
      })),
    []
  )

  useLayoutEffect(() => {
    for (let i = 0; i < MAX; i++) mesh.current.setColorAt(i, COLORS.bolt)
    mesh.current.instanceColor.needsUpdate = true
  }, [])

  useEffect(() => {
    game.fireEnemyLaser = (from, direction, speed, kind = 'bolt') => {
      for (let i = 0; i < MAX; i++) {
        const b = pool[i]
        if (b.active) continue
        b.pos.copy(from)
        b.prev.copy(from)
        // vel = direção normalizada * velocidade escalar
        b.vel.copy(direction).normalize().multiplyScalar(speed)
        b.life = 0
        b.kind = kind
        b.active = true
        mesh.current.setColorAt(i, COLORS[kind])
        mesh.current.instanceColor.needsUpdate = true
        sfx.enemyLaser()
        return
      }
    }
    game.clearEnemyLasers = () => {
      for (const b of pool) {
        if (b.active) {
          b.active = false
          game.fx.sparks(b.pos, 'green', 3)
        }
      }
    }
  }, [pool])

  useFrame((_, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    for (let i = 0; i < MAX; i++) {
      const b = pool[i]
      if (b.active) {
        b.prev.copy(b.pos)
        if (b.kind === 'seeker' && b.life > 0.4) {
          // Teleguiado: a velocidade gira aos poucos para a nave (curva limitada → dá para despistar)
          const sp = b.vel.length()
          want.subVectors(game.shipPos, b.pos).normalize().multiplyScalar(sp)
          b.vel.lerp(want, Math.min(1, 1.1 * dt)).setLength(sp)
        }
        b.pos.addScaledVector(b.vel, dt)
        b.life += dt
        // Recicla por tempo de vida ou se ficou muito longe da nave (voo livre: vale em qualquer direção)
        if (b.life > (b.kind === 'seeker' ? 7 : 4.5) || b.pos.distanceToSquared(game.shipPos) > 700 * 700) b.active = false
        // Plasma teleguiado pode ser derrubado pelos lasers do jogador
        if (b.active && b.kind === 'seeker') {
          for (const l of game.playerLasers) {
            if (l.active && segmentSphere(l.prev, l.pos, b.pos, 1.4)) {
              l.active = false
              b.active = false
              game.fx.sparks(b.pos, 'blue', 12)
              break
            }
          }
        }

        // Testa a ponta e o meio do trajeto do frame (evita atravessar a nave)
        if (b.active && game.phase === 'playing') {
          mid.addVectors(b.prev, b.pos).multiplyScalar(0.5)
          const pad = b.kind === 'plasma' || b.kind === 'seeker' ? 0.5 : b.kind === 'heavy' ? 0.35 : 0
          if (hitsShip(b.pos, pad) || hitsShip(mid, pad)) {
            b.active = false
            if (game.rollTimer > 0) {
              damagePlayer(0, 'laser') // conta como rebatido (som + evento)
              game.fx.sparks(b.pos, 'blue', 10)
            } else if (damagePlayer(b.kind === 'heavy' ? 18 : b.kind === 'plasma' || b.kind === 'seeker' ? 12 : 6, 'laser')) {
              game.fx.sparks(b.pos, b.kind === 'plasma' ? 'orange' : 'green', 14)
            }
          }
        }
      }
      if (b.active) {
        dummy.position.copy(b.pos)
        dirTmp.copy(b.vel).normalize()
        dummy.quaternion.setFromUnitVectors(UP, dirTmp)
        if (b.kind === 'plasma') dummy.scale.set(4, 0.45, 4)
        else if (b.kind === 'seeker') dummy.scale.set(6, 0.5, 6)
        else if (b.kind === 'heavy') dummy.scale.set(2.6, 2.2, 2.6)
        else dummy.scale.set(1, 1, 1)
      } else {
        dummy.scale.setScalar(0)
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, MAX]} frustumCulled={false}>
      <cylinderGeometry args={[0.09, 0.09, 2.2, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
