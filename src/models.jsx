// src/models.jsx
// Naves 3D texturizadas (Quaternius Ultimate Spaceships Pack, CC0) + efeitos de motor.
// Os modelos originais apontam o nariz para +Z. O jogador gira 180° (nariz para -Z);
// os inimigos ficam como estão (vêm em direção ao jogador).
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { modelUrl, SHIPS } from './assets'

// Materiais compartilhados pelos efeitos e pelas peças feitas à mão (chefe, tiros...)
export const M = {
  dark: new THREE.MeshStandardMaterial({ color: '#3a3f47', metalness: 0.7, roughness: 0.35 }),
  engine: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.2, 0.6), toneMapped: false }),
  flame: new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 0.85, 2.2),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
  enemyFlame: new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.2, 0.5, 0.25),
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
  eHull: new THREE.MeshStandardMaterial({ color: '#2c3038', metalness: 0.75, roughness: 0.3 }),
  eArmor: new THREE.MeshStandardMaterial({ color: '#6a1c26', metalness: 0.55, roughness: 0.4 }),
  eGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.45, 0.3), toneMapped: false }),
  eEngine: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.7, 0.25), toneMapped: false, side: THREE.DoubleSide }),
}

// Chama do motor: cone com a base na origem para crescer só para trás ao escalar
export const flameGeo = new THREE.ConeGeometry(0.17, 1, 12, 1, true)
flameGeo.translate(0, 0.5, 0)

// Brilho redondo (sprite) usado no bocal dos motores
function glowTexture() {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}
let _glow = null
export const getGlow = () => (_glow ||= glowTexture())

// Ajusta os materiais do glTF uma única vez (metal com reflexo do mapa de ambiente)
const tuned = new WeakSet()
function tune(scene) {
  if (tuned.has(scene)) return
  tuned.add(scene)
  scene.traverse((o) => {
    if (o.isMesh && o.material) {
      const m = o.material
      // Os modelos trazem mapas PBR (normal + metal/rugosidade). Sem eles, usa valores fixos.
      if (!m.metalnessMap) {
        m.metalness = 0.55
        m.roughness = 0.42
      }
      if (m.normalMap) m.normalScale.set(1.2, 1.2)
      m.envMapIntensity = 1.6
      for (const t of [m.map, m.normalMap, m.metalnessMap]) if (t) t.anisotropy = 8
      o.castShadow = true
      o.receiveShadow = true
    }
  })
}

/**
 * Carrega um modelo, centraliza na origem e devolve um clone + posições dos motores.
 * Centralizar = subtrair o centro da caixa envolvente de todas as posições.
 */
export function useShip(key) {
  const { scene } = useGLTF(modelUrl(SHIPS[key]))
  return useMemo(() => {
    tune(scene)
    const obj = scene.clone(true)
    const box = new THREE.Box3().setFromObject(obj)
    const center = box.getCenter(new THREE.Vector3())
    obj.position.sub(center)
    const node = scene.children[0]
    const exhausts = ((node && node.userData && node.userData.exhausts) || []).map((e) => {
      const p = new THREE.Vector3(...e.pos).sub(center)
      p.z = Math.max(p.z, box.min.z - center.z + 0.2) // bocal colado na traseira do casco
      return { pos: p, size: e.pos[0] === 0 ? 1.1 : 0.9 }
    })
    return { obj, exhausts, size: box.getSize(new THREE.Vector3()) }
  }, [scene])
}

/**
 * Nave com motores acesos.
 *  - flipped: gira 180° (nariz para -Z, usado pelo jogador e alas)
 *  - flames: useRef([]) que recebe as chamas para o turbo alongá-las
 */
export function Ship({ kind, scale = 1, flipped = false, flames, flameMat = M.flame, glowColor = '#8fc8ff', engines = true, fog = true }) {
  const { obj, exhausts } = useShip(kind)
  // Naves muito distantes (cenário) ignoram a neblina para continuarem visíveis
  useMemo(() => {
    if (!fog) obj.traverse((o) => o.isMesh && (o.material.fog = false))
  }, [obj, fog])
  const glow = getGlow()
  return (
    <group scale={scale} rotation={[0, flipped ? Math.PI : 0, 0]}>
      <primitive object={obj} />
      {engines && exhausts.map((e, i) => (
        <group key={i} position={e.pos}>
          {/* Chama: +90° em X leva a ponta do cone de +Y para +Z; girada 180° aponta para trás */}
          <mesh
            ref={(el) => flames && (flames.current[i] = el)}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[e.size * 2.3, 1.4, e.size * 2.3]}
            geometry={flameGeo}
            material={flameMat}
          />
          <sprite scale={[e.size * 2.2, e.size * 2.2, 1]}>
            <spriteMaterial map={glow} color={glowColor} opacity={0.55} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={fog} />
          </sprite>
        </group>
      ))}
    </group>
  )
}

// Nave inimiga genérica (nariz para +Z), motores vermelhos
export const EnemyModel = ({ kind, scale }) => <Ship kind={kind} scale={scale} flameMat={M.enemyFlame} glowColor="#ff6040" />

// Pré-carrega tudo assim que o endereço dos modelos for conhecido
export function preloadShips() {
  Object.values(SHIPS).forEach((n) => useGLTF.preload(modelUrl(n)))
}
