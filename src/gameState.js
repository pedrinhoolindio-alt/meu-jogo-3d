// src/gameState.js
// Estado global MUTÁVEL do jogo (fora do React de propósito).
// Atualizar isto a 60fps via useState causaria re-render a cada frame;
// com objetos mutáveis, o useFrame lê/escreve direto, sem custo de render.
import * as THREE from 'three'

// "Quadrado" imaginário em que a nave pode se mover (unidades do mundo, centrado em 0,0)
export const BOUNDS = { x: 9, y: 5 }

export const CONFIG = {
  // --- Nave ---
  shipFollow: 6, // taxa de aproximação da nave ao alvo (maior = mais responsiva / menos "peso")
  keyboardSpeed: 14, // velocidade com que WASD move o alvo (unidades/seg)

  // --- Câmera ---
  cameraFollow: 3, // taxa do lerp da câmera (menor = mais atraso / mais "peso")
  cameraOffset: new THREE.Vector3(0, 2.8, 11), // atrás (+Z) e acima (+Y) da nave
  cameraParallax: 0.55, // 0 = câmera parada no centro, 1 = acompanha 100% o X/Y da nave

  // --- Mira ---
  aimDistance: 45, // distância (em -Z) do plano da mira
  aimLead: 1.6, // quanto a mira "abre" além da posição da nave (estilo Star Fox)

  // --- Lasers ---
  laserSpeed: 140, // unidades/seg
  laserMaxDistance: 260, // após percorrer isso, o laser é reciclado
  fireCooldown: 0.12, // segundos entre rajadas

  // --- Asteroides ---
  asteroidSpawnZ: -240, // onde nascem (bem à frente)
  asteroidDespawnZ: 20, // passaram da câmera → reciclar
  asteroidSpawnInterval: 0.45, // segundos entre spawns
  asteroidSpeed: [30, 55], // [mín, máx] unidades/seg em +Z

  // Velocidade da "poeira espacial" (sensação de avanço)
  worldSpeed: 60,
}

// Posição LOCAL (em relação à nave) da ponta dos 4 canhões da X-Wing.
// Disparamos em pares alternados (superior / inferior).
export const CANNONS = [
  new THREE.Vector3(2.85, 0.51, -1.1), // superior direito
  new THREE.Vector3(-2.85, 0.51, -1.1), // superior esquerdo
  new THREE.Vector3(2.85, -0.51, -1.1), // inferior direito
  new THREE.Vector3(-2.85, -0.51, -1.1), // inferior esquerdo
]

export const game = {
  keys: {}, // teclas pressionadas (KeyW, KeyA, Space...)
  target: new THREE.Vector2(0, 0), // posição X/Y DESEJADA da nave (mouse/WASD escrevem aqui)
  shipPos: new THREE.Vector3(), // posição real da nave (Player escreve, Lasers/Asteroids leem)
  shipQuat: new THREE.Quaternion(), // rotação real da nave (para posicionar os canhões com o roll)
  aim: new THREE.Vector3(0, 0, -45), // ponto da mira no mundo
  wantsToFire: false,
  lasers: [], // pool de lasers (preenchido pelo Lasers.jsx)
  score: 0,
  hits: 0, // vezes que a nave foi atingida
}
