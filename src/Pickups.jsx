// src/Pickups.jsx
// Power-ups: escudo (azul), arma (dourado), bomba (vermelho), mísseis (laranja), drone (ciano)
// e cápsulas de meta (verde).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, frameDt } from './gameState'
import { sfx } from './audio'

const MAX = 20
const TYPES = ['shield', 'weapon', 'bomb', 'goal', 'missile', 'drone']
const toShip = new THREE.Vector3()

const mat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false })
const MATS = {
  shield: mat(0.5, 1.6, 3.5),
  weapon: mat(3.5, 2.4, 0.4),
  bomb: mat(3.5, 0.5, 0.4),
  core: mat(2.5, 2.5, 2.5),
  goal: mat(0.6, 3.2, 1.2),
  goalCore: mat(3, 3.4, 2.6),
  missile: mat(3.6, 1.5, 0.3),
  drone: mat(0.4, 3, 3.2),
}

function ShieldModel() {
  return (
    <group>
      <mesh material={MATS.shield}>
        <torusGeometry args={[1, 0.12, 8, 32]} />
      </mesh>
      <mesh material={MATS.core}>
        <boxGeometry args={[0.9, 0.25, 0.25]} />
      </mesh>
      <mesh material={MATS.core}>
        <boxGeometry args={[0.25, 0.9, 0.25]} />
      </mesh>
    </group>
  )
}

function WeaponModel() {
  return (
    <group>
      <mesh material={MATS.weapon}>
        <octahedronGeometry args={[0.7, 0]} />
      </mesh>
      <mesh material={MATS.weapon} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.05, 0.06, 6, 32]} />
      </mesh>
    </group>
  )
}

function BombModel() {
  return (
    <group>
      <mesh material={MATS.bomb}>
        <sphereGeometry args={[0.55, 16, 12]} />
      </mesh>
      <mesh material={MATS.bomb}>
        <torusGeometry args={[1, 0.08, 6, 32]} />
      </mesh>
      <mesh material={MATS.bomb} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.08, 6, 32]} />
      </mesh>
    </group>
  )
}

// Cápsula de meta (atendimentos, passageiros...): anel hexagonal verde com núcleo brilhante
function GoalModel() {
  return (
    <group scale={1.25}>
      <mesh material={MATS.goal}>
        <torusGeometry args={[1, 0.1, 6, 6]} />
      </mesh>
      <mesh material={MATS.goal} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.05, 6, 24]} />
      </mesh>
      <mesh material={MATS.goalCore}>
        <icosahedronGeometry args={[0.38, 0]} />
      </mesh>
    </group>
  )
}

// Mísseis: três foguetes em feixe dentro de um anel laranja
function MissileModel() {
  return (
    <group>
      <mesh material={MATS.missile} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.08, 6, 32]} />
      </mesh>
      {[-0.35, 0, 0.35].map((x) => (
        <mesh key={x} material={MATS.core} position={[x, 0, 0]}>
          <coneGeometry args={[0.14, 0.9, 8]} />
        </mesh>
      ))}
    </group>
  )
}

// Drone: octaedro com dois anéis ciano cruzados
function DroneModel() {
  return (
    <group>
      <mesh material={MATS.drone}>
        <torusGeometry args={[0.95, 0.07, 6, 32]} />
      </mesh>
      <mesh material={MATS.drone} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.07, 6, 32]} />
      </mesh>
      <mesh material={MATS.core}>
        <octahedronGeometry args={[0.45, 0]} />
      </mesh>
    </group>
  )
}

export default function Pickups() {
  const groups = useRef([])
  const models = useRef([])
  const pool = useMemo(
    () => Array.from({ length: MAX }, () => ({ active: false, type: 'shield', pos: new THREE.Vector3(), t: 0 })),
    []
  )

  useEffect(() => {
    game.pickups = pool
    game.spawnPickup = (type, pos) => {
      const p = pool.find((q) => !q.active)
      if (!p) return
      p.active = true
      p.type = type
      p.pos.copy(pos)
      p.t = 0
    }
  }, [pool])

  function collect(p) {
    p.active = false
    sfx.pickup()
    game.fx.sparks(p.pos, { shield: 'blue', weapon: 'orange', goal: 'green', missile: 'orange', drone: 'blue' }[p.type] || 'bomb', 20)
    if (p.type === 'goal') {
      // Conta para a meta da missão
      if (game.mstats) game.mstats.tokens++
      game.score += 150
      game.events.push({ type: 'token' })
      return
    }
    let key = 'pickup_' + p.type
    if (p.type === 'missile') {
      game.missiles = Math.min(12, game.missiles + 4)
    } else if (p.type === 'drone') {
      game.droneTime = CONFIG.droneDuration
    } else if (p.type === 'shield') {
      game.shield = Math.min(CONFIG.maxShield, game.shield + 35)
    } else if (p.type === 'weapon') {
      if (game.weaponLevel < CONFIG.maxWeaponLevel) {
        game.weaponLevel++
        key = 'pickup_weapon' + game.weaponLevel
      } else {
        game.score += 500
        key = 'pickup_weaponMax'
      }
    } else {
      game.bombs = Math.min(9, game.bombs + 1)
    }
    game.events.push({ type: 'pickup', key })
  }

  useFrame((_, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    for (let i = 0; i < MAX; i++) {
      const p = pool[i]
      const g = groups.current[i]
      if (p.active) {
        p.t += dt
        // Voo livre: os itens ficam parados no espaço (flutuando). Ímã: perto da nave, são puxados até ela
        toShip.subVectors(game.shipPos, p.pos)
        const d = toShip.length()
        const magnet = p.type === 'goal' ? 18 : 14
        if (d < magnet) p.pos.addScaledVector(toShip.normalize(), (40 + game.speed) * dt)
        if (game.phase === 'playing' && d < 3.8) collect(p)
        // Somem depois de um tempo (as cápsulas de meta duram mais)
        if (p.t > (p.type === 'goal' ? 40 : 30)) p.active = false
      }
      g.visible = p.active
      if (!p.active) continue
      g.position.copy(p.pos)
      g.position.y += Math.sin(p.t * 3) * 0.3
      g.rotation.set(0, p.t * 2, Math.sin(p.t) * 0.3)
      // Os itens ficam maiores para serem vistos de longe; piscam antes de sumir
      g.scale.setScalar(p.type === 'goal' ? 2.2 : 1.5)
      if (p.t > (p.type === 'goal' ? 34 : 25)) g.visible = Math.floor(p.t * 8) % 2 === 0
      const ms = models.current[i]
      for (let j = 0; j < TYPES.length; j++) ms[j].visible = TYPES[j] === p.type
    }
  })

  return (
    <>
      {Array.from({ length: MAX }, (_, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          {[ShieldModel, WeaponModel, BombModel, GoalModel, MissileModel, DroneModel].map((Model, j) => (
            <group
              key={j}
              ref={(el) => {
                if (!models.current[i]) models.current[i] = []
                models.current[i][j] = el
              }}
            >
              <Model />
            </group>
          ))}
        </group>
      ))}
    </>
  )
}
