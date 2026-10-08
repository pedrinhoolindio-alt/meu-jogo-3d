// src/ui/Screens.jsx
// Telas: título, pausa, derrota e vitória.
import { useUI } from '../store'
import { startGame, togglePause, toMenu } from '../flow'
import { CAST } from '../characters'
import Portrait from './Portrait'

const stop = (e) => e.stopPropagation()

function Controls() {
  return (
    <div className="controls">
      <div><kbd>Mouse</kbd> / <kbd>WASD</kbd> mover</div>
      <div><kbd>Clique</kbd> / <kbd>Espaço</kbd> atirar</div>
      <div><kbd>Shift</kbd> turbo</div>
      <div><kbd>Q</kbd> <kbd>E</kbd> giro evasivo (rebate lasers)</div>
      <div><kbd>B</kbd> / <kbd>Botão direito</kbd> bomba</div>
      <div><kbd>P</kbd> pausa · <kbd>M</kbd> som</div>
    </div>
  )
}

function Title() {
  const best = useUI((s) => s.best)
  return (
    <div className="screen title-screen" onMouseDown={stop}>
      <div className="logo">
        <div className="logo-top">ESQUADRÃO</div>
        <div className="logo-main">FÊNIX</div>
        <div className="logo-sub">OPERAÇÃO AURORA</div>
      </div>
      <p className="story">
        A Armada Escarlate do Almirante Korrath invadiu o Cinturão de Kepler. Você é o Fênix Líder — rompa as linhas inimigas e
        destrua a Fortaleza Korrath antes que ela alcance o cruzador Aurora.
      </p>
      <div className="crew">
        {['vasquez', 'faisca', 'ramos', 'brenner'].map((id) => (
          <div className="crew-card" key={id} style={{ '--accent': CAST[id].color }}>
            <Portrait who={id} />
            <div className="crew-name">{CAST[id].name}</div>
            <div className="crew-role">{CAST[id].role}</div>
          </div>
        ))}
      </div>
      <button className="btn primary" onClick={startGame}>
        INICIAR MISSÃO
      </button>
      {best > 0 && <div className="best">RECORDE: {best.toLocaleString('pt-BR')}</div>}
      <Controls />
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
        ABANDONAR MISSÃO
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
  const speaker = win ? 'vasquez' : 'ramos'
  const quote = win
    ? 'Missão cumprida, Fênix Líder. A frota inteira deve a vida a você.'
    : 'A gente te tira daí, Líder. Respira fundo e volta pro cockpit — a Aurora precisa de você.'
  return (
    <div className={`screen result-screen ${win ? 'win' : 'lose'}`} onMouseDown={stop}>
      <h1>{win ? 'VITÓRIA!' : 'NAVE ABATIDA'}</h1>
      <div className="result-quote" style={{ '--accent': CAST[speaker].color }}>
        <div className="result-portrait">
          <Portrait who={speaker} />
        </div>
        <div>
          <div className="radio-name">{CAST[speaker].name}</div>
          <p>{quote}</p>
        </div>
      </div>
      <div className="stats">
        <div><span>PONTOS</span><b>{result.score.toLocaleString('pt-BR')}</b></div>
        <div><span>ABATES</span><b>{result.kills}</b></div>
        <div><span>MAIOR COMBO</span><b>{result.maxCombo}</b></div>
        <div><span>PRECISÃO</span><b>{result.accuracy}%</b></div>
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
  if (phase === 'paused') return <Pause />
  if (phase === 'gameover' || phase === 'victory') return <Result kind={phase} />
  return null
}
