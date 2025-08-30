import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

let players = {};

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).substr(2, 9);
  players[id] = { x: 400, y: 300, r: 25, color: '#'+((1<<24)*Math.random()|0).toString(16) };

  ws.send(JSON.stringify({ type: 'welcome', id }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'move') {
        players[id].x = data.x;
        players[id].y = data.y;
      }
      if (data.type === 'chat') {
        // Broadcast chat message to all connected clients
        const chatMessage = {
          type: 'chat',
          id: id,
          message: data.message,
          timestamp: Date.now()
        };
        wss.clients.forEach((client) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(chatMessage));
          }
        });
      }
    } catch {}
  });

  ws.on('close', () => {
    delete players[id];
  });

  // Broadcast positions
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'state', players }));
  }, 1000 / 20);

  ws.on('close', () => clearInterval(interval));
});

console.log("Agarhr server running on ws://localhost:8080/");