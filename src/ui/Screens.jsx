// src/ui/Screens.jsx
// Telas: título, briefing da missão, relatório da missão, pausa e relatório anual (fim de jogo).
import { useEffect } from 'react'
import { useUI } from '../store'
import { startGame, togglePause, toMenu, startMission, nextMission } from '../flow'
import { MISSIONS } from '../gameState'
import { CAST } from '../characters'
import { playIntro } from '../audio'
import Portrait from './Portrait'

const stop = (e) => e.stopPropagation()
export const ORG_COLORS = { SESC: '#e8402f', SENAC: '#2f8fff', FECOMÉRCIO: '#2fd0b0', 'SESC + SENAC': '#ffb347' }

function Controls() {
  return (
    <div className="controls">
      <div><kbd>Mouse</kbd> / <kbd>WASD</kbd> ou <b>Joystick Touch</b> mover</div>
      <div><kbd>Clique</kbd> / <kbd>Espaço</kbd> ou <b>Botão TIRO</b> atirar</div>
      <div><kbd>Shift</kbd> ou <b>Botão TURBO</b> acelerar</div>
      <div><kbd>Q</kbd> <kbd>E</kbd> ou <b>Botão GIRO</b> esquiva</div>
      <div><kbd>B</kbd> ou <b>Botão BOMBA</b> detonar</div>
      <div><kbd>P</kbd> ou <b>Botão ⏸</b> pausar</div>
      <div className="mobile-hint" style={{ gridColumn: '1 / -1', color: 'var(--cyan)', marginTop: '4px' }}>
        📱 Celular: Use o Joystick na esquerda e os botões táticos na direita (com Auto-Tiro opcional)
      </div>
    </div>
  )
}

function Stars({ n, max = 3 }) {
  return (
    <span className="stars">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''}>★</span>
      ))}
    </span>
  )
}

const OrgTag = ({ org }) => (
  <span className="org-tag" style={{ '--org': ORG_COLORS[org] || '#7cf3ff' }}>
    {org}
  </span>
)

function Title() {
  const best = useUI((s) => s.best)

  useEffect(() => {
    playIntro()
    const onUserGesture = () => {
      playIntro()
      window.removeEventListener('click', onUserGesture)
      window.removeEventListener('keydown', onUserGesture)
      window.removeEventListener('touchstart', onUserGesture)
    }
    window.addEventListener('click', onUserGesture)
    window.addEventListener('keydown', onUserGesture)
    window.addEventListener('touchstart', onUserGesture)
    return () => {
      window.removeEventListener('click', onUserGesture)
      window.removeEventListener('keydown', onUserGesture)
      window.removeEventListener('touchstart', onUserGesture)
    }
  }, [])

  return (
    <div className="screen title-screen" onMouseDown={stop}>
      <div className="logo">
        <div className="logo-top">ESQUADRÃO</div>
        <div className="logo-main">FÊNIX</div>
        <div className="logo-sub">CAMPANHA DE METAS · SESC & SENAC CEARÁ</div>
      </div>
      <p className="story">
        A Armada do Caos Operacional, do Almirante Korrath, quer derrubar as metas do ano. Pedro, lidere o Esquadrão Fênix em 6
        missões — matrículas, atendimentos, turmas, turismo, ouvidoria e o fechamento anual — e bata cada meta antes do prazo.
      </p>
      <div className="crew">
        {['pedro', 'roberta', 'ivone', 'janiele', 'alan'].map((id) => (
          <div className="crew-card" key={id} style={{ '--accent': CAST[id].color }}>
            <Portrait who={id} />
            <div className="crew-name">{CAST[id].name}</div>
            <div className="crew-role">{CAST[id].role}</div>
          </div>
        ))}
      </div>
      <button id="botao-start" className="btn primary" onClick={startGame}>
        INICIAR CAMPANHA
      </button>
      {best > 0 && <div className="best">RECORDE: {best.toLocaleString('pt-BR')}</div>}
      <Controls />
    </div>
  )
}

