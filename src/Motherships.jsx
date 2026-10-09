// src/Motherships.jsx
// Naves-mãe da Armada do Caos: Leviatã, Titã e Colmeia-Mãe.
// Gigantes (100+ unidades) que cruzam a área de combate com:
//  - torres de canhão no casco (em cima e embaixo) que atiram no jogador
//  - hangares nas laterais que lançam caças sem parar
//  - um REATOR na traseira (ponto fraco) protegido por escudo enquanto houver torres
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, MOTHERSHIP_TYPES, frameDt, rand, damp, segmentSphere, addScore, damagePlayer } from './gameState'
import { useShip, Ship, M } from './models'
import { sfx } from './audio'

const MAX = 3
const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const local = new THREE.Vector3()
const aim = new THREE.Vector3()
const look = new THREE.Matrix4()
const qTarget = new THREE.Quaternion()
const ray = new THREE.Raycaster()
const FLIP = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI) // lookAt aponta −Z; o nariz do modelo é +Z

// ---------------------------------------------------------------------------
// Pontos de montagem calculados no próprio modelo 3D (raycast no casco), em unidades do modelo:
// torres em cima/embaixo do casco, hangares nas laterais e o reator na traseira.
// ---------------------------------------------------------------------------
const layoutCache = new Map()
function useLayout(type) {
  const T = MOTHERSHIP_TYPES[type]
  const { obj, exhausts, size } = useShip(T.model)
  return useMemo(() => {
    if (layoutCache.has(type)) return layoutCache.get(type)
    obj.updateMatrixWorld(true)
    const turrets = []
    for (let i = 0; i < T.turrets; i++) {
      // Distribui ao longo do comprimento (ou em anel, no disco); alterna em cima/embaixo
      const top = i % 2 === 0
      let x, z
      if (T.disc) {
        const a = (i / T.turrets) * Math.PI * 2 + 0.4
        x = Math.cos(a) * size.x * 0.28
        z = Math.sin(a) * size.z * 0.28
      } else {
        const f = T.turrets === 1 ? 0 : i / (T.turrets - 1) - 0.5 // -0,5..0,5
        z = f * size.z * 0.62
        x = (i % 4 < 2 ? 1 : -1) * size.x * 0.12
      }
      // Raio vertical: de cima para baixo (torre de cima) ou de baixo para cima
      ray.set(tmp.set(x, top ? size.y * 2 : -size.y * 2, z), top ? DOWN : UP)
      const hit = ray.intersectObject(obj, true)[0]
      const y = hit ? hit.point.y : (top ? 1 : -1) * size.y * 0.4
      turrets.push({ pos: new THREE.Vector3(x, y, z), top })
    }
    // Hangares: meio das laterais
    const bays = [-1, 1].map((s) => new THREE.Vector3(s * size.x * 0.42, 0, size.z * 0.12))
    // Reator: média dos bocais de motor (traseira = −Z no modelo)
    const reactor = new THREE.Vector3()
    if (exhausts.length) {
      for (const e of exhausts) reactor.add(e.pos)
      reactor.divideScalar(exhausts.length)
    } else reactor.set(0, 0, -size.z * 0.48)
    reactor.z -= 0.6
    const L = { turrets, bays, reactor, half: new THREE.Vector3(size.x * 0.42, size.y * 0.36, size.z * 0.47) }
    layoutCache.set(type, L)
    return L
  }, [obj, exhausts, size, type, T])
}

// Torre de canhão (feita à mão): base, cúpula e canos duplos
function Turret({ flip }) {
  return (
    <group rotation={[flip ? Math.PI : 0, 0, 0]}>
      <mesh material={M.eHull} castShadow>
        <cylinderGeometry args={[0.55, 0.7, 0.35, 12]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} material={M.eArmor} castShadow>
        <sphereGeometry args={[0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 0.42, 0.55]} rotation={[Math.PI / 2, 0, 0]} material={M.dark}>
          <cylinderGeometry args={[0.06, 0.07, 1, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 0.25, 0.42]} material={M.eGlow}>
        <boxGeometry args={[0.5, 0.06, 0.05]} />
      </mesh>
    </group>
  )
}

