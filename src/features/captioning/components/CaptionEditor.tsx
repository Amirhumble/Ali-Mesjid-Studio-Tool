import { useState } from "react";
import { Caption } from "../types";
import { Plus, Trash2, Search, Play, Clock, Check, AlertCircle, FileText } from "lucide-react";
import { formatVideoTime } from "../utils/subtitleHelper";

interface CaptionEditorProps {
  captions: Caption[];
  onUpdateCaptions: (captions: Caption[]) => void;
  activeId: number | null;
  currentTime: number;
  onSeek: (time: number) => void;
}

export default function CaptionEditor({
  captions,
  onUpdateCaptions,
  activeId,
  currentTime,
  onSeek,
}: CaptionEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleTextChange = (id: number, field: "original" | "amharic" | "english", newText: string) => {
    onUpdateCaptions(
      captions.map((c) => (c.id === id ? { ...c, [field]: newText } : c))
    );
  };

  const handleTimeChange = (id: number, field: "start" | "end", value: number) => {
    const formattedVal = Math.max(0, parseFloat(value.toFixed(2)) || 0);
    onUpdateCaptions(
      captions.map((c) => {
        if (c.id === id) {
          const updated = { ...c, [field]: formattedVal };
          if (field === "start" && updated.start > updated.end) {
            updated.end = updated.start + 1;
          } else if (field === "end" && updated.end < updated.start) {
            updated.start = Math.max(0, updated.end - 1);
          }
          return updated;
        }
        return c;
      })
    );
  };

  const handleAdjustByOffset = (id: number, field: "start" | "end", amount: number) => {
    const cap = captions.find((c) => c.id === id);
    if (!cap) return;
    const currentVal = cap[field];
    handleTimeChange(id, field, currentVal + amount);
  };

  const handleAddCaption = () => {
    const baseStart = parseFloat(currentTime.toFixed(2));
    const baseEnd = parseFloat((currentTime + 2.5).toFixed(2));
    const newId = captions.length > 0 ? Math.max(...captions.map((c) => c.id)) + 1 : 1;
    const newCaption: Caption = {
      id: newId,
      start: baseStart,
      end: baseEnd,
      original: "New caption track",
      amharic: "አዲስ የትርጉም ጽሑፍ",
      english: "New English translation",
    };
    const updated = [...captions, newCaption].sort((a, b) => a.start - b.start);
    onUpdateCaptions(updated);
  };

  const handleDeleteCaption = (id: number) => {
    onUpdateCaptions(captions.filter((c) => c.id !== id));
  };

  const handleSortCaptions = () => {
    const sorted = [...captions].sort((a, b) => a.start - b.start);
    onUpdateCaptions(sorted);
  };

  const filteredCaptions = captions.filter(
    (c) =>
      c.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.amharic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="caption-editor-root" className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-blue-100 text-blue-700">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800">Caption Tracklist</h3>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
              {captions.length}
            </span>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              id="sort-captions-btn"
              onClick={handleSortCaptions}
              title="Sort captions chronologically by start time"
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all"
            >
              Autosort
            </button>
            <button
              type="button"
              id="create-caption-btn"
              onClick={handleAddCaption}
              className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg hover:shadow-md shadow-sm transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Segment
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search transcript or Amharic text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
        {filteredCaptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-500">No captions found</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
              {searchQuery ? "Try clearing search filter" : "Generate subtitles using AI or create one manually!"}
            </p>
          </div>
        ) : (
          filteredCaptions.map((caption) => {
            const isActive = activeId === caption.id;
            return (
              <div
                key={caption.id}
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50/70 border-blue-200 shadow-sm"
                    : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSeek(caption.start)}
                      className="p-1 rounded bg-slate-200/60 text-slate-700 hover:bg-blue-600 hover:text-white transition-colors"
                      title="Jump to video sequence"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">#{caption.id}</span>
                    {isActive && (
                      <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/70 py-0.5 px-2 rounded-full flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Now playing
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg overflow-hidden bg-white px-1">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-mono">In:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={caption.start}
                        onChange={(e) => handleTimeChange(caption.id, "start", parseFloat(e.target.value) || 0)}
                        className="w-11 text-[10px] font-semibold text-slate-700 text-center focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdjustByOffset(caption.id, "start", -0.1)}
                        className="px-0.5 text-[8px] text-slate-400 hover:text-slate-600 font-bold bg-slate-50 rounded"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustByOffset(caption.id, "start", 0.1)}
                        className="px-0.5 text-[8px] text-slate-400 hover:text-slate-600 font-bold bg-slate-50 rounded"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg overflow-hidden bg-white px-1">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-mono">Out:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={caption.end}
                        onChange={(e) => handleTimeChange(caption.id, "end", parseFloat(e.target.value) || 0)}
                        className="w-11 text-[10px] font-semibold text-slate-700 text-center focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdjustByOffset(caption.id, "end", -0.1)}
                        className="px-0.5 text-[8px] text-slate-400 hover:text-slate-600 font-bold bg-slate-50 rounded"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustByOffset(caption.id, "end", 0.1)}
                        className="px-0.5 text-[8px] text-slate-400 hover:text-slate-600 font-bold bg-slate-50 rounded"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCaption(caption.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
                      title="Delete subtitle sequence"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Original Spoken Text</span>
                    </div>
                    <textarea
                      value={caption.original}
                      onChange={(e) => handleTextChange(caption.id, "original", e.target.value)}
                      placeholder="Enter transcript..."
                      className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amharic Translation</span>
                    </div>
                    <textarea
                      value={caption.amharic}
                      onChange={(e) => handleTextChange(caption.id, "amharic", e.target.value)}
                      placeholder="የትርጉም ጽሑፍ እዚህ ይግባ..."
                      className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">English Translation</span>
                      <span className="text-[9px] text-slate-400 font-mono">{formatVideoTime(caption.start)} - {formatVideoTime(caption.end)}</span>
                    </div>
                    <textarea
                      value={caption.english}
                      onChange={(e) => handleTextChange(caption.id, "english", e.target.value)}
                      placeholder="Enter English translation..."
                      className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
