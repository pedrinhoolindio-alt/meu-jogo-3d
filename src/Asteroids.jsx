// src/Asteroids.jsx
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, BOUNDS, CONFIG } from './gameState'

const MAX = 50
const { randFloat, randFloatSpread } = THREE.MathUtils

const dummy = new THREE.Object3D()
const astBox = new THREE.Box3()
const laserBox = new THREE.Box3()
const shipBox = new THREE.Box3()
const SHIP_HALF = new THREE.Vector3(2.9, 0.6, 1.6) // meia-largura/altura/profundidade da nave

// Textura de rocha gerada em canvas (sem precisar de arquivo de imagem)
function makeRockTexture() {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#6b6258'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 900; i++) {
    const g = (50 + Math.random() * 90) | 0
    ctx.fillStyle = `rgb(${g},${(g * 0.93) | 0},${(g * 0.85) | 0})`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export default function Asteroids() {
  const mesh = useRef()
  const timer = useRef(0)
  const texture = useMemo(makeRockTexture, [])

  const pool = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        active: false,
        pos: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(), // velocidade angular (rad/s) em cada eixo
        radius: 1,
        speed: 30,
      })),
    []
  )

  function spawn() {
    const a = pool.find((p) => !p.active)
    if (!a) return
    a.radius = randFloat(1.2, 3.2)
    // Nasce bem à frente, espalhado um pouco além do quadrado da nave
    a.pos.set(randFloatSpread(BOUNDS.x * 3.2), randFloatSpread(BOUNDS.y * 3.2), CONFIG.asteroidSpawnZ)
    a.speed = randFloat(CONFIG.asteroidSpeed[0], CONFIG.asteroidSpeed[1])
    a.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    a.spin.set(randFloatSpread(2), randFloatSpread(2), randFloatSpread(2))
    a.active = true
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    // Spawn contínuo por intervalo de tempo
    timer.current += dt
    while (timer.current > CONFIG.asteroidSpawnInterval) {
      timer.current -= CONFIG.asteroidSpawnInterval
      spawn()
    }

    // Caixa da nave (AABB centrada na posição da nave)
    shipBox.min.copy(game.shipPos).sub(SHIP_HALF)
    shipBox.max.copy(game.shipPos).add(SHIP_HALF)

    for (let i = 0; i < MAX; i++) {
      const a = pool[i]

      if (a.active) {
        // O "cenário se move": asteroide vem em +Z na direção da câmera
        a.pos.z += a.speed * dt
        a.rot.x += a.spin.x * dt
        a.rot.y += a.spin.y * dt
        a.rot.z += a.spin.z * dt

        if (a.pos.z > CONFIG.asteroidDespawnZ) a.active = false
      }

      if (a.active) {
        // ---- AABB do asteroide: centro ± raio em cada eixo ----
        astBox.min.set(a.pos.x - a.radius, a.pos.y - a.radius, a.pos.z - a.radius)
        astBox.max.set(a.pos.x + a.radius, a.pos.y + a.radius, a.pos.z + a.radius)

        // ---- Laser x Asteroide ----
        for (const l of game.lasers) {
          if (!l.active) continue
          // A caixa do laser cobre o segmento entre a posição anterior e a atual.
          // Isso evita "tunneling": a 140 u/s o laser anda ~2,3 unidades por frame
          // e poderia atravessar um asteroide pequeno sem nunca estar "dentro" dele.
          laserBox.makeEmpty().expandByPoint(l.prev).expandByPoint(l.pos)
          if (laserBox.intersectsBox(astBox)) {
            a.active = false
            l.active = false
            game.score += 10
            break
          }
        }

        // ---- Nave x Asteroide ----
        if (a.active && shipBox.intersectsBox(astBox)) {
          a.active = false
          game.hits += 1
        }
      }

      if (a.active) {
        dummy.position.copy(a.pos)
        dummy.rotation.copy(a.rot)
        dummy.scale.setScalar(a.radius) // geometria tem raio 1 → escala = raio
      } else {
        dummy.scale.setScalar(0)
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, MAX]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} color="#a89c8c" roughness={0.95} metalness={0.05} flatShading />
    </instancedMesh>
  )
}
