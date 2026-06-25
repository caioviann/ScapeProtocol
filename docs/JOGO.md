# Documentacao do Jogo

Este documento descreve o que ja existe no jogo Scape Protocol, onde cada sistema fica no codigo e como o mapa do Tiled deve ser configurado.

## Stack

- Motor: Phaser 3.
- Linguagem: TypeScript.
- Build: Webpack.
- Multiplayer: MQTT via WebSocket.
- Mapa: Tiled JSON em `public/assets/MapPhase3.json`.
- Assets: imagens em `public/assets` e sons em `public/sounds`.

Comandos principais:

```bash
npm run dev-nolog
npm run build-nolog
```

## Cenas

As cenas registradas ficam em `src/game/main.ts`:

- `Boot`: carrega o fundo inicial.
- `Preloader`: carrega sprites, mapa e audios.
- `MainMenu`: menu de criacao/entrada em sala multiplayer.
- `Game`: jogo principal.
- `GameOver`: tela final de derrota ou vitoria.

## Multiplayer MQTT

O servico MQTT fica em `src/game/mqttService.ts`.

Broker usado:

```ts
wss://mqtt.feira-de-jogos.dev.br
```

Topicos principais:

- `tes20261/rooms/+`: lista de salas abertas no menu.
- `tes20261/rooms/<CODIGO>`: presenca e nome das salas.
- `tes20261/<CODIGO>/Game`: sincronizacao dos players dentro da partida.

Cada cliente recebe um id aleatorio:

```ts
player-xxxxxxxx
```

O menu permite:

- criar uma sala;
- entrar em uma sala por codigo;
- listar salas abertas;
- limitar a sala a 2 jogadores;
- salvar `room` e `roomName` na URL.

Durante o jogo, cada cliente publica:

- posicao do player;
- textura/frame atual;
- flip horizontal/vertical;
- animacao atual;
- evento de fim de jogo quando alguem escapa.

Quando um player entra no `end_game`, o jogo publica:

```json
{
  "gameEnded": true,
  "won": true,
  "id": "player-id"
}
```

O outro player recebe esse evento e tambem vai para a tela de vitoria.

## Mapa e Tiled

O mapa usado pelo jogo e:

```text
public/assets/MapPhase3.json
```

Ele e carregado em `src/game/scenes/Preloader.ts` com a chave `map`.

Camadas de tile usadas:

- `fundo`
- `gradePiso`
- `janela`
- `parede`
- `objetosDeCenário`
- `ObjetosEmCimaDEObjetos`

Camada de objetos usada:

```text
CamadaDeObjetos
```

O codigo procura essa camada sem diferenciar maiusculas/minusculas, entao `camadaDeObjetos` tambem funciona.

## Spawns pelo Tiled

Os spawns agora vem da camada `CamadaDeObjetos`.

Objetos reconhecidos:

| Nome do objeto | Funcao |
|---|---|
| `spawn_player` | ponto onde o player nasce |
| `spawn_slime` | ponto onde nasce um slime |
| `spawn_rat` | ponto onde nasce um rato |
| `end_game` | zona de fim de jogo/vitoria |

Regras:

- Cada objeto `spawn_slime` cria um slime.
- Cada objeto `spawn_rat` cria um rato.
- `spawn_player` define onde o player nasce.
- Se houver mais de um `spawn_player`, o `playerNumber` escolhe o ponto correspondente.
- Se algum tipo de spawn nao existir, o jogo usa coordenadas fallback no codigo.

O codigo responsavel fica em `src/game/scenes/Game.ts`, no metodo `getObjectSpawns`.

## Fim de Jogo

Existem dois finais:

- Derrota: encostar em um inimigo.
- Vitoria: entrar no objeto/zona `end_game`.

Na tela final:

- derrota mostra `Game Over`;
- vitoria mostra `Voce venceu! Conseguiu escapar.`

O `end_game` pode ser criado no Tiled como:

- ponto: o jogo cria uma zona invisivel padrao de `32x32`;
- retangulo: o jogo usa a largura e altura desenhadas no Tiled.

## Colisoes

As colisoes principais ficam em `src/game/scenes/Game.ts`.

Camada `parede`:

```ts
paredeLayer.setCollisionBetween(1585, 2000);
```

Isso torna solidos os tiles da camada `parede` com IDs entre `1585` e `2000`.

Camada `objetosDeCenário`:

```ts
objetosDeCenarioLayer.setCollisionByExclusion([-1, 0]);
```

Isso torna solido qualquer tile preenchido nessa camada. Essa regra foi usada porque os objetos de cenario usam varios IDs diferentes, fora da faixa da parede.

Player e inimigos colidem com:

- `parede`;
- `objetosDeCenário`.

