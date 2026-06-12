export type CompressionStatus = "idle" | "loading" | "compressing" | "completed" | "error";
export type TranscriptionStatus = "idle" | "uploading" | "transcribing" | "completed" | "error";
export type AppTab = "compressor" | "transcribe" | "subtitleStudio";
export type VideoScale = "original" | "720p" | "480p";
export type CompressionPreset = "ultrafast" | "superfast" | "veryfast" | "fast";

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

export interface CompressionHistory {
  id: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  compression: number;
  timestamp: number;
  downloadUrl: string;
}

export interface TranscriptionHistory {
  id: string;
  fileName: string;
  transcription: string;
  timestamp: number;
}

export const STUDIO_TABS: AppTab[] = ["compressor", "transcribe", "subtitleStudio"];
