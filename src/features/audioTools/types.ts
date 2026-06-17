export type AudioToolsMode = "merge" | "trim" | "compress";
export type TrimMode = "simple" | "precise";
export type AudioOutputFormat = "mp3" | "wav" | "m4a" | "aac" | "ogg" | "flac";
export type AudioChannels = "source" | "mono" | "stereo";
export type AudioQualityPreset = "original" | "high" | "balanced" | "small";

export interface AudioTrackItem {
  id: string;
  file: File;
  url: string;
  durationMs: number | null;
}

export interface AudioExportSettings {
  fileName: string;
  format: AudioOutputFormat;
  quality: AudioQualityPreset;
  bitrateKbps: number;
  sampleRate: number;
  channels: AudioChannels;
}

export interface AudioExportSummary {
  title: string;
  description: string;
  sourceLabel: string;
}
