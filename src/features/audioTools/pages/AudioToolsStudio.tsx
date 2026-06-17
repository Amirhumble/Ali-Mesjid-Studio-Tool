import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { fetchFile } from "@ffmpeg/util";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  AudioLines,
  Download,
  FileAudio2,
  GripVertical,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Scissors,
  Settings2,
  SquarePlay,
  Upload,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import type { AudioChannels, AudioExportSettings, AudioOutputFormat, AudioQualityPreset, AudioToolsMode, TrimMode } from "../types";
import type { AudioTrackItem } from "../types";
import { useObjectUrl } from "../../studio/hooks/useObjectUrl";
import {
  AUDIO_INPUT_ACCEPT,
  buildAudioOutputFileName,
  estimateAudioOutputSizeBytes,
  formatBytes,
  formatCompactDuration,
  formatDuration,
  getAudioChannelCount,
  getDefaultChannels,
  getDefaultSampleRate,
  getOutputMimeType,
  getPreferredCodec,
  getPresetBitrate,
  getQualityLabel,
  isSupportedAudioFile,
} from "../utils/audioFormats";

interface AudioToolsStudioProps {
  ffmpeg: any;
  loaded: boolean;
  progress: number;
}

const MODE_TABS: Array<{ id: AudioToolsMode; label: string; icon: typeof AudioLines }> = [
  { id: "merge", label: "Audio Merger", icon: AudioLines },
  { id: "trim", label: "Audio Trimmer", icon: Scissors },
  { id: "compress", label: "Audio Compressor", icon: Waves },
];

const QUALITY_PRESET_ORDER: AudioQualityPreset[] = ["original", "high", "balanced", "small"];
const FORMAT_OPTIONS: AudioOutputFormat[] = ["mp3", "wav", "m4a", "aac", "ogg", "flac"];
const CHANNEL_OPTIONS: AudioChannels[] = ["source", "mono", "stereo"];
const TRIM_MODES: Array<{ id: TrimMode; label: string }> = [
  { id: "simple", label: "Simple" },
  { id: "precise", label: "Precise" },
];

const DEFAULT_EXPORT_SETTINGS: AudioExportSettings = {
  fileName: "audio-tools-export",
  format: "mp3",
  quality: "balanced",
  bitrateKbps: 192,
  sampleRate: 44100,
  channels: "stereo",
};

function createTrackId(file: File, index: number) {
  return `${Date.now()}-${index}-${file.name}`;
}

function readAudioDuration(url: string) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration * 1000);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read audio metadata."));
    };
  });
}

function buildWaveformPeaks(buffer: AudioBuffer, peakCount = 320) {
  const peaks = new Array<number>(peakCount).fill(0);
  const samplesPerPeak = Math.max(1, Math.floor(buffer.length / peakCount));
  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const start = peakIndex * samplesPerPeak;
    const end = peakIndex === peakCount - 1 ? buffer.length : Math.min(buffer.length, start + samplesPerPeak);
    let maxPeak = 0;

    for (const data of channelData) {
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        const value = Math.abs(data[sampleIndex] ?? 0);
        if (value > maxPeak) {
          maxPeak = value;
        }
      }
    }

    peaks[peakIndex] = maxPeak;
  }

  return peaks;
}

function getModeTitle(mode: AudioToolsMode) {
  switch (mode) {
    case "merge":
      return "Merge several audio tracks into one file with drag-and-drop ordering.";
    case "trim":
      return "Trim audio with millisecond precision, waveform guidance, and live preview.";
    case "compress":
      return "Reduce file size with professional quality presets and export controls.";
  }
}

function getModeDefaultFileName(mode: AudioToolsMode) {
  switch (mode) {
    case "merge":
      return "merged-audio";
    case "trim":
      return "trimmed-audio";
    case "compress":
      return "compressed-audio";
  }
}

function getSummaryLabel(mode: AudioToolsMode, itemCount: number) {
  switch (mode) {
    case "merge":
      return `${itemCount} track${itemCount === 1 ? "" : "s"}`;
    case "trim":
      return "Single source";
    case "compress":
      return "One source file";
  }
}

function formatTimeInputValue(ms: number) {
  return (Math.max(0, ms) / 1000).toFixed(3);
}

function trimSummary(startMs: number, endMs: number) {
  return `${formatDuration(startMs)} → ${formatDuration(endMs)}`;
}

