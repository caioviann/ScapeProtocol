import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'MainMenu.png');
        this.load.spritesheet('playerFront', 'person/Personagem-Principal-Front-Left.png', {
            frameWidth: 16,
            frameHeight: 32
        });
        this.load.spritesheet('playerBack', 'person/Personagem-Principal-Back-Right.png', {
            frameWidth: 16,
            frameHeight: 32
        });
        this.load.spritesheet('radioactiveFrontRight', 'person/characters_radioactiveFrontRight.png', {
            frameWidth: 26,
            frameHeight: 41
        });
        this.load.spritesheet('radioactiveLeftBack', 'person/characters_radioactiveLeftBack.png', {
            frameWidth: 26,
            frameHeight: 41
        });

        this.load.spritesheet('slimeIdle', 'NPCs/Slime/idle.png', {
            frameWidth: 156,
            frameHeight: 156
        });
        this.load.spritesheet('slimeWalk', 'NPCs/Slime/walk.png', {
            frameWidth: 156,
            frameHeight: 156
        });
        this.load.spritesheet('ratIdle', 'NPCs/Rat/idle.png', {
            frameWidth: 70,
            frameHeight: 70
        });
        this.load.spritesheet('ratRun', 'NPCs/Rat/run.png', {
            frameWidth: 70,
            frameHeight: 70
        });
        this.load.spritesheet('batFly', 'NPCs/Bat/fly.png', {
            frameWidth: 87,
            frameHeight: 87
        });
        this.load.spritesheet('mimicIdle', 'NPCs/Mimic/Idle_closed.png', {
            frameWidth: 146,
            frameHeight: 146
        });
        this.load.spritesheet('mimicWalk', 'NPCs/Mimic/walk.png', {
            frameWidth: 146,
            frameHeight: 146
        });
        this.load.audio('backgroundMusic', '../sounds/music/Eduard_Perelyhin_-_Suspense_Ambient__amp__Outbreak.mp3');

        // Load tileset images for the map
        this.load.image('spriteSheet_fireEffect03_21x26', 'spriteSheet_fireEffect03_21x26.png');
        this.load.image('spriteSheet_lightBulbSmallAnimation_16x16', 'spriteSheet_lightBulbSmallAnimation_16x16.png');
        this.load.image('spriteSheet_lightingBulb02_68x73', 'spriteSheet_lightingBulb02_68x73.png');
        this.load.image('spriteSheet_tiledLiquids_16x16', 'spriteSheet_tiledLiquids_16x16.png');
        this.load.image('tilesFloor', 'tilesFloor.png');
        this.load.image('tilesStuff', 'tilesStuff.png');
        this.load.image('tilesWalls', 'tilesWalls.png');

        // Load the tilemap
        this.load.tilemapTiledJSON('map', 'mapPhase3.json');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu');
    }
}
