import { jest } from "@jest/globals"

// ─────────────────────────────────────────
// MOCK ALL EXTERNAL DEPENDENCIES
// The orchestrator test only tests coordination logic:
// - Did it create both agents?
// - Did it run the right number of rounds?
// - Did it call the judge?
// - Did it return the right shape of data?
// We don't test the LLM output here — that's debater's job
// ─────────────────────────────────────────

// Mock both LLM providers
jest.unstable_mockModule("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: "WINNER: FOR\nSCORE: FOR 8/10 | AGAINST 6/10\nREASONING: FOR had stronger arguments.\nHIGHLIGHT: AI generates 90% of code already."
    })
  }))
}))

jest.unstable_mockModule("@langchain/ollama", () => ({
  ChatOllama: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: "WINNER: FOR\nSCORE: FOR 8/10 | AGAINST 6/10\nREASONING: FOR had stronger arguments.\nHIGHLIGHT: AI generates 90% of code already."
    })
  }))
}))

// Mock the debater module entirely
// This isolates the orchestrator — we test coordination, not agent logic
jest.unstable_mockModule("../agents/debater.js", () => ({
  createDebater: jest.fn().mockImplementation((side) =>
    Promise.resolve({ side, provider: "gemini", llm: {} })
  ),
  runDebateTurn: jest.fn().mockImplementation((debater) =>
    Promise.resolve(`Mock argument from ${debater.side} side.`)
  )
}))

// Import AFTER mocking
const { runDebate } = await import("./orchestrator.js")

describe("Orchestrator", () => {

  it("should return a result with the correct topic", async () => {
    const result = await runDebate("AI will replace programmers", 1)
    expect(result.topic).toBe("AI will replace programmers")
  })

  it("should run the correct number of rounds", async () => {
    const result = await runDebate("AI will replace programmers", 2)
    // 2 rounds × 2 agents = 4 history entries
    expect(result.history.length).toBe(4)
  })

  it("should alternate FOR and AGAINST in history", async () => {
    const result = await runDebate("AI will replace programmers", 1)
    expect(result.history[0].side).toBe("FOR")
    expect(result.history[1].side).toBe("AGAINST")
  })

  it("should return a verdict with a winner", async () => {
    const result = await runDebate("AI will replace programmers", 1)
    expect(result.verdict).toBeDefined()
    expect(["FOR", "AGAINST", "DRAW"]).toContain(result.verdict.winner)
  })

  it("should include rounds in the result", async () => {
    const result = await runDebate("AI will replace programmers", 2)
    expect(result.rounds).toBe(2)
  })

})