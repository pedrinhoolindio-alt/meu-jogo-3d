// src/gameState.js
// Estado global MUTÁVEL do jogo (fora do React de propósito).
// Atualizar isto a 60fps via useState causaria re-render a cada frame;
// com objetos mutáveis, o useFrame lê/escreve direto, sem custo de render.
import * as THREE from 'three'
import { sfx } from './audio'

export const CONFIG = {
  // --- Voo livre 360° ---
  flySpeed: 44, // velocidade de cruzeiro (unidades/seg). 1 unidade ≈ 2 metros
  boostSpeed: 88, // velocidade no turbo
  yawRate: 1.35, // rad/s máximos de guinada (virar para os lados)
  pitchRate: 1.6, // rad/s máximos de arfagem (subir/descer o nariz)
  turnResponse: 5, // quão rápido o comando chega ao máximo (maior = mais "nervosa")
  autoLevel: 1.4, // força que desvira a nave para ficar com as asas niveladas
  mouseDeadzone: 0.07, // zona morta no centro da tela (fração da tela)
  arenaRadius: 750, // no espaço: além disso a nave é guiada de volta
  surfaceRadius: 2300, // na atmosfera: raio da área de combate sobre a cidade
  minAltitude: 22, // altura mínima sobre o solo (subfase planetária)
  maxAltitude: 950,
  maxShield: 100,
  invulnTime: 0.8, // segundos invulnerável após levar dano

  // --- Câmera de perseguição ---
  cameraFollow: 4.5, // taxa do slerp da rotação da câmera (menor = mais atraso / mais "peso")
  cameraOffset: new THREE.Vector3(0, 3.1, 12.5), // atrás (+Z local) e acima (+Y local) da nave
  cameraBackOffset: new THREE.Vector3(0, 3.4, -15), // olhar para trás (V)

  // --- Mira ---
  aimDistance: 90, // distância à frente onde os canhões convergem
  assistAngle: 0.11, // rad (~6°): inimigo dentro desse cone recebe a mira automática
  assistRange: 340,

  // --- Lasers ---
  laserSpeed: 190, // unidades/seg
  laserMaxDistance: 420, // após percorrer isso, o laser é reciclado
  fireCooldown: [0.13, 0.12, 0.09, 0.1, 0.065], // segundos entre rajadas, por nível de arma
  maxWeaponLevel: 4,
  missileSpeed: 95,
  missileTurn: 4.2, // rad/s de correção de rumo do míssil teleguiado
  droneDuration: 25, // segundos de duração do drone de escolta

  // --- Manobras ---
  boostDrain: 0.42, // quanto do medidor o turbo gasta por segundo
  boostRegen: 0.16, // quanto o medidor recarrega por segundo
  rollDuration: 0.55, // duração do giro evasivo (Q/E)
  rollCooldown: 0.9,
  bombRadius: 30,

  comboWindow: 3, // segundos para manter o combo vivo
  entryDuration: 5.2, // duração da cinemática de entrada na atmosfera
}

// Posição LOCAL (em relação à nave) da ponta dos 4 canhões.
// Pares: [0,1] = pontas das asas, [2,3] = canhões internos (junto aos motores).
export const CANNONS = [
  new THREE.Vector3(2.6, 0.1, -1.4), // asa direita
  new THREE.Vector3(-2.6, 0.1, -1.4), // asa esquerda
  new THREE.Vector3(0.9, -0.15, -2.6), // interno direito
  new THREE.Vector3(-0.9, -0.15, -2.6), // interno esquerdo
]

