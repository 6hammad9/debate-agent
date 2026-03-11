import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages"
import { searchTool } from "../tools/search.js"
import dotenv from "dotenv"

dotenv.config()

// ─────────────────────────────────────────
// THE REACT LOOP — built manually
// This is exactly what LangChain's AgentExecutor
// does under the hood — now you can see it clearly
//
// Loop:
// 1. Agent receives topic + history
// 2. Agent decides: do I need to search?
// 3. If yes → calls search tool → reads results
// 4. Agent forms final argument with evidence
// ─────────────────────────────────────────

function buildSystemPrompt(side) {
  return `You are a sharp, confident debater arguing ${side} the following topic.
Your goal is to make the strongest possible argument using real facts and evidence.

You have one tool available:
- web_search(query): searches the web for facts and statistics

To use the tool, respond in EXACTLY this format:
THOUGHT: I need to find evidence about [specific thing]
ACTION: web_search
QUERY: your search query here

When you have enough evidence, respond in EXACTLY this format:
THOUGHT: I have enough evidence to make my argument
FINAL: your complete argument (2-3 sentences, persuasive, cite real evidence)`
}

// ─────────────────────────────────────────
// CREATE A DEBATER
// ─────────────────────────────────────────
export function createDebater(side) {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.8,
  })

  return { llm, side }
}

// ─────────────────────────────────────────
// RUN ONE DEBATE TURN
// This is the ReAct loop running manually
// ─────────────────────────────────────────
export async function runDebateTurn(debater, topic, history) {
  console.log(`\n⚔️  [${debater.side}] thinking...`)

  const messages = [
    new SystemMessage(buildSystemPrompt(debater.side)),
    new HumanMessage(
      `Topic: "${topic}"\n\nPrevious debate:\n${
        history.length > 0
          ? history.map(h => `${h.side}: ${h.argument}`).join("\n")
          : "This is the opening argument — no history yet."
      }\n\nNow make your argument. Start by searching for evidence.`
    ),
  ]

  // ReAct loop — max 5 iterations for safety
  for (let i = 0; i < 5; i++) {
    const response = await debater.llm.invoke(messages)
    const text = response.content

    console.log(`\n🧠 [${debater.side}] Iteration ${i + 1}:`)
    console.log(text)

    // Check if agent wants to use a tool
    if (text.includes("ACTION: web_search")) {
      // Extract the search query
      const queryMatch = text.match(/QUERY:\s*(.+)/i)
      if (queryMatch) {
        const query = queryMatch[1].trim()

        // Call the tool
        const searchResult = await searchTool.invoke({ query })

        // Add this exchange to messages so agent remembers it
        messages.push(new AIMessage(text))
        messages.push(new HumanMessage(
          `Search results for "${query}":\n${searchResult}\n\nNow form your final argument using this evidence.`
        ))
      }
    }

    // Check if agent has a final answer
    if (text.includes("FINAL:")) {
      const finalMatch = text.match(/FINAL:\s*([\s\S]+)/i)
      if (finalMatch) {
        const argument = finalMatch[1].trim()
        console.log(`\n✅ [${debater.side}] argument ready`)
        return argument
      }
    }
  }

  // Fallback if agent never gave a final answer
  return `The ${debater.side} side argues this point strongly based on available evidence.`
}