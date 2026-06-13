import { useTranslation } from "react-i18next";
import type { Dispatch, SetStateAction } from "react";
import { Clock, Film, Languages, Mic, Video } from "lucide-react";
import type { AppTab } from "../types";

interface AppNavigationProps {
  logoSrc: string;
  activeTab: AppTab;
  onChangeTab: Dispatch<SetStateAction<AppTab>>;
  showHistory: boolean;
  onToggleHistory: () => void;
}

const tabs = [
  { id: "compressor" as const, icon: Film, labelKey: "app.compressor" },
  { id: "transcribe" as const, icon: Mic, labelKey: "app.transcriber" },
  { id: "subtitleStudio" as const, icon: Video, labelKey: "app.subtitleStudio" },
];

export default function AppNavigation({
  logoSrc,
  activeTab,
  onChangeTab,
  showHistory,
  onToggleHistory,
}: AppNavigationProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === "en";

  const renderTabButton = (tabId: AppTab, compact = false) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return null;

    const Icon = tab.icon;
    const activeClass = compact
      ? "bg-blue-600 text-white shadow-md"
      : "bg-white text-blue-600 shadow-md";
    const inactiveClass = compact
      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
      : "text-slate-600 hover:text-slate-900";

    return (
      <button
        key={tab.id}
        onClick={() => onChangeTab(tab.id)}
        className={`${
          compact ? "flex-1 h-11 sm:h-12 px-2 sm:px-3" : "px-4 md:px-5 lg:px-6 py-2.5 md:py-3 h-11 md:h-12 lg:h-13"
        } rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 touch-manipulation ${
          activeTab === tab.id ? activeClass : inactiveClass
        }`}
      >
        <Icon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
        <span className="truncate">{t(tab.labelKey)}</span>
      </button>
    );
  };

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-5">
        <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
          <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
            <img
              src={logoSrc}
              alt={t("app.logo_alt")}
              className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg sm:rounded-lg md:rounded-xl shadow-lg object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent truncate leading-tight">
                {t("app.title")}
              </h1>
              <p className="text-xs sm:text-xs md:text-sm text-slate-500 font-medium hidden sm:block truncate">
                {t("app.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 flex-shrink-0">
            <button
              onClick={() => i18n.changeLanguage(isEnglish ? "am" : "en")}
              className="h-11 w-11 sm:h-12 sm:w-auto sm:px-3 md:px-4 md:h-12 lg:h-13 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm hover:shadow-md active:scale-95 touch-manipulation"
            >
              <Languages className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
              <span className="hidden md:inline text-xs md:text-sm">{isEnglish ? "Amharic" : "English"}</span>
            </button>
            <button
              onClick={onToggleHistory}
              className={`h-11 w-11 sm:h-12 sm:w-auto sm:px-3 md:px-4 md:h-12 lg:h-13 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm hover:shadow-md active:scale-95 touch-manipulation ${
                showHistory ? "bg-blue-600 text-white shadow-lg" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Clock className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0" />
              <span className="hidden md:inline text-xs md:text-sm">{t("app.history")}</span>
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 bg-slate-100/50 p-2 rounded-xl mt-4">
          {tabs.map((tab) => renderTabButton(tab.id, false))}
        </div>

        <div className="md:hidden flex gap-2 mt-3 sm:mt-3.5">
          {tabs.map((tab) => renderTabButton(tab.id, true))}
        </div>
      </div>
    </nav>
  );
}
