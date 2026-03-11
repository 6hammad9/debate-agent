import { createDebater, runDebateTurn } from "./debater.js"

console.log("🧪 Testing Debater Agent...")

const forDebater = await createDebater("FOR")

const argument = await runDebateTurn(
  forDebater,
  "AI will replace programmers",
  [] // empty history = opening argument
)

console.log("\n🎤 FOR Argument:")
console.log(argument)