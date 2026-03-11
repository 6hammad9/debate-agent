import { searchTool } from "./search.js"

// Quick manual test — not a Jest test, just to verify it works
const result = await searchTool.invoke({ query: "AI replacing programmers 2024" })
console.log("Search result:")
console.log(result)