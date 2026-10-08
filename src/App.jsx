// src/App.jsx
import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Environment from './Environment'
import Player from './Player'
import Wingmen from './Wingmen'
import Lasers from './Lasers'
import EnemyLasers from './EnemyLasers'
import Enemies from './Enemies'
import Asteroids from './Asteroids'
import Pickups from './Pickups'
import Boss from './Boss'
import Explosions from './Explosions'
import Director from './Director'
import Effects from './Effects'
import Hud from './ui/Hud'
import Radio from './ui/Radio'
import Screens from './ui/Screens'
import { game, BOUNDS } from './gameState'
import { ui, useUI } from './store'
import { startGame, togglePause } from './flow'
import { toggleMute } from './audio'

// ---------------------------------------------------------------------------
// Entrada (mouse + teclado) → escreve no estado global `game`
// ---------------------------------------------------------------------------
function useInput() {
  useEffect(() => {
    const playing = () => game.phase === 'playing'

    const onKeyDown = (e) => {
      game.keys[e.code] = true
      if (e.code === 'Space') {
        e.preventDefault()
        if (playing()) game.wantsToFire = true
      }
      if (e.repeat) return
      if (e.code === 'KeyQ') game.rollRequest = -1
      if (e.code === 'KeyE') game.rollRequest = 1
      if (e.code === 'KeyB') game.wantsBomb = true
      if (e.code === 'KeyP' || e.code === 'Escape') togglePause()
      if (e.code === 'KeyM') ui.set({ muted: toggleMute() })
      const phase = ui.get().phase
      if (e.code === 'Enter' && (phase === 'title' || phase === 'gameover' || phase === 'victory')) startGame()
    }
    const onKeyUp = (e) => {
      game.keys[e.code] = false
      if (e.code === 'Space') game.wantsToFire = false
    }

    // Converte o mouse de pixels para coordenadas normalizadas (-1..1)
    // e mapeia direto para o "quadrado" de movimento da nave.
    const onMouseMove = (e) => {
      if (!playing()) return
      const nx = (e.clientX / window.innerWidth) * 2 - 1 // esquerda -1 → direita +1
      const ny = -((e.clientY / window.innerHeight) * 2 - 1) // baixo -1 → cima +1 (Y da tela é invertido)
      game.target.set(nx * BOUNDS.x, ny * BOUNDS.y)
    }
    const onMouseDown = (e) => {
      if (e.button === 0 && playing()) game.wantsToFire = true
      if (e.button === 2) game.wantsBomb = true
    }
    const onMouseUp = (e) => {
      if (e.button === 0) game.wantsToFire = false
    }
    const onContextMenu = (e) => e.preventDefault()
    // Pausa sozinho se o jogador trocar de aba
    const onVisibility = () => {
      if (document.hidden && playing()) togglePause()
      game.keys = {}
      game.wantsToFire = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}

// Tudo que pertence a uma partida. Trocar a `key` (runId) remonta e zera os pools.
function World() {
  return (
    <>
      <Player />
      <Wingmen />
      <Lasers />
      <EnemyLasers />
      <Enemies />
      <Asteroids />
      <Pickups />
      <Boss />
      <Explosions />
      <Director />
    </>
  )
}

export default function App() {
  useInput()
  const runId = useUI((s) => s.runId)
  const phase = useUI((s) => s.phase)

  return (
    <>
      <Canvas
        className={phase === 'playing' ? 'playing' : ''}
        camera={{ position: [0, 2.8, 11], fov: 70, near: 0.1, far: 1500 }}
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#03040c']} />
        <fog attach="fog" args={['#05071a', 120, 300]} />

        <ambientLight intensity={0.35} />
        <hemisphereLight args={['#9fc4ff', '#2a0f1a', 0.6]} />
        <directionalLight position={[8, 10, 6]} intensity={2.4} color="#fff1dc" />
        <directionalLight position={[-6, -3, -8]} intensity={0.8} color="#4f7dff" />

        <Environment />
        <World key={runId} />
        <Effects />
      </Canvas>
      <Hud />
      <Radio />
      <Screens />
    </>
  )
}
