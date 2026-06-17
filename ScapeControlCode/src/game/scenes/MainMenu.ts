import { Scene, GameObjects } from 'phaser';
import {
    createRoomCode,
    getMqttRoom,
    getMqttRoomName,
    getMqttTopic,
    getRoomsTopic,
    mqttClientId,
    mqttService,
    sanitizeRoomCode,
    sanitizeRoomName,
    setMqttRoom,
    setMqttRoomName
} from '../mqttService';

type MenuMode = 'idle' | 'created' | 'joining';
type ActiveInput = 'name' | 'code';

interface SeenPlayer {
    id: string;
    lastSeen: number;
}

interface OpenRoom {
    code: string;
    name: string;
    players: number;
    updatedAt: number;
}

export class MainMenu extends Scene {
    private roomCodeText!: GameObjects.Text;
    private roomNameInputText!: GameObjects.Text;
    private roomCodeInputText!: GameObjects.Text;
    private roomStatusText!: GameObjects.Text;
    private roomsTitleText!: GameObjects.Text;
    private createButton!: GameObjects.Text;
    private joinButton!: GameObjects.Text;
    private enterButton!: GameObjects.Text;
    private roomListTexts: GameObjects.Text[] = [];
    private activeInput: ActiveInput = 'code';
    private mode: MenuMode = 'idle';
    private roomNameInput = '';
    private roomInput = '';
    private selectedRoom = '';
    private observedTopic = '';
    private seenPlayers = new Map<string, SeenPlayer>();
    private openRooms = new Map<string, OpenRoom>();
    private roomScanEvent?: Phaser.Time.TimerEvent;
    private roomListEvent?: Phaser.Time.TimerEvent;
    private roomPresenceEvent?: Phaser.Time.TimerEvent;
    private readonly maxPlayers = 2;
    private readonly playerTimeoutMs = 3500;
    private readonly roomTimeoutMs = 6500;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.add.image(512, 384, 'background').setDisplaySize(1024, 768).setAlpha(0.9);
        this.add.rectangle(512, 384, 1024, 768, 0x05080d, 0.62);

