// src/characters.js
// Elenco original do jogo e todas as falas do rádio.
// `look` define o retrato desenhado em SVG (ui/Portrait.jsx).

export const CAST = {
  vasquez: {
    name: 'Cmdte. Helena Vasquez',
    role: 'Ponte do Cruzador Aurora',
    color: '#4fb3ff',
    look: {
      skin: '#c68863', skinShade: '#a96f4f', hair: 'bun', hairColor: '#4a4a55', cap: '#1f3b66',
      suit: '#1f3b66', trim: '#e8c25a', eyes: '#3a2a1a', brows: '#2a2a30', headset: true,
    },
  },
  ramos: {
    name: 'Sgt. Bruno "Bigorna" Ramos',
    role: 'Fênix 3 · Ala direita',
    color: '#ffb347',
    look: {
      skin: '#8a5636', skinShade: '#6f4128', hair: 'buzz', hairColor: '#1a1410', helmet: '#e9e4da',
      helmetStripe: '#f57c00', suit: '#5b6236', trim: '#f57c00', eyes: '#2a1a0f', brows: '#1a1410',
      beard: '#1a1410', scar: true,
    },
  },
  faisca: {
    name: 'Ten. Kaia "Faísca" Mendes',
    role: 'Fênix 2 · Ala esquerda',
    color: '#7cf3ff',
    look: {
      skin: '#efc39f', skinShade: '#d9a47f', hair: 'bob', hairColor: '#d2452b', suit: '#22427a',
      trim: '#7cf3ff', eyes: '#2e7d5b', brows: '#a3321d', headset: true, freckles: true,
    },
  },
  brenner: {
    name: 'Dr. Otto Brenner',
    role: 'Engenharia · Aurora',
    color: '#9dff8a',
    look: {
      skin: '#f2cfb0', skinShade: '#d9ad8c', hair: 'bald', hairColor: '#e8e8e8', suit: '#cfd6dc',
      trim: '#5bd16a', eyes: '#3b5a7a', brows: '#e8e8e8', glasses: true, mustache: '#e8e8e8',
    },
  },
  korrath: {
    name: 'Almirante Vex Korrath',
    role: 'Armada Escarlate',
    color: '#ff4d5e',
    hostile: true,
    look: {
      skin: '#aab3bb', skinShade: '#8a939b', hair: 'none', hood: '#1a0d12', suit: '#3a0f18',
      trim: '#ff4d5e', eyes: '#ffcc00', brows: '#2a2a2a', cyberEye: true, scar: true, angry: true,
    },
  },
}

const l = (who, text) => ({ who, text })

export const LINES = {
  briefing: [l('vasquez', 'Esquadrão Fênix, aqui é a Aurora. A Armada Escarlate cruzou o Cinturão de Kepler. Segurem a linha!')],
  briefing2: [l('faisca', 'Fênix 2 na sua asa esquerda, Líder. Vamos mostrar como se voa!')],
  wave1: [l('vasquez', 'Primeira linha rompida! Interceptadores chegando pelos flancos — fiquem atentos.')],
  wave2: [l('vasquez', 'Bombardeiros pesados detectados. Derrubem antes que alcancem a Aurora!')],
  bossWarning: [l('vasquez', 'Alerta! Assinatura gigante saindo do hiperespaço... é a Fortaleza Korrath!')],
  bossTaunt: [l('korrath', 'Pilotos do Fênix... vieram morrer em grande estilo. Fortaleza, abrir fogo!')],
  bossTip: [l('brenner', 'O núcleo da fortaleza tem escudo. Destruam as quatro torres primeiro!')],

  // Elogios do soldado em marcos de pontuação (ordem dos marcos no Director)
  praise: [
    l('ramos', 'Ramos aqui: placar subindo, Líder! Tá voando bonito hoje.'),
    l('ramos', 'Isso é que é pontaria! A tropa lá na Aurora tá vibrando com você.'),
    l('ramos', 'Seis mil! Nunca vi ninguém limpar o céu assim desde a Batalha de Órion.'),
    l('ramos', 'Dez mil pontos, Líder! Vão pintar seu emblema na parede do hangar.'),
    l('ramos', 'Quinze mil! Os Escarlates já tremem quando veem a sua nave.'),
    l('ramos', 'Lenda viva! Bigorna bate continência pra você, Líder.'),
  ],

  lowShield: [
    l('faisca', 'Líder, seus escudos estão caindo! Sai da linha de fogo!'),
    l('brenner', 'Escudo abaixo de 40%! Procure um módulo de reparo azul, rápido!'),
    l('faisca', 'Tá levando muito tiro! Usa o giro (Q/E) pra rebater os lasers!'),
  ],
  critical: [
    l('vasquez', 'Fênix Líder, escudo crítico! Não podemos te perder agora — aguenta firme!'),
    l('ramos', 'Tô vendo fumaça saindo da sua nave! Desvia, desvia!'),
  ],
  combo: [
    l('faisca', 'Que sequência! Deixa alguns pra mim também!'),
    l('ramos', 'Combo absurdo! Continua derrubando, Líder!'),
  ],
  chatter: [
    l('faisca', 'Tinha um na minha cola... pronto, despistei.'),
    l('ramos', 'Bigorna na escuta. Formação mantida.'),
    l('faisca', 'Tô vendo a frota inimiga no horizonte. É grande...'),
    l('vasquez', 'Aurora para Fênix: a frota aliada avança logo atrás de vocês.'),
    l('brenner', 'Lembrete: segure Shift para o turbo, mas o propulsor precisa esfriar!'),
    l('brenner', 'Bombas de prótons (B ou botão direito) limpam tudo num raio enorme.'),
  ],
  wingKill: [
    l('faisca', 'Peguei um! Fênix 2 marcando ponto!'),
    l('ramos', 'Abatido! Bigorna não erra.'),
    l('faisca', 'Esse era seu, Líder. Foi mal!'),
  ],
  pickup_shield: [l('brenner', 'Reparo instalado. Escudos reforçados!')],
  pickup_weapon1: [l('brenner', 'Quatro canhões sincronizados! Disparo quádruplo liberado.')],
  pickup_weapon2: [l('brenner', 'Plasma no máximo! Cuidado pra não derreter os canos.')],
  pickup_weaponMax: [l('brenner', 'Armas já estão no limite. Converti a energia em pontos!')],
  pickup_bomb: [l('brenner', 'Bomba de prótons carregada. Aperte B quando precisar.')],
  deflect: [l('ramos', 'Que giro! Rebateu o laser na raça!')],
  rollTip: [l('brenner', 'Dica: Q e E fazem um giro evasivo que rebate os lasers inimigos.')],
  turretDown: [l('faisca', 'Uma torre a menos! Continuem martelando!')],
  coreExposed: [l('brenner', 'O escudo do núcleo caiu! Mirem no centro vermelho!')],
  bossHalf: [l('korrath', 'Impossível! Escoltas, protejam a fortaleza!')],
  bossDown: [l('korrath', 'Isso... não acabou, Fênix...')],
  victory: [l('vasquez', 'Fortaleza destruída! Esquadrão Fênix, vocês salvaram a frota. Voltem pra casa.')],
  playerDown: [l('vasquez', 'Fênix Líder foi atingido! Equipes de resgate, agora!')],
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
