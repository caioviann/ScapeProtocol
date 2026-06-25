# ScapeProtocol - Level Design Atual

Documento de level design baseado no estado atual do jogo implementado em `ScapeControlCode`.

## Visao Geral

ScapeProtocol e um jogo de fuga em laboratorio subterraneo, com camera top-down, mapa escuro e ameacas patrulhando corredores e salas. O jogador nao possui ataque, item, vida ou inventario: o objetivo e navegar pelo mapa, evitar contato com os monstros e alcancar a zona de escape.

O jogo pode ser jogado sozinho ou em sala multiplayer de ate 2 jogadores via MQTT. No multiplayer, os jogadores compartilham a mesma fase, veem a posicao um do outro e a vitoria de um jogador encerra a partida para os dois.

## Regras Base

| Elemento | Comportamento atual |
|---|---|
| Objetivo | Chegar na zona `end_game`. |
| Vitoria | Entrar na zona de escape no canto superior esquerdo do mapa. |
| Derrota | Encostar em qualquer inimigo. |
| Combate | Nao existe. O jogador so foge e evita deteccao. |
| Visibilidade | O mapa fica quase todo escuro, com um raio de luz curto em volta do jogador. |
| Movimento | Setas do teclado, analogico esquerdo ou D-pad. |
| Reinicio | `Enter`, clique/toque ou botao `X` do controle na tela final. |

## Mapa

O nivel atual usa o mapa Tiled `ScapeControlCode/public/assets/MapPhase3.json`.

Configuracao do mapa:

| Propriedade | Valor |
|---|---|
| Tamanho em tiles | 70 x 44 |
| Tamanho do tile | 16 x 16 px |
| Tamanho em pixels | 1120 x 704 px |
| Camada de objetos | `CamadaDeObjetos` |

Camadas de tile usadas no jogo:

- `fundo`
- `gradePiso`
- `janela`
- `parede`
- `objetosDeCenário`
- `ObjetosEmCimaDEObjetos`

Colisoes:

- A camada `parede` bloqueia tiles com IDs entre `1585` e `2000`.
- A camada `objetosDeCenário` bloqueia qualquer tile preenchido.
- Jogador e inimigos colidem com paredes e objetos de cenario.

## Layout do Nivel

O mapa funciona como um laboratorio compacto dividido por paredes, corredores e salas conectadas. A rota principal leva o jogador da area inicial, mais ao centro/esquerda do mapa, ate a saida no canto superior esquerdo.

### Area Inicial

- Spawn atual do jogador 1: `x: 317`, `y: 410`.
- E a area de entrada da partida.
- Serve como ponto de leitura inicial do laboratorio antes de avancar pelos corredores.
- No multiplayer, se houver apenas um `spawn_player` no Tiled, ambos usam o mesmo ponto base.

### Corredores de Patrulha

- Conectam a area inicial com a parte superior do mapa e com as salas laterais.
- O jogador precisa atravessar esses corredores sob baixa visibilidade.
- Ratos e slimes patrulham ao redor dos seus pontos de nascimento, criando zonas moveis de risco.

### Salas com Ameacas

Os inimigos estao posicionados para pressionar diferentes trechos do laboratorio:

| Tipo | Spawn atual |
|---|---|
| Slime | `x: 752`, `y: 115` |
| Slime | `x: 755`, `y: 553` |
| Slime | `x: 512`, `y: 96` |
| Rato | `x: 103`, `y: 298` |
| Rato | `x: 278`, `y: 115` |
| Rato | `x: 503`, `y: 565` |

Esses spawns criam tres pressoes principais:

- Parte superior: rota proxima da saida, defendida por rato e slime.
- Lado direito: sala distante com slime, funcionando como ameaca lateral.
- Parte inferior: rota de contorno com rato e slime, punindo desvios longos.

### Zona de Escape

- Objeto Tiled: `end_game`.
- Posicao atual: `x: 170.375`, `y: 36.065`.
- Tamanho usado se for ponto: `32 x 32 px`.
- Ao entrar nessa zona, o jogo troca para a tela de vitoria.

No multiplayer, quando um jogador escapa, o cliente publica o evento de fim de jogo e o outro jogador tambem recebe vitoria.

### Piscina Toxica

Existe um objeto `toxic_pool` no mapa:

- Posicao: `x: 162.914`, `y: 177.837`.
- Tamanho: `92.028 x 29.847 px`.

