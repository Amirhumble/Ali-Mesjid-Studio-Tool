export interface Caption {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  original: string;
  amharic: string;
}

export type CaptionDisplayMode = "amharic" | "original" | "dual";

export interface CaptionStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  bgColor: string;
  bgType: "none" | "solid";
  bgOpacity: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset: number; // 0-100 (percentage from top or bottom?) - actually currently it's from bottom.
  horizontalOffset: number; // 0-100 (percentage from center)
  fontWeight: "normal" | "bold" | "semibold" | "900";
  lineHeight: number;
  letterSpacing: number;
  align: "left" | "center" | "right";
  padding: number;
  borderRadius: number;
  maxWidth: number; // 0-100 percentage of canvas width
}

export interface SampleVideo {
  id: string;
  title: string;
  url: string;
  category: string;
  durationText: string;
  speechAudioUrl?: string;
  defaultCaptions: Caption[];
}
