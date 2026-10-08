// src/flow.js
// Fluxo da campanha: título → briefing → missão → relatório da missão → ... → relatório anual.
import { game, resetGame, MISSIONS, CONFIG, newMissionStats, evaluateMission } from './gameState'
import { ui, saveBest } from './store'
import { initAudio, startMusic, setMusicIntensity, setEngine } from './audio'
import { clearRadio, sayLine } from './radio'

export function startGame() {
  initAudio()
  startMusic()
  setMusicIntensity(1)
  resetGame()
  clearRadio()
  ui.set({ runId: ui.get().runId + 1, result: null, debrief: null })
  openBriefing(0)
}

// Tela de briefing (jogo congelado até o jogador iniciar)
export function openBriefing(index) {
  game.missionIndex = index
  game.phase = 'briefing'
  game.wantsToFire = false
  clearRadio()
  ui.set({ phase: 'briefing', mission: index, banner: null })
}

export function startMission() {
  if (game.phase !== 'briefing') return
  const m = MISSIONS[game.missionIndex]
  if (game.missionIndex > 0) game.shield = Math.min(CONFIG.maxShield, game.shield + 30) // reparo entre missões
  game.mstats = newMissionStats()
  game.missionTime = m.duration || 0
  game.invuln = 1.5
  game.phase = 'playing'
  setEngine(true, false)
  ui.set({
    phase: 'playing',
    banner: { id: Date.now(), title: `MISSÃO ${game.missionIndex + 1}`, sub: m.title, alert: !!m.boss },
  })
  if (m.boss) {
    setMusicIntensity(2)
    sayLine('bossWarning', { priority: 3 })
    sayLine('bossTaunt', { priority: 2 })
    sayLine('bossTip', { priority: 2 })
  } else {
    setMusicIntensity(1)
  }
}

// Remove inimigos, asteroides, tiros e itens da tela (fim de missão)
function clearField() {
  for (const e of game.enemies) e.active = false
  for (const a of game.asteroids) a.active = false
  for (const p of game.pickups || []) p.active = false
  game.clearEnemyLasers()
}

export function finishMission() {
  const m = MISSIONS[game.missionIndex]
  const r = evaluateMission(m, game.mstats)
  game.report.push(r)
  game.mstats = null
  clearField()
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

export function togglePause() {
  if (game.phase === 'playing') {
    setEngine(false, false)
    game.phase = 'paused'
    game.wantsToFire = false
    ui.set({ phase: 'paused' })
  } else if (game.phase === 'paused') {
    game.phase = 'playing'
    setEngine(true, false)
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
  ui.set({ phase: 'title', banner: null, runId: ui.get().runId + 1 })
}