// ---------------------------------------------------------------------------
// Frota da Armada do Caos
//  ai: dogfight (passa atirando e faz a volta) · hunt (persegue e colide)
//      standoff (fica a uma distância "range" circulando e atirando) · strafe (passadas laterais)
//  weapon: single · twin · triple · fan3 · fan5 · seeker (plasma teleguiado) · charge (tiro carregado)
//          launch (lança naves menores, tipo em "spawns")
//  turn: rad/s máximos de curva (menor = nave pesada)
// ---------------------------------------------------------------------------
export const ENEMY_TYPES = {
  fighter: { name: 'Vespa', model: 'fighter', scale: 0.42, hp: 3, radius: 2, score: 100, speed: 46, turn: 1.5, ai: 'dogfight', fireEvery: 1.1, boltSpeed: 95, weapon: 'twin' },
  interceptor: { name: 'Lança', model: 'interceptor', scale: 0.4, hp: 2, radius: 1.8, score: 150, speed: 62, turn: 1.9, ai: 'dogfight', fireEvery: 0.9, boltSpeed: 105, weapon: 'single' },
  kamikaze: { name: 'Agulha', model: 'kamikaze', scale: 0.3, hp: 1.5, radius: 1.7, score: 120, speed: 58, turn: 2.2, ai: 'hunt', fireEvery: Infinity, boltSpeed: 0, weapon: 'none' },
  swarm: { name: 'Enxame', model: 'swarm', scale: 0.27, hp: 1, radius: 1.5, score: 90, speed: 70, turn: 2.6, ai: 'hunt', fireEvery: Infinity, boltSpeed: 0, weapon: 'none' },
  ace: { name: 'Espectro', model: 'ace', scale: 0.44, hp: 6, radius: 2, score: 450, speed: 64, turn: 2.4, ai: 'dogfight', fireEvery: 0.65, boltSpeed: 115, weapon: 'triple' },
  raptor: { name: 'Raptor', model: 'raptor', scale: 0.46, hp: 7, radius: 2, score: 400, speed: 56, turn: 1.8, ai: 'dogfight', fireEvery: 0.8, boltSpeed: 110, weapon: 'twin' },
  corsair: { name: 'Corsário', model: 'corsair', scale: 0.5, hp: 8, radius: 2.8, score: 300, speed: 40, turn: 1.1, ai: 'strafe', fireEvery: 1.2, boltSpeed: 90, weapon: 'twin' },
  sniper: { name: 'Ferrão', model: 'sniper', scale: 0.42, hp: 5, radius: 2.2, score: 300, speed: 34, turn: 1, ai: 'standoff', range: 150, fireEvery: 3.6, boltSpeed: 190, weapon: 'charge' },
  lancer: { name: 'Arpão', model: 'lancer', scale: 0.45, hp: 7, radius: 2.3, score: 450, speed: 38, turn: 1, ai: 'standoff', range: 175, fireEvery: 3.2, boltSpeed: 210, weapon: 'charge' },
  bomber: { name: 'Martelo', model: 'bomber', scale: 0.6, hp: 12, radius: 3, score: 400, speed: 28, turn: 0.7, ai: 'standoff', range: 110, fireEvery: 2.6, boltSpeed: 55, weapon: 'fan3' },
  gunship: { name: 'Ômega', model: 'gunship', scale: 0.48, hp: 9, radius: 2.8, score: 350, speed: 32, turn: 0.8, ai: 'standoff', range: 90, fireEvery: 2.3, boltSpeed: 75, weapon: 'fan5' },
  warden: { name: 'Sentinela', model: 'warden', scale: 0.56, hp: 18, radius: 3.4, score: 550, speed: 30, turn: 0.8, ai: 'standoff', range: 80, fireEvery: 1.8, boltSpeed: 80, weapon: 'fan5' },
  manta: { name: 'Arraia', model: 'manta', scale: 0.55, hp: 10, radius: 2.9, score: 450, speed: 30, turn: 0.8, ai: 'standoff', range: 130, fireEvery: 3.2, boltSpeed: 40, weapon: 'seeker' },
  tormenta: { name: 'Tormenta', model: 'tormenta', scale: 0.66, hp: 16, radius: 3.3, score: 650, speed: 26, turn: 0.6, ai: 'standoff', range: 120, fireEvery: 3, boltSpeed: 42, weapon: 'seeker' },
  carrier: { name: 'Colmeia', model: 'carrier', scale: 0.75, hp: 22, radius: 3.8, score: 700, speed: 22, turn: 0.5, ai: 'standoff', range: 170, fireEvery: 5, boltSpeed: 0, weapon: 'launch', spawns: 'kamikaze' },
  hive: { name: 'Colmeia Real', model: 'hive', scale: 0.78, hp: 26, radius: 3.9, score: 800, speed: 22, turn: 0.5, ai: 'standoff', range: 180, fireEvery: 5.5, boltSpeed: 0, weapon: 'launch', spawns: 'swarm' },
}
export const ENEMY_LIST = Object.keys(ENEMY_TYPES)

