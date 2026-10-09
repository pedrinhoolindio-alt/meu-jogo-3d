// src/audio.js
// Áudio 100% sintetizado com a Web Audio API (sem arquivos de som).
// Cadeia: sons → (seco + envio para reverberação) → compressor → alto-falantes.
let ctx = null
let master, comp, sfxBus, musicBus, reverb, reverbIn, noiseBuf
let engine = null
let muted = false
const last = {}

// Resposta ao impulso sintética: ruído estéreo com decaimento exponencial (≈ salão grande)
function makeImpulse(seconds = 2.8, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 4
    comp.attack.value = 0.005
    comp.release.value = 0.25
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.85
    comp.connect(master)
    master.connect(ctx.destination)

    reverb = ctx.createConvolver()
    reverb.buffer = makeImpulse()
    reverbIn = ctx.createGain()
    reverbIn.gain.value = 0.9
    reverbIn.connect(reverb)
    reverb.connect(comp)

    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.9
    sfxBus.connect(comp)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.32
    musicBus.connect(comp)

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
}

function can(name, gap) {
  if (!ctx) return false
  const t = ctx.currentTime
  if (last[name] && t - last[name] < gap) return false
  last[name] = t
  return true
}

// Saída de um som: volume final, panorama estéreo e quanto vai para a reverberação
function out({ bus = sfxBus, wet = 0.25, pan = 0 } = {}) {
  const g = ctx.createGain()
  let node = g
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    g.connect(p)
    node = p
  }
  node.connect(bus)
  if (wet > 0) {
    const s = ctx.createGain()
    s.gain.value = wet
    node.connect(s)
    s.connect(reverbIn)
  }
  return g
}

// Envelope: sobe rápido até `peak` e cai exponencialmente em `dur` segundos
function env(param, t, peak, dur, attack = 0.005) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(peak, t + attack)
  param.exponentialRampToValueAtTime(0.0001, t + dur)
}

function tone({ type = 'sine', f0, f1, dur = 0.2, vol = 0.2, at, attack, o = {} }) {
  const t = at ?? ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f0, t)
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
  env(g.gain, t, vol, dur, attack)
  osc.connect(g)
  g.connect(out(o))
  osc.start(t)
  osc.stop(t + dur + 0.05)
  return osc
}

function noise({ dur = 0.4, vol = 0.3, type = 'lowpass', f0 = 2000, f1 = 100, q = 0.7, at, attack, o = {} }) {
  const t = at ?? ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = ctx.createGain()
  env(g.gain, t, vol, dur, attack)
  src.connect(f)
  f.connect(g)
  g.connect(out(o))
  src.start(t, Math.random())
  src.stop(t + dur + 0.05)
}

// Síntese FM: um oscilador modula a frequência de outro → timbre metálico de "blaster"
function fmZap({ f0, f1, ratio = 1.5, index = 600, dur = 0.22, vol = 0.12, o = {} }) {
  const t = ctx.currentTime
  const car = ctx.createOscillator()
  const mod = ctx.createOscillator()
  const modGain = ctx.createGain()
  const g = ctx.createGain()
  car.type = 'sine'
  mod.type = 'sine'
  car.frequency.setValueAtTime(f0, t)
  car.frequency.exponentialRampToValueAtTime(f1, t + dur)
  mod.frequency.setValueAtTime(f0 * ratio, t)
  mod.frequency.exponentialRampToValueAtTime(f1 * ratio, t + dur)
  modGain.gain.setValueAtTime(index, t)
  modGain.gain.exponentialRampToValueAtTime(10, t + dur)
  mod.connect(modGain)
  modGain.connect(car.frequency)
  env(g.gain, t, vol, dur, 0.003)
  car.connect(g)
  g.connect(out(o))
  car.start(t)
  mod.start(t)
  car.stop(t + dur + 0.05)
  mod.stop(t + dur + 0.05)
}

