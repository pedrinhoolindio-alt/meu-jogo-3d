# Esquadrão Fênix — Operação Aurora

Jogo de nave 3D on-rails no navegador, com clima de batalha espacial épica.
Feito com React + Vite + Three.js + React Three Fiber + Drei + Postprocessing.

## Rodar localmente

```bash
npm install
npm run dev
```

## Controles

| Ação | Tecla |
| --- | --- |
| Mover | Mouse ou WASD / setas |
| Atirar | Clique ou Espaço (segure) |
| Turbo | Shift |
| Giro evasivo (rebate lasers) | Q / E |
| Bomba de prótons | B ou botão direito |
| Pausa | P ou Esc |
| Som | M |

## O que tem no jogo

- **3 fases + chefe final** (Fortaleza Korrath: destrua as 4 torres para expor o núcleo)
- **Inimigos**: Vespa (caça), Lança (interceptador em mergulho), Martelo (bombardeiro com plasma)
- **Alas aliados** que voam em formação e atiram sozinhos
- **Power-ups**: escudo (azul), arma (dourado: duplo → quádruplo → plasma) e bomba (vermelho)
- **Combos** com multiplicador até x5, recorde salvo no navegador
- **Rádio com personagens** (retratos animados em SVG): comandante, alas, engenheiro e o vilão
  comentam a missão, elogiam marcos de pontuação e alertam quando o escudo está baixo
- **Efeitos**: bloom, explosões com partículas, ondas de choque, tremor de tela, câmera lenta,
  planeta com atmosfera, nebulosas, naves capitais e batalha ao fundo
- **Som e música sintetizados** (Web Audio API, sem arquivos)

## Estrutura

| Arquivo | Função |
| --- | --- |
| `src/gameState.js` | Estado mutável, `CONFIG` (física/ajustes), fases (`WAVES`), colisões |
| `src/Director.jsx` | Roteiro: fases, spawn, chefe e gatilhos do rádio |
| `src/Player.jsx` | Nave, câmera, turbo, giro evasivo |
| `src/Lasers.jsx` / `src/EnemyLasers.jsx` | Tiros (pools instanciados) e bomba |
| `src/Enemies.jsx` / `src/Boss.jsx` / `src/Asteroids.jsx` | Inimigos |
| `src/Wingmen.jsx` / `src/Pickups.jsx` | Alas e power-ups |
| `src/Explosions.jsx` / `src/Environment.jsx` / `src/Effects.jsx` | Visual |
| `src/characters.js` / `src/radio.js` | Elenco e falas do rádio |
| `src/audio.js` | Efeitos sonoros e música |
| `src/ui/*` | HUD, rádio, retratos e telas |

Ajustes de jogabilidade ficam em `CONFIG`, `ENEMY_TYPES` e `WAVES` (`src/gameState.js`).
