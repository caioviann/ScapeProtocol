import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameover_text : Phaser.GameObjects.Text;
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

        this.background = this.add.image(512, 384, 'background');
        this.background.setAlpha(0.5);

        this.gameover_text = this.add.text(512, 384, this.won ? 'Voce venceu!\nConseguiu escapar.' : 'Game Over', {
            fontFamily: 'Arial Black', fontSize: this.won ? 54 : 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        });
        this.gameover_text.setOrigin(0.5);

        this.restart_text = this.add.text(512, 500, 'Pressione X no controle ou Enter no teclado para recomecar', {
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
