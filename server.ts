import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mock data as fallback
  const MOCK_DATA = {
    blocks: [
      { block: "Block A", moisture: 45, temperature: 28, humidity: 72, sprinkler: false, status: "optimal", last_updated: new Date().toISOString() },
      { block: "Block B", moisture: 22, temperature: 29, humidity: 68, sprinkler: true, status: "critical", last_updated: new Date().toISOString() },
      { block: "Block C", moisture: 67, temperature: 27, humidity: 75, sprinkler: false, status: "optimal", last_updated: new Date().toISOString() }
    ],
    system: { alert_active: true, alert_message: "Block B moisture critically low at 22%", last_command: "Turn on sprinkler for Block B", last_command_time: new Date().toISOString() },
    activity: [
      { timestamp: new Date().toISOString(), event: "Dashboard loaded — awaiting live data", triggered_by: "system" }
    ]
  };

  const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "REPLACE_WITH_YOUR_N8N_WEBHOOK_URL";

  // API Route for dashboard data
  app.get("/api/dashboard-data", async (req, res) => {
    try {
      if (WEBHOOK_URL === "REPLACE_WITH_YOUR_N8N_WEBHOOK_URL") {
        return res.json(MOCK_DATA);
      }

      const response = await fetch(WEBHOOK_URL + "/dashboard-data");
      if (!response.ok) {
        throw new Error("Webhook fetch failed");
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Fetch error:", error);
      res.json(MOCK_DATA);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
