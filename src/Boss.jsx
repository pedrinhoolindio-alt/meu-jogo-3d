// src/Boss.jsx
// Chefe final: Fortaleza Korrath.
// Fase 1: 4 torres protegem o núcleo (que tem escudo). Fase 2: núcleo exposto, rajadas radiais.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, frameDt, rand, damp, segmentSphere, addScore } from './gameState'
import { M } from './models'
import { sfx } from './audio'

const TURRET_OFFSETS = [
  [-9, 3.4, 3.8],
  [9, 3.4, 3.8],
  [-9, -3.4, 3.8],
  [9, -3.4, 3.8],
].map((a) => new THREE.Vector3(...a))
const CORE_OFFSET = new THREE.Vector3(0, 0, 4.4)
const TURRET_HP = 28
const CORE_HP = 150
const HOLD = new THREE.Vector3(0, 1, -66) // posição de combate (mais perto = chefe maior na tela)

const world = new THREE.Vector3()
const dir = new THREE.Vector3()

export default function Boss() {
  const group = useRef()
  const turretRefs = useRef([])
  const shieldRef = useRef()
  const coreRef = useRef()

  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.5, 0.4), toneMapped: false }), [])
  const shieldMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.6, 1.4, 3),
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  )

  const boss = useMemo(
    () => ({
      active: false,
      state: 'idle', // idle | enter | fight | dying
      pos: new THREE.Vector3(0, 8, -480),
      t: 0,
      coreOffset: CORE_OFFSET,
      turrets: TURRET_OFFSETS.map((o) => ({ offset: o, hp: TURRET_HP, alive: true, fireT: rand(1, 2.5) })),
      coreHp: CORE_HP,
      maxHp: TURRET_HP * 4 + CORE_HP,
      burstT: 2.5,
      fireT: 1.5,
      escortT: 6,
      dyingT: 0,
      boomT: 0,
      halfSaid: false,
      // Fração de vida total (para a barra do HUD)
      hp() {
        let sum = this.coreHp
        for (const t of this.turrets) sum += Math.max(0, t.hp)
        return Math.max(0, sum) / this.maxHp
      },
    }),
    []
  )

  const anyTurret = () => boss.turrets.some((t) => t.alive)

  function hitTurret(tu, dmg, owner) {
    tu.hp -= dmg
    if (owner === 'player') game.stats.hits++
    world.copy(boss.pos).add(tu.offset)
    game.fx.sparks(world, 'orange', 6)
    sfx.hitEnemy()
    if (tu.hp <= 0 && tu.alive) {
      tu.alive = false
      game.fx.explode(world, { size: 2.2 })
      game.fx.shockwave(world, 2)
      sfx.explosion(true)
      game.shake = Math.max(game.shake, 0.7)
      addScore(800, owner === 'wing' ? 'wing' : 'player')
      game.events.push({ type: anyTurret() ? 'turretDown' : 'coreExposed' })
    }
  }

  function hitCore(dmg, owner) {
    boss.coreHp -= dmg
    if (owner === 'player') game.stats.hits++
    world.copy(boss.pos).add(CORE_OFFSET)
    game.fx.sparks(world, 'orange', 8)
    sfx.hitEnemy()
    if (boss.coreHp <= 0 && boss.state === 'fight') {
      boss.coreHp = 0
      boss.state = 'dying'
      boss.dyingT = 0
      addScore(5000, 'player')
      game.timeScale = 0.4 // câmera lenta dramática
      game.events.push({ type: 'bossDying' })
    }
  }

  useEffect(() => {
    game.boss = boss
    game.startBoss = () => {
      boss.active = true
      boss.state = 'enter'
      boss.t = 0
      boss.pos.set(0, 8, -480)
    }
    // Dano em área (bomba)
    game.damageBossArea = (p, r, dmg) => {
      if (!boss.active || boss.state !== 'fight') return
      const r2 = r * r
      for (const tu of boss.turrets) {
        if (!tu.alive) continue
        world.copy(boss.pos).add(tu.offset)
        if (world.distanceToSquared(p) < r2) hitTurret(tu, dmg, 'player')
      }
      if (!anyTurret()) {
        world.copy(boss.pos).add(CORE_OFFSET)
        if (world.distanceToSquared(p) < r2) hitCore(dmg, 'player')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss])

  useFrame((state, delta) => {
    const g = group.current
    g.visible = boss.active
    const dt = frameDt(delta)
    if (!boss.active || !dt) return
    boss.t += dt

    if (boss.state === 'enter') {
      // Entrada: desliza do fundo até a posição de combate (invulnerável)
      boss.pos.lerp(HOLD, damp(0.7, dt))
      if (boss.t > 6) {
        boss.state = 'fight'
        boss.t = 0
      }
    } else if (boss.state === 'fight') {
      const t = boss.t
      // Movimento em "oito": x = sen(0,35t)·9, y = sen(0,6t)·3
      boss.pos.set(Math.sin(t * 0.35) * 9, Math.sin(t * 0.6) * 3 + 1, HOLD.z + Math.sin(t * 0.4) * 5)
      const turretsUp = anyTurret()

      // ---- Ataques ----
      for (const tu of boss.turrets) {
        if (!tu.alive) continue
        tu.fireT -= dt
        if (tu.fireT <= 0) {
          world.copy(boss.pos).add(tu.offset)
          world.z += 1.5
          dir.subVectors(game.shipPos, world)
          dir.x += rand(-1, 1)
          game.fireEnemyLaser(world, dir, 62, 'bolt')
          tu.fireT = rand(1.0, 1.6)
        }
      }
      if (!turretsUp) {
        world.copy(boss.pos).add(CORE_OFFSET)
        // Rajada radial: 16 bolas em anel (cos, sen) inclinadas para +Z
        boss.burstT -= dt
        if (boss.burstT <= 0) {
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2 + t
            dir.set(Math.cos(a) * 0.32, Math.sin(a) * 0.22, 1)
            game.fireEnemyLaser(world, dir, 40, 'plasma')
          }
          boss.burstT = 2.3
        }
        // Tiros mirados em trio
        boss.fireT -= dt
        if (boss.fireT <= 0) {
          for (let k = -1; k <= 1; k++) {
            dir.subVectors(game.shipPos, world).normalize()
            dir.x += k * 0.06
            game.fireEnemyLaser(world, dir, 75, 'bolt')
          }
          boss.fireT = 1.0
        }
      }
      // Escoltas
      boss.escortT -= dt
      if (boss.escortT <= 0) {
        const alive = game.enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0)
        if (alive < 4) {
          game.spawnEnemy('fighter', { x: boss.pos.x - 14, y: boss.pos.y, z: boss.pos.z - 10 })
          game.spawnEnemy('fighter', { x: boss.pos.x + 14, y: boss.pos.y, z: boss.pos.z - 10 })
        }
        boss.escortT = turretsUp ? 11 : 8
      }
      if (!boss.halfSaid && boss.hp() < 0.5) {
        boss.halfSaid = true
        game.events.push({ type: 'bossHalf' })
      }

      // ---- Colisões com os lasers ----
      for (const l of game.playerLasers) {
        if (!l.active) continue
        let hit = false
        for (const tu of boss.turrets) {
          if (!tu.alive) continue
          world.copy(boss.pos).add(tu.offset)
          if (segmentSphere(l.prev, l.pos, world, 2.4)) {
            l.active = false
            hitTurret(tu, l.dmg, l.owner)
            hit = true
            break
          }
        }
        if (hit) continue
        world.copy(boss.pos).add(CORE_OFFSET)
        if (segmentSphere(l.prev, l.pos, world, turretsUp ? 3.8 : 2.8)) {
          l.active = false
          if (turretsUp) {
            game.fx.sparks(l.pos, 'blue', 5) // escudo absorve
            sfx.deflect()
          } else {
            hitCore(l.dmg, l.owner)
          }
          continue
        }
        // Casco (caixa aproximada): bloqueia o tiro
        if (Math.abs(l.pos.x - boss.pos.x) < 13 && Math.abs(l.pos.y - boss.pos.y) < 6 && Math.abs(l.pos.z - boss.pos.z) < 4) {
          l.active = false
          game.fx.sparks(l.pos, 'orange', 3)
        }
      }
    } else if (boss.state === 'dying') {
      // Sequência de explosões, câmera lenta e explosão final
      boss.dyingT += dt
      if (boss.dyingT > 0.6) game.timeScale = 1
      boss.pos.y -= dt * 2
      g.rotation.z += dt * 0.3
      boss.boomT -= dt
      if (boss.boomT <= 0) {
        boss.boomT = 0.12
        world.set(boss.pos.x + rand(-13, 13), boss.pos.y + rand(-5, 5), boss.pos.z + rand(-2, 5))
        game.fx.explode(world, { size: rand(1, 2.2) })
        sfx.explosion(false)
        game.shake = Math.max(game.shake, 0.5)
      }
      if (boss.dyingT > 3.2) {
        game.fx.explode(boss.pos, { size: 5, palette: 'bomb' })
        game.fx.shockwave(boss.pos, 9)
        sfx.bomb()
        game.shake = 1.6
        boss.active = false
        game.bossDefeated = true
        game.timeScale = 1
        game.events.push({ type: 'bossDown' })
      }
    }

    g.position.copy(boss.pos)
    if (boss.state !== 'dying') g.rotation.z = Math.sin(boss.t * 0.5) * 0.05

    // Visual das torres, escudo e núcleo pulsante
    boss.turrets.forEach((tu, i) => (turretRefs.current[i].visible = tu.alive))
    const shieldUp = anyTurret()
    shieldRef.current.visible = shieldUp
    shieldRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.04)
    const pulse = 0.6 + Math.sin(state.clock.elapsedTime * (shieldUp ? 3 : 9)) * 0.4
    coreMat.color.setRGB(4 * pulse + 1, 0.4 * pulse, 0.3 * pulse)
    coreRef.current.scale.setScalar(shieldUp ? 1 : 1.15 + pulse * 0.1)
  })

  return (
    <group ref={group} visible={false}>
      <pointLight position={[0, 0, 9]} color="#ff5040" intensity={60} distance={40} decay={1.5} />

      {/* Casco: prisma hexagonal deitado (eixo do cilindro girado de Y para Z) */}
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 6]} material={M.eHull}>
        <cylinderGeometry args={[10, 12.5, 7, 6]} />
      </mesh>
      <mesh position={[0, 0, 3.6]} material={M.eArmor}>
        <torusGeometry args={[5, 0.9, 8, 6]} />
      </mesh>
      {/* Asas laterais com espinhos */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 16, 0, -1]} rotation={[0, 0, s * 0.22]} material={M.eArmor}>
            <boxGeometry args={[10, 1.4, 5]} />
          </mesh>
          <mesh position={[s * 21, s * 1.1, 1.5]} rotation={[Math.PI / 2, 0, 0]} material={M.eHull}>
            <coneGeometry args={[0.8, 5, 6]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[s * (12.5 + k * 2), s * (0.55 + k * 0.45), 1.55]} material={M.eGlow}>
              <boxGeometry args={[0.8, 0.15, 0.1]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Torre de comando */}
      <mesh position={[0, 9.5, -1]} material={M.eArmor}>
        <boxGeometry args={[4, 4, 4]} />
      </mesh>
      <mesh position={[0, 12.5, -1]} material={M.eHull}>
        <cylinderGeometry args={[0.1, 0.1, 3, 4]} />
      </mesh>
      <mesh position={[0, 9.8, 1.05]} material={M.eGlow}>
        <boxGeometry args={[3, 0.3, 0.1]} />
      </mesh>
      {/* Faixas de luz na frente */}
      {[-6.2, 6.2].map((y) => (
        <mesh key={y} position={[0, y, 3.6]} material={M.eGlow}>
          <boxGeometry args={[7, 0.25, 0.2]} />
        </mesh>
      ))}
      {/* Motores traseiros */}
      {[-6, 0, 6].map((x) => (
        <mesh key={x} position={[x, 0, -3.6]} rotation={[0, Math.PI, 0]} material={M.eEngine}>
          <circleGeometry args={[2, 16]} />
        </mesh>
      ))}

      {/* Núcleo + escudo */}
      <mesh ref={coreRef} position={CORE_OFFSET} material={coreMat}>
        <sphereGeometry args={[2.3, 24, 16]} />
      </mesh>
      <mesh ref={shieldRef} position={CORE_OFFSET} material={shieldMat}>
        <sphereGeometry args={[3.8, 24, 16]} />
      </mesh>

      {/* Torres */}
      {TURRET_OFFSETS.map((o, i) => (
        <group key={i} position={o} ref={(el) => (turretRefs.current[i] = el)}>
          <mesh material={M.eHull}>
            <boxGeometry args={[2.8, 1.8, 2.2]} />
          </mesh>
          <mesh position={[0, 0.6, 0.3]} material={M.eArmor}>
            <sphereGeometry args={[1.1, 12, 8]} />
          </mesh>
          {[-0.45, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.5, 1.8]} rotation={[Math.PI / 2, 0, 0]} material={M.dark}>
              <cylinderGeometry args={[0.16, 0.2, 2.4, 8]} />
            </mesh>
          ))}
          <mesh position={[0, -0.2, 1.15]} material={M.eGlow}>
            <boxGeometry args={[1.6, 0.25, 0.1]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
