import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// Game constants
const GAME_WIDTH = 2000;
const GAME_HEIGHT = 2000;
const FOOD_COUNT = 500;
const MIN_MASS = 10;
const MAX_MASS = 300;
const SPLIT_MIN_MASS = 20; // Lower threshold for testing
const EJECT_MIN_MASS = 15; // Lower threshold for testing

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
  const startMass = 25; // Increased for easier testing
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
        // Split cell logic
        const player = players[id];
        const newCells = [];
        
        player.cells.forEach(cell => {
          if (cell.mass > SPLIT_MIN_MASS && player.cells.length < 16) { // Can split if mass > 20 and < 16 cells
            const halfMass = cell.mass / 2;
            const newRadius = massToRadius(halfMass);
            
            // Original cell keeps half mass
            cell.mass = halfMass;
            cell.r = newRadius;
            
            // Create new cell
            const angle = Math.random() * 2 * Math.PI;
            const distance = newRadius * 2.5;
            const newCell = {
              x: cell.x + Math.cos(angle) * distance,
              y: cell.y + Math.sin(angle) * distance,
              mass: halfMass,
              r: newRadius,
              color: cell.color,
              splitTime: Date.now() // Track when cell was created for merging
            };
            
            // Keep within boundaries
            newCell.x = Math.max(newCell.r, Math.min(GAME_WIDTH - newCell.r, newCell.x));
            newCell.y = Math.max(newCell.r, Math.min(GAME_HEIGHT - newCell.r, newCell.y));
            
            newCells.push(newCell);
          }
        });
        
        // Add new cells to player
        player.cells.push(...newCells);
        
        // Update score
        player.score = player.cells.reduce((total, c) => total + c.mass, 0);
      }
      if (data.type === 'eject' && players[id]) {
        // Eject mass logic
        const player = players[id];
        
        player.cells.forEach(cell => {
          if (cell.mass > EJECT_MIN_MASS) { // Can only eject if cell has enough mass
            const ejectMass = 16;
            cell.mass -= ejectMass;
            cell.r = massToRadius(cell.mass);
            
            // Create ejected mass as food
            const angle = Math.random() * 2 * Math.PI;
            const distance = cell.r + 20;
            const ejectId = Math.random().toString(36).substr(2, 9);
            
            food[ejectId] = {
              x: cell.x + Math.cos(angle) * distance,
              y: cell.y + Math.sin(angle) * distance,
              r: massToRadius(ejectMass),
              color: '#ffff00', // Yellow for ejected mass
              mass: ejectMass
            };
            
            // Keep within boundaries  
            food[ejectId].x = Math.max(food[ejectId].r, Math.min(GAME_WIDTH - food[ejectId].r, food[ejectId].x));
            food[ejectId].y = Math.max(food[ejectId].r, Math.min(GAME_HEIGHT - food[ejectId].r, food[ejectId].y));
          }
        });
        
        // Update score
        player.score = player.cells.reduce((total, c) => total + c.mass, 0);
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
          cell.mass += foodItem.mass || 1;
          cell.r = massToRadius(cell.mass);
          delete food[foodId];
          
          // Generate new food to replace consumed food (but not ejected mass)
          if (!foodItem.mass || foodItem.mass === 1) {
            generateFood();
          }
          
          // Update player score
          player.score = player.cells.reduce((total, c) => total + c.mass, 0);
        }
      });
    });
  });
  
  // Check collisions between player cells (absorption)
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    
    Object.keys(players).forEach(otherId => {
      if (playerId === otherId) return;
      const otherPlayer = players[otherId];
      
      player.cells.forEach((cell, cellIndex) => {
        otherPlayer.cells.forEach((otherCell, otherIndex) => {
          const distance = getDistance(cell, otherCell);
          
          // Can absorb if cell is 10% bigger and touching
          if (cell.mass > otherCell.mass * 1.1 && distance < cell.r - otherCell.r + 5) {
            // Absorb the smaller cell
            cell.mass += otherCell.mass;
            cell.r = massToRadius(cell.mass);
            
            // Remove absorbed cell
            otherPlayer.cells.splice(otherIndex, 1);
            
            // Update scores
            player.score = player.cells.reduce((total, c) => total + c.mass, 0);
            otherPlayer.score = otherPlayer.cells.reduce((total, c) => total + c.mass, 0);
            
            // If player has no cells left, remove them
            if (otherPlayer.cells.length === 0) {
              delete players[otherId];
            }
          }
        });
      });
    });
  });
  
  // Handle cell merging after split time
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    const now = Date.now();
    
    // Merge cells that can merge (after 30 seconds)
    for (let i = 0; i < player.cells.length; i++) {
      for (let j = i + 1; j < player.cells.length; j++) {
        const cell1 = player.cells[i];
        const cell2 = player.cells[j];
        
        // Can merge if both cells are old enough (30 seconds) and touching
        const cell1CanMerge = !cell1.splitTime || (now - cell1.splitTime > 30000);
        const cell2CanMerge = !cell2.splitTime || (now - cell2.splitTime > 30000);
        
        if (cell1CanMerge && cell2CanMerge) {
          const distance = getDistance(cell1, cell2);
          if (distance < cell1.r + cell2.r) {
            // Merge cells
            cell1.mass += cell2.mass;
            cell1.r = massToRadius(cell1.mass);
            delete cell1.splitTime; // Reset split timer
            
            // Remove second cell
            player.cells.splice(j, 1);
            j--; // Adjust index since we removed an element
            
            // Update score
            player.score = player.cells.reduce((total, c) => total + c.mass, 0);
          }
        }
      }
    }
    
    // Mass decay over time (very slow)
    player.cells.forEach(cell => {
      if (cell.mass > MIN_MASS) {
        cell.mass *= 0.9995; // Very slow decay
        cell.r = massToRadius(cell.mass);
      }
    });
    
    // Update score after decay
    player.score = player.cells.reduce((total, c) => total + c.mass, 0);
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