# Phaser Webpack TypeScript Template

This is a Phaser 3 project template that uses webpack for bundling. It supports hot-reloading for quick development workflow, includes TypeScript support and scripts to generate production-ready builds.

**[This Template is also available as a JavaScript version.](https://github.com/phaserjs/template-webpack)**

### Versions

This template has been updated for:

- [Phaser 3.90.0](https://github.com/phaserjs/phaser)
- [Webpack 5.99.6](https://github.com/webpack/webpack)
- [TypeScript 5.4.5](https://github.com/microsoft/TypeScript)

![screenshot](screenshot.png)

## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Launch a development web server |
| `npm run build` | Create a production build in the `dist` folder |
| `npm run dev-nolog` | Launch a development web server without sending anonymous data (see "About log.js" below) |
| `npm run build-nolog` | Create a production build in the `dist` folder without sending anonymous data (see "About log.js" below) |

## Writing Code

After cloning the repo, run `npm install` from your project directory. Then, you can start the local development server by running `npm run dev`.

The local development server runs on `http://localhost:8080` by default. Please see the webpack documentation if you wish to change this, or add SSL support.

Once the server is running you can edit any of the files in the `src` folder. Webpack will automatically recompile your code and then reload the browser.

## Template Project Structure

We have provided a default project structure to get you started. This is as follows:

| Path                         | Description                                                |
|------------------------------|------------------------------------------------------------|
| `public/index.html`          | A basic HTML page to contain the game.                     |
| `public/assets`              | Game sprites, audio, etc. Served directly at runtime.      |
| `public/style.css`           | Global layout styles.                                      |
| `src/main.ts`                | Application bootstrap.                                     |
| `src/game`                   | Folder containing the game code.                           |
| `src/game/main.ts`           | Game entry point: configures and starts the game.          |
| `src/game/scenes`            | Folder with all Phaser game scenes.                        |

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


## Handling Assets

Webpack supports loading assets via JavaScript module `import` statements.

This template provides support for both embedding assets and also loading them from a static folder. To embed an asset, you can import it at the top of the JavaScript file you are using it in:

```js
import logoImg from './assets/logo.png'
```

To load static files such as audio files, videos, etc place them into the `public/assets` folder. Then you can use this path in the Loader calls within Phaser:

```js
preload ()
{
    //  This is an example of an imported bundled image.
    //  Remember to import it at the top of this file
    this.load.image('logo', logoImg);

    //  This is an example of loading a static image
    //  from the public/assets folder:
    this.load.image('background', 'assets/bg.png');
}
```

When you issue the `npm run build` command, all static assets are automatically copied to the `dist/assets` folder.

## Deploying to Production

After you run the `npm run build` command, your code will be built into a single bundle and saved to the `dist` folder, along with any other assets your project imported, or stored in the public assets folder.

In order to deploy your game, you will need to upload *all* of the contents of the `dist` folder to a public facing web server.

## Customizing the Template

### Babel

You can write modern ES6+ JavaScript and Babel will transpile it to a version of JavaScript that you want your project to support. The targeted browsers are set in the `.babelrc` file and the default currently targets all browsers with total usage over "0.25%" but excludes IE11 and Opera Mini.

 ```
"browsers": [
  ">0.25%",
  "not ie 11",
  "not op_mini all"
]
 ```

### Webpack

If you want to customize your build, such as adding a new webpack loader or plugin (i.e. for loading CSS or fonts), you can modify the `webpack/config.*.js` file for cross-project changes, or you can modify and/or create new configuration files and target them in specific npm tasks inside of `package.json`. Please see the [Webpack documentation](https://webpack.js.org/) for more information.

## About log.js

If you inspect our node scripts you will see there is a file called `log.js`. This file makes a single silent API call to a domain called `gryzor.co`. This domain is owned by Phaser Studio Inc. The domain name is a homage to one of our favorite retro games.

We send the following 3 pieces of data to this API: The name of the template being used (vue, react, etc). If the build was 'dev' or 'prod' and finally the version of Phaser being used.

At no point is any personal data collected or sent. We don't know about your project files, device, browser or anything else. Feel free to inspect the `log.js` file to confirm this.

Why do we do this? Because being open source means we have no visible metrics about which of our templates are being used. We work hard to maintain a large and diverse set of templates for Phaser developers and this is our small anonymous way to determine if that work is actually paying off, or not. In short, it helps us ensure we're building the tools for you.

However, if you don't want to send any data, you can use these commands instead:

Dev:

```bash
npm run dev-nolog
```

Build:

```bash
npm run build-nolog
```

Or, to disable the log entirely, simply delete the file `log.js` and remove the call to it in the `scripts` section of `package.json`:

Before:

```json
"scripts": {
    "dev": "node log.js dev & dev-template-script",
    "build": "node log.js build & build-template-script"
},
```

After:

```json
"scripts": {
    "dev": "dev-template-script",
    "build": "build-template-script"
},
```

Either of these will stop `log.js` from running. If you do decide to do this, please could you at least join our Discord and tell us which template you're using! Or send us a quick email. Either will be super-helpful, thank you.

## Join the Phaser Community!

We love to see what developers like you create with Phaser! It really motivates us to keep improving. So please join our community and show-off your work 😄

**Visit:** The [Phaser website](https://phaser.io) and follow on [Phaser Twitter](https://twitter.com/phaser_)<br />
**Play:** Some of the amazing games [#madewithphaser](https://twitter.com/search?q=%23madewithphaser&src=typed_query&f=live)<br />
**Learn:** [API Docs](https://newdocs.phaser.io), [Support Forum](https://phaser.discourse.group/) and [StackOverflow](https://stackoverflow.com/questions/tagged/phaser-framework)<br />
**Discord:** Join us on [Discord](https://discord.gg/phaser)<br />
**Code:** 2000+ [Examples](https://labs.phaser.io)<br />
**Read:** The [Phaser World](https://phaser.io/community/newsletter) Newsletter<br />

Created by [Phaser Studio](mailto:support@phaser.io). Powered by coffee, anime, pixels and love.

The Phaser logo and characters are &copy; 2011 - 2025 Phaser Studio Inc.

All rights reserved.
