// src/ui/Portrait.jsx
// Retrato dos personagens desenhado em SVG (sem imagens externas).
// A boca anima enquanto o personagem "fala" e os olhos piscam.
import { CAST } from '../characters'

function Hair({ L }) {
  const c = L.hairColor
  switch (L.hair) {
    case 'bun':
      return <path d="M30 38 Q30 16 50 16 Q70 16 70 38 Q64 24 50 23 Q36 24 30 38Z" fill={c} />
    case 'buzz':
      return <path d="M30 36 Q30 15 50 15 Q70 15 70 36 Q66 22 50 21 Q34 22 30 36Z" fill={c} opacity="0.9" />
    case 'bob':
      return <path d="M26 54 Q22 13 50 11 Q78 13 74 54 L69 54 Q70 30 61 25 Q52 35 33 30 Q30 40 31 54Z" fill={c} />
    case 'bald':
      return (
        <>
          <path d="M29.5 46 Q28 33 33 30 L34.5 46Z" fill={c} />
          <path d="M70.5 46 Q72 33 67 30 L65.5 46Z" fill={c} />
        </>
      )
    default:
      return null
  }
}

export default function Portrait({ who, talking }) {
  const c = CAST[who]
  const L = c.look
  const id = `pt-${who}`
  const browY = L.angry ? 2 : 0

  return (
    <svg viewBox="0 0 100 100" className={`portrait ${talking ? 'talking' : ''}`} aria-label={c.name}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor={c.color} stopOpacity="0.6" />
          <stop offset="100%" stopColor="#04060d" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-bg)`} />

      {/* Coque / capuz atrás da cabeça */}
      {L.hair === 'bun' && <circle cx="50" cy="17" r="8" fill={L.hairColor} />}
      {L.hood && <path d="M14 100 L19 42 Q50 -2 81 42 L86 100Z" fill={L.hood} />}

      {/* Uniforme */}
      <path d="M6 100 Q10 73 50 70 Q90 73 94 100Z" fill={L.suit} />
      <path d="M37 71 L50 86 L63 71" fill="none" stroke={L.trim} strokeWidth="2.5" />
      <rect x="66" y="82" width="12" height="5" rx="1" fill={L.trim} opacity="0.85" />

      {/* Pescoço, orelhas e rosto */}
      <path d="M42 58 L42 73 Q50 77 58 73 L58 58Z" fill={L.skinShade} />
      <ellipse cx="29.5" cy="45" rx="3.2" ry="5" fill={L.skinShade} />
      <ellipse cx="70.5" cy="45" rx="3.2" ry="5" fill={L.skinShade} />
      <path d="M30 40 Q30 18 50 18 Q70 18 70 40 Q70 58 58 64 Q50 68 42 64 Q30 58 30 40Z" fill={L.skin} />

      {L.beard && <path d="M32 48 Q34 64 50 67 Q66 64 68 48 Q62 60 50 61 Q38 60 32 48Z" fill={L.beard} opacity="0.5" />}
      {L.freckles &&
        [36, 39, 61, 64].map((x, i) => <circle key={i} cx={x} cy={50 + (i % 2)} r="0.7" fill="#b86a4a" opacity="0.7" />)}

      <Hair L={L} />

      {/* Quepe de oficial */}
      {L.cap && (
        <>
          <path d="M26 31 Q29 8 50 8 Q71 8 74 31Z" fill={L.cap} />
          <rect x="25" y="27.5" width="50" height="5" rx="2" fill="#0d1526" />
          <circle cx="50" cy="19" r="3.4" fill={L.trim} />
        </>
      )}
      {/* Capacete de piloto com viseira levantada */}
      {L.helmet && (
        <>
          <path d="M24 48 Q23 7 50 7 Q77 7 76 48 L70.5 48 Q70.5 21 50 20 Q29.5 21 29.5 48Z" fill={L.helmet} />
          <path d="M49 7.2 L51 7.2 L51 20 L49 20Z" fill={L.helmetStripe} />
          <path d="M30 23 Q50 11 70 23 L68 28 Q50 18 32 28Z" fill="#1b2a3a" opacity="0.92" />
        </>
      )}
      {/* Fone de comunicação */}
      {L.headset && (
        <>
          <path d="M28 44 Q27 13 50 12 Q73 13 72 44" fill="none" stroke="#1d1f24" strokeWidth="2.4" />
          <rect x="25" y="40" width="6" height="10" rx="2" fill="#2a2d33" />
          <path d="M28 49 Q32 60 43 61" fill="none" stroke="#1d1f24" strokeWidth="1.8" />
          <circle cx="44" cy="61" r="1.8" fill="#3a3d44" />
        </>
      )}

      {/* Sobrancelhas */}
      <path d={`M36 ${36 + browY} L46 ${37 - browY}`} stroke={L.brows} strokeWidth="2" strokeLinecap="round" />
      <path d={`M54 ${37 - browY} L64 ${36 + browY}`} stroke={L.brows} strokeWidth="2" strokeLinecap="round" />

      {/* Olhos (piscam via CSS) */}
      <g className="eyes">
        <ellipse cx="41" cy="43" rx="3.1" ry="2.3" fill="#f4f1ea" />
        <circle cx="41.4" cy="43.2" r="1.6" fill={L.eyes} />
        {!L.cyberEye && (
          <>
            <ellipse cx="59" cy="43" rx="3.1" ry="2.3" fill="#f4f1ea" />
            <circle cx="58.6" cy="43.2" r="1.6" fill={L.eyes} />
          </>
        )}
      </g>
      {L.cyberEye && (
        <>
          <path d="M53 37 L66 37 L67 49 L53 49Z" fill="#3b3f47" />
          <circle cx="59.5" cy="43" r="3" fill="#ff2a3a" className="cyber" />
        </>
      )}
      {L.glasses && (
        <g fill="none" stroke="#d9dde3" strokeWidth="1.2">
          <circle cx="41" cy="43" r="5" />
          <circle cx="59" cy="43" r="5" />
          <path d="M46 43 L54 43" />
        </g>
      )}
      {L.scar && <path d="M35 47 L40 56" stroke="#7a3a32" strokeWidth="1.3" opacity="0.8" />}

      {/* Nariz */}
      <path d="M50 44 L47.5 52 Q50 53.5 52.5 52" fill="none" stroke={L.skinShade} strokeWidth="1.4" />
      {L.mustache && <path d="M42 56 Q46 52.5 50 54.5 Q54 52.5 58 56 Q54 55 50 56 Q46 55 42 56Z" fill={L.mustache} />}

      {/* Boca: fechada + aberta (alterna enquanto fala) */}
      <path d={L.angry ? 'M44 58.5 Q50 56.5 56 58.5' : 'M44 57.5 Q50 60 56 57.5'} stroke="#5a2a22" strokeWidth="1.6" fill="none" />
      <ellipse className="mouth-open" cx="50" cy="58.3" rx="3.8" ry="2.4" fill="#3a1414" />
    </svg>
  )
}
