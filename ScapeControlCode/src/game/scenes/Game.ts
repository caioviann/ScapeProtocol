import { Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    player!: Phaser.Physics.Arcade.Sprite;
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    playerSpeed = 200;
    mapWidth = 0;
    mapHeight = 0;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
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
        const janelaLayer = map.createLayer('janela', tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        janelaLayer.setDepth(15);
        const paredeLayer = map.createLayer('parede', tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        map.createLayer('objetosDeCenário', tilesets, 0, 0);
        map.createLayer('ObjetosEmCimaDEObjetos', tilesets, 0, 0);

        paredeLayer.setCollisionBetween(1585, 2000);

        // Set camera bounds to map size
        this.camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.mapWidth = map.widthInPixels;
        this.mapHeight = map.heightInPixels;

        // Cria animações de andar do jogador
        this.anims.create({
            key: 'walkDown',
            frames: this.anims.generateFrameNumbers('playerFront', { start: 0, end: 2 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: 'walkLeft',
            frames: this.anims.generateFrameNumbers('playerFront', { start: 3, end: 5 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: 'walkRight',
            frames: this.anims.generateFrameNumbers('playerBack', { start: 0, end: 2 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: 'walkUp',
            frames: this.anims.generateFrameNumbers('playerBack', { start: 3, end: 5 }),
            frameRate: 8,
            repeat: -1
        });

        // Cria o player no centro do mapa
        const spawnX = this.mapWidth / 2;
        const spawnY = this.mapHeight / 2;
        this.player = this.physics.add.sprite(spawnX, spawnY, 'playerFront', 0);
        this.player.setDepth(10);
        this.player.setCollideWorldBounds(true);
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setSize(16, 32);

        this.physics.add.collider(this.player, paredeLayer);

        // Camera segue o jogador
        this.camera.startFollow(this.player, true, 0.1, 0.1);

        // Cria controles de seta
        this.cursors = this.input.keyboard!.createCursorKeys();
    }

    update (_time: number, _delta: number)
    {
        if (!this.player || !this.cursors) {
            return;
        }

        const speed = this.playerSpeed;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0);
        let moved = false;

        if (this.cursors.left?.isDown) {
            body.setVelocityX(-speed);
            this.player.anims.play('walkLeft', true);
            this.player.flipX = false;
            moved = true;
        }
        else if (this.cursors.right?.isDown) {
            body.setVelocityX(speed);
            this.player.anims.play('walkRight', true);
            this.player.flipX = false;
            moved = true;
        }

        if (this.cursors.up?.isDown) {
            body.setVelocityY(-speed);
            this.player.anims.play('walkUp', true);
            this.player.flipX = false;
            moved = true;
        }
        else if (this.cursors.down?.isDown) {
            body.setVelocityY(speed);
            this.player.anims.play('walkDown', true);
            this.player.flipX = false;
            moved = true;
        }

        if (moved) {
            body.velocity.normalize().scale(speed);
        }

        if (!moved) {
            this.player.anims.stop();
            this.player.setFrame(0);
        }

        // Mantém o jogador dentro dos limites do mapa
        const minX = this.player.width / 2;
        const minY = this.player.height / 2;

        this.player.x = Phaser.Math.Clamp(this.player.x, minX, this.mapWidth - this.player.width / 2);
        this.player.y = Phaser.Math.Clamp(this.player.y, minY, this.mapHeight - this.player.height / 2);
    }
}
