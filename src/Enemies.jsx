// src/Enemies.jsx
// Caças e naves médias da Armada do Caos em VOO LIVRE 3D: atacam de qualquer direção.
// Comportamentos (ENEMY_TYPES.ai):
//  dogfight · passa atirando, arremete para longe e volta (Vespa, Lança, Espectro, Raptor)
//  strafe   · passadas laterais atirando de lado (Corsário)
//  standoff · mantém distância circulando e atira como torre (Ômega, Martelo, Ferrão, Arraia...)
//  hunt     · persegue e colide (Agulha, Enxame)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, ENEMY_TYPES, frameDt, rand, damp, segmentSphere, hitsShip, damagePlayer, addScore } from './gameState'
import { EnemyModel } from './models'
import { sfx } from './audio'

const MAX = 30
const { lerp, clamp } = THREE.MathUtils
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const aim = new THREE.Vector3()
const toShip = new THREE.Vector3()
const desired = new THREE.Vector3()
const side = new THREE.Vector3()
const prevDir = new THREE.Vector3()
const muzzle = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const CHARGE_TIME = 1.1 // segundos de aviso do Ferrão/Arpão antes do disparo

// Gira o vetor unitário `dir` em direção a `want` no máximo `maxAngle` radianos.
// Ângulo entre eles = acos(dir·want). Se for maior que o permitido, anda só a fração maxAngle/ângulo.
function turnToward(dir, want, maxAngle) {
  const cos = clamp(dir.dot(want), -1, 1)
  const ang = Math.acos(cos)
  if (ang < 1e-4) return
  if (ang <= maxAngle) dir.copy(want)
  else {
    // Perto de 180°, o lerp passaria pelo zero: empurra para um lado antes
    if (cos < -0.98) dir.add(tmp2.set(0.2, 0.1, 0)).normalize()
    dir.lerp(want, maxAngle / ang).normalize()
  }
}

// Ponto previsto da nave do jogador para um projétil com velocidade `speed`:
//   previsto = posição + velocidade · (distância / speed)
function leadPoint(from, speed, out, factor = 1) {
  const t = speed > 0 ? from.distanceTo(game.shipPos) / speed : 0
  return out.copy(game.shipPos).addScaledVector(game.shipVel, t * factor)
}

// Ponto de nascimento aleatório em volta do jogador (inclusive atrás e dos lados)
export function spawnAround(out, minD = 240, maxD = 360) {
  const a = rand(0, Math.PI * 2)
  const el = rand(-0.4, 0.4)
  out.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(rand(minD, maxD)).add(game.shipPos)
  if (game.stage === 'surface') out.y = clamp(out.y, game.ground + 70, game.ground + 650)
  return out
}

// Um "slot" do pool: o modelo 3D só é montado para o tipo que está usando o slot agora
function Slot({ index, bind }) {
  const [type, setType] = useState(null)
  const group = useRef()
  const beam = useRef()
  useEffect(() => bind(index, { setType, group, beam, type }), [bind, index, type])
  const T = type && ENEMY_TYPES[type]
  return (
    <>
      <group ref={group} visible={false}>
        {T && <EnemyModel kind={T.model} scale={T.scale} />}
      </group>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
        <meshBasicMaterial color={[4, 0.3, 0.3]} toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </>
  )
}

