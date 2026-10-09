// src/ui/Hud.jsx
// HUD: lê o estado do jogo a cada quadro e escreve direto no DOM (sem re-render do React).
import { useEffect, useRef } from 'react'
import { game, CONFIG, WEAPONS } from '../gameState'
import { missionProgress } from '../Director'
import { useUI } from '../store'


function Banner() {
  const banner = useUI((s) => s.banner)
  if (!banner) return null
  return (
    <div key={banner.id} className={`banner ${banner.alert ? 'alert' : ''}`}>
      <div className="banner-title">{banner.alert ? '⚠ ' + banner.title + ' ⚠' : banner.title}</div>
      <div className="banner-sub">{banner.sub}</div>
    </div>
  )
}

export default function Hud() {
  const phase = useUI((s) => s.phase)
  const R = useRef({})
  const ref = (k) => (el) => (R.current[k] = el)

  useEffect(() => {
    let id
    let lastRealized = -1
    const loop = () => {
      const r = R.current
      if (r.score) {
        r.score.textContent = game.score.toLocaleString('pt-BR')
        r.mult.textContent = game.multiplier > 1 ? `x${game.multiplier}` : ''
        r.combo.textContent = game.combo >= 3 ? `${game.combo} ABATES SEGUIDOS` : ''

        const sh = game.shield / CONFIG.maxShield
        r.shieldBar.style.transform = `scaleX(${sh})`
        r.shieldBar.style.background = sh > 0.5 ? 'linear-gradient(90deg,#2fd0ff,#7cf3ff)' : sh > 0.25 ? 'linear-gradient(90deg,#ffb020,#ffd060)' : 'linear-gradient(90deg,#ff2a3a,#ff6a5a)'
        r.shieldTxt.textContent = Math.ceil(game.shield)
        r.boostBar.style.transform = `scaleX(${game.boost})`
        r.boostBar.style.opacity = game.boosting ? 1 : 0.75
        r.bombs.textContent = game.bombs > 0 ? '◆ '.repeat(game.bombs).trim() : '—'
        r.weapon.textContent = WEAPONS[game.weaponLevel]
        r.weaponLvl.textContent = '▮'.repeat(game.weaponLevel + 1) + '▯'.repeat(CONFIG.maxWeaponLevel - game.weaponLevel)
        r.missiles.textContent = game.missiles > 0 ? `${game.missiles}` : '—'
        r.drone.style.display = game.droneTime > 0 ? 'block' : 'none'
        if (game.droneTime > 0) r.drone.textContent = `DRONE ${Math.ceil(game.droneTime)}s`
        r.roll.classList.toggle('cooldown', game.rollCooldown > 0)

        // ---- Painel da missão: meta, realizado, atingimento e prazo ----
        const { realized, meta, pct, m } = missionProgress()
        if (m) {
          r.wave.textContent = `${m.org} · ${m.title}`
          if (m.boss) {
            r.meta.textContent = 'META: destruir a Fortaleza do Caos'
            r.timer.textContent = ''
            r.waveBar.style.transform = 'scaleX(1)'
          } else {
            r.meta.textContent = `${realized}/${meta} ${m.indicator.label} · ${Math.round(pct * 100)}%`
            const t = Math.max(0, Math.ceil(game.missionTime))
            r.timer.textContent = `PRAZO ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
            r.timer.classList.toggle('urgent', t <= 15)
            // A barra vai até 150% da meta; a marca branca indica 100%
            r.waveBar.style.transform = `scaleX(${Math.min(1, pct / 1.5)})`
          }
          r.waveBar.classList.toggle('done', pct >= 1)
          // "+1 matrícula" flutuando a cada avanço
          if (realized > lastRealized && lastRealized >= 0 && !m.boss) {
            const pop = document.createElement('div')
            pop.className = 'meta-pop'
            pop.textContent = `+${realized - lastRealized} ${m.indicator.unit}`
            r.pops.appendChild(pop)
            setTimeout(() => pop.remove(), 1100)
          }
          lastRealized = realized
        }

        const b = game.boss
        const showBoss = !!(b && b.active)
        r.bossWrap.style.opacity = showBoss ? 1 : 0
        if (showBoss) r.bossBar.style.transform = `scaleX(${b.hp()})`

        const low = sh < 0.25 && game.phase === 'playing'
        const pulse = low ? 0.35 + Math.sin(performance.now() / 160) * 0.2 : 0
        r.vignette.style.opacity = Math.min(1, game.damageFlash * 0.9 + pulse)
        r.alert.style.opacity = low ? 1 : 0
      }
      id = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(id)
  }, [])

  const visible = phase === 'playing' || phase === 'paused' || phase === 'dying'

  return (
    <>
      <div className="damage-vignette" ref={ref('vignette')} />
      <div className={`hud ${visible ? '' : 'hidden'}`}>
        <div className="hud-top-left">
          <div className="label">PONTOS</div>
          <div className="score">
            <span ref={ref('score')}>0</span>
            <span className="mult" ref={ref('mult')} />
          </div>
          <div className="combo" ref={ref('combo')} />
        </div>

        <div className="hud-top-center">
          <div className="wave" ref={ref('wave')} />
          <div className="meta-row">
            <span className="meta-text" ref={ref('meta')} />
            <span className="meta-timer" ref={ref('timer')} />
          </div>
          <div className="bar meta-bar">
            <div className="fill wave-fill" ref={ref('waveBar')} />
            <div className="meta-mark" />
          </div>
          <div className="meta-pops" ref={ref('pops')} />
          <div className="boss" ref={ref('bossWrap')}>
            <div className="label boss-label">FORTALEZA KORRATH</div>
            <div className="bar boss-bar">
              <div className="fill boss-fill" ref={ref('bossBar')} />
            </div>
          </div>
        </div>

        <div className="hud-bottom-left">
          <div className="label">
            ESCUDO <span ref={ref('shieldTxt')}>100</span>
          </div>
          <div className="bar shield">
            <div className="fill" ref={ref('shieldBar')} />
          </div>
          <div className="label small">TURBO [SHIFT]</div>
          <div className="bar thin">
            <div className="fill boost-fill" ref={ref('boostBar')} />
          </div>
        </div>

        <div className="hud-bottom-right">
          <div className="label">ARMA</div>
          <div className="value" ref={ref('weapon')} />
          <div className="weapon-lvl" ref={ref('weaponLvl')} />
          <div className="sec-row">
            <div>
              <div className="label">MÍSSEIS [F]</div>
              <div className="value missiles" ref={ref('missiles')} />
            </div>
            <div>
              <div className="label">BOMBAS [B]</div>
              <div className="value bombs" ref={ref('bombs')} />
            </div>
          </div>
          <div className="drone-tag" ref={ref('drone')} />
          <div className="roll" ref={ref('roll')}>
            GIRO [Q/E]
          </div>
          <div className="cam-hint">C · CÂMERA 360°</div>
        </div>

        <div className="low-alert" ref={ref('alert')}>
          ⚠ ESCUDO CRÍTICO ⚠
        </div>
        <Banner />
      </div>
    </>
  )
}
