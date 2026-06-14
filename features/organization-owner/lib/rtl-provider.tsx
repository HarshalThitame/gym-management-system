"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Direction = "ltr" | "rtl";

type RtlContextType = {
  dir: Direction;
  setDir: (dir: Direction) => void;
  toggleDir: () => void;
};

const RtlContext = createContext<RtlContextType>({ dir: "ltr", setDir: () => {}, toggleDir: () => {} });

export function useRtl() {
  return useContext(RtlContext);
}

export function RtlProvider({ children, initialDir = "ltr" }: { children: ReactNode; initialDir?: Direction }) {
  const [dir, setDirState] = useState<Direction>(initialDir);

  const setDir = useCallback((d: Direction) => {
    setDirState(d);
    document.documentElement.dir = d;
    localStorage.setItem("org-owner-dir", d);
  }, []);

  const toggleDir = useCallback(() => {
    setDir(dir === "ltr" ? "rtl" : "ltr");
  }, [dir, setDir]);

  useEffect(() => {
    const stored = localStorage.getItem("org-owner-dir") as Direction | null;
    if (stored === "ltr" || stored === "rtl") {
      setDir(stored);
    }
  }, [setDir]);

  return <RtlContext.Provider value={{ dir, setDir, toggleDir }}>{children}</RtlContext.Provider>;
}
