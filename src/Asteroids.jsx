// src/Asteroids.jsx
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, BOUNDS, frameDt, rand, segmentSphere, hitsShip, damagePlayer, addScore } from './gameState'
import { sfx } from './audio'

const MAX = 40
const SPAWN_Z = -240
const { randFloatSpread } = THREE.MathUtils
const dummy = new THREE.Object3D()

// Textura de rocha gerada em canvas (sem precisar de arquivo de imagem)
function makeRockTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#6b6258'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 2200; i++) {
    const g = (45 + Math.random() * 100) | 0
    ctx.fillStyle = `rgb(${g},${(g * 0.92) | 0},${(g * 0.84) | 0})`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 5, 0, Math.PI * 2)
    ctx.fill()
  }
  // Crateras
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 3 + Math.random() * 12
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(20,16,12,0.7)')
    grd.addColorStop(1, 'rgba(20,16,12,0)')
    ctx.fillStyle = grd
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
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
        shape: new THREE.Vector3(1, 1, 1), // escala não uniforme → rochas irregulares
        radius: 1,
        hp: 1,
        speed: 30,
      })),
    []
  )

  function spawn() {
    const a = pool.find((p) => !p.active)
    if (!a) return
    a.radius = rand(1.2, 3.4)
    a.hp = Math.ceil(a.radius * 0.9)
    a.pos.set(randFloatSpread(BOUNDS.x * 3.4), randFloatSpread(BOUNDS.y * 3.4), SPAWN_Z)
    a.speed = rand(30, 55)
    a.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    a.spin.set(randFloatSpread(2), randFloatSpread(2), randFloatSpread(2))
    a.shape.set(rand(0.8, 1.2), rand(0.7, 1.1), rand(0.8, 1.25))
    a.active = true
  }

  function destroy(a, owner) {
    if (!a.active) return
    a.active = false
    game.fx.explode(a.pos, { size: a.radius * 0.55, palette: 'rock' })
    sfx.explosion(false)
    if (owner === 'player') addScore(25, 'player')
    if (Math.random() < 0.05) game.spawnPickup('shield', a.pos)
  }

  useEffect(() => {
    game.asteroids = pool
    game.destroyAsteroid = destroy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

  useFrame((_, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    const playing = game.phase === 'playing'

    // Spawn contínuo; o intervalo vem da fase atual (Director)
    if (playing && Number.isFinite(game.asteroidEvery)) {
      timer.current += dt
      while (timer.current > game.asteroidEvery) {
        timer.current -= game.asteroidEvery
        spawn()
      }
    }

    for (let i = 0; i < MAX; i++) {
      const a = pool[i]
      if (a.active) {
        // O "cenário se move": asteroide vem em +Z (o turbo acelera tudo)
        a.pos.z += a.speed * game.worldMul * dt
        a.rot.x += a.spin.x * dt
        a.rot.y += a.spin.y * dt
        a.rot.z += a.spin.z * dt
        if (a.pos.z > 20) a.active = false
      }

      if (a.active) {
        // ---- Laser x Asteroide (segmento x esfera) ----
        for (const l of game.playerLasers) {
          if (!l.active) continue
          if (segmentSphere(l.prev, l.pos, a.pos, a.radius)) {
            l.active = false
            a.hp -= l.dmg
            game.fx.sparks(l.pos, 'orange', 4)
            if (a.hp <= 0) {
              destroy(a, l.owner)
              break
            }
          }
        }
        // ---- Nave x Asteroide ----
        if (a.active && playing && hitsShip(a.pos, a.radius * 0.75)) {
          damagePlayer(20, 'ram')
          destroy(a, 'ram')
        }
      }

      if (a.active) {
        dummy.position.copy(a.pos)
        dummy.rotation.copy(a.rot)
        dummy.scale.copy(a.shape).multiplyScalar(a.radius) // geometria tem raio 1 → escala = raio
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
      <meshStandardMaterial map={texture} color="#b0a291" roughness={0.95} metalness={0.05} flatShading />
    </instancedMesh>
  )
}
