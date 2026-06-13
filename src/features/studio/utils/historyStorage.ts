import type { CompressionHistory, TranscriptionHistory } from "../types";

const COMPRESSION_HISTORY_KEY = "compressionHistory";
const TRANSCRIPTION_HISTORY_KEY = "transcriptionHistory";
const HISTORY_LIMIT = 20;

function readHistory<T>(storageKey: string): T[] {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Error reading ${storageKey}:`, error);
    return [];
  }
}

function writeHistory<T>(storageKey: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function loadCompressionHistory() {
  return readHistory<CompressionHistory>(COMPRESSION_HISTORY_KEY);
}

export function loadTranscriptionHistory() {
  return readHistory<TranscriptionHistory>(TRANSCRIPTION_HISTORY_KEY);
}

export function createCompressionHistoryEntry(
  fileName: string,
  originalSize: number,
  compressedSize: number,
  downloadUrl: string,
): CompressionHistory {
  return {
    id: Date.now().toString(),
    fileName,
    originalSize,
    compressedSize,
    compression: originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0,
    timestamp: Date.now(),
    downloadUrl,
  };
}

export function createTranscriptionHistoryEntry(fileName: string, transcription: string): TranscriptionHistory {
  return {
    id: Date.now().toString(),
    fileName,
    transcription,
    timestamp: Date.now(),
  };
}

export function addCompressionHistoryEntry(
  history: CompressionHistory[],
  entry: CompressionHistory,
) {
  const updatedHistory = [entry, ...history].slice(0, HISTORY_LIMIT);
  writeHistory(COMPRESSION_HISTORY_KEY, updatedHistory);
  return updatedHistory;
}

export function addTranscriptionHistoryEntry(
  history: TranscriptionHistory[],
  entry: TranscriptionHistory,
) {
  const updatedHistory = [entry, ...history].slice(0, HISTORY_LIMIT);
  writeHistory(TRANSCRIPTION_HISTORY_KEY, updatedHistory);
  return updatedHistory;
}

export function deleteCompressionHistoryItem(history: CompressionHistory[], id: string) {
  const updatedHistory = history.filter((item) => item.id !== id);
  writeHistory(COMPRESSION_HISTORY_KEY, updatedHistory);
  return updatedHistory;
}

export function deleteTranscriptionHistoryItem(history: TranscriptionHistory[], id: string) {
  const updatedHistory = history.filter((item) => item.id !== id);
  writeHistory(TRANSCRIPTION_HISTORY_KEY, updatedHistory);
  return updatedHistory;
}

export function clearStudioHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COMPRESSION_HISTORY_KEY);
  window.localStorage.removeItem(TRANSCRIPTION_HISTORY_KEY);
}
