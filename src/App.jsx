// src/App.jsx
import { Suspense, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useProgress, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { resolveAssetBase } from './assets'
import { preloadShips } from './models'
import Environment from './Environment'
import Space from './Space'
import Missiles from './Missiles'
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
import { startGame, togglePause, togglePhoto } from './flow'
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
      if (e.code === 'KeyF') game.wantsMissile = true
      if (e.code === 'KeyC') togglePhoto()
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
      if (e.button === 1) {
        e.preventDefault()
        game.wantsMissile = true
      }
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

// Câmera 360°: no hangar gira sozinha; no modo foto o jogador arrasta para olhar em volta
function OrbitCamera() {
  const phase = useUI((s) => s.phase)
  const active = phase === 'hangar' || phase === 'photo'
  const { camera } = useThree()
  useEffect(() => {
    if (!active) return
    camera.fov = 55
    camera.updateProjectionMatrix()
  }, [active, camera])
  if (!active) return null
  return (
    <OrbitControls
      makeDefault
      target={[game.shipPos.x, game.shipPos.y, game.shipPos.z]}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={60}
      autoRotate={phase === 'hangar'}
      autoRotateSpeed={0.8}
    />
  )
}

// Tela de carregamento enquanto os modelos 3D chegam
function Loading({ ready }) {
  const { active, progress } = useProgress()
  if (ready && !active) return null
  return (
    <div className="loading">
      <div className="loading-title">CARREGANDO FROTA E PLANETAS</div>
      <div className="bar thin loading-bar">
        <div className="fill wave-fill" style={{ transform: `scaleX(${ready ? progress / 100 : 0.05})` }} />
      </div>
    </div>
  )
}

// Tudo que pertence a uma partida. Trocar a `key` (runId) remonta e zera os pools.
function World() {
  return (
    <>
      <Player />
      <Wingmen />
      <Lasers />
      <Missiles />
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
  const [ready, setReady] = useState(false)

  // Descobre de onde baixar os modelos (pasta local ou GitHub) antes de montar a cena
  useEffect(() => {
    resolveAssetBase().then(() => {
      preloadShips()
      setReady(true)
    })
  }, [])

  return (
    <>
      {ready && (
      <Canvas
        className={phase === 'playing' ? 'playing' : ''}
        camera={{ position: [0, 2.8, 11], fov: 70, near: 0.5, far: 30000 }}
        dpr={[1, 2]}
        shadows="soft"
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#000000']} />

        <Space />
        <Suspense fallback={null}>
          <Environment />
          <World key={runId} />
        </Suspense>
        <OrbitCamera />
        <Effects />
      </Canvas>
      )}
      <Loading ready={ready} />
      <Hud />
      <Radio />
      <Screens />
    </>
  )
}
