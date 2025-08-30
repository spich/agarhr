import React, { useRef, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function Chat({ wsRef, messages, onSendMessage }) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && wsRef.current) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <div style={{
      position: "absolute",
      bottom: "20px",
      left: "20px",
      width: "300px",
      background: "rgba(255, 255, 255, 0.9)",
      border: "1px solid #ccc",
      borderRadius: "5px",
      padding: "10px",
      fontSize: "12px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        height: "120px",
        overflowY: "auto",
        marginBottom: "10px",
        padding: "5px",
        background: "rgba(0, 0, 0, 0.05)",
        borderRadius: "3px"
      }}>
        {messages.length === 0 ? (
          <div style={{ color: "#888", fontStyle: "italic" }}>No messages yet...</div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: "2px" }}>
              <span style={{ color: "#666", fontSize: "10px" }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
              <span style={{ 
                color: msg.color || "#000", 
                fontWeight: "bold",
                marginLeft: "5px" 
              }}>
                {msg.id}:
              </span>
              <span style={{ marginLeft: "5px" }}>{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          maxLength={100}
          style={{
            width: "100%",
            padding: "5px",
            border: "1px solid #ddd",
            borderRadius: "3px",
            fontSize: "12px",
            boxSizing: "border-box"
          }}
        />
      </form>
    </div>
  );
}

function MiniMap({ players, me }) {
  const mapWidth = 150;
  const mapHeight = 113; // Maintain 800:600 aspect ratio
  const scaleX = mapWidth / 800;
  const scaleY = mapHeight / 600;

  return (
    <div style={{
      position: "absolute",
      top: "20px",
      left: "20px",
      width: `${mapWidth}px`,
      height: `${mapHeight}px`,
      background: "rgba(255, 255, 255, 0.8)",
      border: "2px solid #333",
      borderRadius: "5px",
      overflow: "hidden"
    }}>
      <svg width={mapWidth} height={mapHeight}>
        {Object.entries(players).map(([id, player]) => (
          <circle
            key={id}
            cx={player.x * scaleX}
            cy={player.y * scaleY}
            r={Math.max(2, player.r * scaleX * 0.5)}
            fill={player.color}
            stroke={id === me ? "#000" : "none"}
            strokeWidth={id === me ? 2 : 0}
            opacity={id === me ? 1 : 0.7}
          />
        ))}
      </svg>
    </div>
  );
}

