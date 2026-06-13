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
  const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
  const maxRetriesPerModel = 3;
  let lastError: any = null;

  for (const modelName of models) {
    let attempt = 0;
    while (attempt < maxRetriesPerModel) {
      try {
        console.log(`[AI] Requesting ${modelName} (Attempt ${attempt + 1}/${maxRetriesPerModel})...`);
        
        // Add a 60-second timeout to the request
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("AI_REQUEST_TIMEOUT")), 60000)
        );

        const generatePromise = ai.getGenerativeModel({ model: modelName }).generateContent({
          contents: [
            {
              inlineData: {
                mimeType: options.mimeType,
                data: options.data,
              },
            },
            { text: options.prompt },
          ],
          generationConfig: options.isJson ? {
            responseMimeType: "application/json",
            responseSchema: options.schema,
          } : undefined,
        });

        const result: any = await Promise.race([generatePromise, timeoutPromise]);
        const response = await result.response;
        return response.text();
      } catch (error: any) {
        lastError = error;
        const status = error.status;
        const code = error.code;
        const message = error.message || "";
        
        const isRetryable = 
          status === 503 || 
          status === 429 || 
          code === 'ENOTFOUND' || 
          code === 'ECONNRESET' || 
          code === 'ETIMEDOUT' ||
          message.includes("AI_REQUEST_TIMEOUT") ||
          message.includes("high demand") || 
          message.includes("UNAVAILABLE") ||
          message.includes("deadline exceeded");

        if (isRetryable && attempt < maxRetriesPerModel - 1) {
          attempt++;
          // Exponential backoff: 2s, 4s, 8s... with jitter
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.warn(`[AI] ${modelName} encountered retryable error (${status || code || 'TIMEOUT'}). Retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        console.warn(`[AI] ${modelName} failed critically: ${message}`);
        break; // Move to next model if available
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
1. Detect the source spoken language.
2. Transcribe the spoken words accurately in the original language into the 'original' field.
3. Provide an Amharic version in the 'amharic' field:
   - If the source is Amharic, use the original transcription.
   - If the source is not Amharic, provide a fluent Amharic translation.
4. Provide an English version in the 'english' field:
   - If the source is English, use the original transcription.
   - If the source is not English, provide a fluent English translation.
5. Group the speech into subtitle blocks with precise 'start' and 'end' timestamps in seconds.
6. Return a JSON array of objects with id, start, end, original, amharic, and english fields.
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
          english: { type: Type.STRING },
        },
        required: ["id", "start", "end", "original", "amharic", "english"],
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
