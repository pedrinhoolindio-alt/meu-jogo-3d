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
    role: 'Armada do Caos Operacional',
    color: '#ff4d5e',
    hostile: true,
  },
}

const l = (who, text) => ({ who, text })

export const LINES = {
  briefing: [l('roberta', 'Esquadrão Fênix, aqui é a comandante Roberta. As metas do Sesc e do Senac dependem de vocês. Pedro, você lidera!')],
  briefing2: [l('janiele', 'Janiele na sua asa esquerda, Pedro. Equipe pronta — vamos mostrar como se voa!')],
  wave1: [l('ivone', 'Centro de Comando: primeira linha rompida! Interceptadores entrando pelos flancos.')],
  wave2: [l('ivone', 'Centro de Comando: bombardeiros pesados no radar. Derrubem antes que alcancem a Aurora!')],
  bossWarning: [l('ivone', 'Alerta máximo! Assinatura gigante saindo do hiperespaço... é a Fortaleza Korrath!')],
  bossTaunt: [l('korrath', 'Fechamento de metas? Não enquanto o Caos Operacional existir! Fortaleza, abrir fogo!')],
  bossTip: [l('alan', 'A fortaleza está sobre Fortaleza! O núcleo tem escudo: derrubem as quatro torres primeiro!')],

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
    l('janiele', 'Olha o radar, Pedro: as setas na borda da tela mostram quem está atrás de você!'),
    l('alan', 'Segure V para olhar para trás e ver quem está na sua cola.'),
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
  pickup_weapon3: [l('alan', 'Plasma em leque instalado: seis disparos por rajada!')],
  pickup_weapon4: [l('alan', 'HIPER-LASER ativo! Os tiros atravessam até três naves.')],
  pickup_missile: [l('alan', 'Mais 4 mísseis teleguiados. Aperte F (ou o botão do meio do mouse) para lançar.')],
  pickup_drone: [l('janiele', 'Drone de escolta ativado! Ele vai atirar junto com você por 25 segundos.')],
  newEnemy_kamikaze: [l('ivone', 'Centro de Comando: Agulhas à vista! Elas perseguem e colidem — derrube antes que cheguem.')],
  newEnemy_gunship: [l('alan', 'Ômega detectada: dispara rajadas em leque. Fique na lateral dela!')],
  newEnemy_sniper: [l('alan', 'Cuidado com o Ferrão: quando aparecer a linha vermelha, saia da mira ou use o giro (Q/E)!')],
  newEnemy_carrier: [l('roberta', 'Porta-naves Colmeia no radar! Ela lança Agulhas sem parar. Use mísseis e bombas nela!')],
  newEnemy_swarm: [l('ivone', 'Enxame chegando! São rápidos e vêm em grupo de quatro. Gire e atire, não deixe encostarem!')],
  newEnemy_ace: [l('janiele', 'Cuidado, Pedro: os Espectros são os ases deles. Voam rápido e atiram em rajada tripla!')],
  newEnemy_raptor: [l('alan', 'Raptor no radar: interceptador pesado, aguenta mais tiros. Use os mísseis (F)!')],
  newEnemy_corsair: [l('janiele', 'Corsários fazendo passadas laterais! Não fique parado na linha deles.')],
  newEnemy_manta: [l('alan', 'Arraias disparam plasma roxo teleguiado. Faça curvas fechadas ou derrube o plasma a tiros!')],
  newEnemy_warden: [l('ivone', 'Sentinela à vista: blindagem pesada e leque de cinco tiros. Ataque pelos flancos!')],
  newEnemy_tormenta: [l('roberta', 'Tormenta detectada! Bombardeiro pesado com plasma teleguiado. Prioridade máxima!')],
  newEnemy_lancer: [l('alan', 'Arpão: atirador de longo alcance. Quando a linha vermelha aparecer, mude de direção!')],
  newEnemy_hive: [l('ivone', 'Colmeia Real lançando Enxames! Derrube a porta-naves antes que o céu fique lotado.')],
  newEnemy_interceptor: [l('ivone', 'Lanças entrando rápido! Elas mergulham e fazem a volta — fique de olho no radar.')],
  newEnemy_bomber: [l('ivone', 'Bombardeiros Martelo no setor. Lentos, mas o plasma laranja dói!')],
  motherArrive_leviata: [l('roberta', 'NAVE-MÃE LEVIATÃ saindo do hiperespaço! Destruam as torres para derrubar o escudo do reator na traseira!')],
  motherArrive_tita: [l('ivone', 'Alerta máximo: nave-mãe TITÃ! Ela lança os ases Espectro. Torres primeiro, depois o reator!')],
  motherArrive_colmeiaMae: [l('alan', 'COLMEIA-MÃE detectada: ela solta enxames sem parar. Reator brilhante na traseira é o ponto fraco!')],
  motherTurret: [
    l('janiele', 'Torre da nave-mãe destruída! Continua, Pedro!'),
    l('alan', 'Menos uma torre. O escudo do reator está enfraquecendo.'),
  ],
  motherExposed: [l('alan', 'Todas as torres caíram! O reator está exposto: mire no brilho vermelho na traseira!')],
  motherDown: [
    l('roberta', 'NAVE-MÃE DESTRUÍDA! Isso vale cinco na meta. Que orgulho, Esquadrão Fênix!'),
    l('janiele', 'Derrubamos a nave-mãe! Olha o tamanho dessa explosão!'),
  ],
  entry: [l('ivone', 'A frota inimiga está descendo para o planeta! Esquadrão Fênix, entrada na atmosfera — segurem firme!')],
  surface_fortaleza: [l('roberta', 'Estamos no céu de Fortaleza! Beira-Mar, Iracema e Mucuripe logo abaixo. Protejam a nossa cidade!')],
  surface_moonSurface: [l('ivone', 'Voo rasante sobre a Lua! Sem atmosfera, cuidado com as crateras. Busquem as cápsulas!')],
  surface_marsSurface: [l('janiele', 'Bem-vindos a Marte! Céu cor de caramelo e inimigo em todo lado. Bora!')],
  surface_jupiterClouds: [l('alan', 'Topo das nuvens de Júpiter: ventos de 600 km/h. Os passageiros estão logo à frente!')],
  surface_saturnClouds: [l('roberta', 'Dentro da tempestade de Saturno, com os anéis lá em cima. Última onda de manifestações!')],
  outOfBounds: [l('ivone', 'Pedro, você está saindo da área de combate! Piloto automático trazendo você de volta.')],
  lowAltitude: [l('janiele', 'Muito baixo! Puxa o nariz pra cima (W), Pedro!')],
  pickup_weaponMax: [l('alan', 'Armas já estão no limite. Converti a energia em pontos!')],
  pickup_bomb: [l('alan', 'Bomba de prótons carregada. Aperte B quando precisar.')],
  deflect: [l('janiele', 'Que giro! Rebateu o laser na raça!')],
  rollTip: [l('alan', 'Dica: Q e E fazem um giro evasivo que rebate os lasers inimigos.')],
  turretDown: [l('janiele', 'Uma torre a menos! Continuem martelando!')],
  coreExposed: [l('alan', 'O escudo do núcleo caiu! Mirem no centro vermelho!')],
  bossHalf: [l('korrath', 'Impossível! Escoltas, protejam a fortaleza!')],
  bossDown: [l('korrath', 'Impossível... metas... batidas...')],
  victory: [l('roberta', 'Fortaleza destruída! Pedro, o ano está fechado com as metas do Sesc e do Senac garantidas. Orgulho dessa equipe!')],
  playerDown: [l('roberta', 'Fênix Líder foi atingido! Equipes de resgate, agora!')],
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
