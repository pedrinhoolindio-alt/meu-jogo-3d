// src/Enemies.jsx
// Naves da Armada do Caos:
//  Vespa (caça) · Lança (mergulho) · Martelo (bombardeiro) · Agulha (kamikaze que persegue)
//  Ômega (canhoneira com rajada em leque) · Colmeia (porta-naves que lança Agulhas)
//  Ferrão (atirador: mira com laser vermelho e dispara um tiro forte)
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, BOUNDS, ENEMY_TYPES, ENEMY_LIST, frameDt, rand, damp, segmentSphere, hitsShip, damagePlayer, addScore } from './gameState'
import { FighterModel, InterceptorModel, BomberModel, KamikazeModel, GunshipModel, CarrierModel, SniperModel } from './models'
import { sfx } from './audio'

const MAX = 22
const MODELS = {
  fighter: FighterModel,
  interceptor: InterceptorModel,
  bomber: BomberModel,
  kamikaze: KamikazeModel,
  gunship: GunshipModel,
  carrier: CarrierModel,
  sniper: SniperModel,
}
const { lerp, clamp } = THREE.MathUtils
const tmp = new THREE.Vector3()
const aim = new THREE.Vector3()
const steer = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const CHARGE_TIME = 1.1 // segundos de aviso do Ferrão antes do disparo

