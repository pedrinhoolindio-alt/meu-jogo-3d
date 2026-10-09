// src/Boss.jsx
// Chefe final: Fortaleza Korrath, no céu de Fortaleza-CE ao amanhecer.
// Fase 1: 4 torres protegem o núcleo (que tem escudo). Fase 2: núcleo exposto, rajadas radiais.
// Voo livre: a fortaleza sempre gira a "face" (+Z, onde ficam torres e núcleo) para o jogador.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, frameDt, rand, damp, segmentSphere, addScore, damagePlayer } from './gameState'
import { M, Ship } from './models'
import { sfx } from './audio'

// Posições relativas ao centro da fortaleza (medidas sobre o modelo 3D escalado 4,2×)
const TURRET_OFFSETS = [
  [-12.5, 1.5, 6.2],
  [12.5, 1.5, 6.2],
  [-7.5, -9, 6.2],
  [7.5, -9, 6.2],
].map((a) => new THREE.Vector3(...a))
const CORE_OFFSET = new THREE.Vector3(0, 0, 4.6)
const TURRET_HP = 28
const CORE_HP = 150
const world = new THREE.Vector3()
const dir = new THREE.Vector3()
const local = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const look = new THREE.Matrix4()
const qLook = new THREE.Quaternion()
const FLIP = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI)

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
      anchor: new THREE.Vector3(), // centro do "oito" que a fortaleza descreve
      quat: new THREE.Quaternion(),
      inv: new THREE.Quaternion(),
      vel: new THREE.Vector3(),
      t: 0,
      coreOffset: CORE_OFFSET,
      turrets: TURRET_OFFSETS.map((o) => ({ offset: o, hp: TURRET_HP, alive: true, fireT: rand(1, 2.5), pos: new THREE.Vector3() })),
      core: { pos: new THREE.Vector3() },
      targets: [],
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
    world.copy(tu.pos)
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
    world.copy(boss.core.pos)
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

  // Alvos (mira automática, mísseis, alas, bombas): torres e, sem torres, o núcleo
  useMemo(() => {
    boss.targets = boss.turrets.map((tu) => ({
      pos: tu.pos,
      vel: boss.vel,
      r: 2.6,
      kind: 'boss',
      get alive() {
        return tu.alive
      },
      hit: (d, o) => tu.alive && hitTurret(tu, d, o),
    }))
    boss.targets.push({
      pos: boss.core.pos,
      vel: boss.vel,
      r: 3,
      kind: 'boss',
      get alive() {
        return !anyTurret() && boss.coreHp > 0
      },
      hit: (d, o) => hitCore(d, o),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss])

  useEffect(() => {
    game.boss = boss
    game.startBoss = () => {
      boss.active = true
      boss.state = 'enter'
      boss.t = 0
      // Surge longe, à frente do jogador, e se aproxima até a distância de combate
      boss.anchor.copy(game.shipPos).addScaledVector(game.shipFwd, 190)
      boss.anchor.y = Math.max(boss.anchor.y, game.ground + 260)
      boss.pos.copy(game.shipPos).addScaledVector(game.shipFwd, 700)
      boss.pos.y = boss.anchor.y + 120
    }
    game.damageBossArea = () => {} // (dano em área agora passa por damageArea/collectTargets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss])

  useFrame((state, delta) => {
    const g = group.current
    g.visible = boss.active
    const dt = frameDt(delta)
    if (!boss.active || !dt) return
    boss.t += dt

    // A fortaleza gira devagar para encarar o jogador (slerp até a rotação de "olhar")
    look.lookAt(boss.pos, game.shipPos, UP)
    qLook.setFromRotationMatrix(look).multiply(FLIP) // lookAt aponta −Z; a face da fortaleza é +Z
    boss.quat.slerp(qLook, damp(boss.state === 'enter' ? 2 : 0.5, dt))
    boss.inv.copy(boss.quat).invert()
    const prevX = boss.pos.x
    const prevY = boss.pos.y
    const prevZ = boss.pos.z

    if (boss.state === 'enter') {
      // Entrada: desce do céu até a posição de combate (invulnerável)
      boss.pos.lerp(boss.anchor, damp(0.7, dt))
      if (boss.t > 6) {
        boss.state = 'fight'
        boss.t = 0
      }
    } else if (boss.state === 'fight') {
      const t = boss.t
      // Movimento em "oito" em volta da âncora: x = sen(0,35t)·40, y = sen(0,6t)·12, z = sen(0,7t)·30
      boss.pos.set(boss.anchor.x + Math.sin(t * 0.35) * 40, boss.anchor.y + Math.sin(t * 0.6) * 12, boss.anchor.z + Math.sin(t * 0.7) * 30)
      const turretsUp = anyTurret()

      // ---- Ataques ----
      for (const tu of boss.turrets) {
        if (!tu.alive) continue
        tu.fireT -= dt
        if (tu.fireT <= 0) {
          // Mira no ponto previsto da nave: alvo + velocidade · (distância / 70)
          dir.copy(game.shipPos).addScaledVector(game.shipVel, tu.pos.distanceTo(game.shipPos) / 70 * 0.7).sub(tu.pos)
          dir.x += rand(-2, 2)
          game.fireEnemyLaser(tu.pos, dir, 70, 'bolt')
          tu.fireT = rand(1.0, 1.6)
        }
      }
      if (!turretsUp) {
        world.copy(boss.core.pos)
        // Rajada radial: 16 bolas em anel (cos, sen) inclinadas para a frente (+Z local → mundo)
        boss.burstT -= dt
        if (boss.burstT <= 0) {
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2 + t
            dir.set(Math.cos(a) * 0.45, Math.sin(a) * 0.35, 1).applyQuaternion(boss.quat)
            game.fireEnemyLaser(world, dir, 45, 'plasma')
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
        if (alive < 6) {
          for (const sx of [-1, 1]) {
            world.set(sx * 24, 0, -6).applyQuaternion(boss.quat).add(boss.pos)
            dir.set(sx, 0, 1).applyQuaternion(boss.quat)
            game.spawnEnemy(Math.random() < 0.5 ? 'fighter' : 'ace', { pos: world, dir })
          }
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
          if (segmentSphere(l.prev, l.pos, tu.pos, 2.6)) {
            l.active = false
            hitTurret(tu, l.dmg, l.owner)
            hit = true
            break
          }
        }
        if (hit) continue
        if (segmentSphere(l.prev, l.pos, boss.core.pos, turretsUp ? 3.8 : 3)) {
          l.active = false
          if (turretsUp) {
            game.fx.sparks(l.pos, 'blue', 5) // escudo absorve
            sfx.deflect()
          } else {
            hitCore(l.dmg, l.owner)
          }
          continue
        }
        // Casco (caixa no espaço LOCAL da fortaleza): bloqueia o tiro
        local.subVectors(l.pos, boss.pos).applyQuaternion(boss.inv)
        if (Math.abs(local.x) < 19 && Math.abs(local.y) < 14 && Math.abs(local.z) < 5.5) {
          l.active = false
          game.fx.sparks(l.pos, 'orange', 3)
        }
      }
      // Encostar no casco machuca e empurra a nave para fora
      local.subVectors(game.shipPos, boss.pos).applyQuaternion(boss.inv)
      if (Math.abs(local.x) < 21 && Math.abs(local.y) < 16 && Math.abs(local.z) < 7.5) {
        damagePlayer(30, 'ram')
        game.shipPos.addScaledVector(dir.subVectors(game.shipPos, boss.pos).normalize(), 4)
      }
    } else if (boss.state === 'dying') {
      // Sequência de explosões, câmera lenta e explosão final
      boss.dyingT += dt
      if (boss.dyingT > 0.6) game.timeScale = 1
      boss.pos.y -= dt * 6 // despenca sobre o mar de Fortaleza
      boss.boomT -= dt
      if (boss.boomT <= 0) {
        boss.boomT = 0.12
        world.set(rand(-18, 18), rand(-13, 13), rand(0, 6)).applyQuaternion(boss.quat).add(boss.pos)
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

    // Velocidade (para a previsão de tiro dos alas/mísseis)
    if (dt > 0) boss.vel.set((boss.pos.x - prevX) / dt, (boss.pos.y - prevY) / dt, (boss.pos.z - prevZ) / dt)
    // Posições das peças no mundo: mundo = posição + rotação · deslocamento local
    for (const tu of boss.turrets) tu.pos.copy(tu.offset).applyQuaternion(boss.quat).add(boss.pos)
    boss.core.pos.copy(CORE_OFFSET).applyQuaternion(boss.quat).add(boss.pos)

    g.position.copy(boss.pos)
    g.quaternion.copy(boss.quat)
    if (boss.state === 'dying') g.rotateZ(boss.dyingT * 0.3)
    else g.rotateZ(Math.sin(boss.t * 0.5) * 0.05)

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

      {/* Casco: disco de batalha (modelo 3D) visto de frente — o topo do modelo encara o jogador */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Ship kind="boss" scale={4.2} engines={false} />
      </group>
      {/* Luzes de alerta no casco */}
      {[-16, 16].map((x) => (
        <mesh key={x} position={[x, 9, 4.2]} material={M.eGlow}>
          <sphereGeometry args={[0.45, 10, 8]} />
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
