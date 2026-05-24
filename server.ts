import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
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