export const sfx = {
  laser(pan = 0) {
    if (!can('laser', 0.05)) return
    fmZap({ f0: 1400, f1: 160, ratio: 1.41, index: 900, dur: 0.2, vol: 0.09, o: { wet: 0.18, pan } })
    noise({ dur: 0.04, vol: 0.06, type: 'highpass', f0: 5000, f1: 3000, o: { wet: 0, pan } })
  },
  wingLaser(pan = 0) {
    if (can('wing', 0.08)) fmZap({ f0: 1700, f1: 260, ratio: 1.41, index: 700, dur: 0.16, vol: 0.035, o: { wet: 0.3, pan } })
  },
  enemyLaser() {
    if (can('elaser', 0.08)) fmZap({ f0: 520, f1: 90, ratio: 2.01, index: 400, dur: 0.24, vol: 0.045, o: { wet: 0.35 } })
  },
  hitEnemy() {
    if (!can('hitE', 0.03)) return
    noise({ dur: 0.07, vol: 0.12, type: 'bandpass', f0: 3200, f1: 1800, q: 2, o: { wet: 0.1 } })
    tone({ type: 'triangle', f0: 900, f1: 500, dur: 0.06, vol: 0.05, o: { wet: 0 } })
  },
  explosion(big = false) {
    if (!can(big ? 'boomB' : 'boom', big ? 0.1 : 0.05)) return
    const t = ctx.currentTime
    // Grave (soco no peito)
    tone({ type: 'sine', f0: big ? 85 : 110, f1: 28, dur: big ? 1.4 : 0.7, vol: big ? 0.8 : 0.5, o: { wet: 0.2 } })
    // Corpo da explosão: ruído com filtro que fecha
    noise({ dur: big ? 1.8 : 0.9, vol: big ? 0.6 : 0.4, f0: big ? 2500 : 3000, f1: 70, o: { wet: 0.45 } })
    // Estalos de destroços
    for (let i = 0; i < (big ? 9 : 4); i++) {
      noise({ dur: 0.05, vol: 0.12, type: 'bandpass', f0: 1500 + Math.random() * 3000, f1: 800, q: 3, at: t + 0.05 + Math.random() * (big ? 0.9 : 0.4), o: { wet: 0.3, pan: Math.random() * 1.6 - 0.8 } })
    }
  },
  hit() {
    if (!can('hit', 0.12)) return
    // Impacto metálico no casco: parciais inarmônicos + baque
    ;[220, 347, 563, 811].forEach((f, i) => tone({ type: 'sine', f0: f, f1: f * 0.94, dur: 0.6 - i * 0.1, vol: 0.09, o: { wet: 0.3 } }))
    tone({ type: 'sine', f0: 140, f1: 45, dur: 0.35, vol: 0.45, o: { wet: 0.1 } })
    noise({ dur: 0.25, vol: 0.25, f0: 4000, f1: 300, o: { wet: 0.2 } })
  },
  deflect() {
    if (!can('defl', 0.06)) return
    const osc = tone({ type: 'sine', f0: 2600, f1: 1100, dur: 0.32, vol: 0.08, o: { wet: 0.5 } })
    const lfo = ctx.createOscillator()
    const lg = ctx.createGain()
    lfo.frequency.value = 38
    lg.gain.value = 120
    lfo.connect(lg)
    lg.connect(osc.frequency)
    lfo.start()
    lfo.stop(ctx.currentTime + 0.35)
  },
  pickup() {
    if (!ctx) return
    const t = ctx.currentTime
    ;[880, 1108.7, 1318.5, 1760].forEach((f, i) =>
      tone({ type: 'triangle', f0: f, dur: 0.5, vol: 0.07, at: t + i * 0.06, attack: 0.01, o: { wet: 0.6 } })
    )
  },
  radio() {
    if (!can('radio', 0.25)) return
    // "Chiado" de abertura do canal + bipe
    noise({ dur: 0.16, vol: 0.09, type: 'bandpass', f0: 2600, f1: 1200, q: 2.5, o: { wet: 0 } })
    tone({ type: 'sine', f0: 1250, dur: 0.06, vol: 0.05, at: ctx.currentTime + 0.12, o: { wet: 0.1 } })
  },
  alarm() {
    if (!can('alarm', 0.9)) return
    const t = ctx.currentTime
    tone({ type: 'sawtooth', f0: 620, dur: 0.22, vol: 0.035, at: t, attack: 0.02, o: { wet: 0.2 } })
    tone({ type: 'sawtooth', f0: 470, dur: 0.22, vol: 0.035, at: t + 0.26, attack: 0.02, o: { wet: 0.2 } })
  },
  warning() {
    if (!ctx) return
    const t = ctx.currentTime
    // Buzina grave de nave capital (duas notas em quinta)
    for (let i = 0; i < 2; i++) {
      tone({ type: 'sawtooth', f0: 110, dur: 1.1, vol: 0.09, at: t + i * 1.3, attack: 0.15, o: { wet: 0.5 } })
      tone({ type: 'sawtooth', f0: 165, dur: 1.1, vol: 0.06, at: t + i * 1.3, attack: 0.15, o: { wet: 0.5 } })
    }
  },
  roll() {
    if (!can('roll', 0.3)) return
    const t = ctx.currentTime
    noise({ dur: 0.5, vol: 0.18, type: 'bandpass', f0: 300, f1: 2400, q: 1.5, attack: 0.15, o: { wet: 0.2, pan: -0.6 } })
    noise({ dur: 0.45, vol: 0.12, type: 'bandpass', f0: 2400, f1: 400, q: 1.5, at: t + 0.2, o: { wet: 0.2, pan: 0.6 } })
  },
  missile() {
    if (!can('missile', 0.15)) return
    // "Whoosh" de lançamento: ruído subindo + tom grave
    noise({ dur: 0.6, vol: 0.22, type: 'bandpass', f0: 500, f1: 2600, q: 1.2, attack: 0.05, o: { wet: 0.35 } })
    tone({ type: 'sawtooth', f0: 90, f1: 160, dur: 0.4, vol: 0.06, o: { wet: 0.2 } })
  },
  charge() {
    if (!can('charge', 0.4)) return
    // Carga do Ferrão (aviso sonoro antes do disparo forte)
    tone({ type: 'sine', f0: 300, f1: 1400, dur: 1.0, vol: 0.05, attack: 0.3, o: { wet: 0.4 } })
  },
  beam() {
    if (can('beam', 0.1)) fmZap({ f0: 900, f1: 60, ratio: 2.5, index: 1400, dur: 0.45, vol: 0.12, o: { wet: 0.5 } })
  },
  bombLaunch() {
    if (can('bombL', 0.2)) tone({ type: 'sine', f0: 120, f1: 420, dur: 0.4, vol: 0.2, o: { wet: 0.4 } })
  },
  bomb() {
    if (!can('bomb', 0.2)) return
    tone({ type: 'sine', f0: 60, f1: 22, dur: 2.4, vol: 0.9, o: { wet: 0.3 } })
    noise({ dur: 2.6, vol: 0.7, f0: 1800, f1: 40, o: { wet: 0.7 } })
    this.explosion(true)
  },
}