// Naves-mãe: gigantes com torres, hangares que lançam caças e um reator (ponto fraco)
export const MOTHERSHIP_TYPES = {
  leviata: { name: 'Nave-mãe Leviatã', model: 'motherLeviata', scale: 7, turrets: 4, turretHp: 12, reactorHp: 60, score: 3000, launch: ['fighter', 'interceptor'], launchEvery: 7, speed: 7 },
  tita: { name: 'Nave-mãe Titã', model: 'motherTita', scale: 6.6, turrets: 5, turretHp: 14, reactorHp: 70, score: 3500, launch: ['ace', 'raptor'], launchEvery: 8, speed: 6 },
  colmeiaMae: { name: 'Colmeia-Mãe', model: 'motherColmeia', scale: 6.4, turrets: 4, turretHp: 12, reactorHp: 55, score: 3000, launch: ['swarm', 'kamikaze'], launchEvery: 6, speed: 5, disc: true },
}

// Armas primárias por nível (pickup dourado sobe o nível)
export const WEAPONS = ['LASER DUPLO', 'LASER QUÁDRUPLO', 'PLASMA', 'PLASMA EM LEQUE', 'HIPER-LASER']

// ---------------------------------------------------------------------------
// CAMPANHA: missões do Sesc e do Senac Ceará
// Cada missão tem duas etapas: combate em ÓRBITA e, na metade do prazo, a nave ENTRA NA ATMOSFERA
// (subfase planetária). Na Terra, a batalha acontece no céu de Fortaleza-CE.
//  - indicator.type 'kills'  → conta naves inimigas derrubadas (pela equipe toda; nave-mãe vale 5)
//  - indicator.type 'tokens' → conta "cápsulas de meta" coletadas pelo jogador
//  - bonus.type: 'accuracy' (precisão mínima), 'minShield' (escudo nunca abaixo de X%),
//                'combo' (sequência mínima de abates), 'finalShield' (terminar com X% de escudo)
//  - motherships: naves-mãe que aparecem em cada etapa
// Atingimento = realizado / meta. 100% = 1 estrela, 130% = 2 estrelas, bônus = +1 estrela.
// ---------------------------------------------------------------------------
export const MISSIONS = [
  {
    org: 'SENAC',
    title: 'Campanha de Matrículas',
    place: 'Órbita da Terra → céu de Fortaleza-CE',
    location: 'earth',
    surface: 'fortaleza',
    speaker: 'roberta',
    briefing:
      'A Armada do Caos lançou a frota da Evasão contra as nossas turmas. Combata em órbita e depois desça para defender Fortaleza: uma nave-mãe Leviatã está sobre a cidade! Cada nave derrubada é uma matrícula garantida.',
    indicator: { type: 'kills', label: 'matrículas', unit: 'matrícula', meta: 22 },
    bonus: { type: 'accuracy', value: 30, label: 'Precisão de tiro ≥ 30%' },
    duration: 130,
    mix: { fighter: 0.5, kamikaze: 0.2, interceptor: 0.15, corsair: 0.15 },
    spawnEvery: 1.6,
    maxAlive: 9,
    motherships: { surface: ['leviata'] },
  },
  {
    org: 'SESC',
    title: 'Saúde & Odontologia',
    place: 'Órbita da Lua → superfície lunar',
    location: 'moon',
    surface: 'moonSurface',
    speaker: 'ivone',
    briefing:
      'As agendas das clínicas estão à deriva! Recolha as cápsulas de atendimento (anéis verdes) em órbita e na superfície da Lua. Uma Colmeia-Mãe está lançando enxames contra a rede de clínicas.',
    indicator: { type: 'tokens', label: 'atendimentos', unit: 'atendimento', meta: 10 },
    tokenEvery: 4.5,
    bonus: { type: 'finalShield', value: 45, label: 'Terminar com escudo ≥ 45%' },
    duration: 120,
    mix: { fighter: 0.35, interceptor: 0.25, kamikaze: 0.15, swarm: 0.1, corsair: 0.15 },
    spawnEvery: 1.7,
    maxAlive: 9,
    motherships: { orbit: ['colmeiaMae'] },
  },
  {
    org: 'SENAC',
    title: 'Ativo Aula: Turmas Confirmadas',
    place: 'Órbita de Marte → Valles Marineris',
    location: 'mars',
    surface: 'marsSurface',
    speaker: 'janiele',
    briefing:
      'Os Adiamentos trouxeram os ases Espectro e uma nave-mãe Titã! Derrube as naves para confirmar o início das aulas, em órbita e nos cânions de Marte. Mantenha a sequência para mostrar consistência.',
    indicator: { type: 'kills', label: 'turmas confirmadas', unit: 'turma confirmada', meta: 28 },
    bonus: { type: 'combo', value: 8, label: 'Sequência de 8 abates' },
    duration: 130,
    mix: { fighter: 0.25, interceptor: 0.2, gunship: 0.12, ace: 0.13, raptor: 0.12, swarm: 0.1, lancer: 0.08 },
    spawnEvery: 1.3,
    maxAlive: 10,
    motherships: { orbit: ['tita'], surface: ['leviata'] },
  },
  {
    org: 'SESC',
    title: 'Turismo Social & Cultura',
    place: 'Luas de Júpiter → topo das nuvens de Júpiter',
    location: 'jupiter',
    surface: 'jupiterClouds',
    speaker: 'ivone',
    briefing:
      'Os ônibus do Turismo Social e o público do teatro precisam embarcar! Colete as cápsulas de passageiros em órbita e sobre as nuvens de Júpiter. Arraias lançam plasma teleguiado: faça curvas fechadas!',
    indicator: { type: 'tokens', label: 'passageiros embarcados', unit: 'passageiro', meta: 12 },
    tokenEvery: 4,
    bonus: { type: 'minShield', value: 25, label: 'Escudo nunca abaixo de 25%' },
    duration: 125,
    mix: { fighter: 0.2, bomber: 0.08, sniper: 0.12, manta: 0.12, corsair: 0.15, kamikaze: 0.1, carrier: 0.05, hive: 0.05, raptor: 0.13 },
    spawnEvery: 1.4,
    maxAlive: 10,
    motherships: { surface: ['colmeiaMae'] },
  },
  {
    org: 'FECOMÉRCIO',
    title: 'Ouvidoria em Dia',
    place: 'Anéis de Saturno → tempestade de Saturno',
    location: 'saturn',
    surface: 'saturnClouds',
    speaker: 'alan',
    briefing:
      'O painel mostra uma onda de manifestações pendentes: duas naves-mãe em órbita e uma Colmeia-Mãe na atmosfera! Cada nave derrubada é uma resposta enviada no prazo. As Sentinelas e Tormentas são os casos complexos.',
    indicator: { type: 'kills', label: 'manifestações respondidas', unit: 'resposta enviada', meta: 34 },
    bonus: { type: 'accuracy', value: 35, label: 'Precisão de tiro ≥ 35%' },
    duration: 140,
    mix: { fighter: 0.18, interceptor: 0.12, ace: 0.1, raptor: 0.1, warden: 0.1, tormenta: 0.08, gunship: 0.08, sniper: 0.06, lancer: 0.06, swarm: 0.07, hive: 0.05 },
    spawnEvery: 1.1,
    maxAlive: 12,
    motherships: { orbit: ['leviata', 'tita'], surface: ['colmeiaMae'] },
  },
  {
    org: 'SESC + SENAC',
    title: 'Fechamento Anual de Metas',
    place: 'Órbita da Terra → amanhecer sobre Fortaleza-CE',
    location: 'earthDawn',
    surface: 'fortalezaDawn',
    speaker: 'roberta',
    briefing:
      'O Almirante Korrath vai descer a Fortaleza do Caos sobre a nossa cidade ao amanhecer! Rompa o bloqueio em órbita, entre na atmosfera e destrua as quatro torres e o núcleo da fortaleza no céu de Fortaleza. Garanta o resultado de 2026!',
    indicator: { type: 'boss', label: 'fortaleza destruída', meta: 1 },
    bonus: { type: 'finalShield', value: 40, label: 'Vencer com escudo ≥ 40%' },
    boss: true,
    orbitKills: 10, // abates em órbita para abrir caminho até a atmosfera
    mix: { fighter: 0.3, interceptor: 0.2, ace: 0.15, raptor: 0.15, kamikaze: 0.1, swarm: 0.1 },
    spawnEvery: 1.3,
    maxAlive: 9,
    motherships: { orbit: ['tita'] },
  },
]

