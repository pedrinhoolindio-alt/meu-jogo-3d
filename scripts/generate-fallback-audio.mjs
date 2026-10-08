// scripts/generate-fallback-audio.mjs
// Cria arquivos de áudio válidos (WAV com cabeçalho padrão PCM) para /public/audio/
// Assim /audio/intro.mp3 e /audio/game.mp3 nunca dão 404, enquanto o usuário não faz o upload dos seus arquivos.
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('public/audio', { recursive: true })

function createWavBuffer({ duration = 6, freq1 = 220, freq2 = 440, type = 'sine' }) {
  const sampleRate = 44100
  const numChannels = 2
  const bytesPerSample = 2
  const totalSamples = Math.floor(sampleRate * duration)
  const dataSize = totalSamples * numChannels * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20) // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28) // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32) // BlockAlign
  buffer.writeUInt16LE(16, 34) // BitsPerSample
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  let offset = 44
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    // Envelope para loop suave (fade in nos primeiros 0.5s, fade out nos ultimos 0.5s)
    let env = 1
    if (t < 0.5) env = t / 0.5
    else if (t > duration - 0.5) env = (duration - t) / 0.5

    // Camada musical (intro mais suave, jogo mais enérgico)
    let sampleL = 0
    let sampleR = 0
    if (type === 'intro') {
      // Dó menor misterioso e calmo
      sampleL = (Math.sin(2 * Math.PI * 130.81 * t) * 0.4 + Math.sin(2 * Math.PI * 196.0 * t) * 0.3) * env
      sampleR = (Math.sin(2 * Math.PI * 155.56 * t) * 0.4 + Math.sin(2 * Math.PI * 261.63 * t) * 0.3) * env
    } else {
      // Batida rítmica de ação espacial
      const beat = (Math.sin(2 * Math.PI * 2.5 * t) + 1) * 0.5
      sampleL = (Math.sin(2 * Math.PI * 87.31 * t) * 0.5 + Math.sin(2 * Math.PI * 174.61 * t) * 0.3 * beat) * env
      sampleR = (Math.sin(2 * Math.PI * 116.54 * t) * 0.4 + Math.sin(2 * Math.PI * 233.08 * t) * 0.3 * beat) * env
    }

    const valL = Math.max(-1, Math.min(1, sampleL)) * 32767 * 0.6
    const valR = Math.max(-1, Math.min(1, sampleR)) * 32767 * 0.6

    buffer.writeInt16LE(Math.floor(valL), offset)
    buffer.writeInt16LE(Math.floor(valR), offset + 2)
    offset += 4
  }

  return buffer
}

const introBuf = createWavBuffer({ duration: 8, type: 'intro' })
const gameBuf = createWavBuffer({ duration: 8, type: 'game' })

writeFileSync('public/audio/intro.mp3', introBuf)
writeFileSync('public/audio/game.mp3', gameBuf)
writeFileSync('public/audio/intro.wav', introBuf)
writeFileSync('public/audio/game.wav', gameBuf)

console.log('Arquivos de áudio gerados com sucesso em public/audio/')
