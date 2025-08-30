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

// Game update loop
setInterval(() => {
  updateGameState();
}, 1000 / 20); // 20fps

function updateGameState() {
  // Update all players
  Object.keys(players).forEach(playerId => {
    updatePlayerCells(playerId);
  });
  
  // Update ejected food movement
  Object.keys(food).forEach(foodId => {
    const foodItem = food[foodId];
    if (foodItem.velocityX || foodItem.velocityY) {
      foodItem.x += foodItem.velocityX;
      foodItem.y += foodItem.velocityY;
      
      // Apply friction
      foodItem.velocityX *= 0.95;
      foodItem.velocityY *= 0.95;
      
      // Stop very small velocities
      if (Math.abs(foodItem.velocityX) < 0.1) foodItem.velocityX = 0;
      if (Math.abs(foodItem.velocityY) < 0.1) foodItem.velocityY = 0;
      
      // Keep food in bounds
      foodItem.x = Math.max(foodItem.r, Math.min(GAME_WIDTH - foodItem.r, foodItem.x));
      foodItem.y = Math.max(foodItem.r, Math.min(GAME_HEIGHT - foodItem.r, foodItem.y));
    }
  });
}

function updatePlayerCells(playerId) {
  const player = players[playerId];
  if (!player) return;
  
  const now = Date.now();
  
  // Update cell velocities and positions
  player.cells.forEach(cell => {
    if (cell.velocityX || cell.velocityY) {
      cell.x += cell.velocityX;
      cell.y += cell.velocityY;
      
      // Apply friction
      cell.velocityX *= 0.9;
      cell.velocityY *= 0.9;
      
      // Stop very small velocities
      if (Math.abs(cell.velocityX) < 0.1) cell.velocityX = 0;
      if (Math.abs(cell.velocityY) < 0.1) cell.velocityY = 0;
      
      // Keep cells in bounds
      cell.x = Math.max(cell.r, Math.min(GAME_WIDTH - cell.r, cell.x));
      cell.y = Math.max(cell.r, Math.min(GAME_HEIGHT - cell.r, cell.y));
    }
  });
  
  // Check for cell merging
  for (let i = 0; i < player.cells.length; i++) {
    const cell1 = player.cells[i];
    if (cell1.mergeTime > now) continue; // Can't merge yet
    
    for (let j = i + 1; j < player.cells.length; j++) {
      const cell2 = player.cells[j];
      if (cell2.mergeTime > now) continue; // Can't merge yet
      
      const dx = cell1.x - cell2.x;
      const dy = cell1.y - cell2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If cells are touching, merge them
      if (distance < (cell1.r + cell2.r) * 0.7) {
        // Merge into the larger cell
        const largerIndex = cell1.r >= cell2.r ? i : j;
        const smallerIndex = cell1.r >= cell2.r ? j : i;
        
        const largerCell = player.cells[largerIndex];
        const smallerCell = player.cells[smallerIndex];
        
        // Combine mass and recalculate radius
        largerCell.mass += smallerCell.mass;
        largerCell.r = Math.sqrt(largerCell.mass / Math.PI);
        largerCell.mergeTime = 0; // Reset merge time
        
        // Remove the smaller cell
        player.cells.splice(smallerIndex, 1);
        
        // Adjust indices after removal
        if (smallerIndex < i) i--;
        j--; // We need to recheck this position
      }
    }
  }
  
  updatePlayerStats(playerId);
}

// Handle player split
function handleSplit(playerId, mouseX, mouseY) {
  const player = players[playerId];
  if (!player) return;
  
  // Only allow split if player has cells large enough and not too many cells
  const splitableCells = player.cells.filter(cell => cell.r > 15 && cell.mergeTime === 0);
  if (splitableCells.length === 0 || player.cells.length >= 16) return;
  
  splitableCells.forEach(cell => {
    // Calculate direction towards mouse
    const dx = mouseX - cell.x;
    const dy = mouseY - cell.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dirX = distance > 0 ? dx / distance : 1;
    const dirY = distance > 0 ? dy / distance : 0;
    
    // Split the cell
    const newMass = cell.mass / 2;
    const newRadius = Math.sqrt(newMass / Math.PI);
    
    // Update original cell
    cell.mass = newMass;
    cell.r = newRadius;
    cell.mergeTime = Date.now() + 30000; // 30 seconds before merge
    
    // Create new cell
    const newCell = {
      id: Math.random().toString(36).substr(2, 9),
      x: cell.x + dirX * (newRadius + 5),
      y: cell.y + dirY * (newRadius + 5),
      r: newRadius,
      mass: newMass,
      mergeTime: Date.now() + 30000,
      velocityX: dirX * 15, // Initial split velocity
      velocityY: dirY * 15
    };
    
    player.cells.push(newCell);
  });
  
  updatePlayerStats(playerId);
}

