import { Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    msg_text : Phaser.GameObjects.Text;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x000000); // Changed to black for better visibility

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
        const layerNames = ['fundo', 'parede', 'objetosDeCenário'];
        layerNames.forEach(name => {
            const layerData = map.getLayer(name);
            if (layerData) {
                map.createLayer(name, tilesets, 0, 0);
            }
        });

        // Set camera bounds to map size
        this.camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        // Para teste, adicione um texto no canto se quiser saber que o mapa carregou
        this.add.text(16, 16, 'Mapa carregado', { fontFamily: 'Arial', fontSize: 16, color: '#ffffff' });

        // Mudar para GameOver no clique
        this.input.once('pointerdown', () => {
            this.scene.start('GameOver');
        });
    }
}
