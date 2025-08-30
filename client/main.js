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
  const [me, setMe] = useState(null);
  const wsRef = useRef(null);
  const [keys, setKeys] = useState({});
  const [mousePos, setMousePos] = useState({ x: 400, y: 300 });
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "welcome") setMe(data.id);
      if (data.type === "state") setPlayers(data.players);
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

  // Handle player movement
  useEffect(() => {
    if (!me || !players[me]) return;

    const interval = setInterval(() => {
      const player = players[me];
      let targetX = player.x;
      let targetY = player.y;

      // Keyboard movement (WASD and arrow keys)
      const speed = 3;
      if (keys['w'] || keys['arrowup']) targetY -= speed;
      if (keys['s'] || keys['arrowdown']) targetY += speed;
      if (keys['a'] || keys['arrowleft']) targetX -= speed;
      if (keys['d'] || keys['arrowright']) targetX += speed;

      // Mouse movement (towards cursor)
      const dx = mousePos.x - player.x;
      const dy = mousePos.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 5) { // Only move if cursor is far enough
        const moveSpeed = Math.min(2, distance * 0.1);
        targetX += (dx / distance) * moveSpeed;
        targetY += (dy / distance) * moveSpeed;
      }

      // Boundary constraints
      targetX = Math.max(25, Math.min(775, targetX));
      targetY = Math.max(25, Math.min(575, targetY));

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
  }, [me, players, keys, mousePos]);

  const handleSendMessage = (message) => {
    wsRef.current?.send(JSON.stringify({
      type: "chat",
      message: message
    }));
  };

  // Draw all players
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 800, 600);
    Object.entries(players).forEach(([id, p]) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = id === me ? 1 : 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (id === me) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }, [players, me]);

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