const noop = () => {}

export const game = {
  phase: 'title', // title | hangar | briefing | playing | photo | debrief | paused | dying | gameover | victory
  stage: 'orbit', // orbit | entry | surface  (etapa da missão)
  keys: {}, // teclas pressionadas (KeyW, KeyA, Space...)
  stickX: 0, // controle analógico / touch joystick (-1..1)
  stickY: 0,
  autoFire: false, // disparo automático para dispositivos móveis
  touchBoost: false, // turbo via botão de toque
  mouse: new THREE.Vector2(), // posição do mouse normalizada (-1..1); vira "joystick" quando ativo
  mouseActive: false,
  shipPos: new THREE.Vector3(), // posição real da nave
  shipQuat: new THREE.Quaternion(), // rotação de voo da nave
  shipQuatInv: new THREE.Quaternion(), // inversa (para levar pontos do mundo para o espaço da nave)
  shipFwd: new THREE.Vector3(0, 0, -1), // para onde o nariz aponta
  shipUp: new THREE.Vector3(0, 1, 0),
  shipVel: new THREE.Vector3(0, 0, -44),
  aim: new THREE.Vector3(0, 0, -90), // ponto da mira no mundo
  assist: null, // alvo travado pela mira automática
  camera: null, // câmera do R3F (o HUD usa para projetar o radar e as setas)
  ground: 0, // altura do solo na subfase planetária

  // Pools e funções registrados pelos componentes quando montam
  playerLasers: [],
  enemies: [],
  motherships: [],
  pickups: [],
  boss: null,
  fx: { explode: noop, sparks: noop, shockwave: noop },
  firePlayerLaser: noop,
  fireEnemyLaser: noop,
  fireMissile: noop,
  clearEnemyLasers: noop,
  spawnEnemy: noop,
  spawnMothership: noop,
  damageEnemy: noop,
  damageMotherships: noop,
  spawnPickup: noop,
  startBoss: noop,
  damageBossArea: noop,
}

