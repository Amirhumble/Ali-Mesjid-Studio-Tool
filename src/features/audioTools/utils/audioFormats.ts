import type { AudioChannels, AudioOutputFormat, AudioQualityPreset } from "../types";

export const AUDIO_INPUT_ACCEPT = ".mp3,.wav,.wave,.m4a,.aac,.ogg,.oga,.flac,.mp4,.webm,audio/*";

export const AUDIO_FILE_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "wave",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "mp4",
  "webm",
]);

const QUALITY_BITRATES: Record<AudioQualityPreset, number> = {
  original: 320,
  high: 256,
  balanced: 192,
  small: 128,
};

export function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

export function isSupportedAudioFile(file: File) {
  if (file.type.startsWith("audio/")) return true;
  const extension = getFileExtension(file.name);
  return AUDIO_FILE_EXTENSIONS.has(extension);
}

export function getOutputExtension(format: AudioOutputFormat) {
  return format;
}

export function getOutputMimeType(format: AudioOutputFormat) {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
  }
}

export function getPreferredCodec(format: AudioOutputFormat) {
  switch (format) {
    case "mp3":
      return "libmp3lame";
    case "wav":
      return "pcm_s16le";
    case "m4a":
      return "aac";
    case "aac":
      return "aac";
    case "ogg":
      return "libvorbis";
    case "flac":
      return "flac";
  }
}

export function getPresetBitrate(quality: AudioQualityPreset) {
  return QUALITY_BITRATES[quality];
}

export function getDefaultSampleRate(format: AudioOutputFormat, sourceSampleRate = 44100) {
  if (format === "wav" || format === "flac") return sourceSampleRate;
  return 44100;
}

export function getDefaultChannels(channels: AudioChannels, sourceChannels = 2) {
  if (channels === "source") return sourceChannels >= 2 ? "stereo" : "mono";
  return channels;
}

export function formatDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const milliseconds = safeMs % 1000;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export function formatCompactDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const seconds = safeMs / 1000;
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}m ${remainder}s`;
  }
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 ? 0 : 2)} ${units[index]}`;
}

export function estimateAudioOutputSizeBytes({
  durationMs,
  format,
  quality,
  bitrateKbps,
  sampleRate,
  channels,
}: {
  durationMs: number;
  format: AudioOutputFormat;
  quality: AudioQualityPreset;
  bitrateKbps: number;
  sampleRate: number;
  channels: AudioChannels;
}) {
  const durationSeconds = Math.max(0, durationMs / 1000);
  const channelCount = channels === "mono" ? 1 : 2;

  if (format === "wav") {
    const wavBitDepth = 16;
    return Math.round(durationSeconds * sampleRate * channelCount * (wavBitDepth / 8) + 44);
  }

  if (format === "flac") {
    const pcmBytes = durationSeconds * sampleRate * channelCount * 2;
    const compressionFactor = quality === "original" ? 0.55 : quality === "high" ? 0.5 : quality === "balanced" ? 0.45 : 0.38;
    return Math.round(pcmBytes * compressionFactor);
  }

  const effectiveBitrate = Math.max(48, bitrateKbps);
  const bitrateBytes = (effectiveBitrate * 1000 * durationSeconds) / 8;
  const formatFactor = format === "ogg" ? 0.97 : format === "aac" || format === "m4a" ? 1.0 : 0.95;
  return Math.round(bitrateBytes * formatFactor + 4096);
}

export function buildAudioOutputFileName(baseName: string, format: AudioOutputFormat) {
  const safeBaseName = baseName.trim().replace(/\.[^.]+$/, "") || "audio-export";
  return `${safeBaseName}.${getOutputExtension(format)}`;
}

export function getAudioChannelCount(channels: AudioChannels, sourceChannelCount = 2) {
  if (channels === "mono") return 1;
  if (channels === "stereo") return 2;
  return sourceChannelCount >= 2 ? 2 : 1;
}

export function getQualityLabel(quality: AudioQualityPreset) {
  switch (quality) {
    case "original":
      return "Original Quality";
    case "high":
      return "High Quality";
    case "balanced":
      return "Balanced";
    case "small":
      return "Small Size";
  }
}

