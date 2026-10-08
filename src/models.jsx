// src/models.jsx
// Modelos das naves feitos só com primitivas (cones, caixas, cilindros).
// Convenções: a nave do jogador aponta para -Z; os inimigos apontam para +Z (em direção ao jogador).
import * as THREE from 'three'

// Materiais compartilhados (criados uma vez só)
export const M = {
  hull: new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 0.45, roughness: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: '#3a3f47', metalness: 0.6, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: '#0b1a33', metalness: 0.9, roughness: 0.1, emissive: '#0a2a55', emissiveIntensity: 0.6 }),
  engine: new THREE.MeshStandardMaterial({ color: '#ff7a2f', emissive: '#ff6a1f', emissiveIntensity: 3, toneMapped: false }),
  flame: new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.8, 0.8, 0.35),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
  tip: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3), toneMapped: false }),
  // Armada Escarlate
  eHull: new THREE.MeshStandardMaterial({ color: '#2c3038', metalness: 0.7, roughness: 0.35 }),
  eArmor: new THREE.MeshStandardMaterial({ color: '#6a1c26', metalness: 0.5, roughness: 0.45 }),
  eGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.45, 0.3), toneMapped: false }),
  eEngine: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.7, 0.25), toneMapped: false, side: THREE.DoubleSide }),
}

const stripeCache = {}
export function stripeMat(color) {
  if (!stripeCache[color]) stripeCache[color] = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.55 })
  return stripeCache[color]
}

// Chama do motor: cone com a base na origem (translate) para crescer só para trás ao escalar
export const flameGeo = new THREE.ConeGeometry(0.17, 1, 10, 1, true)
flameGeo.translate(0, 0.5, 0)

const WINGS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]

/**
 * Caça do Esquadrão Fênix (jogador e alas).
 * `flames` (useRef([])) recebe as malhas das chamas para o turbo alongá-las.
 */