function Briefing() {
  const index = useUI((s) => s.mission)
  const m = MISSIONS[index]
  const speaker = CAST[m.speaker]
  // Enter ou Espaço também iniciam a missão
  useEffect(() => {
    const onKey = (e) => {
      if (!e.repeat && (e.code === 'Enter' || e.code === 'Space')) startMission()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="screen briefing-screen" onMouseDown={stop}>
      <div className="mission-card" style={{ '--org': ORG_COLORS[m.org] }}>
        <div className="mission-head">
          <span className="mission-num">MISSÃO {index + 1} / {MISSIONS.length}</span>
          <OrgTag org={m.org} />
        </div>
        <h2 className="mission-title">{m.title}</h2>
        <div className="mission-place">{m.place}</div>
        <div className="mission-brief" style={{ '--accent': speaker.color }}>
          <div className="mission-portrait">
            <Portrait who={m.speaker} />
          </div>
          <div>
            <div className="radio-name">{speaker.name}</div>
            <p>{m.briefing}</p>
          </div>
        </div>
        <div className="objectives">
          <div className="obj main">
            <span>META</span>
            <b>{m.boss ? 'Destruir a Fortaleza do Caos' : `${m.indicator.meta} ${m.indicator.label}`}</b>
          </div>
          {!m.boss && (
            <div className="obj">
              <span>PRAZO</span>
              <b>{m.duration} segundos</b>
            </div>
          )}
          <div className="obj">
            <span>BÔNUS</span>
            <b>{m.bonus.label}</b>
          </div>
          <div className="obj wide">
            <span>ESTRELAS</span>
            <b>★ meta 100% · ★ superação 130% · ★ bônus</b>
          </div>
        </div>
        <button className="btn primary" onClick={startMission}>
          INICIAR MISSÃO
        </button>
        <div className="hint-small">Enter / Espaço</div>
      </div>
    </div>
  )
}

function Debrief() {
  const r = useUI((s) => s.debrief)
  useEffect(() => {
    const onKey = (e) => {
      if (!e.repeat && (e.code === 'Enter' || e.code === 'Space')) nextMission()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!r) return null
  const hit = r.pct >= 100
  const comment = r.pct >= 130 ? 'Superação! Resultado acima de 130% da meta.' : hit ? 'Meta batida dentro do prazo. Ótimo trabalho!' : 'Meta não atingida. Vamos recuperar na próxima missão!'
  return (
    <div className="screen debrief-screen" onMouseDown={stop}>
      <div className="mission-card" style={{ '--org': ORG_COLORS[r.org] }}>
        <div className="mission-head">
          <span className="mission-num">RELATÓRIO DA MISSÃO</span>
          <OrgTag org={r.org} />
        </div>
        <h2 className="mission-title">{r.title}</h2>
        <div className={`big-pct ${hit ? 'ok' : 'bad'}`}>{r.pct}%</div>
        <div className="pct-label">de atingimento da meta</div>
        <div className="gauge">
          <div className={`gauge-fill ${hit ? 'ok' : 'bad'}`} style={{ width: `${Math.min(100, r.pct / 1.5)}%` }} />
          <div className="gauge-mark" />
        </div>
        <div className="kpis">
          <div><span>META</span><b>{r.meta}</b></div>
          <div><span>REALIZADO</span><b>{r.realized}</b></div>
          <div><span>PRECISÃO</span><b>{r.accuracy}%</b></div>
        </div>
        <div className={`bonus-line ${r.bonusOk ? 'ok' : 'bad'}`}>
          {r.bonusOk ? '✔' : '✖'} Bônus: {r.bonusLabel} (obtido: {r.bonusValue})
        </div>
        <Stars n={r.stars} />
        <div className="mission-brief" style={{ '--accent': CAST.alan.color }}>
          <div className="mission-portrait">
            <Portrait who="alan" />
          </div>
          <div>
            <div className="radio-name">{CAST.alan.name} · BI</div>
            <p>{comment}</p>
          </div>
        </div>
        <button className="btn primary" onClick={nextMission}>
          PRÓXIMA MISSÃO
        </button>
      </div>
    </div>
  )
}

function Pause() {
  return (
    <div className="screen pause-screen" onMouseDown={stop}>
      <h2>PAUSADO</h2>
      <button className="btn primary" onClick={togglePause}>
        CONTINUAR
      </button>
      <button className="btn" onClick={toMenu}>
        ABANDONAR CAMPANHA
      </button>
      <Controls />
    </div>
  )
}

function Result({ kind }) {
  const result = useUI((s) => s.result)
  const best = useUI((s) => s.best)
  if (!result) return null
  const win = kind === 'victory'
  const speaker = win ? 'roberta' : 'janiele'
  const quote = win
    ? `Pedro, fechamos o ano com ${result.overall}% de atingimento médio das metas. O Sesc e o Senac agradecem a você e à equipe!`
    : 'A gente te tira daí, Pedro. Respira fundo e volta pro cockpit — as metas ainda podem ser batidas!'
  return (
    <div className={`screen result-screen ${win ? 'win' : 'lose'}`} onMouseDown={stop}>
      <h1>{win ? 'METAS DO ANO FECHADAS!' : 'NAVE ABATIDA'}</h1>
      <div className="result-quote" style={{ '--accent': CAST[speaker].color }}>
        <div className="result-portrait">
          <Portrait who={speaker} />
        </div>
        <div>
          <div className="radio-name">{CAST[speaker].name}</div>
          <p>{quote}</p>
        </div>
      </div>

      {/* Relatório anual de metas */}
      <div className="report">
        <div className="report-title">RELATÓRIO ANUAL DE METAS</div>
        <table>
          <thead>
            <tr>
              <th>Missão</th>
              <th>Meta</th>
              <th>Realizado</th>
              <th>%</th>
              <th>Bônus</th>
              <th>Estrelas</th>
            </tr>
          </thead>
          <tbody>
            {result.report.map((r, i) => (
              <tr key={i}>
                <td>
                  <OrgTag org={r.org} /> {r.title}
                  {r.incomplete && <em> (interrompida)</em>}
                </td>
                <td>{r.meta}</td>
                <td>{r.realized}</td>
                <td className={r.pct >= 100 ? 'ok' : 'bad'}>{r.pct}%</td>
                <td className={r.bonusOk ? 'ok' : 'bad'}>{r.bonusOk ? '✔' : '✖'}</td>
                <td>
                  <Stars n={r.stars} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="report-total">
          <span>
            Atingimento médio: <b className={result.overall >= 100 ? 'ok' : 'bad'}>{result.overall}%</b>
          </span>
          <span>
            Estrelas: <b>{result.stars}</b> / {result.maxStars}
          </span>
          <span>
            Pontos: <b>{result.score.toLocaleString('pt-BR')}</b>
          </span>
        </div>
      </div>

      {result.newRecord ? <div className="record">★ NOVO RECORDE ★</div> : <div className="best">RECORDE: {best.toLocaleString('pt-BR')}</div>}
      <button className="btn primary" onClick={startGame}>
        {win ? 'JOGAR NOVAMENTE' : 'TENTAR NOVAMENTE'}
      </button>
      <button className="btn" onClick={toMenu}>
        MENU PRINCIPAL
      </button>
    </div>
  )
}

export default function Screens() {
  const phase = useUI((s) => s.phase)
  if (phase === 'title') return <Title />
  if (phase === 'briefing') return <Briefing />
  if (phase === 'debrief') return <Debrief />
  if (phase === 'paused') return <Pause />
  if (phase === 'gameover' || phase === 'victory') return <Result kind={phase} />
  return null
}
