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

function Leaderboard({ players, me }) {
  // Sort players by score
  const sortedPlayers = Object.entries(players)
    .map(([id, player]) => ({ id, ...player }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10); // Show top 10

  return (
    <div style={{
      position: "absolute",
      top: "20px",
      right: "20px",
      width: "200px",
      background: "rgba(255, 255, 255, 0.9)",
      border: "1px solid #ccc",
      borderRadius: "5px",
      padding: "10px",
      fontSize: "12px",
      fontFamily: "Arial, sans-serif"
    }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", textAlign: "center" }}>
        Leaderboard
      </h3>
      {sortedPlayers.map((player, index) => (
        <div
          key={player.id}
          style={{
            padding: "2px 0",
            fontWeight: player.id === me ? "bold" : "normal",
            color: player.id === me ? "#007bff" : "#333"
          }}
        >
          {index + 1}. {player.username || `Player${player.id.substring(0, 4)}`} - {Math.round(player.score || 0)}
        </div>
      ))}
    </div>
  );
}

function MiniMap({ players, me }) {
  const mapWidth = 150;
  const mapHeight = 113; // Maintain aspect ratio
  const scaleX = mapWidth / 2000; // Scale to game world size
  const scaleY = mapHeight / 2000;

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
        {Object.entries(players).map(([id, player]) => {
          if (!player.cells) return null;
          return player.cells.map((cell, index) => (
            <circle
              key={`${id}-${index}`}
              cx={cell.x * scaleX}
              cy={cell.y * scaleY}
              r={Math.max(1, cell.r * scaleX * 0.5)}
              fill={cell.color}
              stroke={id === me ? "#000" : "none"}
              strokeWidth={id === me ? 1 : 0}
              opacity={id === me ? 1 : 0.7}
            />
          ));
        })}
      </svg>
    </div>
  );
}

function App() {
  const canvasRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [food, setFood] = useState({});
  const [me, setMe] = useState(null);
  const wsRef = useRef(null);
  const [keys, setKeys] = useState({});
  const [mousePos, setMousePos] = useState({ x: 400, y: 300 });
  const [chatMessages, setChatMessages] = useState([]);
  const [viewX, setViewX] = useState(0);
  const [viewY, setViewY] = useState(0);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "welcome") setMe(data.id);
      if (data.type === "state") {
        setPlayers(data.players);
        if (data.food) setFood(data.food);
      }
      if (data.type === "chat") {
        setChatMessages(prev => [...prev.slice(-19), {
          id: data.id,
          message: data.message,
          timestamp: data.timestamp,
          color: data.id === (players[me]?.username || me) ? "#007bff" : "#333"
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
      // Handle split (Space key)
      if (e.code === 'Space') {
        e.preventDefault();
        wsRef.current?.send(JSON.stringify({ type: "split" }));
      }
      // Handle mass ejection (W key)
      if (key === 'w' && !keys['w']) {
        wsRef.current?.send(JSON.stringify({ type: "eject" }));
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

  // Handle player movement
  useEffect(() => {
    if (!me || !players[me]) return;

    const interval = setInterval(() => {
      const player = players[me];
      if (!player || !player.cells || player.cells.length === 0) return;

      // Calculate center of mass for camera and movement reference
      let totalMass = 0;
      let centerX = 0;
      let centerY = 0;
      
      player.cells.forEach(cell => {
        totalMass += cell.mass;
        centerX += cell.x * cell.mass;
        centerY += cell.y * cell.mass;
      });
      
      centerX /= totalMass;
      centerY /= totalMass;
      
      // Update camera position
      setViewX(centerX - 400);
      setViewY(centerY - 300);

      // Calculate target position from mouse relative to screen center
      const targetX = mousePos.x + centerX - 400;
      const targetY = mousePos.y + centerY - 300;

      // Send movement if needed
      wsRef.current?.send(JSON.stringify({ 
        type: "move", 
        x: targetX, 
        y: targetY 
      }));
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [me, players, keys, mousePos]);

  const handleSendMessage = (message) => {
    wsRef.current?.send(JSON.stringify({
      type: "chat",
      message: message
    }));
  };

  // Draw all players and food
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, 800, 600);
    
    // Save context for transformations
    ctx.save();
    
    // Apply camera translation
    ctx.translate(-viewX, -viewY);
    
    // Draw food first (background layer)
    Object.entries(food).forEach(([id, f]) => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, 2 * Math.PI);
      ctx.fillStyle = f.color;
      ctx.fill();
    });
    
    // Draw players
    Object.entries(players).forEach(([id, p]) => {
      if (!p.cells) return;
      
      p.cells.forEach(cell => {
        // Draw cell
        ctx.beginPath();
        ctx.arc(cell.x, cell.y, cell.r, 0, 2 * Math.PI);
        ctx.fillStyle = cell.color;
        ctx.globalAlpha = id === me ? 1 : 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Draw border for own cells
        if (id === me) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        
        // Draw username on cell
        if (cell.r > 15) {
          ctx.fillStyle = "#000";
          ctx.font = `${Math.min(cell.r * 0.4, 16)}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.username || `Player${id.substring(0, 4)}`, cell.x, cell.y);
        }
      });
    });
    
    // Restore context
    ctx.restore();
  }, [players, food, me, viewX, viewY]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ background: "#fafafa", display: "block", margin: "0 auto" }}
      />
      <MiniMap players={players} me={me} />
      <Leaderboard players={players} me={me} />
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