export function PlayerShip({ stripe = '#b3261e', flames }) {
  const st = stripeMat(stripe)
  return (
    <group>
      {/* Nariz: cone girado -90° em X → ponta passa de +Y para -Z */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} material={M.hull}>
        <coneGeometry args={[0.35, 2.6, 8]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.55]} material={st}>
        <cylinderGeometry args={[0.36, 0.38, 0.35, 8]} />
      </mesh>
      {/* Fuselagem */}
      <mesh position={[0, 0, 0.6]} material={M.hull}>
        <boxGeometry args={[0.75, 0.6, 2.2]} />
      </mesh>
      <mesh position={[0, -0.32, 0.6]} material={M.dark}>
        <boxGeometry args={[0.55, 0.12, 1.8]} />
      </mesh>
      {/* Cabine */}
      <mesh position={[0, 0.36, 0]} material={M.glass}>
        <boxGeometry args={[0.42, 0.22, 0.9]} />
      </mesh>
      {/* Droide astromecânico */}
      <mesh position={[0, 0.38, 0.9]} material={M.dark}>
        <sphereGeometry args={[0.18, 12, 8]} />
      </mesh>

      {/* 4 asas em "X": sx = lado (±1), sy = cima/baixo (±1) */}
      {WINGS.map(([sx, sy], i) => (
        <group key={i} position={[sx * 1.6, sy * 0.25, 0.7]} rotation={[0, 0, sx * sy * 0.2]}>
          <mesh material={M.hull}>
            <boxGeometry args={[2.6, 0.08, 1.1]} />
          </mesh>
          <mesh position={[sx * 0.6, 0.05, 0]} material={st}>
            <boxGeometry args={[0.5, 0.02, 1.0]} />
          </mesh>
          {/* Canhão na ponta da asa */}
          <mesh position={[sx * 1.3, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={M.dark}>
            <cylinderGeometry args={[0.05, 0.05, 1.8, 6]} />
          </mesh>
          <mesh position={[sx * 1.3, 0, -1.12]} material={M.tip}>
            <sphereGeometry args={[0.06, 6, 4]} />
          </mesh>
          {/* Motor */}
          <mesh position={[-sx * 1.05, sy * 0.12, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={M.dark}>
            <cylinderGeometry args={[0.2, 0.2, 1.5, 10]} />
          </mesh>
          <mesh position={[-sx * 1.05, sy * 0.12, 1.06]} material={M.engine}>
            <circleGeometry args={[0.17, 12]} />
          </mesh>
          {/* Chama: rotação +90° em X leva a ponta do cone de +Y para +Z (para trás) */}
          <mesh
            ref={(el) => flames && (flames.current[i] = el)}
            position={[-sx * 1.05, sy * 0.12, 1.06]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={flameGeo}
            material={M.flame}
          />
        </group>
      ))}
    </group>
  )
}

// Caça "Vespa": corpo em losango e lâminas inclinadas para a frente
export function FighterModel() {
  return (
    <group>
      <mesh material={M.eHull} scale={[0.9, 0.55, 1.7]}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh position={[0, 0.28, 0.55]} material={M.eGlow} scale={[0.5, 0.1, 0.45]}>
        <boxGeometry />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.1, 0, -0.2]} rotation={[0, s * 0.5, s * 0.15]}>
          <mesh material={M.eArmor}>
            <boxGeometry args={[2.2, 0.1, 1.0]} />
          </mesh>
          <mesh position={[s * 1.1, 0, 0.3]} material={M.eHull}>
            <boxGeometry args={[0.15, 0.7, 1.4]} />
          </mesh>
          <mesh position={[s * 1.1, 0.4, 0.95]} material={M.eGlow}>
            <sphereGeometry args={[0.1, 8, 6]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0, -1.65]} rotation={[0, Math.PI, 0]} material={M.eEngine}>
        <circleGeometry args={[0.32, 12]} />
      </mesh>
    </group>
  )
}

// Interceptador "Lança": dardo comprido com três aletas
export function InterceptorModel() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={M.eHull}>
        <coneGeometry args={[0.55, 3.6, 6]} />
      </mesh>
      <mesh position={[0, 0.32, 0.2]} material={M.eGlow} scale={[0.22, 0.08, 0.8]}>
        <boxGeometry />
      </mesh>
      {[Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6].map((a, i) => (
        <group key={i} rotation={[0, 0, a - Math.PI / 2]}>
          <mesh position={[0, 0.95, -1.2]} material={M.eArmor}>
            <boxGeometry args={[0.08, 1.4, 1.0]} />
          </mesh>
          <mesh position={[0, 1.62, -0.75]} material={M.eGlow}>
            <sphereGeometry args={[0.08, 6, 4]} />
          </mesh>
        </group>
      ))}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0, -1.82]} rotation={[0, Math.PI, 0]} material={M.eEngine}>
          <circleGeometry args={[0.18, 10]} />
        </mesh>
      ))}
    </group>
  )
}

// Bombardeiro "Martelo": corpo largo, dois casulos e canhão frontal
export function BomberModel() {
  return (
    <group>
      <mesh material={M.eHull}>
        <boxGeometry args={[3.2, 0.9, 2.6]} />
      </mesh>
      <mesh position={[0, 0.55, -0.1]} material={M.eArmor}>
        <boxGeometry args={[2.2, 0.35, 2.0]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 2.1, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.eArmor}>
            <cylinderGeometry args={[0.55, 0.55, 3.4, 10]} />
          </mesh>
          <mesh position={[s * 2.1, 0, 1.72]} material={M.eGlow} scale={[0.6, 0.6, 1]}>
            <circleGeometry args={[0.5, 10]} />
          </mesh>
          <mesh position={[s * 2.1, 0, -1.72]} rotation={[0, Math.PI, 0]} material={M.eEngine}>
            <circleGeometry args={[0.45, 12]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.2, 1.7]} rotation={[Math.PI / 2, 0, 0]} material={M.eHull}>
        <cylinderGeometry args={[0.18, 0.28, 1.2, 8]} />
      </mesh>
      {[-1.1, -0.55, 0, 0.55, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.1, 1.32]} material={M.eGlow}>
          <boxGeometry args={[0.25, 0.1, 0.05]} />
        </mesh>
      ))}
    </group>
  )
}
