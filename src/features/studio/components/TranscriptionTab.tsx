import { type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Copy, FileAudio, MessageSquare, RefreshCw, Type } from "lucide-react";
import type { TranscriptionStatus } from "../types";

interface TranscriptionTabProps {
  audioFile: File | null;
  transcriptionStatus: TranscriptionStatus;
  transcriptionResult: string | null;
  transcribeError: string | null;
  onAudioChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onTranscribe: () => void;
  onCancel: () => void;
  onCopy: () => void;
  onReset: () => void;
}

export default function TranscriptionTab({
  audioFile,
  transcriptionStatus,
  transcriptionResult,
  transcribeError,
  onAudioChange,
  onTranscribe,
  onCancel,
  onCopy,
  onReset,
}: TranscriptionTabProps) {
  const { t } = useTranslation();
  const isTranscribing = transcriptionStatus === "transcribing";

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200 min-h-[400px] flex flex-col">
        {!transcriptionResult && transcriptionStatus !== "transcribing" ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <label className="group relative flex flex-col items-center justify-center w-full max-w-2xl aspect-21/9 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 min-h-[200px]">
              <FileAudio className="w-10 h-10 mb-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <p className="text-base font-medium text-slate-700 px-4 text-center">{t("transcriber.select_file")}</p>
              <input type="file" className="hidden" accept="audio/*" onChange={onAudioChange} />
            </label>
            {audioFile && (
              <div className="flex gap-3 mt-8 w-full max-w-2xl">
                <button
                  onClick={onTranscribe}
                  disabled={isTranscribing}
                  className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50 active:scale-95 text-sm touch-manipulation"
                >
                  <MessageSquare className="w-4 h-4" />
                  {isTranscribing ? t("transcriber.transcribing") : t("transcriber.transcribe_ai")}
                </button>
              </div>
            )}
          </div>
        ) : transcriptionStatus === "transcribing" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-6" />
            <h2 className="text-2xl font-semibold mb-2 text-slate-900">{t("transcriber.gemini_listening")}</h2>
            <button onClick={onCancel} className="mt-6 h-11 px-8 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all active:scale-95 text-sm touch-manipulation">
              {t("transcriber.cancel")}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Type className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">{t("transcriber.result")}</h3>
                  <p className="text-sm font-bold text-slate-900 truncate">{audioFile?.name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onCopy} className="h-11 px-4 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 active:scale-95 touch-manipulation">
                  <Copy className="w-4 h-4" />
                  <span>{t("transcriber.copy")}</span>
                </button>
                <button onClick={onReset} className="h-11 px-4 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 active:scale-95 touch-manipulation">
                  New
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-6 overflow-y-auto border border-slate-200">
              <div className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap font-serif italic">{transcriptionResult}</div>
            </div>
          </div>
        )}

        {transcriptionStatus === "error" && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200 text-red-700 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-1">{t("transcriber.error_title")}</p>
              <p className="text-xs sm:text-sm leading-relaxed font-mono">{transcribeError}</p>
              <button onClick={onTranscribe} className="mt-3 text-xs font-bold underline hover:no-underline uppercase tracking-[0.2em] active:scale-95 touch-manipulation">
                {t("transcriber.retry")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
