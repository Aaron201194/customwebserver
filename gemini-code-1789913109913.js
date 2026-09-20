const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;[cite: 1]
const wss = new WebSocketServer({ port: PORT });[cite: 1]

// Store your game data on the server
let storedData = {
    highScore: 0
};[cite: 1]

// Helper function to calculate and broadcast user count/names to a specific room
function broadcastRoomUpdate(roomCode) {
    if (!roomCode) return;
    
    let usernames = [];
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.room === roomCode) {
            usernames.push(client.username || 'Anonymous');
        }
    });

    const updatePacket = JSON.stringify({
        type: 'room_update',
        count: usernames.length,
        usernames: usernames
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.room === roomCode) {
            client.send(updatePacket);
        }
    });
}

console.log(`WebSocket server is running on port ${PORT}`);[cite: 1]

wss.on('connection', (ws) => {
    console.log('A new player connected!');[cite: 1]

    // Track individual room and username for this connection
    ws.room = null;
    ws.username = 'Anonymous';

    // Send the current stored data to the player who just joined
    ws.send(JSON.stringify({ type: 'UPDATE', data: storedData }));[cite: 1]

    // Listen for messages from players
    ws.on('message', (messageString) => {
        try {
            const message = JSON.parse(messageString);

            // Handle room joining
            if (message.type === 'join') {
                ws.room = message.room; // Room ID
                ws.username = message.username || 'Anonymous';
                console.log(`User ${ws.username} joined room ID: ${ws.room}`);
                broadcastRoomUpdate(ws.room);
            }

            // Handle chat messages and action data broadcasting within the same room
            else if (message.type === 'message' || message.type === 'chat') {
                const targetRoom = message.room || ws.room;
                
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.room === targetRoom) {
                        client.send(JSON.stringify({
                            type: message.type,
                            username: ws.username,
                            message: message.message,
                            data: message.data
                        }));
                    }
                });
            }

            // If a player updates the high score
            else if (message.type === 'SET_SCORE') {
                if (message.value > storedData.highScore) {
                    storedData.highScore = message.value;
                    
                    // Broadcast the new high score to EVERYONE connected
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'UPDATE', data: storedData }));[cite: 1]
                        }
                    });
                }
            }
        } catch (e) {
            console.log('Received non-JSON message:', messageString);[cite: 1]
        }
    });

    ws.on('close', () => {
        console.log('A player disconnected.');[cite: 1]
        if (ws.room) {
            broadcastRoomUpdate(ws.room);
        }
    });
});