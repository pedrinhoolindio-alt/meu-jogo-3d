// src/audio.js
// Todos os sons e a música são sintetizados com a Web Audio API (sem arquivos de áudio).
let ctx = null
let master, sfxBus, musicBus, noiseBuf
let muted = false
const last = {}

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.7
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.8
    sfxBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.3
    musicBus.connect(master)
    // 1 segundo de ruído branco, reaproveitado por explosões, chiado do rádio etc.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
}

// Evita empilhar o mesmo som dezenas de vezes no mesmo instante
function can(name, gap) {
  if (!ctx) return false
  const t = ctx.currentTime
  if (last[name] && t - last[name] < gap) return false
  last[name] = t
  return true
}

// Oscilador com envelope rápido e varredura de frequência f0 → f1
function osc({ type = 'square', f0 = 440, f1 = null, dur = 0.15, vol = 0.2, bus, at }) {
  const t = at ?? ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(bus || sfxBus)
  o.start(t)
  o.stop(t + dur + 0.05)
}

// Ruído filtrado (explosões, chiados, "whoosh")
function noise({ dur = 0.4, vol = 0.4, f0 = 1500, f1 = 80, type = 'lowpass', q = 1, bus, at }) {
  const t = at ?? ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f)
  f.connect(g)
  g.connect(bus || sfxBus)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.05)
}

export const sfx = {
  laser() {
    if (can('laser', 0.05)) osc({ type: 'sawtooth', f0: 1600, f1: 220, dur: 0.13, vol: 0.06 })
  },
  wingLaser() {
    if (can('wing', 0.08)) osc({ type: 'sawtooth', f0: 1200, f1: 300, dur: 0.1, vol: 0.025 })
  },
  enemyLaser() {
    if (can('elaser', 0.07)) osc({ type: 'square', f0: 520, f1: 140, dur: 0.16, vol: 0.03 })
  },
  hitEnemy() {
    if (can('hitE', 0.03)) noise({ dur: 0.08, vol: 0.15, f0: 4000, f1: 1500, type: 'highpass' })
  },
  explosion(big = false) {
    if (!can(big ? 'boomB' : 'boom', big ? 0.1 : 0.04)) return
    noise({ dur: big ? 1.6 : 0.7, vol: big ? 0.8 : 0.45, f0: big ? 1200 : 1800, f1: 50 })
    osc({ type: 'sine', f0: big ? 140 : 180, f1: 30, dur: big ? 1.2 : 0.5, vol: big ? 0.6 : 0.3 })
  },
  hit() {
    if (!can('hit', 0.1)) return
    osc({ type: 'square', f0: 200, f1: 50, dur: 0.3, vol: 0.2 })
    noise({ dur: 0.25, vol: 0.35, f0: 2500, f1: 200 })
  },
  deflect() {
    if (can('defl', 0.05)) osc({ type: 'triangle', f0: 1800, f1: 3200, dur: 0.1, vol: 0.12 })
  },
  pickup() {
    if (!ctx) return
    const t = ctx.currentTime
    ;[660, 880, 1320].forEach((f, i) => osc({ type: 'sine', f0: f, dur: 0.18, vol: 0.18, at: t + i * 0.07 }))
  },
  radio() {
    if (!can('radio', 0.2)) return
    noise({ dur: 0.12, vol: 0.12, f0: 3000, f1: 1500, type: 'bandpass', q: 3 })
    osc({ type: 'sine', f0: 1900, dur: 0.07, vol: 0.08 })
  },
  alarm() {
    if (!can('alarm', 0.9)) return
    const t = ctx.currentTime
    osc({ type: 'square', f0: 880, dur: 0.14, vol: 0.07, at: t })
    osc({ type: 'square', f0: 660, dur: 0.14, vol: 0.07, at: t + 0.18 })
  },
  warning() {
    if (!ctx) return
    const t = ctx.currentTime
    for (let i = 0; i < 3; i++) osc({ type: 'sawtooth', f0: 300, f1: 700, dur: 0.45, vol: 0.08, at: t + i * 0.55 })
  },
  roll() {
    if (can('roll', 0.3)) noise({ dur: 0.45, vol: 0.25, f0: 400, f1: 3000, type: 'bandpass', q: 2 })
  },
  bombLaunch() {
    if (can('bombL', 0.2)) osc({ type: 'triangle', f0: 200, f1: 900, dur: 0.35, vol: 0.15 })
  },
  bomb() {
    if (!can('bomb', 0.2)) return
    noise({ dur: 2.2, vol: 0.9, f0: 900, f1: 40 })
    osc({ type: 'sine', f0: 90, f1: 25, dur: 1.8, vol: 0.7 })
  },
}

// ---------------------------------------------------------------------------
// Música procedural: bumbo, baixo, chimbal, caixa e um arpejo (lá menor)
// ---------------------------------------------------------------------------
const BASS = [33, 33, 45, 33, 36, 36, 48, 36, 31, 31, 43, 31, 29, 29, 41, 28] // notas MIDI
const LEAD = [57, 60, 64, 69, 64, 60, 57, 55]
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
let musicTimer = null
let step = 0
let nextTime = 0
let intensity = 1

export function setMusicIntensity(i) {
  intensity = i
}

export function startMusic() {
  if (!ctx || musicTimer) return
  step = 0
  nextTime = ctx.currentTime + 0.1
  // Agendador com "lookahead": agenda as notas um pouco antes para não atrasar
  musicTimer = setInterval(() => {
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(step, nextTime)
      nextTime += 60 / (intensity > 1 ? 148 : 124) / 4 // semicolcheias
      step++
    }
  }, 30)
}

export function stopMusic() {
  clearInterval(musicTimer)
  musicTimer = null
}

function playStep(s, t) {
  const bar = Math.floor(s / 16)
  if (s % 4 === 0) osc({ type: 'sine', f0: 130, f1: 40, dur: 0.18, vol: 0.5, bus: musicBus, at: t })
  if (s % 2 === 0) osc({ type: 'sawtooth', f0: mtof(BASS[(s / 2) % 16]), dur: 0.2, vol: 0.12, bus: musicBus, at: t })
  if (s % 2 === 1) noise({ dur: 0.03, vol: 0.05, f0: 8000, f1: 6000, type: 'highpass', bus: musicBus, at: t })
  if (s % 8 === 4) noise({ dur: 0.15, vol: 0.12, f0: 2500, f1: 800, type: 'bandpass', bus: musicBus, at: t })
  if ((intensity > 1 || bar % 4 >= 2) && s % 2 === 0) {
    const n = LEAD[(s / 2) % 8] + (intensity > 1 ? 12 : 0)
    osc({ type: 'square', f0: mtof(n), dur: 0.12, vol: 0.035, bus: musicBus, at: t })
  }
}

export function toggleMute() {
  muted = !muted
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.05)
  return muted
}
