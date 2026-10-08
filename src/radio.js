// src/radio.js
// Fila de mensagens de rádio. Mensagens urgentes (prioridade maior) interrompem as outras.
import { ui } from './store'
import { LINES, pick } from './characters'
import { sfx } from './audio'

let queue = []
let current = null
let timer = null
const lastSaid = {}

export function say(who, text, { priority = 1, key, cooldown = 0 } = {}) {
  const now = performance.now()
  if (key && cooldown && lastSaid[key] && now - lastSaid[key] < cooldown * 1000) return
  if (key) lastSaid[key] = now
  const msg = {
    id: now + Math.random(),
    who,
    text,
    priority,
    duration: Math.min(7, 2.4 + text.length * 0.045), // segundos na tela
  }
  if (!current) return show(msg)
  if (priority > current.priority) return show(msg)
  queue.push(msg)
  queue.sort((a, b) => b.priority - a.priority)
  if (queue.length > 4) queue.length = 4
}

// Fala uma linha de uma categoria do LINES (aleatória ou pelo índice)
export function sayLine(category, opts = {}, index) {
  const list = LINES[category]
  if (!list) return
  const line = index != null ? list[Math.min(index, list.length - 1)] : pick(list)
  say(line.who, line.text, { key: category, ...opts })
}

function show(msg) {
  clearTimeout(timer)
  current = msg
  ui.set({ radio: msg })
  sfx.radio()
  timer = setTimeout(next, msg.duration * 1000)
}

function next() {
  current = null
  const m = queue.shift()
  if (m) show(m)
  else ui.set({ radio: null })
}

export function clearRadio() {
  queue = []
  current = null
  clearTimeout(timer)
  ui.set({ radio: null })
}
