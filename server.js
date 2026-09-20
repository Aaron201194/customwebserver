const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

let storedData = {
    highScore: 0
};

// Broadcast user list updates to a room
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

console.log(`WebSocket server is running on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('A new player connected!');

    ws.room = null;
    ws.username = 'Anonymous';

    ws.send(JSON.stringify({ type: 'UPDATE', data: storedData }));

    ws.on('message', (messageString) => {
        try {
            const message = JSON.parse(messageString);

            // Handle room joining
            if (message.type === 'join') {
                ws.room = message.room;
                ws.username = message.username || 'Anonymous';
                console.log(`User ${ws.username} joined room ID: ${ws.room}`);
                broadcastRoomUpdate(ws.room);
            }

            // Handle Multiplayer Platformer State (X, Y, Costume, Direction)
            else if (message.type === 'player_state') {
                const targetRoom = message.room || ws.room;
                
                // Broadcast to ALL OTHER players in the same room
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.room === targetRoom && client !== ws) {
                        client.send(JSON.stringify({
                            type: 'player_state',
                            username: ws.username,
                            x: message.x,
                            y: message.y,
                            costume: message.costume,
                            direction: message.direction
                        }));
                    }
                });
            }

            // Handle standard chat messages
            else if (message.type === 'chat') {
                const targetRoom = message.room || ws.room;
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.room === targetRoom) {
                        client.send(JSON.stringify({
                            type: 'chat',
                            username: ws.username,
                            message: message.message
                        }));
                    }
                });
            }

            // High score tracking
            else if (message.type === 'SET_SCORE') {
                if (message.value > storedData.highScore) {
                    storedData.highScore = message.value;
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'UPDATE', data: storedData }));
                        }
                    });
                }
            }
        } catch (e) {
            console.log('Received non-JSON message:', messageString);
        }
    });

    ws.on('close', () => {
        console.log('A player disconnected.');
        if (ws.room) {
            broadcastRoomUpdate(ws.room);
        }
    });
});
