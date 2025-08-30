import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

let players = {};

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).substr(2, 9);
  players[id] = { 
    x: 400 + (Math.random() - 0.5) * 200, 
    y: 300 + (Math.random() - 0.5) * 200, 
    r: 25, 
    color: '#'+((1<<24)*Math.random()|0).toString(16) 
  };

  ws.send(JSON.stringify({ type: 'welcome', id }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'move') {
        if (players[id]) {
          players[id].x = Math.max(25, Math.min(2000 - 25, data.x));
          players[id].y = Math.max(25, Math.min(2000 - 25, data.y));
        }
      } else if (data.type === 'chat') {
        // Broadcast chat message to all clients
        broadcast({
          type: 'chat',
          message: data.message,
          playerId: data.playerId,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    delete players[id];
    console.log(`Player ${id} disconnected`);
  });

  // Broadcast positions
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'state', players }));
    }
  }, 1000 / 20); // 20 FPS

  ws.on('close', () => clearInterval(interval));
  
  console.log(`Player ${id} connected`);
});

console.log("Agarhr server running on ws://localhost:8080/");