// Visual de uma nave-mãe (montado quando o slot recebe um tipo)
function MotherVisual({ type, refs }) {
  const T = MOTHERSHIP_TYPES[type]
  const L = useLayout(type)
  return (
    <>
      <Ship kind={T.model} scale={T.scale} flameMat={M.enemyFlame} glowColor="#ff6040" />
      {L.turrets.map((t, i) => (
        <group key={i} ref={(el) => (refs.turrets[i] = el)} position={tmp.copy(t.pos).multiplyScalar(T.scale).toArray()} scale={T.scale * 0.55}>
          <Turret flip={!t.top} />
        </group>
      ))}
      {/* Hangares: portais brilhantes */}
      {L.bays.map((b, i) => (
        <mesh key={i} position={tmp.copy(b).multiplyScalar(T.scale).toArray()} rotation={[0, Math.PI / 2, 0]} material={M.eGlow} scale={T.scale}>
          <planeGeometry args={[1.4, 0.45]} />
        </mesh>
      ))}
      {/* Reator + escudo */}
      <group position={tmp.copy(L.reactor).multiplyScalar(T.scale).toArray()}>
        <mesh ref={(el) => (refs.core = el)}>
          <sphereGeometry args={[3.2, 24, 16]} />
          <meshBasicMaterial color={[4, 0.6, 0.3]} toneMapped={false} />
        </mesh>
        <mesh ref={(el) => (refs.shield = el)}>
          <sphereGeometry args={[6, 24, 16]} />
          <meshBasicMaterial color={[0.6, 1.4, 3]} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight color="#ff5a30" intensity={80} distance={60} decay={1.5} />
      </group>
    </>
  )
}

function Slot({ index, bind }) {
  const [type, setType] = useState(null)
  const group = useRef()
  const refs = useMemo(() => ({ turrets: [], core: null, shield: null }), [])
  useEffect(() => bind(index, { setType, group, refs, type }), [bind, index, type, refs])
  return <group ref={group} visible={false}>{type && <MotherVisual key={type} type={type} refs={refs} />}</group>
}

