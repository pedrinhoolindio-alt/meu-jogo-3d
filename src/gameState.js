// src/gameState.js
// Estado global MUTÁVEL do jogo (fora do React de propósito).
// Atualizar isto a 60fps via useState causaria re-render a cada frame;
// com objetos mutáveis, o useFrame lê/escreve direto, sem custo de render.
import * as THREE from 'three'
import { sfx } from './audio'

// "Quadrado" imaginário em que a nave pode se mover (unidades do mundo, centrado em 0,0)
export const BOUNDS = { x: 9, y: 5 }

export const CONFIG = {
  // --- Nave ---
  shipFollow: 6, // taxa de aproximação da nave ao alvo (maior = mais responsiva / menos "peso")
  keyboardSpeed: 14, // velocidade com que WASD move o alvo (unidades/seg)
  maxShield: 100,
  invulnTime: 0.8, // segundos invulnerável após levar dano

  // --- Câmera ---
  cameraFollow: 3, // taxa do lerp da câmera (menor = mais atraso / mais "peso")
  cameraOffset: new THREE.Vector3(0, 2.8, 11), // atrás (+Z) e acima (+Y) da nave
  cameraParallax: 0.55, // 0 = câmera parada no centro, 1 = acompanha 100% o X/Y da nave

  // --- Mira ---
  aimDistance: 45, // distância (em -Z) do plano da mira
  aimLead: 1.6, // quanto a mira "abre" além da posição da nave (estilo on-rails)

  // --- Lasers ---
  laserSpeed: 170, // unidades/seg
  laserMaxDistance: 260, // após percorrer isso, o laser é reciclado
  fireCooldown: [0.13, 0.12, 0.09], // segundos entre rajadas, por nível de arma

  // --- Manobras ---
  boostMul: 1.8, // multiplicador da velocidade do cenário no turbo
  boostDrain: 0.5, // quanto do medidor o turbo gasta por segundo
  boostRegen: 0.18, // quanto o medidor recarrega por segundo
  rollDuration: 0.55, // duração do giro evasivo (Q/E)
  rollCooldown: 0.9,
  bombRadius: 24,

  // --- Mundo ---
  worldSpeed: 60, // velocidade da "poeira espacial" (sensação de avanço)
  comboWindow: 2.5, // segundos para manter o combo vivo
}

// Posição LOCAL (em relação à nave) da ponta dos 4 canhões.
// Pares: [0,1] = pontas das asas, [2,3] = canhões internos (junto aos motores).
export const CANNONS = [
  new THREE.Vector3(2.6, 0.1, -1.4), // asa direita
  new THREE.Vector3(-2.6, 0.1, -1.4), // asa esquerda
  new THREE.Vector3(0.9, -0.15, -2.6), // interno direito
  new THREE.Vector3(-0.9, -0.15, -2.6), // interno esquerdo
]

// Tipos de inimigos da Armada Escarlate
export const ENEMY_TYPES = {
  fighter: { name: 'Vespa', hp: 3, radius: 1.9, score: 100, speed: 55, fireEvery: 1.7, boltSpeed: 70 },
  interceptor: { name: 'Lança', hp: 2, radius: 1.6, score: 150, speed: 78, fireEvery: 1.4, boltSpeed: 85 },
  bomber: { name: 'Martelo', hp: 12, radius: 2.8, score: 400, speed: 32, fireEvery: 2.6, boltSpeed: 42 },
}

// Roteiro da missão. quota = abates necessários para avançar.
export const WAVES = [
  { title: 'FASE 1', name: 'Cinturão de Kepler', quota: 10, mix: { fighter: 1 }, spawnEvery: 1.7, maxAlive: 4, asteroidEvery: 0.9 },
  { title: 'FASE 2', name: 'Linha de Bloqueio', quota: 16, mix: { fighter: 0.6, interceptor: 0.4 }, spawnEvery: 1.3, maxAlive: 6, asteroidEvery: 1.6 },
  { title: 'FASE 3', name: 'Ofensiva Escarlate', quota: 22, mix: { fighter: 0.45, interceptor: 0.3, bomber: 0.25 }, spawnEvery: 1.05, maxAlive: 8, asteroidEvery: 1.3 },
  { title: 'FASE FINAL', name: 'Fortaleza Korrath', boss: true, asteroidEvery: Infinity },
]

const noop = () => {}

export const game = {
  phase: 'title', // title | playing | paused | dying | gameover | victory
  keys: {}, // teclas pressionadas (KeyW, KeyA, Space...)
  target: new THREE.Vector2(0, 0), // posição X/Y DESEJADA da nave (mouse/WASD escrevem aqui)
  shipPos: new THREE.Vector3(), // posição real da nave
  shipQuat: new THREE.Quaternion(), // rotação real da nave (para posicionar os canhões com o roll)
  aim: new THREE.Vector3(0, 0, -45), // ponto da mira no mundo

  // Pools e funções registrados pelos componentes quando montam
  playerLasers: [],
  enemies: [],
  asteroids: [],
  boss: null,
  fx: { explode: noop, sparks: noop, shockwave: noop },
  firePlayerLaser: noop,
  fireEnemyLaser: noop,
  clearEnemyLasers: noop,
  spawnEnemy: noop,
  damageEnemy: noop,
  destroyAsteroid: noop,
  spawnPickup: noop,
  startBoss: noop,
  damageBossArea: noop,
}

