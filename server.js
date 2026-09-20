const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

const rooms = {};

server.on('connection', (ws) => {
    let currentRoom = null;
    let username = "Anonymous";

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) { return; }

        if (data.action === 'join') {
            // Basic sanitization
            const room = String(data.room || 'lobby').substring(0, 30);
            const password = String(data.password || '');
            username = String(data.username || 'Anonymous').substring(0, 20);

            if (!rooms[room]) {
                rooms[room] = { password: password, clients: [] };
            }

            if (rooms[room].password !== password) {
                ws.send(JSON.stringify({ action: 'error', message: 'Incorrect password' }));
                ws.close();
                return;
            }

            // Prevent duplicate usernames in the same room
            const nameTaken = rooms[room].clients.some(c => c.username === username);
            if (nameTaken) {
                username = username + Math.floor(Math.random() * 999);
            }

            currentRoom = room;
            rooms[currentRoom].clients.push({ ws, username });

            const allUsersInRoom = rooms[currentRoom].clients.map(c => c.username);

            ws.send(JSON.stringify({
                action: 'room_state',
                players: allUsersInRoom
            }));

            broadcastToRoom(currentRoom, ws, {
                action: 'join_notify',
                username: username
            });
        } 
        else if (data.action === 'update' || data.action === 'chat') {
            if (!currentRoom || !rooms[currentRoom]) return;
            
            // Force the username to be the authenticated one, preventing spoofing
            data.username = username; 
            broadcastToRoom(currentRoom, ws, data);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].clients = rooms[currentRoom].clients.filter(client => client.ws !== ws);
            
            broadcastToRoom(currentRoom, ws, {
                action: 'leave_notify',
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

console.log(`Bulletproof WebSocket server running on port ${PORT}`);
