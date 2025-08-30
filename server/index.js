import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

let players = {};
let food = {};
let viruses = {};

// Game constants
const GAME_WIDTH = 2000;
const GAME_HEIGHT = 1500;
const FOOD_COUNT = 200;
const VIRUS_COUNT = 10;
const FOOD_SIZE = 3;
const VIRUS_SIZE = 35;

// Initialize food
function generateFood() {
  for (let i = 0; i < FOOD_COUNT; i++) {
    const id = Math.random().toString(36).substr(2, 9);
    food[id] = {
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      r: FOOD_SIZE,
      color: '#' + ['FF6B6B', 'FFD93D', '6BCF7F', '4ECDC4', 'FF8A80', 'CE93D8'][Math.floor(Math.random() * 6)]
    };
  }
}

// Initialize viruses
function generateViruses() {
  for (let i = 0; i < VIRUS_COUNT; i++) {
    const id = Math.random().toString(36).substr(2, 9);
    viruses[id] = {
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      r: VIRUS_SIZE,
      color: '#33CC33'
    };
  }
}

// Initialize game world
generateFood();
generateViruses();

// Check collisions between player and food
function checkFoodCollisions(playerId) {
  const player = players[playerId];
  if (!player || !player.cells[0]) return;
  
  const cell = player.cells[0];
  
  Object.keys(food).forEach(foodId => {
    const foodItem = food[foodId];
    const dx = cell.x - foodItem.x;
    const dy = cell.y - foodItem.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If cell is large enough to eat the food
    if (distance < cell.r && cell.r > foodItem.r) {
      // Increase cell mass
      cell.mass += Math.PI * foodItem.r * foodItem.r;
      cell.r = Math.sqrt(cell.mass / Math.PI);
      
      // Update player stats
      player.mass = cell.mass;
      player.r = cell.r;
      
      // Remove eaten food
      delete food[foodId];
      
      // Generate new food to maintain count
      const newId = Math.random().toString(36).substr(2, 9);
      food[newId] = {
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        r: FOOD_SIZE,
        color: '#' + ['FF6B6B', 'FFD93D', '6BCF7F', '4ECDC4', 'FF8A80', 'CE93D8'][Math.floor(Math.random() * 6)]
      };
    }
  });
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).substr(2, 9);
  players[id] = { 
    x: GAME_WIDTH / 2, 
    y: GAME_HEIGHT / 2, 
    r: 25, 
    color: '#'+((1<<24)*Math.random()|0).toString(16),
    name: `Player${id.substr(0, 4)}`,
    mass: 625, // r^2 * π ≈ mass for initial size of 25
    cells: [{
      id: Math.random().toString(36).substr(2, 9),
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      r: 25,
      mass: 625,
      mergeTime: 0
    }]
  };

  ws.send(JSON.stringify({ type: 'welcome', id }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'move') {
        // Update primary cell position (for now, we'll enhance this later for multiple cells)
        if (players[id] && players[id].cells[0]) {
          players[id].cells[0].x = Math.max(25, Math.min(GAME_WIDTH - 25, data.x));
          players[id].cells[0].y = Math.max(25, Math.min(GAME_HEIGHT - 25, data.y));
          players[id].x = players[id].cells[0].x;
          players[id].y = players[id].cells[0].y;
          players[id].r = players[id].cells[0].r;
          
          // Check for food collisions
          checkFoodCollisions(id);
        }
      }
      
      if (data.type === 'chat') {
        // Broadcast chat message to all connected clients
        const chatMessage = {
          type: 'chat',
          id: players[id]?.name || id,
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

  // Broadcast game state
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ 
      type: 'state', 
      players,
      food,
      viruses
    }));
  }, 1000 / 20);

  ws.on('close', () => clearInterval(interval));
});

console.log("Agarhr server running on ws://localhost:8080/");