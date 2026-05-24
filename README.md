
# Ali Mesjid Studio Tool

A professional media studio platform for video compression and AI-powered audio transcription. Compress videos locally with FFmpeg.wasm and transcribe audio using Google Gemini AI.

![Ali Mesjid Studio Tool](src/assets/clipShrinkLogo.jpg)

## Features

### 🎬 Video Compression
- **Local Processing**: Compress videos directly in your browser using FFmpeg.wasm
- **Adjustable Quality**: Control compression quality with CRF slider (18-35)
- **Speed Presets**: Choose from ultrafast, superfast, veryfast, or fast encoding
- **Resolution Scaling**: Optionally downscale to 720p or 480p
- **Real-time Progress**: Live compression progress tracking
- **Instant Download**: Download compressed videos immediately after processing

### 🎙️ Audio Transcription
- **AI-Powered**: Uses Google Gemini 2.0 Flash for accurate transcription
- **Multiple Formats**: Supports MP3, WAV, AAC, and other audio formats
- **Speaker Detection**: Identifies multiple speakers in audio
- **Copy & Share**: Easily copy transcriptions to clipboard
- **Cancellable**: Stop transcription at any time

### 📚 History & Storage
- **Compression History**: Track all compressed videos with file sizes and savings percentage
- **Transcription History**: Store all transcriptions with timestamps
- **Local Storage**: History persists in browser localStorage (keeps last 20 items)
- **Download Management**: Re-download any previously compressed video
- **Clear History**: Option to clear all history at once

### 🎨 Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Modern Aesthetics**: Blue/slate gradient theme with smooth animations
- **Sticky Navigation**: Easy access to features from anywhere
- **Dark Mode Ready**: Optimized for all viewing conditions
- **Accessibility**: Semantic HTML and keyboard navigation support

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Lucide React** - Beautiful icons
- **Vite** - Lightning-fast build tool

### Backend
- **Express.js** - Node.js server framework
- **FFmpeg.wasm** - Browser-based video processing
- **Google Gemini AI** - Audio transcription API
- **Multer** - File upload handling

### APIs & Services
- **Google Gemini 2.0 Flash** - AI transcription
- **FFmpeg Core** - Video encoding

## Installation

### Prerequisites
- Node.js 18+ and npm
- Google Gemini API key (get one at [aistudio.google.com](https://aistudio.google.com/app/apikeys))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ali-mesjid-studio-tool.git
   cd ali-mesjid-studio-tool

