import "dotenv/config";
const Groq = require("groq-sdk").default;
const groq = new Groq({apiKey: process.env.GROQ_API_KEY});
const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

async function test() {
  console.log("Testing GROQ with model:", MODEL);
  const resp = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [{role:"system", content:"Output ONLY JSON"}, {role:"user", content:"Return: {intent:\"PLAN\"}"}]
  });
  console.log("Response:", resp.choices[0].message.content);
}
test();