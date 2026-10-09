// src/Missiles.jsx
// Armas secundárias: mísseis teleguiados (F ou botão do meio) e drone de escolta (power-up ciano).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, frameDt, segmentSphere, rand, bestTarget, collectTargets, damageArea } from './gameState'
import { sfx } from './audio'

const MAX = 16
const UP = new THREE.Vector3(0, 1, 0)
const tmp = new THREE.Vector3()
const want = new THREE.Vector3()
const dummy = new THREE.Object3D()
const prev = new THREE.Vector3()
const side = new THREE.Vector3()

// Procura o alvo: o mais centralizado à frente (cone de 60°); se não houver, o mais perto em volta
function acquire(from, dir) {
  return bestTarget(from, dir, 0.5, 520) || bestTarget(from, dir, -1, 380)
}
// Um alvo continua válido enquanto estiver "vivo" (caça ativo, peça intacta)
const valid = (t) => t && (t.kind === 'enemy' ? t.ref.active : t.alive)

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
    // Dois mísseis, um de cada asa (eixos LOCAIS da nave levados para o mundo)
    for (const s of [-1, 1]) {
      const m = pool.find((q) => !q.active)
      if (!m) break
      m.active = true
      side.set(s, 0, 0).applyQuaternion(game.shipQuat)
      m.pos.copy(game.shipPos).addScaledVector(side, 1.6).addScaledVector(game.shipUp, -0.4)
      // Sai para o lado e para a frente (somando a velocidade da nave); depois o guiamento corrige o rumo
      m.vel.copy(game.shipVel).addScaledVector(side, 18).addScaledVector(game.shipUp, 6).addScaledVector(game.shipFwd, CONFIG.missileSpeed * 0.4)
      m.target = acquire(game.shipPos, game.shipFwd)
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
    // Dano em área pequena (caças, peças de nave-mãe e do chefe)
    damageArea(m.pos, 4, 7)
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
        if (!valid(m.target)) m.target = acquire(m.pos, tmp.copy(m.vel).normalize())
        const has = valid(m.target)
        if (has) tmp.copy(m.target.pos)
        // Guiamento: gira o vetor velocidade em direção ao alvo, com limite de curva (missileTurn)
        //   desejado = (alvo - posição) normalizado × velocidade; vel = lerp(vel, desejado, k)
        if (has && m.life > 0.18) {
          want.subVectors(tmp, m.pos).normalize().multiplyScalar(CONFIG.missileSpeed)
          m.vel.lerp(want, Math.min(1, CONFIG.missileTurn * dt))
        } else {
          // Sem alvo: segue reto, acelerando até a velocidade de cruzeiro
          m.vel.setLength(Math.min(CONFIG.missileSpeed, m.vel.length() + 60 * dt))
        }
        prev.copy(m.pos)
        m.pos.addScaledVector(m.vel, dt)
        // Rastro de fumaça
        m.trailT -= dt
        if (m.trailT <= 0) {
          m.trailT = 0.03
          game.fx.sparks(m.pos, 'smoke', 1)
        }
        // Colisão com qualquer alvo
        for (const t of collectTargets()) {
          if (segmentSphere(prev, m.pos, t.pos, t.r + 0.6)) {
            explode(m)
            break
          }
        }
        if (m.active && m.life > 5) explode(m)
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
      // Órbita circular em volta da nave, no referencial dela: (cos, sen) × raio → gira com a nave
      droneState.pos
        .set(Math.cos(droneState.angle) * 3.4, 1.2 + Math.sin(droneState.angle * 2) * 0.5, Math.sin(droneState.angle) * 2)
        .applyQuaternion(game.shipQuat)
        .add(game.shipPos)
      d.visible = true
      d.position.copy(droneState.pos)
      d.rotation.y += dt * 4
      // Atira sozinho no alvo mais próximo
      droneState.fireT -= dt
      if (droneState.fireT <= 0) {
        const t = bestTarget(droneState.pos, game.shipFwd, 0.3, 280)
        if (t) {
          want.subVectors(t.pos, droneState.pos).normalize()
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
