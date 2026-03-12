import { tool } from "@langchain/core/tools"
import { z } from "zod"
import dotenv from "dotenv"

dotenv.config()

// This is our search tool — a function wrapped so the agent can call it
export const searchTool = tool(
  async ({ query }) => {
    console.log(`🔍 Agent is searching for: "${query}"`)

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        max_results: 3,
        search_depth: "basic",
      }),
    })

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return "No search results found."
    }

    // Format results into clean text the agent can read
    const formatted = data.results
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
      .join("\n\n")

    console.log(`✅ Search complete — found ${data.results.length} results`)
    return formatted
  },

  // This is the tool's identity — the agent reads this to decide when to use it
  {
    name: "web_search",
    description: "Search the web for facts, statistics, and evidence to support debate arguments. Use this when you need real data to back up a claim.",
    schema: z.object({
      query: z.string().describe("The search query to look up"),
    }),
  }
)