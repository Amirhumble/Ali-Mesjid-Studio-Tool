
# Ali Mesjid Studio Tool

A professional media studio platform for video compression, AI-powered audio transcription, and advanced video captioning. Process media locally with FFmpeg.wasm and leverage Google Gemini AI for multilingual intelligence.

![Ali Mesjid Studio Tool](src/assets/clipShrinkLogo.jpg)

## Features

### 🎬 Subtitle Studio (New!)
- **AI Caption Generation**: Automatically generate accurate captions using Gemini 1.5 AI.
- **Multilingual Support**: Intelligent "Dual Language" mode detects source audio and provides combined Original + Amharic/English subtitles.
- **Visual Styling Engine**: Fully customizable fonts, sizes, colors, background styles, and positioning.
- **Interactive Editor**: Edit transcriptions, adjust timestamps, and preview changes in real-time.
- **Hardcoded Export**: Burn subtitles directly into your video with frame-accurate precision and adjustable quality profiles.
- **Text Exports**: Download subtitles in industry-standard formats: **SRT**, **VTT**, and **TXT** transcripts.

### 🎥 Video Compression
- **Local Processing**: High-speed compression directly in your browser using FFmpeg.wasm (no server uploads needed).
- **Quality Control**: Precise control over CRF (18-35) and resolution scaling (Original, 720p, 480p).
- **Speed Presets**: Choose between Ultrafast, Superfast, Veryfast, and Fast encoding modes.
- **Privacy First**: Your videos never leave your browser during compression.

### 🎙️ AI Transcription Pipeline
- **Optimized for Speech**: Automatic audio extraction, mono downmixing, and 16kHz resampling for maximum AI accuracy.
- **Resilient Logic**: Backend features exponential backoff, request timeouts, and model fallback (Gemini 1.5 Flash/Pro) to handle network instability.
- **Contextual Hints**: Provide instructions to the AI (e.g., "Use formal language", "Keep sentences short") for tailored results.

### 📱 Professional Video Player
- **Event-Driven Sync**: 100% reliable play/pause/seek synchronization between UI and video engine.
- **Mobile Optimized**: Native-feeling controls with large touch targets and `playsInline` support for iOS Safari.
- **Visual Feedback**: Real-time buffering indicators and loading states for a smooth UX.
- **Fullscreen Support**: Native fullscreen integration for detailed caption editing.

### 📚 History & Storage
- **Local Persistence**: History of compressions and transcriptions saved in browser localStorage (last 20 items).
- **Smart Management**: Track file size savings, re-download past work, or clear history instantly.

## Tech Stack

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe codebase
- **Tailwind CSS** - Responsive utility-first styling
- **Lucide React** - Vector iconography
- **FFmpeg.wasm** - Client-side video processing

### Backend
- **Express.js** - Node.js production server
- **Google Generative AI** - Multilingual transcription & translation
- **Multer** - Efficient multipart data handling

## Installation

### Prerequisites
- Node.js 18+ and npm
- Google Gemini API key (get one at [aistudio.google.com](https://aistudio.google.com/app/apikeys))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ali-mesjid-studio-tool.git
   cd ali-mesjid-studio-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Usage
- **Compression**: Drag a video into the Compressor tab, adjust settings, and click Compress.
- **Captioning**: Go to Subtitle Studio, upload a video (or use a sample), and click "Generate Amharic Captions". Customize the style and export as a subtitled video or SRT file.

## Status
**Stable Beta** - All core features are functional. Optimized for Chrome and Safari (Desktop/Mobile).
