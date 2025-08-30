import React, { useRef, useEffect, useState, useCallback } from 'react';
import MiniMap from './MiniMap';
import Chat from './Chat';
import './Game.css';

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

const Game = () => {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState({});
  const [playerPosition, setPlayerPosition] = useState({ x: 400, y: 300 });
  const [keys, setKeys] = useState({});
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [chatMessages, setChatMessages] = useState([]);
  
  // Camera position for scrolling
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to server');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'welcome') {
        setPlayerId(data.id);
      } else if (data.type === 'state') {
        setPlayers(data.players);
      } else if (data.type === 'chat') {
        setChatMessages(prev => [...prev, data].slice(-50)); // Keep last 50 messages
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Movement logic
  const movePlayer = useCallback((newX, newY) => {
    // Keep player within world bounds
    const boundedX = Math.max(25, Math.min(WORLD_WIDTH - 25, newX));
    const boundedY = Math.max(25, Math.min(WORLD_HEIGHT - 25, newY));
    
    setPlayerPosition({ x: boundedX, y: boundedY });
    
    // Send position to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'move',
        x: boundedX,
        y: boundedY
      }));
    }
  }, []);

  // Mouse movement
  const handleMouseMove = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + camera.x;
    const mouseY = event.clientY - rect.top + camera.y;
    
    setMousePosition({ x: mouseX, y: mouseY });
  }, [camera]);

  // Mouse click to move
  const handleMouseClick = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const targetX = event.clientX - rect.left + camera.x;
    const targetY = event.clientY - rect.top + camera.y;
    
    movePlayer(targetX, targetY);
  }, [camera, movePlayer]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (event) => {
      setKeys(prev => ({ ...prev, [event.key]: true }));
    };

    const handleKeyUp = (event) => {
      setKeys(prev => ({ ...prev, [event.key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Keyboard movement logic
  useEffect(() => {
    const moveSpeed = 3;
    let animationId;

    const updatePosition = () => {
      let newX = playerPosition.x;
      let newY = playerPosition.y;

      if (keys['ArrowLeft'] || keys['a'] || keys['A']) newX -= moveSpeed;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) newX += moveSpeed;
      if (keys['ArrowUp'] || keys['w'] || keys['W']) newY -= moveSpeed;
      if (keys['ArrowDown'] || keys['s'] || keys['S']) newY += moveSpeed;

      if (newX !== playerPosition.x || newY !== playerPosition.y) {
        movePlayer(newX, newY);
      }

      animationId = requestAnimationFrame(updatePosition);
    };

    animationId = requestAnimationFrame(updatePosition);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [keys, playerPosition, movePlayer]);

  // Update camera to follow player
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = playerPosition.x - canvas.width / 2;
    const centerY = playerPosition.y - canvas.height / 2;
    
    setCamera({
      x: Math.max(0, Math.min(WORLD_WIDTH - canvas.width, centerX)),
      y: Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, centerY))
    });
  }, [playerPosition]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear canvas
    ctx.fillStyle = '#001122';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    for (let x = -camera.x % gridSize; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = -camera.y % gridSize; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw players
    Object.entries(players).forEach(([id, player]) => {
      const screenX = player.x - camera.x;
      const screenY = player.y - camera.y;
      
      // Only draw players that are visible on screen
      if (screenX > -player.r && screenX < canvas.width + player.r &&
          screenY > -player.r && screenY < canvas.height + player.r) {
        
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, player.r, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw player name/id
        if (id === playerId) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });

    // Draw mouse cursor target (for reference)
    if (mousePosition.x && mousePosition.y) {
      const targetX = mousePosition.x - camera.x;
      const targetY = mousePosition.y - camera.y;
      
      if (targetX >= 0 && targetX <= canvas.width && targetY >= 0 && targetY <= canvas.height) {
        ctx.strokeStyle = '#ffffff80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

  }, [players, playerId, camera, mousePosition]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Send chat message
  const sendChatMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        message: message,
        playerId: playerId
      }));
    }
  };

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onMouseMove={handleMouseMove}
        onClick={handleMouseClick}
      />
      <MiniMap 
        players={players}
        playerId={playerId}
        worldWidth={WORLD_WIDTH}
        worldHeight={WORLD_HEIGHT}
        playerPosition={playerPosition}
      />
      <Chat 
        messages={chatMessages}
        onSendMessage={sendChatMessage}
      />
      <div className="controls-info">
        <p>Mouse: Click to move | WASD/Arrows: Move | Chat: Bottom-left</p>
      </div>
    </div>
  );
};

export default Game;