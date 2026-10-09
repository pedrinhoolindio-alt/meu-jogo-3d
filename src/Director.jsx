// src/Director.jsx
// "Diretor" da campanha: controla a missão em andamento (prazo, inimigos, cápsulas de meta,
// chefe) e decide quando cada personagem fala no rádio.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, MISSIONS, frameDt, rand } from './gameState'
import { spawnAround } from './Enemies'
import { say, sayLine } from './radio'
import { sfx } from './audio'
import { endRun, finishMission, startEntry } from './flow'

const base = new THREE.Vector3()
const off = new THREE.Vector3()
const right = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
// Formação em "V" (3 caças) e "losango" do enxame (4), em coordenadas relativas ao líder
const V_FORMATION = [
  [0, 0, 0],
  [-7, -1, -6],
  [7, -1, -6],
]
const SWARM = [
  [0, 0, 0],
  [-4, 2, -4],
  [4, 2, -4],
  [0, 4, -8],
]

// Marcos de pontuação em que a equipe elogia o jogador
const MILESTONES = [1000, 3000, 6000, 10000, 15000, 22000]

function pickType(mix) {
  let r = Math.random()
  for (const [type, w] of Object.entries(mix)) {
    if ((r -= w) <= 0) return type
  }
  return Object.keys(mix)[0]
}

// Quanto da meta já foi realizado (0..∞)
export function missionProgress() {
  const m = MISSIONS[game.missionIndex]
  const s = game.mstats
  if (!m || !s) return { realized: 0, meta: 1, pct: 0, m }
  const realized = m.indicator.type === 'kills' ? s.kills : m.indicator.type === 'tokens' ? s.tokens : game.bossDefeated ? 1 : 0
  return { realized, meta: m.indicator.meta, pct: realized / m.indicator.meta, m }
}

// Faz nascer um inimigo (ou um grupo em formação) num ponto em volta do jogador
function spawnGroup(type) {
  const formation = type === 'swarm' ? SWARM : type === 'fighter' && game.missionIndex >= 1 && Math.random() < 0.35 ? V_FORMATION : null
  if (!formation) {
    game.spawnEnemy(type)
    return
  }
  spawnAround(base)
  // Eixos da formação: frente = rumo ao jogador; direita = frente × cima
  off.subVectors(game.shipPos, base).normalize()
  right.crossVectors(off, UP).normalize()
  for (const [x, y, z] of formation) {
    const p = new THREE.Vector3().copy(base).addScaledVector(right, x).addScaledVector(UP, y).addScaledVector(off, z)
    game.spawnEnemy(type, { pos: p })
  }
}

