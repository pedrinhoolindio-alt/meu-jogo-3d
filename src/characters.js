// src/characters.js
// Elenco do jogo e todas as falas do rádio.
// Os aliados usam fotos (src/embedded/portraits.js); o vilão é uma ilustração (ui/Portrait.jsx).

export const CAST = {
  pedro: {
    name: 'Pedro',
    role: 'Fênix Líder · Piloto principal',
    color: '#ffd84a',
    photo: 'pedro',
  },
  roberta: {
    name: 'Cmdte. Roberta',
    role: 'Comandante · Cruzador Aurora',
    color: '#4fb3ff',
    photo: 'roberta',
    holo: true, // aparece como transmissão holográfica da ponte
  },
  ivone: {
    name: 'Ivone',
    role: 'Chefe do Centro de Comando',
    color: '#ffb347',
    photo: 'ivone',
  },
  janiele: {
    name: 'Janiele',
    role: 'Chefe da Equipe · Fênix 2',
    color: '#ff7ad9',
    photo: 'janiele',
  },
  alan: {
    name: 'Alan',
    role: 'Inteligência & BI',
    color: '#9dff8a',
    photo: 'alan',
  },
  korrath: {
    name: 'Almirante Vex Korrath',
    role: 'Armada Escarlate',
    color: '#ff4d5e',
    hostile: true,
  },
}

const l = (who, text) => ({ who, text })

export const LINES = {
  briefing: [l('roberta', 'Esquadrão Fênix, aqui é a comandante Roberta. A Armada Escarlate cruzou o Cinturão de Kepler. Pedro, você lidera. Segurem a linha!')],
  briefing2: [l('janiele', 'Janiele na sua asa esquerda, Pedro. Equipe pronta — vamos mostrar como se voa!')],
  wave1: [l('ivone', 'Centro de Comando: primeira linha rompida! Interceptadores entrando pelos flancos.')],
  wave2: [l('ivone', 'Centro de Comando: bombardeiros pesados no radar. Derrubem antes que alcancem a Aurora!')],
  bossWarning: [l('ivone', 'Alerta máximo! Assinatura gigante saindo do hiperespaço... é a Fortaleza Korrath!')],
  bossTaunt: [l('korrath', 'Pilotos do Fênix... vieram morrer em grande estilo. Fortaleza, abrir fogo!')],
  bossTip: [l('alan', 'Analisei a fortaleza: o núcleo tem escudo. Derrubem as quatro torres primeiro!')],

  // Elogios da chefe da equipe em marcos de pontuação (ordem dos marcos no Director)
  praise: [
    l('janiele', 'Mil pontos, Pedro! Tá voando bonito hoje.'),
    l('janiele', 'Isso é que é pontaria! A equipe inteira tá vibrando com você.'),
    l('alan', 'Atualizei o painel: seis mil pontos. Você está acima de qualquer meta, Pedro!'),
    l('janiele', 'Dez mil! Vou pedir pra pintarem seu nome na parede do hangar.'),
    l('roberta', 'Quinze mil pontos. Pedro, a frota inteira está assistindo. Excelente trabalho.'),
    l('janiele', 'Lenda viva! A Armada Escarlate já treme quando vê a sua nave.'),
  ],

  lowShield: [
    l('ivone', 'Centro de Comando: Pedro, seus escudos estão caindo! Sai da linha de fogo!'),
    l('alan', 'Escudo abaixo de 40%. Os dados mostram módulos de reparo azuis por perto — pegue um!'),
    l('janiele', 'Tá levando muito tiro! Usa o giro (Q/E) pra rebater os lasers!'),
  ],
  critical: [
    l('roberta', 'Pedro, escudo crítico! Não podemos te perder agora — aguenta firme!'),
    l('ivone', 'Alerta! Integridade da nave em nível crítico. Recue e se reagrupe!'),
  ],
  combo: [
    l('janiele', 'Que sequência! Deixa alguns pra mim também!'),
    l('alan', 'Taxa de abates fora da curva! Nunca vi um gráfico desses.'),
  ],
  chatter: [
    l('janiele', 'Tinha um na minha cola... pronto, despistei.'),
    l('ivone', 'Centro de Comando monitorando. Formação estável.'),
    l('roberta', 'Aurora para Fênix: a frota aliada avança logo atrás de vocês.'),
    l('alan', 'Dica dos dados: segure Shift para o turbo, mas ele precisa recarregar.'),
    l('alan', 'Bombas de prótons (B ou botão direito) limpam tudo num raio enorme.'),
    l('janiele', 'Tô vendo a frota inimiga no horizonte. É grande...'),
  ],
  wingKill: [
    l('janiele', 'Peguei um! Fênix 2 marcando ponto!'),
    l('janiele', 'Abatido! A equipe não perdoa.'),
    l('janiele', 'Esse era seu, Pedro. Foi mal!'),
  ],
  pickup_shield: [l('alan', 'Reparo instalado. Escudos reforçados!')],
  pickup_weapon1: [l('alan', 'Upgrade recebido: quatro canhões sincronizados!')],
  pickup_weapon2: [l('alan', 'Plasma no máximo! Seu dano subiu 60%.')],
  pickup_weaponMax: [l('alan', 'Armas já estão no limite. Converti a energia em pontos!')],
  pickup_bomb: [l('alan', 'Bomba de prótons carregada. Aperte B quando precisar.')],
  deflect: [l('janiele', 'Que giro! Rebateu o laser na raça!')],
  rollTip: [l('alan', 'Dica: Q e E fazem um giro evasivo que rebate os lasers inimigos.')],
  turretDown: [l('janiele', 'Uma torre a menos! Continuem martelando!')],
  coreExposed: [l('alan', 'O escudo do núcleo caiu! Mirem no centro vermelho!')],
  bossHalf: [l('korrath', 'Impossível! Escoltas, protejam a fortaleza!')],
  bossDown: [l('korrath', 'Isso... não acabou, Fênix...')],
  victory: [l('roberta', 'Fortaleza destruída! Pedro, você e a equipe salvaram a frota. Voltem pra casa.')],
  playerDown: [l('roberta', 'Fênix Líder foi atingido! Equipes de resgate, agora!')],
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
