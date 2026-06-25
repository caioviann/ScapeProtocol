import { Scene } from 'phaser';
import { getMqttRoom, getMqttRoomName, getMqttTopic, getRoomsTopic, mqttService, mqttClientId, sanitizeRoomName } from '../mqttService';

interface RemotePlayer {
    id: string;
    sprite: Phaser.GameObjects.Sprite;
}

interface PlayerCharacter {
    idleTexture: string;
    idleFrame: number;
    body: {
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
    };
    animations: {
        down: string;
        left: string;
        right: string;
        up: string;
    };
}

type PlayerDirection = 'down' | 'left' | 'right' | 'up';

interface PlayerMovementInput {
    x: number;
    y: number;
    direction: PlayerDirection | null;
}

const RADIOACTIVE_FRAME_ORIGINS: Record<string, Record<number, number>> = {
    radioactiveFrontRight: {
        0: 7 / 26,
        1: 13.5 / 26,
        2: 18.5 / 26,
        3: 7 / 26,
        4: 13 / 26,
        5: 18.5 / 26
    },
    radioactiveLeftBack: {
        0: 8 / 26,
        1: 14.5 / 26,
        2: 19.5 / 26,
        3: 8 / 26,
        4: 14 / 26,
        5: 19 / 26
    }
};

const ENEMY_SOUND_SETTINGS: Record<string, {
    distance: number;
    cooldownMs: number;
    minVolume: number;
    maxVolume: number;
    continuous?: boolean;
}> = {
    ratSound: {
        distance: 90,
        cooldownMs: 2400,
        minVolume: 0.18,
        maxVolume: 0.58
    },
    slimeSound: {
        distance: 140,
        cooldownMs: 9000,
        minVolume: 0.45,
        maxVolume: 0.85,
        continuous: true
    }
};

type AdjustableEnemySound = Phaser.Sound.BaseSound & {
    setVolume(value: number): Phaser.Sound.BaseSound;
};

interface SpawnPoint {
    x: number;
    y: number;
}

interface ObjectZone {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ObjectSpawns {
    players: SpawnPoint[];
    slimes: SpawnPoint[];
    rats: SpawnPoint[];
    endGames: ObjectZone[];
}

const FALLBACK_PLAYER_SPAWNS = [
    { x: 392, y: 472 },
    { x: 438, y: 472 }
];

const FALLBACK_SLIME_SPAWNS = [
    { x: 376, y: 120 },
    { x: 324, y: 310 },
    { x: 1028, y: 170 }
];

const FALLBACK_RAT_SPAWNS = [
    { x: 120, y: 392 },
    { x: 640, y: 672 },
    { x: 990, y: 680 }
];

const GAMEPAD_AXIS_DEADZONE = 0.25;
const GAMEPAD_BUTTON_DEADZONE = 0.5;
const GAMEPAD_BUTTONS = {
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15
};

type EnemyAIState = 'idle' | 'patrol' | 'alert' | 'chase' | 'search';
type EnemyTarget = Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite;

interface EnemyConfig {
    id: string;
    texture: string;
    idleAnimation: string;
    moveAnimation: string;
    soundKey: string;
    x: number;
    y: number;
    speed: number;
    chaseDistance: number;
    loseDistance: number;
    hearingDistance: number;
    alertRadius: number;
    memoryDurationMs: number;
    patrolRadiusX: number;
    patrolRadiusY: number;
    scale: number;
    body: {
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
    };
}

interface Enemy {
    config: EnemyConfig;
    sprite: Phaser.Physics.Arcade.Sprite;
    home: Phaser.Math.Vector2;
    wanderTarget: Phaser.Math.Vector2;
    lastKnownTarget: Phaser.Math.Vector2 | null;
    lastSeenAt: number;
    state: EnemyAIState;
    stateUntil: number;
    nextWanderAt: number;
}

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    player!: Phaser.Physics.Arcade.Sprite;
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    playerSpeed = 200;
    mapWidth = 0;
    mapHeight = 0;
    remotePlayers: RemotePlayer[] = [];
    enemies: Enemy[] = [];
    mqttTopic!: string;
    private playerWasHit = false;
    private gameEnded = false;
    private playerCharacter!: PlayerCharacter;
    private playerNumber = 1;
    private roomPresenceEvent?: Phaser.Time.TimerEvent;
    private darknessOverlay?: Phaser.GameObjects.Rectangle;
    private playerLightMask?: Phaser.GameObjects.Graphics;
    private enemySoundCooldowns = new Map<string, number>();
    private activeEnemySounds = new Map<string, AdjustableEnemySound>();

