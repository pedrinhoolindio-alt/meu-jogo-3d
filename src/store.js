// src/store.js
// Mini-store para a interface (DOM). Só guarda o que muda raramente:
// fase do jogo, mensagem de rádio, faixas de anúncio, recorde...
// O que muda todo frame (pontos, escudo) o HUD lê direto de `game`.
import { useSyncExternalStore } from 'react'

function loadBest() {
  try {
    return Number(localStorage.getItem('fenix-best')) || 0
  } catch {
    return 0
  }
}

export function saveBest(value) {
  try {
    localStorage.setItem('fenix-best', String(value))
  } catch {
    /* navegação privada: ignora */
  }
}

let state = {
  phase: 'title',
  runId: 0, // muda a cada partida → remonta o mundo 3D
  radio: null,
  banner: null,
  result: null,
  best: loadBest(),
  muted: false,
}

const listeners = new Set()

export const ui = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// Use seletores que retornem valores simples (string, número, objeto já existente)
export function useUI(selector) {
  return useSyncExternalStore(ui.subscribe, () => selector(state))
}

// Gancho de depuração (só existe quando o build é feito com VITE_DEBUG=1)
if (import.meta.env.VITE_DEBUG && typeof window !== 'undefined') window.__ui = ui