// Zera tudo para uma nova partida (os pools são recriados pelo remount do <World/>)
export function resetGame() {
  Object.assign(game, {
    phase: 'title',
    stage: 'orbit',
    entryT: 0,
    time: 0,
    timeScale: 1, // < 1 = câmera lenta
    worldMul: 1, // multiplicador de velocidade (turbo) usado pelos efeitos
    speed: CONFIG.flySpeed,
    wantsToFire: false,
    wantsBomb: false,
    stickX: 0,
    stickY: 0,
    touchBoost: false,
    mouseActive: false,
    lookBack: false,
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
    missiles: 4, // mísseis teleguiados (F)
    wantsMissile: false,
    droneTime: 0, // segundos restantes do drone de escolta
    seenEnemies: {}, // tipos de inimigo já anunciados no rádio
    score: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    missionIndex: 0,
    missionTime: 0, // segundos restantes no prazo da missão
    mstats: null, // indicadores da missão em andamento
    report: [], // relatório de cada missão concluída
    bossDefeated: false,
    deathTimer: 0,
    outOfBounds: false,
    lowAltitude: false,
    stats: { shots: 0, hits: 0 },
    events: [], // fila de acontecimentos lida pelo Director (rádio, dicas...)
    assist: null,
  })
  game.keys = {}
  game.shipPos.set(0, 0, 0)
  game.shipQuat.identity()
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
const FROZEN = new Set(['paused', 'title', 'briefing', 'debrief', 'photo', 'hangar'])
export function frameDt(delta) {
  if (FROZEN.has(game.phase)) return 0
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

// A nave é larga e baixa: usamos um elipsoide (x²/a² + y²/b² + z²/c² ≤ 1) em vez de esfera.
// Como a nave gira em qualquer direção, o ponto é levado para o espaço LOCAL da nave:
//   local = inversa(rotação) · (p − posição)
const SHIP_HALF = { x: 2.4, y: 0.75, z: 1.9 }
const _local = new THREE.Vector3()
export function hitsShip(p, pad = 0) {
  _local.subVectors(p, game.shipPos)
  if (_local.lengthSq() > 64 + pad * pad * 4) return false // descarte rápido
  _local.applyQuaternion(game.shipQuatInv)
  const dx = _local.x / (SHIP_HALF.x + pad)
  const dy = _local.y / (SHIP_HALF.y + pad)
  const dz = _local.z / (SHIP_HALF.z + pad)
  return dx * dx + dy * dy + dz * dz <= 1
}

// ---------------------------------------------------------------------------
// Alvos: lista única de tudo que pode ser atingido (caças, peças das naves-mãe, chefe).
// Usada pela mira automática, mísseis, alas, drone e radar.
// Cada alvo: { pos (Vector3 do mundo), r (raio), kind, hit(dano, dono) }
// ---------------------------------------------------------------------------
const _targets = []
export function collectTargets() {
  _targets.length = 0
  for (const e of game.enemies) if (e.active) _targets.push(e.target)
  for (const m of game.motherships) if (m.active && m.state === 'fight') for (const t of m.targets) if (t.alive) _targets.push(t)
  const b = game.boss
  if (b && b.active && b.state === 'fight') for (const t of b.targets) if (t.alive) _targets.push(t)
  return _targets
}

const _to = new THREE.Vector3()
/**
 * Melhor alvo dentro de um cone à frente de `from` na direção `dir`.
 * Pontuação = ângulo + distância/1000 (prefere o mais centralizado; desempata pelo mais perto).
 * cosMin: cosseno do meio-ângulo do cone (ex: 0.5 = 60°).
 */
export function bestTarget(from, dir, cosMin, range) {
  let best = null
  let bestScore = Infinity
  const r2 = range * range
  for (const t of collectTargets()) {
    _to.subVectors(t.pos, from)
    const d2 = _to.lengthSq()
    if (d2 > r2 || d2 < 1) continue
    const d = Math.sqrt(d2)
    const cos = _to.dot(dir) / d
    if (cos < cosMin) continue
    const score = (1 - cos) + d / 1000
    if (score < bestScore) {
      bestScore = score
      best = t
    }
  }
  return best
}

// Dano em área (bombas, mísseis): atinge tudo cujo centro esteja a menos de (raio + raio do alvo)
export function damageArea(p, radius, dmg, owner = 'player') {
  const list = collectTargets().slice() // cópia: acertos podem desativar alvos durante o laço
  for (const t of list) {
    const r = radius + t.r
    if (t.pos.distanceToSquared(p) < r * r) t.hit(dmg, owner)
  }
}

// ---------------------------------------------------------------------------
// Regras de jogo compartilhadas
// ---------------------------------------------------------------------------
export function damagePlayer(amount, kind = 'laser') {
  if (game.phase !== 'playing' || game.invuln > 0 || game.stage === 'entry') return false
  // Durante o giro evasivo, lasers ricocheteiam
  if (kind === 'laser' && game.rollTimer > 0) {
    sfx.deflect()
    game.events.push({ type: 'deflect' })
    return false
  }
  game.shield = Math.max(0, game.shield - amount)
  if (game.mstats) game.mstats.minShield = Math.min(game.mstats.minShield, game.shield)
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
  if (owner === 'player' || owner === 'drone') {
    game.combo++
    game.maxCombo = Math.max(game.maxCombo, game.combo)
    if (game.mstats) game.mstats.maxCombo = Math.max(game.mstats.maxCombo, game.combo)
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

// Novo registro de indicadores para a missão que está começando
export function newMissionStats() {
  return { kills: 0, tokens: 0, shots: game.stats.shots, hits: game.stats.hits, minShield: game.shield, maxCombo: 0, orbitKills: 0 }
}

// Avalia a missão: atingimento da meta, bônus e estrelas
export function evaluateMission(m, s) {
  const realized = m.indicator.type === 'kills' ? s.kills : m.indicator.type === 'tokens' ? s.tokens : game.bossDefeated ? 1 : 0
  const pct = Math.round((realized / m.indicator.meta) * 100)
  const shots = game.stats.shots - s.shots
  const accuracy = shots ? Math.round(((game.stats.hits - s.hits) / shots) * 100) : 0
  const b = m.bonus
  const bonusValue =
    b.type === 'accuracy' ? accuracy : b.type === 'minShield' ? Math.round(s.minShield) : b.type === 'combo' ? s.maxCombo : Math.round(game.shield)
  const bonusOk = bonusValue >= b.value
  const stars = (pct >= 100 ? 1 : 0) + (pct >= 130 ? 1 : 0) + (bonusOk ? 1 : 0)
  return { org: m.org, title: m.title, label: m.indicator.label, meta: m.indicator.meta, realized, pct, bonusLabel: b.label, bonusValue, bonusOk, stars, accuracy }
}
