// src/ui/Radio.jsx
// Caixa de comunicação: retrato animado + nome + texto em efeito "máquina de escrever".
import { useEffect, useState } from 'react'
import { useUI } from '../store'
import { CAST } from '../characters'
import Portrait from './Portrait'

export default function Radio() {
  const msg = useUI((s) => s.radio)
  const phase = useUI((s) => s.phase)
  const [shown, setShown] = useState('')

  useEffect(() => {
    if (!msg) return
    setShown('')
    let i = 0
    const id = setInterval(() => {
      i += 2
      setShown(msg.text.slice(0, i))
      if (i >= msg.text.length) clearInterval(id)
    }, 28)
    return () => clearInterval(id)
  }, [msg])

  if (!msg || !(phase === 'playing' || phase === 'paused' || phase === 'dying')) return null
  const c = CAST[msg.who]
  const typing = shown.length < msg.text.length

  return (
    <div key={msg.id} className={`radio ${c.hostile ? 'hostile' : ''}`} style={{ '--accent': c.color }}>
      <div className="radio-portrait">
        <Portrait who={msg.who} talking={typing} />
        
      </div>
      <div className="radio-body">
        <div className="radio-head">
          <span className="radio-dot" />
          <span className="radio-name">{c.name}</span>
          {/* Onda de voz: barras animadas enquanto o personagem fala */}
          <span className={`voice ${typing ? 'on' : ''}`}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <i key={i} style={{ animationDelay: `${i * 0.07}s` }} />
            ))}
          </span>
        </div>
        <div className="radio-role">{c.role}</div>
        <div className="radio-text">
          {shown}
          {typing && <span className="caret">▌</span>}
        </div>
      </div>
    </div>
  )
}
