# Esquadrão Fênix — Campanha de Metas Sesc & Senac Ceará

Jogo de nave 3D no navegador com **voo livre 360°** e clima de batalha espacial épica.
Feito com React + Vite + Three.js + React Three Fiber + Drei + Postprocessing.

## Rodar localmente

```bash
npm install
npm run dev
```

## Controles

| Ação | Tecla |
| --- | --- |
| Pilotar (voo livre 360°) | Mouse: aponte para onde quer virar (o centro da tela = reto) |
| Subir / descer o nariz | W / S (ou setas ↑ ↓) |
| Virar para os lados | A / D (ou setas ← →) |
| Olhar para trás | V (segure) |
| Atirar | Clique ou Espaço (segure) — a mira trava sozinha em inimigos perto do centro |
| Turbo | Shift |
| Giro evasivo (rebate lasers) | Q / E |
| Mísseis teleguiados | F ou botão do meio |
| Bomba de prótons | B ou botão direito |
| Câmera 360° (modo foto) | C |
| Pausa | P ou Esc |
| Som | M |

No celular: joystick na tela (ou arrastar o dedo) para pilotar e botões de tiro, turbo, giro, míssil e bomba.

O **radar** (canto superior direito) mostra tudo em volta da nave; inimigos fora da tela aparecem como
**setas vermelhas na borda**, e os visíveis ganham colchetes (vermelho = inimigo, verde = cápsula de meta,
rosa = chefe).

## Campanha

Cada missão tem duas etapas: **combate em órbita** e, na metade do prazo, a **entrada na atmosfera**
(cinemática com reentrada em chamas) para a batalha perto do solo.

| # | Org. | Missão | Órbita → Atmosfera | Meta | Naves-mãe |
| --- | --- | --- | --- | --- | --- |
| 1 | SENAC | Campanha de Matrículas | Terra → **céu de Fortaleza-CE** | 22 matrículas | Leviatã (sobre Fortaleza) |
| 2 | SESC | Saúde & Odontologia | Lua → superfície lunar | 10 atendimentos | Colmeia-Mãe |
| 3 | SENAC | Ativo Aula | Marte → Valles Marineris | 28 turmas | Titã · Leviatã |
| 4 | SESC | Turismo Social & Cultura | Júpiter → topo das nuvens | 12 passageiros | Colmeia-Mãe |
| 5 | FECOMÉRCIO | Ouvidoria em Dia | Saturno → tempestade | 34 respostas | Leviatã · Titã · Colmeia-Mãe |
| 6 | SESC + SENAC | Fechamento Anual de Metas | Bloqueio em órbita → **amanhecer sobre Fortaleza** | Destruir a Fortaleza do Caos | Titã |

O solo de Fortaleza usa **imagens de satélite reais** baixadas na hora pelo navegador (Esri World Imagery;
se não estiver disponível, Sentinel-2 cloudless da EOX). Os créditos aparecem no canto da tela.

No fim de cada missão, o relatório mostra meta × realizado, % de atingimento e estrelas
(★ meta 100% · ★ superação 130% · ★ bônus). O fim da campanha traz o **Relatório Anual de Metas**.
As missões ficam em `MISSIONS` (`src/gameState.js`) — dá para mudar metas, prazos, inimigos e naves-mãe ali.

## Frota inimiga (só naves — sem meteoros)

| Tipo | Nave | Comportamento |
| --- | --- | --- |
| Caças | Vespa, Lança, Espectro (ás), Raptor | Passam atirando, arremetem e voltam |
| Suicidas | Agulha, Enxame (em grupos de 4) | Perseguem e colidem |
| Atiradores | Ferrão, Arpão | Mira laser vermelha + tiro carregado de longe |
| Pesadas | Martelo, Ômega, Sentinela | Circulam a distância e disparam em leque |
| Teleguiado | Arraia, Tormenta | Plasma roxo que persegue (dá para derrubar a tiros) |
| Passadas | Corsário | Ataques laterais |
| Porta-naves | Colmeia, Colmeia Real | Lançam Agulhas / Enxames |
| **Naves-mãe** | Leviatã, Titã, Colmeia-Mãe | Torres no casco + hangares que lançam caças + reator na traseira (ponto fraco, com escudo enquanto houver torres). Vale 5 na meta |
| **Chefe** | Fortaleza Korrath | 4 torres protegem o núcleo |

## Armas e itens

5 níveis de arma (duplo → quádruplo → plasma → plasma em leque → hiper-laser perfurante), mísseis
teleguiados, bombas de prótons e drone de escolta. Itens: escudo (azul), arma (dourado), bomba (vermelho),
mísseis (laranja), drone (ciano) e cápsulas de meta (verde).

Os arquivos grandes (modelos e texturas) ficam no repositório público
[fenix-assets](https://github.com/pedrinhoolindio-alt/fenix-assets) e são baixados pela CDN jsDelivr.

## Estrutura

| Arquivo | Função |
| --- | --- |
| `src/gameState.js` | Estado mutável, `CONFIG` (voo/ajustes), `ENEMY_TYPES`, `MOTHERSHIP_TYPES`, `MISSIONS`, colisões e alvos |
| `src/Director.jsx` | Roteiro da missão: etapas, nascimento de inimigos e naves-mãe, chefe e rádio |
| `src/Player.jsx` | Voo livre 360° (quaternions), câmera de perseguição, mira automática, cinemática de reentrada |
| `src/Enemies.jsx` / `src/Motherships.jsx` / `src/Boss.jsx` | Inimigos, naves-mãe e chefe |
| `src/Lasers.jsx` / `src/EnemyLasers.jsx` / `src/Missiles.jsx` | Tiros, bomba, mísseis e drone |
| `src/Space.jsx` / `src/Surface.jsx` | Planetas em órbita e subfase planetária (Fortaleza, Lua, Marte, Júpiter, Saturno) |
| `src/Wingmen.jsx` / `src/Pickups.jsx` | Alas e itens |
| `src/Explosions.jsx` / `src/Environment.jsx` / `src/Effects.jsx` | Visual |
| `src/characters.js` / `src/radio.js` | Elenco e falas do rádio |
| `src/audio.js` | Efeitos sonoros e música |
| `src/ui/*` | HUD (radar, marcadores 360°), rádio, retratos e telas |

## Créditos

- Naves: Quaternius Ultimate Spaceships Pack (CC0)
- Terra: NASA Visible Earth (domínio público) · Céu: ESA/Gaia/DPAC (CC BY-SA 3.0 IGO)
- Planetas: Solar System Scope (CC BY 4.0)
- Fortaleza: Esri, Maxar, Earthstar Geographics e comunidade GIS · Sentinel-2 cloudless — s2maps.eu, EOX IT Services GmbH (dados Copernicus 2016, CC BY 4.0)