        this.add.text(512, 70, 'SCAPE PROTOCOL', {
            fontFamily: 'Arial Black',
            fontSize: 42,
            color: '#ffffff',
            stroke: '#111111',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.roomCodeText = this.add.text(512, 122, 'Crie uma sala, nomeie ou entre em uma sala aberta.', {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#d5f3ff',
            align: 'center'
        }).setOrigin(0.5);

        this.add.rectangle(288, 424, 430, 520, 0x07111d, 0.82).setStrokeStyle(2, 0x2a9d8f, 0.6);
        this.add.rectangle(746, 424, 390, 520, 0x07111d, 0.82).setStrokeStyle(2, 0x2a9d8f, 0.45);

        this.add.text(288, 190, 'SUA SALA', {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(288, 242, 'NOME DA SALA', {
            fontFamily: 'Arial Black',
            fontSize: 15,
            color: '#8ddfe3'
        }).setOrigin(0.5);

        this.roomNameInputText = this.createInputText(288, 286, 340, () => {
            this.activeInput = 'name';
            this.refreshMenu();
        });

        this.add.text(288, 342, 'CODIGO', {
            fontFamily: 'Arial Black',
            fontSize: 15,
            color: '#8ddfe3'
        }).setOrigin(0.5);

        this.roomCodeInputText = this.createInputText(288, 386, 340, () => {
            this.activeInput = 'code';
            this.refreshMenu();
        });

        this.roomStatusText = this.add.text(288, 444, '', {
            fontFamily: 'Arial',
            fontSize: 19,
            color: '#d5f3ff',
            align: 'center'
        }).setOrigin(0.5);

        this.createButton = this.createButtonText(184, 516, 'CRIAR', () => this.createRoom());
        this.joinButton = this.createButtonText(392, 516, 'ENTRAR', () => this.joinRoom());
        this.enterButton = this.createButtonText(288, 582, 'INICIAR SALA', () => this.enterRoom());

        this.roomsTitleText = this.add.text(746, 190, 'SALAS ABERTAS', {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        this.input.keyboard?.on('keydown', this.handleKeyDown, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.stopRoomScan();
            this.stopRoomPresence();
            this.roomListEvent?.remove(false);
            this.roomListEvent = undefined;
            mqttService.unsubscribe(getRoomsTopic());
            mqttService.off('message', this.handleRoomsMessage);
            this.input.keyboard?.off('keydown', this.handleKeyDown, this);
        });

        mqttService.subscribe(getRoomsTopic());
        mqttService.on('message', this.handleRoomsMessage);
        this.roomListEvent = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => this.refreshRoomList()
        });

        const urlRoom = getMqttRoom();
        if (urlRoom) {
            this.selectedRoom = sanitizeRoomCode(urlRoom);
            this.roomInput = this.selectedRoom;
            this.roomNameInput = getMqttRoomName();
            this.mode = 'joining';
            this.startRoomScan(this.selectedRoom);
        }

        this.refreshMenu();
        this.refreshRoomList();
    }

    private createInputText(x: number, y: number, width: number, onClick: () => void) {
        const input = this.add.text(x, y, '', {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#f2d57e',
            backgroundColor: '#0f1724',
            fixedWidth: width,
            padding: { x: 18, y: 12 },
            align: 'center'
        }).setOrigin(0.5);

        input.setInteractive({ useHandCursor: true });
        input.on('pointerdown', onClick);

        return input;
    }

    private createButtonText(x: number, y: number, label: string, onClick: () => void) {
        const button = this.add.text(x, y, label, {
            fontFamily: 'Arial Black',
            fontSize: 19,
            color: '#ffffff',
            backgroundColor: '#264653',
            padding: { x: 24, y: 14 },
            align: 'center'
        }).setOrigin(0.5);

        button.setInteractive({ useHandCursor: true });
        button.on('pointerover', () => button.setStyle({ backgroundColor: '#2a9d8f' }));
        button.on('pointerout', () => this.refreshMenu());
        button.on('pointerdown', onClick);

        return button;
    }

    private createRoom() {
        this.mode = 'created';
        this.selectedRoom = createRoomCode();
        this.roomInput = this.selectedRoom;
        this.roomNameInput = sanitizeRoomName(this.roomNameInput) || `Sala ${this.selectedRoom}`;
        this.activeInput = 'name';
        setMqttRoom(this.selectedRoom);
        setMqttRoomName(this.roomNameInput);
        this.startRoomScan(this.selectedRoom);
        this.startRoomPresence();
        this.refreshMenu();
    }

    private prepareJoinRoom() {
        const room = sanitizeRoomCode(this.roomInput);
        this.mode = 'joining';

        if (room) {
            this.selectedRoom = room;
            setMqttRoom(room);
            setMqttRoomName(this.roomNameInput);
            this.startRoomScan(room);
        } else {
            this.selectedRoom = '';
            setMqttRoom('');
            this.stopRoomScan();
        }

        this.refreshMenu();
    }

    private joinRoom() {
        this.prepareJoinRoom();
        this.enterRoom();
    }

    private enterRoom() {
        const room = sanitizeRoomCode(this.selectedRoom || this.roomInput);
        const playerCount = this.getSelectedRoomPlayerCount(room);

        if (!room || playerCount >= this.maxPlayers) {
            this.refreshMenu();
            return;
        }

        setMqttRoom(room);
        setMqttRoomName(this.roomNameInput);
        this.publishRoomPresence(playerCount + 1);
        this.scene.start('Game', {
            playerNumber: playerCount === 0 ? 1 : 2
        });
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Tab') {
            event.preventDefault();
            this.activeInput = this.activeInput === 'name' ? 'code' : 'name';
            this.refreshMenu();
            return;
        }

        if (event.key === 'Enter') {
            this.joinRoom();
            return;
        }

        if (event.key === 'Backspace') {
            if (this.activeInput === 'name') {
                this.roomNameInput = this.roomNameInput.slice(0, -1);
                setMqttRoomName(this.roomNameInput);
            } else {
                this.roomInput = this.roomInput.slice(0, -1);
                this.prepareJoinRoom();
            }
            this.refreshMenu();
            return;
        }

        if (this.activeInput === 'name' && event.key.length === 1 && this.roomNameInput.length < 18) {
            this.roomNameInput = sanitizeRoomName(`${this.roomNameInput}${event.key}`);
            setMqttRoomName(this.roomNameInput);
            if (this.mode === 'created') {
                this.publishRoomPresence();
            }
            this.refreshMenu();
            return;
        }

        if (this.activeInput === 'code' && /^[a-zA-Z0-9-]$/.test(event.key) && this.roomInput.length < 12) {
            this.roomInput = sanitizeRoomCode(`${this.roomInput}${event.key}`);
            this.prepareJoinRoom();
        }
    }

    private startRoomScan(room: string) {
        setMqttRoom(room);
        const topic = getMqttTopic('Game');

        if (this.observedTopic === topic) {
            return;
        }

        this.stopRoomScan();
        this.seenPlayers.clear();
        this.observedTopic = topic;

        mqttService.subscribe(topic);
        mqttService.on('message', this.handleRoomMessage);
        this.roomScanEvent = this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                this.refreshMenu();
                if (this.mode === 'created') {
                    this.publishRoomPresence();
                }
            }
        });

        this.refreshMenu();
    }

    private stopRoomScan() {
        if (this.observedTopic) {
            mqttService.unsubscribe(this.observedTopic);
            mqttService.off('message', this.handleRoomMessage);
            this.observedTopic = '';
        }

        this.roomScanEvent?.remove(false);
        this.roomScanEvent = undefined;
    }

    private startRoomPresence() {
        this.stopRoomPresence();
        this.publishRoomPresence();
        this.roomPresenceEvent = this.time.addEvent({
            delay: 1500,
            loop: true,
            callback: () => this.publishRoomPresence()
        });
    }

    private stopRoomPresence() {
        this.roomPresenceEvent?.remove(false);
        this.roomPresenceEvent = undefined;
    }

    private publishRoomPresence(players = Math.max(1, this.getActivePlayerCount() + 1)) {
        const room = sanitizeRoomCode(this.selectedRoom || this.roomInput);

        if (!room) {
            return;
        }

        mqttService.publish(
            getRoomsTopic(room),
            JSON.stringify({
                room,
                name: sanitizeRoomName(this.roomNameInput) || `Sala ${room}`,
                players: Math.min(players, this.maxPlayers),
                maxPlayers: this.maxPlayers,
                owner: mqttClientId,
                updatedAt: Date.now()
            }),
            { retain: true }
        );
    }

    private handleRoomMessage = (_topic: string, message: Buffer) => {
        try {
            const data = JSON.parse(message.toString());
            const id = data.player?.id;

            if (!id || id === mqttClientId) {
                return;
            }

            this.seenPlayers.set(id, {
                id,
                lastSeen: Date.now()
            });
            this.refreshMenu();
        } catch {
            return;
        }
    };

    private handleRoomsMessage = (topic: string, message: Buffer) => {
        if (!topic.startsWith('tes20261/rooms/')) {
            return;
        }

        try {
            const data = JSON.parse(message.toString());
            const code = sanitizeRoomCode(data.room || topic.split('/').pop() || '');

            if (!code) {
                return;
            }

            this.openRooms.set(code, {
                code,
                name: sanitizeRoomName(data.name) || `Sala ${code}`,
                players: Math.min(Number(data.players) || 0, this.maxPlayers),
                updatedAt: Number(data.updatedAt) || Date.now()
            });
            this.refreshRoomList();
        } catch {
            return;
        }
    };

    private getActivePlayerCount() {
        const now = Date.now();

        for (const player of this.seenPlayers.values()) {
            if (now - player.lastSeen > this.playerTimeoutMs) {
                this.seenPlayers.delete(player.id);
            }
        }

        return Math.min(this.seenPlayers.size, this.maxPlayers);
    }

    private getSelectedRoomPlayerCount(room: string) {
        const activePlayers = this.getActivePlayerCount();

        if (this.mode === 'created') {
            return activePlayers;
        }

        return Math.max(activePlayers, this.openRooms.get(room)?.players ?? 0);
    }

    private refreshMenu() {
        const room = sanitizeRoomCode(this.selectedRoom || this.roomInput);
        const activePlayers = this.getSelectedRoomPlayerCount(room);
        const isFull = activePlayers >= this.maxPlayers;
        const nameLabel = this.roomNameInput || 'NOME DA SALA';
        const codeLabel = this.roomInput || 'CODIGO DA SALA';

        this.roomNameInputText.setText(nameLabel);
        this.roomNameInputText.setColor(this.roomNameInput ? '#f2d57e' : '#8fa3ad');
        this.roomNameInputText.setBackgroundColor(this.activeInput === 'name' ? '#18324b' : '#0f1724');
        this.roomCodeInputText.setText(codeLabel);
        this.roomCodeInputText.setColor(this.roomInput ? '#f2d57e' : '#8fa3ad');
        this.roomCodeInputText.setBackgroundColor(this.activeInput === 'code' ? '#18324b' : '#0f1724');

        if (this.mode === 'created') {
            this.roomCodeText.setText(`Sala criada: ${sanitizeRoomName(this.roomNameInput) || `Sala ${room}`} (${room})`);
        } else if (this.mode === 'joining') {
            this.roomCodeText.setText(room ? `Sala selecionada: ${room}` : 'Digite o codigo da sala ou escolha uma sala aberta.');
        } else {
            this.roomCodeText.setText('Crie uma sala, nomeie ou entre em uma sala aberta.');
        }

        if (!room) {
            this.roomStatusText.setText('Nenhuma sala selecionada.');
        } else if (isFull) {
            this.roomStatusText.setText(`Sala cheia: ${activePlayers}/${this.maxPlayers} jogadores.`);
        } else {
            this.roomStatusText.setText(`Jogadores na sala: ${activePlayers}/${this.maxPlayers}`);
        }

        const canStartCreatedRoom = this.mode === 'created' && !!room && !isFull;

        this.enterButton.setAlpha(this.mode === 'created' ? (canStartCreatedRoom ? 1 : 0.45) : 0);
        this.enterButton.disableInteractive();
        if (canStartCreatedRoom) {
            this.enterButton.setInteractive({ useHandCursor: true });
        }

        this.createButton.setStyle({ backgroundColor: '#264653' });
        this.joinButton.setStyle({ backgroundColor: '#264653' });
        this.enterButton.setStyle({ backgroundColor: canStartCreatedRoom ? '#2a9d8f' : '#4a5560' });
    }

    private refreshRoomList() {
        const now = Date.now();

        for (const room of this.openRooms.values()) {
            if (now - room.updatedAt > this.roomTimeoutMs || room.players >= this.maxPlayers) {
                this.openRooms.delete(room.code);
            }
        }

        this.roomListTexts.forEach((text) => text.destroy());
        this.roomListTexts = [];

        const rooms = [...this.openRooms.values()]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 5);

        this.roomsTitleText.setText(rooms.length ? 'SALAS ABERTAS' : 'NENHUMA SALA ABERTA');

        rooms.forEach((room, index) => {
            const y = 252 + index * 76;
            const text = this.add.text(746, y, `${room.name}\n${room.code}     ${room.players}/${this.maxPlayers}`, {
                fontFamily: 'Arial Black',
                fontSize: 17,
                color: '#ffffff',
                backgroundColor: '#132235',
                fixedWidth: 320,
                fixedHeight: 56,
                padding: { x: 14, y: 8 },
                align: 'center'
            }).setOrigin(0.5);

            text.setInteractive({ useHandCursor: true });
            text.on('pointerdown', () => {
                this.roomNameInput = room.name;
                this.roomInput = room.code;
                this.selectedRoom = room.code;
                this.activeInput = 'code';
                this.prepareJoinRoom();
            });
            this.roomListTexts.push(text);
        });
    }
}