// Handle mass ejection
function handleEject(playerId, mouseX, mouseY) {
  const player = players[playerId];
  if (!player) return;
  
  // Find largest cell that can eject mass
  const ejectableCell = player.cells.find(cell => cell.mass > 100);
  if (!ejectableCell) return;
  
  // Calculate direction towards mouse
  const dx = mouseX - ejectableCell.x;
  const dy = mouseY - ejectableCell.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const dirX = distance > 0 ? dx / distance : 1;
  const dirY = distance > 0 ? dy / distance : 0;
  
  // Reduce cell mass
  const ejectMass = 16; // Mass of ejected food
  ejectableCell.mass -= ejectMass;
  ejectableCell.r = Math.sqrt(ejectableCell.mass / Math.PI);
  
  // Create ejected food
  const ejectId = Math.random().toString(36).substr(2, 9);
  food[ejectId] = {
    x: ejectableCell.x + dirX * (ejectableCell.r + 10),
    y: ejectableCell.y + dirY * (ejectableCell.r + 10),
    r: 4,
    color: player.color,
    velocityX: dirX * 10,
    velocityY: dirY * 10,
    isEjected: true
  };
  
  updatePlayerStats(playerId);
}

// Update player stats based on cells
function updatePlayerStats(playerId) {
  const player = players[playerId];
  if (!player || !player.cells.length) return;
  
  // Calculate total mass
  player.mass = player.cells.reduce((total, cell) => total + cell.mass, 0);
  
  // Use largest cell for main position and size
  const largestCell = player.cells.reduce((largest, cell) => 
    cell.r > largest.r ? cell : largest, player.cells[0]);
  
  player.x = largestCell.x;
  player.y = largestCell.y;
  player.r = largestCell.r;
}

// Check collisions between player and viruses
function checkVirusCollisions(playerId) {
  const player = players[playerId];
  if (!player || !player.cells.length) return;
  
  player.cells.forEach((cell, cellIndex) => {
    Object.entries(viruses).forEach(([virusId, virus]) => {
      const dx = cell.x - virus.x;
      const dy = cell.y - virus.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If cell is large enough to be affected by virus (and hits it)
      if (distance < virus.r && cell.r > virus.r * 0.6) {
        // Split the cell into many smaller cells
        const numSplits = Math.min(8, Math.floor(cell.r / 15)); // More splits for larger cells
        if (numSplits > 1) {
          const splitMass = cell.mass / numSplits;
          const splitRadius = Math.sqrt(splitMass / Math.PI);
          
          // Remove original cell
          player.cells.splice(cellIndex, 1);
          
          // Create split cells in random directions
          for (let i = 0; i < numSplits; i++) {
            const angle = (i / numSplits) * 2 * Math.PI + Math.random() * 0.5;
            const distance = splitRadius + 10;
            
            const newCell = {
              id: Math.random().toString(36).substr(2, 9),
              x: virus.x + Math.cos(angle) * distance,
              y: virus.y + Math.sin(angle) * distance,
              r: splitRadius,
              mass: splitMass,
              mergeTime: Date.now() + 30000, // 30 seconds before merge
              velocityX: Math.cos(angle) * 10,
              velocityY: Math.sin(angle) * 10
            };
            
            player.cells.push(newCell);
          }
        }
      }
    });
  });
}