// ---------------------------------------------------------------------------
// Ronco contínuo do motor (sobe de tom e brilho no turbo)
// ---------------------------------------------------------------------------
function startEngine() {
  if (!ctx || engine) return
  const g = ctx.createGain()
  g.gain.value = 0
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 240
  const a = ctx.createOscillator()
  const b = ctx.createOscillator()
  a.type = b.type = 'sawtooth'
  a.frequency.value = 52
  b.frequency.value = 52.6 // leve desafinação → batimento "vivo"
  const n = ctx.createBufferSource()
  n.buffer = noiseBuf
  n.loop = true
  const nf = ctx.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.value = 500
  nf.Q.value = 0.8
  const ng = ctx.createGain()
  ng.gain.value = 0.4
  a.connect(lp)
  b.connect(lp)
  n.connect(nf)
  nf.connect(ng)
  ng.connect(lp)
  lp.connect(g)
  g.connect(sfxBus)
  a.start()
  b.start()
  n.start()
  engine = { g, lp, a, b, nf }
}

export function setEngine(on, boost) {
  if (!ctx) return
  if (!engine) startEngine()
  const t = ctx.currentTime
  engine.g.gain.setTargetAtTime(on ? (boost ? 0.09 : 0.045) : 0, t, 0.25)
  engine.lp.frequency.setTargetAtTime(boost ? 900 : 240, t, 0.3)
  engine.a.frequency.setTargetAtTime(boost ? 70 : 52, t, 0.4)
  engine.b.frequency.setTargetAtTime(boost ? 70.8 : 52.6, t, 0.4)
  engine.nf.frequency.setTargetAtTime(boost ? 1400 : 500, t, 0.3)
}

// ---------------------------------------------------------------------------
// Trilha cinematográfica: cordas (acordes), ostinato grave, percussão tipo taiko
// e metais na batalha final. Ré menor, 92 BPM.
// ---------------------------------------------------------------------------
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
const CALM = [
  [50, 53, 57], // Dm
  [46, 50, 53], // Bb
  [41, 45, 48], // F
  [48, 52, 55], // C
]
const BOSS = [
  [50, 53, 57], // Dm
  [46, 50, 53], // Bb
  [43, 46, 50], // Gm
  [45, 49, 52], // A
]
const MOTIF = [74, null, 77, null, 81, null, 79, 77, 76, null, 74, null, 73, null, 76, null]

let musicTimer = null
let step = 0
let nextTime = 0
let intensity = 1

export function setMusicIntensity(i) {
  intensity = i
}

