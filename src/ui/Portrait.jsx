// src/ui/Portrait.jsx
// Retratos: os aliados usam fotos com tratamento de "transmissão" (moldura, varredura, brilho);
// o vilão é uma ilustração vetorial (SVG) com máscara metálica.
import { useId } from 'react'
import { CAST } from '../characters'
import { photoUrl } from '../assets'

// ---------------------------------------------------------------------------
// Peças compartilhadas
// ---------------------------------------------------------------------------
function Backdrop({ id, accent, kind }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-bg`} cx="30%" cy="85%" r="95%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="45%" stopColor="#0b1220" />
          <stop offset="100%" stopColor="#03050b" />
        </radialGradient>
      </defs>
      <rect width="200" height="240" fill={`url(#${id}-bg)`} />
      {kind === 'cockpit' && (
        <g opacity="0.5">
          {/* Moldura da cabine e painel de instrumentos atrás do piloto */}
          <path d="M0 40 L60 0 M200 40 L140 0" stroke="#2a3446" strokeWidth="6" />
          <path d="M0 150 L30 130 L30 240 M200 150 L170 130 L170 240" fill="#0d131e" stroke="#1c2535" strokeWidth="2" />
          {[140, 152, 164, 176].map((y, i) => (
            <rect key={i} x="6" y={y} width="16" height="5" rx="1" fill={i % 2 ? accent : '#ffb347'} opacity="0.55" />
          ))}
          {[146, 160, 174].map((y, i) => (
            <circle key={i} cx="186" cy={y} r="3" fill={i === 1 ? '#ff4d5e' : accent} opacity="0.7" />
          ))}
        </g>
      )}
      {kind === 'bridge' && (
        <g opacity="0.45">
          {/* Janela panorâmica da ponte com estrelas */}
          <path d="M0 20 L200 20 L200 120 L0 120Z" fill="#071226" />
          {[...Array(26)].map((_, i) => (
            <circle key={i} cx={(i * 53) % 200} cy={24 + ((i * 37) % 92)} r={i % 5 === 0 ? 1.1 : 0.6} fill="#cfe6ff" />
          ))}
          <path d="M0 20 L200 20 M66 20 L66 120 M134 20 L134 120 M0 120 L200 120" stroke="#25344d" strokeWidth="4" />
        </g>
      )}
      {kind === 'lab' && (
        <g opacity="0.45">
          <path d="M14 0 L14 240 M30 0 L30 240" stroke="#2b3a2f" strokeWidth="7" />
          <path d="M160 30 L200 30 M160 60 L200 60" stroke="#2b3a2f" strokeWidth="5" />
          {[44, 90, 136].map((y) => (
            <rect key={y} x="168" y={y} width="22" height="10" rx="2" fill="#7dff8a" opacity="0.35" />
          ))}
        </g>
      )}
      {kind === 'enemy' && (
        <g opacity="0.55">
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${i * 50 - 10} 0 L${i * 50 + 20} 0 L${i * 50 - 20} 240 L${i * 50 - 50} 240Z`} fill="#2a0508" />
          ))}
          <rect x="0" y="0" width="200" height="6" fill="#ff2a3a" opacity="0.6" />
        </g>
      )}
    </>
  )
}

// Vilão: máscara metálica angular com três fendas vermelhas
function Korrath({ id }) {
  return (
    <>
      <Backdrop id={id} accent="#ff2a3a" kind="enemy" />
      <defs>
        <linearGradient id={`${id}-chrome`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#f2f4f8" />
          <stop offset="30%" stopColor="#8b939f" />
          <stop offset="55%" stopColor="#2a2f37" />
          <stop offset="75%" stopColor="#a7aeb9" />
          <stop offset="100%" stopColor="#1a1d22" />
        </linearGradient>
        <linearGradient id={`${id}-hood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a0a12" />
          <stop offset="100%" stopColor="#0d0205" />
        </linearGradient>
        <radialGradient id={`${id}-eye`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fff2c0" />
          <stop offset="35%" stopColor="#ff3a2a" />
          <stop offset="100%" stopColor="#5a0006" />
        </radialGradient>
      </defs>
      {/* Capa e armadura de gola com espinhos */}
      <path d="M0 240 L0 190 C30 170 60 166 100 166 C140 166 170 170 200 190 L200 240Z" fill="#1d0508" />
      <path d="M40 240 L52 182 L76 196 L100 176 L124 196 L148 182 L160 240Z" fill={`url(#${id}-chrome)`} opacity="0.85" />
      <path d="M52 182 L44 160 L64 186 M148 182 L156 160 L136 186" fill="#8b939f" />
      <circle cx="100" cy="214" r="9" fill="#2a0508" stroke="#ff2a3a" strokeWidth="2" />
      <path d="M100 207 L104 214 L100 221 L96 214Z" fill="#ff3a2a" className="lens" />
      {/* Capuz */}
      <path d="M34 190 C26 120 44 40 100 28 C156 40 174 120 166 190 C150 176 128 170 100 170 C72 170 50 176 34 190Z" fill={`url(#${id}-hood)`} />
      <path d="M50 170 C48 110 66 58 100 46 C134 58 152 110 150 170" stroke="#000" strokeOpacity="0.55" strokeWidth="6" fill="none" />
      {/* Máscara */}
      <path d="M66 76 L100 58 L134 76 L138 118 L122 152 L100 162 L78 152 L62 118 Z" fill={`url(#${id}-chrome)`} />
      <path d="M100 58 L100 162" stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M66 76 L100 92 L134 76 M62 118 L100 128 L138 118" stroke="#000" strokeOpacity="0.3" strokeWidth="1.2" fill="none" />
      {/* Três fendas oculares */}
      <path d="M72 100 L94 106 L92 112 L74 108Z" fill={`url(#${id}-eye)`} className="lens" />
      <path d="M128 100 L106 106 L108 112 L126 108Z" fill={`url(#${id}-eye)`} className="lens" />
      <path d="M97 78 L103 78 L102 92 L98 92Z" fill={`url(#${id}-eye)`} className="lens" />
      {/* Grade de respiração */}
      {[134, 140, 146].map((y) => (
        <path key={y} d={`M86 ${y} L114 ${y}`} stroke="#0d0f12" strokeWidth="3" strokeLinecap="round" />
      ))}
      <path d="M62 118 C60 98 62 86 66 76" stroke="#ff4d5e" strokeOpacity="0.6" strokeWidth="2" fill="none" />
    </>
  )
}

export default function Portrait({ who, talking }) {
  const raw = useId()
  const c = CAST[who]
  if (c.photo) {
    return (
      <div className={`portrait photo-portrait ${c.holo ? 'holo' : ''} ${talking ? 'talking' : ''}`} style={{ '--accent': c.color }}>
        <img src={photoUrl(c.photo)} alt={c.name} draggable={false} />
        <div className="pp-tint" />
        <div className="pp-scan" />
        <div className="pp-corners" />
      </div>
    )
  }
  const id = 'p' + raw.replace(/[^a-zA-Z0-9]/g, '') + who
  return (
    <svg viewBox="0 0 200 240" preserveAspectRatio="xMidYMid slice" className={`portrait p-${who} ${talking ? 'talking' : ''}`}>
      <Korrath id={id} />
    </svg>
  )
}