function toOneLineError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Audio processing failed.";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length) return next;
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function AudioToolsStudio({ ffmpeg, loaded, progress }: AudioToolsStudioProps) {
  const { t } = useTranslation();

  const [mode, setMode] = useState<AudioToolsMode>("merge");
  const [mergeTracks, setMergeTracks] = useState<AudioTrackItem[]>([]);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);

  const [trimFile, setTrimFile] = useState<File | null>(null);
  const [trimMode, setTrimMode] = useState<TrimMode>("simple");
  const [trimStartMs, setTrimStartMs] = useState(0);
  const [trimEndMs, setTrimEndMs] = useState(0);
  const [trimDurationMs, setTrimDurationMs] = useState(0);
  const [trimWaveform, setTrimWaveform] = useState<number[]>([]);
  const [trimZoom, setTrimZoom] = useState(1);
  const [playheadMs, setPlayheadMs] = useState(0);

  const [compressFile, setCompressFile] = useState<File | null>(null);
  const [compressDurationMs, setCompressDurationMs] = useState(0);

  const [exportSettings, setExportSettings] = useState<AudioExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [status, setStatus] = useState<"idle" | "processing" | "completed" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [sourceSize, setSourceSize] = useState<number | null>(null);
  const [previewTrackIndex, setPreviewTrackIndex] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const currentOutputUrlRef = useRef<string | null>(null);

  const mergeInputUrl = useMemo(() => {
    if (mode === "merge" && mergeTracks.length > 0) {
      return mergeTracks[previewTrackIndex]?.url ?? mergeTracks[0].url;
    }
    return null;
  }, [mode, mergeTracks, previewTrackIndex]);

  const trimInputUrl = useObjectUrl(trimFile);
  const compressInputUrl = useObjectUrl(compressFile);

  useEffect(() => {
    if (currentOutputUrlRef.current) {
      URL.revokeObjectURL(currentOutputUrlRef.current);
      currentOutputUrlRef.current = null;
    }
    setOutputUrl(null);
    setOutputSize(null);
    setErrorMessage(null);
    setStatus("idle");
  }, [mode]);

  useEffect(() => {
    const file = trimFile;
    if (!file) {
      setTrimDurationMs(0);
      setTrimWaveform([]);
      setTrimStartMs(0);
      setTrimEndMs(0);
      setPlayheadMs(0);
      return;
    }

    let cancelled = false;

    const loadTrimMetadata = async () => {
      const url = URL.createObjectURL(file);
      try {
        const durationMs = await readAudioDuration(url);
        if (cancelled) return;
        setTrimDurationMs(durationMs);
        setTrimStartMs(0);
        setTrimEndMs(durationMs);
        setPlayheadMs(0);

        const arrayBuffer = await file.arrayBuffer();
        if (cancelled) return;
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextCtor();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        if (cancelled) {
          await audioContext.close();
          return;
        }
        setTrimWaveform(buildWaveformPeaks(audioBuffer));
        await audioContext.close();
      } catch (error) {
        if (!cancelled) {
          console.error("Trim metadata error:", error);
          setErrorMessage("Could not analyze the selected trim file.");
        }
      }
    };

    void loadTrimMetadata();

    return () => {
      cancelled = true;
    };
  }, [trimFile]);

  useEffect(() => {
    const file = compressFile;
    if (!file) {
      setCompressDurationMs(0);
      return;
    }

    let cancelled = false;
    const loadDuration = async () => {
      const url = URL.createObjectURL(file);
      try {
        const durationMs = await readAudioDuration(url);
        if (!cancelled) {
          setCompressDurationMs(durationMs);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Compression metadata error:", error);
          setErrorMessage("Could not analyze the selected compression file.");
        }
      }
    };

    void loadDuration();

    return () => {
      cancelled = true;
    };
  }, [compressFile]);

  useEffect(() => {
    setPreviewTrackIndex(0);
  }, [mergeTracks.length, mode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (mode !== "merge") return;
      if (previewTrackIndex < mergeTracks.length - 1) {
        const nextIndex = previewTrackIndex + 1;
        setPreviewTrackIndex(nextIndex);
        const nextTrack = mergeTracks[nextIndex];
        if (nextTrack) {
          audio.src = nextTrack.url;
          void audio.play().catch(() => {
            setPreviewBusy(false);
          });
        }
      } else {
        setPreviewBusy(false);
      }
    };

    const handlePause = () => {
      if (!audio.ended) {
        setPreviewBusy(false);
      }
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
    };
  }, [mergeTracks, mode, previewTrackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (mode === "merge") {
      const track = mergeTracks[previewTrackIndex] ?? mergeTracks[0];
      if (track && audio.src !== track.url) {
        audio.src = track.url;
        audio.load();
      }
      return;
    }

    if (mode === "trim" && trimInputUrl) {
      if (audio.src !== trimInputUrl) {
        audio.src = trimInputUrl;
        audio.load();
      }
      return;
    }

    if (mode === "compress" && compressInputUrl) {
      if (audio.src !== compressInputUrl) {
        audio.src = compressInputUrl;
        audio.load();
      }
    }
  }, [mode, mergeTracks, previewTrackIndex, trimInputUrl, compressInputUrl]);

  const currentSourceSize = useMemo(() => {
    if (mode === "merge") {
      return mergeTracks.reduce((sum, track) => sum + track.file.size, 0);
    }
    if (mode === "trim") {
      return trimFile?.size ?? 0;
    }
    return compressFile?.size ?? 0;
  }, [mode, mergeTracks, trimFile, compressFile]);

  const currentDurationMs = useMemo(() => {
    if (mode === "merge") {
      return mergeTracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
    }
    if (mode === "trim") {
      return Math.max(0, trimEndMs - trimStartMs);
    }
    return compressDurationMs;
  }, [mode, mergeTracks, trimStartMs, trimEndMs, compressDurationMs]);

  const estimatedOutputSize = useMemo(() => {
    if (currentDurationMs <= 0) return null;
    return estimateAudioOutputSizeBytes({
      durationMs: currentDurationMs,
      format: exportSettings.format,
      quality: exportSettings.quality,
      bitrateKbps: exportSettings.bitrateKbps,
      sampleRate: exportSettings.sampleRate,
      channels: exportSettings.channels,
    });
  }, [currentDurationMs, exportSettings]);

  const compressionPercentage = useMemo(() => {
    if (!currentSourceSize || !outputSize) return null;
    return Math.round(((currentSourceSize - outputSize) / currentSourceSize) * 100);
  }, [currentSourceSize, outputSize]);

  const processingSummary = useMemo(() => {
    const durationLabel = formatCompactDuration(currentDurationMs);
    const channels = exportSettings.channels === "source" ? "source" : exportSettings.channels;
    return `${MODE_TABS.find((item) => item.id === mode)?.label ?? "Audio"} · ${durationLabel} · ${exportSettings.format.toUpperCase()} · ${exportSettings.bitrateKbps} kbps · ${exportSettings.sampleRate / 1000} kHz · ${channels}`;
  }, [currentDurationMs, exportSettings, mode]);

  const handleModeSelect = (nextMode: AudioToolsMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setStatus("idle");
    setPreviewBusy(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleExportSettingChange = <K extends keyof AudioExportSettings>(key: K, value: AudioExportSettings[K]) => {
    setExportSettings((current) => ({ ...current, [key]: value }));
  };

  const applyQualityPreset = (quality: AudioQualityPreset) => {
    const bitrate = getPresetBitrate(quality);
    setExportSettings((current) => ({
      ...current,
      quality,
      bitrateKbps: bitrate,
      sampleRate: quality === "original" ? current.sampleRate : quality === "small" ? 32000 : current.sampleRate,
    }));
  };

  const clearCurrentMode = () => {
    if (mode === "merge") {
      mergeTracks.forEach((track) => URL.revokeObjectURL(track.url));
      setMergeTracks([]);
    } else if (mode === "trim") {
      setTrimFile(null);
      setTrimWaveform([]);
      setTrimDurationMs(0);
      setTrimStartMs(0);
      setTrimEndMs(0);
      setPlayheadMs(0);
    } else {
      setCompressFile(null);
      setCompressDurationMs(0);
    }

    setErrorMessage(null);
    setOutputUrl(null);
    setOutputSize(null);
    setStatus("idle");
    if (currentOutputUrlRef.current) {
      URL.revokeObjectURL(currentOutputUrlRef.current);
      currentOutputUrlRef.current = null;
    }
  };

  const loadFilesForMerge = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(isSupportedAudioFile);
    if (accepted.length === 0) {
      setErrorMessage("Please select supported audio files such as MP3, WAV, M4A, AAC, OGG, or FLAC.");
      return;
    }

    const prepared = await Promise.all(
      accepted.map(async (file, index) => {
        const url = URL.createObjectURL(file);
        const durationMs = await readAudioDuration(url).catch(() => null);
        return {
          id: createTrackId(file, index),
          file,
          url,
          durationMs,
        } satisfies AudioTrackItem;
      }),
    );

    setMergeTracks((current) => [...current, ...prepared]);
    setErrorMessage(null);
  };

  const handleMergeUpload = async (event: ChangeEvent<HTMLInputElement> | DragEvent<HTMLDivElement>) => {
    const files = "dataTransfer" in event ? event.dataTransfer.files : event.target.files;
    if (!files || files.length === 0) return;
    await loadFilesForMerge(files);
  };

  const handleTrimUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isSupportedAudioFile(file)) {
      setErrorMessage("Please select a supported audio file for trimming.");
      return;
    }
    setTrimFile(file);
    setErrorMessage(null);
  };

  const handleCompressUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isSupportedAudioFile(file)) {
      setErrorMessage("Please select a supported audio file for compression.");
      return;
    }
    setCompressFile(file);
    setErrorMessage(null);
  };

  const moveMergeTrack = (id: string, delta: number) => {
    const currentIndex = mergeTracks.findIndex((track) => track.id === id);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= mergeTracks.length) return;
    setMergeTracks((current) => moveItem(current, currentIndex, nextIndex));
    setPreviewTrackIndex((current) => clampNumber(current + delta, 0, Math.max(0, mergeTracks.length - 1)));
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, trackId: string) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggedTrackId(trackId);
  };

  const handleDropTrack = (event: DragEvent<HTMLDivElement>, targetTrackId: string) => {
    event.preventDefault();
    if (!draggedTrackId || draggedTrackId === targetTrackId) return;
    const fromIndex = mergeTracks.findIndex((track) => track.id === draggedTrackId);
    const toIndex = mergeTracks.findIndex((track) => track.id === targetTrackId);
    if (fromIndex === -1 || toIndex === -1) return;
    setMergeTracks((current) => moveItem(current, fromIndex, toIndex));
    setDraggedTrackId(null);
  };

  const handlePreviewToggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (mode === "merge") {
      if (mergeTracks.length === 0) return;
      const track = mergeTracks[previewTrackIndex] ?? mergeTracks[0];
      if (!track) return;
      if (audio.src !== track.url) {
        audio.src = track.url;
        audio.load();
      }
      audio.currentTime = 0;
      setPreviewBusy(true);
      setPreviewTrackIndex(mergeTracks.findIndex((item) => item.id === track.id));
      await audio.play().catch(() => setPreviewBusy(false));
      return;
    }

    if (mode === "trim") {
      if (!trimInputUrl) return;
      if (audio.src !== trimInputUrl) {
        audio.src = trimInputUrl;
        audio.load();
      }
      const nextTime = trimStartMs / 1000;
      audio.currentTime = nextTime;
      setPlayheadMs(trimStartMs);
      setPreviewBusy(true);
      await audio.play().catch(() => setPreviewBusy(false));
      return;
    }

    if (mode === "compress") {
      if (!compressInputUrl) return;
      if (audio.src !== compressInputUrl) {
        audio.src = compressInputUrl;
        audio.load();
      }
      audio.currentTime = 0;
      setPreviewBusy(true);
      await audio.play().catch(() => setPreviewBusy(false));
    }
  };

  const handlePreviewPause = () => {
    audioRef.current?.pause();
    setPreviewBusy(false);
  };

  const handleTrimSetStart = () => {
    setTrimStartMs(clampNumber(playheadMs, 0, Math.max(0, trimEndMs - 1)));
  };

  const handleTrimSetEnd = () => {
    setTrimEndMs(clampNumber(playheadMs, trimStartMs + 1, trimDurationMs));
  };

  const processAudio = async (download = true) => {
    if (!loaded) {
      setErrorMessage("FFmpeg is still loading. Please wait a moment.");
      return;
    }

    const audio = audioRef.current;
    audio?.pause();
    setPreviewBusy(false);
    setStatus("processing");
    setErrorMessage(null);
    setOutputUrl(null);
    setOutputSize(null);

    if (currentOutputUrlRef.current) {
      URL.revokeObjectURL(currentOutputUrlRef.current);
      currentOutputUrlRef.current = null;
    }

    const inputFileNames: string[] = [];
    const cleanupFiles: string[] = [];

    try {
      const outputFileName = buildAudioOutputFileName(exportSettings.fileName, exportSettings.format);
      const outputTempName = `output.${exportSettings.format}`;
      let ffmpegArgs: string[] = [];
      let sourceDuration = currentDurationMs;

      if (mode === "merge") {
        if (mergeTracks.length < 2) {
          throw new Error("Add at least two audio files to merge.");
        }

        for (let index = 0; index < mergeTracks.length; index += 1) {
          const track = mergeTracks[index];
          const inputName = `merge-input-${index}.${track.file.name.split(".").pop() || "audio"}`;
          await ffmpeg.writeFile(inputName, await fetchFile(track.file));
          inputFileNames.push(inputName);
          cleanupFiles.push(inputName);
        }

        const concatInputs = mergeTracks.map((_, index) => `[${index}:a]`).join("");
        ffmpegArgs = [
          ...inputFileNames.flatMap((inputName) => ["-i", inputName]),
          "-filter_complex",
          `${concatInputs}concat=n=${mergeTracks.length}:v=0:a=1[outa]`,
          "-map",
          "[outa]",
        ];

        sourceDuration = mergeTracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
      }

      if (mode === "trim") {
        if (!trimFile) {
          throw new Error("Select an audio file to trim.");
        }
        const inputName = `trim-input.${trimFile.name.split(".").pop() || "audio"}`;
        await ffmpeg.writeFile(inputName, await fetchFile(trimFile));
        inputFileNames.push(inputName);
        cleanupFiles.push(inputName);
        const trimDurationSec = Math.max(0.001, (trimEndMs - trimStartMs) / 1000);
        ffmpegArgs = [
          "-i",
          inputName,
          "-ss",
          formatTimeInputValue(trimStartMs),
          "-t",
          trimDurationSec.toFixed(3),
        ];
        sourceDuration = Math.max(0, trimEndMs - trimStartMs);
      }

      if (mode === "compress") {
        if (!compressFile) {
          throw new Error("Select an audio file to compress.");
        }
        const inputName = `compress-input.${compressFile.name.split(".").pop() || "audio"}`;
        await ffmpeg.writeFile(inputName, await fetchFile(compressFile));
        inputFileNames.push(inputName);
        cleanupFiles.push(inputName);
        ffmpegArgs = ["-i", inputName];
      }

      const channelCount = getAudioChannelCount(exportSettings.channels, 2);
      const sampleRate = exportSettings.sampleRate;
      const bitrate = `${exportSettings.bitrateKbps}k`;
      const codec = getPreferredCodec(exportSettings.format);

      ffmpegArgs.push("-map_metadata", "0");

      if (exportSettings.format === "wav") {
        ffmpegArgs.push("-c:a", "pcm_s16le", "-ar", sampleRate.toString(), "-ac", channelCount.toString());
      } else if (exportSettings.format === "flac") {
        ffmpegArgs.push("-c:a", "flac", "-ar", sampleRate.toString(), "-ac", channelCount.toString());
      } else {
        ffmpegArgs.push("-c:a", codec, "-b:a", bitrate, "-ar", sampleRate.toString(), "-ac", channelCount.toString());
        if (exportSettings.format === "m4a") {
          ffmpegArgs.push("-movflags", "+faststart");
        }
      }

      ffmpegArgs.push(outputTempName);

      await ffmpeg.exec(ffmpegArgs);

      const data = await ffmpeg.readFile(outputTempName);
      const blob = new Blob([new Uint8Array(data as ArrayBuffer)], { type: getOutputMimeType(exportSettings.format) });
      const url = URL.createObjectURL(blob);
      currentOutputUrlRef.current = url;
      setOutputUrl(url);
      setOutputSize(blob.size);
      setStatus("completed");

      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = outputFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      void sourceDuration;
    } catch (error) {
      console.error("Audio export error:", error);
      setStatus("error");
      setErrorMessage(toOneLineError(error));
    } finally {
      for (const inputName of inputFileNames) {
        try {
          await ffmpeg.deleteFile(inputName);
        } catch {
          // ignore cleanup failures
        }
      }
      try {
        await ffmpeg.deleteFile("output.mp3");
        await ffmpeg.deleteFile("output.wav");
        await ffmpeg.deleteFile("output.m4a");
        await ffmpeg.deleteFile("output.aac");
        await ffmpeg.deleteFile("output.ogg");
        await ffmpeg.deleteFile("output.flac");
      } catch {
        // ignore cleanup failures
      }
      setPreviewBusy(false);
    }
  };

  const sourceLabel = useMemo(() => {
    if (mode === "merge") {
      return getSummaryLabel(mode, mergeTracks.length);
    }
    if (mode === "trim") {
      return trimFile?.name ?? "No file selected";
    }
    return compressFile?.name ?? "No file selected";
  }, [mode, mergeTracks.length, trimFile, compressFile]);

  const canExport = loaded && !previewBusy && !status.startsWith("processing") && currentSourceSize > 0;

  const previewProgressLabel = useMemo(() => {
    if (mode === "merge") {
      if (mergeTracks.length === 0) return "Add tracks to preview the merge order.";
      return `Previewing ${mergeTracks[previewTrackIndex]?.file.name ?? mergeTracks[0].file.name}`;
    }
    if (mode === "trim") {
      return trimFile ? `Previewing ${trimFile.name}` : "Select an audio file to preview.";
    }
    return compressFile ? `Previewing ${compressFile.name}` : "Select an audio file to preview.";
  }, [mode, mergeTracks, previewTrackIndex, trimFile, compressFile]);

  const handlePreviewTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentMs = Math.round(audio.currentTime * 1000);
    setPlayheadMs(currentMs);

    if (mode === "trim") {
      if (currentMs >= trimEndMs) {
        audio.pause();
        audio.currentTime = trimStartMs / 1000;
        setPreviewBusy(false);
      }
    }
  };

  const previewTimeLabel = useMemo(() => {
    const audio = audioRef.current;
    if (mode === "merge" && mergeTracks.length > 0) {
      const track = mergeTracks[previewTrackIndex] ?? mergeTracks[0];
      const durationMs = track?.durationMs ?? 0;
      return `${formatDuration(playheadMs)} / ${formatDuration(durationMs)}`;
    }
    if (mode === "trim") {
      return `${formatDuration(playheadMs)} / ${formatDuration(trimDurationMs)}`;
    }
    if (mode === "compress" && compressDurationMs > 0) {
      return `${formatDuration(playheadMs)} / ${formatDuration(compressDurationMs)}`;
    }
    void audio;
    return "0:00.000 / 0:00.000";
  }, [mode, mergeTracks, previewTrackIndex, playheadMs, trimDurationMs, compressDurationMs]);

  const renderSourcePanel = () => {
    if (mode === "merge") {
      return (
        <div className="space-y-4">
          <UploadCard
            title="Upload Audio Files"
            description="Drop multiple tracks, then reorder them before export."
            accept={AUDIO_INPUT_ACCEPT}
            multiple
            onChange={handleMergeUpload}
            onDrop={handleMergeUpload}
          />

          <div className="bg-white/90 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Track Order</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Drag tracks to reorder the merge sequence.</p>
              </div>
              <button
                type="button"
                onClick={clearCurrentMode}
                className="h-10 px-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                Clear
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              {mergeTracks.length === 0 ? (
                <EmptyState icon={FileAudio2} text="No audio files added yet." />
              ) : (
                mergeTracks.map((track, index) => (
                  <div
                    key={track.id}
                    draggable
                    onDragStart={(event) => handleDragStart(event, track.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDropTrack(event, track.id)}
                    className={`group rounded-2xl border bg-slate-50 dark:bg-slate-950 px-3 sm:px-4 py-3 transition-all ${
                      draggedTrackId === track.id
                        ? "border-blue-400 shadow-lg shadow-blue-100 dark:shadow-blue-900/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewTrackIndex(index)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 transition-all active:scale-95"
                        title="Preview track"
                      >
                        <SquarePlay className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        draggable={false}
                        onMouseDown={(event) => event.preventDefault()}
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 cursor-grab active:cursor-grabbing"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{track.file.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatBytes(track.file.size)} · {track.durationMs ? formatDuration(track.durationMs) : "Loading duration..."}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveMergeTrack(track.id, -1)}
                          className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 transition-all active:scale-95 grid place-items-center"
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMergeTrack(track.id, 1)}
                          className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 transition-all active:scale-95 grid place-items-center"
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(track.url);
                            setMergeTracks((current) => current.filter((item) => item.id !== track.id));
                          }}
                          className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-rose-500 hover:text-rose-600 transition-all active:scale-95 grid place-items-center"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }

    if (mode === "trim") {
      return (
        <div className="space-y-4">
          <UploadCard
            title="Upload an Audio File"
            description="Use a single file for simple trimming or precise waveform-based trimming."
            accept={AUDIO_INPUT_ACCEPT}
            onChange={handleTrimUpload}
          />

          {trimFile && (
            <div className="bg-white/90 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{trimFile.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(trimFile.size)} · {formatDuration(trimDurationMs)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearCurrentMode}
                  className="h-10 px-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  Clear
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {TRIM_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTrimMode(item.id)}
                    className={`h-11 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all active:scale-95 ${
                      trimMode === item.id
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {trimMode === "simple" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <NumberField
                    label="Start Time"
                    value={trimStartMs / 1000}
                    max={Math.max(0, (trimEndMs - 1) / 1000)}
                    step={0.001}
                    onChange={(value) => setTrimStartMs(clampNumber(Math.round(value * 1000), 0, Math.max(0, trimEndMs - 1)))}
                    suffix="s"
                  />
                  <NumberField
                    label="End Time"
                    value={trimEndMs / 1000}
                    max={trimDurationMs / 1000}
                    step={0.001}
                    onChange={(value) => setTrimEndMs(clampNumber(Math.round(value * 1000), trimStartMs + 1, trimDurationMs))}
                    suffix="s"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <WaveformViewer
                    peaks={trimWaveform}
                    durationMs={trimDurationMs}
                    playheadMs={playheadMs}
                    trimStartMs={trimStartMs}
                    trimEndMs={trimEndMs}
                    zoom={trimZoom}
                    onSeek={setPlayheadMs}
                    onSeekRatio={(ratio) => setPlayheadMs(Math.round(clampNumber(ratio, 0, 1) * trimDurationMs))}
                    containerRef={waveformContainerRef}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <NumberField
                      label="Start (ms)"
                      value={trimStartMs}
                      max={Math.max(0, trimEndMs - 1)}
                      step={1}
                      onChange={(value) => setTrimStartMs(clampNumber(Math.round(value), 0, Math.max(0, trimEndMs - 1)))}
                      suffix="ms"
                    />
                    <NumberField
                      label="End (ms)"
                      value={trimEndMs}
                      max={trimDurationMs}
                      step={1}
                      onChange={(value) => setTrimEndMs(clampNumber(Math.round(value), trimStartMs + 1, trimDurationMs))}
                      suffix="ms"
                    />
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Zoom</label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.1"
                        value={trimZoom}
                        onChange={(event) => setTrimZoom(parseFloat(event.target.value))}
                        className="w-full accent-blue-600 mt-3"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleTrimSetStart}
                      className="h-11 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                    >
                      Set Start to Playhead
                    </button>
                    <button
                      type="button"
                      onClick={handleTrimSetEnd}
                      className="h-11 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                    >
                      Set End to Playhead
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <UploadCard
          title="Upload an Audio File"
          description="Choose a file and compress it with professional presets."
          accept={AUDIO_INPUT_ACCEPT}
          onChange={handleCompressUpload}
        />

        {compressFile && (
          <div className="bg-white/90 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{compressFile.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(compressFile.size)} · {formatDuration(compressDurationMs)}</p>
              </div>
              <button
                type="button"
                onClick={clearCurrentMode}
                className="h-10 px-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUALITY_PRESET_ORDER.map((quality) => (
                <button
                  key={quality}
                  type="button"
                  onClick={() => applyQualityPreset(quality)}
                  className={`h-11 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-all active:scale-95 ${
                    exportSettings.quality === quality
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                  }`}
                >
                  {getQualityLabel(quality)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatBox label="Original Size" value={formatBytes(compressFile.size)} />
              <StatBox label="Estimated Output" value={estimatedOutputSize ? formatBytes(estimatedOutputSize) : "Pending"} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950 shadow-2xl shadow-slate-200/40 dark:shadow-black/30 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 sm:px-6 md:px-8 py-6 sm:py-7">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] uppercase tracking-[0.2em] font-bold">
                <AudioLines className="w-3.5 h-3.5" />
                Audio Tools
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">Merge, trim, and compress audio with FFmpeg.</h2>
              <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-3xl">
                Professional audio workflows with reorderable merges, waveform-based trimming, and export controls for the most common delivery formats.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <StatBox label="Mode" value={MODE_TABS.find((item) => item.id === mode)?.label ?? "Audio"} inverse />
              <StatBox label="Source" value={sourceLabel} inverse />
              <StatBox label="Estimate" value={estimatedOutputSize ? formatBytes(estimatedOutputSize) : "Pending"} inverse />
              <StatBox label="State" value={status === "processing" ? "Processing" : status === "completed" ? "Ready" : "Idle"} inverse />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 md:p-6 lg:p-8 space-y-6">
          <div className="flex flex-wrap gap-2">
            {MODE_TABS.map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleModeSelect(item.id)}
                  className={`h-11 px-4 rounded-2xl border transition-all flex items-center gap-2 font-semibold text-sm active:scale-95 ${
                    active
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-7 space-y-6">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{MODE_TABS.find((item) => item.id === mode)?.label}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{getModeTitle(mode)}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    <Settings2 className="w-4 h-4 text-blue-600" />
                    {loaded ? "FFmpeg Ready" : "Loading FFmpeg"}
                  </div>
                </div>

                <div className="mt-5">{renderSourcePanel()}</div>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">Preview</h3>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{previewProgressLabel}</div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sourceLabel}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{previewTimeLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePreviewToggle}
                        disabled={!canExport && mode === "merge" && mergeTracks.length === 0}
                        className="h-11 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95 flex items-center gap-2"
                      >
                        {previewBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={handlePreviewPause}
                        className="h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const audio = audioRef.current;
                          if (!audio) return;
                          audio.pause();
                          audio.currentTime = 0;
                          setPlayheadMs(0);
                          setPreviewBusy(false);
                          if (mode === "trim") {
                            audio.currentTime = trimStartMs / 1000;
                            setPlayheadMs(trimStartMs);
                          }
                        }}
                        className="h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reset
                      </button>
                    </div>
                  </div>

                  <audio
                    ref={audioRef}
                    className="mt-4 w-full"
                    controls
                    onTimeUpdate={handlePreviewTimeUpdate}
                    onPlay={() => setPreviewBusy(true)}
                    onPause={() => setPreviewBusy(false)}
                  />

                  {mode === "trim" && trimMode === "precise" && trimWaveform.length > 0 && (
                    <div className="mt-4">
                      <div
                        ref={waveformContainerRef}
                        className="relative overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-4"
                      >
                        <WaveformBars
                          peaks={trimWaveform}
                          durationMs={trimDurationMs}
                          playheadMs={playheadMs}
                          trimStartMs={trimStartMs}
                          trimEndMs={trimEndMs}
                          zoom={trimZoom}
                          onSeek={(ms) => {
                            const audio = audioRef.current;
                            if (audio && trimFile) {
                              audio.currentTime = ms / 1000;
                              setPlayheadMs(ms);
                            }
                          }}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Playhead</label>
                          <input
                            type="range"
                            min="0"
                            max={trimDurationMs}
                            step="1"
                            value={playheadMs}
                            onChange={(event) => {
                              const next = parseInt(event.target.value, 10);
                              setPlayheadMs(next);
                              const audio = audioRef.current;
                              if (audio) {
                                audio.currentTime = next / 1000;
                              }
                            }}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Start</label>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, trimEndMs - 1)}
                            step="1"
                            value={trimStartMs}
                            onChange={(event) => setTrimStartMs(parseInt(event.target.value, 10))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">End</label>
                          <input
                            type="range"
                            min={trimStartMs + 1}
                            max={trimDurationMs}
                            step="1"
                            value={trimEndMs}
                            onChange={(event) => setTrimEndMs(parseInt(event.target.value, 10))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 space-y-6">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">Export Settings</h3>
                </div>

                <div className="space-y-4">
                  <TextField
                    label="File Name"
                    value={exportSettings.fileName}
                    onChange={(value) => handleExportSettingChange("fileName", value)}
                    placeholder={getModeDefaultFileName(mode)}
                  />

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Output Format</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {FORMAT_OPTIONS.map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => handleExportSettingChange("format", format)}
                          className={`h-11 rounded-xl border transition-all text-xs font-bold uppercase tracking-widest active:scale-95 ${
                            exportSettings.format === format
                              ? "bg-blue-600 text-white border-blue-600 shadow-md"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                          }`}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Quality</label>
                    <div className="grid grid-cols-2 gap-2">
                      {QUALITY_PRESET_ORDER.map((quality) => (
                        <button
                          key={quality}
                          type="button"
                          onClick={() => applyQualityPreset(quality)}
                          className={`h-11 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest active:scale-95 ${
                            exportSettings.quality === quality
                              ? "bg-blue-600 text-white border-blue-600 shadow-md"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                          }`}
                        >
                          {getQualityLabel(quality)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label="Bitrate"
                      value={exportSettings.bitrateKbps}
                      max={512}
                      step={1}
                      onChange={(value) => handleExportSettingChange("bitrateKbps", clampNumber(Math.round(value), 32, 512))}
                      suffix="kbps"
                    />
                    <NumberField
                      label="Sample Rate"
                      value={exportSettings.sampleRate}
                      max={96000}
                      step={100}
                      onChange={(value) => handleExportSettingChange("sampleRate", clampNumber(Math.round(value), 8000, 96000))}
                      suffix="Hz"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Channels</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHANNEL_OPTIONS.map((channel) => (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => handleExportSettingChange("channels", channel)}
                          className={`h-11 rounded-xl border transition-all text-xs font-bold uppercase tracking-widest active:scale-95 ${
                            exportSettings.channels === channel
                              ? "bg-blue-600 text-white border-blue-600 shadow-md"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                          }`}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <StatBox label="Original Size" value={formatBytes(currentSourceSize)} />
                    <StatBox label="Estimated Output" value={estimatedOutputSize ? formatBytes(estimatedOutputSize) : "Pending"} />
                    <StatBox label="Final Output" value={outputSize ? formatBytes(outputSize) : "Pending"} />
                    <StatBox label="Compression" value={compressionPercentage === null ? "Pending" : `${compressionPercentage}%`} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Processing Summary</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{processingSummary}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Supported Formats</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">MP3, WAV, M4A, AAC, OGG, FLAC</p>
                  </div>

                  {errorMessage && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed">{errorMessage}</p>
                    </div>
                  )}

                  {status === "processing" && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-blue-700">
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-blue-500 to-blue-700" animate={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canExport}
                    onClick={() => void processAudio(true)}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-xs uppercase tracking-[0.15em] shadow-lg shadow-blue-200 dark:shadow-blue-900/30 hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Audio
                  </button>

                  {outputUrl && status === "completed" && (
                    <a
                      href={outputUrl}
                      download={buildAudioOutputFileName(exportSettings.fileName, exportSettings.format)}
                      className="w-full h-12 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      Download Latest Export
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadCard({
  title,
  description,
  accept,
  multiple = false,
  onChange,
  onDrop,
}: {
  title: string;
  description: string;
  accept: string;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        onDrop?.(event);
      }}
      className={`group relative rounded-3xl border-2 border-dashed p-5 sm:p-6 transition-all bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 ${
        dragActive ? "border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/30" : "border-slate-300 dark:border-slate-800"
      }`}
    >
      <div className="flex flex-col items-center justify-center text-center gap-3 min-h-[180px]">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800">
          <Upload className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-md">{description}</p>
        </div>
        <label className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-widest cursor-pointer hover:bg-blue-700 transition-all active:scale-95">
          Browse Files
          <input type="file" accept={accept} multiple={multiple} className="hidden" onChange={onChange} />
        </label>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">MP3 · WAV · M4A · AAC · OGG · FLAC</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, inverse = false }: { label: string; value: string; inverse?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${inverse ? "border-white/10 bg-white/5" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${inverse ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>{label}</p>
      <p className={`mt-1 text-sm font-semibold ${inverse ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={0}
          max={max}
          step={step}
          onChange={(event) => onChange(parseFloat(event.target.value))}
          className="w-full h-11 bg-transparent outline-none text-sm text-slate-900 dark:text-slate-100"
        />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 shrink-0">{suffix}</span>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof FileAudio2; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 text-center">
      <Icon className="w-9 h-9 text-slate-300 mx-auto" />
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

function WaveformViewer({
  peaks,
  durationMs,
  playheadMs,
  trimStartMs,
  trimEndMs,
  zoom,
  onSeek,
  onSeekRatio,
  containerRef,
}: {
  peaks: number[];
  durationMs: number;
  playheadMs: number;
  trimStartMs: number;
  trimEndMs: number;
  zoom: number;
  onSeek: (ms: number) => void;
  onSeekRatio: (ratio: number) => void;
  containerRef: RefObject<HTMLDivElement>;
}) {
  if (peaks.length === 0) {
    return <EmptyState icon={Waves} text="Waveform is loading..." />;
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 px-2 py-4"
        onClick={(event) => {
          const element = event.currentTarget;
          const rect = element.getBoundingClientRect();
          const offsetX = event.clientX - rect.left + element.scrollLeft;
          const totalWidth = peaks.length * Math.max(2, zoom * 2);
          const ratio = totalWidth <= 0 ? 0 : clampNumber(offsetX / totalWidth, 0, 1);
          const nextMs = Math.round(ratio * durationMs);
          onSeek(nextMs);
          onSeekRatio(ratio);
        }}
      >
        <div className="relative" style={{ width: `${peaks.length * Math.max(2, zoom * 2)}px`, height: "140px" }}>
          <WaveformBars
            peaks={peaks}
            durationMs={durationMs}
            playheadMs={playheadMs}
            trimStartMs={trimStartMs}
            trimEndMs={trimEndMs}
            zoom={zoom}
            onSeek={onSeek}
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <span>{formatDuration(trimStartMs)}</span>
        <span>{formatDuration(playheadMs)}</span>
        <span>{formatDuration(trimEndMs)}</span>
      </div>
    </div>
  );
}

function WaveformBars({
  peaks,
  durationMs,
  playheadMs,
  trimStartMs,
  trimEndMs,
  zoom,
  onSeek,
}: {
  peaks: number[];
  durationMs: number;
  playheadMs: number;
  trimStartMs: number;
  trimEndMs: number;
  zoom: number;
  onSeek: (ms: number) => void;
}) {
  const barWidth = Math.max(2, zoom * 2);
  const totalWidth = peaks.length * barWidth;

  return (
    <div className="relative" style={{ width: `${totalWidth}px`, height: "140px" }}>
      <div className="absolute inset-y-0 left-0 right-0 flex items-center">
        {peaks.map((peak, index) => {
          const height = Math.max(8, peak * 120);
          return (
            <button
              key={`${index}-${peak}`}
              type="button"
              onClick={() => onSeek(Math.round((index / peaks.length) * durationMs))}
              className="relative flex items-center justify-center"
              style={{ width: `${barWidth}px`, height: "140px" }}
            >
              <span
                className="block rounded-full bg-gradient-to-b from-blue-500 to-blue-700"
                style={{
                  width: `${Math.max(1.5, barWidth * 0.7)}px`,
                  height: `${height}px`,
                  opacity: 0.85,
                }}
              />
            </button>
          );
        })}
      </div>

      <div
        className="absolute inset-y-0 bg-emerald-500/10 border-x border-emerald-400/50 pointer-events-none"
        style={{
          left: `${(trimStartMs / Math.max(durationMs, 1)) * 100}%`,
          width: `${((trimEndMs - trimStartMs) / Math.max(durationMs, 1)) * 100}%`,
        }}
      />

      <div
        className="absolute inset-y-0 w-px bg-white shadow-[0_0_0_4px_rgba(59,130,246,0.35)] pointer-events-none"
        style={{ left: `${(playheadMs / Math.max(durationMs, 1)) * 100}%` }}
      />
    </div>
  );
}
