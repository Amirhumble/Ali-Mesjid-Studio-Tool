import { useTranslation } from "react-i18next";
import { Download, Film, Mic, Trash2, X, Clock } from "lucide-react";
import type { CompressionHistory, TranscriptionHistory } from "../types";
import { formatSize } from "../utils/compression";

interface HistoryModalProps {
  logoSrc: string;
  compressionHistory: CompressionHistory[];
  transcriptionHistory: TranscriptionHistory[];
  onClose: () => void;
  onDeleteCompression: (id: string) => void;
  onDeleteTranscription: (id: string) => void;
  onClearAll: () => void;
}

export default function HistoryModal({
  logoSrc,
  compressionHistory,
  transcriptionHistory,
  onClose,
  onDeleteCompression,
  onDeleteTranscription,
  onClearAll,
}: HistoryModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-4 lg:p-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] md:max-h-[85vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5 sm:mb-6 md:mb-8 gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
            <img src={logoSrc} alt={t("app.logo_alt")} className="w-8 sm:w-9 md:w-10 h-8 sm:h-9 md:h-10 rounded-lg shadow-md object-cover flex-shrink-0" />
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 truncate">{t("history.title")}</h2>
          </div>
          <button onClick={onClose} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-all flex-shrink-0 active:scale-95 touch-manipulation">
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
          </button>
        </div>

        {compressionHistory.length === 0 && transcriptionHistory.length === 0 ? (
          <div className="text-center py-8 sm:py-10 md:py-12 lg:py-16">
            <Clock className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 text-slate-300 mx-auto mb-3 sm:mb-4 md:mb-5" />
            <p className="text-base sm:text-lg md:text-xl text-slate-500 font-medium">{t("history.no_history")}</p>
          </div>
        ) : (
          <>
            {compressionHistory.length > 0 && (
              <div className="mb-6 sm:mb-7 md:mb-8 lg:mb-10">
                <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 flex items-center gap-2 text-slate-900">
                  <Film className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-blue-600 flex-shrink-0" />
                  {t("history.compression_history")}
                </h3>
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  {compressionHistory.map((item) => (
                    <div key={item.id} className="bg-gradient-to-r from-blue-50 to-slate-50 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl md:rounded-2xl border border-blue-100 hover:border-blue-300 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base md:text-lg text-slate-900 truncate">{item.fileName}</p>
                          <p className="text-xs sm:text-sm text-slate-600 mt-1 md:mt-2">
                            {formatSize(item.originalSize)} {"->"} {formatSize(item.compressedSize)} <span className="text-green-600 font-semibold ml-2">({item.compression}% {t("history.saved")})</span>
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <a href={item.downloadUrl} download={`shrunken_${item.fileName}`} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95 touch-manipulation">
                            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                          </a>
                          <button onClick={() => onDeleteCompression(item.id)} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all active:scale-95 touch-manipulation">
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transcriptionHistory.length > 0 && (
              <div className="mb-6">
                <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 flex items-center gap-2 text-slate-900">
                  <Mic className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-blue-600 flex-shrink-0" />
                  {t("history.transcription_history")}
                </h3>
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  {transcriptionHistory.map((item) => (
                    <div key={item.id} className="bg-gradient-to-r from-purple-50 to-slate-50 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl md:rounded-2xl border border-purple-100 hover:border-purple-300 transition-all">
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base md:text-lg text-slate-900 truncate">{item.fileName}</p>
                        </div>
                        <button onClick={() => onDeleteTranscription(item.id)} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all flex-shrink-0 active:scale-95 touch-manipulation">
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 p-3 bg-white rounded-lg max-h-[140px] overflow-y-auto border border-slate-200">{item.transcription}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={onClearAll} className="w-full mt-6 h-11 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition-all text-xs uppercase tracking-wider active:scale-95 touch-manipulation">
              {t("history.clear_all")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