    constructor() {
        super('Game');
    }

    init(data: { playerNumber?: number }) {
        this.playerNumber = data.playerNumber ?? 1;
    }

    create() {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x000000);

        // Load the tilemap
        const map = this.make.tilemap({ key: 'map' });

        // Add all tilesets declared in the map (by name) to support dynamic map content
        const tilesets = map.tilesets
            .map(ts => map.addTilesetImage(ts.name, ts.name))
            .filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

        if (tilesets.length === 0) {
            this.add.text(512, 384, 'Nenhum tileset foi carregado.\nVerifique os PNGs em public/assets.', {
                fontFamily: 'Arial', fontSize: 24, color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            return;
        }

        // Cria as camadas do tilemap conhecidas
        map.createLayer('fundo', tilesets, 0, 0);
        map.createLayer('gradePiso', tilesets, 0, 0);
        const janelaLayer = map.createLayer('janela', tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        janelaLayer.setDepth(15);
        const paredeLayer = map.createLayer('parede', tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        const objetosDeCenarioLayer = map.createLayer('objetosDeCenário', tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        map.createLayer('ObjetosEmCimaDEObjetos', tilesets, 0, 0);

        paredeLayer.setCollisionBetween(1585, 2000);
        objetosDeCenarioLayer.setCollisionByExclusion([-1, 0]);

        this.mapWidth = map.widthInPixels;
        this.mapHeight = map.heightInPixels;
        const objectSpawns = this.getObjectSpawns(map);

        this.playerCharacter = this.getPlayerCharacter();
        this.createPlayerAnimations();
        this.createEnemyAnimations();

        const playerSpawn = objectSpawns.players[this.playerNumber - 1] ?? objectSpawns.players[0];
        const spawnX = playerSpawn.x;
        const spawnY = playerSpawn.y;
        this.player = this.physics.add.sprite(spawnX, spawnY, this.playerCharacter.idleTexture, this.playerCharacter.idleFrame);
        this.player.setDepth(10);
        this.player.setCollideWorldBounds(true);
        this.setupRadioactiveSpriteOrigin(this.player);
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setSize(this.playerCharacter.body.width, this.playerCharacter.body.height);
        playerBody.setOffset(this.playerCharacter.body.offsetX, this.playerCharacter.body.offsetY);

        const collisionLayers = [paredeLayer, objetosDeCenarioLayer];
        collisionLayers.forEach((layer) => this.physics.add.collider(this.player, layer));
        this.createEnemies(collisionLayers, objectSpawns);
        this.createEndGameZones(objectSpawns);
        this.createPlayerLight();

        // Camera segue o jogador
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.startFollow(this.player);

        this.mqttTopic = getMqttTopic(this.sys.settings.key);

        mqttService.subscribe(this.mqttTopic, () => {
            console.log(`${mqttClientId} subscribed to ${this.mqttTopic}`);
        });

        const messageHandler = (_topic: string, message: Buffer) => {
            const data = JSON.parse(message.toString());

            if (data.gameEnded && data.id !== mqttClientId) {
                this.finishGame(data.won === true);
                return;
            }

            if (!data.player) {
                return;
            }

            if (data.player.id === mqttClientId) {
                return;
            }

            const existsAt = this.remotePlayers.findIndex((rp) => rp.id === data.player.id);
            if (existsAt === -1) {
                const sprite = this.add.sprite(data.player.x, data.player.y, data.player.texture, data.player.frame).setDepth(5);
                this.setupRadioactiveSpriteOrigin(sprite);
                sprite.flipX = data.player.flip.x;
                sprite.flipY = data.player.flip.y;
                if (data.player.animation) {
                    sprite.anims.play(data.player.animation, true);
                }
                this.applyRadioactiveSpriteOrigin(sprite);
                this.remotePlayers.push({ id: data.player.id, sprite });
            } else {
                const remotePlayer = this.remotePlayers[existsAt];
                remotePlayer.sprite.setTexture(data.player.texture, data.player.frame);
                remotePlayer.sprite.setPosition(data.player.x, data.player.y);
                remotePlayer.sprite.flipX = data.player.flip.x;
                remotePlayer.sprite.flipY = data.player.flip.y;
                if (data.player.animation) {
                    remotePlayer.sprite.anims.play(data.player.animation, true);
                }
                this.applyRadioactiveSpriteOrigin(remotePlayer.sprite);
            }
        };

        mqttService.on('message', messageHandler);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            mqttService.off('message', messageHandler);
            mqttService.unsubscribe(this.mqttTopic);
            this.remotePlayers = [];
            this.enemies = [];
            this.enemySoundCooldowns.clear();
            this.stopContinuousEnemySounds();
            this.playerWasHit = false;
            this.gameEnded = false;
            this.darknessOverlay?.destroy();
            this.playerLightMask?.destroy();
            this.darknessOverlay = undefined;
            this.playerLightMask = undefined;
            this.roomPresenceEvent?.remove(false);
            this.roomPresenceEvent = undefined;
        });

        // Cria controles de seta
        this.cursors = this.input.keyboard!.createCursorKeys();

        this.publishRoomPresence();
        this.roomPresenceEvent = this.time.addEvent({
            delay: 1500,
            loop: true,
            callback: () => this.publishRoomPresence()
        });
    }

    update(time: number, _delta: number) {
        if (!this.player || !this.cursors) {
            return;
        }

        const speed = this.playerSpeed;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const movement = this.getPlayerMovementInput();
        body.setVelocity(0);

        if (movement.x !== 0 || movement.y !== 0) {
            body.setVelocity(movement.x * speed, movement.y * speed);
            body.velocity.normalize().scale(speed);
            if (movement.direction) {
                this.player.anims.play(this.playerCharacter.animations[movement.direction], true);
                this.player.flipX = false;
            }
        }
        else {
            this.player.anims.stop();
            this.player.setTexture(this.playerCharacter.idleTexture, this.playerCharacter.idleFrame);
            this.applyRadioactiveSpriteOrigin(this.player);
        }

        this.applyRadioactiveSpriteOrigin(this.player);

        // Mantém o jogador dentro dos limites do mapa
        const minX = this.player.width / 2;
        const minY = this.player.height / 2;

        this.player.x = Phaser.Math.Clamp(this.player.x, minX, this.mapWidth - this.player.width / 2);
        this.player.y = Phaser.Math.Clamp(this.player.y, minY, this.mapHeight - this.player.height / 2);
        this.updatePlayerLight();

        mqttService.publish(
            this.mqttTopic,
            JSON.stringify({
                player: {
                    id: mqttClientId,
                    x: this.player.x,
                    y: this.player.y,
                    texture: this.player.texture.key,
                    frame: this.player.frame.name,
                    flip: {
                        x: this.player.flipX,
                        y: this.player.flipY,
                    },
                    animation: this.player.anims.currentAnim ? this.player.anims.currentAnim.key : null,
                    character: this.playerCharacter.idleTexture,
                },
            }),
        );

        this.updateEnemies(time);
    }

    private getPlayerMovementInput(): PlayerMovementInput {
        const keyboardX = this.getKeyboardAxis(this.cursors.left?.isDown, this.cursors.right?.isDown);
        const keyboardY = this.getKeyboardAxis(this.cursors.up?.isDown, this.cursors.down?.isDown);
        const gamepad = this.getGamepadMovementInput();
        const x = keyboardX !== 0 ? keyboardX : gamepad.x;
        const y = keyboardY !== 0 ? keyboardY : gamepad.y;

        return {
            x,
            y,
            direction: this.getMovementDirection(x, y)
        };
    }

    private getKeyboardAxis(negativePressed = false, positivePressed = false) {
        if (negativePressed) {
            return -1;
        }

        if (positivePressed) {
            return 1;
        }

        return 0;
    }

    private getGamepadMovementInput(): { x: number; y: number } {
        const gamepad = this.getActiveGamepad();

        if (!gamepad) {
            return { x: 0, y: 0 };
        }

        const axisX = this.applyGamepadDeadzone(gamepad.axes[0] ?? 0);
        const axisY = this.applyGamepadDeadzone(gamepad.axes[1] ?? 0);
        const dpadX = this.getGamepadButtonAxis(gamepad, GAMEPAD_BUTTONS.dpadLeft, GAMEPAD_BUTTONS.dpadRight);
        const dpadY = this.getGamepadButtonAxis(gamepad, GAMEPAD_BUTTONS.dpadUp, GAMEPAD_BUTTONS.dpadDown);

        return {
            x: dpadX !== 0 ? dpadX : axisX,
            y: dpadY !== 0 ? dpadY : axisY
        };
    }

    private getActiveGamepad() {
        if (!navigator.getGamepads) {
            return null;
        }

        return navigator.getGamepads().find((gamepad) => gamepad?.connected) ?? null;
    }

    private applyGamepadDeadzone(value: number) {
        return Math.abs(value) >= GAMEPAD_AXIS_DEADZONE ? value : 0;
    }

    private getGamepadButtonAxis(gamepad: Gamepad, negativeButtonIndex: number, positiveButtonIndex: number) {
        const negativePressed = (gamepad.buttons[negativeButtonIndex]?.value ?? 0) > GAMEPAD_BUTTON_DEADZONE;
        const positivePressed = (gamepad.buttons[positiveButtonIndex]?.value ?? 0) > GAMEPAD_BUTTON_DEADZONE;

        if (negativePressed) {
            return -1;
        }

        if (positivePressed) {
            return 1;
        }

        return 0;
    }

    private getMovementDirection(x: number, y: number): PlayerDirection | null {
        if (y < 0) {
            return 'up';
        }

        if (y > 0) {
            return 'down';
        }

        if (x < 0) {
            return 'left';
        }

        if (x > 0) {
            return 'right';
        }

        return null;
    }

    private createPlayerLight() {
        this.playerLightMask = new Phaser.GameObjects.Graphics(this);
        const mask = this.playerLightMask.createGeometryMask();
        mask.setInvertAlpha(true);

        this.darknessOverlay = this.add.rectangle(0, 0, this.mapWidth, this.mapHeight, 0x000000, 0.95)
            .setOrigin(0)
            .setDepth(1000)
            .setMask(mask);

        this.updatePlayerLight();
    }

    private updatePlayerLight() {
        if (!this.playerLightMask || !this.player) {
            return;
        }

        this.playerLightMask.clear();
        this.playerLightMask.fillStyle(0xffffff);
        this.playerLightMask.fillCircle(this.player.x, this.player.y, 50);
    }

    private publishRoomPresence() {
        const room = getMqttRoom();

        if (!room) {
            return;
        }

        mqttService.publish(
            getRoomsTopic(room),
            JSON.stringify({
                room,
                name: sanitizeRoomName(getMqttRoomName()) || `Sala ${room}`,
                players: Math.min(this.remotePlayers.length + 1, 2),
                maxPlayers: 2,
                owner: mqttClientId,
                updatedAt: Date.now()
            }),
            { retain: true }
        );
    }

    private setupRadioactiveSpriteOrigin(sprite: Phaser.GameObjects.Sprite) {
        this.applyRadioactiveSpriteOrigin(sprite);
        sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => {
            this.applyRadioactiveSpriteOrigin(sprite);
        });
    }

    private applyRadioactiveSpriteOrigin(sprite: Phaser.GameObjects.Sprite) {
        const textureOrigins = RADIOACTIVE_FRAME_ORIGINS[sprite.texture.key];

        if (!textureOrigins) {
            sprite.setOrigin(0.5);
            return;
        }

        const frameNumber = Number(sprite.frame.name);
        sprite.setOrigin(textureOrigins[frameNumber] ?? 0.5, 0.5);
    }

    private getPlayerCharacter(): PlayerCharacter {
        const params = new URLSearchParams(window.location.search);
        const character = params.get('character');
        const player = params.get('player');
        const isRadioactive = character === 'radioactive' || player === '2' || this.playerNumber === 2;

        if (isRadioactive) {
            return {
                idleTexture: 'radioactiveFrontRight',
                idleFrame: 0,
                body: { width: 16, height: 8, offsetX: 5, offsetY: 31 },
                animations: {
                    down: 'radioactiveWalkDown',
                    left: 'radioactiveWalkLeft',
                    right: 'radioactiveWalkRight',
                    up: 'radioactiveWalkUp'
                }
            };
        }

        return {
            idleTexture: 'playerFront',
            idleFrame: 0,
            body: { width: 16, height: 8, offsetX: 0, offsetY: 24 },
            animations: {
                down: 'walkDown',
                left: 'walkLeft',
                right: 'walkRight',
                up: 'walkUp'
            }
        };
    }

    private createPlayerAnimations() {
        const createAnimation = (key: string, texture: string, start: number, end: number, frameRate: number) => {
            if (this.anims.exists(key)) {
                return;
            }

            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers(texture, { start, end }),
                frameRate,
                repeat: -1
            });
        };

