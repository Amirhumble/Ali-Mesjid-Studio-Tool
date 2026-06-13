import { useEffect, useState } from "react";
import type { AppTab } from "../types";
import { STUDIO_TABS } from "../types";

function isAppTab(value: string): value is AppTab {
  return STUDIO_TABS.includes(value as AppTab);
}

function readInitialTab(defaultTab: AppTab) {
  if (typeof window === "undefined") return defaultTab;
  const hashValue = window.location.hash.replace("#", "");
  return isAppTab(hashValue) ? hashValue : defaultTab;
}

export function useHashTab(defaultTab: AppTab = "compressor") {
  const [activeTab, setActiveTab] = useState<AppTab>(() => readInitialTab(defaultTab));

  useEffect(() => {
    const handleHashChange = () => {
      const nextHash = window.location.hash.replace("#", "");
      if (isAppTab(nextHash)) {
        setActiveTab(nextHash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace("#", "") !== activeTab) {
      window.location.hash = activeTab;
    }
    window.scrollTo(0, 0);
  }, [activeTab]);

  return [activeTab, setActiveTab] as const;
}
