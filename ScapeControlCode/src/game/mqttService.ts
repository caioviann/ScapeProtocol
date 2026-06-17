import mqtt from 'mqtt';

const baseTopic = 'tes20261';
const initialRoom = new URLSearchParams(window.location.search).get('room') || '';
const initialRoomName = new URLSearchParams(window.location.search).get('roomName') || '';
let currentRoom = initialRoom;
let currentRoomName = initialRoomName;

export const mqttClientId = `player-${Math.random().toString(16).substring(2, 10)}`;

export const createRoomCode = () => Math.random().toString(16).substring(2, 8).toUpperCase();

export const sanitizeRoomCode = (room: string) => room.trim().replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();

export const sanitizeRoomName = (roomName: string) => roomName.trim().replace(/\s+/g, ' ').substring(0, 18);

export const setMqttRoom = (room: string) => {
    currentRoom = sanitizeRoomCode(room);

    const url = new URL(window.location.href);
    if (currentRoom) {
        url.searchParams.set('room', currentRoom);
    } else {
        url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url);
};

export const getMqttRoom = () => currentRoom;

export const setMqttRoomName = (roomName: string) => {
    currentRoomName = sanitizeRoomName(roomName);

    const url = new URL(window.location.href);
    if (currentRoomName) {
        url.searchParams.set('roomName', currentRoomName);
    } else {
        url.searchParams.delete('roomName');
    }
    window.history.replaceState({}, '', url);
};

export const getMqttRoomName = () => currentRoomName;

export const getMqttTopic = (sceneKey?: string) => {
    const room = currentRoom || createRoomCode();
    currentRoom = room;

    return sceneKey ? `${baseTopic}/${room}/${sceneKey}` : `${baseTopic}/${room}`;
};

export const getRoomsTopic = (room?: string) => room ? `${baseTopic}/rooms/${sanitizeRoomCode(room)}` : `${baseTopic}/rooms/+`;

export const mqttService = mqtt.connect('wss://mqtt.feira-de-jogos.dev.br', {
    clientId: mqttClientId,
});

mqttService.on('connect', () => {
    console.log('Connected to broker!');
});

mqttService.on('error', (err) => {
    console.error(`MQTT connection error: ${err.message}`);
});

mqttService.on('close', () => {
    console.warn('MQTT connection closed.');
});