Inimigos tambem tem overlap com o player. Se encostar, termina em derrota.

## Player

O player e criado na cena `Game`.

Ele usa:

- spritesheets do personagem em `public/assets/person`;
- animacoes para andar para cima, baixo, esquerda e direita;
- corpo fisico Arcade com tamanho/offset configurado por personagem;
- camera seguindo o player;
- limite de mundo ativo.

Controles:

- setas do teclado.

## Inimigos

Os inimigos existentes sao:

- Slime;
- Rato.

Os inimigos:

- nascem nos objetos `spawn_slime` e `spawn_rat`;
- patrulham ao redor do ponto inicial;
- perseguem o player mais proximo dentro da distancia de chase;
- colidem com paredes e objetos de cenario;
- causam derrota se encostarem no player local.

Configuracoes principais:

Slime:

- velocidade: `55`;
- distancia de perseguicao: `190`;
- escala: `0.45`;
- audio: `slimeSound`.

Rato:

- velocidade: `85`;
- distancia de perseguicao: `210`;
- escala: `0.75`;
- audio: `ratSound`.

## Audio

Audios carregados em `src/game/scenes/Preloader.ts`:

| Chave | Arquivo |
|---|---|
| `backgroundMusic` | `public/sounds/music/Eduard_Perelyhin_-_Suspense_Ambient__amp__Outbreak.mp3` |
| `slimeSound` | `public/sounds/sounds_monsters/slime_sound.mp3` |
| `ratSound` | `public/sounds/sounds_monsters/rat_sound.mp3` |

Musica de fundo:

- inicia no `MainMenu`;
- fica em loop;
- volume configurado em `0.35`;
- reutiliza a mesma instancia para nao duplicar ao trocar de cena.

Audio de proximidade:

- rato toca como efeito curto quando o player local esta perto;
- slime e tratado como audio continuo, porque o arquivo e longo;
- slime toca em loop apenas enquanto houver slime perto;
- ao sair do raio do slime, o som para;
- volume aumenta conforme a proximidade.

Configuracoes ficam em `ENEMY_SOUND_SETTINGS` em `src/game/scenes/Game.ts`.

Valores atuais:

```ts
ratSound: {
    distance: 90,
    cooldownMs: 2400,
    minVolume: 0.18,
    maxVolume: 0.58
}

slimeSound: {
    distance: 140,
    cooldownMs: 9000,
    minVolume: 0.45,
    maxVolume: 0.85,
    continuous: true
}
```

## Build de Producao

O build de producao copia:

- `public/assets` para `dist/assets`;
- `public/sounds` para `dist/sounds`;
- `public/favicon.png`;
- `public/style.css`.

Arquivos `.DS_Store` sao ignorados no copy.

Configuracao em:

```text
webpack/config.prod.js
```

## Pontos Importantes para Editar no Futuro

- Para mover spawns, edite os objetos na `CamadaDeObjetos` no Tiled.
- Para adicionar mais slimes/ratos, crie mais objetos `spawn_slime` ou `spawn_rat`.
- Para mudar a area de vitoria, mova ou redimensione o objeto `end_game`.
- Para mudar colisao de objetos do cenario, edite a camada `objetosDeCenário`.
- Para ajustar audio de proximidade, edite `ENEMY_SOUND_SETTINGS` em `Game.ts`.
- Para mudar a mensagem de vitoria/derrota, edite `GameOver.ts`.

## IA dos NPCs Monstros

A IA dos NPCs monstros esta implementada em `src/game/scenes/Game.ts`. Ela roda dentro do loop principal da cena `Game`, no metodo `updateEnemies(time)`, que e chamado a cada frame pelo metodo `update(time, _delta)`.

### Onde esta implementada

| Arquivo/metodo | Responsabilidade |
|----------------|------------------|
| `src/game/scenes/Game.ts` | Cena principal do jogo e sistema de IA dos monstros. |
| `EnemyAIState` | Define os estados possiveis da IA: `idle`, `patrol`, `alert`, `chase` e `search`. |
| `EnemyConfig` | Define os parametros de comportamento de cada tipo de monstro. |
| `Enemy` | Guarda o estado atual de IA de cada monstro instanciado. |
| `createEnemies(...)` | Cria slimes e ratos, configura corpo fisico, animacoes, colisao e parametros de IA. |
| `updateEnemies(time)` | Atualiza som, escolhe alvo e chama a IA de cada monstro a cada frame. |
| `updateEnemyAI(enemy, target, time)` | Decide o estado atual do monstro com base em visao, audicao, memoria e alertas. |
| `isTargetInEnemyVision(enemy, target)` | Calcula se o alvo esta dentro do campo de visao do monstro. |
| `isTargetMakingNoise(target)` | Verifica se o alvo esta fazendo barulho, usado pela audicao dos monstros. |
| `alertNearbyEnemies(sourceEnemy, target, time, escalateToChase)` | Faz monstros proximos reagirem quando um monstro percebe o jogador. |
| `moveEnemyFromAI(enemy, body)` | Converte a decisao da IA em velocidade fisica no Arcade Physics. |
| `getEnemyMovement(enemy)` | Define destino e velocidade conforme o estado atual de IA. |
| `getEnemySeparationVelocity(enemy)` | Evita que monstros fiquem empilhados uns sobre os outros. |

