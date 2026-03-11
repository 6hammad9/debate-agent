import { createDebater, runDebateTurn } from "../agents/debater.js"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOllama } from "@langchain/ollama"
import { HumanMessage } from "@langchain/core/messages"
import dotenv from "dotenv"

dotenv.config()

// ─────────────────────────────────────────
// THE ORCHESTRATOR
// Controls the entire debate flow:
// 1. Creates both agents
// 2. Runs rounds — passing history between agents
// 3. Calls the judge for a final verdict
// ─────────────────────────────────────────

export async function runDebate(topic, totalRounds = 3) {
  console.log("\n🟥 DEBATE ARENA STARTING")
  console.log(`📋 Topic: "${topic}"`)
  console.log(`🔄 Rounds: ${totalRounds}\n`)

  // Step 1 — Create both debaters
  // createDebater is async — it tests the LLM connection first
  console.log("🔧 Initializing agents...")
  const forDebater = await createDebater("FOR")
  const againstDebater = await createDebater("AGAINST")

  // Step 2 — Shared history
  // Both agents read this before each turn
  // This is what makes them respond TO each other
  const history = []

  // Step 3 — Run the rounds
  for (let round = 1; round <= totalRounds; round++) {
    console.log(`\n${"─".repeat(24)}`)
    console.log(`  ROUND ${round} of ${totalRounds}`)
    console.log(`${"─".repeat(24)}`)

    // FOR argues first
    const forArgument = await runDebateTurn(forDebater, topic, history)
    history.push({ side: "FOR", argument: forArgument, round })

    // AGAINST counters — it gets FOR's argument in history
    const againstArgument = await runDebateTurn(againstDebater, topic, history)
    history.push({ side: "AGAINST", argument: againstArgument, round })
  }

  // Step 4 — Judge reads the full transcript and decides
  console.log("\n⚖️  Calling the judge...")
  const verdict = await judgeDebate(topic, history, forDebater.provider)

  return {
    topic,
    rounds: totalRounds,
    history,
    verdict,
  }
}

// ─────────────────────────────────────────
// LLM FACTORY FOR JUDGE
// Reuses the same provider the debaters used
// so everything stays consistent
// ─────────────────────────────────────────
async function createJudgeLLM(provider) {
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      const llm = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.3, // lower temp = more consistent, neutral judgment
      })
      console.log("⚖️  Judge using Gemini")
      return llm
    } catch {
      console.warn("⚠️  Judge Gemini failed — falling back to Ollama")
    }
  }

  // Fallback to Ollama
  const model = process.env.OLLAMA_MODEL || "llama3.2:3b"
  const llm = new ChatOllama({
    model,
    temperature: 0.3,
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  })
  console.log(`⚖️  Judge using Ollama (${model})`)
  return llm
}

// ─────────────────────────────────────────
// THE JUDGE
// Reads the full debate transcript
// Scores each side and declares a winner
// ─────────────────────────────────────────
async function judgeDebate(topic, history, provider = "gemini") {
  const llm = await createJudgeLLM(provider)

  // Build the full transcript for the judge to read
  const transcript = history
    .map(h => `[Round ${h.round} - ${h.side}]\n${h.argument}`)
    .join("\n\n")

  const prompt = `You are an impartial debate judge. Read this debate and declare a winner.

Topic: "${topic}"

Full Debate Transcript:
${transcript}

Evaluate based on:
- Strength of arguments
- Use of real evidence
- How well they countered the opponent

Respond in this EXACT format:
WINNER: FOR or AGAINST
SCORE: FOR X/10 | AGAINST X/10
REASONING: 2-3 sentences explaining your decision
HIGHLIGHT: the single strongest argument made in the debate`

  const response = await llm.invoke([new HumanMessage(prompt)])
  const text = response.content

  // Parse the verdict into structured data
  const winner = text.match(/WINNER:\s*(FOR|AGAINST)/i)?.[1] || "DRAW"
  const score = text.match(/SCORE:\s*(.+)/i)?.[1] || ""
  const reasoning = text.match(/REASONING:\s*([\s\S]+?)(?=HIGHLIGHT:|$)/i)?.[1]?.trim() || ""
  const highlight = text.match(/HIGHLIGHT:\s*([\s\S]+)/i)?.[1]?.trim() || ""

  console.log(`\n🏆 Winner: ${winner}`)

  return { winner, score, reasoning, highlight, raw: text }
}