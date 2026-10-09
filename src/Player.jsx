// src/Player.jsx
// Nave do jogador em VOO LIVRE 360°: ela voa sempre para a frente e o jogador gira o nariz
// (mouse como joystick virtual, WASD/setas ou joystick de toque). A câmera persegue por trás.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, CONFIG, damp, bestTarget } from './gameState'
import { Ship, M } from './models'
import Cockpit from './Cockpit'
import { sfx, setEngine } from './audio'
import { planetDirection } from './Space'
import { arriveSurface, finishEntry } from './flow'

const { lerp, clamp, smoothstep } = THREE.MathUtils

// Vetores/quaternions reutilizados (criar objetos dentro do useFrame gera lixo para o GC a cada frame)
const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const qTmp = new THREE.Quaternion()
const qTmp2 = new THREE.Quaternion()
const smoothQ = new THREE.Quaternion() // rotação suavizada da câmera (o "atraso" que dá peso)
const camPos = new THREE.Vector3(0, 3, 12)
const fwd = new THREE.Vector3()
const up = new THREE.Vector3()
const right = new THREE.Vector3()
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const desired = new THREE.Vector3()
const lookM = new THREE.Matrix4()
const Z = new THREE.Vector3(0, 0, 1)
const qRoll = new THREE.Quaternion()
// Visões da câmera (tecla T / botão VISÃO): perseguição, de dentro da nave e distante
const COCKPIT_EYE = new THREE.Vector3(0, 0.62, -0.9) // olhos do piloto, no espaço da nave
const FAR_OFFSET = new THREE.Vector3(0, 6.5, 27)
let lastEngine = -1
let wasOrbit = false

// Curva "ease in-out": começa e termina devagar (usada no giro evasivo)
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

// Zona morta do mouse: perto do centro não gira; na borda (75% da meia-tela) gira no máximo
function deadzone(v) {
  const a = Math.abs(v)
  const dz = CONFIG.mouseDeadzone
  return Math.sign(v) * clamp((a - dz) / (0.75 - dz), 0, 1)
}

// Bainha de plasma da reentrada: casca com brilho na borda (efeito Fresnel)
const plasmaVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const plasmaFragment = /* glsl */ `
  uniform float intensity;
  uniform float time;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.4);
    float flicker = 0.85 + 0.15 * sin(time * 40.0 + vN.x * 9.0);
    vec3 col = mix(vec3(4.0, 1.3, 0.3), vec3(4.0, 3.4, 2.6), rim);
    gl_FragColor = vec4(col * rim * intensity * flicker, rim * intensity);
  }
`

