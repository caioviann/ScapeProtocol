import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    restart_text: Phaser.GameObjects.Text;
    private playerNumber = 1;
    private won = false;
    private restarted = false;

    constructor ()
    {
        super('GameOver');
    }

    init(data: { playerNumber?: number; won?: boolean })
    {
        this.playerNumber = data.playerNumber ?? 1;
        this.won = data.won ?? false;
        this.restarted = false;
    }

    create ()
    {
        this.camera = this.cameras.main
        this.camera.setBackgroundColor(this.won ? 0x0f766e : 0xff0000);

        this.background = this.add.image(512, 384, this.won ? 'victoryBackground' : 'gameOverBackground');
        this.background.setDisplaySize(1024, 768);

        this.add.rectangle(512, 704, 1024, 88, 0x000000, 0.55);
        this.restart_text = this.add.text(512, 704, 'Pressione X no controle ou Enter no teclado para recomecar', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        });
        this.restart_text.setOrigin(0.5);

        this.input.once('pointerdown', () => this.restartGame());
        this.input.keyboard?.once('keydown-ENTER', () => this.restartGame());
    }

    update()
    {
        if (this.isGamepadRestartPressed()) {
            this.restartGame();
        }
    }

    private isGamepadRestartPressed()
    {
        if (!navigator.getGamepads) {
            return false;
        }

        return navigator.getGamepads().some((gamepad) => {
            return gamepad?.connected && gamepad.buttons[0]?.pressed;
        });
    }

    private restartGame()
    {
        if (this.restarted) {
            return;
        }

        this.restarted = true;
        this.scene.start('Game', {
            playerNumber: this.playerNumber
        });
    }
}