### Estados da IA

| Estado | O que faz |
|--------|-----------|
| `idle` | O monstro fica parado por um curto intervalo antes de voltar a patrulhar. |
| `patrol` | O monstro anda ao redor do ponto onde nasceu, escolhendo destinos aleatorios dentro de um raio configurado. |
| `alert` | O monstro ouviu algo ou foi avisado por outro monstro. Ele anda mais devagar ate a posicao suspeita. |
| `chase` | O monstro viu o jogador ou recebeu alerta forte e passa a perseguir o alvo. |
| `search` | O monstro perdeu o jogador, mas ainda lembra a ultima posicao conhecida e vai investigar esse ponto. |

### O que a IA faz durante o jogo

- Patrulha uma area ao redor do spawn do monstro.
- Alterna entre patrulhar e ficar parado para o movimento parecer menos mecanico.
- Detecta o jogador por visao usando distancia e angulo de visao.
- Detecta o jogador por audicao quando o jogador se move perto do monstro.
- Guarda a ultima posicao conhecida do jogador em `lastKnownTarget`.
- Usa `lastSeenAt` e `memoryDurationMs` para controlar quanto tempo o monstro lembra do alvo.
- Quando perde o jogador, entra em `search` e investiga a ultima posicao conhecida.
- Quando um monstro detecta o jogador, ele alerta monstros proximos dentro de `alertRadius`.
- Monstros muito proximos do alerta podem entrar direto em `chase`.
- Monstros mais distantes entram em `alert` e investigam com mais cautela.
- Usa separacao entre monstros para reduzir sobreposicao durante movimento em grupo.
- Mantem animacoes coerentes: animacao de movimento quando esta andando e animacao idle quando esta parado.

### Parametros de IA por tipo de monstro

Os parametros ficam em `createEnemies(...)`, dentro dos objetos `slimeConfigs` e `ratConfigs`.

| Parametro | Slime | Rat | Efeito |
|-----------|-------|-----|--------|
| `speed` | `55` | `85` | Velocidade base do monstro. |
| `chaseDistance` | `190` | `210` | Distancia maxima para detectar visualmente o jogador. |
| `loseDistance` | `260` | `300` | Distancia em que o monstro ainda consegue manter a perseguicao antes de perder o alvo. |
| `hearingDistance` | `120` | `170` | Distancia em que o monstro consegue ouvir o jogador em movimento. |
| `alertRadius` | `150` | `190` | Raio usado para alertar outros monstros proximos. |
| `memoryDurationMs` | `1800` | `2400` | Tempo, em milissegundos, que o monstro lembra a ultima posicao do jogador. |
| `patrolRadiusX` | `90` | `120` | Alcance horizontal da patrulha em torno do spawn. |
| `patrolRadiusY` | `70` | `90` | Alcance vertical da patrulha em torno do spawn. |

### Fluxo resumido

1. `update(time, _delta)` atualiza o jogador e chama `updateEnemies(time)`.
2. `updateEnemies(time)` encontra o jogador mais proximo com `getClosestPlayer(...)`.
3. Para cada monstro, `updateEnemyAI(...)` decide o estado atual.
4. Se o jogador esta visivel, o monstro entra em `chase`.
5. Se o jogador nao esta visivel, mas esta fazendo barulho perto, o monstro entra em `alert`.
6. Se o monstro perde o jogador, ele entra em `search` e vai ate `lastKnownTarget`.
7. Se nada foi detectado, ele volta para `patrol` ou `idle`.
8. `moveEnemyFromAI(...)` aplica a velocidade no corpo fisico do monstro.
## Controles

O jogo aceita teclado e controle via Gamepad API do navegador.

| Acao | Teclado | Controle PS4 |
|------|---------|--------------|
| Mover jogador | Setas direcionais | Analogico esquerdo ou D-pad |
| Recomecar na tela de fim de jogo | `Enter` | Botao `X` |

Para testar com controle no navegador, conecte o controle, abra o jogo e pressione algum botao do controle uma vez depois que a pagina carregar. Alguns navegadores so liberam a leitura do controle depois dessa primeira interacao.

## Template Project Structure