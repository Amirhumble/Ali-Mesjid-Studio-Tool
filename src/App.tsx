import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import clipShrinkLogo from "./assets/clipShrinkLogo.jpg";
import AppFooter from "./features/studio/components/AppFooter";
import AppNavigation from "./features/studio/components/AppNavigation";
import CompressionTab from "./features/studio/components/CompressionTab";
import HistoryModal from "./features/studio/components/HistoryModal";
import TranscriptionTab from "./features/studio/components/TranscriptionTab";
import { useHashTab } from "./features/studio/hooks/useHashTab";
import { useObjectUrl } from "./features/studio/hooks/useObjectUrl";
import {
  addCompressionHistoryEntry,
  addTranscriptionHistoryEntry,
  clearStudioHistory,
  createCompressionHistoryEntry,
  createTranscriptionHistoryEntry,
  deleteCompressionHistoryItem,
  deleteTranscriptionHistoryItem,
  loadCompressionHistory,
  loadTranscriptionHistory,
} from "./features/studio/utils/historyStorage";
import type {
  AppTab,
  CompressionHistory,
  CompressionPreset,
  CompressionStatus,
  TranscriptionHistory,
  TranscriptionStatus,
  VideoMetadata,
  VideoScale,
} from "./features/studio/types";

const SubtitleStudio = lazy(() => import("./features/captioning/pages/SubtitleStudio"));

