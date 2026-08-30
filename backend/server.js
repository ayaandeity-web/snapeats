/* ==========================================================
   SnapEats backend
   Holds the Groq API key server-side and proxies nutrition
   analysis requests, so:
   1. The key is never exposed in the published frontend code
   2. Browser CORS restrictions on api.groq.com never apply,
      since the browser talks to THIS server, not Groq directly
========================================================== */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());                          // allow the frontend (any origin) to call this API
app.use(express.json({ limit: "15mb" })); // photos as base64 can be a few MB

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "qwen/qwen3.6-27b"; // Groq's current vision-capable model

const NUTRITION_INSTRUCTIONS = `You are a nutrition estimation assistant for a food-tracking app.
Respond with ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:
{"foodName": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "note": string}
"note" should be one short encouraging or informative sentence (max 20 words) about the meal's nutritional balance.
Give your best realistic estimate for a single typical portion even if exact values are uncertain.`;

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("AI response wasn't in the expected format.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

app.post("/api/analyze", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "Server is missing GROQ_API_KEY. Set it in your hosting provider's environment variables." });
    }

    const { mode, base64, note, dishName, ingredients } = req.body || {};
    let content;

    if (mode === "photo") {
      if (!base64) return res.status(400).json({ error: "No photo was provided." });
      content = [
        { type: "text", text: `${NUTRITION_INSTRUCTIONS}\nAnalyze the food in this photo.${note ? " Extra context from the user: " + note : ""}` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ];
    } else if (mode === "homemade") {
      if (!ingredients) return res.status(400).json({ error: "No ingredients were provided." });
      content = [
        { type: "text", text: `${NUTRITION_INSTRUCTIONS}\nThis is a homemade dish called "${dishName || "Homemade dish"}". Estimate nutrition from these ingredients and rough quantities:\n${ingredients}` }
      ];
      if (base64) {
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
      }
    } else {
      return res.status(400).json({ error: "Missing or invalid 'mode' (expected 'photo' or 'homemade')." });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content }],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      return res.status(502).json({ error: `Groq API error (${groqRes.status}). ${errText.slice(0, 300)}` });
    }

    const data = await groqRes.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(text);
    res.json(parsed);

  } catch (err) {
    res.status(500).json({ error: err.message || "Server error while analyzing that meal." });
  }
});

app.get("/", (req, res) => {
  res.send("SnapEats backend is running. POST food photos or ingredients to /api/analyze.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SnapEats backend listening on port ${PORT}`);
});