export default function Director() {
  const s = useRef({
    mission: -1,
    spawnT: 1.5,
    tokenT: 2,
    milestone: 0,
    shieldLevel: 'ok',
    chatterT: rand(24, 34),
    comboSaid: false,
    alarmT: 0,
    hurtTip: false,
    boundsT: 0,
    altT: 0,
    motherQueue: [], // naves-mãe agendadas para a etapa atual: { type, t }
    stage: '',
    bossStarted: false,
    victoryT: 0,
    half: false,
    full: false,
    super: false,
    deadline: false,
    briefed: false,
  })

  function processEvents(st) {
    for (const ev of game.events) {
      switch (ev.type) {
        case 'wingKill':
          if (Math.random() < 0.3) sayLine('wingKill', { priority: 0, cooldown: 10 })
          break
        case 'pickup':
          sayLine(ev.key, { priority: 1 })
          break
        case 'newEnemy':
          sayLine('newEnemy_' + ev.enemy, { priority: 2 })
          break
        case 'motherArrive':
          sayLine('motherArrive_' + ev.mother, { priority: 3 })
          break
        case 'motherTurret':
          sayLine('motherTurret', { priority: 1, cooldown: 8 })
          break
        case 'motherExposed':
          sayLine('motherExposed', { priority: 3 })
          break
        case 'motherDown':
          sayLine('motherDown', { priority: 4 })
          break
        case 'deflect':
          sayLine('deflect', { priority: 0, cooldown: 20 })
          break
        case 'hurt':
          if (!st.hurtTip) {
            st.hurtTip = true
            sayLine('rollTip', { priority: 1 })
          }
          break
        case 'turretDown':
          sayLine('turretDown', { priority: 1, cooldown: 8 })
          break
        case 'coreExposed':
          sayLine('coreExposed', { priority: 3 })
          break
        case 'bossHalf':
          sayLine('bossHalf', { priority: 2 })
          break
        case 'bossDying':
          sayLine('bossDown', { priority: 4 })
          break
        case 'bossDown':
          sayLine('victory', { priority: 4 })
          break
        case 'playerDown':
          sayLine('playerDown', { priority: 5 })
          break
        default:
      }
    }
    game.events.length = 0
  }

  useFrame((_, delta) => {
    const dt = frameDt(delta)
    if (!dt) return
    const st = s.current

    // ---- Temporizadores globais ----
    game.time += dt
    game.invuln = Math.max(0, game.invuln - dt)
    game.damageFlash = Math.max(0, game.damageFlash - dt * 2.2)
    game.hitMarker = Math.max(0, game.hitMarker - dt * 4)
    if (game.comboTimer > 0) {
      game.comboTimer -= dt
      if (game.comboTimer <= 0) {
        game.combo = 0
        game.multiplier = 1
        st.comboSaid = false
      }
    }

    processEvents(st)

    if (game.phase === 'dying') {
      game.deathTimer += dt
      if (game.deathTimer > 2.6) endRun('gameover')
      return
    }
    if (game.phase !== 'playing') return

    const m = MISSIONS[game.missionIndex]
    // Nova missão: zera os gatilhos dela
    if (st.mission !== game.missionIndex) {
      Object.assign(st, { mission: game.missionIndex, spawnT: 2, tokenT: 1.5, half: false, full: false, super: false, deadline: false, briefed: false, stage: '', orbitT: 0 })
    }
    // Nova etapa (órbita ou superfície): agenda as naves-mãe dela
    if (st.stage !== game.stage && game.stage !== 'entry') {
      st.stage = game.stage
      st.motherQueue = ((m.motherships || {})[game.stage] || []).map((type, i) => ({ type, t: 7 + i * 16 }))
      st.spawnT = 2.5
      st.tokenT = 2
    }
    // Durante a cinemática de entrada, nada nasce e o prazo para
    if (game.stage === 'entry') return

    if (!st.briefed) {
      st.briefed = true
      if (game.missionIndex === 0) {
        sayLine('briefing', { priority: 2 })
        sayLine('briefing2', { priority: 1 })
      }
    }

    // ---- Naves-mãe agendadas ----
    for (const q of st.motherQueue) {
      if (q.t > 0 && (q.t -= dt) <= 0) game.spawnMothership(q.type)
    }

    // ---- Inimigos (no chefe sobre Fortaleza, quem chama escoltas é a própria fortaleza) ----
    const bossFight = m.boss && game.stage === 'surface'
    st.spawnT -= dt
    const alive = game.enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0)
    if (!bossFight && st.spawnT <= 0 && alive < m.maxAlive) {
      spawnGroup(pickType(m.mix))
      st.spawnT = m.spawnEvery * rand(0.7, 1.3)
    }

    if (m.boss) {
      // ---- Missão final: romper o bloqueio em órbita → atmosfera → chefe sobre Fortaleza ----
      if (game.stage === 'orbit') {
        st.orbitT += dt
        if (game.mstats.orbitKills >= m.orbitKills || st.orbitT > 55) startEntry()
      } else if (!st.bossStarted) {
        st.bossStarted = true
        game.startBoss()
      }
      if (game.bossDefeated) {
        st.victoryT += dt
        if (st.victoryT > 3.5) finishMission()
      }
    } else {
      // ---- Prazo ----
      game.missionTime -= dt
      // Metade do prazo: a frota inimiga desce para o planeta e a esquadrilha vai atrás
      if (game.stage === 'orbit' && m.surface && game.missionTime <= m.duration / 2) {
        startEntry()
        return
      }

      // ---- Cápsulas de meta (missões de coleta): aparecem à frente, para o jogador buscar ----
      if (m.tokenEvery) {
        st.tokenT -= dt
        if (st.tokenT <= 0 && game.missionTime > 4) {
          st.tokenT = m.tokenEvery * rand(0.8, 1.2)
          right.crossVectors(game.shipFwd, UP).normalize()
          base
            .copy(game.shipPos)
            .addScaledVector(game.shipFwd, rand(130, 200))
            .addScaledVector(right, rand(-60, 60))
            .addScaledVector(UP, rand(-30, 30))
          if (game.stage === 'surface') base.y = Math.max(base.y, game.ground + 60)
          game.spawnPickup('goal', base)
        }
      }

      // ---- Acompanhamento da meta pelo rádio ----
      const { pct, realized } = missionProgress()
      const label = m.indicator.label
      if (!st.half && pct >= 0.5) {
        st.half = true
        say('alan', `Painel atualizado: ${realized} ${label}. Já são ${Math.round(pct * 100)}% da meta!`, { priority: 1 })
      }
      if (!st.full && pct >= 1) {
        st.full = true
        say(m.org === 'SESC' ? 'ivone' : 'janiele', `META BATIDA! ${realized} ${label}. Agora é superação, Pedro!`, { priority: 2 })
      }
      if (!st.super && pct >= 1.3) {
        st.super = true
        say('roberta', `Superação de 30%! Esse resultado vai direto para o relatório da diretoria.`, { priority: 2 })
      }
      if (!st.deadline && game.missionTime <= 15 && pct < 1) {
        st.deadline = true
        say('ivone', `Atenção: faltam 15 segundos e estamos em ${Math.round(pct * 100)}% da meta. Acelera!`, { priority: 3 })
      }

      if (game.missionTime <= 0) {
        finishMission()
        return
      }
    }

    // ---- Avisos de pilotagem ----
    st.boundsT -= dt
    if (game.outOfBounds && st.boundsT <= 0) {
      st.boundsT = 12
      sayLine('outOfBounds', { priority: 2 })
    }
    st.altT -= dt
    if (game.lowAltitude && st.altT <= 0) {
      st.altT = 15
      sayLine('lowAltitude', { priority: 2 })
    }

    // ---- Gatilhos gerais do rádio ----
    while (st.milestone < MILESTONES.length && game.score >= MILESTONES[st.milestone]) {
      sayLine('praise', { priority: 0 }, st.milestone)
      st.milestone++
    }

    // Alertas de escudo (com histerese: só avisa de novo depois de recuperar)
    const sh = game.shield
    if (sh <= 18 && st.shieldLevel !== 'critical') {
      st.shieldLevel = 'critical'
      sayLine('critical', { priority: 4 })
    } else if (sh <= 40 && st.shieldLevel === 'ok') {
      st.shieldLevel = 'low'
      sayLine('lowShield', { priority: 3 })
    } else if (sh > 55) {
      st.shieldLevel = 'ok'
    }
    if (sh <= 25) {
      st.alarmT -= dt
      if (st.alarmT <= 0) {
        sfx.alarm()
        st.alarmT = 1.1
      }
    }

    if (game.combo >= 12 && !st.comboSaid) {
      st.comboSaid = true
      sayLine('combo', { priority: 1 })
    }

    st.chatterT -= dt
    if (st.chatterT <= 0) {
      st.chatterT = rand(28, 42)
      sayLine('chatter', { priority: 0 })
    }
  })

  return null
}