export default function App() {
  const [activeTab, setActiveTab] = useHashTab();

  const [loaded, setLoaded] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const [status, setStatus] = useState<CompressionStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [crf, setCrf] = useState(28);
  const [scale, setScale] = useState<VideoScale>("original");
  const [preset, setPreset] = useState<CompressionPreset>("ultrafast");
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>("idle");
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const [compressionHistory, setCompressionHistory] = useState<CompressionHistory[]>([]);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const ffmpegRef = useRef(new FFmpeg());
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const videoPreviewUrl = useObjectUrl(video);

  useEffect(() => {
    let active = true;
    const ffmpeg = ffmpegRef.current;

    ffmpeg.on("log", ({ message }) => {
      console.log(message);
    });

    ffmpeg.on("progress", ({ progress: ffmpegProgress }) => {
      setProgress(Math.round(ffmpegProgress * 100));
    });

    const loadFFmpeg = async () => {
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

      try {
        setLoaded(false);
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        if (active) {
          setLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load ffmpeg", error);
        if (active) {
          setErrorMessage("Failed to load FFmpeg. Check your internet connection.");
        }
      }
    };

    loadFFmpeg();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCompressionHistory(loadCompressionHistory());
    setTranscriptionHistory(loadTranscriptionHistory());
  }, []);

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideo(file);
      setVideoMetadata(null);
      setOutputUrl(null);
      setCompressedSize(null);
      setProgress(0);
      setStatus("idle");
      setErrorMessage(null);
    }
  };

  const handleAudioChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setAudioFile(file);
      setTranscriptionResult(null);
      setTranscriptionStatus("idle");
      setTranscribeError(null);
    }
  };

  const compressVideo = async () => {
    if (!video || !loaded) return;

    setStatus("compressing");
    setProgress(0);
    setErrorMessage(null);

    const ffmpeg = ffmpegRef.current;
    const inputFileName = "input_video";
    const outputFileName = "output_video.mp4";

    try {
      await ffmpeg.writeFile(inputFileName, await fetchFile(video));

      const ffmpegArgs = [
        "-i",
        inputFileName,
        "-vcodec",
        "libx264",
        "-crf",
        crf.toString(),
        "-preset",
        preset,
        "-acodec",
        "aac",
      ];

      if (scale === "720p") {
        ffmpegArgs.push("-vf", "scale=-2:720");
      } else if (scale === "480p") {
        ffmpegArgs.push("-vf", "scale=-2:480");
      }

      ffmpegArgs.push(outputFileName);

      await ffmpeg.exec(ffmpegArgs);

      const data = await ffmpeg.readFile(outputFileName);
      const blob = new Blob([new Uint8Array(data as ArrayBuffer)], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      setOutputUrl(url);
      setCompressedSize(blob.size);
      setStatus("completed");
      setCompressionHistory((currentHistory) =>
        addCompressionHistoryEntry(
          currentHistory,
          createCompressionHistoryEntry(video.name, video.size, blob.size, url),
        ),
      );
    } catch (error) {
      console.error("Compression error:", error);
      setStatus("error");
      setErrorMessage("An error occurred during compression.");
    }
  };

  const transcribeAudio = async () => {
    if (!audioFile) return;

    setTranscriptionStatus("transcribing");
    setTranscribeError(null);
    transcriptionAbortRef.current = new AbortController();

    const formData = new FormData();
    formData.append("audio", audioFile);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: transcriptionAbortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to transcribe");
      }

      const data = await response.json();
      setTranscriptionResult(data.transcription);
      setTranscriptionStatus("completed");
      setTranscriptionHistory((currentHistory) =>
        addTranscriptionHistoryEntry(currentHistory, createTranscriptionHistoryEntry(audioFile.name, data.transcription)),
      );
    } catch (error: any) {
      console.error("Transcription error:", error);
      if (error.name === "AbortError") {
        setTranscriptionStatus("idle");
        setTranscribeError("Transcription cancelled by user.");
      } else {
        setTranscriptionStatus("error");
        setTranscribeError(error.message || "Error communicating with Gemini AI.");
      }
    } finally {
      transcriptionAbortRef.current = null;
    }
  };

  const cancelTranscription = () => {
    if (transcriptionAbortRef.current) {
      transcriptionAbortRef.current.abort();
      setTranscriptionStatus("idle");
      setTranscribeError("Transcription cancelled by user.");
    }
  };

  const copyTranscription = () => {
    if (transcriptionResult) {
      navigator.clipboard.writeText(transcriptionResult);
    }
  };

  const clearAllHistory = () => {
    setCompressionHistory([]);
    setTranscriptionHistory([]);
    clearStudioHistory();
  };

  const deleteCompressionHistory = (id: string) => {
    setCompressionHistory((currentHistory) => deleteCompressionHistoryItem(currentHistory, id));
  };

  const deleteTranscriptionHistory = (id: string) => {
    setTranscriptionHistory((currentHistory) => deleteTranscriptionHistoryItem(currentHistory, id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      <AppNavigation
        logoSrc={clipShrinkLogo}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory((currentValue) => !currentValue)}
      />

      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-10">
        {showHistory && (
          <HistoryModal
            logoSrc={clipShrinkLogo}
            compressionHistory={compressionHistory}
            transcriptionHistory={transcriptionHistory}
            onClose={() => setShowHistory(false)}
            onDeleteCompression={deleteCompressionHistory}
            onDeleteTranscription={deleteTranscriptionHistory}
            onClearAll={clearAllHistory}
          />
        )}

        <div className="relative">
          <div className={activeTab === "compressor" ? "block" : "hidden"}>
            <CompressionTab
              video={video}
              videoPreviewUrl={videoPreviewUrl}
              loaded={loaded}
              status={status}
              progress={progress}
              outputUrl={outputUrl}
              compressedSize={compressedSize}
              errorMessage={errorMessage}
              crf={crf}
              scale={scale}
              preset={preset}
              videoMetadata={videoMetadata}
              onVideoChange={handleVideoChange}
              onClearVideo={() => {
                setVideo(null);
                setVideoMetadata(null);
                setOutputUrl(null);
                setCompressedSize(null);
                setProgress(0);
                setStatus("idle");
                setErrorMessage(null);
              }}
              onVideoLoadedMetadata={setVideoMetadata}
              onCrfChange={setCrf}
              onScaleChange={setScale}
              onPresetChange={setPreset}
              onCompress={compressVideo}
            />
          </div>

          <div className={activeTab === "transcribe" ? "block" : "hidden"}>
            <TranscriptionTab
              audioFile={audioFile}
              transcriptionStatus={transcriptionStatus}
              transcriptionResult={transcriptionResult}
              transcribeError={transcribeError}
              onAudioChange={handleAudioChange}
              onTranscribe={transcribeAudio}
              onCancel={cancelTranscription}
              onCopy={copyTranscription}
              onReset={() => {
                setTranscriptionResult(null);
                setTranscriptionStatus("idle");
              }}
            />
          </div>

          <div className={activeTab === "subtitleStudio" ? "block" : "hidden"}>
            <Suspense
              fallback={
                <div className="bg-white rounded-2xl border border-slate-200 shadow-md min-h-[400px] flex items-center justify-center text-slate-500">
                  Loading subtitle studio...
                </div>
              }
            >
              <SubtitleStudio ffmpeg={ffmpegRef.current} />
            </Suspense>
          </div>
        </div>

        <AppFooter activeTab={activeTab as AppTab} />
      </div>
    </div>
  );
}