export default function Enemies() {
  const slots = useRef([])
  const bind = useMemo(
    () => (i, s) => {
      slots.current[i] = s
    },
    []
  )

  const pool = useMemo(
    () =>
      Array.from({ length: MAX }, () => {
        const e = {
          active: false,
          type: 'fighter',
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(), // velocidade (direção × rapidez) — usada na previsão de tiro
          dir: new THREE.Vector3(0, 0, 1), // direção do nariz (unitária)
          evade: new THREE.Vector3(),
          lock: new THREE.Vector3(), // ponto travado pelo Ferrão/Arpão
          hp: 1,
          state: 'attack',
          t: 0,
          stateT: 0,
          fireT: 1,
          charge: 0,
          orbitSide: 1,
          seed: Math.random() * 10,
          bank: 0,
        }
        // Objeto de alvo (mira automática, mísseis, alas, radar) — reaproveitado
        e.target = { pos: e.pos, vel: e.vel, r: 2, kind: 'enemy', ref: e, alive: true, hit: (d, o) => damage(e, d, o) }
        return e
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  function spawn(type, opts = {}) {
    const i = pool.findIndex((p) => !p.active)
    if (i < 0) return null
    const e = pool[i]
    const T = ENEMY_TYPES[type]
    e.active = true
    e.type = type
    e.hp = T.hp
    e.t = 0
    e.stateT = 0
    e.bank = 0
    e.charge = 0
    e.seed = Math.random() * 10
    e.orbitSide = Math.random() < 0.5 ? -1 : 1
    e.fireT = rand(1.2, Math.min(T.fireEvery, 4) + 1.2)
    e.target.r = T.radius
    if (opts.pos) e.pos.copy(opts.pos)
    else spawnAround(e.pos)
    // Nasce apontando para o jogador (ou na direção pedida, ex.: saindo do hangar da nave-mãe)
    if (opts.dir) e.dir.copy(opts.dir).normalize()
    else e.dir.subVectors(game.shipPos, e.pos).normalize()
    e.vel.copy(e.dir).multiplyScalar(T.speed)
    e.state = T.ai === 'hunt' ? 'hunt' : 'attack'
    // Monta o modelo certo neste slot (se mudou de tipo)
    const s = slots.current[i]
    if (s && s.type !== type) s.setType(type)
    // Primeira aparição de um tipo novo: a equipe avisa no rádio
    if (!game.seenEnemies[type]) {
      game.seenEnemies[type] = true
      game.events.push({ type: 'newEnemy', enemy: type })
    }
    return e
  }

  function kill(e, owner) {
    const T = ENEMY_TYPES[e.type]
    e.active = false
    const big = T.hp >= 9
    game.fx.explode(e.pos, { size: T.radius > 3.5 ? 2.6 : big ? 2 : 1.2 })
    if (big) game.fx.shockwave(e.pos, 1.5)
    sfx.explosion(big)
    game.kills++
    if (game.mstats) {
      game.mstats.kills++ // conta para a meta da missão (toda a equipe)
      if (game.stage === 'orbit') game.mstats.orbitKills++
    }
    game.events.push({ type: 'kill' })
    if (owner === 'player' || owner === 'drone') addScore(T.score, 'player')
    else if (owner === 'wing') {
      addScore(T.score, 'wing')
      game.events.push({ type: 'wingKill' })
    }
    // Chance de soltar um power-up (naves grandes quase sempre soltam)
    const r = Math.random()
    if (owner !== 'ram' && (big ? r < 0.75 : r < 0.12)) {
      const roll = Math.random()
      const kind = roll < 0.32 ? 'shield' : roll < 0.58 ? 'weapon' : roll < 0.76 ? 'missile' : roll < 0.9 ? 'bomb' : 'drone'
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

  // ---------------- Armas ----------------
  function fire(e) {
    const T = ENEMY_TYPES[e.type]
    muzzle.copy(e.pos).addScaledVector(e.dir, T.radius + 0.6)
    side.crossVectors(e.dir, UP).normalize() // direita da nave inimiga
    switch (T.weapon) {
      case 'single':
      case 'twin':
      case 'triple': {
        // Mira no ponto PREVISTO com um erro aleatório (senão seria impossível desviar)
        leadPoint(muzzle, T.boltSpeed, aim, 0.85)
        aim.x += rand(-2.5, 2.5)
        aim.y += rand(-1.5, 1.5)
        aim.z += rand(-2.5, 2.5)
        const n = T.weapon === 'single' ? 1 : T.weapon === 'twin' ? 2 : 3
        for (let k = 0; k < n; k++) {
          const off = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * 1.2 // canhões espalhados na asa
          tmp.copy(muzzle).addScaledVector(side, off)
          desired.subVectors(aim, tmp)
          game.fireEnemyLaser(tmp, desired, T.boltSpeed, 'bolt')
        }
        break
      }
      case 'fan3':
      case 'fan5': {
        // Leque: espalha os tiros girando a direção em torno do "cima" da nave inimiga
        const n = T.weapon === 'fan3' ? 3 : 5
        leadPoint(muzzle, T.boltSpeed, aim, 0.7)
        desired.subVectors(aim, muzzle).normalize()
        for (let k = 0; k < n; k++) {
          const a = (k - (n - 1) / 2) * (n === 3 ? 0.12 : 0.09)
          tmp.copy(desired).applyAxisAngle(UP, a)
          game.fireEnemyLaser(muzzle, tmp, T.boltSpeed, n === 3 ? 'plasma' : 'bolt')
        }
        break
      }
      case 'seeker': {
        // Plasma teleguiado: sai pelas laterais e persegue o jogador
        for (const s of [-1, 1]) {
          tmp.copy(e.pos).addScaledVector(side, s * T.radius)
          desired.copy(side).multiplyScalar(s).addScaledVector(e.dir, 0.6)
          game.fireEnemyLaser(tmp, desired, T.boltSpeed, 'seeker')
        }
        break
      }
      case 'charge':
        // Começa a carregar: trava a mira onde a nave vai estar
        e.charge = CHARGE_TIME
        leadPoint(e.pos, T.boltSpeed, e.lock, 0.6)
        sfx.charge()
        break
      case 'launch':
        // Lança duas naves menores pelas laterais
        for (const s of [-1, 1]) {
          tmp.copy(e.pos).addScaledVector(side, s * 5)
          desired.copy(side).multiplyScalar(s).add(e.dir)
          spawn(T.spawns, { pos: tmp, dir: desired })
        }
        game.fx.sparks(e.pos, 'orange', 10)
        break
      default:
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
    const playing = game.phase === 'playing' && game.stage !== 'entry'
    // Os inimigos ficam mais agressivos a cada missão
    const aggression = 1 - Math.min(game.missionIndex, 5) * 0.05
    const surface = game.stage === 'surface'

    for (let i = 0; i < MAX; i++) {
      const e = pool[i]
      const s = slots.current[i]
      if (!s) continue
      const g = s.group.current
      const beam = s.beam.current
      if (!e.active) {
        if (g) g.visible = false
        if (beam) beam.visible = false
        continue
      }
      const T = ENEMY_TYPES[e.type]
      e.t += dt
      e.stateT += dt
      prevDir.copy(e.dir)
      toShip.subVectors(game.shipPos, e.pos)
      const dist = toShip.length()
      toShip.divideScalar(dist || 1)
      let speed = T.speed

      // ================ Comportamento (máquina de estados) ================
      if (e.state === 'hunt') {
        // Perseguição pura no ponto previsto; acelera quando está perto
        leadPoint(e.pos, T.speed * 1.5, desired, 0.5).sub(e.pos).normalize()
        speed = T.speed * (dist < 80 ? 1.35 : 1)
      } else if (T.ai === 'standoff') {
        // Fica a uma distância "range" do jogador, circulando:
        //   tangente = toShip × UP (perpendicular) · lado ;  + correção radial (dist − range)/range
        side.crossVectors(toShip, UP).normalize().multiplyScalar(e.orbitSide)
        const radial = clamp((dist - T.range) / T.range, -1, 1)
        desired.copy(side).addScaledVector(toShip, radial * 1.6).normalize()
        desired.y += Math.sin(e.t * 0.5 + e.seed) * 0.15
        desired.normalize()
      } else if (e.state === 'attack') {
        // Mergulha no ponto previsto da nave (um pouco ao lado no Corsário)
        leadPoint(e.pos, T.speed + 40, desired, 0.6)
        if (T.ai === 'strafe') {
          side.crossVectors(toShip, UP).normalize()
          desired.addScaledVector(side, 28 * e.orbitSide)
        }
        desired.sub(e.pos).normalize()
        // Chegou perto demais: arremete para longe e depois volta
        if (dist < (T.ai === 'strafe' ? 45 : 38) || (e.stateT > 9 && dist < 120)) {
          e.state = 'break'
          e.stateT = 0
          e.evade.copy(e.dir).add(tmp.set(rand(-1, 1), rand(-0.6, 0.6), rand(-1, 1))).normalize()
        }
      } else if (e.state === 'break') {
        desired.copy(e.evade)
        speed = T.speed * 1.15
        if (e.stateT > rand(1.8, 2.6) || dist > 260) {
          e.state = 'attack'
          e.stateT = 0
        }
      }

      // Na atmosfera: evita o chão e não sobe demais
      if (surface) {
        const alt = e.pos.y - game.ground
        if (alt < 50) desired.y = Math.max(desired.y, (50 - alt) / 30)
        if (alt > 750) desired.y = Math.min(desired.y, -0.4)
        desired.normalize()
      }
      // Muito longe: volta para a briga
      if (dist > 420) desired.copy(toShip)

      // Gira o nariz com a curva máxima do tipo e anda para a frente
      turnToward(e.dir, desired, T.turn * dt * (e.state === 'hunt' ? 1.2 : 1))
      e.vel.copy(e.dir).multiplyScalar(speed)
      e.pos.addScaledVector(e.vel, dt)
      if (surface) e.pos.y = Math.max(e.pos.y, game.ground + 12)

      // ================ Tiro ================
      e.fireT -= dt
      if (playing && e.fireT <= 0 && Number.isFinite(T.fireEvery) && e.charge <= 0) {
        // Caças só atiram com o nariz apontado para o jogador (cone de ~22°);
        // naves de "torre" (standoff) atiram de qualquer ângulo dentro do alcance.
        const facing = e.dir.dot(toShip)
        const canFire = T.ai === 'standoff' ? dist < T.range * 2.2 : facing > 0.95 && dist < 280
        if (canFire) {
          fire(e)
          e.fireT = T.fireEvery * aggression * rand(0.8, 1.3)
        }
      }

      // Ferrão/Arpão carregando: linha de mira vermelha até disparar
      if (e.charge > 0) {
        e.charge -= dt
        if (e.charge <= 0) {
          muzzle.copy(e.pos).addScaledVector(e.dir, 2)
          aim.subVectors(e.lock, muzzle)
          if (playing) {
            game.fireEnemyLaser(muzzle, aim, T.boltSpeed, 'heavy')
            sfx.beam()
          }
        }
      }

      // ================ Colisões ================
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
        damagePlayer(T.ai === 'hunt' ? 22 : 25, 'ram')
        kill(e, 'ram')
      }
      // Longe demais do jogador (saiu da batalha): recicla
      if (e.active && dist > 1100) e.active = false
      if (!e.active) {
        if (g) g.visible = false
        if (beam) beam.visible = false
        continue
      }

      // ================ Visual ================
      if (!g) continue
      g.visible = true
      g.position.copy(e.pos)
      // lookAt aponta o +Z do grupo (nariz do modelo) para onde a nave vai
      g.lookAt(tmp.copy(e.pos).add(e.dir))
      // Inclinação na curva: quanto o nariz virou para a direita neste frame
      //   (prevDir × dir)·UP > 0 = curva à esquerda
      const turnRate = tmp.crossVectors(prevDir, e.dir).dot(UP) / dt
      e.bank = lerp(e.bank, clamp(-turnRate * 1.4, -1.1, 1.1), damp(4, dt))
      g.rotateZ(e.bank)
      if (e.state === 'hunt') g.rotateZ(e.t * 2.5) // Agulhas giram em espiral

      // Linha de mira: cilindro fino do inimigo até o ponto travado, piscando cada vez mais rápido
      if (e.charge > 0 && beam) {
        tmp.subVectors(e.lock, e.pos)
        const len = tmp.length()
        beam.visible = Math.sin(e.charge * (40 - e.charge * 25)) > -0.3
        beam.position.copy(e.pos).addScaledVector(tmp, 0.5)
        beam.quaternion.setFromUnitVectors(UP, tmp.normalize())
        beam.scale.set(1, len, 1)
      } else if (beam) {
        beam.visible = false
      }
    }
  })

  return (
    <>
      {Array.from({ length: MAX }, (_, i) => (
        <Slot key={i} index={i} bind={bind} />
      ))}
    </>
  )
}
