// src/Director.jsx
// "Diretor" da partida: controla as fases, o spawn de inimigos, o chefe
// e decide quando cada personagem fala no rádio.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { game, WAVES, CONFIG, BOUNDS, frameDt, rand } from './gameState'
import { ui } from './store'
import { sayLine } from './radio'
import { sfx, setMusicIntensity } from './audio'
import { endRun } from './flow'

// Marcos de pontuação em que o Sgt. Ramos elogia o jogador
const MILESTONES = [1000, 3000, 6000, 10000, 15000, 22000]

function pickType(mix) {
  let r = Math.random()
  for (const [type, w] of Object.entries(mix)) {
    if ((r -= w) <= 0) return type
  }
  return Object.keys(mix)[0]
}

export default function Director() {
  const s = useRef({
    spawnT: 1.5,
    milestone: 0,
    shieldLevel: 'ok',
    chatterT: rand(24, 34),
    comboSaid: false,
    alarmT: 0,
    hurtTip: false,
    bossStarted: false,
    victoryT: 0,
  })

  // Briefing inicial
  useEffect(() => {
    if (game.phase !== 'playing') return
    const id = setTimeout(() => {
      sayLine('briefing', { priority: 2 })
      sayLine('briefing2', { priority: 1 })
    }, 900)
    return () => clearTimeout(id)
  }, [])

  function nextWave() {
    game.waveIndex++
    game.waveKills = 0
    game.waveBreak = 4
    game.score += 1000 // bônus por completar a fase
    game.shield = Math.min(CONFIG.maxShield, game.shield + 15)
    const w = WAVES[game.waveIndex]
    ui.set({ banner: { id: Date.now(), title: w.title, sub: w.name, alert: !!w.boss } })
    if (w.boss) {
      sfx.warning()
      sayLine('bossWarning', { priority: 3 })
      sayLine('bossTaunt', { priority: 2 })
      sayLine('bossTip', { priority: 2 })
    } else {
      sayLine('wave' + game.waveIndex, { priority: 2 })
    }
  }

  function processEvents(st) {
    for (const ev of game.events) {
      switch (ev.type) {
        case 'wingKill':
          if (Math.random() < 0.35) sayLine('wingKill', { priority: 0, cooldown: 10 })
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

    // ---- Fases ----
    const w = WAVES[game.waveIndex]
    game.asteroidEvery = w.asteroidEvery
    if (game.waveBreak > 0) {
      game.waveBreak -= dt
    } else if (w.boss) {
      if (!st.bossStarted) {
        st.bossStarted = true
        game.startBoss()
        setMusicIntensity(2)
      }
      if (game.bossDefeated) {
        st.victoryT += dt
        if (st.victoryT > 4) endRun('victory')
      }
    } else {
      st.spawnT -= dt
      const alive = game.enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0)
      if (st.spawnT <= 0 && alive < w.maxAlive) {
        const type = pickType(w.mix)
        if (type === 'fighter' && game.waveIndex >= 1 && Math.random() < 0.3) {
          // Formação em "V" com 3 caças
          const x = rand(-1, 1) * BOUNDS.x
          const y = rand(-1, 1) * BOUNDS.y
          game.spawnEnemy('fighter', { x, y, z: -230 })
          game.spawnEnemy('fighter', { x: x - 5, y: y - 1, z: -238 })
          game.spawnEnemy('fighter', { x: x + 5, y: y - 1, z: -238 })
        } else {
          game.spawnEnemy(type)
        }
        st.spawnT = w.spawnEvery * rand(0.7, 1.3)
      }
      if (game.waveKills >= w.quota) nextWave()
    }

    // ---- Gatilhos de rádio ----
    // Soldado elogia ao atingir marcos de pontuação
    while (st.milestone < MILESTONES.length && game.score >= MILESTONES[st.milestone]) {
      sayLine('praise', { priority: 1 }, st.milestone)
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
      st.chatterT = rand(25, 40)
      sayLine('chatter', { priority: 0 })
    }
  })

  return null
}
