import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOllama } from "@langchain/ollama"
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages"
import { searchTool } from "../tools/search.js"
import dotenv from "dotenv"

dotenv.config()

// ─────────────────────────────────────────
// SYSTEM PROMPT
// Tells the agent its role, what tools it has,
// and the EXACT format it must follow for the
// ReAct loop to work correctly
// ─────────────────────────────────────────
function buildSystemPrompt(side, topic) {
  const stance = side === "FOR"
    ? {
        role: `You are an aggressive advocate who STRONGLY BELIEVES: "${topic}" is TRUE.`,
        directive: `You MUST argue FOR this position: "${topic}". This is your absolute stance. Never soften it.`,
        forbidden: `NEVER argue against "${topic}". NEVER be balanced. NEVER say the other side has a point.`
      }
    : {
        role: `You are an aggressive advocate who STRONGLY BELIEVES: "${topic}" is FALSE.`,
        directive: `You MUST argue AGAINST this position: "${topic}". This is your absolute stance. Never soften it.`,
        forbidden: `NEVER argue in favor of "${topic}". NEVER be balanced. NEVER say the other side has a point.`
      }

  return `${stance.role}

${stance.directive}

IMPORTANT RULES:
- ${stance.forbidden}
- Be bold, combative and persuasive
- Directly attack the opponent's argument
- Use real statistics and facts to back your position
- Search only for evidence that supports YOUR side

You have one tool:
- web_search(query): search for evidence supporting YOUR position only

To search, respond in EXACTLY this format:
THOUGHT: I need evidence that supports [your specific position on the topic]
ACTION: web_search
QUERY: your search query here

When ready, respond in EXACTLY this format:
THOUGHT: I have strong evidence for my side
FINAL: your argument (2-3 sentences, one-sided, aggressive, cite specific evidence)`
}

// ─────────────────────────────────────────
// LLM FACTORY
// Tries Gemini first — falls back to Ollama
// This is called the "provider pattern" —
// your agent code never needs to know which
// LLM is running underneath
// ─────────────────────────────────────────
async function createLLM() {
  // Check if Gemini key exists and try to use it
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("🌐 Attempting to connect to Gemini...")

      const llm = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.8,
})

      // Send a tiny test message to verify the key actually works
      await llm.invoke([new HumanMessage("hi")])

      console.log("✅ Gemini connected successfully")
      return { llm, provider: "gemini" }

    } catch (err) {
      // Key exists but failed — could be invalid, quota exceeded, etc.
      console.warn(`⚠️  Gemini failed: ${err.message}`)
      console.log("🔄 Falling back to local Ollama...")
    }
  } else {
    console.log("ℹ️  No GEMINI_API_KEY found — using local Ollama")
  }

  // Fallback — connect to local Ollama
  try {
    const model = process.env.OLLAMA_MODEL || "llama3.2:3b"

    console.log(`🦙 Connecting to Ollama (${model})...`)

    const llm = new ChatOllama({
      model,
      temperature: 0.8,
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    })

    // Test Ollama connection too
    await llm.invoke([new HumanMessage("hi")])

    console.log(`✅ Ollama connected successfully (${model})`)
    return { llm, provider: "ollama" }

  } catch (err) {
    // Both failed — throw a clear error so the user knows what to do
    throw new Error(
      "❌ No LLM available.\n" +
      "   Gemini: check your GEMINI_API_KEY in .env\n" +
      "   Ollama: make sure Ollama is running (ollama serve) and model is pulled (ollama pull llama3.2:3b)\n" +
      `   Original error: ${err.message}`
    )
  }
}

// ─────────────────────────────────────────
// CREATE A DEBATER
// side = "FOR" or "AGAINST"
// This is async now because createLLM() tests
// the connection before returning
// ─────────────────────────────────────────
export async function createDebater(side) {
  const { llm, provider } = await createLLM()
  console.log(`⚔️  Debater [${side}] ready using ${provider}`)
  return { llm, side, provider }
}

// ─────────────────────────────────────────
// RUN ONE DEBATE TURN — THE REACT LOOP
//
// This is the core agent logic:
// 1. Send topic + history to LLM
// 2. LLM responds with THOUGHT + ACTION or FINAL
// 3. If ACTION → call the tool → feed result back
// 4. If FINAL → return the argument
// 5. Repeat up to 5 times for safety
// ─────────────────────────────────────────
export async function runDebateTurn(debater, topic, history) {
  console.log(`\n⚔️  [${debater.side}] thinking...`)

  const messages = [
    // ✅ Pass topic into the system prompt
    new SystemMessage(buildSystemPrompt(debater.side, topic)),
    new HumanMessage(
  `Topic: "${topic}"

${history.length > 0 ? `
YOUR OPPONENT JUST SAID:
"${history[history.length - 1].argument}"

You MUST directly attack that specific argument above.
Quote their words and tear them apart.
Then make your own point with evidence.
` : "This is the opening argument — no history yet. Make your case."}

Make a strong one-sided argument ${debater.side === "FOR" ? "IN FAVOR OF" : "AGAINST"} "${topic}".
Search for evidence that destroys the opponent's claim.`
)
  ]
  // ... rest of the function stays the same

  // ReAct loop — max 5 iterations
  for (let i = 0; i < 5; i++) {
    const response = await debater.llm.invoke(messages)
    const text = response.content

    console.log(`\n🧠 [${debater.side}] Iteration ${i + 1}:`)
    console.log(text)

    // ── TOOL USE ──
    // Agent decided it needs to search
  if (text.includes("ACTION: web_search")) {
  const queryMatch = text.match(/QUERY:\s*(.+)/i)

  if (queryMatch) {
    const query = queryMatch[1].trim()

    try {
      const searchResult = await searchTool.invoke({ query })
      messages.push(new AIMessage(text))
      messages.push(new HumanMessage(
        `Search results for "${query}":\n${searchResult}\n\nNow form your FINAL argument using this evidence.`
      ))
    } catch (err) {
      // Search failed — tell agent to argue without it
      console.warn(`⚠️  Search failed: ${err.message}`)
      messages.push(new AIMessage(text))
      messages.push(new HumanMessage(
        "Search is temporarily unavailable. Make your FINAL argument based on your existing knowledge."
      ))
    }
  }
}
    // ── FINAL ANSWER ──
    // Agent has enough evidence and is ready to argue
    if (text.includes("FINAL:")) {
      const finalMatch = text.match(/FINAL:\s*([\s\S]+)/i)

      if (finalMatch) {
        const argument = finalMatch[1].trim()
        console.log(`\n✅ [${debater.side}] argument ready`)
        return argument
      }
    }
  }

  // Safety fallback — agent never gave a FINAL answer
  // This shouldn't happen often but protects against infinite loops
  console.warn(`⚠️  [${debater.side}] hit max iterations — using fallback`)
  return `The ${debater.side} side presents a strong case based on available evidence.`
}