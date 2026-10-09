// src/flow.js
// Fluxo da campanha: título → briefing → missão → relatório da missão → ... → relatório anual.
import { game, resetGame, MISSIONS, CONFIG, newMissionStats, evaluateMission } from './gameState'
import { ui, saveBest } from './store'
import {
  initAudio,
  startMusic,
  setMusicIntensity,
  setEngine,
  musicaIntro,
  musicaJogo,
  fadeOut,
  playIntro,
} from './audio'
import { clearRadio, sayLine } from './radio'

export function startGame() {
  initAudio()
  // Inicia o fade out na música da intro ao longo de 2 segundos (2000ms)
  fadeOut(musicaIntro, 2000)

  // A música do jogo começa imediatamente, criando um efeito legal onde
  // a intro vai sumindo enquanto a ação vai começando
  if (musicaJogo) {
    try {
      musicaJogo.play()?.catch(() => {})
    } catch (e) {}
  }

  startMusic()
  setMusicIntensity(1)
  resetGame()
  clearRadio()
  ui.set({ runId: ui.get().runId + 1, result: null, debrief: null, stage: 'orbit' })
  openBriefing(0)
}

// Tela de briefing (jogo congelado até o jogador iniciar)
export function openBriefing(index) {
  game.missionIndex = index
  game.phase = 'briefing'
  game.stage = 'orbit'
  game.wantsToFire = false
  game.resetShip = true
  clearRadio()
  ui.set({ phase: 'briefing', mission: index, banner: null, stage: 'orbit' })
}

export function startMission() {
  if (game.phase !== 'briefing') return
  const m = MISSIONS[game.missionIndex]
  if (game.missionIndex > 0) game.shield = Math.min(CONFIG.maxShield, game.shield + 30) // reparo entre missões
  game.mstats = newMissionStats()
  game.missionTime = m.duration || 0
  game.invuln = 1.5
  game.phase = 'playing'
  // Toda missão começa em órbita, com a nave no centro da arena apontando para −Z
  game.stage = 'orbit'
  game.entryT = 0
  game.arrived = false
  game.resetShip = true
  setEngine(true, false)
  ui.set({
    phase: 'playing',
    stage: 'orbit',
    banner: { id: Date.now(), title: `MISSÃO ${game.missionIndex + 1}`, sub: m.title, alert: !!m.boss },
  })
  setMusicIntensity(m.boss ? 2 : 1)
}

// ---------------------------------------------------------------------------
// Subfase planetária: entrada na atmosfera (cinemática de ~5 s conduzida pelo Player)
// ---------------------------------------------------------------------------
export function startEntry() {
  if (game.stage !== 'orbit') return
  const m = MISSIONS[game.missionIndex]
  game.stage = 'entry'
  game.entryT = 0
  game.arrived = false
  game.wantsToFire = game.autoFire
  game.clearEnemyLasers()
  ui.set({ banner: { id: Date.now(), title: 'ENTRADA NA ATMOSFERA', sub: m.place.split('→').pop().trim(), alert: false } })
  sayLine('entry', { priority: 3 })
}

// No auge do clarão: limpa o campo de batalha da órbita e troca o cenário para a superfície
export function arriveSurface() {
  clearField()
  for (const ms of game.motherships || []) ms.active = false
  game.ground = 0
  ui.set({ stage: 'surface' })
}

// Fim da cinemática: o jogador retoma o controle sobre a cidade/planeta
export function finishEntry() {
  game.stage = 'surface'
  game.invuln = 1.5
  game.events.push({ type: 'surfaceStart' })
  const m = MISSIONS[game.missionIndex]
  if (m.boss) {
    sayLine('bossWarning', { priority: 3 })
    sayLine('bossTaunt', { priority: 2 })
    sayLine('bossTip', { priority: 2 })
  } else {
    sayLine(m.surface === 'fortaleza' ? 'surface_fortaleza' : 'surface_' + m.surface, { priority: 2 })
  }
}

