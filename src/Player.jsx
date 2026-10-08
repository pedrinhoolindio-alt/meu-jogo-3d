// src/Player.jsx
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, BOUNDS, CONFIG } from './gameState'

const { lerp, clamp } = THREE.MathUtils

// Vetores reutilizados (criar Vector3 dentro do useFrame gera lixo para o GC a cada frame)
const desiredCam = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const smoothLook = new THREE.Vector3(0, 0, -20)
const prevPos = new THREE.Vector3()

/**
 * Lerp independente de FPS.
 * Um lerp fixo (ex: 0.1) roda mais rápido a 144fps que a 60fps.
 * Com t = 1 - e^(-k·dt), a fração percorrida depende só do tempo real:
 *   k maior → alcança o alvo mais rápido. Ex: k=6 → ~95% do caminho em 0,5s.
 */
const damp = (k, dt) => 1 - Math.exp(-k * dt)

export default function Player() {
  const ship = useRef()
  const crosshair = useRef()

  const mats = useMemo(
    () => ({
      hull: new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 0.4, roughness: 0.5 }),
      stripe: new THREE.MeshStandardMaterial({ color: '#b3261e', metalness: 0.3, roughness: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ color: '#3a3f47', metalness: 0.6, roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: '#0b1a33', metalness: 0.9, roughness: 0.1 }),
      engine: new THREE.MeshStandardMaterial({ color: '#ff7a2f', emissive: '#ff5a1f', emissiveIntensity: 3, toneMapped: false }),
    }),
    []
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05) // trava o delta: evita "teleporte" ao voltar de outra aba
    const s = ship.current
    const k = game.keys

    // ---------------- 1) Entrada de teclado move o ALVO ----------------
    // kx/ky ∈ {-1, 0, 1}. alvo = alvo + direção * velocidade * dt
    const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
    const ky = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
    game.target.x += kx * CONFIG.keyboardSpeed * dt
    game.target.y += ky * CONFIG.keyboardSpeed * dt

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
    const vx = (s.position.x - prevPos.x) / dt
    const vy = (s.position.y - prevPos.y) / dt

    // ---------------- 3) Inclinação aerodinâmica ----------------
    // A nave aponta para -Z. Convenções de sinal:
    //  - Roll (rotation.z): +Z gira a asa direita para CIMA → para inclinar para a direita usamos -vx
    //  - Pitch (rotation.x): +X levanta o nariz → subir (vy > 0) usa +vy
    //  - Yaw (rotation.y): -Y vira o nariz para +X → ir para a direita usa -vx
    // Os multiplicadores (0.06, 0.04, 0.02) definem "quanto inclina por unidade de velocidade".
    const rt = damp(8, dt)
    s.rotation.z = lerp(s.rotation.z, clamp(-vx * 0.06, -0.9, 0.9), rt)
    s.rotation.x = lerp(s.rotation.x, clamp(vy * 0.04, -0.4, 0.4), rt)
    s.rotation.y = lerp(s.rotation.y, clamp(-vx * 0.02, -0.25, 0.25), rt)

    // Publica para Lasers/Asteroids
    game.shipPos.copy(s.position)
    game.shipQuat.copy(s.quaternion)

    // ---------------- 4) Mira ----------------
    // A mira fica num plano à frente (z = -aimDistance) e "abre" além da nave (aimLead > 1),
    // assim dá para mirar em asteroides fora do alcance direto do quadrado de movimento.
    game.aim.set(game.target.x * CONFIG.aimLead, game.target.y * CONFIG.aimLead, -CONFIG.aimDistance)
    crosshair.current.position.copy(game.aim)
    crosshair.current.quaternion.copy(state.camera.quaternion) // billboard: sempre de frente para a câmera

    // ---------------- 5) Câmera em 3ª pessoa com atraso ----------------
    // posição desejada = (posição da nave * parallax) + offset (atrás/acima)
    // parallax < 1 faz a câmera mover MENOS que a nave → a nave "desliza" pela tela (estilo Star Fox)
    desiredCam
      .set(s.position.x * CONFIG.cameraParallax, s.position.y * CONFIG.cameraParallax, 0)
      .add(CONFIG.cameraOffset)
    state.camera.position.lerp(desiredCam, damp(CONFIG.cameraFollow, dt))

    // O ponto para onde a câmera olha também é suavizado (senão ela "trava" na nave)
    lookTarget.set(s.position.x * 0.8, s.position.y * 0.8, -20)
    smoothLook.lerp(lookTarget, damp(CONFIG.cameraFollow * 1.5, dt))
    state.camera.lookAt(smoothLook)

    // Tremulação do brilho dos motores
    mats.engine.emissiveIntensity = 2.5 + Math.random() * 1.5
  })

  return (
    <>
      {/* ===== NAVE (nariz apontando para -Z) ===== */}
      <group ref={ship}>
        {/* Nariz: cone girado -90° em X → ponta passa de +Y para -Z */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} material={mats.hull}>
          <coneGeometry args={[0.35, 2.6, 8]} />
        </mesh>
        {/* Faixa vermelha no nariz */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.55]} material={mats.stripe}>
          <cylinderGeometry args={[0.36, 0.38, 0.35, 8]} />
        </mesh>
        {/* Fuselagem */}
        <mesh position={[0, 0, 0.6]} material={mats.hull}>
          <boxGeometry args={[0.75, 0.6, 2.2]} />
        </mesh>
        {/* Cockpit */}
        <mesh position={[0, 0.36, 0]} material={mats.glass}>
          <boxGeometry args={[0.42, 0.22, 0.9]} />
        </mesh>
        {/* Droid astromecânico */}
        <mesh position={[0, 0.38, 0.9]} material={mats.dark}>
          <sphereGeometry args={[0.18, 12, 8]} />
        </mesh>

        {/* 4 asas em "X": sx = lado (±1), sy = cima/baixo (±1) */}
        {[
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ].map(([sx, sy]) => (
          <group key={`${sx}${sy}`} position={[sx * 1.6, sy * 0.25, 0.7]} rotation={[0, 0, sx * sy * 0.2]}>
            {/* Asa */}
            <mesh material={mats.hull}>
              <boxGeometry args={[2.6, 0.08, 1.1]} />
            </mesh>
            <mesh position={[sx * 0.6, 0.05, 0]} material={mats.stripe}>
              <boxGeometry args={[0.5, 0.02, 1.0]} />
            </mesh>
            {/* Canhão na ponta da asa (cilindro deitado ao longo de Z) */}
            <mesh position={[sx * 1.3, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={mats.dark}>
              <cylinderGeometry args={[0.05, 0.05, 1.8, 6]} />
            </mesh>
            {/* Motor */}
            <mesh position={[-sx * 1.05, sy * 0.12, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={mats.dark}>
              <cylinderGeometry args={[0.2, 0.2, 1.5, 10]} />
            </mesh>
            {/* Brilho do motor (traseira, +Z) */}
            <mesh position={[-sx * 1.05, sy * 0.12, 1.06]} material={mats.engine}>
              <circleGeometry args={[0.17, 12]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ===== MIRA (crosshair) ===== */}
      <group ref={crosshair}>
        <mesh renderOrder={999}>
          <ringGeometry args={[0.9, 1.05, 32]} />
          <meshBasicMaterial color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={999}>
          <ringGeometry args={[0.12, 0.2, 16]} />
          <meshBasicMaterial color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}
