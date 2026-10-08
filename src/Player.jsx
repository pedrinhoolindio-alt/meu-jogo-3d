// src/Player.jsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, BOUNDS, CONFIG, damp } from './gameState'
import { PlayerShip, M } from './models'
import { sfx } from './audio'

const { lerp, clamp } = THREE.MathUtils

// Vetores reutilizados (criar Vector3 dentro do useFrame gera lixo para o GC a cada frame)
const desiredCam = new THREE.Vector3()
const camBase = new THREE.Vector3(0, 2.8, 11) // posição suavizada da câmera (antes do tremor)
const lookTarget = new THREE.Vector3()
const smoothLook = new THREE.Vector3(0, 0, -20)
const prevPos = new THREE.Vector3()

// Curva "ease in-out": começa e termina devagar (usada no giro evasivo)
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

export default function Player() {
  const ship = useRef()
  const roller = useRef() // grupo interno: gira 360° no barrel roll sem bagunçar a inclinação
  const crosshair = useRef()
  const flames = useRef([])

  useFrame((state, delta) => {
    if (game.phase === 'paused') return
    // Trava o delta: evita "teleporte" ao voltar de outra aba.
    // O mínimo de 0.0001 evita dividir por zero no 1º frame (delta = 0 → velocidade NaN → nave some)
    const raw = Math.min(Math.max(delta, 0.0001), 0.05)
    const dt = raw * game.timeScale
    const s = ship.current
    const cam = state.camera
    const k = game.keys
    const playing = game.phase === 'playing'

    if (game.phase === 'title') {
      // Na tela de título a nave só "flutua"
      const t = state.clock.elapsedTime
      s.position.set(Math.sin(t * 0.5) * 1.2, Math.sin(t * 0.8) * 0.5 - 0.5, 0)
      s.rotation.set(Math.sin(t * 0.8) * 0.05, 0, Math.sin(t * 0.5) * -0.15)
      game.boosting = false
    } else {
      if (playing) {
        // ---------------- 1) Teclado move o ALVO ----------------
        // kx/ky ∈ {-1, 0, 1}. alvo = alvo + direção * velocidade * dt
        const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
        const ky = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
        game.target.x += kx * CONFIG.keyboardSpeed * dt
        game.target.y += ky * CONFIG.keyboardSpeed * dt

        // ---------------- Turbo (Shift) ----------------
        const wantBoost = (k.ShiftLeft || k.ShiftRight) && game.boost > 0.05
        game.boosting = wantBoost
        game.boost = clamp(game.boost + (wantBoost ? -CONFIG.boostDrain : CONFIG.boostRegen) * dt, 0, 1)

        // ---------------- Giro evasivo (Q/E) ----------------
        if (game.rollCooldown > 0) game.rollCooldown -= dt
        if (game.rollRequest && game.rollTimer <= 0 && game.rollCooldown <= 0) {
          game.rollTimer = CONFIG.rollDuration
          game.rollDir = game.rollRequest
          game.rollCooldown = CONFIG.rollDuration + CONFIG.rollCooldown
          game.target.x += game.rollDir * 3.5 // o giro também desloca a nave para o lado
          sfx.roll()
        }
      } else {
        game.boosting = false
      }
      game.rollRequest = 0

      // Constraint: mantém o alvo dentro do "quadrado" imaginário
      game.target.x = clamp(game.target.x, -BOUNDS.x, BOUNDS.x)
      game.target.y = clamp(game.target.y, -BOUNDS.y, BOUNDS.y)

      // ---------------- 2) Nave persegue o alvo com lerp ----------------
      // pos = pos + (alvo - pos) * t  → movimento suave que desacelera ao chegar
      prevPos.copy(s.position)
      const t = damp(CONFIG.shipFollow, dt)
      s.position.x = lerp(s.position.x, game.target.x, t)
      s.position.y = lerp(s.position.y, game.target.y, t)

      // Velocidade instantânea: v = Δposição / Δtempo
      const vx = dt > 0 ? (s.position.x - prevPos.x) / dt : 0
      const vy = dt > 0 ? (s.position.y - prevPos.y) / dt : 0

      // ---------------- 3) Inclinação aerodinâmica ----------------
      // A nave aponta para -Z. Convenções de sinal:
      //  - Roll (rotation.z): +Z gira a asa direita para CIMA → para inclinar para a direita usamos -vx
      //  - Pitch (rotation.x): +X levanta o nariz → subir (vy > 0) usa +vy
      //  - Yaw (rotation.y): -Y vira o nariz para +X → ir para a direita usa -vx
      const rt = damp(8, dt)
      s.rotation.z = lerp(s.rotation.z, clamp(-vx * 0.06, -0.9, 0.9), rt)
      s.rotation.x = lerp(s.rotation.x, clamp(vy * 0.04, -0.4, 0.4), rt)
      s.rotation.y = lerp(s.rotation.y, clamp(-vx * 0.02, -0.25, 0.25), rt)
    }

    // Velocidade do cenário: o turbo acelera tudo que vem na direção da nave
    game.worldMul = lerp(game.worldMul, game.boosting ? CONFIG.boostMul : 1, damp(3, raw))

    // Giro de 360° no grupo interno, com aceleração suave
    if (game.rollTimer > 0) {
      game.rollTimer -= dt
      const p = 1 - Math.max(0, game.rollTimer) / CONFIG.rollDuration
      roller.current.rotation.z = -game.rollDir * Math.PI * 2 * easeInOut(p)
    } else {
      roller.current.rotation.z = 0
    }

    // Pisca enquanto está invulnerável; some quando é destruída
    const dead = game.phase === 'dying' || game.phase === 'gameover'
    const blink = playing && game.invuln > 0 && Math.floor(state.clock.elapsedTime * 20) % 2 === 0
    s.visible = !dead && !blink

    // Publica para os outros sistemas
    game.shipPos.copy(s.position)
    game.shipQuat.copy(s.quaternion)

    // ---------------- 4) Mira ----------------
    // A mira fica num plano à frente (z = -aimDistance) e "abre" além da nave (aimLead > 1)
    game.aim.set(game.target.x * CONFIG.aimLead, game.target.y * CONFIG.aimLead, -CONFIG.aimDistance)
    crosshair.current.position.copy(game.aim)
    crosshair.current.quaternion.copy(cam.quaternion) // billboard: sempre de frente para a câmera
    crosshair.current.visible = playing
    const pulse = 1 + game.hitMarker * 0.35
    crosshair.current.scale.setScalar(pulse)

    // ---------------- 5) Câmera em 3ª pessoa com atraso ----------------
    // posição desejada = (posição da nave * parallax) + offset (atrás/acima)
    desiredCam
      .set(s.position.x * CONFIG.cameraParallax, s.position.y * CONFIG.cameraParallax, 0)
      .add(CONFIG.cameraOffset)
    camBase.lerp(desiredCam, damp(CONFIG.cameraFollow, raw))

    // Tremor de tela: deslocamento aleatório proporcional a shake² (cai rápido)
    game.shake = Math.max(0, game.shake - raw * 1.6)
    const sh = game.shake * game.shake * 0.6
    cam.position.set(camBase.x + (Math.random() - 0.5) * sh, camBase.y + (Math.random() - 0.5) * sh, camBase.z)

    // Campo de visão abre no turbo (sensação de velocidade)
    const targetFov = game.boosting ? 82 : 70
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = lerp(cam.fov, targetFov, damp(4, raw))
      cam.updateProjectionMatrix()
    }

    lookTarget.set(s.position.x * 0.8, s.position.y * 0.8, -20)
    smoothLook.lerp(lookTarget, damp(CONFIG.cameraFollow * 1.5, raw))
    cam.lookAt(smoothLook)

    // ---------------- Motores ----------------
    M.engine.emissiveIntensity = (game.boosting ? 6 : 2.5) + Math.random() * 1.5
    const len = (game.boosting ? 2.8 : 0.9) * (0.8 + Math.random() * 0.4)
    for (const f of flames.current) if (f) f.scale.y = len
  })

  return (
    <>
      <group ref={ship}>
        <group ref={roller}>
          <PlayerShip stripe="#c62828" flames={flames} />
        </group>
      </group>

      {/* ===== MIRA ===== */}
      <group ref={crosshair}>
        <mesh renderOrder={999}>
          <ringGeometry args={[0.9, 1.05, 32]} />
          <meshBasicMaterial color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={999}>
          <ringGeometry args={[0.12, 0.2, 16]} />
          <meshBasicMaterial color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} renderOrder={999} rotation={[0, 0, (i * Math.PI) / 2]} position={[Math.cos((i * Math.PI) / 2) * 1.35, Math.sin((i * Math.PI) / 2) * 1.35, 0]}>
            <planeGeometry args={[0.45, 0.08]} />
            <meshBasicMaterial color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </>
  )
}
