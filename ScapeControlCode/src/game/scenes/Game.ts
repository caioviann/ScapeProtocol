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
    private playerCharacter!: PlayerCharacter;
    private playerNumber = 1;
    private roomPresenceEvent?: Phaser.Time.TimerEvent;
    private darknessOverlay?: Phaser.GameObjects.Rectangle;
    private playerLightMask?: Phaser.GameObjects.Graphics;
    private enemySoundCooldowns = new Map<string, number>();

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
        map.createLayer('objetosDeCenário', tilesets, 0, 0);
        map.createLayer('ObjetosEmCimaDEObjetos', tilesets, 0, 0);

        paredeLayer.setCollisionBetween(1585, 2000);

        this.mapWidth = map.widthInPixels;
        this.mapHeight = map.heightInPixels;

        this.playerCharacter = this.getPlayerCharacter();
        this.createPlayerAnimations();
        this.createEnemyAnimations();

        // Cria o player no centro do mapa
        const spawnX = this.mapWidth / 2;
        const spawnY = this.mapHeight / 2;
        this.player = this.physics.add.sprite(spawnX, spawnY, this.playerCharacter.idleTexture, this.playerCharacter.idleFrame);
        this.player.setDepth(10);
        this.player.setCollideWorldBounds(true);
        this.setupRadioactiveSpriteOrigin(this.player);
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setSize(this.playerCharacter.body.width, this.playerCharacter.body.height);
        playerBody.setOffset(this.playerCharacter.body.offsetX, this.playerCharacter.body.offsetY);

        this.physics.add.collider(this.player, paredeLayer);
        this.createEnemies(paredeLayer);
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
            this.playerWasHit = false;
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
        body.setVelocity(0);
        let moved = false;

        if (this.cursors.left?.isDown) {
            body.setVelocityX(-speed);
            this.player.anims.play(this.playerCharacter.animations.left, true);
            this.player.flipX = false;
            moved = true;
        }
        else if (this.cursors.right?.isDown) {
            body.setVelocityX(speed);
            this.player.anims.play(this.playerCharacter.animations.right, true);
            this.player.flipX = false;
            moved = true;
        }

        if (this.cursors.up?.isDown) {
            body.setVelocityY(-speed);
            this.player.anims.play(this.playerCharacter.animations.up, true);
            this.player.flipX = false;
            moved = true;
        }
        else if (this.cursors.down?.isDown) {
            body.setVelocityY(speed);
            this.player.anims.play(this.playerCharacter.animations.down, true);
            this.player.flipX = false;
            moved = true;
        }

        if (moved) {
            body.velocity.normalize().scale(speed);
        }

        if (!moved) {
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

    private createEnemies(paredeLayer: Phaser.Tilemaps.TilemapLayer) {
        const enemyConfigs: EnemyConfig[] = [
            {
                id: 'slime-1',
                texture: 'slimeIdle',
                idleAnimation: 'slimeIdle',
                moveAnimation: 'slimeWalk',
                soundKey: 'slimeSound',
                x: 728,
                y: 152,
                speed: 55,
                chaseDistance: 190,
                scale: 0.45,
                body: { width: 58, height: 34, offsetX: 49, offsetY: 90 }
            },
            {
                id: 'slime-2',
                texture: 'slimeIdle',
                idleAnimation: 'slimeIdle',
                moveAnimation: 'slimeWalk',
                soundKey: 'slimeSound',
                x: 792,
                y: 152,
                speed: 55,
                chaseDistance: 190,
                scale: 0.45,
                body: { width: 58, height: 34, offsetX: 49, offsetY: 90 }
            },
            {
                id: 'rat-1',
                texture: 'ratIdle',
                idleAnimation: 'ratIdle',
                moveAnimation: 'ratRun',
                soundKey: 'ratSound',
                x: 600,
                y: 320,
                speed: 85,
                chaseDistance: 210,
                scale: 0.75,
                body: { width: 34, height: 20, offsetX: 18, offsetY: 38 }
            },
            {
                id: 'rat-2',
                texture: 'ratIdle',
                idleAnimation: 'ratIdle',
                moveAnimation: 'ratRun',
                soundKey: 'ratSound',
                x: 640,
                y: 352,
                speed: 85,
                chaseDistance: 210,
                scale: 0.75,
                body: { width: 34, height: 20, offsetX: 18, offsetY: 38 }
            },
            {
                id: 'rat-3',
                texture: 'ratIdle',
                idleAnimation: 'ratIdle',
                moveAnimation: 'ratRun',
                soundKey: 'ratSound',
                x: 704,
                y: 384,
                speed: 85,
                chaseDistance: 210,
                scale: 0.75,
                body: { width: 34, height: 20, offsetX: 18, offsetY: 38 }
            }
        ];

        this.enemies = enemyConfigs.map((config) => {
            const sprite = this.physics.add.sprite(config.x, config.y, config.texture, 0);
            sprite.setDepth(9);
            sprite.setScale(config.scale);
            sprite.setCollideWorldBounds(true);
            sprite.anims.play(config.idleAnimation, true);

            const body = sprite.body as Phaser.Physics.Arcade.Body;
            body.setSize(config.body.width, config.body.height);
            body.setOffset(config.body.offsetX, config.body.offsetY);

            this.physics.add.collider(sprite, paredeLayer);
            this.physics.add.overlap(this.player, sprite, () => this.handlePlayerHit());

            return {
                config,
                sprite,
                home: new Phaser.Math.Vector2(config.x, config.y),
                wanderTarget: new Phaser.Math.Vector2(config.x, config.y),
                nextWanderAt: 0
            };
        });
    }

    private updateEnemies(time: number) {
        for (const enemy of this.enemies) {
            const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
            const target = this.getClosestPlayer(enemy.sprite.x, enemy.sprite.y);

            let destination = enemy.wanderTarget;
            let speed = enemy.config.speed * 0.45;

            if (target && Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y) <= enemy.config.chaseDistance) {
                destination = new Phaser.Math.Vector2(target.x, target.y);
                speed = enemy.config.speed;
                this.playEnemySound(enemy.config.soundKey, time);
            } else if (time >= enemy.nextWanderAt || Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, enemy.wanderTarget.x, enemy.wanderTarget.y) < 8) {
                enemy.wanderTarget.set(
                    Phaser.Math.Clamp(enemy.home.x + Phaser.Math.Between(-90, 90), 24, this.mapWidth - 24),
                    Phaser.Math.Clamp(enemy.home.y + Phaser.Math.Between(-70, 70), 24, this.mapHeight - 24)
                );
                enemy.nextWanderAt = time + Phaser.Math.Between(1200, 2600);
                destination = enemy.wanderTarget;
            }

            const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, destination.x, destination.y);

            if (distance > 6) {
                this.physics.moveToObject(enemy.sprite, destination, speed);
                enemy.sprite.flipX = body.velocity.x < 0;
                enemy.sprite.anims.play(enemy.config.moveAnimation, true);
            } else {
                body.setVelocity(0);
                enemy.sprite.anims.play(enemy.config.idleAnimation, true);
            }
        }
    }

    private playEnemySound(soundKey: string, time: number) {
        const nextSoundAt = this.enemySoundCooldowns.get(soundKey) ?? 0;

        if (time < nextSoundAt) {
            return;
        }

        this.sound.play(soundKey, {
            volume: 0.55
        });
        this.enemySoundCooldowns.set(soundKey, time + 1800);
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
        this.scene.start('GameOver', {
            playerNumber: this.playerNumber
        });
    }
}
