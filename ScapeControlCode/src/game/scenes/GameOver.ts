import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameover_text : Phaser.GameObjects.Text;
    private playerNumber = 1;
    private won = false;

    constructor ()
    {
        super('GameOver');
    }

    init(data: { playerNumber?: number; won?: boolean })
    {
        this.playerNumber = data.playerNumber ?? 1;
        this.won = data.won ?? false;
    }

    create ()
    {
        this.camera = this.cameras.main
        this.camera.setBackgroundColor(this.won ? 0x0f766e : 0xff0000);

        this.background = this.add.image(512, 384, 'background');
        this.background.setAlpha(0.5);

        this.gameover_text = this.add.text(512, 384, this.won ? 'Voce venceu!\nConseguiu escapar.' : 'Game Over', {
            fontFamily: 'Arial Black', fontSize: this.won ? 54 : 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        });
        this.gameover_text.setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('Game', {
                playerNumber: this.playerNumber
            });
        });
    }
}
