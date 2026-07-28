"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface TopLoadingContextValue {
  start: () => void;
  done: () => void;
}

const TopLoadingContext = createContext<TopLoadingContextValue | null>(null);

export function useTopLoading(): TopLoadingContextValue {
  const ctx = useContext(TopLoadingContext);
  if (!ctx) throw new Error("useTopLoading must be used inside TopLoadingProvider");
  return ctx;
}

export function TopLoadingProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const countRef = useRef(0);

  const start = useCallback(() => {
    countRef.current += 1;
    setVisible(true);
  }, []);

  const done = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) setVisible(false);
  }, []);

  return (
    <TopLoadingContext.Provider value={{ start, done }}>
      {visible && (
        <div className="fixed left-0 right-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent">
          <div className="h-full w-1/3 animate-[loading-bar_1s_ease-in-out_infinite] bg-brand-gradient" />
        </div>
      )}
      {children}
    </TopLoadingContext.Provider>
  );
}
