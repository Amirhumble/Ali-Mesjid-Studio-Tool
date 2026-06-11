import { CaptionStyle, CaptionDisplayMode } from "../types";
import { Sparkles, Sliders, Palette, LayoutGrid, Type, Square, MoveHorizontal, MoveVertical, Layers, MousePointer2, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import ColorSelector from "./ColorSelector";

interface StylePanelProps {
  style: CaptionStyle;
  onChangeStyle: (style: CaptionStyle) => void;
  displayMode: CaptionDisplayMode;
  onChangeDisplayMode: (mode: CaptionDisplayMode) => void;
}

const COLOR_PRESETS = [
  "#FFFFFF", "#FBBF24", "#34D399", "#22D3EE", "#F472B6", "#FB923C",
  "#000000", "#1E293B", "#1E3A8A", "#064E3B", "#7F1D1D", "#4C1D95"
];

const FONT_FAMILIES = [
  { name: "Inter", value: '"Inter", sans-serif' },
  { name: "Noto Ethiopic", value: '"Noto Sans Ethiopic", sans-serif' },
  { name: "System", value: 'system-ui, sans-serif' },
  { name: "Monospace", value: 'monospace' },
];

export default function StylePanel({
  style,
  onChangeStyle,
  displayMode,
  onChangeDisplayMode,
}: StylePanelProps) {
  const updateStyle = (key: keyof CaptionStyle, value: any) => {
    onChangeStyle({ ...style, [key]: value });
  };

  const applyPreset = (presetName: string) => {
    const base = { ...style };
    switch (presetName) {
      case "shorts":
        onChangeStyle({
          ...base,
          fontSize: 38,
          color: "#FBBF24",
          bgColor: "#000000",
          bgType: "solid",
          bgOpacity: 0.9,
          fontWeight: "900",
          strokeWidth: 6,
          strokeColor: "#000000",
          shadowColor: "#000000",
          shadowBlur: 10,
          verticalOffset: 50,
          horizontalOffset: 0,
          align: "center",
          borderRadius: 4,
          padding: 8,
          maxWidth: 80,
        });
        break;
      case "netflix":
        onChangeStyle({
          ...base,
          fontSize: 26,
          color: "#FFFFFF",
          bgColor: "#000000",
          bgType: "solid",
          bgOpacity: 0.6,
          fontWeight: "normal",
          strokeWidth: 2,
          strokeColor: "#000000",
          shadowColor: "#000000",
          shadowBlur: 4,
          verticalOffset: 12,
          horizontalOffset: 0,
          align: "center",
          borderRadius: 0,
          padding: 10,
          maxWidth: 90,
        });
        break;
      case "minimal-clean":
        onChangeStyle({
          ...base,
          fontSize: 30,
          color: "#FFFFFF",
          bgColor: "#000000",
          bgType: "none",
          bgOpacity: 0.0,
          fontWeight: "bold",
          strokeWidth: 4,
          strokeColor: "#000000",
          shadowColor: "rgba(0,0,0,0.5)",
          shadowBlur: 8,
          verticalOffset: 15,
          horizontalOffset: 0,
          align: "center",
          padding: 0,
          maxWidth: 95,
        });
        break;
      case "elegant-gold":
        onChangeStyle({
          ...base,
          fontSize: 32,
          color: "#FEF08A",
          bgColor: "#1C1917",
          bgType: "solid",
          bgOpacity: 0.8,
          fontWeight: "semibold",
          strokeWidth: 0,
          shadowColor: "#000000",
          shadowBlur: 15,
          verticalOffset: 20,
          align: "center",
          borderRadius: 20,
          padding: 15,
          maxWidth: 85,
        });
        break;
      default:
        break;
    }
  };

  return (
    <div id="style-panel-card" className="bg-white p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
      <div className="space-y-4 pb-5 border-b border-slate-100">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5" />
          Display Configuration
        </label>
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
          {(["amharic", "original", "dual"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeDisplayMode(mode)}
              className={`py-2 text-[10px] font-bold rounded-xl transition-all uppercase tracking-tighter ${
                displayMode === mode
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 pb-5 border-b border-slate-100">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          Pro Presets
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: "shorts", label: "TikTok Viral", desc: "Yellow, Bold, High", icon: "🔥" },
            { id: "netflix", label: "Netflix Sub", desc: "Classic Cinematic", icon: "🎬" },
            { id: "minimal-clean", label: "Outline Only", desc: "Clean & Modern", icon: "🕊️" },
            { id: "elegant-gold", label: "Royal Gold", desc: "Premium Look", icon: "⚜️" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className="text-left p-3 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group active:scale-[0.97]"
            >
              <span className="block text-xs font-bold text-slate-800 mb-0.5 group-hover:text-blue-700">{p.icon} {p.label}</span>
              <span className="block text-[9px] text-slate-400 font-medium">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5" />
          Manual Adjustments
        </h4>

        {/* Typography */}
        <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-500 flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Font Size</span>
              <span className="text-blue-600">{style.fontSize}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="100"
              value={style.fontSize}
              onChange={(e) => updateStyle("fontSize", parseInt(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer appearance-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>Line Height</span>
                <span>{style.lineHeight}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={style.lineHeight}
                onChange={(e) => updateStyle("lineHeight", parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1 bg-slate-200 rounded-full appearance-none"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>Letter Spacing</span>
                <span>{style.letterSpacing}px</span>
              </div>
              <input
                type="range"
                min="-5"
                max="20"
                value={style.letterSpacing}
                onChange={(e) => updateStyle("letterSpacing", parseInt(e.target.value))}
                className="w-full accent-blue-600 h-1 bg-slate-200 rounded-full appearance-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alignment & Weight</label>
            <div className="flex gap-2">
              <div className="flex-1 grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => updateStyle("align", a)}
                    className={`py-1.5 flex items-center justify-center rounded-lg transition-all ${style.align === a ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"}`}
                  >
                    {a === "left" ? <AlignLeft className="w-3 h-3" /> : a === "center" ? <AlignCenter className="w-3 h-3" /> : <AlignRight className="w-3 h-3" />}
                  </button>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {(["normal", "semibold", "bold"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => updateStyle("fontWeight", w)}
                    className={`py-1 text-[10px] font-bold rounded-lg transition-all ${style.fontWeight === w ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"}`}
                  >
                    {w === "normal" ? "N" : w === "semibold" ? "S" : "B"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Layout & Positioning */}
        <div className="space-y-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
          <label className="text-xs font-bold text-blue-800 flex items-center gap-2">
            <MousePointer2 className="w-3.5 h-3.5" />
            Layout & Offsets
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-blue-700">
                <span className="flex items-center gap-1"><MoveVertical className="w-3 h-3" /> Vertical</span>
                <span>{style.verticalOffset}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={style.verticalOffset}
                onChange={(e) => updateStyle("verticalOffset", parseInt(e.target.value))}
                className="w-full accent-blue-600 h-1 bg-blue-200 rounded-full cursor-pointer appearance-none"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-blue-700">
                <span className="flex items-center gap-1"><MoveHorizontal className="w-3 h-3" /> Horizontal</span>
                <span>{style.horizontalOffset}%</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={style.horizontalOffset}
                onChange={(e) => updateStyle("horizontalOffset", parseInt(e.target.value))}
                className="w-full accent-blue-600 h-1 bg-blue-200 rounded-full cursor-pointer appearance-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-blue-700">
              <span className="flex items-center gap-1"><Square className="w-3 h-3" /> Maximum Width</span>
              <span>{style.maxWidth}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={style.maxWidth}
              onChange={(e) => updateStyle("maxWidth", parseInt(e.target.value))}
              className="w-full accent-blue-600 h-1 bg-blue-200 rounded-full cursor-pointer appearance-none"
            />
          </div>
        </div>

        {/* Text Color */}
        <ColorSelector
          label="Text Color"
          color={style.color}
          onChange={(c) => updateStyle("color", c)}
          presets={COLOR_PRESETS}
        />

        {/* Background Styling */}
        <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Background Box
            </label>
            <div className="flex bg-white rounded-lg p-1 border border-slate-200">
              {(["none", "solid"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateStyle("bgType", t)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all uppercase ${style.bgType === t ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {style.bgType === "solid" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <ColorSelector
                label="Box Color"
                color={style.bgColor}
                onChange={(c) => updateStyle("bgColor", c)}
                presets={COLOR_PRESETS}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Opacity</span>
                    <span>{Math.round(style.bgOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={style.bgOpacity}
                    onChange={(e) => updateStyle("bgOpacity", parseFloat(e.target.value))}
                    className="w-full accent-slate-600 h-1 bg-slate-200 rounded-full appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Padding</span>
                    <span>{style.padding}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={style.padding}
                    onChange={(e) => updateStyle("padding", parseInt(e.target.value))}
                    className="w-full accent-slate-600 h-1 bg-slate-200 rounded-full appearance-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Corner Radius</span>
                  <span>{style.borderRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={style.borderRadius}
                  onChange={(e) => updateStyle("borderRadius", parseInt(e.target.value))}
                  className="w-full accent-slate-600 h-1 bg-slate-200 rounded-full appearance-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Effects */}
        <div className="space-y-4 p-4 bg-amber-50/30 rounded-2xl border border-amber-100/50">
          <label className="text-[10px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Effects & Depth
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-amber-700">
                <span>Stroke</span>
                <span>{style.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={style.strokeWidth}
                onChange={(e) => updateStyle("strokeWidth", parseInt(e.target.value))}
                className="w-full accent-amber-600 h-1 bg-amber-200/50 rounded-full appearance-none"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-amber-700">
                <span>Shadow Blur</span>
                <span>{style.shadowBlur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={style.shadowBlur}
                onChange={(e) => updateStyle("shadowBlur", parseInt(e.target.value))}
                className="w-full accent-amber-600 h-1 bg-amber-200/50 rounded-full appearance-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
