import type { CompressionPreset, VideoMetadata, VideoScale } from "../types";

export function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const kilobyte = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const sizeIndex = Math.floor(Math.log(bytes) / Math.log(kilobyte));
  return `${parseFloat((bytes / Math.pow(kilobyte, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
}

interface EstimateCompressionSizeArgs {
  videoSize: number;
  videoMetadata: VideoMetadata | null;
  crf: number;
  scale: VideoScale;
  preset: CompressionPreset;
}

export function estimateCompressedSize({
  videoSize,
  videoMetadata,
  crf,
  scale,
  preset,
}: EstimateCompressionSizeArgs) {
  if (!videoMetadata) return null;

  const { duration, width, height } = videoMetadata;
  const baseBitrate = 4000000;
  let targetWidth = width;
  let targetHeight = height;

  if (scale === "720p" && height > 720) {
    targetHeight = 720;
    targetWidth = (width * 720) / height;
  } else if (scale === "480p" && height > 480) {
    targetHeight = 480;
    targetWidth = (width * 480) / height;
  }

  const resolutionFactor = (targetWidth * targetHeight) / (1920 * 1080);
  const crfFactor = Math.pow(2, (23 - crf) / 6);
  const presetMultipliers: Record<CompressionPreset, number> = {
    ultrafast: 1.35,
    superfast: 1.25,
    veryfast: 1.15,
    fast: 1.05,
  };
  const presetFactor = presetMultipliers[preset];
  const audioBitrate = 128000;
  const estimatedBitrate = baseBitrate * resolutionFactor * crfFactor * presetFactor;
  const totalBytes = ((estimatedBitrate + audioBitrate) * duration) / 8;

  return Math.min(totalBytes, videoSize * 0.95);
}
