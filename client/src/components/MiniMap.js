import React, { useRef, useEffect } from 'react';
import './MiniMap.css';

const MiniMap = ({ players, playerId, worldWidth, worldHeight, playerPosition }) => {
  const canvasRef = useRef(null);
  const mapWidth = 200;
  const mapHeight = 150;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = mapWidth;
    canvas.height = mapHeight;

    // Clear minimap
    ctx.fillStyle = '#000033';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // Draw border
    ctx.strokeStyle = '#ffffff80';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, mapWidth - 2, mapHeight - 2);

    // Scale factors
    const scaleX = mapWidth / worldWidth;
    const scaleY = mapHeight / worldHeight;

    // Draw all players on minimap
    Object.entries(players).forEach(([id, player]) => {
      const miniX = player.x * scaleX;
      const miniY = player.y * scaleY;
      const miniRadius = Math.max(2, player.r * scaleX);

      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
      ctx.fill();

      // Highlight current player
      if (id === playerId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw viewport rectangle (camera view)
    if (playerPosition) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const viewX = (playerPosition.x - viewportWidth / 2) * scaleX;
      const viewY = (playerPosition.y - viewportHeight / 2) * scaleY;
      const viewW = viewportWidth * scaleX;
      const viewH = viewportHeight * scaleY;

      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.max(0, viewX),
        Math.max(0, viewY),
        Math.min(viewW, mapWidth),
        Math.min(viewH, mapHeight)
      );
    }

  }, [players, playerId, worldWidth, worldHeight, playerPosition]);

  return (
    <div className="minimap-container">
      <div className="minimap-title">Mini Map</div>
      <canvas ref={canvasRef} className="minimap-canvas" />
    </div>
  );
};

export default MiniMap;