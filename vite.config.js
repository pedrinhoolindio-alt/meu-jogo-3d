import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function copyRootAudioPlugin() {
  return {
    name: 'copy-root-audio',
    closeBundle() {
      const rootAudio = path.resolve('audio')
      const distAudio = path.resolve('dist/audio')
      if (fs.existsSync(rootAudio)) {
        fs.mkdirSync(distAudio, { recursive: true })
        fs.cpSync(rootAudio, distAudio, { recursive: true })
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), copyRootAudioPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 2000, // three.js + postprocessing são grandes mesmo
  },
})
