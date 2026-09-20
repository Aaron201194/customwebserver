const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

// Room layout storage: { roomId: { password: 'xyz', clients: [{ws, username}] } }
const rooms = {};

server.on('connection', (ws) => {
    let currentRoom = null;
    let username = "Anonymous";

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return;
        }

        if (data.action === 'join') {
            const { room, password, username: user } = data;
            username = user || "Anonymous";

            if (!rooms[room]) {
                rooms[room] = { password: password, clients: [] };
            }

            if (rooms[room].password !== password) {
                ws.send(JSON.stringify({ action: 'error', message: 'Incorrect password' }));
                ws.close();
                return;
            }

            currentRoom = room;
            rooms[room].clients.push({ ws, username });

            broadcastToRoom(currentRoom, ws, {
                action: 'player_join',
                username: username
            });
        } 
        else if (['update', 'chat'].includes(data.action)) {
            if (!currentRoom || !rooms[currentRoom]) return;
            data.username = username;
            broadcastToRoom(currentRoom, ws, data);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].clients = rooms[currentRoom].clients.filter(client => client.ws !== ws);
            
            broadcastToRoom(currentRoom, ws, {
                action: 'player_leave',
                username: username
            });

            if (rooms[currentRoom].clients.length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

function broadcastToRoom(roomName, senderWs, dataObject) {
    const room = rooms[roomName];
    if (!room) return;
    const stringified = JSON.stringify(dataObject);
    room.clients.forEach(client => {
        if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(stringified);
        }
    });
}

console.log(`Multiplayer WebSocket server running on port ${PORT}`);
