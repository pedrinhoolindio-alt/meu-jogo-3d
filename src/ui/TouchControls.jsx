// src/ui/TouchControls.jsx
// Controles virtuais na tela para dispositivos móveis (Touch / Celular):
// - Joystick analógico flutuante/fixo na esquerda para movimentação precisa
// - Botão de TIRO contínuo no toque + alternador de AUTO-TIRO
// - Botões táticos de BOMBA, TURBO e GIRO EVASIVO
import { useEffect, useRef, useState } from 'react'
import { game, CONFIG } from '../gameState'
import { useUI } from '../store'

export default function TouchControls() {
  const phase = useUI((s) => s.phase)
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const [autoFire, setAutoFire] = useState(false)
  const [isFiring, setIsFiring] = useState(false)
  const [isBoosting, setIsBoosting] = useState(false)
  const [bombsCount, setBombsCount] = useState(3)
  const [rollOnCooldown, setRollOnCooldown] = useState(false)
  const [isTouchCapable, setIsTouchCapable] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.('(pointer: coarse)').matches ||
      window.innerWidth <= 1024
    )
  })
  const nextRollDir = useRef(1)
  const joyPointerId = useRef(null)

  useEffect(() => {
    const handleTouch = () => setIsTouchCapable(true)
    const handleResize = () => {
      if (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia?.('(pointer: coarse)').matches ||
        window.innerWidth <= 1024
      ) {
        setIsTouchCapable(true)
      }
    }
    window.addEventListener('touchstart', handleTouch, { passive: true })
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('touchstart', handleTouch)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Sincroniza estado das bombas e cooldown do giro a cada quadro
  useEffect(() => {
    let animId
    const sync = () => {
      if (game.phase === 'playing') {
        if (game.bombs !== bombsCount) setBombsCount(game.bombs)
        const onCd = game.rollCooldown > 0 || game.rollTimer > 0
        if (onCd !== rollOnCooldown) setRollOnCooldown(onCd)
      }
      animId = requestAnimationFrame(sync)
    }
    animId = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(animId)
  }, [bombsCount, rollOnCooldown])

  // Lógica do Joystick Analógico
  const onStickPointerDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    joyPointerId.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    updateStick(e, e.currentTarget)
  }

  const onStickPointerMove = (e) => {
    if (e.pointerId !== joyPointerId.current) return
    e.preventDefault()
    e.stopPropagation()
    updateStick(e, e.currentTarget)
  }

  const onStickPointerUp = (e) => {
    if (e.pointerId !== joyPointerId.current) return
    e.preventDefault()
    e.stopPropagation()
    joyPointerId.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    setKnobPos({ x: 0, y: 0 })
    game.stickX = 0
    game.stickY = 0
  }

  const updateStick = (e, targetEl) => {
    const rect = targetEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = e.clientX - centerX
    const dy = e.clientY - centerY
    const maxRadius = 42

    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    const clampedDist = Math.min(dist, maxRadius)

    const px = Math.cos(angle) * clampedDist
    const py = Math.sin(angle) * clampedDist

    setKnobPos({ x: px, y: py })

    // Normalizado de -1 a 1.
    // Eixo Y na tela: para cima é dy < 0, mas no jogo queremos +Y para subir a nave
    game.stickX = px / maxRadius
    game.stickY = -py / maxRadius
  }

  // Disparo manual
  const onFireDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFiring(true)
    game.wantsToFire = true
  }

  const onFireUp = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFiring(false)
    if (!game.autoFire) {
      game.wantsToFire = false
    }
  }

  // Alternar Auto-Tiro
  const toggleAutoFire = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const nextVal = !autoFire
    setAutoFire(nextVal)
    game.autoFire = nextVal
    if (nextVal) {
      game.wantsToFire = true
    } else if (!isFiring) {
      game.wantsToFire = false
    }
  }

  // Turbo
  const onBoostDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsBoosting(true)
    game.touchBoost = true
  }

  const onBoostUp = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsBoosting(false)
    game.touchBoost = false
  }

  // Bomba de Prótons
  const onBombTap = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (game.bombs > 0) {
      game.wantsBomb = true
    }
  }

  // Giro Evasivo (Q/E)
  const onRollTap = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (game.rollCooldown <= 0 && game.rollTimer <= 0) {
      const dir = nextRollDir.current
      nextRollDir.current = -dir
      game.rollRequest = dir
    }
  }

  if (phase !== 'playing' || !isTouchCapable) return null

  return (
    <div className="touch-controls-layer">
      {/* Joystick Analógico Esquerdo */}
      <div
        className="touch-joystick-base"
        onPointerDown={onStickPointerDown}
        onPointerMove={onStickPointerMove}
        onPointerUp={onStickPointerUp}
        onPointerCancel={onStickPointerUp}
      >
        <div className="joystick-ring">
          <div className="joystick-crosshair h" />
          <div className="joystick-crosshair v" />
          <div className="joystick-arrow up">▲</div>
          <div className="joystick-arrow down">▼</div>
          <div className="joystick-arrow left">◀</div>
          <div className="joystick-arrow right">▶</div>
          <div
            className="joystick-knob"
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            }}
          >
            <div className="knob-core" />
          </div>
        </div>
        <div className="joystick-label">PILOTAR</div>
      </div>

      {/* Agrupamento de Ações à Direita */}
      <div className="touch-actions-group">
        {/* Toggle Auto-Tiro */}
        <button
          type="button"
          className={`touch-pill-btn ${autoFire ? 'active' : ''}`}
          onClick={toggleAutoFire}
        >
          <span className="dot" />
          AUTO-TIRO: {autoFire ? 'LIGADO' : 'DESLIGADO'}
        </button>

        <div className="touch-tactical-row">
          {/* Giro Evasivo */}
          <button
            type="button"
            className={`touch-tactical-btn roll ${rollOnCooldown ? 'disabled' : ''}`}
            onClick={onRollTap}
            title="Giro evasivo"
          >
            <span className="icon">⟲⟳</span>
            <span className="txt">GIRO</span>
          </button>

          {/* Turbo */}
          <button
            type="button"
            className={`touch-tactical-btn boost ${isBoosting ? 'active' : ''}`}
            onPointerDown={onBoostDown}
            onPointerUp={onBoostUp}
            onPointerCancel={onBoostUp}
            onPointerLeave={onBoostUp}
            title="Acelerar turbo"
          >
            <span className="icon">🚀</span>
            <span className="txt">TURBO</span>
          </button>

          {/* Bomba */}
          <button
            type="button"
            className={`touch-tactical-btn bomb ${bombsCount === 0 ? 'disabled' : ''}`}
            onClick={onBombTap}
            title="Lançar bomba de prótons"
          >
            <span className="icon">💣</span>
            <span className="badge">{bombsCount}</span>
          </button>
        </div>

        {/* Botão Principal de Tiro */}
        <button
          type="button"
          className={`touch-fire-btn ${isFiring || autoFire ? 'firing' : ''}`}
          onPointerDown={onFireDown}
          onPointerUp={onFireUp}
          onPointerCancel={onFireUp}
          onPointerLeave={onFireUp}
        >
          <div className="fire-ring" />
          <div className="fire-inner">
            <svg viewBox="0 0 24 24" className="fire-icon" fill="currentColor">
              <path d="M12 2L15 9H9L12 2Z" />
              <path d="M12 22L9 15H15L12 22Z" />
              <path d="M2 12L9 9V15L2 12Z" />
              <path d="M22 12L15 15V9L22 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="fire-text">TIRO</span>
          </div>
        </button>
      </div>
    </div>
  )
}