export default function Motherships() {
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
        const m = {
          active: false,
          type: 'leviata',
          state: 'idle', // warp | fight | dying
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          quat: new THREE.Quaternion(),
          inv: new THREE.Quaternion(),
          waypoint: new THREE.Vector3(),
          t: 0,
          launchT: 5,
          dyingT: 0,
          boomT: 0,
          turrets: [],
          reactor: null,
          targets: [],
          layout: null,
          name: '',
        }
        return m
      }),
    []
  )

  function hitPart(m, part, dmg, owner) {
    if (!part.alive || m.state !== 'fight') return
    const T = MOTHERSHIP_TYPES[m.type]
    const shielded = part.kind === 'reactor' && m.turrets.some((t) => t.alive)
    if (owner === 'player') game.stats.hits++
    if (shielded) {
      // Escudo do reator: absorve 75% do dano enquanto houver torres
      dmg *= 0.25
      game.fx.sparks(part.pos, 'blue', 4)
    } else game.fx.sparks(part.pos, 'orange', 6)
    sfx.hitEnemy()
    part.hp -= dmg
    if (part.hp > 0) return
    part.alive = false
    game.fx.explode(part.pos, { size: part.kind === 'reactor' ? 3.5 : 2 })
    game.fx.shockwave(part.pos, part.kind === 'reactor' ? 4 : 2)
    sfx.explosion(true)
    game.shake = Math.max(game.shake, 0.6)
    if (part.kind === 'turret') {
      addScore(400, owner === 'wing' ? 'wing' : 'player')
      game.events.push({ type: m.turrets.some((t) => t.alive) ? 'motherTurret' : 'motherExposed' })
    } else {
      // Reator destruído: a nave-mãe inteira explode em cadeia
      m.state = 'dying'
      m.dyingT = 0
      addScore(T.score, owner === 'wing' ? 'wing' : 'player')
      if (game.mstats) game.mstats.kills += 5 // nave-mãe vale 5 na meta
      game.kills += 5
      game.events.push({ type: 'motherDown', mother: m.type })
    }
  }

  function setupParts(m) {
    const T = MOTHERSHIP_TYPES[m.type]
    const L = m.layout
    m.turrets = L.turrets.map((t) => {
      const p = { kind: 'turret', local: t.pos.clone().multiplyScalar(T.scale), pos: new THREE.Vector3(), vel: m.vel, r: T.scale * 0.6, hp: T.turretHp, alive: true, fireT: rand(1, 3), top: t.top }
      p.hit = (d, o) => hitPart(m, p, d, o)
      return p
    })
    const r = { kind: 'reactor', local: L.reactor.clone().multiplyScalar(T.scale), pos: new THREE.Vector3(), vel: m.vel, r: 4, hp: T.reactorHp, alive: true }
    r.hit = (d, o) => hitPart(m, r, d, o)
    m.reactor = r
    m.targets = [...m.turrets, r]
    m.half = L.half.clone().multiplyScalar(T.scale)
    m.bays = L.bays.map((b) => b.clone().multiplyScalar(T.scale))
  }

  function pickWaypoint(m) {
    if (game.stage === 'surface') m.waypoint.set(rand(-1400, 1400), game.ground + rand(380, 560), rand(-1400, 1400))
    else m.waypoint.set(rand(-450, 450), rand(-160, 160), rand(-450, 450))
  }

  function spawnMothership(type) {
    const i = pool.findIndex((p) => !p.active)
    if (i < 0) return
    const m = pool[i]
    m.active = true
    m.type = type
    m.state = 'warp'
    m.t = 0
    m.launchT = 6
    m.name = MOTHERSHIP_TYPES[type].name
    m.layout = layoutCache.get(type) || null
    m.needsSetup = true
    // Chega pelo hiperespaço à frente do jogador (um pouco para o lado), cruzando a visão dele
    tmp.crossVectors(game.shipFwd, UP).normalize()
    m.pos.copy(game.shipPos).addScaledVector(game.shipFwd, 430).addScaledVector(tmp, rand(-120, 120))
    if (game.stage === 'surface') m.pos.y = game.ground + rand(420, 520)
    else m.pos.y = game.shipPos.y + rand(30, 90)
    pickWaypoint(m)
    tmp.subVectors(m.waypoint, m.pos).normalize()
    look.lookAt(tmp2.set(0, 0, 0), tmp, UP) // +Z do modelo aponta para o rumo
    m.quat.setFromRotationMatrix(look).multiply(FLIP)
    const s = slots.current[i]
    if (s && s.type !== type) s.setType(type)
    game.fx.shockwave(m.pos, 10)
    sfx.bomb()
    game.events.push({ type: 'motherArrive', mother: type })
  }

  useEffect(() => {
    game.motherships = pool
    game.spawnMothership = spawnMothership
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

  useFrame((state, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    const playing = game.phase === 'playing' && game.stage !== 'entry'

    for (let i = 0; i < MAX; i++) {
      const m = pool[i]
      const s = slots.current[i]
      if (!s) continue
      const g = s.group.current
      if (!m.active) {
        if (g) g.visible = false
        continue
      }
      const T = MOTHERSHIP_TYPES[m.type]
      // Espera o modelo montar para conhecer os pontos de montagem
      if (!m.layout) {
        m.layout = layoutCache.get(m.type) || null
        if (!m.layout) continue
      }
      if (m.needsSetup) {
        setupParts(m)
        m.needsSetup = false
      }
      m.t += dt

      // ---------------- Movimento: cruzeiro lento rumo a pontos aleatórios ----------------
      const forward = tmp.set(0, 0, 1).applyQuaternion(m.quat)
      if (m.state !== 'dying') {
        if (m.pos.distanceToSquared(m.waypoint) < 160 * 160) pickWaypoint(m)
        // Vira devagar (slerp) até o nariz (+Z) apontar para o ponto
        tmp2.subVectors(m.waypoint, m.pos).normalize()
        look.lookAt(aim.set(0, 0, 0), tmp2, UP)
        qTarget.setFromRotationMatrix(look).multiply(FLIP)
        m.quat.slerp(qTarget, damp(0.12, dt))
        m.vel.copy(forward).multiplyScalar(T.speed * (m.state === 'warp' ? 1 + Math.max(0, 1.2 - m.t) * 60 : 1))
      } else {
        // Afundando/derivando enquanto explode
        m.vel.y -= (game.stage === 'surface' ? 9 : 2) * dt
      }
      m.pos.addScaledVector(m.vel, dt)
      m.inv.copy(m.quat).invert()

      // Posições das peças no mundo: mundo = posição + rotação · local
      for (const p of m.targets) p.pos.copy(p.local).applyQuaternion(m.quat).add(m.pos)

      if (m.state === 'warp' && m.t > 1.4) m.state = 'fight'

      if (m.state === 'fight') {
        // ---------------- Torres ----------------
        const dist = m.pos.distanceTo(game.shipPos)
        for (const tu of m.turrets) {
          if (!tu.alive) continue
          tu.fireT -= dt
          if (tu.fireT <= 0 && playing && dist < 480) {
            // A torre só enxerga o lado do casco em que está (cima/baixo)
            local.subVectors(game.shipPos, m.pos).applyQuaternion(m.inv)
            if ((local.y > -2) === tu.top) {
              const t = tu.pos.distanceTo(game.shipPos) / 85
              aim.copy(game.shipPos).addScaledVector(game.shipVel, t * 0.8).sub(tu.pos)
              aim.x += rand(-3, 3)
              aim.y += rand(-2, 2)
              game.fireEnemyLaser(tu.pos, aim, 85, Math.random() < 0.3 ? 'plasma' : 'bolt')
            }
            tu.fireT = rand(1.1, 2)
          }
        }
        // ---------------- Hangares ----------------
        m.launchT -= dt
        if (m.launchT <= 0 && playing) {
          const alive = game.enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0)
          if (alive < 18) {
            m.bays.forEach((b, k) => {
              aim.copy(b).applyQuaternion(m.quat).add(m.pos)
              tmp2.set(k ? 1 : -1, 0, 0.6).applyQuaternion(m.quat)
              game.spawnEnemy(T.launch[Math.floor(Math.random() * T.launch.length)], { pos: aim, dir: tmp2 })
            })
            game.fx.sparks(m.pos, 'orange', 12)
          }
          m.launchT = T.launchEvery * rand(0.85, 1.2)
        }

        // ---------------- Lasers do jogador ----------------
        for (const l of game.playerLasers) {
          if (!l.active) continue
          let hit = false
          for (const p of m.targets) {
            if (!p.alive) continue
            if (segmentSphere(l.prev, l.pos, p.pos, p.r + (p.kind === 'reactor' && m.turrets.some((t) => t.alive) ? 2 : 0))) {
              l.active = false
              p.hit(l.dmg, l.owner)
              hit = true
              break
            }
          }
          if (hit) continue
          // Casco: caixa no espaço LOCAL da nave-mãe (bloqueia o tiro)
          local.subVectors(l.pos, m.pos).applyQuaternion(m.inv)
          if (Math.abs(local.x) < m.half.x && Math.abs(local.y) < m.half.y && Math.abs(local.z) < m.half.z) {
            l.active = false
            game.fx.sparks(l.pos, 'orange', 2)
          }
        }
        // Colisão da nave do jogador com o casco: dano e empurrão para fora
        local.subVectors(game.shipPos, m.pos).applyQuaternion(m.inv)
        if (playing && Math.abs(local.x) < m.half.x + 1.5 && Math.abs(local.y) < m.half.y + 1.5 && Math.abs(local.z) < m.half.z + 1.5) {
          damagePlayer(30, 'ram')
          tmp2.subVectors(game.shipPos, m.pos).normalize()
          game.shipPos.addScaledVector(tmp2, 4)
        }
      } else if (m.state === 'dying') {
        // Explosões em cadeia pelo casco e explosão final gigante
        m.dyingT += dt
        m.boomT -= dt
        if (m.boomT <= 0) {
          m.boomT = 0.1
          local.set(rand(-1, 1) * m.half.x, rand(-1, 1) * m.half.y, rand(-1, 1) * m.half.z).applyQuaternion(m.quat).add(m.pos)
          game.fx.explode(local, { size: rand(1.5, 3) })
          if (Math.random() < 0.4) sfx.explosion(false)
          game.shake = Math.max(game.shake, 0.35)
        }
        if (m.dyingT > 3.6) {
          game.fx.explode(m.pos, { size: 7, palette: 'bomb' })
          game.fx.shockwave(m.pos, 16)
          sfx.bomb()
          game.shake = 1.6
          m.active = false
          // Recompensa: chuva de power-ups
          for (const k of ['weapon', 'shield', 'missile']) game.spawnPickup(k, local.copy(m.pos).add(tmp2.set(rand(-8, 8), rand(-4, 4), rand(-8, 8))))
          continue
        }
      }

      // ---------------- Visual ----------------
      if (!g) continue
      g.visible = true
      g.position.copy(m.pos)
      g.quaternion.copy(m.quat)
      // Entrada pelo hiperespaço: "estica" no eixo do movimento e volta ao tamanho normal
      const w = m.state === 'warp' ? Math.max(0, 1 - m.t / 1.2) : 0
      g.scale.set(1 - w * 0.6, 1 - w * 0.6, 1 + w * 4)
      const r = s.refs
      m.turrets.forEach((t, k) => r.turrets[k] && (r.turrets[k].visible = t.alive))
      const shieldUp = m.turrets.some((t) => t.alive)
      if (r.shield) r.shield.visible = shieldUp && m.state !== 'dying'
      if (r.core) {
        const pulse = 0.85 + Math.sin(state.clock.elapsedTime * (shieldUp ? 3 : 10)) * 0.25
        r.core.scale.setScalar(m.reactor && m.reactor.alive ? pulse : 0.01)
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
