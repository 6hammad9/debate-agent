import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { runDebate } from "./workflows/orchestrator.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// ─────────────────────────────────────────
// MIDDLEWARE
// These run on every request before your routes
// ─────────────────────────────────────────

// cors() — allows React (port 5173) to talk to Express (port 3001)
// Without this the browser blocks the request
app.use(cors())

// express.json() — parses incoming JSON request bodies
// Without this req.body would be undefined
app.use(express.json())

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────

// Health check — used by CI and monitoring to verify server is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Main debate endpoint
// POST /api/debate
// body: { topic: string, rounds: number }
app.post("/api/debate", async (req, res) => {
  const { topic, rounds = 2 } = req.body

  // Validate input
  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return res.status(400).json({
      error: "topic is required and must be a non-empty string"
    })
  }

  if (rounds < 1 || rounds > 5) {
    return res.status(400).json({
      error: "rounds must be between 1 and 5"
    })
  }

  console.log(`\n📨 New debate request: "${topic}" (${rounds} rounds)`)

  try {
    const result = await runDebate(topic.trim(), rounds)
    res.json({ success: true, data: result })

  } catch (err) {
    console.error("❌ Debate failed:", err.message)
    res.status(500).json({
      error: "Debate failed",
      message: err.message
    })
  }
})

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`)
  console.log(`⚔️  Debate endpoint: POST http://localhost:${PORT}/api/debate\n`)
})