// src/Lasers.jsx
// Lasers do jogador e dos alas + bomba de prótons.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, CANNONS, frameDt, damageArea, collectTargets } from './gameState'
import { sfx } from './audio'

const MAX = 160 // tamanho do pool (máximo de lasers simultâneos)
const UP = new THREE.Vector3(0, 1, 0) // eixo "natural" do CylinderGeometry
const dummy = new THREE.Object3D() // objeto auxiliar para montar a matriz de cada instância
const origin = new THREE.Vector3()
const dir = new THREE.Vector3()

// Cores acima de 1.0 + toneMapped=false = "brilham" no Bloom
export const LASER_COLORS = {
  player: new THREE.Color(3.2, 0.35, 0.25),
  plasma: new THREE.Color(3, 0.7, 2.8),
  wing: new THREE.Color(0.4, 2.2, 3.4),
  hyper: new THREE.Color(3.4, 3.2, 1.2),
}

export default function Lasers() {
  const mesh = useRef()
  const bombMesh = useRef()
  const cooldown = useRef(0)
  const pair = useRef(0) // 0 = canhões de cima, 1 = canhões de baixo

  // POOL: criamos todos os lasers uma vez e só ligamos/desligamos (active).
  // Assim nada é alocado/destruído durante o jogo → sem pressão no garbage collector.
  const pool = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        active: false,
        pos: new THREE.Vector3(), // posição atual
        prev: new THREE.Vector3(), // posição no frame anterior (usada na colisão)
        dir: new THREE.Vector3(), // direção normalizada (comprimento 1)
        traveled: 0,
        dmg: 1,
        owner: 'player',
        width: 1,
        speed: CONFIG.laserSpeed,
        pierce: 0, // quantos inimigos ainda pode atravessar (hiper-laser)
        lastHit: null,
      })),
    []
  )
  const bomb = useMemo(() => ({ active: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(), traveled: 0 }), [])

  // Cria o buffer de cores por instância antes do primeiro render
  useLayoutEffect(() => {
    for (let i = 0; i < MAX; i++) mesh.current.setColorAt(i, LASER_COLORS.player)
    mesh.current.instanceColor.needsUpdate = true
  }, [])

  useEffect(() => {
    game.playerLasers = pool
    game.firePlayerLaser = (from, direction, opts = {}) => {
      const owner = opts.owner || 'player'
      for (let i = 0; i < MAX; i++) {
        const l = pool[i]
        if (l.active) continue
        l.pos.copy(from)
        l.prev.copy(from)
        l.dir.copy(direction).normalize()
        l.traveled = 0
        l.dmg = opts.dmg ?? 1
        l.owner = owner
        l.width = opts.width ?? 1
        l.speed = opts.speed ?? CONFIG.laserSpeed
        l.pierce = opts.pierce ?? 0
        l.lastHit = null
        l.active = true
        mesh.current.setColorAt(i, opts.color || LASER_COLORS[owner] || LASER_COLORS.player)
        mesh.current.instanceColor.needsUpdate = true
        return
      }
    }
  }, [pool])

  function fireFromShip() {
    const lvl = game.weaponLevel
    // Nível 0: pares alternados (cima/baixo). Nível 1+: os 4 canhões juntos.
    const idx = lvl === 0 ? [pair.current * 2, pair.current * 2 + 1] : [0, 1, 2, 3]
    if (lvl === 0) pair.current = 1 - pair.current
    const opts =
      lvl >= 4
        ? { dmg: 2, width: 1.4, color: LASER_COLORS.hyper, speed: 230, pierce: 2 } // hiper-laser: rápido e perfurante
        : lvl >= 2
          ? { dmg: 1.6, width: 1.7, color: LASER_COLORS.plasma }
          : { dmg: 1, width: 1, color: LASER_COLORS.player }
    for (const i of idx) {
      // Posição do canhão no MUNDO:
      //   offset local → aplica a rotação da nave (quaternion) → soma a posição da nave
      origin.copy(CANNONS[i]).applyQuaternion(game.shipQuat).add(game.shipPos)
      // Direção = (mira - origem) normalizada → todos os canhões convergem na mira
      dir.subVectors(game.aim, origin).normalize()
      game.firePlayerLaser(origin, dir, opts)
      game.stats.shots++
    }
    // Leque (nível 3+): dois tiros extras das pontas das asas, abertos 9° para cada lado
    if (lvl >= 3) {
      for (let k = 0; k < 2; k++) {
        origin.copy(CANNONS[k]).applyQuaternion(game.shipQuat).add(game.shipPos)
        // Gira a direção em torno do "teto" da nave: asa direita abre para a direita (ângulo negativo)
        dir.subVectors(game.aim, origin).normalize().applyAxisAngle(game.shipUp, k === 0 ? -0.09 : 0.09)
        game.firePlayerLaser(origin, dir, { ...opts, dmg: opts.dmg * 0.8 })
      }
    }
    sfx.laser()
  }

  // Detonação da bomba: dano em área + limpa os tiros inimigos
  function detonate(p) {
    bomb.active = false
    game.fx.explode(p, { size: 3.4, palette: 'bomb' })
    game.fx.shockwave(p, 5)
    game.shake = 1.4
    sfx.bomb()
    // Atinge caças, peças das naves-mãe e do chefe dentro do raio
    damageArea(p, CONFIG.bombRadius, 25)
    game.clearEnemyLasers()
  }

  useFrame((state, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    const playing = game.phase === 'playing'

    // Disparo contínuo enquanto segura o botão/espaço ou com auto-tiro ativo, respeitando o cooldown
    cooldown.current -= dt
    const shouldFire = game.wantsToFire || game.autoFire
    if (playing && shouldFire && cooldown.current <= 0) {
      fireFromShip()
      cooldown.current = CONFIG.fireCooldown[game.weaponLevel]
    }

    // ---- Bomba ----
    if (game.wantsBomb) {
      game.wantsBomb = false
      if (playing && game.bombs > 0 && !bomb.active) {
        game.bombs--
        bomb.active = true
        // Sai pelo nariz e voa na direção da mira
        bomb.pos.copy(game.shipPos).addScaledVector(game.shipFwd, 3)
        bomb.dir.subVectors(game.aim, bomb.pos).normalize()
        bomb.traveled = 0
        sfx.bombLaunch()
      }
    }
    if (bomb.active) {
      const step = 95 * dt
      bomb.pos.addScaledVector(bomb.dir, step)
      bomb.traveled += step
      // Explode ao chegar a 80 unidades ou ao encostar em qualquer alvo
      let boom = bomb.traveled >= 80
      if (!boom) {
        for (const t of collectTargets()) {
          const r = t.r + 3
          if (t.pos.distanceToSquared(bomb.pos) < r * r) {
            boom = true
            break
          }
        }
      }
      if (boom) detonate(bomb.pos.clone())
    }
    bombMesh.current.visible = bomb.active
    if (bomb.active) {
      bombMesh.current.position.copy(bomb.pos)
      bombMesh.current.scale.setScalar(0.8 + Math.sin(state.clock.elapsedTime * 30) * 0.15)
    }

    // ---- Lasers ----
    for (let i = 0; i < MAX; i++) {
      const l = pool[i]
      if (l.active) {
        l.prev.copy(l.pos)
        // Movimento retilíneo: pos = pos + dir * (velocidade * dt)
        const step = l.speed * dt
        l.pos.addScaledVector(l.dir, step)
        l.traveled += step
        // Recicla após a distância máxima
        if (l.traveled > CONFIG.laserMaxDistance) l.active = false
      }
      if (l.active) {
        dummy.position.copy(l.pos)
        // Gira o cilindro (que nasce apontando para +Y) para alinhar com a direção do tiro
        dummy.quaternion.setFromUnitVectors(UP, l.dir)
        dummy.scale.set(l.width, 1, l.width)
      } else {
        dummy.scale.setScalar(0) // instância "escondida"
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      {/* InstancedMesh: 1 draw call para todos os lasers */}
      <instancedMesh ref={mesh} args={[null, null, MAX]} frustumCulled={false}>
        <cylinderGeometry args={[0.07, 0.07, 2.6, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Bomba de prótons */}
      <group ref={bombMesh} visible={false}>
        <mesh>
          <sphereGeometry args={[0.45, 16, 12]} />
          <meshBasicMaterial color={[2.5, 3, 4]} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.9, 16, 12]} />
          <meshBasicMaterial color={[0.5, 1, 3]} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}
