// src/ui/Hud.jsx
// HUD: lê o estado do jogo a cada quadro e escreve direto no DOM (sem re-render do React).
// Voo livre 360°: radar, marcadores nos inimigos visíveis e setas na borda para os que estão fora da tela.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { game, CONFIG, WEAPONS, MOTHERSHIP_TYPES, ENEMY_TYPES } from '../gameState'
import { missionProgress } from '../Director'
import { useUI, ui } from '../store'
import { togglePause } from '../flow'
import { toggleMute } from '../audio'
import TouchControls from './TouchControls'

const MARKERS = 26 // marcadores/setas reaproveitados
const RADAR_RANGE = 480 // alcance do radar (unidades)
const proj = new THREE.Vector3()
const rel = new THREE.Vector3()
const camFwd = new THREE.Vector3()
const inv = new THREE.Quaternion()

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

// Lista do que aparece no radar/marcadores: { pos, kind ('enemy' | 'mother' | 'boss' | 'goal' | 'item'), big }
function trackables(out) {
  out.length = 0
  for (const e of game.enemies) if (e.active) out.push({ pos: e.pos, kind: 'enemy', big: ENEMY_TYPES[e.type].radius > 2.7 })
  for (const m of game.motherships) if (m.active) out.push({ pos: m.pos, kind: 'mother', big: true })
  const b = game.boss
  if (b && b.active) out.push({ pos: b.pos, kind: 'boss', big: true })
  for (const p of game.pickups || []) if (p.active) out.push({ pos: p.pos, kind: p.type === 'goal' ? 'goal' : 'item', big: false })
  return out
}

