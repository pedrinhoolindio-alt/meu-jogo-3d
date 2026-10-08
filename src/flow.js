// src/flow.js
// Fluxo de telas: iniciar, pausar, terminar e voltar ao menu.
import { game, resetGame, WAVES } from './gameState'
import { ui, saveBest } from './store'
import { initAudio, startMusic, setMusicIntensity } from './audio'
import { clearRadio } from './radio'

export function startGame() {
  initAudio()
  startMusic()
  setMusicIntensity(1)
  resetGame()
  clearRadio()
  game.phase = 'playing'
  ui.set({
    phase: 'playing',
    runId: ui.get().runId + 1,
    result: null,
    banner: { id: Date.now(), title: WAVES[0].title, sub: WAVES[0].name },
  })
}

export function togglePause() {
  if (game.phase === 'playing') {
    game.phase = 'paused'
    game.wantsToFire = false
    ui.set({ phase: 'paused' })
  } else if (game.phase === 'paused') {
    game.phase = 'playing'
    ui.set({ phase: 'playing' })
  }
}

export function endRun(kind) {
  game.phase = kind
  game.wantsToFire = false
  clearRadio()
  const prevBest = ui.get().best
  const best = Math.max(prevBest, game.score)
  saveBest(best)
  const accuracy = game.stats.shots ? Math.round((game.stats.hits / game.stats.shots) * 100) : 0
  ui.set({
    phase: kind,
    best,
    result: {
      score: game.score,
      kills: game.kills,
      maxCombo: game.maxCombo,
      accuracy: Math.min(100, accuracy),
      newRecord: game.score > prevBest,
    },
  })
}

export function toMenu() {
  resetGame()
  clearRadio()
  ui.set({ phase: 'title', banner: null, runId: ui.get().runId + 1 })
}