export default function Enemies() {
  const groups = useRef([])
  const models = useRef([]) // models[i][j] = grupo do modelo j do slot i
  const beams = useRef([]) // linha de mira do Ferrão (uma por slot)

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
        lock: new THREE.Vector3(), // ponto travado pelo Ferrão
        hp: 1,
        state: 'approach',
        t: 0,
        holdZ: -50,
        holdTime: 5,
        fireT: 1,
        charge: 0,
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
    e.charge = 0
    e.seed = Math.random() * 10
    e.fireT = rand(0.8, Math.min(T.fireEvery, 4) + 0.8)

    if (type === 'interceptor') {
      // Mergulha de um dos flancos em direção à nave
      const side = Math.random() < 0.5 ? -1 : 1
      e.pos.set(side * rand(30, 45), rand(-8, 8), rand(-170, -130))
      tmp.set(game.shipPos.x * 0.5 + rand(-5, 5), game.shipPos.y * 0.5 + rand(-3, 3), 12)
      // velocidade = (alvo - posição) normalizado * rapidez
      e.vel.subVectors(tmp, e.pos).normalize().multiplyScalar(T.speed)
      e.state = 'dive'
    } else if (type === 'kamikaze') {
      // Nasce no ponto indicado (ex.: saindo da Colmeia) ou ao longe, e persegue a nave
      e.pos.set(opts.x ?? rand(-1, 1) * BOUNDS.x * 2.2, opts.y ?? rand(-1, 1) * BOUNDS.y * 2, opts.z ?? rand(-200, -170))
      e.vel.set(rand(-8, 8), rand(-4, 4), T.speed * 0.5)
      e.state = 'hunt'
    } else {
      e.pos.set(opts.x ?? rand(-1, 1) * BOUNDS.x * 1.6, opts.y ?? rand(-1, 1) * BOUNDS.y * 1.4, opts.z ?? -230)
      e.anchor.set(e.pos.x, e.pos.y)
      const hold = { bomber: [-88, -72, 9, 12], carrier: [-105, -90, 14, 18], sniper: [-82, -66, 9, 12], gunship: [-70, -52, 7, 10] }[type]
      e.holdZ = hold ? rand(hold[0], hold[1]) : rand(-62, -38)
      e.holdTime = hold ? rand(hold[2], hold[3]) : rand(4, 7)
      e.state = 'approach'
    }
    e.prevX = e.pos.x
    e.prevY = e.pos.y
    // Primeira aparição de um tipo novo: o Alan avisa no rádio
    if (!game.seenEnemies[type]) {
      game.seenEnemies[type] = true
      game.events.push({ type: 'newEnemy', enemy: type })
    }
    return e
  }

  function kill(e, owner) {
    const T = ENEMY_TYPES[e.type]
    e.active = false
    const big = e.type === 'bomber' || e.type === 'carrier' || e.type === 'gunship'
    game.fx.explode(e.pos, { size: e.type === 'carrier' ? 2.6 : big ? 2 : 1.2 })
    if (big) game.fx.shockwave(e.pos, 1.5)
    sfx.explosion(big)
    game.kills++
    if (game.mstats) game.mstats.kills++ // conta para a meta da missão (toda a equipe)
    game.events.push({ type: 'kill' })
    if (owner === 'player' || owner === 'drone') addScore(T.score, 'player')
    else if (owner === 'wing') {
      addScore(T.score, 'wing')
      game.events.push({ type: 'wingKill' })
    }
    // Chance de soltar um power-up (naves grandes quase sempre soltam)
    const r = Math.random()
    if (owner !== 'ram' && (big ? r < 0.8 : r < 0.1)) {
      const roll = Math.random()
      const kind = roll < 0.32 ? 'shield' : roll < 0.6 ? 'weapon' : roll < 0.76 ? 'missile' : roll < 0.9 ? 'bomb' : 'drone'
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
    } else if (e.type === 'gunship') {
      // Rajada de 5 lasers em leque horizontal
      for (let k = -2; k <= 2; k++) {
        aim.subVectors(game.shipPos, tmp).normalize()
        aim.x += k * 0.09
        aim.y += rand(-0.02, 0.02)
        game.fireEnemyLaser(tmp, aim, T.boltSpeed, 'bolt')
      }
    } else if (e.type === 'carrier') {
      // Lança duas Agulhas pelas laterais
      for (const side of [-1, 1]) game.spawnEnemy('kamikaze', { x: e.pos.x + side * 4, y: e.pos.y - 1, z: e.pos.z + 3 })
      game.fx.sparks(e.pos, 'orange', 10)
    } else if (e.type === 'sniper') {
      // Começa a carregar: trava a mira um pouco à frente de onde a nave está
      e.charge = CHARGE_TIME
      e.lock.copy(game.shipPos)
      sfx.charge()
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
    // Os inimigos ficam mais agressivos a cada missão
    const aggression = 1 - Math.min(game.missionIndex, 4) * 0.06

    for (let i = 0; i < MAX; i++) {
      const e = pool[i]
      const g = groups.current[i]
      const beam = beams.current[i]
      if (!e.active) {
        g.visible = false
        beam.visible = false
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
        const amp = e.type === 'carrier' ? 4 : e.type === 'sniper' ? 3 : 6
        e.pos.x = lerp(e.pos.x, e.anchor.x + Math.sin(e.t * 0.9 + e.seed) * amp, k)
        e.pos.y = lerp(e.pos.y, e.anchor.y + Math.sin(e.t * 1.3 + e.seed) * amp * 0.5, k)
        e.pos.z = lerp(e.pos.z, e.holdZ + Math.sin(e.t * 0.7 + e.seed) * 5, k)
        if (e.t > e.holdTime && e.charge <= 0) e.state = 'exit'
      } else if (e.state === 'exit') {
        // Passa pela nave e vai embora para o lado
        e.pos.z += sp * 1.4 * dt
        e.pos.x += Math.sign(e.pos.x || 1) * 14 * dt
        e.pos.y += 6 * dt
      } else if (e.state === 'dive') {
        // Trajetória reta + zigue-zague
        e.pos.addScaledVector(e.vel, dt * game.worldMul)
        e.pos.x += Math.sin(e.t * 4 + e.seed) * 6 * dt
      } else if (e.state === 'hunt') {
        // Perseguição: a velocidade vira gradualmente na direção da nave (curva limitada)
        //   desejado = (nave - posição) normalizado × rapidez
        if (e.pos.z < game.shipPos.z - 6) {
          steer.subVectors(game.shipPos, e.pos).normalize().multiplyScalar(sp)
          e.vel.lerp(steer, Math.min(1, 1.6 * dt))
        }
        e.pos.addScaledVector(e.vel, dt)
      }

      // ---------------- Tiro ----------------
      e.fireT -= dt
      if (playing && e.fireT <= 0 && e.pos.z > -130 && e.pos.z < -12 && e.state !== 'exit' && Number.isFinite(T.fireEvery)) {
        fire(e)
        e.fireT = T.fireEvery * aggression * rand(0.8, 1.3)
      }

      // Ferrão carregando: linha de mira vermelha até disparar
      if (e.charge > 0) {
        e.charge -= dt
        if (e.charge <= 0) {
          tmp.copy(e.pos)
          tmp.z += 2
          aim.subVectors(e.lock, tmp)
          if (playing) {
            game.fireEnemyLaser(tmp, aim, T.boltSpeed, 'heavy')
            sfx.beam()
          }
        }
      }

      // ---------------- Colisões ----------------
      for (const l of game.playerLasers) {
        if (!l.active || l.lastHit === e) continue
        if (segmentSphere(l.prev, l.pos, e.pos, T.radius)) {
          // Hiper-laser atravessa até 2 inimigos
          if (l.pierce > 0) {
            l.pierce--
            l.lastHit = e
          } else {
            l.active = false
          }
          damage(e, l.dmg, l.owner)
          if (!e.active) break
        }
      }
      if (e.active && playing && hitsShip(e.pos, T.radius * 0.6)) {
        damagePlayer(e.type === 'kamikaze' ? 22 : 25, 'ram')
        kill(e, 'ram')
      }
      if (e.active && (e.pos.z > 25 || Math.abs(e.pos.x) > 90)) e.active = false
      if (!e.active) {
        g.visible = false
        beam.visible = false
        continue
      }

      // ---------------- Visual ----------------
      g.visible = true
      g.position.copy(e.pos)
      const ms = models.current[i]
      for (let j = 0; j < ENEMY_LIST.length; j++) ms[j].visible = ENEMY_LIST[j] === e.type
      // Inclina na direção do movimento lateral
      const vx = (e.pos.x - e.prevX) / dt
      e.bank = lerp(e.bank, clamp(-vx * 0.05, -0.8, 0.8), damp(5, dt))
      if (e.state === 'dive' || e.state === 'hunt') {
        // lookAt aponta o +Z do grupo para onde a nave vai; o Lança ainda gira em espiral
        tmp.copy(e.pos).add(e.vel)
        g.lookAt(tmp)
        if (e.state === 'dive') g.rotateZ(e.t * 3)
      } else {
        g.rotation.set(e.state === 'exit' ? -0.4 : 0, 0, e.bank)
      }

      // Linha de mira: cilindro fino do Ferrão até o ponto travado, piscando cada vez mais rápido
      if (e.charge > 0) {
        tmp.subVectors(e.lock, e.pos)
        const len = tmp.length()
        beam.visible = Math.sin(e.charge * (40 - e.charge * 25)) > -0.3
        beam.position.copy(e.pos).addScaledVector(tmp, 0.5)
        beam.quaternion.setFromUnitVectors(UP, tmp.normalize())
        beam.scale.set(1, len, 1)
      } else {
        beam.visible = false
      }
    }
  })

  return (
    <>
      {Array.from({ length: MAX }, (_, i) => (
        <group key={i}>
          <group ref={(el) => (groups.current[i] = el)} visible={false}>
            {ENEMY_LIST.map((type, j) => {
              const Model = MODELS[type]
              return (
                <group
                  key={type}
                  ref={(el) => {
                    if (!models.current[i]) models.current[i] = []
                    models.current[i][j] = el
                  }}
                >
                  <Model />
                </group>
              )
            })}
          </group>
          <mesh ref={(el) => (beams.current[i] = el)} visible={false}>
            <cylinderGeometry args={[0.035, 0.035, 1, 6]} />
            <meshBasicMaterial color={[4, 0.3, 0.3]} toneMapped={false} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </>
  )
}
