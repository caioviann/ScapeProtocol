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
