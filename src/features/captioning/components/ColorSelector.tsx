import { useState, useEffect } from "react";
import { Pipette, Star, Clock, Hash, Check } from "lucide-react";

interface ColorSelectorProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
  presets: string[];
}

export default function ColorSelector({
  label,
  color,
  onChange,
  presets,
}: ColorSelectorProps) {
  const [hexInput, setHexInput] = useState(color);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // Load favorites and recent from localStorage
    const savedFavs = localStorage.getItem("caption_color_favs");
    const savedRecent = localStorage.getItem("caption_color_recent");
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
    if (savedRecent) setRecent(JSON.parse(savedRecent));
  }, []);

  useEffect(() => {
    setHexInput(color);
    
    // Update recent colors
    if (color && !recent.includes(color)) {
      const updatedRecent = [color, ...recent.filter(c => c !== color)].slice(0, 10);
      setRecent(updatedRecent);
      localStorage.setItem("caption_color_recent", JSON.stringify(updatedRecent));
    }
  }, [color]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (!value.startsWith("#")) value = "#" + value;
    setHexInput(value);
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      onChange(value);
    }
  };

  const toggleFavorite = (c: string) => {
    let updated;
    if (favorites.includes(c)) {
      updated = favorites.filter(fav => fav !== c);
    } else {
      updated = [c, ...favorites].slice(0, 20);
    }
    setFavorites(updated);
    localStorage.setItem("caption_color_favs", JSON.stringify(updated));
  };

  const r = parseInt(color.slice(1, 3), 16) || 0;
  const g = parseInt(color.slice(3, 5), 16) || 0;
  const b = parseInt(color.slice(5, 7), 16) || 0;

  return (
    <div className="space-y-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
          <Hash className="w-2.5 h-2.5 text-slate-400" />
          <input
            type="text"
            value={hexInput.replace("#", "")}
            onChange={handleHexChange}
            className="w-14 text-[10px] font-mono font-bold bg-transparent focus:outline-none text-slate-700"
            maxLength={6}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative group">
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded-xl border-2 border-slate-100 cursor-pointer appearance-none bg-transparent overflow-hidden"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white mix-blend-difference opacity-0 group-hover:opacity-100 transition-opacity">
            <Pipette className="w-4 h-4" />
          </div>
        </div>

        <div className="flex-1 grid grid-cols-6 gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${
                color.toLowerCase() === p.toLowerCase() ? "border-blue-500 shadow-sm" : "border-transparent"
              }`}
              style={{ backgroundColor: p }}
            >
              {color.toLowerCase() === p.toLowerCase() && <Check className="w-3 h-3 text-white mix-blend-difference" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-50">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold text-slate-400">R</span>
          <span className="text-[10px] font-mono text-slate-600">{r}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold text-slate-400">G</span>
          <span className="text-[10px] font-mono text-slate-600">{g}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold text-slate-400">B</span>
          <span className="text-[10px] font-mono text-slate-600">{b}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => toggleFavorite(color)}
          className={`p-1.5 rounded-lg transition-colors ${favorites.includes(color) ? "bg-amber-100 text-amber-600" : "bg-slate-50 text-slate-400 hover:text-amber-500"}`}
          title="Toggle Favorite"
        >
          <Star className={`w-3.5 h-3.5 ${favorites.includes(color) ? "fill-current" : ""}`} />
        </button>
        
        <div className="flex-1 flex gap-1 items-center overflow-x-auto custom-scrollbar-mini py-1">
          {favorites.length > 0 && (
            <div className="flex gap-1 pr-2 border-r border-slate-100">
              {favorites.slice(0, 5).map(f => (
                <button
                  key={f}
                  onClick={() => onChange(f)}
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-slate-200"
                  style={{ backgroundColor: f }}
                />
              ))}
            </div>
          )}
          <div className="flex gap-1 pl-1 items-center">
            <Clock className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
            {recent.slice(0, 8).map(r => (
              <button
                key={r}
                onClick={() => onChange(r)}
                className="w-4 h-4 rounded-full flex-shrink-0 border border-slate-100"
                style={{ backgroundColor: r }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