function App() {
  const canvasRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [food, setFood] = useState({});
  const [viruses, setViruses] = useState({});
  const [me, setMe] = useState(null);
  const wsRef = useRef(null);
  const [keys, setKeys] = useState({});
  const [mousePos, setMousePos] = useState({ x: 400, y: 300 });
  const [chatMessages, setChatMessages] = useState([]);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "welcome") setMe(data.id);
      if (data.type === "state") {
        setPlayers(data.players);
        if (data.food) setFood(data.food);
        if (data.viruses) setViruses(data.viruses);
      }
      if (data.type === "chat") {
        setChatMessages(prev => [...prev.slice(-19), {
          id: data.id,
          message: data.message,
          timestamp: data.timestamp,
          color: data.id === me ? "#007bff" : "#333"
        }]);
      }
    };

    return () => ws.close();
  }, []);

  // Handle mouse movement
  useEffect(() => {
    function onMove(e) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Handle keyboard input
  useEffect(() => {
    function onKeyDown(e) {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        setKeys(prev => ({ ...prev, [key]: true }));
      }
    }
    
    function onKeyUp(e) {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        setKeys(prev => ({ ...prev, [key]: false }));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Handle player movement and camera
  useEffect(() => {
    if (!me || !players[me]) return;

    const interval = setInterval(() => {
      const player = players[me];
      let targetX = player.x;
      let targetY = player.y;

      // Calculate speed based on mass (larger = slower)
      const baseSpeed = Math.max(1, 10 - Math.sqrt(player.mass) / 10);
      
      // Keyboard movement (WASD and arrow keys)
      if (keys['w'] || keys['arrowup']) targetY -= baseSpeed;
      if (keys['s'] || keys['arrowdown']) targetY += baseSpeed;
      if (keys['a'] || keys['arrowleft']) targetX -= baseSpeed;
      if (keys['d'] || keys['arrowright']) targetX += baseSpeed;

      // Mouse movement (towards cursor)
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        const worldMouseX = (mousePos.x - 400) / camera.scale + camera.x + 400;
        const worldMouseY = (mousePos.y - 300) / camera.scale + camera.y + 300;
        
        const dx = worldMouseX - player.x;
        const dy = worldMouseY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
          const moveSpeed = Math.min(baseSpeed, distance * 0.1);
          targetX += (dx / distance) * moveSpeed;
          targetY += (dy / distance) * moveSpeed;
        }
      }

      // Boundary constraints for game world
      targetX = Math.max(25, Math.min(2000 - 25, targetX));
      targetY = Math.max(25, Math.min(1500 - 25, targetY));

      // Send movement if position changed
      if (Math.abs(targetX - player.x) > 0.1 || Math.abs(targetY - player.y) > 0.1) {
        wsRef.current?.send(JSON.stringify({ 
          type: "move", 
          x: targetX, 
          y: targetY 
        }));
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [me, players, keys, mousePos, camera]);

  // Update camera to follow player
  useEffect(() => {
    if (!me || !players[me]) return;
    
    const player = players[me];
    const scale = Math.max(0.3, Math.min(1, 100 / player.r));
    
    setCamera({
      x: player.x,
      y: player.y,
      scale: scale
    });
  }, [me, players]);

  const handleSendMessage = (message) => {
    wsRef.current?.send(JSON.stringify({
      type: "chat",
      message: message
    }));
  };

  // Draw all game elements
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, 800, 600);
    
    // Apply camera transformation
    ctx.save();
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(400 / camera.scale - camera.x, 300 / camera.scale - camera.y);
    
    // Draw grid (optional background)
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    const gridSize = 50;
    const startX = Math.floor((camera.x - 400 / camera.scale) / gridSize) * gridSize;
    const endX = startX + (800 / camera.scale) + gridSize;
    const startY = Math.floor((camera.y - 300 / camera.scale) / gridSize) * gridSize;
    const endY = startY + (600 / camera.scale) + gridSize;
    
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
    
    // Draw food
    Object.values(food).forEach(foodItem => {
      ctx.beginPath();
      ctx.arc(foodItem.x, foodItem.y, foodItem.r, 0, 2 * Math.PI);
      ctx.fillStyle = foodItem.color;
      ctx.fill();
    });
    
    // Draw viruses
    Object.values(viruses).forEach(virus => {
      ctx.beginPath();
      ctx.arc(virus.x, virus.y, virus.r, 0, 2 * Math.PI);
      ctx.fillStyle = virus.color;
      ctx.fill();
      
      // Add spikes to viruses
      ctx.strokeStyle = virus.color;
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * 2 * Math.PI;
        const x1 = virus.x + Math.cos(angle) * virus.r;
        const y1 = virus.y + Math.sin(angle) * virus.r;
        const x2 = virus.x + Math.cos(angle) * (virus.r + 10);
        const y2 = virus.y + Math.sin(angle) * (virus.r + 10);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    });
    
    // Draw players
    Object.entries(players).forEach(([id, p]) => {
      if (p.cells) {
        p.cells.forEach(cell => {
          // Draw cell
          ctx.beginPath();
          ctx.arc(cell.x, cell.y, cell.r, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = id === me ? 1 : 0.8;
          ctx.fill();
          
          // Draw border for own cells
          if (id === me) {
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();
          }
          
          // Draw player name
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#000";
          ctx.font = `${Math.max(12, cell.r * 0.5)}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.name || id, cell.x, cell.y);
        });
      } else {
        // Fallback for old player format
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = id === me ? 1 : 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        
        if (id === me) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    });
    
    ctx.restore();
  }, [players, food, viruses, me, camera]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ background: "#fafafa", display: "block", margin: "0 auto" }}
      />
      <MiniMap players={players} me={me} />
      <Chat 
        wsRef={wsRef} 
        messages={chatMessages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);