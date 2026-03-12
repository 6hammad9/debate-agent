// Real demo — runs actual LLM and search
// Run with: node src/workflows/orchestrator.demo.js
import { runDebate } from "./orchestrator.js"

console.log("🎭 Starting real debate demo...")

const result = await runDebate("AI will replace programmers", 1)

console.log("\n📊 FINAL RESULTS")
console.log("=".repeat(40))

console.log("\n📜 DEBATE HISTORY:")
for (const entry of result.history) {
  console.log(`\n[${entry.side} - Round ${entry.round}]`)
  console.log(entry.argument)
}

console.log("\n⚖️  VERDICT:")
console.log("Winner:   ", result.verdict.winner)
console.log("Score:    ", result.verdict.score)
console.log("Reasoning:", result.verdict.reasoning)
console.log("Highlight:", result.verdict.highlight)