export default function Player() {
  const ship = useRef()
  const bank = useRef() // grupo interno: inclinação visual nas curvas + giro de 360° no barrel roll
  const crosshair = useRef()
  const crossMats = useRef([])
  const flames = useRef([])
  const plasma = useRef()
  const cockpit = useRef()
  const turn = useRef({ x: 0, y: 0 }) // comando de curva suavizado (-1..1)

  const plasmaUniforms = useMemo(() => ({ intensity: { value: 0 }, time: { value: 0 } }), [])
  const green = useMemo(() => new THREE.Color('#4cff7a'), [])
  const red = useMemo(() => new THREE.Color('#ff4a3a'), [])

  useFrame((state, delta) => {
    game.camera = state.camera
    if (game.phase === 'paused') return
    const s = ship.current
    const cam = state.camera
    // Câmera 360° (hangar e modo foto): a OrbitControls controla a câmera; a nave fica parada
    if (game.phase === 'hangar' || game.phase === 'photo') {
      wasOrbit = true
      return
    }
    // Voltando do 360°: a câmera "voa" suavemente de onde estava até a posição de perseguição
    if (wasOrbit) {
      wasOrbit = false
      camPos.copy(cam.position)
      cam.up.copy(Y)
    }
    // Trava o delta: evita "teleporte" ao voltar de outra aba.
    // O mínimo de 0.0001 evita dividir por zero no 1º frame (delta = 0 → velocidade NaN → nave some)
    const raw = Math.min(Math.max(delta, 0.0001), 0.05)
    const dt = raw * game.timeScale
    const k = game.keys
    // Nova missão: volta a nave para o centro da arena, nivelada, apontando para −Z
    if (game.resetShip) {
      game.resetShip = false
      s.position.set(0, 0, 0)
      s.quaternion.identity()
      smoothQ.identity()
      turn.current.x = turn.current.y = 0
      camPos.copy(CONFIG.cameraOffset)
    }
    const playing = game.phase === 'playing'
    const entering = playing && game.stage === 'entry'

    if (game.phase === 'title') {
      // Na tela de título a nave só "flutua" sobre a Terra
      const t = state.clock.elapsedTime
      s.position.set(Math.sin(t * 0.5) * 1.2, Math.sin(t * 0.8) * 0.5 - 0.5, 0)
      s.quaternion.identity()
      bank.current.rotation.set(Math.sin(t * 0.8) * 0.05, 0, Math.sin(t * 0.5) * -0.15)
      game.boosting = false
      game.speed = 0
    } else if (game.phase === 'briefing' || game.phase === 'debrief') {
      // Congelado entre missões
    } else {
      // ======================= 1) COMANDOS =======================
      // turnX > 0 = virar para a direita · turnY > 0 = levantar o nariz
      let tx = 0
      let ty = 0
      if (playing && !entering) {
        const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
        const ky = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
        tx = kx + (game.stickX || 0)
        ty = ky + (game.stickY || 0)
        // Mouse como joystick virtual: quanto mais longe do centro, mais rápido gira
        if (game.mouseActive) {
          tx += deadzone(game.mouse.x)
          ty += deadzone(game.mouse.y)
        }
        tx = clamp(tx, -1, 1)
        ty = clamp(ty, -1, 1)

        // ---------------- Limites da área de combate ----------------
        // Fora do limite, o piloto automático puxa o nariz para o centro (peso w de 0 a 1)
        const surface = game.stage === 'surface'
        if (surface) {
          tmp.set(-s.position.x, 0, -s.position.z) // centro horizontal da cidade
          const dist = Math.hypot(s.position.x, s.position.z)
          const w = clamp((dist - CONFIG.surfaceRadius) / 250, 0, 1)
          game.outOfBounds = w > 0
          if (w > 0) {
            tmp.applyQuaternion(game.shipQuatInv).normalize()
            tx = lerp(tx, tmp.z > 0.3 ? 1 : clamp(tmp.x * 3, -1, 1), w)
          }
          // Altitude: perto do chão levanta o nariz; muito alto, abaixa
          const alt = s.position.y - game.ground
          const low = clamp((CONFIG.minAltitude + 45 - alt) / 45, 0, 1)
          const high = clamp((alt - CONFIG.maxAltitude) / 80, 0, 1)
          game.lowAltitude = low > 0.3
          if (low > 0) ty = lerp(ty, Math.max(ty, 0.9), low)
          if (high > 0) ty = lerp(ty, -0.7, high)
        } else {
          const dist = s.position.length()
          const w = clamp((dist - CONFIG.arenaRadius) / 120, 0, 1)
          game.outOfBounds = w > 0
          game.lowAltitude = false
          if (w > 0) {
            // Direção do centro no espaço LOCAL da nave: x>0 = à direita, y>0 = acima, z>0 = atrás
            tmp.copy(s.position).negate().applyQuaternion(game.shipQuatInv).normalize()
            tx = lerp(tx, tmp.z > 0.3 ? 1 : clamp(tmp.x * 3, -1, 1), w)
            ty = lerp(ty, clamp(tmp.y * 3, -1, 1), w)
          }
        }
      }
      // O comando chega ao valor pedido de forma suave (sem trancos)
      const tr = damp(CONFIG.turnResponse, dt)
      turn.current.x = lerp(turn.current.x, tx, tr)
      turn.current.y = lerp(turn.current.y, ty, tr)

      // ---------------- Turbo (Shift / Touch) ----------------
      const wantBoost = playing && !entering && (k.ShiftLeft || k.ShiftRight || game.touchBoost) && game.boost > 0.05
      game.boosting = wantBoost
      game.boost = clamp(game.boost + (wantBoost ? -CONFIG.boostDrain : CONFIG.boostRegen) * dt, 0, 1)

      // ---------------- Giro evasivo (Q/E) ----------------
      if (game.rollCooldown > 0) game.rollCooldown -= dt
      if (playing && !entering && game.rollRequest && game.rollTimer <= 0 && game.rollCooldown <= 0) {
        game.rollTimer = CONFIG.rollDuration
        game.rollDir = game.rollRequest
        game.rollCooldown = CONFIG.rollDuration + CONFIG.rollCooldown
        sfx.roll()
      }
      game.rollRequest = 0

      // ======================= 2) ROTAÇÃO (quaternions) =======================
      // Girar em torno dos eixos LOCAIS da nave = multiplicar à direita: q = q · qGuinada · qArfagem
      //  - guinada: eixo Y local, ângulo negativo vira o nariz (−Z) para a direita
      //  - arfagem: eixo X local, ângulo positivo levanta o nariz
      const q = s.quaternion
      if (!entering) {
        qTmp.setFromAxisAngle(Y, -turn.current.x * CONFIG.yawRate * dt)
        qTmp2.setFromAxisAngle(X, turn.current.y * CONFIG.pitchRate * dt)
        q.multiply(qTmp).multiply(qTmp2)

        // Nivelamento automático: gira em torno do eixo de voo até o "teto" da nave apontar
        // para cima. desejado = cima do mundo projetado no plano perpendicular ao nariz:
        //   D = UP − F·(F·UP).  Ângulo com sinal entre U (cima da nave) e D: atan2(F·(U×D), U·D)
        fwd.set(0, 0, -1).applyQuaternion(q)
        up.set(0, 1, 0).applyQuaternion(q)
        desired.copy(WORLD_UP).addScaledVector(fwd, -fwd.dot(WORLD_UP))
        if (desired.lengthSq() > 0.02) {
          desired.normalize()
          const ang = Math.atan2(fwd.dot(tmp.crossVectors(up, desired)), up.dot(desired))
          // Mais fraco quando a nave aponta quase na vertical (no meio de um looping)
          const strength = CONFIG.autoLevel * (1 - Math.abs(fwd.y)) * dt
          qTmp.setFromAxisAngle(fwd, ang * Math.min(1, strength))
          q.premultiply(qTmp) // eixo do MUNDO → multiplica à esquerda
        }
        q.normalize()
      } else {
        // ======================= CINEMÁTICA DE ENTRADA NA ATMOSFERA =======================
        game.entryT += raw
        const t = game.entryT
        if (t < 3.6) {
          // Aponta o nariz para o planeta (slerp até a rotação que "olha" para ele)
          planetDirection(tmp)
          lookM.lookAt(s.position, tmp2.copy(s.position).add(tmp), WORLD_UP)
          qTmp.setFromRotationMatrix(lookM)
          q.slerp(qTmp, damp(1.6, raw))
          game.shake = Math.max(game.shake, smoothstep(t, 1.2, 3.2) * 0.9)
          if (Math.random() < 0.6) game.fx.sparks(tmp.copy(s.position).addScaledVector(fwd.set(0, 0, 1).applyQuaternion(q), 3), 'orange', 1)
        } else if (!game.arrived) {
          // No auge do clarão: troca o cenário para a superfície (o fade esconde o corte)
          game.arrived = true
          arriveSurface()
          s.position.set(0, game.ground + 300, 1500)
          // Chega nivelando, de nariz levemente para baixo, rumo ao norte (−Z)
          q.setFromAxisAngle(X, -0.12)
          smoothQ.copy(q)
        }
        if (t >= CONFIG.entryDuration) {
          game.arrived = false
          finishEntry()
        }
      }

      // Vetores da nave no mundo (publicados para os outros sistemas)
      fwd.set(0, 0, -1).applyQuaternion(q)
      up.set(0, 1, 0).applyQuaternion(q)
      right.set(1, 0, 0).applyQuaternion(q)

      // ======================= 3) MOVIMENTO =======================
      // Velocidade escalar suavizada; posição = posição + frente · velocidade · dt
      const entryBoost = entering && game.entryT < 3.6 ? 150 : 0
      const targetSpeed = playing ? (entryBoost || (game.boosting ? CONFIG.boostSpeed : CONFIG.flySpeed)) : 0
      game.speed = lerp(game.speed, targetSpeed, damp(entering ? 1.2 : 2.5, dt))
      s.position.addScaledVector(fwd, game.speed * dt)
      game.shipVel.copy(fwd).multiplyScalar(game.speed)
      // O giro evasivo também desliza a nave para o lado (eixo "direita" local)
      if (game.rollTimer > 0) s.position.addScaledVector(right, game.rollDir * 9 * dt)
      // Nunca atravessa o chão
      if (game.stage === 'surface' || (entering && game.arrived)) s.position.y = Math.max(s.position.y, game.ground + 8)

      // ======================= 4) INCLINAÇÃO VISUAL =======================
      // Inclina as asas para dentro da curva (roll) e empina um pouco ao subir (pitch)
      const rt = damp(6, dt)
      const b = bank.current
      b.rotation.x = lerp(b.rotation.x, turn.current.y * 0.18, rt)
      let roll = lerp(b.userData.roll || 0, -turn.current.x * 0.85, rt)
      b.userData.roll = roll
      if (game.rollTimer > 0) {
        game.rollTimer -= dt
        const p = 1 - Math.max(0, game.rollTimer) / CONFIG.rollDuration
        roll += -game.rollDir * Math.PI * 2 * easeInOut(p)
      }
      b.rotation.z = roll
    }

    // Velocidade relativa (efeitos de turbo, rastros de velocidade)
    game.worldMul = lerp(game.worldMul, game.boosting ? 1.8 : 1, damp(3, raw))

    // Pisca enquanto está invulnerável; some quando é destruída
    const dead = game.phase === 'dying' || game.phase === 'gameover'
    const blink = playing && !entering && game.invuln > 0 && Math.floor(state.clock.elapsedTime * 20) % 2 === 0
    s.visible = !dead && !blink

    // Publica para os outros sistemas
    game.shipPos.copy(s.position)
    game.shipQuat.copy(s.quaternion)
    game.shipQuatInv.copy(s.quaternion).invert()
    game.shipFwd.set(0, 0, -1).applyQuaternion(s.quaternion)
    game.shipUp.set(0, 1, 0).applyQuaternion(s.quaternion)

    // ======================= 5) MIRA =======================
    // Ponto de convergência à frente do nariz: aim = posição + frente · distância
    game.aim.copy(game.shipPos).addScaledVector(game.shipFwd, CONFIG.aimDistance)
    crosshair.current.position.copy(game.aim)
    // Mira automática leve: inimigo num cone de ~6° recebe o tiro com "lead" (previsão):
    //   ponto = alvo + velocidade_do_alvo · (distância / velocidade_do_laser)
    game.assist = null
    if (playing && !entering) {
      const t = bestTarget(game.shipPos, game.shipFwd, Math.cos(CONFIG.assistAngle), CONFIG.assistRange)
      if (t) {
        game.assist = t
        const time = t.pos.distanceTo(game.shipPos) / CONFIG.laserSpeed
        game.aim.copy(t.pos)
        if (t.vel) game.aim.addScaledVector(t.vel, time)
      }
    }
    crosshair.current.quaternion.copy(cam.quaternion) // billboard: sempre de frente para a câmera
    crosshair.current.visible = playing && !entering
    crosshair.current.scale.setScalar(1.6 * (1 + game.hitMarker * 0.35))
    for (const m of crossMats.current) if (m) m.color.copy(game.assist ? red : green)

    // ======================= 6) CÂMERA DE PERSEGUIÇÃO =======================
    // A rotação da câmera persegue a da nave com slerp (atraso = sensação de peso).
    // posição = nave + offset girado pela rotação suavizada
    smoothQ.slerp(s.quaternion, damp(entering ? 2.5 : CONFIG.cameraFollow, raw))
    const back = game.lookBack && playing
    // Dentro da nave só durante o voo (no menu e entre missões fica a visão de fora)
    const inside = game.view === 'cockpit' && !back && game.phase !== 'title' && !dead
    // Tremor de tela: deslocamento aleatório proporcional a shake² (cai rápido)
    game.shake = Math.max(0, game.shake - raw * 1.6)
    const sh = game.shake * game.shake * (inside ? 0.25 : 0.6)
    if (inside) {
      // ---- Visão de DENTRO da nave ----
      // Câmera presa aos olhos do piloto: posição = nave + rotação · olhos.
      // Rotação = a da nave + parte da inclinação das curvas e o giro completo do barrel roll
      const b = bank.current
      const barrel = b.rotation.z - (b.userData.roll || 0)
      qRoll.setFromAxisAngle(Z, (b.userData.roll || 0) * 0.35 + barrel)
      cam.quaternion.copy(s.quaternion).multiply(qRoll)
      tmp.copy(COCKPIT_EYE).applyQuaternion(s.quaternion).add(s.position)
      cam.position.set(tmp.x + (Math.random() - 0.5) * sh, tmp.y + (Math.random() - 0.5) * sh, tmp.z + (Math.random() - 0.5) * sh)
      cam.up.set(0, 1, 0).applyQuaternion(cam.quaternion)
      camPos.copy(tmp) // ao voltar para fora, a câmera sai suavemente daqui
    } else {
      const offset = back ? CONFIG.cameraBackOffset : game.view === 'far' ? FAR_OFFSET : CONFIG.cameraOffset
      tmp.copy(offset).applyQuaternion(smoothQ).add(s.position)
      camPos.lerp(tmp, damp(back ? 8 : 14, raw))
      cam.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh)
      // Olha para um ponto à frente da nave, com o "teto" da câmera = teto suavizado da nave
      cam.up.set(0, 1, 0).applyQuaternion(smoothQ)
      if (back) tmp.copy(s.position).addScaledVector(game.shipFwd, -40)
      else tmp.set(0, 0, game.view === 'far' ? -60 : -30).applyQuaternion(smoothQ).add(s.position)
      cam.lookAt(tmp)
    }
    // Cabine: acompanha a câmera; a nave por fora some (a câmera está dentro dela)
    const ck = cockpit.current
    ck.visible = inside
    if (inside) {
      ck.position.copy(cam.position)
      ck.quaternion.copy(cam.quaternion)
    }
    bank.current.visible = !inside

    // Campo de visão abre no turbo (sensação de velocidade)
    const targetFov = game.boosting || (entering && game.entryT < 3.6) ? 84 : inside ? 76 : 70
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = lerp(cam.fov, targetFov, damp(4, raw))
      cam.updateProjectionMatrix()
    }

    // Bainha de plasma da reentrada
    const pi = entering ? smoothstep(game.entryT, 0.6, 2.6) * (1 - smoothstep(game.entryT, 3.4, 4.2)) : 0
    plasmaUniforms.intensity.value = pi
    plasmaUniforms.time.value = state.clock.elapsedTime
    plasma.current.visible = pi > 0.01

    // ---------------- Motores ----------------
    // Som do motor: só atualiza quando o estado muda (ligado / turbo)
    const engState = (playing ? 1 : 0) + (game.boosting ? 2 : 0)
    if (engState !== lastEngine) {
      lastEngine = engState
      setEngine(playing, game.boosting)
    }
    // Chamas tremulam; no turbo ficam bem mais longas (unidades do modelo)
    M.flame.opacity = game.boosting ? 0.8 : 0.55
    const len = (game.boosting ? 3.8 : 1.4) * (0.85 + Math.random() * 0.3)
    for (const f of flames.current) if (f) f.scale.y = len
  })

  return (
    <>
      <group ref={ship}>
        <group ref={bank}>
          <Ship kind="player" scale={0.55} flipped flames={flames} />
        </group>
        {/* Bainha de plasma (só aparece na entrada da atmosfera) */}
        <mesh ref={plasma} position={[0, 0, -0.5]} scale={[3.6, 2.4, 7]} visible={false}>
          <sphereGeometry args={[1, 32, 16]} />
          <shaderMaterial
            vertexShader={plasmaVertex}
            fragmentShader={plasmaFragment}
            uniforms={plasmaUniforms}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <Cockpit ref={cockpit} />

      {/* ===== MIRA ===== (verde = livre, vermelha = alvo travado pela mira automática) */}
      <group ref={crosshair}>
        <mesh renderOrder={999}>
          <ringGeometry args={[0.9, 1.05, 32]} />
          <meshBasicMaterial ref={(m) => (crossMats.current[0] = m)} color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} fog={false} />
        </mesh>
        <mesh renderOrder={999}>
          <ringGeometry args={[0.12, 0.2, 16]} />
          <meshBasicMaterial ref={(m) => (crossMats.current[1] = m)} color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} fog={false} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} renderOrder={999} rotation={[0, 0, (i * Math.PI) / 2]} position={[Math.cos((i * Math.PI) / 2) * 1.35, Math.sin((i * Math.PI) / 2) * 1.35, 0]}>
            <planeGeometry args={[0.45, 0.08]} />
            <meshBasicMaterial ref={(m) => (crossMats.current[2 + i] = m)} color="#4cff7a" transparent opacity={0.85} depthTest={false} toneMapped={false} fog={false} />
          </mesh>
        ))}
      </group>
    </>
  )
}