// Remove inimigos, naves-mãe, tiros e itens da tela (fim de missão / troca de etapa)
function clearField() {
  for (const e of game.enemies) e.active = false
  for (const p of game.pickups || []) p.active = false
  game.clearEnemyLasers()
}

export function finishMission() {
  const m = MISSIONS[game.missionIndex]
  const r = evaluateMission(m, game.mstats)
  game.report.push(r)
  game.mstats = null
  clearField()
  for (const ms of game.motherships || []) ms.active = false
  if (m.boss) return endRun('victory')
  game.phase = 'debrief'
  game.wantsToFire = false
  setEngine(false, false)
  clearRadio()
  ui.set({ phase: 'debrief', debrief: r, banner: null })
}

export function nextMission() {
  if (game.phase !== 'debrief') return
  openBriefing(game.missionIndex + 1)
}

// Modo foto 360°: congela a ação e libera a câmera para girar em volta da nave (tecla C)
export function togglePhoto() {
  if (game.phase === 'playing') {
    game.phase = 'photo'
    game.wantsToFire = false
    setEngine(false, false)
    ui.set({ phase: 'photo' })
  } else if (game.phase === 'photo') {
    game.phase = 'playing'
    setEngine(true, false)
    ui.set({ phase: 'playing' })
  }
}

// Hangar: vê a nave em 360° antes de começar
export function openHangar() {
  if (game.phase !== 'title') return
  initAudio()
  game.phase = 'hangar'
  ui.set({ phase: 'hangar' })
}

export function closeHangar() {
  if (game.phase !== 'hangar') return
  game.phase = 'title'
  ui.set({ phase: 'title' })
}

export function togglePause() {
  if (game.phase === 'playing') {
    setEngine(false, false)
    game.phase = 'paused'
    game.wantsToFire = false
    if (musicaJogo) {
      try {
        musicaJogo.pause()
      } catch (e) {}
    }
    ui.set({ phase: 'paused' })
  } else if (game.phase === 'paused') {
    game.phase = 'playing'
    setEngine(true, false)
    if (musicaJogo) {
      try {
        musicaJogo.play()?.catch(() => {})
      } catch (e) {}
    }
    ui.set({ phase: 'playing' })
  }
}

export function endRun(kind) {
  // Derrota no meio de uma missão: registra o que foi alcançado até ali
  if (kind === 'gameover' && game.mstats) {
    const r = evaluateMission(MISSIONS[game.missionIndex], game.mstats)
    game.report.push({ ...r, incomplete: true })
    game.mstats = null
  }
  game.phase = kind
  game.wantsToFire = false
  clearRadio()
  const prevBest = ui.get().best
  const best = Math.max(prevBest, game.score)
  saveBest(best)
  const accuracy = game.stats.shots ? Math.round((game.stats.hits / game.stats.shots) * 100) : 0
  const report = [...game.report]
  const overall = report.length ? Math.round(report.reduce((s, r) => s + Math.min(r.pct, 200), 0) / report.length) : 0
  ui.set({
    phase: kind,
    best,
    result: {
      score: game.score,
      kills: game.kills,
      maxCombo: game.maxCombo,
      accuracy: Math.min(100, accuracy),
      newRecord: game.score > prevBest,
      report,
      overall,
      stars: report.reduce((s, r) => s + r.stars, 0),
      maxStars: MISSIONS.length * 3,
    },
  })
}

export function toMenu() {
  resetGame()
  clearRadio()
  if (musicaJogo) {
    try {
      musicaJogo.pause()
      musicaJogo.currentTime = 0
    } catch (e) {}
  }
  playIntro()
  ui.set({ phase: 'title', banner: null, runId: ui.get().runId + 1, stage: 'orbit' })
}

// Gancho de depuração (só existe quando o build é feito com VITE_DEBUG=1)
if (import.meta.env.VITE_DEBUG && typeof window !== 'undefined') window.__flow = { openBriefing, startMission, finishMission, startEntry, endRun }
