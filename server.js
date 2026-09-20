const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Store your game data on the server
let storedData = {
    highScore: 0
};

console.log(`WebSocket server is running on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('A new player connected!');

    // Send the current stored data to the player who just joined
    ws.send(JSON.stringify({ type: 'UPDATE', data: storedData }));

    // Listen for messages from players
    ws.on('message', (messageString) => {
        try {
            const message = JSON.parse(messageString);

            // If a player updates the high score
            if (message.type === 'SET_SCORE') {
                if (message.value > storedData.highScore) {
                    storedData.highScore = message.value;
                    
                    // Broadcast the new high score to EVERYONE connected
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
    });
});