Atualmente esse objeto esta documentado no mapa, mas nao possui comportamento implementado no codigo. Ele nao causa dano, nao afeta inimigos e nao altera a rota do jogador.

## Inimigos

O jogo possui dois inimigos ativos: Slime e Rato. Ambos patrulham, detectam jogadores, perseguem, investigam a ultima posicao conhecida e causam derrota por contato.

| Inimigo | Velocidade | Deteccao visual | Audicao | Patrulha |
|---|---:|---:|---:|---|
| Slime | 55 | 190 px | 120 px | 90 x 70 px ao redor do spawn |
| Rato | 85 | 210 px | 170 px | 120 x 90 px ao redor do spawn |

### Estados de IA

| Estado | Funcao no level |
|---|---|
| `idle` | Pausa curta para quebrar padrao mecanico. |
| `patrol` | Circula perto do spawn, criando risco local. |
| `alert` | Ouviu movimento ou recebeu alerta; anda devagar ate a posicao suspeita. |
| `chase` | Viu o jogador ou recebeu alerta forte; persegue diretamente. |
| `search` | Perdeu o jogador; investiga a ultima posicao conhecida. |

### Visao

Um inimigo detecta o jogador se ele estiver dentro da distancia de visao e dentro do arco de visao. Muito perto do inimigo, a deteccao acontece mesmo fora do arco.

Esse comportamento faz com que o level design dependa de:

- distancia entre corredores e spawns;
- cobertura criada por paredes e objetos;
- tempo de passagem quando o inimigo esta olhando para outro lado;
- uso da escuridao para aumentar tensao, nao para esconder completamente o jogador da IA.

### Audicao

Inimigos tambem podem reagir ao jogador em movimento dentro do raio de audicao. O movimento do player local gera ruido quando sua velocidade esta acima do limite interno usado pela IA.

No multiplayer, o outro jogador sincronizado tambem pode ser alvo da IA; se estiver animado/movendo, pode ser tratado como fonte de ruido.

### Alerta em Grupo

Quando um inimigo detecta o jogador, ele pode alertar inimigos proximos:

- Slime alerta em raio de `150 px`.
- Rato alerta em raio de `190 px`.
- Inimigos muito proximos podem entrar direto em perseguicao.
- Inimigos mais distantes entram em alerta e investigam.

Isso cria picos de pressao quando o jogador cruza areas com spawns proximos.

## Audio e Leitura de Risco

O som ajuda o jogador a ler perigo mesmo com pouca visibilidade.

| Som | Comportamento |
|---|---|
| Musica ambiente | Toca em loop desde o menu, volume `0.35`. |
| Rato | Efeito curto quando o jogador esta ate `90 px`, com cooldown de `2400 ms`. |
| Slime | Som continuo enquanto o jogador esta ate `140 px`. |

O volume dos sons de inimigo aumenta conforme a proximidade.

## Fluxo de Gameplay

1. Jogador entra ou cria uma sala no menu.
2. A partida carrega o laboratorio escuro.
3. O jogador nasce na area inicial em `x: 317`, `y: 410`.
4. O jogador avanca pelos corredores usando o pequeno raio de luz.
5. Slimes e ratos patrulham ao redor dos spawns.
6. Se o jogador for visto ou ouvido, o inimigo entra em alerta, busca ou perseguicao.
7. Se qualquer inimigo encostar no jogador local, a partida termina em derrota.
8. Se o jogador alcancar o `end_game`, a partida termina em vitoria.

## Intencao de Level Design Atual

O nivel atual e uma fase de fuga curta, baseada em tensao de proximidade. A dificuldade vem de tres fatores combinados:

- baixa visibilidade;
- inimigos com patrulha e perseguicao;
- necessidade de chegar ao canto superior esquerdo sem contato.

O design favorece leitura cuidadosa do espaco, controle de ritmo e desvio de ameacas. Como nao ha itens, portas trancadas, puzzles, combate ou checkpoints, o foco da fase e o trajeto entre spawn e saida.

## Pontos de Ajuste no Tiled

Para alterar a fase sem mudar codigo:

- mover `spawn_player` altera o inicio;
- adicionar `spawn_slime` cria mais slimes;
- adicionar `spawn_rat` cria mais ratos;
- mover `end_game` altera a saida;
- desenhar `end_game` como retangulo altera o tamanho da zona de vitoria;
- ajustar paredes e objetos muda colisao e rotas disponiveis.

Objetos com nomes nao reconhecidos, como `toxic_pool`, permanecem sem comportamento ate que sejam implementados no codigo.
