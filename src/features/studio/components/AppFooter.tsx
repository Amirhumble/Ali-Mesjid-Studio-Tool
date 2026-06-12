import type { AppTab } from "../types";

interface AppFooterProps {
  activeTab: AppTab;
}

export default function AppFooter({ activeTab }: AppFooterProps) {
  return (
    <footer className="mt-12 border-t border-slate-200/50 pt-8 pb-6">
      <div className="text-center text-xs text-slate-500">
        (c) 2024 Ali Mesjid Studio Tool. All rights reserved. Developed by <span className="font-semibold text-slate-900">Amir Tofik</span>
      </div>
      <div className="text-center text-xs md:text-sm font-mono text-slate-500 mt-4">
        {activeTab === "compressor" ? "FFMPEG.WASM ENGINE - LOCAL NODE" : "GOOGLE GEMINI 2.0 FLASH - CLOUD NODE"}
      </div>
    </footer>
  );
}
