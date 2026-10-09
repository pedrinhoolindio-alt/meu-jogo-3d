// src/Missiles.jsx
// Armas secundárias: mísseis teleguiados (F ou botão do meio) e drone de escolta (power-up ciano).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, frameDt, segmentSphere, ENEMY_TYPES, rand } from './gameState'
import { sfx } from './audio'

const MAX = 16
const UP = new THREE.Vector3(0, 1, 0)
const tmp = new THREE.Vector3()
const want = new THREE.Vector3()
const dummy = new THREE.Object3D()
const prev = new THREE.Vector3()
const bossPart = new THREE.Vector3()

// Procura o alvo mais ameaçador à frente: o mais próximo da nave (ou uma peça viva do chefe)
function acquire(from) {
  let best = null
  let bestD = Infinity
  for (const e of game.enemies) {
    if (!e.active || e.pos.z > from.z + 2 || e.pos.z < -200) continue
    const d = e.pos.distanceToSquared(from)
    if (d < bestD) {
      bestD = d
      best = { kind: 'enemy', ref: e }
    }
  }
  const b = game.boss
  if (!best && b && b.active && b.state === 'fight') {
    const t = b.turrets.findIndex((q) => q.alive)
    best = { kind: 'boss', turret: t }
  }
  return best
}

function targetPos(t, out) {
  if (!t) return null
  if (t.kind === 'enemy') return t.ref.active ? out.copy(t.ref.pos) : null
  const b = game.boss
  if (!b || !b.active || b.state !== 'fight') return null
  if (t.turret >= 0 && b.turrets[t.turret].alive) return out.copy(b.pos).add(b.turrets[t.turret].offset)
  return out.copy(b.pos).add(b.coreOffset)
}

export default function Missiles() {
  const mesh = useRef()
  const flames = useRef()
  const drone = useRef()
  // Brilho do motor do míssil: esfera deslocada para a traseira (o cilindro aponta +Y = frente)
  const flameGeo = useMemo(() => new THREE.SphereGeometry(0.17, 8, 6).translate(0, -0.62, 0), [])
  const droneState = useMemo(() => ({ angle: 0, fireT: 0, pos: new THREE.Vector3() }), [])
  const pool = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        target: null,
        life: 0,
        trailT: 0,
      })),
    []
  )

  function launch() {
    if (game.missiles <= 0) return
    // Dois mísseis, um de cada asa
    for (const side of [-1, 1]) {
      const m = pool.find((q) => !q.active)
      if (!m) break
      m.active = true
      m.pos.set(game.shipPos.x + side * 1.6, game.shipPos.y - 0.4, game.shipPos.z - 1)
      // Sai para o lado e para a frente; depois o guiamento corrige o rumo
      m.vel.set(side * 18, 6, -CONFIG.missileSpeed * 0.6)
      m.target = acquire(m.pos)
      m.life = 0
      m.trailT = 0
    }
    game.missiles--
    sfx.missile()
  }

  function explode(m) {
    m.active = false
    game.fx.explode(m.pos, { size: 1.1 })
    sfx.explosion(false)
    // Dano em área pequena
    for (const e of game.enemies) {
      if (!e.active) continue
      const r = ENEMY_TYPES[e.type].radius + 4
      if (e.pos.distanceToSquared(m.pos) < r * r) game.damageEnemy(e, 7, 'player')
    }
    game.damageBossArea(m.pos, 7, 9)
  }

  useEffect(() => {
    game.fireMissile = launch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

  useFrame((state, delta) => {
    const dt = frameDt(delta)
    if (!dt) return

    if (game.wantsMissile) {
      game.wantsMissile = false
      if (game.phase === 'playing') launch()
    }

    // ---- Mísseis ----
    for (let i = 0; i < MAX; i++) {
      const m = pool[i]
      if (m.active) {
        m.life += dt
        if (!m.target || !targetPos(m.target, tmp)) {
          m.target = acquire(m.pos)
        }
        const has = m.target && targetPos(m.target, tmp)
        // Guiamento: gira o vetor velocidade em direção ao alvo, com limite de curva (missileTurn)
        //   desejado = (alvo - posição) normalizado × velocidade; vel = lerp(vel, desejado, k)
        if (has && m.life > 0.18) {
          want.subVectors(tmp, m.pos).normalize().multiplyScalar(CONFIG.missileSpeed)
          m.vel.lerp(want, Math.min(1, CONFIG.missileTurn * dt))
        } else {
          want.set(0, 0, -CONFIG.missileSpeed)
          m.vel.lerp(want, Math.min(1, 2 * dt))
        }
        prev.copy(m.pos)
        m.pos.addScaledVector(m.vel, dt)
        // Rastro de fumaça
        m.trailT -= dt
        if (m.trailT <= 0) {
          m.trailT = 0.03
          game.fx.sparks(m.pos, 'smoke', 1)
        }
        // Colisão com inimigos
        for (const e of game.enemies) {
          if (!e.active) continue
          if (segmentSphere(prev, m.pos, e.pos, ENEMY_TYPES[e.type].radius + 0.6)) {
            explode(m)
            break
          }
        }
        if (m.active && has && m.target.kind === 'boss' && m.pos.distanceToSquared(tmp) < 9) explode(m)
        if (m.active && (m.life > 4 || m.pos.z < -260)) explode(m)
      }
      if (m.active) {
        dummy.position.copy(m.pos)
        tmp.copy(m.vel).normalize()
        dummy.quaternion.setFromUnitVectors(UP, tmp)
        dummy.scale.setScalar(1)
      } else {
        dummy.scale.setScalar(0)
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
      flames.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    flames.current.instanceMatrix.needsUpdate = true

    // ---- Drone de escolta ----
    const d = drone.current
    if (game.droneTime > 0 && game.phase === 'playing') {
      game.droneTime -= dt
      droneState.angle += dt * 2.2
      // Órbita circular em volta da nave: (cos, sen) × raio
      droneState.pos.set(
        game.shipPos.x + Math.cos(droneState.angle) * 3.4,
        game.shipPos.y + 1.2 + Math.sin(droneState.angle * 2) * 0.5,
        game.shipPos.z + Math.sin(droneState.angle) * 2
      )
      d.visible = true
      d.position.copy(droneState.pos)
      d.rotation.y += dt * 4
      // Atira sozinho no alvo mais próximo
      droneState.fireT -= dt
      if (droneState.fireT <= 0) {
        const t = acquire(droneState.pos)
        if (t && targetPos(t, tmp)) {
          want.subVectors(tmp, droneState.pos).normalize()
          game.firePlayerLaser(droneState.pos, want, { owner: 'drone', dmg: 0.8, color: new THREE.Color(0.4, 3, 3.2) })
          sfx.wingLaser()
        }
        droneState.fireT = 0.32 + rand(0, 0.08)
      }
      if (game.droneTime <= 0) game.fx.sparks(droneState.pos, 'blue', 14)
    } else {
      d.visible = false
    }
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[null, null, MAX]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 1.1, 8]} />
        <meshStandardMaterial color="#d8dde4" metalness={0.7} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={flames} args={[flameGeo, null, MAX]} frustumCulled={false}>
        <meshBasicMaterial color={[4, 2.2, 0.8]} toneMapped={false} />
      </instancedMesh>
      {/* Drone: núcleo brilhante com anel */}
      <group ref={drone} visible={false}>
        <mesh castShadow>
          <octahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color="#9fb6c8" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.7, 0.05, 8, 32]} />
          <meshBasicMaterial color={[0.4, 3, 3.2]} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.18, 12, 8]} />
          <meshBasicMaterial color={[0.6, 3.5, 3.5]} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}
