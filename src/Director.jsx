// src/Director.jsx
// "Diretor" da campanha: controla a missão em andamento (prazo, inimigos, cápsulas de meta,
// chefe) e decide quando cada personagem fala no rádio.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { game, MISSIONS, BOUNDS, frameDt, rand } from './gameState'
import { say, sayLine } from './radio'
import { sfx } from './audio'
import { endRun, finishMission } from './flow'

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
      Object.assign(st, { mission: game.missionIndex, spawnT: 2, tokenT: 1.5, half: false, full: false, super: false, deadline: false, briefed: false })
    }
    game.asteroidEvery = m.asteroidEvery

    if (!st.briefed) {
      st.briefed = true
      if (game.missionIndex === 0) {
        sayLine('briefing', { priority: 2 })
        sayLine('briefing2', { priority: 1 })
      }
    }

    if (m.boss) {
      // ---- Missão final: chefe ----
      if (!st.bossStarted) {
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

      // ---- Inimigos ----
      st.spawnT -= dt
      const alive = game.enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0)
      if (st.spawnT <= 0 && alive < m.maxAlive) {
        const type = pickType(m.mix)
        if (type === 'fighter' && game.missionIndex >= 1 && Math.random() < 0.3) {
          // Formação em "V" com 3 caças
          const x = rand(-1, 1) * BOUNDS.x
          const y = rand(-1, 1) * BOUNDS.y
          game.spawnEnemy('fighter', { x, y, z: -230 })
          game.spawnEnemy('fighter', { x: x - 5, y: y - 1, z: -238 })
          game.spawnEnemy('fighter', { x: x + 5, y: y - 1, z: -238 })
        } else {
          game.spawnEnemy(type)
        }
        st.spawnT = m.spawnEvery * rand(0.7, 1.3)
      }

      // ---- Cápsulas de meta (missões de coleta) ----
      if (m.tokenEvery) {
        st.tokenT -= dt
        if (st.tokenT <= 0 && game.missionTime > 4) {
          st.tokenT = m.tokenEvery * rand(0.8, 1.2)
          game.spawnPickup('goal', { x: rand(-1, 1) * BOUNDS.x * 1.15, y: rand(-1, 1) * BOUNDS.y * 1.15, z: -150 })
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
