// src/Enemies.jsx
// Naves da Armada Escarlate: Vespa (caça), Lança (interceptador) e Martelo (bombardeiro).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, BOUNDS, ENEMY_TYPES, frameDt, rand, damp, segmentSphere, hitsShip, damagePlayer, addScore } from './gameState'
import { FighterModel, InterceptorModel, BomberModel } from './models'
import { sfx } from './audio'

const MAX = 18
const TYPE_LIST = ['fighter', 'interceptor', 'bomber']
const { lerp, clamp } = THREE.MathUtils
const tmp = new THREE.Vector3()
const aim = new THREE.Vector3()

export default function Enemies() {
  const groups = useRef([])
  const models = useRef([]) // models[i][j] = grupo do modelo j do slot i

  const pool = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        active: false,
        type: 'fighter',
        pos: new THREE.Vector3(),
        prevX: 0,
        prevY: 0,
        vel: new THREE.Vector3(),
        anchor: new THREE.Vector2(), // centro do "vai-e-vem" lateral
        hp: 1,
        state: 'approach',
        t: 0,
        holdZ: -50,
        holdTime: 5,
        fireT: 1,
        seed: Math.random() * 10,
        bank: 0,
      })),
    []
  )

  function spawn(type, opts = {}) {
    const e = pool.find((p) => !p.active)
    if (!e) return null
    const T = ENEMY_TYPES[type]
    e.active = true
    e.type = type
    e.hp = T.hp
    e.t = 0
    e.bank = 0
    e.seed = Math.random() * 10
    e.fireT = rand(0.8, T.fireEvery + 0.8)

    if (type === 'interceptor') {
      // Mergulha de um dos flancos em direção à nave
      const side = Math.random() < 0.5 ? -1 : 1
      e.pos.set(side * rand(30, 45), rand(-8, 8), rand(-170, -130))
      tmp.set(game.shipPos.x * 0.5 + rand(-5, 5), game.shipPos.y * 0.5 + rand(-3, 3), 12)
      // velocidade = (alvo - posição) normalizado * rapidez
      e.vel.subVectors(tmp, e.pos).normalize().multiplyScalar(T.speed)
      e.state = 'dive'
    } else {
      e.pos.set(opts.x ?? rand(-1, 1) * BOUNDS.x * 1.6, opts.y ?? rand(-1, 1) * BOUNDS.y * 1.4, opts.z ?? -230)
      e.anchor.set(e.pos.x, e.pos.y)
      e.holdZ = type === 'bomber' ? rand(-88, -72) : rand(-62, -38)
      e.holdTime = type === 'bomber' ? rand(9, 12) : rand(4, 7)
      e.state = 'approach'
    }
    e.prevX = e.pos.x
    e.prevY = e.pos.y
    return e
  }

  function kill(e, owner) {
    const T = ENEMY_TYPES[e.type]
    e.active = false
    game.fx.explode(e.pos, { size: e.type === 'bomber' ? 2 : 1.2 })
    if (e.type === 'bomber') game.fx.shockwave(e.pos, 1.5)
    sfx.explosion(e.type === 'bomber')
    game.kills++
    if (game.mstats) game.mstats.kills++ // conta para a meta da missão (toda a equipe)
    game.events.push({ type: 'kill' })
    if (owner === 'player') addScore(T.score, 'player')
    else if (owner === 'wing') {
      addScore(T.score, 'wing')
      game.events.push({ type: 'wingKill' })
    }
    // Chance de soltar um power-up (bombardeiros quase sempre soltam)
    const r = Math.random()
    if (owner !== 'ram' && (e.type === 'bomber' ? r < 0.75 : r < 0.1)) {
      const roll = Math.random()
      const kind = roll < 0.45 ? 'shield' : roll < 0.8 ? 'weapon' : 'bomb'
      game.spawnPickup(kind, e.pos)
    }
  }

  function damage(e, dmg, owner) {
    if (!e.active) return
    e.hp -= dmg
    if (owner === 'player') game.stats.hits++
    game.fx.sparks(e.pos, 'orange', 6)
    sfx.hitEnemy()
    if (e.hp <= 0) kill(e, owner)
  }

  function fire(e) {
    const T = ENEMY_TYPES[e.type]
    tmp.copy(e.pos)
    tmp.z += 1.8
    if (e.type === 'bomber') {
      // Leque de 3 bolas de plasma
      for (let k = -1; k <= 1; k++) {
        aim.subVectors(game.shipPos, tmp).normalize()
        aim.x += k * 0.12
        game.fireEnemyLaser(tmp, aim, T.boltSpeed, 'plasma')
      }
    } else {
      // Mira na nave com um pouco de erro aleatório (senão seria impossível desviar)
      aim.subVectors(game.shipPos, tmp)
      aim.x += rand(-0.8, 0.8)
      aim.y += rand(-0.5, 0.5)
      game.fireEnemyLaser(tmp, aim, T.boltSpeed, 'bolt')
    }
  }

  useEffect(() => {
    game.enemies = pool
    game.spawnEnemy = spawn
    game.damageEnemy = damage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

  useFrame((_, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    const playing = game.phase === 'playing'
    // Os inimigos ficam mais agressivos a cada fase
    const aggression = 1 - Math.min(game.missionIndex, 4) * 0.06

    for (let i = 0; i < MAX; i++) {
      const e = pool[i]
      const g = groups.current[i]
      if (!e.active) {
        g.visible = false
        continue
      }
      const T = ENEMY_TYPES[e.type]
      e.t += dt
      e.prevX = e.pos.x
      e.prevY = e.pos.y
      const sp = T.speed * game.worldMul

      // ---------------- Comportamento (máquina de estados) ----------------
      if (e.state === 'approach') {
        // Vem do fundo em +Z até a distância de combate (holdZ)
        e.pos.z += sp * 1.3 * dt
        if (e.pos.z >= e.holdZ) {
          e.state = 'strafe'
          e.t = 0
        }
      } else if (e.state === 'strafe') {
        // Vai-e-vem lateral: x = âncora + sen(t)·amplitude (lerp suaviza a transição)
        const k = damp(2, dt)
        e.pos.x = lerp(e.pos.x, e.anchor.x + Math.sin(e.t * 0.9 + e.seed) * 6, k)
        e.pos.y = lerp(e.pos.y, e.anchor.y + Math.sin(e.t * 1.3 + e.seed) * 3, k)
        e.pos.z = lerp(e.pos.z, e.holdZ + Math.sin(e.t * 0.7 + e.seed) * 5, k)
        if (e.t > e.holdTime) e.state = 'exit'
      } else if (e.state === 'exit') {
        // Passa pela nave e vai embora para o lado
        e.pos.z += sp * 1.4 * dt
        e.pos.x += Math.sign(e.pos.x || 1) * 14 * dt
        e.pos.y += 6 * dt
      } else if (e.state === 'dive') {
        // Trajetória reta + zigue-zague
        e.pos.addScaledVector(e.vel, dt * game.worldMul)
        e.pos.x += Math.sin(e.t * 4 + e.seed) * 6 * dt
      }

      // ---------------- Tiro ----------------
      e.fireT -= dt
      if (playing && e.fireT <= 0 && e.pos.z > -130 && e.pos.z < -12 && e.state !== 'exit') {
        fire(e)
        e.fireT = T.fireEvery * aggression * rand(0.8, 1.3)
      }

      // ---------------- Colisões ----------------
      for (const l of game.playerLasers) {
        if (!l.active) continue
        if (segmentSphere(l.prev, l.pos, e.pos, T.radius)) {
          l.active = false
          damage(e, l.dmg, l.owner)
          if (!e.active) break
        }
      }
      if (e.active && playing && hitsShip(e.pos, T.radius * 0.6)) {
        damagePlayer(25, 'ram')
        kill(e, 'ram')
      }
      if (e.active && (e.pos.z > 25 || Math.abs(e.pos.x) > 90)) e.active = false
      if (!e.active) {
        g.visible = false
        continue
      }

      // ---------------- Visual ----------------
      g.visible = true
      g.position.copy(e.pos)
      const ms = models.current[i]
      for (let j = 0; j < 3; j++) ms[j].visible = TYPE_LIST[j] === e.type
      // Inclina na direção do movimento lateral
      const vx = (e.pos.x - e.prevX) / dt
      e.bank = lerp(e.bank, clamp(-vx * 0.05, -0.8, 0.8), damp(5, dt))
      if (e.state === 'dive') {
        // lookAt aponta o +Z do grupo para o destino; depois gira em espiral
        tmp.copy(e.pos).add(e.vel)
        g.lookAt(tmp)
        g.rotateZ(e.t * 3)
      } else {
        g.rotation.set(e.state === 'exit' ? -0.4 : 0, 0, e.bank)
      }
    }
  })

  return (
    <>
      {Array.from({ length: MAX }, (_, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          {[FighterModel, InterceptorModel, BomberModel].map((Model, j) => (
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
