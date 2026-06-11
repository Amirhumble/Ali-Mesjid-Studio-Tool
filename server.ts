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
    
    // Gemini supports common audio formats like audio/wav, audio/mp3, audio/ogg, audio/flac
    // If the browser sends something else, we might need to check, but most audio inputs work.
    const base64Data = buffer.toString('base64');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimetype,
            },
          },
          {
            text: "Please transcribe this audio file accurately. Identify speakers if there are multiple. Provide the transcription in a clear format.",
          },
        ],
      }
    });

    res.json({ transcription: response.text });
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

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const customHintText = instructionHint ? ` Additional Hint from user: ${instructionHint}` : "";
    const promptText = `Analyze the speech in this audio or video file.
1. Transcribe the spoken words accurately.
2. Group the transcribed speech into subtitle blocks.
3. Provide precise 'start' and 'end' timestamps in seconds for each block.
4. Return each object with id, start, end, original, and amharic fields.
${customHintText}`;

    // Retry logic for robust AI communication
    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [
            {
              inlineData: {
                mimeType,
                data: fileData,
              },
            },
            promptText,
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
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
            },
          },
        });

        const captions = JSON.parse(response.text.trim());
        return res.json({ captions });
      } catch (error: any) {
        lastError = error;
        const isRetryable = error.status === 503 || error.status === 429 || error.message?.includes("high demand") || error.message?.includes("429");
        
        if (isRetryable && attempt < maxRetries - 1) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Gemini API busy (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }

    throw lastError;
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
