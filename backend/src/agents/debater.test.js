// We mock the LLM so Jest doesn't need a real API key
// This is called "mocking" — standard practice for unit tests
// It lets us test our logic without making real API calls

import { jest } from "@jest/globals"

// Mock the entire @langchain/google-genai module
jest.unstable_mockModule("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: `THOUGHT: I have enough evidence
FINAL: AI will replace programmers based on strong evidence from multiple sources.`
    })
  }))
}))

// Mock the search tool too — no real API calls in tests
jest.unstable_mockModule("../tools/search.js", () => ({
  searchTool: {
    invoke: jest.fn().mockResolvedValue("Mock search result: AI is replacing jobs.")
  }
}))

// Import AFTER mocking
const { createDebater, runDebateTurn } = await import("./debater.js")

describe("Debater Agent", () => {
  it("should create a FOR debater", () => {
    const debater = createDebater("FOR")
    expect(debater.side).toBe("FOR")
  })

  it("should create an AGAINST debater", () => {
    const debater = createDebater("AGAINST")
    expect(debater.side).toBe("AGAINST")
  })

  it("should run a debate turn and return an argument", async () => {
    const debater = createDebater("FOR")
    const argument = await runDebateTurn(debater, "AI will replace programmers", [])
    expect(typeof argument).toBe("string")
    expect(argument.length).toBeGreaterThan(10)
  })
})