export default function Hud() {
  const phase = useUI((s) => s.phase)
  const R = useRef({})
  const ref = (k) => (el) => (R.current[k] = el)
  const markers = useRef([])

  useEffect(() => {
    let id
    let lastRealized = -1
    const list = []
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
            r.meta.textContent =
              game.stage === 'orbit' ? `ROMPA O BLOQUEIO: ${Math.min(game.mstats?.orbitKills || 0, m.orbitKills)}/${m.orbitKills} abates` : 'META: destruir a Fortaleza do Caos'
            r.timer.textContent = ''
            r.waveBar.style.transform = `scaleX(${game.stage === 'orbit' ? Math.min(1, (game.mstats?.orbitKills || 0) / m.orbitKills) : 1})`
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

        // ---- Barra do chefe ou da nave-mãe mais próxima ----
        const b = game.boss
        let barName = ''
        let barHp = 0
        if (b && b.active) {
          barName = 'FORTALEZA KORRATH'
          barHp = b.hp()
        } else {
          let best = Infinity
          for (const ms of game.motherships) {
            if (!ms.active || !ms.reactor) continue
            const d = ms.pos.distanceToSquared(game.shipPos)
            if (d < best) {
              best = d
              const T = MOTHERSHIP_TYPES[ms.type]
              const max = T.turrets * T.turretHp + T.reactorHp
              const hp = ms.turrets.reduce((s2, t) => s2 + Math.max(0, t.hp), 0) + Math.max(0, ms.reactor.hp)
              barName = T.name.toUpperCase() + (ms.turrets.some((t) => t.alive) ? ' · DESTRUA AS TORRES' : ' · REATOR EXPOSTO')
              barHp = hp / max
            }
          }
        }
        r.bossWrap.style.opacity = barName ? 1 : 0
        if (barName) {
          r.bossName.textContent = barName
          r.bossBar.style.transform = `scaleX(${barHp})`
        }

        // ---- Local, altitude e velocidade ----
        const surf = game.stage === 'surface' || (game.stage === 'entry' && game.arrived)
        r.loc.textContent = surf && game.surfaceLabel ? game.surfaceLabel : game.stage === 'entry' ? 'ENTRADA NA ATMOSFERA' : 'EM ÓRBITA'
        r.alt.textContent = surf ? `ALT ${Math.round((game.shipPos.y - game.ground) * 2)} m` : ''
        r.spd.textContent = `${Math.round(game.speed * 2 * 3.6)} km/h`
        // Créditos das imagens de satélite (exigidos pelos provedores)
        const isMap = surf && game.surfaceKind && game.surfaceKind.startsWith('fortaleza')
        r.attrib.style.display = isMap ? 'block' : 'none'
        if (isMap)
          r.attrib.textContent =
            game.mapSource === 'eox'
              ? 'Imagens: Sentinel-2 cloudless — s2maps.eu, EOX IT Services GmbH (dados Copernicus 2016)'
              : 'Imagens de satélite: Esri, Maxar, Earthstar Geographics e comunidade GIS'

        // ---- Avisos de pilotagem ----
        const playing = game.phase === 'playing'
        r.warn.textContent = !playing ? '' : game.lowAltitude ? '⚠ ALTITUDE BAIXA — PUXE PARA CIMA' : game.outOfBounds ? '⚠ RETORNANDO À ÁREA DE COMBATE' : ''
        r.lookBack.style.opacity = game.lookBack && playing ? 1 : 0

        // ---- Clarão da reentrada ----
        let flash = 0
        if (game.stage === 'entry') {
          const t = game.entryT
          flash = t < 3.4 ? Math.max(0, (t - 1.6) / 1.8) ** 2 : t < 3.9 ? 1 : Math.max(0, 1 - (t - 3.9) / 1.2)
        }
        r.entry.style.opacity = flash

        // ---- Mira do mouse (joystick virtual) ----
        const showMouse = playing && game.mouseActive && game.stage !== 'entry'
        r.mouseDot.style.opacity = showMouse ? 1 : 0
        r.deadzone.style.opacity = showMouse ? 1 : 0
        if (showMouse) {
          r.mouseDot.style.transform = `translate(${((game.mouse.x + 1) / 2) * window.innerWidth}px, ${((1 - game.mouse.y) / 2) * window.innerHeight}px)`
        }

        // ---- Radar e marcadores 360° ----
        updateTracking(r, list, playing && game.stage !== 'entry')

        const low = sh < 0.25 && playing
        const pulse = low ? 0.35 + Math.sin(performance.now() / 160) * 0.2 : 0
        r.vignette.style.opacity = Math.min(1, game.damageFlash * 0.9 + pulse)
        r.alert.style.opacity = low ? 1 : 0
      }
      id = requestAnimationFrame(loop)
    }

    // Radar (vista de cima, nariz para cima) + marcadores na tela
    function updateTracking(r, list, active) {
      const ctx = r.radar?.getContext('2d')
      const cam = game.camera
      const W = window.innerWidth
      const H = window.innerHeight
      let used = 0
      if (ctx) {
        const S = r.radar.width
        ctx.clearRect(0, 0, S, S)
        // Fundo: círculos de distância e cone de visão
        ctx.strokeStyle = 'rgba(120,200,255,0.35)'
        ctx.lineWidth = 1
        for (const f of [1, 0.66, 0.33]) {
          ctx.beginPath()
          ctx.arc(S / 2, S / 2, (S / 2 - 2) * f, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(120,200,255,0.08)'
        ctx.beginPath()
        ctx.moveTo(S / 2, S / 2)
        ctx.arc(S / 2, S / 2, S / 2 - 2, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6)
        ctx.fill()
        // Nave do jogador no centro
        ctx.fillStyle = '#7cf3ff'
        ctx.beginPath()
        ctx.moveTo(S / 2, S / 2 - 6)
        ctx.lineTo(S / 2 - 4, S / 2 + 4)
        ctx.lineTo(S / 2 + 4, S / 2 + 4)
        ctx.fill()
      }
      if (active && cam) {
        inv.copy(game.shipQuatInv)
        camFwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
        const S = r.radar ? r.radar.width : 0
        for (const t of trackables(list)) {
          // Posição relativa no espaço LOCAL da nave: x = direita, y = cima, z = trás
          rel.subVectors(t.pos, game.shipPos).applyQuaternion(inv)
          const dist = rel.length()
          const color = t.kind === 'goal' ? '#5dff8a' : t.kind === 'item' ? '#ffd24a' : t.kind === 'boss' ? '#ff4dff' : '#ff4a4a'
          // --- Radar: x → horizontal, −z → para cima; acima/abaixo muda o brilho ---
          if (ctx) {
            const k = Math.min(1, dist / RADAR_RANGE)
            const flat = Math.hypot(rel.x, rel.z) || 1
            const px = S / 2 + (rel.x / flat) * k * (S / 2 - 6)
            const py = S / 2 + (rel.z / flat) * k * (S / 2 - 6)
            ctx.globalAlpha = dist > RADAR_RANGE ? 0.45 : rel.y < -15 ? 0.6 : 1
            ctx.fillStyle = color
            const size = t.kind === 'mother' || t.kind === 'boss' ? 6 : t.big ? 3.5 : 2.5
            if (t.kind === 'mother' || t.kind === 'boss') ctx.fillRect(px - size, py - size / 2, size * 2, size)
            else {
              ctx.beginPath()
              ctx.arc(px, py, size, 0, Math.PI * 2)
              ctx.fill()
            }
            // Traço vertical: inimigo acima (para cima) ou abaixo (para baixo) da nave
            if (Math.abs(rel.y) > 15 && dist < RADAR_RANGE) {
              ctx.fillRect(px - 0.5, py, 1, rel.y > 0 ? -5 : 5)
            }
            ctx.globalAlpha = 1
          }
          // --- Marcadores na tela ---
          if (used >= MARKERS || t.kind === 'item') continue
          const el = markers.current[used]
          if (!el) continue
          const worldDist = t.pos.distanceTo(cam.position)
          if (worldDist > 900 && t.kind === 'enemy') continue
          proj.subVectors(t.pos, cam.position)
          const behind = proj.dot(camFwd) < 0
          proj.copy(t.pos).project(cam)
          const onScreen = !behind && Math.abs(proj.x) < 0.95 && Math.abs(proj.y) < 0.92
          used++
          el.style.display = 'block'
          el.style.color = color
          if (onScreen) {
            // Colchetes em volta do alvo; tamanho cai com a distância
            const size = Math.max(16, Math.min(70, (t.big ? 2600 : 1500) / worldDist))
            const x = ((proj.x + 1) / 2) * W
            const y = ((1 - proj.y) / 2) * H
            el.className = 'trk box' + (game.assist && game.assist.pos === t.pos ? ' locked' : '')
            el.style.width = el.style.height = `${size}px`
            el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
            el.firstChild.textContent = t.kind === 'goal' || t.kind === 'mother' || t.kind === 'boss' ? `${Math.round(worldDist * 2)} m` : ''
          } else {
            // Seta na borda: direção do centro da tela até o ponto projetado (invertida se está atrás)
            let dx = proj.x
            let dy = proj.y
            if (behind) {
              dx = -dx
              dy = -dy
              if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) dy = -1
            }
            const a = Math.atan2(dy, dx)
            const rx = W / 2 - 46
            const ry = H / 2 - 46
            // Ponto na elipse da borda: (cos a · rx, sen a · ry)
            const x = W / 2 + Math.cos(a) * rx
            const y = H / 2 - Math.sin(a) * ry
            el.className = 'trk arrow' + (t.kind === 'enemy' ? '' : ' big')
            el.style.width = el.style.height = ''
            el.style.transform = `translate(${x - 12}px, ${y - 12}px) rotate(${-a}rad)`
            el.firstChild.textContent = ''
          }
        }
      }
      for (let i = used; i < MARKERS; i++) if (markers.current[i]) markers.current[i].style.display = 'none'
    }

    loop()
    return () => cancelAnimationFrame(id)
  }, [])

  const visible = phase === 'playing' || phase === 'paused' || phase === 'dying'

  return (
    <>
      <div className="damage-vignette" ref={ref('vignette')} />
      <div className="entry-flash" ref={ref('entry')} />
      <div className={`hud ${visible ? '' : 'hidden'}`}>
        {/* Marcadores 360° */}
        <div className="trk-layer">
          {Array.from({ length: MARKERS }, (_, i) => (
            <div key={i} className="trk" ref={(el) => (markers.current[i] = el)} style={{ display: 'none' }}>
              <span />
            </div>
          ))}
        </div>
        <div className="deadzone" ref={ref('deadzone')} />
        <div className="mouse-dot" ref={ref('mouseDot')} />

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
            <div className="label boss-label" ref={ref('bossName')}>
              FORTALEZA KORRATH
            </div>
            <div className="bar boss-bar">
              <div className="fill boss-fill" ref={ref('bossBar')} />
            </div>
          </div>
          <div className="flight-warn" ref={ref('warn')} />
        </div>

        <div className="hud-top-right">
          <button type="button" className="hud-icon-btn" onClick={() => ui.set({ muted: toggleMute() })} title="Ativar/desativar áudio [M]">
            {ui.get().muted ? '🔇' : '🔊'}
          </button>
          <button type="button" className="hud-icon-btn pause-btn" onClick={togglePause} title="Pausar jogo [P / ESC]">
            ⏸
          </button>
        </div>

        <div className="radar-wrap">
          <canvas className="radar" ref={ref('radar')} width={170} height={170} />
          <div className="radar-info">
            <div className="loc" ref={ref('loc')} />
            <div className="alt-spd">
              <span ref={ref('alt')} /> <span ref={ref('spd')} />
            </div>
          </div>
        </div>
        <div className="look-back" ref={ref('lookBack')}>
          ◀ VISÃO TRASEIRA ▶
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
          <div className="cam-hint">V · OLHAR PARA TRÁS · C · CÂMERA 360°</div>
        </div>

        <div className="map-attrib" ref={ref('attrib')} />
        <div className="low-alert" ref={ref('alert')}>
          ⚠ ESCUDO CRÍTICO ⚠
        </div>
        <Banner />
        <TouchControls />
      </div>
    </>
  )
}
