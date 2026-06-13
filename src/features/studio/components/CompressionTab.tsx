import { useMemo, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Download, Film, Play, RefreshCw, Settings2, Upload, Video } from "lucide-react";
import { motion } from "motion/react";
import type { CompressionPreset, CompressionStatus, VideoMetadata, VideoScale } from "../types";
import { estimateCompressedSize, formatSize } from "../utils/compression";

interface CompressionTabProps {
  video: File | null;
  videoPreviewUrl: string | null;
  loaded: boolean;
  status: CompressionStatus;
  progress: number;
  outputUrl: string | null;
  compressedSize: number | null;
  errorMessage: string | null;
  crf: number;
  scale: VideoScale;
  preset: CompressionPreset;
  videoMetadata: VideoMetadata | null;
  onVideoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearVideo: () => void;
  onVideoLoadedMetadata: (metadata: VideoMetadata) => void;
  onCrfChange: (value: number) => void;
  onScaleChange: (value: VideoScale) => void;
  onPresetChange: (value: CompressionPreset) => void;
  onCompress: () => void;
}

export default function CompressionTab({
  video,
  videoPreviewUrl,
  loaded,
  status,
  progress,
  outputUrl,
  compressedSize,
  errorMessage,
  crf,
  scale,
  preset,
  videoMetadata,
  onVideoChange,
  onClearVideo,
  onVideoLoadedMetadata,
  onCrfChange,
  onScaleChange,
  onPresetChange,
  onCompress,
}: CompressionTabProps) {
  const { t } = useTranslation();

  const estimatedSize = useMemo(
    () => estimateCompressedSize({ videoSize: video?.size ?? 0, videoMetadata, crf, scale, preset }),
    [video?.size, videoMetadata, crf, scale, preset],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
      <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 md:gap-6">
        {!video ? (
          <label className="group relative flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-slate-300 rounded-lg sm:rounded-xl md:rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 min-h-[200px] sm:min-h-[240px] md:min-h-[280px]">
            <div className="absolute inset-0 bg-[radial-gradient(#0f172a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.02]" />
            <Upload className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 mb-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <p className="text-base sm:text-lg md:text-xl font-medium text-slate-700 px-4 text-center">{t("compressor.drop_file")}</p>
            <input type="file" className="hidden" accept="video/*" onChange={onVideoChange} />
          </label>
        ) : (
          <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Film className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <h3 className="text-xs sm:text-sm md:text-base font-bold truncate text-slate-700">{video.name}</h3>
              </div>
              <button onClick={onClearVideo} className="text-xs uppercase font-bold tracking-widest text-slate-500 hover:text-red-600 transition-all flex-shrink-0 h-11 px-3 flex items-center justify-center hover:bg-red-50 rounded-lg active:scale-95 touch-manipulation">
                {t("compressor.clear")}
              </button>
            </div>
            <div className="relative aspect-video rounded-lg sm:rounded-xl md:rounded-2xl bg-slate-900 overflow-hidden">
              <video
                src={videoPreviewUrl ?? undefined}
                className="w-full h-full object-contain"
                controls
                onLoadedMetadata={(event) => {
                  const element = event.currentTarget;
                  onVideoLoadedMetadata({
                    duration: element.duration,
                    width: element.videoWidth,
                    height: element.videoHeight,
                  });
                }}
              />
              {status === "compressing" && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6">
                  <div className="w-full max-w-xs">
                    <div className="flex justify-between mb-2 text-slate-300 text-xs font-mono tracking-widest uppercase">
                      <span>{t("compressor.compressing")}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-blue-500 to-blue-600" animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5 md:gap-6">
        <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <Settings2 className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{t("compressor.settings")}</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs sm:text-sm font-medium block mb-3 text-slate-700">{t("compressor.target_quality")}</label>
              <input
                type="range"
                min="18"
                max="35"
                value={crf}
                onChange={(event) => onCrfChange(parseInt(event.target.value))}
                className="w-full accent-blue-600 h-2 cursor-pointer"
              />
              <div className="flex justify-between mt-2 text-xs text-slate-500 uppercase tracking-tighter">
                <span>{t("compressor.source")}</span>
                <span>{t("compressor.lite")}</span>
              </div>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium block mb-3 text-slate-700">{t("compressor.compression_speed")}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["ultrafast", "superfast", "veryfast", "fast"] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => onPresetChange(speed)}
                    className={`h-11 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 touch-manipulation ${
                      preset === speed ? "bg-blue-600 text-white border-blue-600 shadow-md" : "border-slate-300 text-slate-700 hover:border-blue-400"
                    }`}
                  >
                    {speed}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium block mb-3 text-slate-700">{t("compressor.resolution")}</label>
              <div className="grid grid-cols-3 gap-2">
                {(["original", "720p", "480p"] as const).map((resolution) => (
                  <button
                    key={resolution}
                    onClick={() => onScaleChange(resolution)}
                    className={`h-11 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 touch-manipulation ${
                      scale === resolution ? "bg-blue-600 text-white border-blue-600 shadow-md" : "border-slate-300 text-slate-700 hover:border-blue-400"
                    }`}
                  >
                    {resolution}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">{errorMessage}</div>
              </div>
            )}

            <button
              disabled={!video || !loaded || status === "compressing"}
              onClick={onCompress}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-md active:scale-95 text-sm touch-manipulation"
            >
              {status === "compressing" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {status === "compressing" ? t("compressor.shrinking") : t("compressor.start_compression")}
            </button>
          </div>

          {video && status === "idle" && (
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
              <div className="flex items-center gap-2 mb-4">
                <Video className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{t("compressor.preview_title")}</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t("compressor.source_size")}</p>
                    <p className="text-sm font-bold text-slate-700">{formatSize(video.size)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t("compressor.est_output_size")}</p>
                    <p className="text-sm font-bold text-blue-600">~{estimatedSize ? formatSize(estimatedSize) : "..."}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {video && status === "completed" && outputUrl && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="bg-gradient-to-r from-blue-50 to-slate-50 p-4 rounded-lg space-y-4 mb-4 border border-slate-200">
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-mono tracking-widest">{t("compressor.actual_size")}</p>
                    <p className="text-sm font-bold text-slate-900">{formatSize(compressedSize!)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-mono tracking-widest">{t("compressor.savings")}</p>
                    <p className="text-sm font-bold text-green-600">{Math.round(((video.size - compressedSize!) / video.size) * 100)}%</p>
                  </div>
                </div>
              </div>
              <a href={outputUrl} download={`shrunken_${video.name}`} className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-green-800 transition-all shadow-md active:scale-95 text-sm touch-manipulation">
                <Download className="w-4 h-4" /> {t("compressor.download_mp4")}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
