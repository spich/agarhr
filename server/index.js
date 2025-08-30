import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// Game constants
const GAME_WIDTH = 2000;
const GAME_HEIGHT = 2000;
const FOOD_COUNT = 500;
const MIN_MASS = 10;
const MAX_MASS = 300;

let players = {};
let food = {};
let gameLoopInterval;

// Generate food
function generateFood() {
  const id = Math.random().toString(36).substr(2, 9);
  food[id] = {
    x: Math.random() * (GAME_WIDTH - 20) + 10,
    y: Math.random() * (GAME_HEIGHT - 20) + 10,
    r: 3,
    color: '#' + ((1<<24)*Math.random()|0).toString(16)
  };
}

// Initialize food
for (let i = 0; i < FOOD_COUNT; i++) {
  generateFood();
}

// Utility functions
function massToRadius(mass) {
  return Math.sqrt(mass / Math.PI);
}

function radiusToMass(radius) {
  return Math.PI * radius * radius;
}

function getDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).substr(2, 9);
  const startMass = MIN_MASS;
  players[id] = { 
    cells: [{
      x: Math.random() * (GAME_WIDTH - 200) + 100,
      y: Math.random() * (GAME_HEIGHT - 200) + 100,
      mass: startMass,
      r: massToRadius(startMass),
      color: '#'+((1<<24)*Math.random()|0).toString(16)
    }],
    username: `Player${id.substring(0, 4)}`,
    score: startMass
  };

  ws.send(JSON.stringify({ type: 'welcome', id }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'move' && players[id]) {
        // Update all cells for this player
        players[id].cells.forEach(cell => {
          const dx = data.x - cell.x;
          const dy = data.y - cell.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 5) {
            // Speed inversely related to size
            const speed = Math.max(1, 3 - (cell.mass / 50));
            const moveSpeed = Math.min(speed, distance * 0.1);
            
            cell.x += (dx / distance) * moveSpeed;
            cell.y += (dy / distance) * moveSpeed;
            
            // Keep within boundaries
            cell.x = Math.max(cell.r, Math.min(GAME_WIDTH - cell.r, cell.x));
            cell.y = Math.max(cell.r, Math.min(GAME_HEIGHT - cell.r, cell.y));
          }
        });
      }
      if (data.type === 'chat') {
        // Broadcast chat message to all connected clients
        const chatMessage = {
          type: 'chat',
          id: players[id]?.username || id,
          message: data.message,
          timestamp: Date.now()
        };
        wss.clients.forEach((client) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(chatMessage));
          }
        });
      }
      if (data.type === 'split' && players[id]) {
        // Split cell logic - for now just log
        console.log(`Player ${id} wants to split`);
      }
      if (data.type === 'eject' && players[id]) {
        // Eject mass logic - for now just log
        console.log(`Player ${id} wants to eject mass`);
      }
    } catch {}
  });

  ws.on('close', () => {
    delete players[id];
  });

  // Send initial state
  ws.send(JSON.stringify({ type: 'state', players, food }));
});

// Game loop for collision detection and food consumption
function gameLoop() {
  // Check collisions between players and food
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    
    player.cells.forEach(cell => {
      Object.keys(food).forEach(foodId => {
        const foodItem = food[foodId];
        const distance = getDistance(cell, foodItem);
        
        if (distance < cell.r + foodItem.r) {
          // Consume food
          cell.mass += 1;
          cell.r = massToRadius(cell.mass);
          delete food[foodId];
          
          // Generate new food to replace consumed food
          generateFood();
          
          // Update player score
          player.score = player.cells.reduce((total, c) => total + c.mass, 0);
        }
      });
    });
  });
  
  // Broadcast game state to all clients
  const gameState = { type: 'state', players, food };
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(gameState));
    }
  });
}

// Start game loop
gameLoopInterval = setInterval(gameLoop, 1000 / 20); // 20 FPS

console.log("Agarhr server running on ws://localhost:8080/");