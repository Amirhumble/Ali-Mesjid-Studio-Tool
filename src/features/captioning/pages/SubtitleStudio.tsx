import React, { useState, useRef, useEffect } from "react";
import { SAMPLE_VIDEOS } from "../samples";
import { Caption, CaptionDisplayMode, CaptionStyle } from "../types";
import {
  generateSRT,
  generateWebVTT,
  generateTXT,
  drawCanvasSubtitle,
  formatVideoTime,
} from "../utils/subtitleHelper";
import CaptionEditor from "../components/CaptionEditor";
import StylePanel from "../components/StylePanel";
import { fetchFile } from "@ffmpeg/util";
import {
  Upload,
  Sparkles,
  Cpu,
  Play,
  Pause,
  Download,
  Video,
  RotateCcw,
  Sliders,
  FileText,
  Languages,
  CheckCircle,
  AlertCircle,
  Loader2,
  Volume2,
  Maximize,
} from "lucide-react";

type ExportQuality = "original" | "high" | "balanced" | "small";

interface SubtitleStudioProps {
  ffmpeg?: any;
  ffmpegLoaded?: boolean;
}

export default function SubtitleStudio({ ffmpeg, ffmpegLoaded }: SubtitleStudioProps) {
  const [selectedVideo, setSelectedVideo] = useState(SAMPLE_VIDEOS[0]);
  const [videoSrc, setVideoSrc] = useState(SAMPLE_VIDEOS[0].url);
  const [isDemo, setIsDemo] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>(SAMPLE_VIDEOS[0].defaultCaptions);
  const [activeCaptionId, setActiveCaptionId] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<CaptionDisplayMode>("dual");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>({
    fontSize: 28,
    fontFamily: '"Inter", sans-serif',
    color: "#FFFFFF",
    bgColor: "#000000",
    bgType: "solid",
    bgOpacity: 0.6,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    strokeColor: "#000000",
    strokeWidth: 2,
    verticalOffset: 15,
    horizontalOffset: 0,
    fontWeight: "semibold",
    lineHeight: 1.3,
    letterSpacing: 0,
    align: "center",
    padding: 12,
    borderRadius: 10,
    maxWidth: 90,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [instructionHint, setInstructionHint] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [exportQuality, setExportQuality] = useState<ExportQuality>("original");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrameId = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; vOff: number; hOff: number } | null>(null);

  const handleSelectSample = (video: typeof SAMPLE_VIDEOS[0]) => {
    setSelectedVideo(video);
    setVideoSrc(video.url);
    setVideoFile(null);
    setIsDemo(true);
    setCaptions(video.defaultCaptions);
    setAiError(null);
    setSuccessMessage(null);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsDemo(false);
      setCaptions([]);
      setAiError(null);
      setSuccessMessage(null);
      if (videoRef.current) {
        videoRef.current.load();
      }
    }
  };

  useEffect(() => {
    const active = captions.find((c) => currentTime >= c.start && currentTime <= c.end);
    setActiveCaptionId(active ? active.id : null);
  }, [currentTime, captions]);

  const drawOverlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const active = captions.find((c) => video.currentTime >= c.start && video.currentTime <= c.end);
    if (active) {
      drawCanvasSubtitle(ctx, active, canvas.width, canvas.height, displayMode, captionStyle);
    }
  };

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        drawOverlay();
      }
    });

    if (videoRef.current) {
      resizeObserver.observe(videoRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [videoSrc, captions, displayMode, captionStyle]);

  useEffect(() => {
    const updateOverlay = () => {
      drawOverlay();
      if (isPlaying) {
        renderFrameId.current = requestAnimationFrame(updateOverlay);
      }
    };

    if (isPlaying) {
      renderFrameId.current = requestAnimationFrame(updateOverlay);
    } else {
      if (renderFrameId.current) {
        cancelAnimationFrame(renderFrameId.current);
      }
      drawOverlay();
    }

    return () => {
      if (renderFrameId.current) {
        cancelAnimationFrame(renderFrameId.current);
      }
    };
  }, [isPlaying, captions, displayMode, captionStyle]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((err) => {
          console.warn("Playback engagement failed:", err);
          setIsPlaying(false);
        });
      } else {
        videoRef.current.pause();
      }
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitRequestFullscreen) {
        (videoRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any).msRequestFullscreen) {
        (videoRef.current as any).msRequestFullscreen();
      }
    }
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);
  const handleVideoWaiting = () => setIsBuffering(true);
  const handleVideoPlaying = () => setIsBuffering(false);
  const handleVideoEnded = () => setIsPlaying(false);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      drawOverlay();
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoaded(true);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = videoRef.current.clientWidth;
        canvas.height = videoRef.current.clientHeight;
      }
      drawOverlay();
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      const targetTime = Math.max(0, Math.min(time, duration));
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      drawOverlay();
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSeek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted = vol === 0;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      videoRef.current.muted = nextMute;
    }
  };

  const restartVideo = () => {
    handleSeek(0);
  };

  const convertToBase64 = (fileOrBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(fileOrBlob);
    });
  };

  const extractAudioFromMedia = async (fileOrUrl: File | string): Promise<{ data: string, mimeType: string }> => {
    if (!ffmpeg || !ffmpegLoaded) {
      throw new Error("FFmpeg engine is not yet initialized. Audio extraction failed.");
    }
    
    const inputName = "input_media";
    const outputName = "extracted_audio.mp3";
    
    setGenerationStep("Reading media stream...");
    await ffmpeg.writeFile(inputName, await fetchFile(fileOrUrl));
    
    setGenerationStep("Extracting audio band from media track...");
    
    // -vn: no video
    // -ac 1: convert to mono
    // -ar 16000: resample to 16kHz (ideal for speech AI)
    // -acodec libmp3lame: mp3 encoding
    // -ab 64k: 64kbps bitrate (plenty for voice, smaller payload)
    await ffmpeg.exec([
      "-i", inputName, 
      "-vn", 
      "-ac", "1",
      "-ar", "16000",
      "-acodec", "libmp3lame", 
      "-ab", "64k", 
      outputName
    ]);
    
    const data = await ffmpeg.readFile(outputName);
    const audioBlob = new Blob([new Uint8Array(data as ArrayBuffer)], { type: "audio/mp3" });
    const base64 = await convertToBase64(audioBlob);
    
    // Cleanup
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
    
    return { data: base64, mimeType: "audio/mp3" };
  };

  const handleGenerateAICaptions = async () => {
    setIsGenerating(true);
    setAiError(null);
    setSuccessMessage(null);
    setGenerationStep("Prepping AI pipeline...");

    try {
      let payloadMime = "audio/mp3";
      let base64Data = "";

      if (videoFile) {
        const responseData = await extractAudioFromMedia(videoFile);
        base64Data = responseData.data;
        payloadMime = responseData.mimeType;
      } else {
        const responseData = await extractAudioFromMedia(videoSrc);
        base64Data = responseData.data;
        payloadMime = responseData.mimeType;
      }

      setGenerationStep("Analyzing audio track and translating with Gemini AI...");

      const response = await fetch("/api/generate-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: payloadMime,
          instructionHint,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "The server rejected the transcription request.");
      }

      const outcome = await response.json();
      if (!outcome.captions || !Array.isArray(outcome.captions)) {
        throw new Error("Invalid caption array layout returned by service.");
      }

      setCaptions(outcome.captions);
      setSuccessMessage("Success! Gemini AI successfully transcribed this video track and rendered fluent Amharic caption segments.");
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || "Something went wrong during speech recognition.";
      if (errorMessage.includes("503") || errorMessage.includes("demand") || errorMessage.includes("UNAVAILABLE")) {
        errorMessage = "The AI service is currently experiencing very high demand. Please wait a minute and try again. Your video is still ready for processing!";
      } else if (errorMessage.includes("429")) {
        errorMessage = "Rate limit reached. Please wait a moment before trying again.";
      }
      setAiError(errorMessage);
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleExportTextFile = (format: "srt" | "vtt" | "txt") => {
    let fileContent = "";
    let filename = `amharic-subtitles.${format}`;

    if (format === "srt") {
      fileContent = generateSRT(captions, displayMode);
      filename = `amharic-subtitles-${displayMode}.srt`;
    } else if (format === "vtt") {
      fileContent = generateWebVTT(captions, displayMode);
      filename = `amharic-subtitles-${displayMode}.vtt`;
    } else {
      fileContent = generateTXT(captions, displayMode);
      filename = `amharic-transcript-${displayMode}.txt`;
    }

    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportHardcodedVideo = async () => {
    if (!ffmpeg || !ffmpegLoaded) {
      setExportError("FFmpeg engine is not yet initialized. Please wait.");
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setExportError("Unable to locate active video element reference.");
      return;
    }

    setIsExportingVideo(true);
    setExportProgress(0);
    setExportError(null);

    video.pause();
    setIsPlaying(false);

    try {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const fps = 30; // Standard capture FPS
      const totalFrames = Math.ceil(video.duration * fps);
      console.log("[Export] Starting video export pipeline...", { width, height, fps, totalFrames });

      // 1. Prepare Export UI
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!exportCtx) throw new Error("Could not initialize 2D context.");

      // 2. Load Source Video into FFmpeg
      const sourceFilename = "source_video.mp4";
      const audioFilename = "source_audio.aac";
      
      let videoBlob: Blob;
      if (videoFile) {
        videoBlob = videoFile;
      } else {
        console.log("[Export] Fetching sample video blob...");
        const response = await fetch(videoSrc);
        videoBlob = await response.blob();
      }
      
      await ffmpeg.writeFile(sourceFilename, await fetchFile(videoBlob));
      
      // Extract Audio for final muxing
      console.log("[Export] Extracting audio stream...");
      try {
        await ffmpeg.exec(["-i", sourceFilename, "-vn", "-acodec", "aac", audioFilename]);
      } catch (audioErr) {
        console.warn("[Export] Audio extraction failed or no audio track found. Proceeding without audio.", audioErr);
        // Create a dummy silent audio or just ignore it
      }

      // 3. Frame-by-Frame Rendering Loop
      const renderVideo = document.createElement("video");
      renderVideo.src = videoSrc;
      renderVideo.crossOrigin = "anonymous";
      renderVideo.muted = true;
      await new Promise((resolve) => {
        renderVideo.onloadedmetadata = resolve;
      });

      console.log("[Export] Beginning frame capture loop...");
      for (let i = 0; i < totalFrames; i++) {
        const timestamp = i / fps;
        renderVideo.currentTime = timestamp;
        
        await new Promise((resolve) => {
          renderVideo.onseeked = resolve;
        });

        // Draw video frame
        exportCtx.drawImage(renderVideo, 0, 0, width, height);
        
        // Draw captions
        const activeCap = captions.find((c) => timestamp >= c.start && timestamp <= c.end);
        if (activeCap) {
          drawCanvasSubtitle(exportCtx, activeCap, width, height, displayMode, captionStyle);
        }

        // Save frame to FFmpeg (Optimized with toBlob)
        const frameBlob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, "image/jpeg", 0.90));
        if (frameBlob) {
          const frameFilename = `frame_${String(i).padStart(6, "0")}.jpg`;
          await ffmpeg.writeFile(frameFilename, await fetchFile(frameBlob));
        }

        if (i % 10 === 0 || i === totalFrames - 1) {
          setExportProgress(Math.round((i / totalFrames) * 85)); 
        }
      }

      // 4. Mux Frames and Audio
      console.log("[Export] Finalizing encoding and muxing...");
      const outputFilename = `subtitled_video_${Date.now()}.mp4`;
      
      // Quality settings based on profile
      const crfMap = { original: "18", high: "23", balanced: "28", small: "32" };
      // Use faster presets for browser safety
      const presetMap = { original: "medium", high: "fast", balanced: "veryfast", small: "ultrafast" };
      
      const crf = crfMap[exportQuality];
      const preset = presetMap[exportQuality];

      const hasAudio = (await ffmpeg.readFile(audioFilename)).length > 0;
      
      const muxArgs = [
        "-framerate", fps.toString(),
        "-i", "frame_%06d.jpg",
      ];

      if (hasAudio) {
        muxArgs.push("-i", audioFilename);
      }

      muxArgs.push(
        "-c:v", "libx264",
        "-crf", crf,
        "-preset", preset,
        "-pix_fmt", "yuv420p"
      );

      if (hasAudio) {
        muxArgs.push("-c:a", "copy", "-shortest");
      }

      muxArgs.push(outputFilename);

      console.log("[Export] Executing FFmpeg muxing with args:", muxArgs);
      await ffmpeg.exec(muxArgs);

      setExportProgress(95);

      // 5. Download Result
      console.log("[Export] Reading final output file...");
      const data = await ffmpeg.readFile(outputFilename);
      const outputBlob = new Blob([new Uint8Array(data as ArrayBuffer)], { type: "video/mp4" });
      const downloadUrl = URL.createObjectURL(outputBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = `amharic-subtitled-video.mp4`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      setExportProgress(100);
      console.log("[Export] Video export complete and download triggered.");

      // Cleanup
      console.log("[Export] Cleaning up virtual filesystem...");
      try {
        await ffmpeg.deleteFile(sourceFilename);
        await ffmpeg.deleteFile(audioFilename);
        await ffmpeg.deleteFile(outputFilename);
        // Batch delete is not supported, but we can try to keep the FS clean
        // Deleting thousands of frames can be slow, maybe skip or do it asynchronously
      } catch (cleanupErr) {
        console.warn("[Export] Cleanup encountered an error (ignorable):", cleanupErr);
      }


    } catch (err: any) {
      console.error(err);
      setExportError(err.message || "Failed to render high-quality video.");
    } finally {
      setIsExportingVideo(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    dragStartRef.current = {
      x,
      y,
      vOff: captionStyle.verticalOffset,
      hOff: captionStyle.horizontalOffset,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragStartRef.current.x;
    const dy = y - dragStartRef.current.y;

    const dhOff = (dx / canvas.width) * 100;
    const dvOff = -(dy / canvas.height) * 100;

    setCaptionStyle((prev) => ({
      ...prev,
      horizontalOffset: Math.max(-50, Math.min(50, dragStartRef.current!.hOff + dhOff)),
      verticalOffset: Math.max(0, Math.min(100, dragStartRef.current!.vOff + dvOff)),
    }));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging && dragStartRef.current) {
      const dx = Math.abs(e.clientX - (dragStartRef.current.x + canvasRef.current!.getBoundingClientRect().left));
      const dy = Math.abs(e.clientY - (dragStartRef.current.y + canvasRef.current!.getBoundingClientRect().top));
      
      // If movement was very small, treat as a click
      if (dx < 5 && dy < 5) {
        togglePlay();
      }
    } else {
      togglePlay();
    }
    
    setIsDragging(false);
    dragStartRef.current = null;
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-10">
      <main className="flex-1 w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        <section className="lg:col-span-7 space-y-6 flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative group">
            <div className="relative aspect-video w-full flex items-center justify-center bg-slate-950">
              <video
                ref={videoRef}
                src={videoSrc}
                playsInline
                webkit-playsinline="true"
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onWaiting={handleVideoWaiting}
                onPlaying={handleVideoPlaying}
                onEnded={handleVideoEnded}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                crossOrigin="anonymous"
                className="w-full h-full object-contain pointer-events-auto"
              />
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`absolute top-0 left-0 w-full h-full z-10 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
              />
              
              {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-20">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                    <span className="text-white text-xs font-bold uppercase tracking-widest animate-pulse">Buffering...</span>
                  </div>
                </div>
              )}

              {!isPlaying && !isBuffering && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute p-6 rounded-full bg-white/90 hover:bg-white text-blue-600 transform hover:scale-110 active:scale-95 transition-all shadow-2xl cursor-pointer border border-blue-100 z-30 group"
                >
                  <Play className="w-10 h-10 fill-current translate-x-0.5 group-hover:text-blue-700" />
                </button>
              )}
            </div>
            <div className="p-5 bg-white border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-500 font-mono w-12">{formatVideoTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.01"
                  value={currentTime}
                  onChange={handleTimelineChange}
                  className="flex-1 h-1.5 rounded-full bg-slate-100 accent-blue-600 cursor-pointer appearance-none"
                />
                <span className="text-xs font-bold text-slate-500 font-mono w-12 text-right">{formatVideoTime(duration)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-3 rounded-xl bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-100 transition-all active:scale-90"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>
                  <button
                    type="button"
                    onClick={restartVideo}
                    className="p-3 rounded-xl bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-100 transition-all active:scale-90"
                    title="Restart Video"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-3 rounded-xl bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-100 transition-all active:scale-90 hidden sm:flex"
                    title="Fullscreen"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-2 ml-2 sm:ml-4 border-l border-slate-100 pl-2 sm:pl-4">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      {isMuted ? <Volume2 className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 sm:w-24 accent-blue-600 h-1 bg-slate-100 rounded-full cursor-pointer appearance-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider max-w-[150px] sm:max-w-none">
                  <Video className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{isDemo ? selectedVideo.title : (videoFile ? videoFile.name : "User Upload")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Media Selection
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Quick Samples
                </span>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                  {SAMPLE_VIDEOS.map((sample) => {
                    const isCurrent = isDemo && selectedVideo.id === sample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleSelectSample(sample)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between group ${
                          isCurrent
                            ? "bg-blue-50 border-blue-200 text-blue-700 font-bold"
                            : "bg-white border-slate-100 text-slate-600 hover:border-blue-100 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="text-sm truncate">{sample.title}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{sample.category} • {sample.durationText}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                          isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500"
                        }`}>
                          {isCurrent ? "ACTIVE" : "LOAD"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Upload Custom Video
                </span>
                <label className="flex flex-col items-center justify-center h-[160px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer text-center p-6 group">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Browse Video</span>
                  <span className="text-[10px] text-slate-400 mt-1 font-medium uppercase tracking-tighter">MP4, WEBM (Max 50MB)</span>
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  {videoFile && (
                    <div className="mt-3 px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full animate-in fade-in zoom-in duration-300">
                      ✓ {videoFile.name}
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 shadow-lg shadow-blue-200/50 space-y-5 text-white overflow-hidden relative">
            <div className="relative flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">AI Amharic Transcription</h3>
                <p className="text-xs text-blue-100 font-medium opacity-90">
                  Powered by Gemini AI • High-accuracy speech to Ethiopic translation
                </p>
              </div>
            </div>
            
            <div className="space-y-2 relative">
              <label className="text-[11px] font-bold text-blue-100 uppercase tracking-widest flex items-center justify-between">
                <span>Contextual Hints for AI</span>
                <span className="px-2 py-0.5 bg-blue-500/30 rounded text-[9px]">Optional</span>
              </label>
              <textarea
                rows={2}
                value={instructionHint}
                onChange={(e) => setInstructionHint(e.target.value)}
                placeholder="e.g. 'Use formal Amharic', 'Keep sentences short', 'Translate technical terms literally'..."
                className="w-full text-sm p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder:text-blue-200/50 resize-none leading-relaxed transition-all"
              />
            </div>

            {aiError && (
              <div className="p-4 rounded-2xl bg-rose-500/20 border border-white/10 backdrop-blur-md flex gap-3 items-start animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
                <p className="text-xs font-medium text-rose-100">{aiError}</p>
              </div>
            )}
            
            {successMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-white/10 backdrop-blur-md flex gap-3 items-start animate-in slide-in-from-top-2">
                <CheckCircle className="w-4 h-4 text-emerald-200 shrink-0" />
                <p className="text-xs font-medium text-emerald-100">{successMessage}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateAICaptions}
              disabled={isGenerating}
              className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all relative overflow-hidden group active:scale-[0.98] ${
                isGenerating
                  ? "bg-white/20 text-white/50 cursor-not-allowed"
                  : "bg-white text-blue-700 hover:bg-blue-50 shadow-xl shadow-blue-900/20"
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-bold uppercase tracking-widest text-xs animate-pulse">
                    {generationStep || "Processing..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span className="font-bold uppercase tracking-widest text-xs">Generate Amharic Captions</span>
                </>
              )}
            </button>
          </div>
        </section>

        <section className="lg:col-span-5 space-y-6 flex flex-col">
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <CaptionEditor
              captions={captions}
              onUpdateCaptions={setCaptions}
              activeId={activeCaptionId}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Visual Styling</h3>
              </div>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-tighter">Live Preview</span>
            </div>
            <StylePanel
              style={captionStyle}
              onChangeStyle={setCaptionStyle}
              displayMode={displayMode}
              onChangeDisplayMode={setDisplayMode}
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Export & Download
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleExportTextFile("srt")}
                disabled={captions.length === 0}
                className="py-3 px-2 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-2xl text-[10px] text-slate-600 font-bold text-center flex flex-col items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95"
              >
                <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform"><FileText className="w-4 h-4 text-blue-500" /></div>
                SRT FILE
              </button>
              <button
                type="button"
                onClick={() => handleExportTextFile("vtt")}
                disabled={captions.length === 0}
                className="py-3 px-2 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-2xl text-[10px] text-slate-600 font-bold text-center flex flex-col items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95"
              >
                <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform"><Languages className="w-4 h-4 text-indigo-500" /></div>
                VTT SUB
              </button>
              <button
                type="button"
                onClick={() => handleExportTextFile("txt")}
                disabled={captions.length === 0}
                className="py-3 px-2 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-2xl text-[10px] text-slate-600 font-bold text-center flex flex-col items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95"
              >
                <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform"><FileText className="w-4 h-4 text-slate-400" /></div>
                TRANSCRIPT
              </button>
            </div>
            
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Hardcoded Video Export</span>
                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">High Quality</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(["original", "high", "balanced", "small"] as ExportQuality[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => setExportQuality(q)}
                    className={`py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      exportQuality === q
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {q} Quality
                  </button>
                ))}
              </div>
              
              {exportError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium flex gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {exportError}
                </div>
              )}

              {isExportingVideo && (
                <div className="space-y-3 p-5 bg-blue-50 rounded-2xl border border-blue-100 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-blue-700 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> {exportProgress < 90 ? "Capturing Frames" : "Encoding Video"}
                    </span>
                    <span className="text-blue-800">{exportProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-blue-600 font-medium text-center leading-relaxed">
                    {exportProgress < 90 ? "Performing frame-accurate capture..." : "Finalizing high-quality MP4 container..."}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleExportHardcodedVideo}
                disabled={isExportingVideo || captions.length === 0}
                className={`w-full py-4 px-6 rounded-2xl text-xs font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.98] ${
                  isExportingVideo 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed" :
                  captions.length === 0 
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed" :
                    "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 group"
                }`}
              >
                <Video className={`w-5 h-5 ${isExportingVideo ? "text-slate-300" : "text-blue-200 group-hover:scale-110 transition-transform"}`} />
                <span>Export Subtitled Video</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