// Check collisions between players
function checkPlayerCollisions(playerId) {
  const player = players[playerId];
  if (!player || !player.cells.length) return;
  
  player.cells.forEach(cell => {
    // Check against other players
    Object.entries(players).forEach(([otherPlayerId, otherPlayer]) => {
      if (otherPlayerId === playerId || !otherPlayer.cells.length) return;
      
      otherPlayer.cells.forEach((otherCell, otherCellIndex) => {
        const dx = cell.x - otherCell.x;
        const dy = cell.y - otherCell.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if one cell can eat the other (must be significantly larger)
        const sizeDifference = cell.r / otherCell.r;
        if (distance < cell.r && sizeDifference > 1.25) {
          // Current cell eats other cell
          cell.mass += otherCell.mass;
          cell.r = Math.sqrt(cell.mass / Math.PI);
          
          // Remove eaten cell
          otherPlayer.cells.splice(otherCellIndex, 1);
          
          // If player has no cells left, remove them
          if (otherPlayer.cells.length === 0) {
            delete players[otherPlayerId];
          } else {
            updatePlayerStats(otherPlayerId);
          }
        } else if (distance < otherCell.r && (otherCell.r / cell.r) > 1.25) {
          // Other cell eats current cell
          otherCell.mass += cell.mass;
          otherCell.r = Math.sqrt(otherCell.mass / Math.PI);
          
          // Remove current cell
          const cellIndex = player.cells.indexOf(cell);
          if (cellIndex !== -1) {
            player.cells.splice(cellIndex, 1);
          }
          
          // If player has no cells left, remove them  
          if (player.cells.length === 0) {
            delete players[playerId];
          }
          
          updatePlayerStats(otherPlayerId);
        }
      });
    });
  });
}

// Check collisions between player and food
function checkFoodCollisions(playerId) {
  const player = players[playerId];
  if (!player || !player.cells.length) return;
  
  player.cells.forEach(cell => {
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
        
        // Remove eaten food
        delete food[foodId];
        
        // Generate new food to maintain count (unless it was ejected food)
        if (!foodItem.isEjected) {
          const newId = Math.random().toString(36).substr(2, 9);
          food[newId] = {
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            r: FOOD_SIZE,
            color: '#' + ['FF6B6B', 'FFD93D', '6BCF7F', '4ECDC4', 'FF8A80', 'CE93D8'][Math.floor(Math.random() * 6)]
          };
        }
      }
    });
  });
  
  updatePlayerStats(playerId);
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
        // Update all player cells based on the target direction
        if (players[id] && players[id].cells.length > 0) {
          const player = players[id];
          const targetX = Math.max(25, Math.min(GAME_WIDTH - 25, data.x));
          const targetY = Math.max(25, Math.min(GAME_HEIGHT - 25, data.y));
          
          // Calculate center of all cells
          const centerX = player.cells.reduce((sum, cell) => sum + cell.x, 0) / player.cells.length;
          const centerY = player.cells.reduce((sum, cell) => sum + cell.y, 0) / player.cells.length;
          
          // Calculate movement direction
          const dx = targetX - centerX;
          const dy = targetY - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 1) {
            // Move each cell towards target
            player.cells.forEach(cell => {
              const cellSpeed = Math.max(1, 10 - Math.sqrt(cell.mass) / 10);
              const normalizedDx = dx / distance;
              const normalizedDy = dy / distance;
              
              cell.x += normalizedDx * cellSpeed;
              cell.y += normalizedDy * cellSpeed;
              
              // Keep cells in bounds
              cell.x = Math.max(cell.r, Math.min(GAME_WIDTH - cell.r, cell.x));
              cell.y = Math.max(cell.r, Math.min(GAME_HEIGHT - cell.r, cell.y));
            });
          }
          
          // Check for collisions
          checkFoodCollisions(id);
          checkPlayerCollisions(id);
          checkVirusCollisions(id);
          updatePlayerStats(id);
        }
      }
      
      if (data.type === 'split') {
        handleSplit(id, data.mouseX, data.mouseY);
      }
      
      if (data.type === 'eject') {
        handleEject(id, data.mouseX, data.mouseY);
      }
      
      if (data.type === 'setName') {
        if (players[id] && data.name) {
          players[id].name = data.name.substring(0, 20); // Limit name length
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