        createAnimation('walkDown', 'playerFront', 0, 2, 8);
        createAnimation('walkLeft', 'playerFront', 3, 5, 8);
        createAnimation('walkRight', 'playerBack', 0, 2, 8);
        createAnimation('walkUp', 'playerBack', 3, 5, 8);
        createAnimation('radioactiveWalkDown', 'radioactiveFrontRight', 0, 2, 8);
        createAnimation('radioactiveWalkRight', 'radioactiveFrontRight', 3, 5, 8);
        createAnimation('radioactiveWalkLeft', 'radioactiveLeftBack', 0, 2, 8);
        createAnimation('radioactiveWalkUp', 'radioactiveLeftBack', 3, 5, 8);
    }

    private createEnemyAnimations() {
        const createAnimation = (key: string, texture: string, start: number, end: number, frameRate: number) => {
            if (this.anims.exists(key)) {
                return;
            }

            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers(texture, { start, end }),
                frameRate,
                repeat: -1
            });
        };

        createAnimation('slimeIdle', 'slimeIdle', 0, 13, 8);
        createAnimation('slimeWalk', 'slimeWalk', 0, 5, 10);
        createAnimation('ratIdle', 'ratIdle', 0, 9, 8);
        createAnimation('ratRun', 'ratRun', 0, 7, 12);
        createAnimation('batFly', 'batFly', 0, 10, 12);
        createAnimation('mimicIdle', 'mimicIdle', 0, 0, 1);
        createAnimation('mimicWalk', 'mimicWalk', 0, 5, 8);
    }

    private getObjectSpawns(map: Phaser.Tilemaps.Tilemap): ObjectSpawns {
        const objectLayer = map.objects.find((layer) => layer.name.toLowerCase() === 'camadadeobjetos');
        const spawns: ObjectSpawns = {
            players: [],
            slimes: [],
            rats: [],
            endGames: []
        };

        objectLayer?.objects.forEach((object) => {
            const point = {
                x: object.x ?? 0,
                y: object.y ?? 0
            };

            if (object.name === 'spawn_player') {
                spawns.players.push(point);
            } else if (object.name === 'spawn_slime') {
                spawns.slimes.push(point);
            } else if (object.name === 'spawn_rat') {
                spawns.rats.push(point);
            } else if (object.name === 'end_game') {
                spawns.endGames.push({
                    x: object.x ?? 0,
                    y: object.y ?? 0,
                    width: object.width ?? 0,
                    height: object.height ?? 0
                });
            }
        });

        return {
            players: spawns.players.length ? spawns.players : FALLBACK_PLAYER_SPAWNS,
            slimes: spawns.slimes.length ? spawns.slimes : FALLBACK_SLIME_SPAWNS,
            rats: spawns.rats.length ? spawns.rats : FALLBACK_RAT_SPAWNS,
            endGames: spawns.endGames
        };
    }

    private createEnemies(collisionLayers: Phaser.Tilemaps.TilemapLayer[], objectSpawns: ObjectSpawns) {
        const slimeConfigs = objectSpawns.slimes.map((spawn, index): EnemyConfig => ({
            id: `slime-${index + 1}`,
            texture: 'slimeIdle',
            idleAnimation: 'slimeIdle',
            moveAnimation: 'slimeWalk',
            soundKey: 'slimeSound',
            x: spawn.x,
            y: spawn.y,
            speed: 55,
            chaseDistance: 190,
            loseDistance: 260,
            hearingDistance: 120,
            alertRadius: 150,
            memoryDurationMs: 1800,
            patrolRadiusX: 90,
            patrolRadiusY: 70,
            scale: 0.45,
            body: { width: 58, height: 34, offsetX: 49, offsetY: 90 }
        }));
        const ratConfigs = objectSpawns.rats.map((spawn, index): EnemyConfig => ({
            id: `rat-${index + 1}`,
            texture: 'ratIdle',
            idleAnimation: 'ratIdle',
            moveAnimation: 'ratRun',
            soundKey: 'ratSound',
            x: spawn.x,
            y: spawn.y,
            speed: 85,
            chaseDistance: 210,
            loseDistance: 300,
            hearingDistance: 170,
            alertRadius: 190,
            memoryDurationMs: 2400,
            patrolRadiusX: 120,
            patrolRadiusY: 90,
            scale: 0.75,
            body: { width: 34, height: 20, offsetX: 18, offsetY: 38 }
        }));
        const enemyConfigs: EnemyConfig[] = [...slimeConfigs, ...ratConfigs];

        this.enemies = enemyConfigs.map((config) => {
            const sprite = this.physics.add.sprite(config.x, config.y, config.texture, 0);
            sprite.setDepth(9);
            sprite.setScale(config.scale);
            sprite.setCollideWorldBounds(true);
            sprite.anims.play(config.idleAnimation, true);

            const body = sprite.body as Phaser.Physics.Arcade.Body;
            body.setSize(config.body.width, config.body.height);
            body.setOffset(config.body.offsetX, config.body.offsetY);

            collisionLayers.forEach((layer) => this.physics.add.collider(sprite, layer));
            this.physics.add.overlap(this.player, sprite, () => this.handlePlayerHit());

            return {
                config,
                sprite,
                home: new Phaser.Math.Vector2(config.x, config.y),
                wanderTarget: new Phaser.Math.Vector2(config.x, config.y),
                lastKnownTarget: null,
                lastSeenAt: 0,
                state: 'patrol',
                stateUntil: 0,
                nextWanderAt: 0
            };
        });
    }

    private createEndGameZones(objectSpawns: ObjectSpawns) {
        objectSpawns.endGames.forEach((zoneConfig) => {
            const width = zoneConfig.width || 32;
            const height = zoneConfig.height || 32;
            const x = zoneConfig.width ? zoneConfig.x + width / 2 : zoneConfig.x;
            const y = zoneConfig.height ? zoneConfig.y + height / 2 : zoneConfig.y;
            const zone = this.add.zone(x, y, width, height);

            this.physics.add.existing(zone, true);
            this.physics.add.overlap(this.player, zone, () => this.handleEndGame());
        });
    }

    private updateEnemies(time: number) {
        const continuousSoundDistances = new Map<string, number>();

        for (const enemy of this.enemies) {
            const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
            const target = this.getClosestPlayer(enemy.sprite.x, enemy.sprite.y);
            const localPlayerDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
            const soundSettings = ENEMY_SOUND_SETTINGS[enemy.config.soundKey];

            if (soundSettings && localPlayerDistance <= soundSettings.distance) {
                if (soundSettings.continuous) {
                    const closestDistance = continuousSoundDistances.get(enemy.config.soundKey);

                    if (closestDistance === undefined || localPlayerDistance < closestDistance) {
                        continuousSoundDistances.set(enemy.config.soundKey, localPlayerDistance);
                    }
                } else {
                    this.playEnemySound(enemy.config.soundKey, time, localPlayerDistance);
                }
            }

            this.updateEnemyAI(enemy, target, time);
            this.moveEnemyFromAI(enemy, body);
        }

        for (const [soundKey, settings] of Object.entries(ENEMY_SOUND_SETTINGS)) {
            if (!settings.continuous) {
                continue;
            }

            const distance = continuousSoundDistances.get(soundKey);

            if (distance === undefined) {
                this.stopContinuousEnemySound(soundKey);
            } else {
                this.playContinuousEnemySound(soundKey, distance);
            }
        }
    }

    private updateEnemyAI(enemy: Enemy, target: EnemyTarget | null, time: number) {
        if (target) {
            const targetDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
            const canSeeTarget = targetDistance <= enemy.config.chaseDistance && this.isTargetInEnemyVision(enemy, target);
            const canHearTarget = targetDistance <= enemy.config.hearingDistance && this.isTargetMakingNoise(target);

            if (canSeeTarget) {
                enemy.state = 'chase';
                enemy.lastKnownTarget = new Phaser.Math.Vector2(target.x, target.y);
                enemy.lastSeenAt = time;
                enemy.stateUntil = time + 900;
                this.alertNearbyEnemies(enemy, target, time);
                return;
            }

            if (enemy.state === 'chase' && targetDistance <= enemy.config.loseDistance) {
                enemy.lastKnownTarget = new Phaser.Math.Vector2(target.x, target.y);
                enemy.lastSeenAt = time;
                return;
            }

            if (canHearTarget && enemy.state !== 'chase') {
                enemy.state = 'alert';
                enemy.lastKnownTarget = new Phaser.Math.Vector2(target.x, target.y);
                enemy.stateUntil = time + 900;
                this.alertNearbyEnemies(enemy, target, time, false);
                return;
            }
        }

        if (enemy.state === 'chase') {
            const stillRemembersTarget = enemy.lastKnownTarget && time - enemy.lastSeenAt <= enemy.config.memoryDurationMs;

            enemy.state = stillRemembersTarget ? 'search' : 'patrol';
            enemy.stateUntil = time + 1400;
            return;
        }

        if (enemy.state === 'alert') {
            if (time >= enemy.stateUntil) {
                enemy.state = enemy.lastKnownTarget ? 'search' : 'patrol';
                enemy.stateUntil = time + 1200;
            }

            return;
        }

        if (enemy.state === 'search') {
            const lastKnownTarget = enemy.lastKnownTarget;
            const reachedLastKnownTarget = lastKnownTarget
                ? Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, lastKnownTarget.x, lastKnownTarget.y) < 10
                : true;

            if (reachedLastKnownTarget || time >= enemy.stateUntil) {
                enemy.state = 'patrol';
                enemy.lastKnownTarget = null;
                enemy.nextWanderAt = 0;
            }

            return;
        }

        if (enemy.state === 'idle' && time < enemy.stateUntil) {
            return;
        }

        if (enemy.state === 'idle') {
            enemy.state = 'patrol';
            enemy.nextWanderAt = 0;
        }

        if (time >= enemy.nextWanderAt || Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, enemy.wanderTarget.x, enemy.wanderTarget.y) < 8) {
            if (Phaser.Math.Between(0, 100) < 30) {
                enemy.state = 'idle';
                enemy.stateUntil = time + Phaser.Math.Between(500, 1200);
                return;
            }

            enemy.state = 'patrol';
            enemy.wanderTarget.set(
                Phaser.Math.Clamp(enemy.home.x + Phaser.Math.Between(-enemy.config.patrolRadiusX, enemy.config.patrolRadiusX), 24, this.mapWidth - 24),
                Phaser.Math.Clamp(enemy.home.y + Phaser.Math.Between(-enemy.config.patrolRadiusY, enemy.config.patrolRadiusY), 24, this.mapHeight - 24)
            );
            enemy.nextWanderAt = time + Phaser.Math.Between(1200, 2600);
        }
    }

    private isTargetInEnemyVision(enemy: Enemy, target: EnemyTarget) {
        const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);

        if (distance <= enemy.config.chaseDistance * 0.42) {
            return true;
        }

        const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
        const facingAngle = body.velocity.lengthSq() > 1
            ? body.velocity.angle()
            : Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, enemy.wanderTarget.x, enemy.wanderTarget.y);
        const targetAngle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
        const angleDifference = Math.abs(Phaser.Math.Angle.Wrap(targetAngle - facingAngle));

        return angleDifference <= Phaser.Math.DegToRad(115);
    }

    private isTargetMakingNoise(target: EnemyTarget) {
        if (target === this.player) {
            const body = this.player.body as Phaser.Physics.Arcade.Body;

            return body.velocity.lengthSq() > 400;
        }

        return Boolean(target.anims.currentAnim);
    }

    private alertNearbyEnemies(sourceEnemy: Enemy, target: EnemyTarget, time: number, escalateToChase = true) {
        for (const enemy of this.enemies) {
            if (enemy === sourceEnemy || enemy.state === 'chase') {
                continue;
            }

            const distanceFromSource = Phaser.Math.Distance.Between(sourceEnemy.sprite.x, sourceEnemy.sprite.y, enemy.sprite.x, enemy.sprite.y);

            if (distanceFromSource > sourceEnemy.config.alertRadius) {
                continue;
            }

            enemy.lastKnownTarget = new Phaser.Math.Vector2(target.x, target.y);
            enemy.lastSeenAt = time;

            if (escalateToChase && distanceFromSource <= sourceEnemy.config.alertRadius * 0.55) {
                enemy.state = 'chase';
                enemy.stateUntil = time + 700;
            } else {
                enemy.state = 'alert';
                enemy.stateUntil = time + Phaser.Math.Between(700, 1300);
            }
        }
    }

    private moveEnemyFromAI(enemy: Enemy, body: Phaser.Physics.Arcade.Body) {
        const movement = this.getEnemyMovement(enemy);

        if (!movement) {
            body.setVelocity(0);
            enemy.sprite.anims.play(enemy.config.idleAnimation, true);
            return;
        }

        const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, movement.destination.x, movement.destination.y);

        if (distance <= 6) {
            body.setVelocity(0);
            enemy.sprite.anims.play(enemy.config.idleAnimation, true);
            return;
        }

        const desiredVelocity = new Phaser.Math.Vector2(
            movement.destination.x - enemy.sprite.x,
            movement.destination.y - enemy.sprite.y
        ).normalize().scale(movement.speed);
        const separationVelocity = this.getEnemySeparationVelocity(enemy).scale(movement.speed);
        const finalVelocity = desiredVelocity.add(separationVelocity);

        if (finalVelocity.lengthSq() > movement.speed * movement.speed) {
            finalVelocity.normalize().scale(movement.speed);
        }

        body.setVelocity(finalVelocity.x, finalVelocity.y);
        enemy.sprite.flipX = body.velocity.x < 0;
        enemy.sprite.anims.play(enemy.config.moveAnimation, true);
    }

    private getEnemyMovement(enemy: Enemy): { destination: Phaser.Math.Vector2; speed: number } | null {
        if (enemy.state === 'chase' && enemy.lastKnownTarget) {
            return {
                destination: enemy.lastKnownTarget,
                speed: enemy.config.speed
            };
        }

        if (enemy.state === 'search' && enemy.lastKnownTarget) {
            return {
                destination: enemy.lastKnownTarget,
                speed: enemy.config.speed * 0.65
            };
        }

        if (enemy.state === 'alert' && enemy.lastKnownTarget) {
            return {
                destination: enemy.lastKnownTarget,
                speed: enemy.config.speed * 0.35
            };
        }

        if (enemy.state === 'patrol') {
            return {
                destination: enemy.wanderTarget,
                speed: enemy.config.speed * 0.45
            };
        }

        return null;
    }

    private getEnemySeparationVelocity(enemy: Enemy) {
        const separation = new Phaser.Math.Vector2(0, 0);

        for (const otherEnemy of this.enemies) {
            if (otherEnemy === enemy) {
                continue;
            }

            const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, otherEnemy.sprite.x, otherEnemy.sprite.y);

            if (distance <= 0 || distance > 38) {
                continue;
            }

            separation.x += (enemy.sprite.x - otherEnemy.sprite.x) / distance;
            separation.y += (enemy.sprite.y - otherEnemy.sprite.y) / distance;
        }

        if (separation.lengthSq() === 0) {
            return separation;
        }

        return separation.normalize().scale(0.45);
    }

    private playEnemySound(soundKey: string, time: number, distance: number) {
        const soundSettings = ENEMY_SOUND_SETTINGS[soundKey];

        if (!soundSettings) {
            return;
        }

        const nextSoundAt = this.enemySoundCooldowns.get(soundKey) ?? 0;

        if (time < nextSoundAt) {
            return;
        }

        const proximity = 1 - Phaser.Math.Clamp(distance / soundSettings.distance, 0, 1);

        this.sound.play(soundKey, {
            volume: Phaser.Math.Linear(soundSettings.minVolume, soundSettings.maxVolume, proximity)
        });
        this.enemySoundCooldowns.set(soundKey, time + soundSettings.cooldownMs);
    }

    private playContinuousEnemySound(soundKey: string, distance: number) {
        const soundSettings = ENEMY_SOUND_SETTINGS[soundKey];

        if (!soundSettings) {
            return;
        }

        const proximity = 1 - Phaser.Math.Clamp(distance / soundSettings.distance, 0, 1);
        const volume = Phaser.Math.Linear(soundSettings.minVolume, soundSettings.maxVolume, proximity);
        const sound = this.activeEnemySounds.get(soundKey) ?? this.sound.add(soundKey, {
            loop: true,
            volume
        }) as AdjustableEnemySound;

        this.activeEnemySounds.set(soundKey, sound);

        if (sound.isPlaying) {
            sound.setVolume(volume);
        } else {
            sound.play({
                loop: true,
                volume
            });
        }
    }

    private stopContinuousEnemySound(soundKey: string) {
        const sound = this.activeEnemySounds.get(soundKey);

        if (!sound) {
            this.sound.stopByKey(soundKey);
            return;
        }

        sound.stop();
        this.sound.remove(sound);
        this.activeEnemySounds.delete(soundKey);
    }

    private stopContinuousEnemySounds() {
        for (const soundKey of this.activeEnemySounds.keys()) {
            this.stopContinuousEnemySound(soundKey);
        }
    }

    private getClosestPlayer(x: number, y: number) {
        const players = [
            this.player,
            ...this.remotePlayers.map((remotePlayer) => remotePlayer.sprite)
        ];

        return players.reduce<Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite | null>((closest, player) => {
            if (!closest) {
                return player;
            }

            const currentDistance = Phaser.Math.Distance.Between(x, y, player.x, player.y);
            const closestDistance = Phaser.Math.Distance.Between(x, y, closest.x, closest.y);

            return currentDistance < closestDistance ? player : closest;
        }, null);
    }

    private handlePlayerHit() {
        if (this.playerWasHit) {
            return;
        }

        this.playerWasHit = true;
        this.finishGame(false);
    }

    private handleEndGame() {
        if (this.gameEnded) {
            return;
        }

        mqttService.publish(
            this.mqttTopic,
            JSON.stringify({
                gameEnded: true,
                won: true,
                id: mqttClientId
            })
        );
        this.finishGame(true);
    }

    private finishGame(won: boolean) {
        if (this.gameEnded) {
            return;
        }

        this.gameEnded = true;
        this.stopContinuousEnemySounds();
        this.scene.start('GameOver', {
            playerNumber: this.playerNumber,
            won
        });
    }
}