function pad(notes, t, dur) {
  for (const n of notes) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator()
      const f = ctx.createBiquadFilter()
      const g = ctx.createGain()
      o.type = 'sawtooth'
      o.frequency.value = mtof(n + 12)
      o.detune.value = det
      f.type = 'lowpass'
      f.frequency.value = 1300
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.022, t + 0.7) // ataque lento, como cordas
      g.gain.setValueAtTime(0.022, t + dur - 0.4)
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6)
      o.connect(f)
      f.connect(g)
      g.connect(out({ bus: musicBus, wet: 0.7 }))
      o.start(t)
      o.stop(t + dur + 0.7)
    }
  }
}

function pluckBass(n, t) {
  const o = ctx.createOscillator()
  const f = ctx.createBiquadFilter()
  const g = ctx.createGain()
  o.type = 'sawtooth'
  o.frequency.value = mtof(n)
  f.type = 'lowpass'
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(200, t + 0.16)
  env(g.gain, t, 0.12, 0.2, 0.004)
  o.connect(f)
  f.connect(g)
  g.connect(out({ bus: musicBus, wet: 0.2 }))
  o.start(t)
  o.stop(t + 0.25)
}

function taiko(t, vol = 0.5) {
  tone({ type: 'sine', f0: 95, f1: 42, dur: 0.45, vol, at: t, o: { bus: musicBus, wet: 0.45 } })
  noise({ dur: 0.08, vol: vol * 0.35, f0: 600, f1: 150, at: t, o: { bus: musicBus, wet: 0.3 } })
}

function brass(n, t, dur) {
  const o1 = ctx.createOscillator()
  const o2 = ctx.createOscillator()
  const f = ctx.createBiquadFilter()
  const g = ctx.createGain()
  o1.type = 'sawtooth'
  o2.type = 'square'
  o1.frequency.value = mtof(n)
  o2.frequency.value = mtof(n) * 1.003
  f.type = 'lowpass'
  f.frequency.setValueAtTime(400, t)
  f.frequency.linearRampToValueAtTime(2200, t + 0.12) // "sopro" abrindo o timbre
  f.frequency.linearRampToValueAtTime(1200, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.03, t + 0.08)
  g.gain.linearRampToValueAtTime(0.0001, t + dur)
  o1.connect(f)
  o2.connect(f)
  f.connect(g)
  g.connect(out({ bus: musicBus, wet: 0.55 }))
  o1.start(t)
  o2.start(t)
  o1.stop(t + dur + 0.05)
  o2.stop(t + dur + 0.05)
}

function playStep(s, t, stepDur) {
  const bar = Math.floor(s / 16)
  const pos = s % 16
  const prog = intensity > 1 ? BOSS : CALM
  const chord = prog[bar % 4]
  if (pos === 0) pad(chord, t, stepDur * 16)
  // Ostinato grave em colcheias: tônica, tônica, oitava, tônica...
  if (pos % 2 === 0) {
    const root = chord[0] - 24
    pluckBass(pos % 8 === 4 ? root + 12 : root, t)
  }
  // Percussão: tempos 1 e 3; no chefe, mais intensa
  if (pos === 0 || pos === 8) taiko(t, 0.55)
  if (intensity > 1 && (pos === 6 || pos === 14)) taiko(t, 0.35)
  if (bar % 4 === 3 && pos >= 12) taiko(t, 0.25 + (pos - 12) * 0.08) // virada no fim da frase
  if (pos === 4 || pos === 12) noise({ dur: 0.12, vol: 0.05, type: 'bandpass', f0: 2200, f1: 900, q: 1.2, at: t, o: { bus: musicBus, wet: 0.4 } })
  // Metais com o tema na batalha final (a cada 2 compassos)
  if (intensity > 1 && bar % 2 === 0) {
    const n = MOTIF[pos]
    if (n) brass(n - 12, t, stepDur * 1.8)
  }
}

export function startMusic() {
  if (!ctx || musicTimer) return
  step = 0
  nextTime = ctx.currentTime + 0.15
  musicTimer = setInterval(() => {
    const stepDur = 60 / (intensity > 1 ? 104 : 92) / 4 // duração de uma semicolcheia
    while (nextTime < ctx.currentTime + 0.2) {
      playStep(step, nextTime, stepDur)
      nextTime += stepDur
      step++
    }
  }, 40)
}

export function stopMusic() {
  clearInterval(musicTimer)
  musicTimer = null
}

export function toggleMute() {
  muted = !muted
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.05)
  return muted
}
