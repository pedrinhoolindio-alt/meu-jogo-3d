// src/Cockpit.jsx
// Visão de DENTRO da nave (tecla T ou botão VISÃO): painel com telas acesas, colunas da cabine
// e o vidro com a mira. O grupo é posicionado pelo Player exatamente onde está a câmera.
import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, collectTargets } from './gameState'

// Materiais da cabine
const hull = new THREE.MeshStandardMaterial({ color: '#1d232c', metalness: 0.6, roughness: 0.45 })
const trim = new THREE.MeshStandardMaterial({ color: '#39424f', metalness: 0.8, roughness: 0.3 })
const glowCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.6), toneMapped: false })
const glowAmber = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.4, 0.3), toneMapped: false })
const glowRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.3, 0.25), toneMapped: false })
const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.7, 0.45), transparent: true, opacity: 0.06, depthWrite: false, toneMapped: false })

// Tela multifunção: um canvas redesenhado algumas vezes por segundo com os dados da nave
function useScreen(draw, w = 256, h = 160) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { c, ctx: c.getContext('2d'), tex, draw }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

function frame(ctx, w, h, title) {
  ctx.fillStyle = '#03141c'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(90,230,255,0.6)'
  ctx.lineWidth = 3
  ctx.strokeRect(3, 3, w - 6, h - 6)
  ctx.fillStyle = '#5fe6ff'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(title, 12, 24)
}

// Tela esquerda: escudo, turbo e armas
function drawStatus({ ctx, c }) {
  const w = c.width
  const h = c.height
  frame(ctx, w, h, 'SISTEMAS')
  const sh = game.shield / CONFIG.maxShield
  ctx.fillStyle = sh > 0.5 ? '#3fe0ff' : sh > 0.25 ? '#ffb020' : '#ff3a3a'
  ctx.fillRect(12, 40, (w - 24) * sh, 22)
  ctx.strokeStyle = '#5fe6ff'
  ctx.strokeRect(12, 40, w - 24, 22)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 15px monospace'
  ctx.fillText(`ESCUDO ${Math.ceil(game.shield)}%`, 16, 57)
  ctx.fillStyle = '#ffb347'
  ctx.fillRect(12, 72, (w - 24) * game.boost, 10)
  ctx.fillStyle = '#cfe6ff'
  ctx.font = '14px monospace'
  ctx.fillText(`MÍSSEIS ${game.missiles}   BOMBAS ${game.bombs}`, 12, 106)
  ctx.fillText(`ARMA NÍVEL ${game.weaponLevel + 1}`, 12, 128)
  if (game.droneTime > 0) ctx.fillText(`DRONE ${Math.ceil(game.droneTime)}s`, 12, 148)
}

// Tela direita: velocidade, altitude e ameaças
function drawFlight({ ctx, c }) {
  const w = c.width
  const h = c.height
  frame(ctx, w, h, 'VOO')
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 30px monospace'
  ctx.fillText(`${Math.round(game.speed * 7.2)}`, 14, 72)
  ctx.font = '14px monospace'
  ctx.fillStyle = '#5fe6ff'
  ctx.fillText('km/h', 150, 72)
  const surf = game.stage === 'surface'
  ctx.fillStyle = '#cfe6ff'
  ctx.fillText(surf ? `ALT ${Math.round((game.shipPos.y - game.ground) * 2)} m` : 'EM ÓRBITA', 14, 102)
  const n = collectTargets().length
  ctx.fillStyle = n ? '#ff5a4a' : '#5dff8a'
  ctx.fillText(n ? `AMEAÇAS: ${n}` : 'SETOR LIMPO', 14, 126)
  if (game.assist) {
    ctx.fillStyle = '#ff5a4a'
    ctx.fillText('◆ ALVO TRAVADO', 14, 148)
  }
}

