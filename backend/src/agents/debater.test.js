import { jest } from "@jest/globals"

// ─────────────────────────────────────────
// MOCK BOTH LLM PROVIDERS
// We mock both Gemini and Ollama so Jest never
// makes real API calls — tests run offline, free,
// and fast regardless of which provider is active
// ─────────────────────────────────────────

// Mock Gemini
jest.unstable_mockModule("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: `THOUGHT: I have enough evidence
FINAL: AI will replace programmers based on strong evidence from multiple sources.`
    })
  }))
}))

// Mock Ollama
jest.unstable_mockModule("@langchain/ollama", () => ({
  ChatOllama: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: `THOUGHT: I have enough evidence
FINAL: AI will replace programmers based on strong evidence from multiple sources.`
    })
  }))
}))

// Mock the search tool — no real HTTP calls in tests
jest.unstable_mockModule("../tools/search.js", () => ({
  searchTool: {
    invoke: jest.fn().mockResolvedValue("Mock search result: AI is replacing jobs.")
  }
}))

// ─────────────────────────────────────────
// IMPORTANT: Always import AFTER mocking
// Jest needs to set up mocks before the modules load
// ─────────────────────────────────────────
const { createDebater, runDebateTurn } = await import("./debater.js")

describe("Debater Agent", () => {

  it("should create a FOR debater", async () => {
    // createDebater is now async — it tests the LLM connection
    const debater = await createDebater("FOR")
    expect(debater.side).toBe("FOR")
  })

  it("should create an AGAINST debater", async () => {
    const debater = await createDebater("AGAINST")
    expect(debater.side).toBe("AGAINST")
  })

  it("should have a provider set", async () => {
    const debater = await createDebater("FOR")
    // Provider should be either "gemini" or "ollama"
    expect(["gemini", "ollama"]).toContain(debater.provider)
  })

  it("should run a debate turn and return a string argument", async () => {
    const debater = await createDebater("FOR")
    const argument = await runDebateTurn(
      debater,
      "AI will replace programmers",
      [] // empty history = opening argument
    )
    expect(typeof argument).toBe("string")
    expect(argument.length).toBeGreaterThan(10)
  })

  it("should handle debate history correctly", async () => {
    const debater = await createDebater("AGAINST")

    // Simulate a debate with prior history
    const history = [
      { side: "FOR", argument: "AI will replace programmers because it can generate 90% of code." }
    ]

    const argument = await runDebateTurn(
      debater,
      "AI will replace programmers",
      history
    )

    expect(typeof argument).toBe("string")
    expect(argument.length).toBeGreaterThan(10)
  })

})