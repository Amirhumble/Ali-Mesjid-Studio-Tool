import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
const PORT = 3000;

// Initialize Gemini
// Note: process.env.GEMINI_API_KEY is automatically injected by AI Studio.
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set. Transcription will not work.');
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy-key',
});

// Use memory storage for multer to handle direct uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  }
});

// Helper for robust AI calls with retry and model fallback
async function callGeminiWithRetry(options: {
  mimeType: string,
  data: string,
  prompt: string,
  schema?: any,
  isJson?: boolean
}) {
  const models = ["gemini-3.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  const maxRetriesPerModel = 2;
  let lastError: any = null;

  for (const modelName of models) {
    let attempt = 0;
    while (attempt < maxRetriesPerModel) {
      try {
        console.log(`Requesting ${modelName} (Attempt ${attempt + 1}/${maxRetriesPerModel})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: options.mimeType,
                data: options.data,
              },
            },
            options.prompt,
          ],
          config: options.isJson ? {
            responseMimeType: "application/json",
            responseSchema: options.schema,
          } : undefined,
        });

        return response.text;
      } catch (error: any) {
        lastError = error;
        const status = error.status || (error.message?.includes("503") ? 503 : (error.message?.includes("429") ? 429 : 500));
        const isRetryable = status === 503 || status === 429 || error.message?.includes("high demand") || error.message?.includes("UNAVAILABLE");
        
        if (isRetryable && attempt < maxRetriesPerModel - 1) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1500;
          console.warn(`${modelName} busy (${status}). Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        console.warn(`${modelName} failed with status ${status}. ${models.indexOf(modelName) < models.length - 1 ? "Trying fallback model..." : "No more fallbacks."}`);
        break; // Move to next model
      }
    }
  }

  throw lastError;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured. Please set GEMINI_API_KEY environment variable." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const { buffer, mimetype } = req.file;
    const base64Data = buffer.toString('base64');

    const transcription = await callGeminiWithRetry({
      data: base64Data,
      mimeType: mimetype,
      prompt: "Please transcribe this audio file accurately. Identify speakers if there are multiple. Provide the transcription in a clear format."
    });

    res.json({ transcription });
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.status(500).json({ error: error.message || "Failed to transcribe audio" });
  }
});

// AI-generated captions endpoint used by Subtitle Studio
app.post("/api/generate-captions", async (req, res) => {
  try {
    const { fileData, mimeType, instructionHint } = req.body;

    if (!fileData || !mimeType) {
      return res.status(400).json({ error: "Missing fileData (base64) or mimeType parameters." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured. Please set GEMINI_API_KEY environment variable." });
    }

    const customHintText = instructionHint ? ` Additional Hint from user: ${instructionHint}` : "";
    const promptText = `Analyze the speech in this audio or video file.
1. Transcribe the spoken words accurately.
2. Group the transcribed speech into subtitle blocks.
3. Provide precise 'start' and 'end' timestamps in seconds for each block.
4. Return each object with id, start, end, original, and amharic fields.
${customHintText}`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
          original: { type: Type.STRING },
          amharic: { type: Type.STRING },
        },
        required: ["id", "start", "end", "original", "amharic"],
      },
    };

    const resultText = await callGeminiWithRetry({
      data: fileData,
      mimeType,
      prompt: promptText,
      schema,
      isJson: true
    });

    const captions = JSON.parse(resultText.trim());
    return res.json({ captions });
  } catch (error: any) {
    console.error("Generate captions error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate captions." });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
