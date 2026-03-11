import { jest } from "@jest/globals"

// Mock fetch so we don't make real HTTP calls in tests
const mockFetch = jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({
    results: [
      { title: "Test Result", content: "Test content about the search query" },
      { title: "Another Result", content: "More test content here" }
    ]
  })
})

global.fetch = mockFetch

const { searchTool } = await import("./search.js")

describe("Search Tool", () => {
  it("should have the correct name", () => {
    expect(searchTool.name).toBe("web_search")
  })

  it("should have a description", () => {
    expect(searchTool.description).toBeTruthy()
  })

  it("should return formatted results", async () => {
    const result = await searchTool.invoke({ query: "test query" })
    expect(typeof result).toBe("string")
    expect(result).toContain("[1]")
  })
})