// Tela central: radar visto de cima (nariz para cima)
const rel = new THREE.Vector3()
function drawRadar({ ctx, c }) {
  const S = c.width
  ctx.fillStyle = '#03141c'
  ctx.fillRect(0, 0, S, S)
  ctx.strokeStyle = 'rgba(90,230,255,0.5)'
  ctx.lineWidth = 2
  for (const f of [0.95, 0.63, 0.31]) {
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, (S / 2) * f, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#7cf3ff'
  ctx.beginPath()
  ctx.moveTo(S / 2, S / 2 - 8)
  ctx.lineTo(S / 2 - 6, S / 2 + 6)
  ctx.lineTo(S / 2 + 6, S / 2 + 6)
  ctx.fill()
  for (const t of collectTargets()) {
    // Posição no espaço da nave: x = direita, z = trás (−z = à frente → para cima na tela)
    rel.subVectors(t.pos, game.shipPos).applyQuaternion(game.shipQuatInv)
    const d = Math.min(1, rel.length() / 480)
    const flat = Math.hypot(rel.x, rel.z) || 1
    ctx.fillStyle = t.kind === 'boss' ? '#ff4dff' : '#ff4a4a'
    ctx.beginPath()
    ctx.arc(S / 2 + (rel.x / flat) * d * (S / 2 - 8), S / 2 + (rel.z / flat) * d * (S / 2 - 8), t.r > 3.5 ? 6 : 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

const Cockpit = forwardRef(function Cockpit(_, ref) {
  const left = useScreen(drawStatus)
  const right = useScreen(drawFlight)
  const radar = useScreen(drawRadar, 200, 200)
  const timer = useRef(0)
  const warn = useRef()

  useFrame((state, dt) => {
    const g = ref.current
    if (!g || !g.visible) return
    // Redesenha as telas ~8 vezes por segundo (barato) e reenvia para a GPU
    timer.current -= dt
    if (timer.current <= 0) {
      timer.current = 0.12
      for (const s of [left, right, radar]) {
        s.draw(s)
        s.tex.needsUpdate = true
      }
    }
    // Luz de alerta pisca com escudo baixo
    if (warn.current) warn.current.visible = game.shield < 30 && Math.floor(state.clock.elapsedTime * 4) % 2 === 0
  })

  return (
    <group ref={ref} visible={false}>
      {/* Luz interna fraca para o painel não ficar todo preto */}
      <pointLight position={[0, 0.2, -0.4]} intensity={0.6} distance={3} color="#7fd8ff" />

      {/* Painel principal (levemente inclinado para o piloto) */}
      <group position={[0, -0.98, -1.1]} rotation={[-0.75, 0, 0]}>
        <mesh material={hull}>
          <boxGeometry args={[2.6, 0.9, 0.08]} />
        </mesh>
        <mesh material={trim} position={[0, 0.47, 0.02]}>
          <boxGeometry args={[2.62, 0.04, 0.1]} />
        </mesh>
        {/* Telas: status (esq.), radar (centro), voo (dir.) */}
        <mesh position={[-0.82, 0.02, 0.05]}>
          <planeGeometry args={[0.72, 0.45]} />
          <meshBasicMaterial map={left.tex} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.02, 0.05]}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial map={radar.tex} toneMapped={false} />
        </mesh>
        <mesh position={[0.82, 0.02, 0.05]}>
          <planeGeometry args={[0.72, 0.45]} />
          <meshBasicMaterial map={right.tex} toneMapped={false} />
        </mesh>
        {/* Botões e LEDs */}
        {[-1.15, -1.05, 1.05, 1.15].map((x, i) => (
          <mesh key={x} position={[x, -0.3, 0.05]} material={i % 2 ? glowAmber : glowCyan}>
            <boxGeometry args={[0.06, 0.03, 0.02]} />
          </mesh>
        ))}
        <mesh ref={warn} position={[0, -0.36, 0.05]} material={glowRed} visible={false}>
          <boxGeometry args={[0.5, 0.05, 0.02]} />
        </mesh>
      </group>

      {/* Colunas da cabine (montantes do canopi) */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={hull} position={[s * 1.3, -0.05, -1.15]} rotation={[0.25, 0, s * 0.42]}>
            <boxGeometry args={[0.05, 1.9, 0.05]} />
          </mesh>
          <mesh material={hull} position={[s * 1.55, -0.45, -0.6]}>
            <boxGeometry args={[0.35, 0.9, 1.4]} />
          </mesh>
        </group>
      ))}
      {/* Arco superior do canopi */}
      <mesh material={hull} position={[0, 0.88, -1.0]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[1.5, 0.06, 0.06]} />
      </mesh>
      <mesh material={trim} position={[0, 0.92, -0.85]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.06, 0.6, 0.05]} />
      </mesh>

      {/* Vidro da mira (refletor do HUD): só a moldura e um reflexo bem fraco */}
      <mesh position={[0, -0.36, -1.15]} rotation={[-0.2, 0, 0]} material={glass}>
        <planeGeometry args={[0.34, 0.2]} />
      </mesh>
      <mesh position={[0, -0.47, -1.17]} rotation={[-0.2, 0, 0]} material={trim}>
        <boxGeometry args={[0.36, 0.025, 0.04]} />
      </mesh>
    </group>
  )
})

export default Cockpit
