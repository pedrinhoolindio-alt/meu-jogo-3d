// src/Lasers.jsx
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, CANNONS } from './gameState'

const MAX = 80 // tamanho do pool (máximo de lasers simultâneos)
const UP = new THREE.Vector3(0, 1, 0) // eixo "natural" do CylinderGeometry
const dummy = new THREE.Object3D() // objeto auxiliar para montar a matriz de cada instância
const spawn = new THREE.Vector3()

export default function Lasers() {
  const mesh = useRef()
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
        traveled: 0, // distância percorrida
      })),
    []
  )

  useEffect(() => {
    game.lasers = pool // expõe o pool para o Asteroids.jsx checar colisão
  }, [pool])

  function fire() {
    const base = pair.current * 2
    for (let i = 0; i < 2; i++) {
      const l = pool.find((p) => !p.active)
      if (!l) return

      // Posição do canhão no MUNDO:
      //   offset local → aplica a rotação da nave (quaternion) → soma a posição da nave
      // Assim o tiro sai da ponta da asa mesmo com a nave inclinada (roll).
      spawn.copy(CANNONS[base + i]).applyQuaternion(game.shipQuat).add(game.shipPos)

      // Direção = (mira - origem) normalizada.
      // Os dois canhões convergem para o mesmo ponto da mira.
      l.dir.subVectors(game.aim, spawn).normalize()

      l.pos.copy(spawn)
      l.prev.copy(spawn)
      l.traveled = 0
      l.active = true
    }
    pair.current = 1 - pair.current // alterna o par (cima/baixo)
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    // Disparo contínuo enquanto segura o botão/espaço, respeitando o cooldown
    cooldown.current -= dt
    if (game.wantsToFire && cooldown.current <= 0) {
      fire()
      cooldown.current = CONFIG.fireCooldown
    }

    const step = CONFIG.laserSpeed * dt // distância percorrida neste frame

    for (let i = 0; i < MAX; i++) {
      const l = pool[i]

      if (l.active) {
        l.prev.copy(l.pos)
        // Movimento retilíneo: pos = pos + dir * (velocidade * dt)
        l.pos.addScaledVector(l.dir, step)
        l.traveled += step
        // Destrói (recicla) após a distância máxima
        if (l.traveled > CONFIG.laserMaxDistance) l.active = false
      }

      if (l.active) {
        dummy.position.copy(l.pos)
        // Gira o cilindro (que nasce apontando para +Y) para alinhar com a direção do tiro
        dummy.quaternion.setFromUnitVectors(UP, l.dir)
        dummy.scale.setScalar(1)
      } else {
        dummy.scale.setScalar(0) // instância "escondida"
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    // InstancedMesh: 1 draw call para todos os lasers
    <instancedMesh ref={mesh} args={[null, null, MAX]} frustumCulled={false}>
      <cylinderGeometry args={[0.06, 0.06, 2.4, 6]} />
      {/* MeshBasicMaterial não reage à luz → aparência "emissiva". toneMapped=false deixa o vermelho saturado */}
      <meshBasicMaterial color={[3, 0.25, 0.2]} toneMapped={false} />
    </instancedMesh>
  )
}
