import React, { useRef, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const canvasRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [me, setMe] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "welcome") setMe(data.id);
      if (data.type === "state") setPlayers(data.players);
    };

    return () => ws.close();
  }, []);

  // Handle mouse movement
  useEffect(() => {
    function onMove(e) {
      if (!canvasRef.current || !me) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      wsRef.current?.send(JSON.stringify({ type: "move", x, y }));
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [me]);

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
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ background: "#fafafa", display: "block", margin: "0 auto" }}
    />
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);