// Zera tudo para uma nova partida (os pools são recriados pelo remount do <World/>)
export function resetGame() {
  Object.assign(game, {
    phase: 'title',
    time: 0,
    timeScale: 1, // < 1 = câmera lenta
    worldMul: 1, // multiplicador de velocidade do cenário (turbo)
    wantsToFire: false,
    wantsBomb: false,
    rollRequest: 0,
    rollTimer: 0,
    rollDir: 1,
    rollCooldown: 0,
    boosting: false,
    boost: 1,
    shield: CONFIG.maxShield,
    invuln: 1.5,
    damageFlash: 0,
    shake: 0,
    hitMarker: 0,
    bombs: 3,
    weaponLevel: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    waveIndex: 0,
    waveKills: 0,
    waveBreak: 3,
    asteroidEvery: WAVES[0].asteroidEvery,
    bossDefeated: false,
    deathTimer: 0,
    stats: { shots: 0, hits: 0 },
    events: [], // fila de acontecimentos lida pelo Director (rádio, dicas...)
  })
  game.target.set(0, 0)
  game.keys = {}
}
resetGame()

// ---------------------------------------------------------------------------
// Utilitários de matemática
// ---------------------------------------------------------------------------
export const rand = (a, b) => a + Math.random() * (b - a)

/**
 * Lerp independente de FPS.
 * Um lerp fixo (ex: 0.1) roda mais rápido a 144fps que a 60fps.
 * Com t = 1 - e^(-k·dt), a fração percorrida depende só do tempo real:
 *   k maior → alcança o alvo mais rápido. Ex: k=6 → ~95% do caminho em 0,5s.
 */
export const damp = (k, dt) => 1 - Math.exp(-k * dt)

// Delta de tempo do jogo: 0 quando pausado/no menu; aplica câmera lenta (timeScale).
// O mínimo de 0.0001 evita divisões por zero (delta = 0 no 1º frame).
export function frameDt(delta) {
  if (game.phase === 'paused' || game.phase === 'title') return 0
  return Math.min(Math.max(delta, 0.0001), 0.05) * game.timeScale
}

const _ab = new THREE.Vector3()
const _ac = new THREE.Vector3()
/**
 * Colisão segmento × esfera.
 * O laser anda vários metros por frame; testar só a ponta deixaria ele "atravessar" alvos
 * (tunneling). Então pegamos o segmento A→B percorrido no frame e calculamos o ponto dele
 * mais próximo do centro C:  t = ((C-A)·(B-A)) / |B-A|²  (limitado a 0..1)
 * Se a distância desse ponto até C for ≤ raio, houve acerto.
 */
export function segmentSphere(a, b, c, r) {
  _ab.subVectors(b, a)
  const len2 = _ab.lengthSq()
  let t = len2 > 0 ? _ac.subVectors(c, a).dot(_ab) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  _ac.copy(a).addScaledVector(_ab, t)
  return _ac.distanceToSquared(c) <= r * r
}

// A nave é larga e baixa: usamos um elipsoide (x²/a² + y²/b² + z²/c² ≤ 1) em vez de esfera
const SHIP_HALF = { x: 2.4, y: 0.75, z: 1.7 }
export function hitsShip(p, pad = 0) {
  const dx = (p.x - game.shipPos.x) / (SHIP_HALF.x + pad)
  const dy = (p.y - game.shipPos.y) / (SHIP_HALF.y + pad)
  const dz = (p.z - game.shipPos.z) / (SHIP_HALF.z + pad)
  return dx * dx + dy * dy + dz * dz <= 1
}

// ---------------------------------------------------------------------------
// Regras de jogo compartilhadas
// ---------------------------------------------------------------------------
export function damagePlayer(amount, kind = 'laser') {
  if (game.phase !== 'playing' || game.invuln > 0) return false
  // Durante o giro evasivo, lasers ricocheteiam
  if (kind === 'laser' && game.rollTimer > 0) {
    sfx.deflect()
    game.events.push({ type: 'deflect' })
    return false
  }
  game.shield = Math.max(0, game.shield - amount)
  game.invuln = CONFIG.invulnTime
  game.shake = Math.min(1.3, game.shake + amount / 22)
  game.damageFlash = 1
  game.combo = 0
  game.multiplier = 1
  sfx.hit()
  game.events.push({ type: 'hurt' })
  if (game.shield <= 0) killPlayer()
  return true
}

function killPlayer() {
  game.phase = 'dying'
  game.deathTimer = 0
  game.wantsToFire = false
  game.fx.explode(game.shipPos, { size: 2.8 })
  game.fx.shockwave(game.shipPos, 3)
  game.shake = 1.6
  sfx.explosion(true)
  game.events.push({ type: 'playerDown' })
}

// Pontuação com combo: a cada 5 abates seguidos o multiplicador sobe (máx. x5)
export function addScore(points, owner = 'player') {
  if (game.phase !== 'playing') return
  if (owner === 'player') {
    game.combo++
    game.maxCombo = Math.max(game.maxCombo, game.combo)
    game.comboTimer = CONFIG.comboWindow
    game.multiplier = Math.min(5, 1 + Math.floor(game.combo / 5))
    game.score += Math.round(points * game.multiplier)
    game.hitMarker = 1
  } else {
    game.score += Math.round(points * 0.5) // abates dos alas valem metade
  }
}

// Gancho de depuração (só existe quando o build é feito com VITE_DEBUG=1)
if (import.meta.env.VITE_DEBUG && typeof window !== 'undefined') window.__fenix = game
